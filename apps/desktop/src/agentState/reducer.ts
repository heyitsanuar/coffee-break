import type { AgentCurrentState, AgentLifecycleState, AgentStateReason } from '@coffee-break/contracts';
import type { AgentStateMessage, TrustedAgentState } from '../../shared/agentState.js';

export const agentIds = ['mock-agent-ari', 'mock-agent-mina', 'mock-agent-sol'] as const;
export type AgentId = typeof agentIds[number];
export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface RuntimeAgent {
  state: AgentLifecycleState;
  activity: string;
  reason?: AgentStateReason;
}

export interface AgentStoreState {
  connection: ConnectionState;
  revision: number;
  sessionId: string | null;
  synchronized: boolean;
  agentsById: Partial<Record<AgentId, RuntimeAgent>>;
}

export const initialAgentState: AgentStoreState = {
  connection: 'connecting',
  revision: 0,
  sessionId: null,
  synchronized: false,
  agentsById: {},
};

const names: Record<AgentId, string> = {
  'mock-agent-ari': 'Ari',
  'mock-agent-mina': 'Mina',
  'mock-agent-sol': 'Sol',
};
const lifecycleStates = new Set<string>(['idle', 'working', 'waiting', 'completed', 'error']);
const reasons = new Set<string>(['approval_required', 'capacity_exhausted']);
const phases = new Set<string>(['awaiting-connector', 'synchronizing', 'ready', 'disconnected']);

function validAgent(value: unknown): value is AgentCurrentState {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AgentCurrentState>;
  const id = item.agent?.id;
  return typeof id === 'string' && Object.hasOwn(names, id) &&
    item.agent?.displayName === names[id as AgentId] &&
    typeof item.state === 'string' && lifecycleStates.has(item.state) &&
    typeof item.activity === 'string' && item.activity.trim().length > 0 &&
    (item.reason === undefined || reasons.has(item.reason));
}

function completeAgents(value: unknown): Record<AgentId, RuntimeAgent> | null {
  if (!Array.isArray(value) || value.length !== agentIds.length) return null;
  const result: Partial<Record<AgentId, RuntimeAgent>> = {};
  for (const item of value) {
    if (!validAgent(item) || Object.hasOwn(result, item.agent.id)) return null;
    result[item.agent.id as AgentId] = {
      state: item.state,
      activity: item.activity,
      ...(item.reason === undefined ? {} : { reason: item.reason }),
    };
  }
  return agentIds.every((id) => Object.hasOwn(result, id))
    ? result as Record<AgentId, RuntimeAgent> : null;
}

function validState(value: unknown): value is TrustedAgentState {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TrustedAgentState>;
  return typeof item.revision === 'number' && Number.isSafeInteger(item.revision) &&
    item.revision >= 0 && typeof item.phase === 'string' && phases.has(item.phase) &&
    (item.sessionId === null || typeof item.sessionId === 'string');
}

function connection(phase: TrustedAgentState['phase']): ConnectionState {
  if (phase === 'ready') return 'connected';
  if (phase === 'disconnected') return 'disconnected';
  return 'connecting';
}

export type AgentAction = AgentStateMessage | { kind: 'failed' };
export interface Reduction {
  state: AgentStoreState;
  resynchronize: boolean;
}

export function reduceAgentState(previous: AgentStoreState, action: AgentAction): Reduction {
  if (action.kind === 'failed') {
    return {
      state: previous.connection === 'disconnected'
        ? previous : { ...previous, connection: 'disconnected' },
      resynchronize: false,
    };
  }

  const value = action.kind === 'current' ? action.state : action.change.state;
  if (!validState(value)) return { state: previous, resynchronize: true };
  if (value.revision < previous.revision) return { state: previous, resynchronize: false };

  const changeKind = action.kind === 'change' ? action.change.kind : 'current';
  if (changeKind !== 'connection' && changeKind !== 'current' &&
      value.revision <= previous.revision && previous.synchronized) {
    return { state: previous, resynchronize: false };
  }

  const mirror = value.agents === null ? null : completeAgents(value.agents);
  if (value.agents !== null && !mirror) return { state: previous, resynchronize: true };
  if ((value.phase === 'ready' || value.revision > previous.revision) && !mirror) {
    return { state: previous, resynchronize: true };
  }

  const common = {
    connection: connection(value.phase),
    revision: value.revision,
    sessionId: value.sessionId,
  };

  if (changeKind === 'connection' && value.revision === previous.revision) {
    return { state: { ...previous, ...common }, resynchronize: false };
  }

  if (action.kind === 'change' && action.change.kind === 'event') {
    const agent = action.change.agent;
    if (!validAgent(agent) || !mirror) {
      return { state: previous, resynchronize: true };
    }
    const target = mirror[agent.agent.id as AgentId];
    if (target.state !== agent.state || target.activity !== agent.activity ||
        target.reason !== agent.reason) return { state: previous, resynchronize: true };
    if (previous.synchronized && value.revision === previous.revision + 1) {
      return {
        state: {
          ...previous, ...common,
          agentsById: {
            ...previous.agentsById,
            [agent.agent.id]: mirror[agent.agent.id as AgentId],
          },
        },
        resynchronize: false,
      };
    }
  }

  if (mirror) {
    return {
      state: { ...previous, ...common, synchronized: true, agentsById: mirror },
      resynchronize: false,
    };
  }
  return { state: { ...previous, ...common }, resynchronize: false };
}
