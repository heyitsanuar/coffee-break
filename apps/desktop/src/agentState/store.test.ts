import { describe, expect, it, vi } from 'vitest';
import type { AgentStateApi, AgentStateMessage, TrustedAgentState } from '../../shared/agentState';
import { createAgentStateStore } from './store';

const agents = () => [
  { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle' as const, activity: 'Available' },
  { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'working' as const, activity: 'Reviewing' },
  { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting' as const, activity: 'Waiting' },
];
const mirror = (revision: number): TrustedAgentState => ({
  revision, phase: 'ready', sessionId: 'session-1', agents: agents(),
});

function fakeBridge() {
  const watches: Array<{ emit: (message: AgentStateMessage) => void; close: ReturnType<typeof vi.fn> }> = [];
  const bridge: AgentStateApi = {
    watch(listener) {
      const item = { emit: listener, close: vi.fn() };
      watches.push(item);
      return { ready: Promise.resolve(), close: item.close };
    },
  };
  return { bridge, watches };
}

describe('renderer agent-state store ownership', () => {
  it('starts once outside component subscriptions and ignores old watches after restart', async () => {
    const fake = fakeBridge();
    const store = createAgentStateStore(fake.bridge);
    const notify = vi.fn();
    const unsubscribe = store.subscribe(notify);
    await Promise.all([store.start(), store.start()]);
    expect(fake.watches).toHaveLength(1);
    fake.watches[0].emit({ kind: 'current', state: mirror(1) });
    expect(store.getSnapshot().synchronized).toBe(true);
    expect(notify).toHaveBeenCalled();
    store.stop();
    expect(fake.watches[0].close).toHaveBeenCalledOnce();
    await store.start();
    expect(fake.watches).toHaveLength(2);
    const before = store.getSnapshot();
    fake.watches[0].emit({ kind: 'current', state: mirror(9) });
    expect(store.getSnapshot()).toBe(before);
    unsubscribe();
    store.stop();
  });

  it('reopens an atomic watch after an invalid gap and retains valid agents', async () => {
    const fake = fakeBridge();
    const store = createAgentStateStore(fake.bridge);
    await store.start();
    fake.watches[0].emit({ kind: 'current', state: mirror(1) });
    const before = store.getSnapshot().agentsById;
    fake.watches[0].emit({ kind: 'change', change: {
      kind: 'snapshot', state: { ...mirror(4), agents: agents().slice(0, 2) },
    } });
    expect(store.getSnapshot().agentsById).toBe(before);
    await Promise.resolve();
    expect(fake.watches[0].close).toHaveBeenCalledOnce();
    expect(fake.watches).toHaveLength(2);
    fake.watches[1].emit({ kind: 'current', state: mirror(4) });
    expect(store.getSnapshot().revision).toBe(4);
    store.stop();
  });

  it('does not loop indefinitely if the recovery read is also invalid', async () => {
    const fake = fakeBridge();
    const store = createAgentStateStore(fake.bridge);
    await store.start();
    fake.watches[0].emit({ kind: 'current', state: mirror(1) });
    const invalid = { ...mirror(4), agents: agents().slice(0, 2) };
    fake.watches[0].emit({ kind: 'change', change: { kind: 'snapshot', state: invalid } });
    await Promise.resolve();
    fake.watches[1].emit({ kind: 'current', state: invalid });
    expect(fake.watches).toHaveLength(2);
    expect(fake.watches[1].close).toHaveBeenCalledOnce();
    expect(store.getSnapshot().connection).toBe('disconnected');
    expect(store.getSnapshot().agentsById['mock-agent-ari']).toEqual({ state: 'idle', activity: 'Available' });
    store.stop();
  });

  it('allows only one automatic recovery watch despite valid recovery current and repeated invalid mirrors', async () => {
    const fake = fakeBridge();
    const store = createAgentStateStore(fake.bridge);
    await store.start();
    fake.watches[0].emit({ kind: 'current', state: mirror(1) });
    const invalid = (revision: number) => ({ kind: 'change' as const, change: {
      kind: 'snapshot' as const, state: { ...mirror(revision), agents: agents().slice(0, 2) },
    } });

    fake.watches[0].emit(invalid(4));
    await Promise.resolve();
    expect(fake.watches).toHaveLength(2);
    expect(fake.watches[0].close).toHaveBeenCalledOnce();

    fake.watches[1].emit({ kind: 'current', state: mirror(4) });
    const lastValidAgents = store.getSnapshot().agentsById;
    fake.watches[1].emit(invalid(5));
    fake.watches[1].emit(invalid(6));
    fake.watches[1].emit(invalid(7));
    await Promise.resolve();

    expect(fake.watches).toHaveLength(2);
    expect(fake.watches[1].close).toHaveBeenCalledOnce();
    expect(store.getSnapshot().agentsById).toBe(lastValidAgents);
    expect(store.getSnapshot()).toMatchObject({ revision: 4, connection: 'disconnected' });
    await store.start();
    expect(fake.watches).toHaveLength(2);
    store.stop();
  });

  it('repairs a complete revision gap without consuming recovery and resets the budget only after stop/start', async () => {
    const fake = fakeBridge();
    const store = createAgentStateStore(fake.bridge);
    await store.start();
    fake.watches[0].emit({ kind: 'current', state: mirror(1) });
    const replacement = { ...agents()[0], state: 'completed' as const, activity: 'Done' };
    fake.watches[0].emit({ kind: 'change', change: {
      kind: 'event', state: { ...mirror(4), agents: [replacement, ...agents().slice(1)] },
      agent: replacement,
    } });
    expect(store.getSnapshot().agentsById['mock-agent-ari']).toEqual({ state: 'completed', activity: 'Done' });
    expect(fake.watches).toHaveLength(1);

    store.stop();
    await store.start();
    fake.watches[1].emit({ kind: 'current', state: mirror(4) });
    fake.watches[1].emit({ kind: 'change', change: {
      kind: 'snapshot', state: { ...mirror(5), agents: agents().slice(0, 2) },
    } });
    await Promise.resolve();
    expect(fake.watches).toHaveLength(3);
    expect(fake.watches[1].close).toHaveBeenCalledOnce();
    store.stop();
  });

  it('invalidates a failed initialization watch so a late callback cannot start recovery', async () => {
    let emit!: (message: AgentStateMessage) => void;
    const close = vi.fn();
    const bridge: AgentStateApi = {
      watch(listener) {
        emit = listener;
        return { ready: Promise.reject(new Error('open_failed')), close };
      },
    };
    const store = createAgentStateStore(bridge);
    await expect(store.start()).rejects.toThrow('open_failed');
    expect(close).toHaveBeenCalledOnce();
    emit({ kind: 'change', change: {
      kind: 'snapshot', state: { ...mirror(4), agents: agents().slice(0, 2) },
    } });
    await Promise.resolve();
    expect(close).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toMatchObject({
      revision: 0, connection: 'disconnected', synchronized: false, agentsById: {},
    });
    store.stop();
  });
});


describe('renderer availability deadline', () => {
  it('keeps one watch open at five seconds and accepts a late snapshot', async () => {
    vi.useFakeTimers();
    const fake = fakeBridge();
    const store = createAgentStateStore(fake.bridge);
    try {
      await Promise.all([store.start(), store.start()]);
      expect(store.getSnapshot().connection).toBe('connecting');
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(4_999);
      expect(store.getSnapshot().connection).toBe('connecting');
      vi.advanceTimersByTime(1);
      expect(store.getSnapshot()).toMatchObject({ connection: 'disconnected', synchronized: false });
      expect(fake.watches[0].close).not.toHaveBeenCalled();
      fake.watches[0].emit({ kind: 'current', state: { revision: 0, phase: 'awaiting-connector', sessionId: null, agents: null } });
      expect(store.getSnapshot().connection).toBe('disconnected');
      fake.watches[0].emit({ kind: 'current', state: mirror(1) });
      expect(store.getSnapshot()).toMatchObject({ connection: 'connected', synchronized: true });
    } finally { store.stop(); vi.useRealTimers(); }
  });

  it('cancels the deadline on success and stop; restart gets a fresh deadline', async () => {
    vi.useFakeTimers();
    const fake = fakeBridge();
    const store = createAgentStateStore(fake.bridge);
    try {
      await store.start();
      vi.advanceTimersByTime(5_000);
      expect(store.getSnapshot().connection).toBe('disconnected');
      store.stop();
      expect(vi.getTimerCount()).toBe(0);
      await store.start();
      fake.watches[1].emit({ kind: 'current', state: { revision: 0, phase: 'awaiting-connector', sessionId: null, agents: null } });
      vi.advanceTimersByTime(1_000);
      expect(store.getSnapshot().connection).toBe('connecting');
      fake.watches[1].emit({ kind: 'current', state: mirror(1) });
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(10_000);
      expect(store.getSnapshot().connection).toBe('connected');
      expect(fake.watches).toHaveLength(2);
    } finally { store.stop(); vi.useRealTimers(); }
  });

  it('shows active bounded recovery and becomes unsynchronized after exhaustion', async () => {
    const fake = fakeBridge();
    const store = createAgentStateStore(fake.bridge);
    await store.start();
    fake.watches[0].emit({ kind: 'current', state: mirror(1) });
    const retained = store.getSnapshot().agentsById;
    const invalid = { ...mirror(4), agents: agents().slice(0, 2) };
    fake.watches[0].emit({ kind: 'change', change: { kind: 'snapshot', state: invalid } });
    expect(store.getSnapshot()).toMatchObject({ connection: 'connecting', synchronized: false, agentsById: retained });
    await Promise.resolve();
    fake.watches[1].emit({ kind: 'current', state: invalid });
    expect(store.getSnapshot()).toMatchObject({ connection: 'disconnected', synchronized: false, agentsById: retained });
    fake.watches[0].emit({ kind: 'current', state: mirror(10) });
    fake.watches[1].emit({ kind: 'current', state: mirror(10) });
    expect(store.getSnapshot().revision).toBe(1);
    store.stop();
  });
});


it('makes a cleared deadline callback inert after restart and after successful synchronization', async () => {
  vi.useFakeTimers();
  const set = vi.spyOn(globalThis, 'setTimeout');
  const fake = fakeBridge();
  const store = createAgentStateStore(fake.bridge);
  try {
    await store.start();
    const stale = set.mock.calls[0][0] as () => void;
    store.stop();
    await store.start();
    stale();
    expect(store.getSnapshot().connection).toBe('connecting');
    const currentDeadline = set.mock.calls.at(-1)![0] as () => void;
    fake.watches[1].emit({ kind: 'current', state: mirror(1) });
    currentDeadline();
    expect(store.getSnapshot()).toMatchObject({ connection: 'connected', synchronized: true });
  } finally { store.stop(); set.mockRestore(); vi.useRealTimers(); }
});

it('accepted-update seam observes previous/next/provenance before ordinary subscribers, and excludes stale input', async () => {
  const fake = fakeBridge(); const store = createAgentStateStore(fake.bridge);
  await store.start();
  const observed = vi.fn(); const ordinary = vi.fn(() => expect(observed).toHaveBeenCalled());
  const detach = store.subscribeAcceptedUpdates(observed); const unsubscribe = store.subscribe(ordinary);
  fake.watches[0].emit({ kind: 'current', state: mirror(1) });
  expect(observed.mock.calls[0][0]).toMatchObject({ previous: { revision: 0, synchronized: false }, next: { revision: 1, synchronized: true }, action: { kind: 'current' } });
  fake.watches[0].emit({ kind: 'current', state: mirror(0) }); expect(observed).toHaveBeenCalledOnce();
  detach(); unsubscribe(); fake.watches[0].emit({ kind: 'current', state: mirror(2) });
  expect(observed).toHaveBeenCalledOnce(); store.stop();
});
