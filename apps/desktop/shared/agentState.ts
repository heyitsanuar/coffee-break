import type { AgentCurrentState } from '@coffee-break/contracts';

export const agentStateChannels = {
  open: 'coffee-break:agent-state:open',
  change: 'coffee-break:agent-state:change',
  close: 'coffee-break:agent-state:close',
} as const;

export type AgentPhase = 'awaiting-connector' | 'synchronizing' | 'ready' | 'disconnected';

export interface TrustedAgentState {
  revision: number;
  phase: AgentPhase;
  sessionId: string | null;
  agents: AgentCurrentState[] | null;
}

export type TrustedAgentChange =
  | { kind: 'connection' | 'snapshot'; state: TrustedAgentState }
  | { kind: 'event'; state: TrustedAgentState; agent: AgentCurrentState };

export type AgentStateMessage =
  | { kind: 'current'; state: TrustedAgentState }
  | { kind: 'change'; change: TrustedAgentChange };

export interface AgentStateWatch {
  ready: Promise<void>;
  close(): void;
}

export interface AgentStateApi {
  watch(listener: (message: AgentStateMessage) => void): AgentStateWatch;
}

export interface CoffeeBreakApi {
  agentState: AgentStateApi;
}
