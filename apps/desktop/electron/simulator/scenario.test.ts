import { describe, expect, it, vi } from 'vitest';
import type { AgentStateChangedEvent } from '@coffee-break/contracts';
import { initialAgents, scheduleScenario, steps } from './scenario.js';

describe('one-shot simulator scenario', () => {
  it('has the exact approved snapshot and Sol fixture', () => {
    expect(initialAgents).toEqual([
      { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle', activity: 'Ready for a task' },
      { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'waiting', activity: 'Waiting for changes' },
      { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'working', activity: 'Finishing a task' },
    ]);
    expect(steps[2]).toMatchObject({
      id: 'sim-003', agent: { id: 'mock-agent-sol' }, state: 'waiting',
      activity: 'Taking a coffee break in the simulated office',
    });
    expect(steps.some((step) => step.state === ('break' as string))).toBe(false);
    expect(steps.every((step) => !('presentationState' in step))).toBe(true);
    expect(initialAgents[1].state).toBe('waiting');
    expect(initialAgents[1].activity).not.toContain('coffee');
  });

  it('emits five fixed events at exact offsets, then remains idle', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-25T12:00:00.000Z'));
      const events: AgentStateChangedEvent[] = [];
      const complete = vi.fn();
      const cancel = scheduleScenario(
        { kind: 'local-connector', instanceId: 'sim-test' },
        (event) => events.push(event),
        { now: () => Date.now(), set: (callback, delay) => setTimeout(callback, delay), clear: clearTimeout },
        complete,
      );
      for (let index = 0; index < 5; index++) {
        vi.advanceTimersByTime(1_000);
        expect(events).toHaveLength(index + 1);
        expect(events[index]).toEqual({
          id: steps[index].id,
          type: 'agent.state.changed',
          timestamp: new Date(Date.parse('2026-09-25T12:00:00.000Z') + steps[index].offset).toISOString(),
          source: { kind: 'local-connector', instanceId: 'sim-test' },
          payload: { agent: steps[index].agent, state: steps[index].state, activity: steps[index].activity },
        });
      }
      expect(new Set(events.map((event) => event.payload.agent.id)).size).toBe(3);
      vi.advanceTimersByTime(60_000);
      expect(events).toHaveLength(5);
      expect(complete).toHaveBeenCalledTimes(1);
      cancel();
    } finally { vi.useRealTimers(); }
  });

  it('cancels all pending transitions', () => {
    vi.useFakeTimers();
    try {
      const events: AgentStateChangedEvent[] = [];
      const cancel = scheduleScenario({ kind: 'local-connector', instanceId: 'sim-test' },
        (event) => events.push(event));
      vi.advanceTimersByTime(2_000);
      cancel();
      vi.advanceTimersByTime(60_000);
      expect(events.map((event) => event.id)).toEqual(['sim-001', 'sim-002']);
    } finally { vi.useRealTimers(); }
  });
});
