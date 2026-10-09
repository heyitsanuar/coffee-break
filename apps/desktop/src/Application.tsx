import { useState, useSyncExternalStore } from 'react';
import { OfficeSceneHost } from './office/OfficeSceneHost';
import { ConnectionStatus } from './office/ConnectionStatus';
import type { createAgentStateStore } from './agentState/store';
import type { OfficePresentationRuntime } from './office/officePresentationRuntime';

export function Application({ store, runtime }: {
  readonly store: Pick<ReturnType<typeof createAgentStateStore>, 'subscribe' | 'getSnapshot'>;
  readonly runtime: OfficePresentationRuntime;
}): React.JSX.Element {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [destination, setDestination] = useState('Office');
  return <main className="app-shell">
    <header className="application-header">
      <div className="office-heading">
        <span className="brand-mark" aria-hidden="true">☕</span>
        <h1 id="office-title">Coffee Break</h1>
      </div>
      <nav className="homepage-navigation" aria-label="Homepage sections">
        {['Office', 'Agents', 'Projects'].map(label => <button
          key={label}
          type="button"
          aria-current={destination === label ? 'location' : undefined}
          onClick={() => {
            const heading = document.getElementById(`${label.toLowerCase()}-section-title`);
            if (!heading) return;
            heading.focus({ preventScroll: true });
            heading.scrollIntoView({ behavior: 'instant', block: 'start' });
            setDestination(label);
          }}
        >{label}</button>)}
      </nav>
      <ConnectionStatus snapshot={snapshot} />
    </header>
    <section className="office-panel" aria-labelledby="office-section-title">
      <OfficeSceneHost store={store} runtime={runtime} />
    </section>
  </main>;
}
