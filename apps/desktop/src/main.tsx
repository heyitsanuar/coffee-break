import React from 'react';
import { createRoot } from 'react-dom/client';
import { Application } from './Application';
import { agentStateStore, officePresentationRuntime } from './agentState/runtime';
import './style.css';

void agentStateStore.start().catch(() => {});
const dispose = () => { officePresentationRuntime.dispose(); agentStateStore.stop(); };
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('pagehide', dispose); dispose(); });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Application store={agentStateStore} runtime={officePresentationRuntime} />
  </React.StrictMode>,
);
