import { createAgentStateStore } from './store.js';

import { createOfficePresentationRuntime } from '../office/officePresentationRuntime';

// Renderer bootstrap owns transport, trusted state, and its derived presentation lifetime.
export const agentStateStore = createAgentStateStore(window.coffeeBreak.agentState);
export const officePresentationRuntime = createOfficePresentationRuntime(
  agentStateStore, window.matchMedia('(prefers-reduced-motion: reduce)'),
);
