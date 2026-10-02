import type { AgentStateApi } from '../../shared/agentState.js';
import { initialAgentState, reduceAgentState, type AgentStoreState, type AgentAction } from './reducer.js';

export interface AcceptedAgentUpdate {
  readonly previous: AgentStoreState;
  readonly next: AgentStoreState;
  readonly action: AgentAction;
}

export function createAgentStateStore(bridge: AgentStateApi) {
  let state = initialAgentState;
  const listeners = new Set<() => void>();
  const acceptedListeners = new Set<(update: AcceptedAgentUpdate) => void>();
  let generation = 0;
  let watch: ReturnType<AgentStateApi['watch']> | null = null;
  let startPromise: Promise<void> | null = null;
  let recoveryScheduled = false;
  // One automatic replacement per explicit start-to-stop synchronization episode.
  let recoveryUsed = false;
  let episode = 0;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  let availabilityExpired = false;
  const clearDeadline = () => {
    if (deadline !== null) clearTimeout(deadline);
    deadline = null;
  };

  const apply = (action: Parameters<typeof reduceAgentState>[1]) => {
    const result = reduceAgentState(state, action);
    const mirror = action.kind === 'current' ? action.state
      : action.kind === 'change' ? action.change.state : null;
    if (availabilityExpired && mirror?.phase === 'awaiting-connector') {
      result.state = reduceAgentState(result.state, { kind: 'failed' }).state;
    }
    if (result.state !== state) {
      const previous = state;
      state = result.state;
      if (state.synchronized) {
        availabilityExpired = false;
        clearDeadline();
      }
      for (const listener of acceptedListeners) listener({ previous, next: state, action });
      for (const listener of listeners) listener();
    }
    return result.resynchronize;
  };

  const connect = (): Promise<void> => {
    const currentGeneration = ++generation;
    const nextWatch = bridge.watch((message) => {
      if (currentGeneration !== generation) return;
      const invalid = apply(message);
      if (invalid) {
        if (recoveryScheduled) return;
        if (recoveryUsed) {
          generation++;
          nextWatch.close();
          watch = null;
          clearDeadline();
          apply({ kind: 'failed' });
          return;
        }
        recoveryUsed = true;
        recoveryScheduled = true;
        apply({ kind: 'recovering' });
        queueMicrotask(() => {
          if (currentGeneration !== generation) return;
          recoveryScheduled = false;
          nextWatch.close();
          void connect().catch(() => {});
        });
      }
    });
    watch = nextWatch;
    return nextWatch.ready.catch((error) => {
      if (currentGeneration === generation) {
        generation++;
        recoveryScheduled = false;
        nextWatch.close();
        watch = null;
        clearDeadline();
        availabilityExpired = false;
        apply({ kind: 'failed' });
      }
      throw error;
    });
  };

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    subscribeAcceptedUpdates(listener: (update: AcceptedAgentUpdate) => void) {
      acceptedListeners.add(listener);
      return () => { acceptedListeners.delete(listener); };
    },
    start() {
      if (!startPromise) {
        const currentEpisode = ++episode;
        clearDeadline();
        availabilityExpired = false;
        apply({ kind: 'recovering' });
        deadline = setTimeout(() => {
          if (episode !== currentEpisode) return;
          deadline = null;
          if (!state.synchronized) {
            availabilityExpired = true;
            apply({ kind: 'failed' });
          }
        }, 5_000);
        const pending = connect();
        const tracked = pending.catch((error) => {
          if (startPromise === tracked) startPromise = null;
          throw error;
        });
        startPromise = tracked;
      }
      return startPromise;
    },
    stop() {
      episode++;
      clearDeadline();
      generation++;
      watch?.close();
      watch = null;
      startPromise = null;
      recoveryScheduled = false;
      recoveryUsed = false;
    },
  };
}
