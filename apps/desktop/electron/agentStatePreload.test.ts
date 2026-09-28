import { describe, expect, it, vi } from 'vitest';
import type { IpcRenderer } from 'electron';
import type { TrustedAgentState } from '../shared/agentState.js';
import { agentStateChannels } from '../shared/agentState.js';
import { createAgentStateApi } from './agentStatePreload.js';
import { createAgentStateStore } from '../src/agentState/store.js';

const initial: TrustedAgentState = {
  revision: 0, phase: 'awaiting-connector', sessionId: null, agents: null,
};

function fakeIpc() {
  const listeners = new Set<(...args: unknown[]) => void>();
  const pending = new Map<number, { resolve: (value: TrustedAgentState) => void; reject: (error: Error) => void }>();
  const calls: Array<[string, number]> = [];
  const ipc = {
    on: vi.fn((_channel: string, listener: (...args: unknown[]) => void) => { listeners.add(listener); }),
    removeListener: vi.fn((_channel: string, listener: (...args: unknown[]) => void) => { listeners.delete(listener); }),
    invoke: vi.fn((channel: string, generation: number) => {
      calls.push([channel, generation]);
      if (channel === agentStateChannels.close) return Promise.resolve();
      return new Promise<TrustedAgentState>((resolve, reject) => {
        pending.set(generation, { resolve, reject });
      });
    }),
  };
  return {
    ipc: ipc as unknown as Pick<IpcRenderer, 'on' | 'removeListener' | 'invoke'>,
    listeners,
    pending,
    calls,
    emit(generation: number, change: unknown) {
      for (const listener of listeners) listener({ hiddenElectronEvent: true }, { generation, change });
    },
  };
}

describe('agent-state preload capability', () => {
  it('reconciles buffered stale and newer data while retaining a same-revision phase change', async () => {
    const fake = fakeIpc();
    const store = createAgentStateStore(createAgentStateApi(fake.ipc));
    const agents = [
      { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle' as const, activity: 'Available' },
      { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'working' as const, activity: 'Reviewing' },
      { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting' as const, activity: 'Waiting' },
    ];
    const baseline = { revision: 1, phase: 'ready' as const, sessionId: 'session-1', agents };
    const updated = { ...baseline, revision: 2, agents: [
      { ...agents[0], state: 'completed' as const, activity: 'Done' }, agents[1], agents[2],
    ] };
    const starting = store.start();
    fake.emit(1, { kind: 'snapshot', state: baseline });
    fake.emit(1, { kind: 'event', state: updated, agent: updated.agents[0] });
    fake.emit(1, { kind: 'connection', state: { ...updated, phase: 'disconnected' } });
    fake.pending.get(1)!.resolve(baseline);
    await starting;
    expect(store.getSnapshot()).toMatchObject({
      revision: 2, connection: 'disconnected',
      agentsById: { 'mock-agent-ari': { state: 'completed', activity: 'Done' } },
    });
    store.stop();
  });

  it('attaches before opening, buffers changes, delivers current first, and closes the fixed listener', async () => {
    const fake = fakeIpc();
    const received: unknown[] = [];
    const watch = createAgentStateApi(fake.ipc).watch((message) => received.push(message));
    expect(fake.listeners.size).toBe(1);
    expect(fake.calls).toEqual([[agentStateChannels.open, 1]]);
    const phase = { kind: 'connection', state: { ...initial, phase: 'disconnected' } };
    fake.emit(1, phase);
    expect(received).toEqual([]);
    fake.pending.get(1)!.resolve(initial);
    await watch.ready;
    expect(received).toEqual([
      { kind: 'current', state: initial },
      { kind: 'change', change: phase },
    ]);
    fake.emit(1, { kind: 'connection', state: initial });
    expect(received).toHaveLength(3);
    expect(JSON.stringify(received)).not.toContain('hiddenElectronEvent');
    watch.close();
    expect(fake.listeners.size).toBe(0);
    expect(fake.calls.at(-1)).toEqual([agentStateChannels.close, 1]);
  });

  it('replaces a watch and ignores old generations and late closes', async () => {
    const fake = fakeIpc();
    const api = createAgentStateApi(fake.ipc);
    const oldListener = vi.fn();
    const old = api.watch(oldListener);
    const currentListener = vi.fn();
    const newer = api.watch(currentListener);
    await expect(old.ready).rejects.toThrow('agent_state_watch_closed');
    expect(fake.listeners.size).toBe(1);
    fake.pending.get(1)!.resolve(initial);
    fake.pending.get(2)!.resolve(initial);
    await newer.ready;
    fake.emit(1, { kind: 'connection', state: initial });
    expect(currentListener).toHaveBeenCalledTimes(1);
    expect(oldListener).not.toHaveBeenCalled();
    old.close();
    expect(fake.listeners.size).toBe(1);
    newer.close();
  });

  it('removes its listener if opening fails', async () => {
    const fake = fakeIpc();
    const watch = createAgentStateApi(fake.ipc).watch(vi.fn());
    fake.pending.get(1)!.reject(new Error('open_failed'));
    await expect(watch.ready).rejects.toThrow();
    expect(fake.listeners.size).toBe(0);
  });
});


describe('reload current-state restoration', () => {
  it.each(['ready', 'synchronizing', 'disconnected'] as const)('restores %s and replaces the old watch without duplicate callbacks', async (phase) => {
    const fake = fakeIpc();
    const api = createAgentStateApi(fake.ipc);
    const agents = [
      { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'completed' as const, activity: 'Change implemented' },
      { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'completed' as const, activity: 'Review complete' },
      { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting' as const, activity: 'Taking a coffee break in the simulated office' },
    ];
    const old = createAgentStateStore(api);
    const firstStart = old.start();
    fake.pending.get(1)!.resolve({ revision: 6, phase: 'ready', sessionId: 'session-1', agents });
    await firstStart;
    old.stop();
    const fresh = createAgentStateStore(api);
    const start = fresh.start();
    const current = { revision: 6, phase, sessionId: phase === 'synchronizing' ? 'session-2' : 'session-1', agents };
    fake.pending.get(2)!.resolve(current);
    await start;
    expect(fake.listeners.size).toBe(1);
    expect(fresh.getSnapshot()).toMatchObject({ revision: 6, synchronized: phase === 'ready',
      connection: phase === 'ready' ? 'connected' : phase === 'disconnected' ? 'disconnected' : 'connecting' });
    expect(fresh.getSnapshot().agentsById['mock-agent-sol']?.activity).toBe(agents[2].activity);
    fake.emit(1, { kind: 'snapshot', state: { ...current, revision: 99, phase: 'ready' } });
    expect(fresh.getSnapshot().revision).toBe(6);
    const next = { ...current, revision: 7, sessionId: 'session-2', phase: 'ready' as const,
      agents: agents.map((agent) => ({ ...agent, activity: 'New session truth' })) };
    fake.emit(2, { kind: 'snapshot', state: next });
    expect(fresh.getSnapshot()).toMatchObject({ revision: 7, synchronized: true, connection: 'connected' });
    fresh.stop();
    expect(fake.listeners.size).toBe(0);
  });
});
