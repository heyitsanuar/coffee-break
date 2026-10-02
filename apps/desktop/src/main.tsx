import React from 'react';
import { createRoot } from 'react-dom/client';
import { OfficeSceneHost } from './office/OfficeSceneHost';
import { agentStateStore, officePresentationRuntime } from './agentState/runtime';
import './style.css';

void agentStateStore.start().catch(() => {});
const dispose = () => { officePresentationRuntime.dispose(); agentStateStore.stop(); };
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('pagehide', dispose); dispose(); });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main className="app-shell">
      <section className="office-panel" aria-labelledby="office-title">
        <header className="office-heading">
          <span className="brand-mark" aria-hidden="true">☕</span>
          <div>
            <p className="eyebrow">Local-first desktop office</p>
            <h1 id="office-title">Coffee Break</h1>
            <p className="welcome-copy">Your AI office, alive.</p>
          </div>
        </header>
        <OfficeSceneHost store={agentStateStore} runtime={officePresentationRuntime} />
        <small>Local simulation · No provider connection</small>
      </section>
    </main>
  </React.StrictMode>,
);
