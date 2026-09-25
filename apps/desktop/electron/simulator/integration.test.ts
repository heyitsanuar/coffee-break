import { afterEach, describe, expect, it } from 'vitest';
import { LocalIngress, type IngressChange } from '../ingress/localIngress.js';
import { SimulatorClient } from './client.js';
import { initialAgents, steps, type TimerClock } from './scenario.js';

const ingresses: LocalIngress[] = [];
afterEach(async () => { for (const ingress of ingresses.splice(0)) await ingress.stop(); });

function manualClock() {
  const tasks: Array<{ delay: number; callback: () => void; cancelled: boolean }> = [];
  const clock: TimerClock = {
    now: () => Date.parse('2026-09-25T12:00:00.000Z'),
    set: (callback, delay) => {
      const task = { delay, callback, cancelled: false };
      tasks.push(task);
      return task as unknown as ReturnType<typeof setTimeout>;
    },
    clear: (timer) => { (timer as unknown as typeof tasks[number]).cancelled = true; },
  };
  return { clock, advance: (delay: number) => {
    for (const task of tasks.filter((item) => item.delay <= delay && !item.cancelled)) {
      task.cancelled = true;
      task.callback();
    }
  } };
}

describe('real simulator client to real loopback ingress', () => {
  it('authenticates, synchronizes, and applies all five framed events in order', async () => {
    const timer = manualClock();
    const failures: string[] = [];
    const client = new SimulatorClient(timer.clock, (code) => failures.push(code));
    const changes: IngressChange[] = [];
    const waiting = new Map<number, () => void>();
    const ingress = new LocalIngress({ onLaunchCredentials: (credentials) => client.start(credentials) });
    ingresses.push(ingress);
    ingress.subscribe((change) => {
      changes.push(change);
      if (change.state.revision && waiting.has(change.state.revision)) {
        waiting.get(change.state.revision)?.();
        waiting.delete(change.state.revision);
      }
    });
    const revision = (value: number) => ingress.readCurrent().revision >= value
      ? Promise.resolve()
      : new Promise<void>((resolve) => waiting.set(value, resolve));
    try {
      await ingress.start();
      await revision(1);
      expect(ingress.readCurrent()).toMatchObject({ revision: 1, phase: 'ready', agents: initialAgents });
      // The acknowledgment is read asynchronously by the client after the mirror publishes.
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const check = () => {
          if (client.phase === 'running') resolve();
          else if (++attempts < 100) setImmediate(check);
          else reject(new Error('snapshot_ack_not_received'));
        };
        check();
      });
      for (let index = 0; index < steps.length; index++) {
        timer.advance(steps[index].offset);
        await revision(index + 2);
      }
      expect(changes.filter((change) => change.kind === 'snapshot')).toHaveLength(1);
      expect(changes.filter((change) => change.kind === 'event').map((change) => change.event.id))
        .toEqual(steps.map((step) => step.id));
      expect(ingress.readCurrent()).toMatchObject({ revision: 6, phase: 'ready' });
      expect(ingress.readCurrent().agents).toEqual([
        { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'completed', activity: 'Change implemented' },
        { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'completed', activity: 'Review complete' },
        { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting', activity: 'Taking a coffee break in the simulated office' },
      ]);
      timer.advance(60_000);
      expect(ingress.readCurrent().revision).toBe(6);
      expect(client.phase).toBe('connected-idle');
      expect(failures).toEqual([]);
    } finally { client.stop(); }
  });
});
