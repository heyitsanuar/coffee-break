import type { AgentLifecycleState, AgentStateReason } from '@coffee-break/contracts';
import type { AgentStoreState } from '../agentState/reducer';
import { MOCK_AGENTS, type MockAgentId } from './mockAgents';

export type OfficeVisual = 'placeholder' | AgentLifecycleState | 'coffee';

export interface OfficeAgentPresentation {
  readonly id: MockAgentId;
  readonly state: AgentLifecycleState | null;
  readonly activity: string | null;
  readonly reason?: AgentStateReason;
  readonly visual: OfficeVisual;
}

export type OfficePresentation = Readonly<Record<MockAgentId, OfficeAgentPresentation>>;

const COFFEE_ACTIVITY = 'Taking a coffee break in the simulated office';

export function deriveOfficePresentation(snapshot: AgentStoreState): OfficePresentation {
  return Object.fromEntries(MOCK_AGENTS.map(({ id }) => {
    const runtime = snapshot.synchronized ? snapshot.agentsById[id] : undefined;
    if (!runtime) return [id, { id, state: null, activity: null, visual: 'placeholder' }];
    const visual: OfficeVisual = id === 'mock-agent-sol' && runtime.state === 'waiting'
      && runtime.activity === COFFEE_ACTIVITY ? 'coffee' : runtime.state;
    return [id, {
      id,
      state: runtime.state,
      activity: runtime.activity,
      ...(runtime.reason === undefined ? {} : { reason: runtime.reason }),
      visual,
    }];
  })) as OfficePresentation;
}

export function sameAgentPresentation(a: OfficeAgentPresentation, b: OfficeAgentPresentation): boolean {
  return a.id === b.id && a.state === b.state && a.activity === b.activity
    && a.reason === b.reason && a.visual === b.visual;
}
