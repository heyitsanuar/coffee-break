import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main className="app-shell">
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <span className="brand-mark" aria-hidden="true">☕</span>
        <p className="eyebrow">Local-first desktop office</p>
        <h1 id="welcome-title">Coffee Break</h1>
        <p className="welcome-copy">Your AI office, alive.</p>
        <small>EP-01 · Project Foundation</small>
      </section>
    </main>
  </React.StrictMode>,
);
