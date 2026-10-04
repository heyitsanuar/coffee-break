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
      expect(agent).toEqual({ id: agent.id, state: null, activity: null, visual: 'placeholder', live: false, reducedMotion: false });
    }
  });

  it.each(['idle', 'working', 'waiting', 'completed', 'error'] as const)(
    'maps %s without changing the trusted lifecycle or activity', (state) => {
      const result = deriveOfficePresentation(synced('mock-agent-ari', { state, activity: `Activity ${state}` }));
      expect(result['mock-agent-ari']).toEqual({
        id: 'mock-agent-ari', state, activity: `Activity ${state}`, visual: state, live: true, reducedMotion: false,
      });
    },
  );

  it('maps only the complete exact Sol waiting fixture to coffee presentation', () => {
    expect(deriveOfficePresentation(synced('mock-agent-sol', { state: 'waiting', activity: COFFEE }))['mock-agent-sol'])
      .toEqual({ id: 'mock-agent-sol', state: 'waiting', activity: COFFEE, visual: 'coffee', live: true, reducedMotion: false });
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
      reason: 'approval_required', visual: 'waiting', live: true, reducedMotion: false,
    });
    const disconnected = deriveOfficePresentation({ ...snapshot, connection: 'disconnected', synchronized: false });
    expect(disconnected['mock-agent-mina']).toEqual({ ...connected['mock-agent-mina'], live: false });
    expect(sameAgentPresentation(connected['mock-agent-mina'], disconnected['mock-agent-mina'])).toBe(false);
  });
});


it('retains exact Sol coffee during synchronization and replaces it with the new snapshot truth', () => {
  const retained = { ...synced('mock-agent-sol', { state: 'waiting', activity: COFFEE }),
    connection: 'connecting' as const, synchronized: false };
  expect(deriveOfficePresentation(retained)['mock-agent-sol'].visual).toBe('coffee');
  const fresh = synced('mock-agent-sol', { state: 'working', activity: 'Finishing a task' });
  expect(deriveOfficePresentation(fresh)['mock-agent-sol']).toMatchObject({ visual: 'working', activity: 'Finishing a task' });
});

// US-022 keeps semantic matching at this existing presentation boundary.
it.each(['idle', 'working', 'completed', 'error'] as const)('Sol %s with the exact coffee activity is not coffee', state => {
  expect(deriveOfficePresentation(synced('mock-agent-sol', { state, activity: COFFEE }))['mock-agent-sol'].visual).toBe(state);
});
it.each(['Taking a coffee break', `${COFFEE}!`, `Now ${COFFEE}`, COFFEE.toLowerCase(), ''])('near/missing activity %j stays neutral Waiting', activity => {
  expect(deriveOfficePresentation(synced('mock-agent-sol', { state: 'waiting', activity }))['mock-agent-sol'].visual).toBe('waiting');
});
it('absent trusted agent data never invents coffee', () => {
  expect(deriveOfficePresentation(initialAgentState)['mock-agent-sol'].visual).toBe('placeholder');
});

it('missing activity cannot match the exact coffee fixture', () => {
  // Defensive adapter check only; runtime validation rejects this incomplete trusted value upstream.
  const incomplete = { state: 'waiting' } as RuntimeAgent;
  expect(deriveOfficePresentation(synced('mock-agent-sol', incomplete))['mock-agent-sol'].visual).toBe('waiting');
});
