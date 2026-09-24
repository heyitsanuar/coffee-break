import {
  MOCK_AGENTS,
  getMockAgent,
  type MockAgentId,
} from './mockAgents';

export interface AgentInspectionPanelProps {
  readonly selectedAgentId: MockAgentId | null;
  readonly onSelectAgent: (agentId: MockAgentId) => void;
  readonly onClearSelection: () => void;
}

export function AgentInspectionPanel({
  selectedAgentId,
  onSelectAgent,
  onClearSelection,
}: AgentInspectionPanelProps): React.JSX.Element {
  const selectedAgent = getMockAgent(selectedAgentId);

  return (
    <section className="agent-inspection" aria-labelledby="agent-inspection-title">
      <div className="agent-inspection-heading">
        <div>
          <p className="eyebrow">Read-only view</p>
          <h2 id="agent-inspection-title">Agent inspection</h2>
        </div>
        <span className="simulation-badge">Simulated</span>
      </div>

      <div className="agent-selector" role="group" aria-label="Select an agent">
        {MOCK_AGENTS.map((agent) => {
          const isSelected = selectedAgentId === agent.id;

          return (
            <button
              key={agent.id}
              type="button"
              className="agent-selector-button"
              aria-label={`Select ${agent.displayName}`}
              aria-controls="agent-inspection-details"
              aria-pressed={isSelected}
              onClick={() => onSelectAgent(agent.id)}
            >
              <span aria-hidden="true">{isSelected ? '✓' : '○'}</span>
              {agent.displayName}
            </button>
          );
        })}
      </div>

      <div
        id="agent-inspection-details"
        className="agent-inspection-details"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectedAgent ? (
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{selectedAgent.displayName}</dd>
            </div>
            <div>
              <dt>Current state</dt>
              <dd>{selectedAgent.state}</dd>
            </div>
            <div>
              <dt>Mock activity</dt>
              <dd>{selectedAgent.activity}</dd>
            </div>
          </dl>
        ) : (
          <p>Select an agent to inspect its simulated activity.</p>
        )}
      </div>

      <button
        type="button"
        className="clear-selection-button"
        disabled={!selectedAgent}
        onClick={onClearSelection}
      >
        Clear selection
      </button>
    </section>
  );
}
