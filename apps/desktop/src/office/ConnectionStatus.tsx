import { agentIds, type AgentStoreState } from '../agentState/reducer';

export function connectionStatusCopy(snapshot: AgentStoreState): string {
  const retained = agentIds.every((id) => snapshot.agentsById[id] !== undefined);
  if (snapshot.connection === 'connected' && snapshot.synchronized) {
    return 'Connected · Local simulation active';
  }
  if (snapshot.connection === 'disconnected') {
    return retained ? 'Disconnected · Showing last known agent state'
      : 'Disconnected · Local simulation unavailable';
  }
  return retained ? 'Synchronizing · Showing last known agent state'
    : 'Connecting to local simulation…';
}

export function ConnectionStatus({ snapshot }: { readonly snapshot: AgentStoreState }): React.JSX.Element {
  return <p className="connection-status" role="status" aria-live="polite" aria-atomic="true">
    {connectionStatusCopy(snapshot)}
  </p>;
}
