import { describe, expectTypeOf, it } from 'vitest';
import type {
  AgentStateChangedEvent,
  AgentStateChangedPayload,
  ApplicationEvent,
} from './index';

const capacityExhaustedEvent = {
  id: 'evt_01',
  type: 'agent.state.changed',
  timestamp: '2026-09-22T20:00:00.000Z',
  source: {
    kind: 'local-connector',
    instanceId: 'connector_local_01',
  },
  payload: {
    agent: {
      id: 'agent_01',
      displayName: 'Codex',
    },
    state: 'waiting',
    activity: 'Waiting for capacity',
    reason: 'capacity_exhausted',
  },
} satisfies AgentStateChangedEvent;

describe('AgentStateChangedEvent', () => {
  it('ties the state-change discriminant to its normalized payload', () => {
    type StateChangedEvent = Extract<
      ApplicationEvent,
      { type: 'agent.state.changed' }
    >;

    expectTypeOf<StateChangedEvent['payload']>()
      .toEqualTypeOf<AgentStateChangedPayload>();
    expectTypeOf(capacityExhaustedEvent)
      .toMatchTypeOf<StateChangedEvent>();
  });
});
