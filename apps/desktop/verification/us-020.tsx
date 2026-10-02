// Explicit Vite development entry only; not an input to the production renderer build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { AgentLifecycleState, AgentCurrentState } from '@coffee-break/contracts';
import type { AgentStateMessage } from '../shared/agentState';
import { createAgentStateStore } from '../src/agentState/store';
import { createOfficePresentationRuntime } from '../src/office/officePresentationRuntime';
import { OfficeSceneHost } from '../src/office/OfficeSceneHost';
import '../src/style.css';

if (!import.meta.env.DEV) throw new Error('US-020 fixtures are development-only.');
let listener: ((message: AgentStateMessage) => void) | undefined;
let revision = 1;
let session = 1;
let phase: 'ready' | 'disconnected' = 'ready';
const names = ['Ari', 'Mina', 'Sol'];
let agents: AgentCurrentState[] = names.map(name => ({
  agent: { id: `mock-agent-${name.toLowerCase()}`, displayName: name }, state: 'idle', activity: 'Synthetic renderer fixture: ready',
}));
const state = () => ({ revision, sessionId: `fixture-session-${session}`, phase, agents: structuredClone(agents) });
const store = createAgentStateStore({ watch(fn) {
  listener = fn; fn({ kind: 'current', state: state() });
  return { ready: Promise.resolve(), close() { if (listener === fn) listener = undefined; } };
} });
const runtime = createOfficePresentationRuntime(store, window.matchMedia('(prefers-reduced-motion: reduce)'));
export const fixture = {
  lifecycle(next: AgentLifecycleState) {
    if (phase !== 'ready') return;
    for (let index = 0; index < agents.length; index++) {
      agents[index] = { ...agents[index], state: next, activity: `Synthetic renderer fixture: ${next}` };
      revision++;
      listener?.({ kind: 'change', change: { kind: 'event', state: state(), agent: structuredClone(agents[index]) } });
    }
  },
  coffee() {
    if (phase !== 'ready') return;
    agents[2] = { ...agents[2], state: 'waiting', activity: 'Taking a coffee break in the simulated office' };
    revision++; listener?.({ kind: 'change', change: { kind: 'event', state: state(), agent: structuredClone(agents[2]) } });
  },
  disconnect() { phase = 'disconnected'; listener?.({ kind: 'change', change: { kind: 'connection', state: state() } }); },
  restore() { phase = 'ready'; session++; revision++; listener?.({ kind: 'change', change: { kind: 'snapshot', state: state() } }); },
};
const root = createRoot(document.getElementById('root')!);
let mount = 0;
const render = () => root.render(<React.StrictMode><main className="app-shell">
  <p><strong>US-020 DEVELOPMENT VERIFICATION — SYNTHETIC RENDERER FIXTURES</strong><br />No provider, authenticated transport, or end-to-end delivery claim.</p>
  <div aria-label="Fixture controls">
    {(['idle', 'working', 'waiting', 'completed', 'error'] as const).map(value => <button key={value} onClick={() => fixture.lifecycle(value)}>{value}</button>)}
    <button onClick={() => fixture.coffee()}>Exact Sol coffee</button>
    <button onClick={() => fixture.disconnect()}>Retain</button>
    <button onClick={() => fixture.restore()}>Restore snapshot</button>
    <button onClick={() => { mount++; render(); }}>Remount scene</button>
  </div>
  <section className="office-panel" aria-label="Synthetic fixture office"><OfficeSceneHost key={mount} store={store} runtime={runtime} /></section>
</main></React.StrictMode>);
void store.start().then(render);
const dispose = () => { root.unmount(); runtime.dispose(); store.stop(); };
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('pagehide', dispose); dispose(); });
