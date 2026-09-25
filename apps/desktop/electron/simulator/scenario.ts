import type { AgentCurrentState, AgentStateChangedEvent, EventSource } from '@coffee-break/contracts';

export const initialAgents: AgentCurrentState[] = [
  { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle', activity: 'Ready for a task' },
  { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'waiting', activity: 'Waiting for changes' },
  { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'working', activity: 'Finishing a task' },
];

export const steps = [
  { offset: 1_000, id: 'sim-001', agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'working', activity: 'Implementing the change' },
  { offset: 2_000, id: 'sim-002', agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'working', activity: 'Reviewing the change' },
  { offset: 3_000, id: 'sim-003', agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting', activity: 'Taking a coffee break in the simulated office' },
  { offset: 4_000, id: 'sim-004', agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'completed', activity: 'Change implemented' },
  { offset: 5_000, id: 'sim-005', agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'completed', activity: 'Review complete' },
] as const;

export interface TimerClock {
  now(): number;
  set(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clear(timer: ReturnType<typeof setTimeout>): void;
}

export const realClock: TimerClock = {
  now: () => Date.now(),
  set: (callback, delay) => setTimeout(callback, delay),
  clear: (timer) => clearTimeout(timer),
};

export function scheduleScenario(
  source: EventSource,
  emit: (event: AgentStateChangedEvent) => void,
  clock: TimerClock = realClock,
  onComplete: () => void = () => {},
): () => void {
  const runStart = clock.now();
  let cancelled = false;
  const timers = steps.map((step, index) => clock.set(() => {
    if (cancelled) return;
    emit({
      id: step.id,
      type: 'agent.state.changed',
      timestamp: new Date(runStart + step.offset).toISOString(),
      source,
      payload: { agent: step.agent, state: step.state, activity: step.activity },
    });
    if (index === steps.length - 1) onComplete();
  }, step.offset));
  return () => {
    cancelled = true;
    for (const timer of timers) clock.clear(timer);
  };
}
