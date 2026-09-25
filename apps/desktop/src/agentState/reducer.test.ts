import { describe, expect, it } from 'vitest';
import type { AgentCurrentState } from '@coffee-break/contracts';
import type { TrustedAgentState } from '../../shared/agentState';
import { initialAgentState, reduceAgentState } from './reducer';

const agents = (): AgentCurrentState[] => [
  { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle', activity: 'Available' },
  { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'working', activity: 'Reviewing' },
  { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting', activity: 'Waiting' },
];
const mirror = (revision: number, overrides: Partial<TrustedAgentState> = {}): TrustedAgentState => ({
  revision, phase: 'ready', sessionId: 'session-1', agents: agents(), ...overrides,
});
const current = (state: TrustedAgentState) => ({ kind: 'current' as const, state });
const change = (kind: 'snapshot' | 'connection', state: TrustedAgentState) =>
  ({ kind: 'change' as const, change: { kind, state } });
const event = (state: TrustedAgentState, agent: AgentCurrentState) =>
  ({ kind: 'change' as const, change: { kind: 'event' as const, state, agent } });
const initialized = () => reduceAgentState(initialAgentState, current(mirror(1))).state;

describe('pure agent-state reducer', () => {
  it('starts without fixture lifecycle or activity and accepts only a complete three-agent current state', () => {
    expect(initialAgentState).toMatchObject({ synchronized: false, agentsById: {}, connection: 'connecting' });
    const state = initialized();
    expect(state.synchronized).toBe(true);
    expect(Object.keys(state.agentsById)).toEqual([
      'mock-agent-ari', 'mock-agent-mina', 'mock-agent-sol',
    ]);
    expect(state.agentsById['mock-agent-sol']).toEqual({ state: 'waiting', activity: 'Waiting' });
  });

  it.each([
    ['partial', agents().slice(0, 2)],
    ['duplicate', [agents()[0], agents()[0], agents()[2]]],
    ['unknown', [...agents().slice(0, 2), { agent: { id: 'other', displayName: 'Other' }, state: 'idle', activity: 'Other' }]],
    ['missing activity', [...agents().slice(0, 2), { ...agents()[2], activity: '' }]],
  ])('rejects a %s mirror and asks for resynchronization', (_label, invalidAgents) => {
    const previous = initialized();
    const result = reduceAgentState(previous, change('snapshot', mirror(2, { agents: invalidAgents as AgentCurrentState[] })));
    expect(result).toEqual({ state: previous, resynchronize: true });
  });

  it('applies a contiguous target event atomically and leaves other agents untouched', () => {
    const previous = initialized();
    const replacement: AgentCurrentState = {
      agent: { id: 'mock-agent-ari', displayName: 'Ari' },
      state: 'waiting', activity: 'Waiting for approval', reason: 'approval_required',
    };
    const nextMirror = mirror(2, { agents: [replacement, ...agents().slice(1)] });
    const result = reduceAgentState(previous, event(nextMirror, replacement));
    expect(result.resynchronize).toBe(false);
    expect(result.state.agentsById['mock-agent-ari']).toEqual({
      state: 'waiting', activity: 'Waiting for approval', reason: 'approval_required',
    });
    expect(result.state.agentsById['mock-agent-mina']).toBe(previous.agentsById['mock-agent-mina']);
    expect(result.state.revision).toBe(2);
  });

  it('discards stale data without rollback but applies same-revision disconnect and new-session phase', () => {
    const previous = initialized();
    expect(reduceAgentState(previous, change('snapshot', mirror(1))).state).toBe(previous);
    const disconnected = reduceAgentState(previous, change('connection', mirror(1, { phase: 'disconnected' }))).state;
    expect(disconnected.connection).toBe('disconnected');
    expect(disconnected.agentsById).toBe(previous.agentsById);
    const synchronizing = reduceAgentState(disconnected, change('connection', mirror(1, {
      phase: 'synchronizing', sessionId: 'session-2',
    }))).state;
    expect(synchronizing.connection).toBe('connecting');
    expect(synchronizing.sessionId).toBe('session-2');
    expect(synchronizing.agentsById).toBe(previous.agentsById);
    expect(reduceAgentState(synchronizing, change('connection', mirror(0))).state).toBe(synchronizing);
  });

  it('repairs a revision gap from the complete mirror and later accepts a new session snapshot', () => {
    const previous = initialized();
    const newer = agents();
    newer[1] = { ...newer[1], state: 'completed', activity: 'Done' };
    const repaired = reduceAgentState(previous, event(mirror(4, { agents: newer }), newer[1])).state;
    expect(repaired.revision).toBe(4);
    expect(repaired.agentsById['mock-agent-mina']).toEqual({ state: 'completed', activity: 'Done' });
    const next = reduceAgentState(repaired, change('snapshot', mirror(5, { sessionId: 'session-2' }))).state;
    expect(next.agentsById['mock-agent-mina']).toEqual({ state: 'working', activity: 'Reviewing' });
    expect(next.sessionId).toBe('session-2');
  });

  it('retains last valid data when a gap has an unusable mirror or synchronization fails', () => {
    const previous = initialized();
    const newer = agents()[0];
    expect(reduceAgentState(previous, event(mirror(4, { agents: agents().slice(0, 2) }), newer)))
      .toEqual({ state: previous, resynchronize: true });
    const failed = reduceAgentState(previous, { kind: 'failed' }).state;
    expect(failed.connection).toBe('disconnected');
    expect(failed.agentsById).toBe(previous.agentsById);
  });

  it('accepts an uninitialized awaiting-connector state without inventing agent data', () => {
    const result = reduceAgentState(initialAgentState, current(mirror(0, {
      phase: 'awaiting-connector', sessionId: null, agents: null,
    })));
    expect(result.resynchronize).toBe(false);
    expect(result.state).toMatchObject({ synchronized: false, agentsById: {}, connection: 'connecting' });
  });
});
