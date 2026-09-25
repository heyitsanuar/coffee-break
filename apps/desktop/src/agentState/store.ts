import type { AgentStateApi } from '../../shared/agentState.js';
import { initialAgentState, reduceAgentState } from './reducer.js';

export function createAgentStateStore(bridge: AgentStateApi) {
  let state = initialAgentState;
  const listeners = new Set<() => void>();
  let generation = 0;
  let watch: ReturnType<AgentStateApi['watch']> | null = null;
  let startPromise: Promise<void> | null = null;
  let recoveryScheduled = false;
  // One automatic replacement per explicit start-to-stop synchronization episode.
  let recoveryUsed = false;

  const apply = (action: Parameters<typeof reduceAgentState>[1]) => {
    const result = reduceAgentState(state, action);
    if (result.state !== state) {
      state = result.state;
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
          apply({ kind: 'failed' });
          return;
        }
        recoveryUsed = true;
        recoveryScheduled = true;
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
    start() {
      if (!startPromise) {
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
      generation++;
      watch?.close();
      watch = null;
      startPromise = null;
      recoveryScheduled = false;
      recoveryUsed = false;
    },
  };
}
