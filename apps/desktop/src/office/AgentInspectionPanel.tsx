import {
  MOCK_AGENTS,
  getMockAgent,
  type MockAgentId,
} from './mockAgents';
import { OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import type { OfficeAgentPresentation } from './officePresentation';

export interface AgentInspectionPanelProps {
  readonly selectedAgentId: MockAgentId | null;
  readonly presentation: OfficeAgentPresentation | null;
  readonly onSelectAgent: (agentId: MockAgentId) => void;
  readonly onClearSelection: () => void;
}

export function AgentInspectionPanel({
  selectedAgentId,
  presentation,
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
        <span className="simulation-badge">Local simulation</span>
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
            {presentation?.state === null || !presentation ? (
              <div>
                <dt>Status</dt>
                <dd>No local simulation state yet</dd>
              </div>
            ) : (
              <>
                <div>
                  <dt>Current state</dt>
                  <dd>{OFFICE_STATUS_LABELS[presentation.state]}</dd>
                </div>
                <div>
                  <dt>Activity</dt>
                  <dd>{presentation.activity}</dd>
                </div>
                {presentation.reason && (
                  <div>
                    <dt>Reason</dt>
                    <dd>{presentation.reason === 'approval_required' ? 'Approval required' : 'Capacity exhausted'}</dd>
                  </div>
                )}
              </>
            )}
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
