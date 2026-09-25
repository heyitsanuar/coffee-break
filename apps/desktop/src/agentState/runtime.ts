import { createAgentStateStore } from './store.js';

// Renderer bootstrap owns this one transport/store instance; US-016 will add consumers.
export const agentStateStore = createAgentStateStore(window.coffeeBreak.agentState);
