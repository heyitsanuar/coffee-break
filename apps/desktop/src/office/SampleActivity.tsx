import { AgentPortrait } from './AgentPortrait';

const examples = [
  { id: 'mock-agent-ari', name: 'Ari', action: 'Search panel draft opened', reference: 'H-13 · Example PR #19', time: '10:10' },
  { id: 'mock-agent-mina', name: 'Mina', action: 'Query privacy ready for review', reference: 'H-14 · Example PR #20', time: '10:20' },
  { id: 'mock-agent-sol', name: 'Sol', action: 'Notes search sample updated', reference: 'H-15 · Example work item', time: '10:30' },
] as const;

// Fictional presentation has no runtime inputs; updates must never turn it into history.
export function SampleActivity(): React.JSX.Element {
  return <section className="sample-activity" aria-label="Recent Activity — Sample">
    <div className="sample-activity-heading">
      <h2>Recent Activity</h2>
      <span className="sample-label" aria-hidden="true">Sample</span>
    </div>
    <p className="sample-explanation">Fixed example sequence · Not runtime history</p>
    <div className="sample-project">
      <div className="sample-project-heading">
        <h3 id="projects-section-title" className="section-destination" tabIndex={-1}>
          <span className="sr-only">Projects — </span>Harbor
        </h3>
        <span>/ Local notes search</span>
      </div>
      <p>Fictional workspace · Example content only</p>
      <details className="sample-project-context">
        <summary aria-label="Project context for Harbor — fictional example">Project context</summary>
        <div className="sample-project-details">
          <p className="sample-project-details-title">Fictional project context</p>
          <p>Harbor is a fictional workspace illustrating local notes search. The activity sequence and project identifiers are examples, not current agent assignments.</p>
          <dl>
            <div><dt>Example repository</dt><dd>harbor-demo/local-notes-search</dd></div>
            <div><dt>Example branch</dt><dd>example/h-14-query-privacy</dd></div>
          </dl>
          <p>No GitHub account, repository, or provider is connected.</p>
        </div>
      </details>
    </div>
    <ol className="sample-activity-list" aria-label="Fixed sample activity sequence">
      {examples.map(example => <li key={example.id}>
        <AgentPortrait id={example.id} size={32} />
        <div className="sample-activity-content">
          <span className="sample-activity-name">{example.name}</span>
          <p className="sample-activity-action">{example.action}</p>
          <p className="sample-activity-reference">{example.reference}</p>
          <span className="sample-activity-time"><span className="sr-only">Example time </span>{example.time}</span>
        </div>
      </li>)}
    </ol>
  </section>;
}
