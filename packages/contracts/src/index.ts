export type AgentLifecycleState =
  | 'idle'
  | 'working'
  | 'waiting'
  | 'completed'
  | 'error';

export type AgentState = AgentLifecycleState;

export interface AgentIdentity {
  id: string;
  displayName: string;
}

export interface EventSource {
  kind: 'local-connector';
  instanceId: string;
}

export interface EventEnvelope<
  TType extends string = string,
  TPayload = unknown,
> {
  id: string;
  type: TType;
  timestamp: string;
  source: EventSource;
  payload: TPayload;
}

export type AgentStateReason =
  | 'approval_required'
  | 'capacity_exhausted';

export interface AgentStateChangedPayload {
  agent: AgentIdentity;
  state: AgentLifecycleState;
  activity: string;
  reason?: AgentStateReason;
}

export type AgentCurrentState = AgentStateChangedPayload;

export type AgentStateChangedEvent = EventEnvelope<
  'agent.state.changed',
  AgentStateChangedPayload
>;

export type ApplicationEvent = AgentStateChangedEvent;
