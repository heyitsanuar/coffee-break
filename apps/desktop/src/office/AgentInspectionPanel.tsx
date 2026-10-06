import { getMockAgent, type MockAgentId } from './mockAgents';
import { OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import type { OfficeAgentPresentation } from './officePresentation';
import { AgentPortrait } from './AgentPortrait';

export interface AgentInspectionPanelProps {
  readonly selectedAgentId: MockAgentId | null;
  readonly presentation: OfficeAgentPresentation | null;
  readonly onClearSelection: () => void;
}

export function AgentInspectionPanel({ selectedAgentId, presentation, onClearSelection }: AgentInspectionPanelProps): React.JSX.Element {
  const selectedAgent = getMockAgent(selectedAgentId);
  const hasState = presentation && presentation.state !== null;

  return (
    <section className="agent-inspection" data-selected={!!selectedAgent} aria-labelledby="agent-inspection-title">
      <div className="agent-inspection-heading">
        {selectedAgent && <AgentPortrait id={selectedAgent.id} size={48} />}
        <div>
          <h2 id="agent-inspection-title">{selectedAgent?.displayName ?? 'Select an inhabitant'}</h2>
          {selectedAgent && hasState && <p className="agent-inspection-lifecycle">{OFFICE_STATUS_LABELS[presentation.state!]}</p>}
        </div>
      </div>

      <div id="agent-inspection-details" className="agent-inspection-details">
        {selectedAgent ? hasState ? (
          <>
            <p className="agent-inspection-freshness" data-live={presentation.live}>
              {presentation.live ? 'Current information' : 'Last known · Not live'}
            </p>
            <dl>
              <div><dt>Activity</dt><dd>{presentation.activity}</dd></div>
              {presentation.reason && <div><dt>Reason</dt><dd>{presentation.reason === 'approval_required' ? 'Approval required' : 'Capacity exhausted'}</dd></div>}
            </dl>
          </>
        ) : <p>No trusted agent state available yet.</p>
          : <p>Choose someone in the office or below.</p>}
      </div>

      <button type="button" className="clear-selection-button" aria-disabled={!selectedAgent}
        onClick={() => { if (selectedAgent) onClearSelection(); }}>
        Clear selection
      </button>
    </section>
  );
}
