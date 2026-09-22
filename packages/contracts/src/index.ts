export type AgentState = 'idle' | 'working' | 'waiting_approval' | 'completed' | 'error';
export interface EventEnvelope<T = unknown> { id: string; type: string; source: string; timestamp: string; payload: T; }
