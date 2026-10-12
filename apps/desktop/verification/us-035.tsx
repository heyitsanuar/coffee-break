// US-035 development-only accepted inputs and read-only ownership/subscription observations.
// Based on the accepted US-031 fixture; production Application/store/runtime/scene remain authoritative.
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { AgentCurrentState } from '@coffee-break/contracts';
import type { AgentStateMessage, TrustedAgentState } from '../shared/agentState';
import { createAgentStateStore } from '../src/agentState/store';
import { createOfficePresentationRuntime } from '../src/office/officePresentationRuntime';
import { Application } from '../src/Application';
import '../src/style.css';
import { OfficeScene } from '../src/office/OfficeScene';

// Verification-only observer: delegate unchanged production creation, then retain
// the real instance for read-only frame/Graphics queries. Never force a frame/timer.
let observedScene: OfficeScene | undefined;
const productionCreate = OfficeScene.prototype.create;
OfficeScene.prototype.create = function () {
  productionCreate.call(this);
  observedScene = this;
};

if (!import.meta.env.DEV) throw new Error('US-031 fixture is development-only.');
const initialAgents = (): AgentCurrentState[] => [
  { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle', activity: 'Ready' },
  { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'idle', activity: 'Ready' },
  { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'idle', activity: 'Ready' },
];
let agents: AgentCurrentState[] | null = initialAgents();
let revision = 1;
let session = 1;
let phase: TrustedAgentState['phase'] = 'ready';
const activeSubscriptions = { store: 0, runtime: 0, acknowledgements: 0, watch: 0 };
function observed<T extends { subscribe: (fn: () => void) => () => void }>(value: T, key: 'store' | 'runtime'): T {
  const subscribe = value.subscribe;
  value.subscribe = fn => { activeSubscriptions[key]++; const close = subscribe(fn); return () => { activeSubscriptions[key]--; close(); }; };
  return value;
}
let listener: ((message: AgentStateMessage) => void) | undefined;
const state = (): TrustedAgentState => ({ revision, sessionId: agents ? `us-031-fixture-${session}` : null, phase, agents: structuredClone(agents) });
const createStore = () => observed(createAgentStateStore({ watch(fn) {
  activeSubscriptions.watch++;
  listener = fn;
  fn({ kind: 'current', state: state() });
  return { ready: Promise.resolve(), close() { activeSubscriptions.watch--; if (listener === fn) listener = undefined; } };
} }), 'store');
function createRuntime() {
  const value = observed(createOfficePresentationRuntime(store, window.matchMedia('(prefers-reduced-motion: reduce)')), 'runtime');
  const subscribe = value.subscribeAcknowledgements;
  value.subscribeAcknowledgements = fn => { activeSubscriptions.acknowledgements++; const close = subscribe(fn); return () => { activeSubscriptions.acknowledgements--; close(); }; };
  return value;
}
let store = createStore();
let runtime = createRuntime();
const root = createRoot(document.getElementById('root')!);
const render = () => root.render(<React.StrictMode><Application store={store} runtime={runtime} /></React.StrictMode>);

export const fixture = {
  ownership() { return { store, runtime }; },
  subscriptions() { return { ...activeSubscriptions }; },
  scene() { return observedScene; },
  presentation() { return runtime.getSnapshot(); },
  snapshot() { return store.getSnapshot(); },
  withoutTrustedPresentation(id: 'mock-agent-ari' | 'mock-agent-mina' | 'mock-agent-sol') {
    // US-033 presentation-only edge case: the production reducer rejects incomplete ready mirrors.
    const current = runtime.getSnapshot();
    const snapshot = { ...current, [id]: { ...current[id], state: null, activity: null, reason: undefined, visual: 'placeholder' as const } };
    runtime = { ...runtime, getSnapshot: () => snapshot };
    render();
  },
  repair() { revision++; listener?.({ kind: 'change', change: { kind: 'snapshot', state: state() } }); },
  remount() {
    runtime.dispose();
    runtime = createRuntime();
    render(); // Same production host/selection; replace only its presentation subscription/game.
  },
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
    runtime = createRuntime();
    await store.start(); render(); // Same host retains selection; the new game receives it on remount.
  },
};
void store.start().then(render);
const dispose = () => { root.unmount(); runtime.dispose(); store.stop(); OfficeScene.prototype.create = productionCreate; };
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('pagehide', dispose); dispose(); });
