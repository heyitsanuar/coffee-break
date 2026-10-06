// Development-only synthetic accepted inputs; production store/runtime/host/scene perform all derivation.
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { AgentCurrentState } from '@coffee-break/contracts';
import type { AgentStateMessage, TrustedAgentState } from '../shared/agentState';
import { createAgentStateStore } from '../src/agentState/store';
import { createOfficePresentationRuntime } from '../src/office/officePresentationRuntime';
import { Application } from '../src/Application';
import '../src/style.css';

if (!import.meta.env.DEV) throw new Error('US-029 fixture is development-only.');
const initialAgents = (): AgentCurrentState[] => [
  { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle', activity: 'Ready' },
  { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'idle', activity: 'Ready' },
  { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'idle', activity: 'Ready' },
];
let agents: AgentCurrentState[] | null = initialAgents();
let revision = 1;
let session = 1;
let phase: TrustedAgentState['phase'] = 'ready';
let listener: ((message: AgentStateMessage) => void) | undefined;
const state = (): TrustedAgentState => ({ revision, sessionId: agents ? `us-029-fixture-${session}` : null, phase, agents: structuredClone(agents) });
const createStore = () => createAgentStateStore({ watch(fn) {
  listener = fn;
  fn({ kind: 'current', state: state() });
  return { ready: Promise.resolve(), close() { if (listener === fn) listener = undefined; } };
} });
let store = createStore();
let runtime = createOfficePresentationRuntime(store, window.matchMedia('(prefers-reduced-motion: reduce)'));
const root = createRoot(document.getElementById('root')!);
const render = () => root.render(<React.StrictMode><Application store={store} runtime={runtime} /></React.StrictMode>);

export const fixture = {
  presentation() { return runtime.getSnapshot(); },
  connection(next: 'disconnected' | 'synchronizing' | 'ready') {
    phase = next;
    if (next === 'synchronizing') session++;
    listener?.({ kind: 'change', change: { kind: 'connection', state: state() } });
    if (next === 'ready') { revision++; listener?.({ kind: 'change', change: { kind: 'snapshot', state: state() } }); }
  },
  update(id: 'mock-agent-ari' | 'mock-agent-mina' | 'mock-agent-sol', next: AgentCurrentState['state'], activity: string, reason?: AgentCurrentState['reason']) {
    if (!agents || phase !== 'ready') throw new Error('Need live fixture state');
    const index = agents.findIndex(agent => agent.agent.id === id);
    if (index < 0) throw new Error(`Unknown fixture agent: ${id}`);
    const previous = agents[index];
    const updated: AgentCurrentState = { ...previous, state: next, activity, ...(reason ? { reason } : { reason: undefined }) };
    agents[index] = updated;
    revision++;
    listener?.({ kind: 'change', change: { kind: 'event', agent: structuredClone(updated), state: state() } });
  },
  async reset(empty: 'connecting' | 'unavailable' | 'live' = 'live') {
    runtime.dispose(); store.stop();
    agents = empty === 'live' ? initialAgents() : null;
    revision = agents ? 1 : 0; session++;
    phase = empty === 'live' ? 'ready' : empty === 'connecting' ? 'awaiting-connector' : 'disconnected';
    store = createStore();
    runtime = createOfficePresentationRuntime(store, window.matchMedia('(prefers-reduced-motion: reduce)'));
    await store.start(); render(); // Same host retains selection; the new game receives it on remount.
  },
};
void store.start().then(render);
const dispose = () => { root.unmount(); runtime.dispose(); store.stop(); };
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('pagehide', dispose); dispose(); });
