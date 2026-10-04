import {
  getMockAgent,
  type MockAgentId,
} from './mockAgents';
import { OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import type { OfficeAgentPresentation } from './officePresentation';

export interface AgentInspectionPanelProps {
  readonly selectedAgentId: MockAgentId | null;
  readonly presentation: OfficeAgentPresentation | null;
  readonly onClearSelection: () => void;
}

export function AgentInspectionPanel({
  selectedAgentId,
  presentation,
  onClearSelection,
}: AgentInspectionPanelProps): React.JSX.Element {
  const selectedAgent = getMockAgent(selectedAgentId);

  return (
    <section className="agent-inspection" aria-labelledby="agent-inspection-title">
      <div className="agent-inspection-heading">
        <div>
          <h2 id="agent-inspection-title">Agent inspection</h2>
        </div>
      </div>

      <div
        id="agent-inspection-details"
        className="agent-inspection-details"
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
                <dd>No trusted agent state available yet.</dd>
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
                {!presentation.live && <div><dt>Freshness</dt><dd>Last known</dd></div>}
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
