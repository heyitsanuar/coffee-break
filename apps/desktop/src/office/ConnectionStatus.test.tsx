import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialAgentState, type AgentStoreState } from '../agentState/reducer';
import { ConnectionStatus, connectionStatusCopy } from './ConnectionStatus';

const retained = {
  'mock-agent-ari': { state: 'completed' as const, activity: 'Change implemented' },
  'mock-agent-mina': { state: 'completed' as const, activity: 'Review complete' },
  'mock-agent-sol': { state: 'waiting' as const, activity: 'Taking a coffee break in the simulated office' },
};

describe('global connection status', () => {
  it.each([
    [initialAgentState, 'Connecting to local simulation…'],
    [{ ...initialAgentState, connection: 'disconnected' }, 'Disconnected · Local simulation unavailable'],
    [{ ...initialAgentState, connection: 'disconnected', agentsById: retained }, 'Disconnected · Showing last known agent state'],
    [{ ...initialAgentState, agentsById: retained }, 'Synchronizing local simulation · Showing last known agent state'],
    [{ ...initialAgentState, connection: 'connected', synchronized: true, agentsById: retained }, 'Connected · Local simulation active'],
  ] as Array<[AgentStoreState, string]>)('reports truthful availability with a polite live region', (snapshot, copy) => {
    const markup = renderToStaticMarkup(<ConnectionStatus snapshot={snapshot} />);
    expect(connectionStatusCopy(snapshot)).toBe(copy);
    expect(markup).toContain(copy);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).not.toContain('Reconnecting');
  });
});
