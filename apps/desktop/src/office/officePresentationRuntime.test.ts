import { expect, it, vi } from 'vitest';
import { createAgentStateStore } from '../agentState/store';
import type { AgentStateMessage, TrustedAgentState } from '../../shared/agentState';
import type { AgentLifecycleState } from '@coffee-break/contracts';
import { createOfficePresentationRuntime } from './officePresentationRuntime';

function fixture(reduced = false, initial: AgentLifecycleState = 'working') {
  let emit!: (message: AgentStateMessage) => void;
  const store = createAgentStateStore({ watch(listener) { emit = listener; return { ready: Promise.resolve(), close() {} }; } });
  let mediaListener!: () => void;
  const media = { matches: reduced, addEventListener: vi.fn((_event: 'change', fn: () => void) => { mediaListener = fn; }), removeEventListener: vi.fn() };
  const runtime = createOfficePresentationRuntime(store, media);
  const acknowledgements = vi.fn();
  runtime.subscribeAcknowledgements(acknowledgements);
  let revision = 1;
  let sessionId = 'session-1';
  let state: AgentLifecycleState = initial;
  const mirror = (phase: TrustedAgentState['phase'] = 'ready'): TrustedAgentState => ({
    revision, sessionId, phase, agents: [
      { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state, activity: 'Trusted activity' },
      { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'idle', activity: 'Ready' },
      { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting', activity: 'Waiting' },
    ],
  });
  const current = () => emit({ kind: 'current', state: mirror() });
  const event = (next: AgentLifecycleState, activity = 'Trusted activity', reason?: 'approval_required') => {
    state = next; revision++;
    const value = mirror(); value.agents![0] = { ...value.agents![0], activity, ...(reason ? { reason } : {}) };
    emit({ kind: 'change', change: { kind: 'event', state: value, agent: value.agents![0] } });
  };
  const connection = (phase: TrustedAgentState['phase']) => emit({ kind: 'change', change: { kind: 'connection', state: mirror(phase) } });
  const restore = (next: AgentLifecycleState) => { sessionId = 'session-2'; state = next; revision++; emit({ kind: 'change', change: { kind: 'snapshot', state: mirror() } }); };
  return { store, runtime, media, acknowledgements, current, event, connection, restore,
    preference: (value: boolean) => { media.matches = value; mediaListener(); },
    close: () => { runtime.dispose(); store.stop(); } };
}
it('observes contiguous live completed/error transitions synchronously without React batching', async () => {
  const f = fixture(); await f.store.start(); f.current();
  f.event('completed'); f.event('working'); f.event('error');
  expect(f.acknowledgements.mock.calls.map(([value]) => value.state)).toEqual(['completed', 'error']);
  expect(f.acknowledgements.mock.calls.map(([value]) => value.sequence)).toEqual([1, 2]);
  expect(f.runtime.getSnapshot()['mock-agent-ari']).toMatchObject({ state: 'error', live: true, reducedMotion: false }); f.close();
});
it('initial/current, same-state and activity/reason-only changes never acknowledge', async () => {
  const f = fixture(); await f.store.start(); f.current();
  f.event('working'); f.event('working', 'Changed'); f.event('working', 'Changed', 'approval_required');
  f.current(); expect(f.acknowledgements).not.toHaveBeenCalled(); f.close();
});
it.each(['completed', 'error'] as const)('restored %s starts settled; a later live transition still acknowledges', async state => {
  const f = fixture(); await f.store.start(); f.current(); f.connection('disconnected');
  expect(f.runtime.getSnapshot()['mock-agent-ari']).toMatchObject({ state: 'working', live: false });
  f.connection('synchronizing'); f.restore(state);
  expect(f.acknowledgements).not.toHaveBeenCalled();
  f.event('working'); f.event(state); expect(f.acknowledgements).toHaveBeenCalledOnce(); f.close();
});
it('same lifecycle restoration resumes live state without an acknowledgement', async () => {
  const f = fixture(); await f.store.start(); f.current(); f.connection('disconnected'); f.restore('working');
  expect(f.runtime.getSnapshot()['mock-agent-ari'].live).toBe(true); expect(f.acknowledgements).not.toHaveBeenCalled(); f.close();
});
it('initial and runtime reduced motion suppress reactions; disabling it never replays', async () => {
  const f = fixture(true); await f.store.start(); f.current(); f.event('completed');
  expect(f.acknowledgements).not.toHaveBeenCalled(); f.preference(false);
  expect(f.acknowledgements).not.toHaveBeenCalled(); f.event('working'); f.event('error');
  expect(f.acknowledgements).toHaveBeenCalledOnce(); f.preference(true);
  expect(f.runtime.getSnapshot()['mock-agent-ari'].reducedMotion).toBe(true); f.close();
});
it('snapshot/repair gaps, stale session events and rejected input never acknowledge', async () => {
  let emit!: (message: AgentStateMessage) => void;
  const store = createAgentStateStore({ watch(fn) { emit = fn; return { ready: Promise.resolve(), close() {} }; } });
  const runtime = createOfficePresentationRuntime(store, { matches: false, addEventListener() {}, removeEventListener() {} });
  const ack = vi.fn(); runtime.subscribeAcknowledgements(ack); await store.start();
  const agents: NonNullable<TrustedAgentState['agents']> = ['Ari', 'Mina', 'Sol'].map(name => ({ agent: { id: `mock-agent-${name.toLowerCase()}`, displayName: name }, state: 'working', activity: 'Work' }));
  const state = { revision: 1, sessionId: 'session-1', phase: 'ready' as const, agents };
  emit({ kind: 'current', state });
  const error = { ...agents[0], state: 'error' as const };
  emit({ kind: 'change', change: { kind: 'event', state: { ...state, revision: 3, agents: [error, ...agents.slice(1)] }, agent: error } });
  emit({ kind: 'change', change: { kind: 'event', state: { ...state, revision: 4, sessionId: 'old', agents: [error, ...agents.slice(1)] }, agent: error } });
  expect(ack).not.toHaveBeenCalled(); runtime.dispose(); store.stop();
});
it('disposal removes the media listener and accepted-update subscription', async () => {
  const f = fixture(); await f.store.start(); f.current();
  f.runtime.dispose(); const before = f.runtime.getSnapshot();
  expect(before['mock-agent-ari'].live).toBe(false); f.event('error'); f.preference(true);
  expect(f.media.removeEventListener).toHaveBeenCalledOnce(); expect(f.runtime.getSnapshot()).toBe(before);
  expect(f.acknowledgements).not.toHaveBeenCalled(); f.store.stop();
});

it.each(['completed', 'error'] as const)('initial current %s never acknowledges', async state => {
  const f = fixture(false, state); await f.store.start(); f.current(); f.event(state); f.event(state, 'Activity-only'); f.event(state, 'Reason-only', 'approval_required');
  expect(f.acknowledgements).not.toHaveBeenCalled(); f.close();
});
