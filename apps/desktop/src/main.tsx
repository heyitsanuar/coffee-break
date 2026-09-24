import React from 'react';
import { createRoot } from 'react-dom/client';
import { OfficeSceneHost } from './office/OfficeSceneHost';
import './style.css';

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
        <OfficeSceneHost />
        <small>Simulated agent activity · No live connection</small>
      </section>
    </main>
  </React.StrictMode>,
);
