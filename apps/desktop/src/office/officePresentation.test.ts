import { describe, expect, it } from 'vitest';
import { initialAgentState, type AgentStoreState, type RuntimeAgent } from '../agentState/reducer';
import { deriveOfficePresentation, sameAgentPresentation } from './officePresentation';

const COFFEE = 'Taking a coffee break in the simulated office';
const synced = (id: 'mock-agent-ari' | 'mock-agent-mina' | 'mock-agent-sol', agent: RuntimeAgent): AgentStoreState => ({
  ...initialAgentState,
  connection: 'connected', revision: 1, synchronized: true,
  agentsById: { [id]: agent },
});

describe('pure office presentation', () => {
  it('uses neutral placeholders with no invented lifecycle or activity before synchronization', () => {
    const result = deriveOfficePresentation(initialAgentState);
    for (const agent of Object.values(result)) {
      expect(agent).toEqual({ id: agent.id, state: null, activity: null, visual: 'placeholder' });
    }
  });

  it.each(['idle', 'working', 'waiting', 'completed', 'error'] as const)(
    'maps %s without changing the trusted lifecycle or activity', (state) => {
      const result = deriveOfficePresentation(synced('mock-agent-ari', { state, activity: `Activity ${state}` }));
      expect(result['mock-agent-ari']).toEqual({
        id: 'mock-agent-ari', state, activity: `Activity ${state}`, visual: state,
      });
    },
  );

  it('maps only the complete exact Sol waiting fixture to coffee presentation', () => {
    expect(deriveOfficePresentation(synced('mock-agent-sol', { state: 'waiting', activity: COFFEE }))['mock-agent-sol'])
      .toEqual({ id: 'mock-agent-sol', state: 'waiting', activity: COFFEE, visual: 'coffee' });
    for (const [id, state, activity] of [
      ['mock-agent-ari', 'waiting', COFFEE],
      ['mock-agent-mina', 'waiting', COFFEE],
      ['mock-agent-sol', 'waiting', 'Waiting for changes'],
      ['mock-agent-sol', 'idle', COFFEE],
    ] as const) {
      expect(deriveOfficePresentation(synced(id, { state, activity }))[id].visual).toBe(state);
    }
  });

  it('projects state, activity and optional reason from one trusted value, including after disconnect', () => {
    const snapshot = synced('mock-agent-mina', {
      state: 'waiting', activity: 'Waiting for approval', reason: 'approval_required',
    });
    const connected = deriveOfficePresentation(snapshot);
    expect(connected['mock-agent-mina']).toEqual({
      id: 'mock-agent-mina', state: 'waiting', activity: 'Waiting for approval',
      reason: 'approval_required', visual: 'waiting',
    });
    const disconnected = deriveOfficePresentation({ ...snapshot, connection: 'disconnected' });
    expect(disconnected).toEqual(connected);
    expect(sameAgentPresentation(connected['mock-agent-mina'], disconnected['mock-agent-mina'])).toBe(true);
  });
});
