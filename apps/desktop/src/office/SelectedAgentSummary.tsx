import { getMockAgent, type MockAgentId } from './mockAgents';
import { OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import type { OfficeAgentPresentation } from './officePresentation';

export interface SelectedAgentProps {
  readonly selectedAgentId: MockAgentId | null;
  readonly presentation: OfficeAgentPresentation | null;
}

// Concise feedback uses the same selected trusted presentation as full inspection.
export function selectedAgentFeedback({ selectedAgentId, presentation }: SelectedAgentProps): string {
  const agent = getMockAgent(selectedAgentId);
  if (!agent) return '';
  if (!presentation || presentation.state === null) return `${agent.displayName} · No trusted agent state available yet.`;
  return `${agent.displayName} · ${OFFICE_STATUS_LABELS[presentation.state]}${presentation.live ? '' : ' · Last known'}`;
}

export function SelectedAgentSummary(props: SelectedAgentProps): React.JSX.Element | null {
  const text = selectedAgentFeedback(props);
  return text ? <p className="selected-agent-summary">{text}</p> : null;
}
