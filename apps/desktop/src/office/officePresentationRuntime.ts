import type { createAgentStateStore, AcceptedAgentUpdate } from '../agentState/store';
import { deriveOfficePresentation } from './officePresentation';
import type { MockAgentId } from './mockAgents';

export interface OfficeAcknowledgement {
  readonly id: MockAgentId;
  readonly state: 'completed' | 'error';
  readonly sequence: number;
}
export type MotionPreference = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;
export function createOfficePresentationRuntime(
  store: Pick<ReturnType<typeof createAgentStateStore>, 'getSnapshot' | 'subscribeAcceptedUpdates'>,
  preference: MotionPreference,
) {
  let reducedMotion = preference.matches;
  let snapshot = deriveOfficePresentation(store.getSnapshot(), reducedMotion);
  let sequence = 0;
  let disposed = false;
  const listeners = new Set<() => void>();
  const acknowledgements = new Set<(value: OfficeAcknowledgement) => void>();
  const publish = () => { for (const listener of listeners) listener(); };
  const accepted = ({ previous, next, action }: AcceptedAgentUpdate) => {
    snapshot = deriveOfficePresentation(next, reducedMotion);
    publish(); // Apply latest pose/policy first, then deliver this non-replayable reaction.
    if (disposed || reducedMotion || action.kind !== 'change' || action.change.kind !== 'event'
      || previous.connection !== 'connected' || !previous.synchronized
      || next.connection !== 'connected' || !next.synchronized
      || previous.sessionId !== next.sessionId || next.revision !== previous.revision + 1) return;
    const id = action.change.agent.agent.id as MockAgentId;
    const before = previous.agentsById[id];
    const after = next.agentsById[id];
    if (!before || !after || before.state === after.state
      || (after.state !== 'completed' && after.state !== 'error')) return;
    const value: OfficeAcknowledgement = { id, state: after.state, sequence: ++sequence };
    for (const listener of acknowledgements) listener(value);
  };
  const unsubscribe = store.subscribeAcceptedUpdates(accepted);
  const changed = () => {
    if (disposed || preference.matches === reducedMotion) return;
    reducedMotion = preference.matches;
    snapshot = deriveOfficePresentation(store.getSnapshot(), reducedMotion);
    publish(); // Preference changes never create entry eligibility.
  };
  preference.addEventListener('change', changed);
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    subscribeAcknowledgements(listener: (value: OfficeAcknowledgement) => void) {
      acknowledgements.add(listener);
      return () => { acknowledgements.delete(listener); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      preference.removeEventListener('change', changed);
      snapshot = Object.fromEntries(Object.entries(snapshot).map(([id, value]) => [id, { ...value, live: false }])) as typeof snapshot;
      publish(); // Stop owned scene motion before detaching presentation consumers.
      listeners.clear();
      acknowledgements.clear();
    },
  };
}
export type OfficePresentationRuntime = ReturnType<typeof createOfficePresentationRuntime>;
