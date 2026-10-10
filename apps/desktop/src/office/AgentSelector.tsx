import { MOCK_AGENTS, type MockAgentId } from './mockAgents';
import { AgentPortrait } from './AgentPortrait';
import { OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import { agentFreshness, FRESHNESS_COPY, type OfficePresentation } from './officePresentation';

export function AgentSelector({ selectedAgentId, onSelectAgent, presentations }: {
  readonly selectedAgentId: MockAgentId | null;
  readonly onSelectAgent: (id: MockAgentId) => void;
  readonly presentations: OfficePresentation;
}): React.JSX.Element {
  return <div className="agent-selection">
    <div className="agent-selector" role="group" aria-label="Select an agent">
      {MOCK_AGENTS.map(agent => {
        const presentation = presentations[agent.id];
        const freshness = agentFreshness(presentation);
        const lifecycle = presentation.state === null ? 'No state' : OFFICE_STATUS_LABELS[presentation.state];
        const description = presentation.state === null ? FRESHNESS_COPY[freshness].description
          : `${lifecycle}, ${FRESHNESS_COPY[freshness].description}`;
        return <button key={agent.id} type="button"
          className="agent-selector-button" aria-label={`Select ${agent.displayName}, ${description}`}
          aria-controls="agent-inspection-details" aria-pressed={selectedAgentId === agent.id}
          onClick={() => onSelectAgent(agent.id)}>
          <AgentPortrait id={agent.id} size={48} />
          <span className="freshness-dot" data-freshness={freshness} aria-hidden="true" />
          <span className="agent-selector-name">{agent.displayName}</span>
          <span className="agent-selector-lifecycle">{lifecycle}</span>
          <span className="agent-selector-check" aria-hidden="true">✓</span>
        </button>;
      })}
    </div>
    <div className="freshness-legend">
      {(Object.keys(FRESHNESS_COPY) as Array<keyof typeof FRESHNESS_COPY>).map(freshness =>
        <span key={freshness}><span className="freshness-dot" data-freshness={freshness} aria-hidden="true" />{FRESHNESS_COPY[freshness].label}</span>)}
    </div>
    <p className="freshness-helper">Dots describe information freshness, not online presence.</p>
  </div>;
}
