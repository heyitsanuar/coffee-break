import type { AgentLifecycleState } from '@coffee-break/contracts';
import type { MockAgentId } from './mockAgents';

export const AGENT_LIFECYCLE_TEXTURE = 'agent-lifecycle';
export const AGENT_LIFECYCLE_COLUMNS = 8;
export const WORKING_FRAME_RATE = 2 / 1.2;
export const ACKNOWLEDGEMENT_DURATION = { completed: 500, error: 400 } as const;
const rows: Record<MockAgentId, number> = { 'mock-agent-ari': 0, 'mock-agent-mina': 1, 'mock-agent-sol': 2 };
const stableColumns: Record<AgentLifecycleState, number> = { idle: 0, working: 1, waiting: 2, completed: 3, error: 4 };
export function stableLifecycleFrame(id: MockAgentId, state: AgentLifecycleState): number {
  return rows[id] * AGENT_LIFECYCLE_COLUMNS + stableColumns[state];
}
export function workingFrames(id: MockAgentId): [number, number] {
  return [stableLifecycleFrame(id, 'working'), rows[id] * AGENT_LIFECYCLE_COLUMNS + 5];
}
export function acknowledgementFrame(id: MockAgentId, state: 'completed' | 'error'): number {
  return rows[id] * AGENT_LIFECYCLE_COLUMNS + (state === 'completed' ? 6 : 7);
}
