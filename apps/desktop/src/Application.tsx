import { useSyncExternalStore } from 'react';
import { OfficeSceneHost } from './office/OfficeSceneHost';
import { ConnectionStatus } from './office/ConnectionStatus';
import type { createAgentStateStore } from './agentState/store';
import type { OfficePresentationRuntime } from './office/officePresentationRuntime';

export function Application({ store, runtime }: {
  readonly store: Pick<ReturnType<typeof createAgentStateStore>, 'subscribe' | 'getSnapshot'>;
  readonly runtime: OfficePresentationRuntime;
}): React.JSX.Element {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return <main className="app-shell">
    <header className="application-header">
      <div className="office-heading">
        <span className="brand-mark" aria-hidden="true">☕</span>
        <h1 id="office-title">Coffee Break</h1>
      </div>
      <ConnectionStatus snapshot={snapshot} />
    </header>
    <section className="office-panel" aria-labelledby="office-title">
      <OfficeSceneHost store={store} runtime={runtime} />
    </section>
  </main>;
}
