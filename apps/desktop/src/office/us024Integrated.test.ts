import { expect, it, vi } from 'vitest';
import type { AgentCurrentState, AgentLifecycleState } from '@coffee-break/contracts';
import type { AgentStateMessage, TrustedAgentState } from '../../shared/agentState';
import { createAgentStateStore } from '../agentState/store';
import { createOfficePresentationRuntime } from './officePresentationRuntime';
import { getWorkstationGeometry, workstationMarks } from './workstationPresentation';

function integratedFixture() {
  let emit!: (message: AgentStateMessage) => void;
  const store = createAgentStateStore({ watch(listener) {
    emit = listener;
    return { ready: Promise.resolve(), close() {} };
  } });
  const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const runtime = createOfficePresentationRuntime(store, media);
  const acknowledgements: string[] = [];
  runtime.subscribeAcknowledgements(value => acknowledgements.push(`${value.id}:${value.state}`));
  const agents: AgentCurrentState[] = [
    { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle', activity: 'Ready' },
    { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'waiting', activity: 'Waiting for approval', reason: 'approval_required' },
    { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting', activity: 'Taking a coffee break in the simulated office' },
  ];
  let revision = 1;
  let phase: TrustedAgentState['phase'] = 'ready';
  let sessionId = 'us024-session-1';
  const state = (copy = structuredClone(agents)): TrustedAgentState => ({ revision, phase, sessionId, agents: copy });
  const current = () => emit({ kind: 'current', state: state() });
  const event = (id: AgentCurrentState['agent']['id'], next: AgentLifecycleState, activity: string, reason?: AgentCurrentState['reason']) => {
    const index = agents.findIndex(agent => agent.agent.id === id);
    const updated: AgentCurrentState = { ...agents[index], state: next, activity, ...(reason ? { reason } : {}) };
    agents[index] = updated;
    revision++;
    emit({ kind: 'change', change: { kind: 'event', agent: structuredClone(updated), state: state() } });
  };
  const disconnect = () => {
    phase = 'disconnected';
    emit({ kind: 'change', change: { kind: 'connection', state: state() } });
  };
  const synchronize = () => {
    phase = 'synchronizing'; sessionId = 'us024-session-2';
    emit({ kind: 'change', change: { kind: 'connection', state: state() } });
  };
  const restore = () => {
    phase = 'ready'; revision++;
    emit({ kind: 'change', change: { kind: 'snapshot', state: state() } });
  };
  return { store, runtime, agents, acknowledgements, current, event, disconnect, synchronize, restore,
    close() { runtime.dispose(); store.stop(); } };
}

it('keeps all five trusted lifecycle presentations and paired workstation state coherent', async () => {
  const f = integratedFixture(); await f.store.start(); f.current();
  const ari = 'mock-agent-ari';
  expect(f.runtime.getSnapshot()[ari]).toMatchObject({ state: 'idle', activity: 'Ready', live: true });
  expect(workstationMarks(f.runtime.getSnapshot()[ari].state)).toEqual([]);
  f.event(ari, 'working', 'Implementing');
  expect(f.runtime.getSnapshot()[ari]).toMatchObject({ state: 'working', activity: 'Implementing', live: true });
  expect(workstationMarks(f.runtime.getSnapshot()[ari].state).length).toBeGreaterThan(0);
  f.event(ari, 'waiting', 'Waiting for approval', 'approval_required');
  expect(f.runtime.getSnapshot()[ari]).toMatchObject({ state: 'waiting', reason: 'approval_required' });
  f.event(ari, 'completed', 'Completed');
  expect(f.acknowledgements).toEqual(['mock-agent-ari:completed']);
  f.event(ari, 'error', 'Validation failed');
  expect(f.runtime.getSnapshot()[ari]).toMatchObject({ state: 'error', activity: 'Validation failed' });
  expect(f.acknowledgements).toEqual(['mock-agent-ari:completed', 'mock-agent-ari:error']);
  expect(getWorkstationGeometry('mock-agent-sol', true)).toBeUndefined();
  f.close();
});

it('derives coffee only from Sol’s exact trusted conjunction and preserves inspection values', async () => {
  const f = integratedFixture(); await f.store.start(); f.current();
  expect(f.runtime.getSnapshot()['mock-agent-sol']).toMatchObject({ state: 'waiting', visual: 'coffee', activity: 'Taking a coffee break in the simulated office' });
  f.event('mock-agent-sol', 'waiting', 'Waiting for approval');
  expect(f.runtime.getSnapshot()['mock-agent-sol']).toMatchObject({ state: 'waiting', visual: 'waiting', activity: 'Waiting for approval' });
  f.event('mock-agent-mina', 'waiting', 'Taking a coffee break in the simulated office');
  expect(f.runtime.getSnapshot()['mock-agent-mina']).toMatchObject({ state: 'waiting', visual: 'waiting' });
  f.close();
});

it('retains exact agent information without lifecycle mutation and does not replay acknowledgements on restoration', async () => {
  const f = integratedFixture(); await f.store.start(); f.current();
  f.event('mock-agent-ari', 'working', 'Working exactly');
  f.event('mock-agent-ari', 'completed', 'Completed exactly');
  expect(f.acknowledgements).toEqual(['mock-agent-ari:completed']);
  f.disconnect();
  expect(f.runtime.getSnapshot()['mock-agent-ari']).toMatchObject({ state: 'completed', activity: 'Completed exactly', live: false });
  f.synchronize();
  expect(f.runtime.getSnapshot()['mock-agent-ari']).toMatchObject({ state: 'completed', activity: 'Completed exactly', live: false });
  f.restore();
  expect(f.runtime.getSnapshot()['mock-agent-ari']).toMatchObject({ state: 'completed', activity: 'Completed exactly', live: true });
  expect(f.acknowledgements).toEqual(['mock-agent-ari:completed']);
  f.close();
});
