// Explicit development entry, outside the production renderer build inputs.
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { AgentLifecycleState, AgentCurrentState } from '@coffee-break/contracts';
import type { AgentStateMessage } from '../shared/agentState';
import { createAgentStateStore } from '../src/agentState/store';
import { createOfficePresentationRuntime } from '../src/office/officePresentationRuntime';
import { OfficeSceneHost } from '../src/office/OfficeSceneHost';
import { MOCK_AGENTS, type MockAgentId } from '../src/office/mockAgents';
import '../src/style.css';

if (!import.meta.env.DEV) throw new Error('US-021 fixtures are development-only.');
let listener: ((message: AgentStateMessage) => void) | undefined;
let revision = 1;
let session = 1;
let phase: 'ready' | 'disconnected' = 'ready';
const agents: AgentCurrentState[] = MOCK_AGENTS.map(({ id, displayName }) => ({
  agent: { id, displayName }, state: 'idle', activity: 'Synthetic renderer fixture: ready',
}));
const state = () => ({ revision, sessionId: `us-021-fixture-${session}`, phase, agents: structuredClone(agents) });
const store = createAgentStateStore({ watch(fn) {
  listener = fn; fn({ kind: 'current', state: state() });
  return { ready: Promise.resolve(), close() { if (listener === fn) listener = undefined; } };
} });
const runtime = createOfficePresentationRuntime(store, window.matchMedia('(prefers-reduced-motion: reduce)'));
export const fixture = {
  lifecycle(id: MockAgentId, next: AgentLifecycleState) {
    if (phase !== 'ready') return;
    const index = agents.findIndex(value => value.agent.id === id);
    if (index < 0) throw new Error('Unknown fixture identity');
    agents[index] = { ...agents[index], state: next, activity: `Synthetic renderer fixture: ${next}` };
    revision++;
    listener?.({ kind: 'change', change: { kind: 'event', state: state(), agent: structuredClone(agents[index]) } });
  },
  both(next: AgentLifecycleState) { this.lifecycle('mock-agent-ari', next); this.lifecycle('mock-agent-mina', next); },
  disconnect() { phase = 'disconnected'; listener?.({ kind: 'change', change: { kind: 'connection', state: state() } }); },
  restore() { phase = 'ready'; session++; revision++; listener?.({ kind: 'change', change: { kind: 'snapshot', state: state() } }); },
};
const root = createRoot(document.getElementById('root')!);
let mount = 0;
const render = () => root.render(<React.StrictMode><main className="app-shell">
  <p><strong>US-021 DEVELOPMENT VERIFICATION — SYNTHETIC RENDERER FIXTURES</strong><br />No provider, authenticated transport, or end-to-end delivery claim.</p>
  <div aria-label="Fixture controls">
    {MOCK_AGENTS.map(({ id, displayName }) => <label key={id}>{displayName} fixture: <select aria-label={`${displayName} fixture lifecycle`} defaultValue="idle"
      onChange={event => fixture.lifecycle(id, event.target.value as AgentLifecycleState)}>
      {(['idle', 'working', 'waiting', 'completed', 'error'] as const).map(value => <option key={value}>{value}</option>)}
    </select> </label>)}
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
