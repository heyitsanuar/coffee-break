import { MOCK_AGENTS, type MockAgentId } from './mockAgents';
import { AgentPortrait } from './AgentPortrait';

export function AgentSelector({ selectedAgentId, onSelectAgent }: {
  readonly selectedAgentId: MockAgentId | null;
  readonly onSelectAgent: (id: MockAgentId) => void;
}): React.JSX.Element {
  return <div className="agent-selector" role="group" aria-label="Select an agent">
    {MOCK_AGENTS.map(agent => <button key={agent.id} type="button"
      className="agent-selector-button" aria-label={`Select ${agent.displayName}`}
      aria-controls="agent-inspection-details" aria-pressed={selectedAgentId === agent.id}
      onClick={() => onSelectAgent(agent.id)}>
      <AgentPortrait id={agent.id} size={32} />
      <span>{agent.displayName}</span>
      <span className="agent-selector-check" aria-hidden="true">✓</span>
    </button>)}
  </div>;
}
