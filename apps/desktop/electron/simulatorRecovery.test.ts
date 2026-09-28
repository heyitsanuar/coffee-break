import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import type { ChildProcess, spawn } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulatorController } from './simulatorController.js';
import { SimulatorClient } from './simulator/client.js';
import type { TimerClock } from './simulator/scenario.js';

const controllers: SimulatorController[] = [];
afterEach(async () => {
  for (const controller of controllers.splice(0)) await controller.stop();
  vi.useRealTimers();
});
async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error('condition_not_observed');
}
class RecoveryChild extends EventEmitter {
  exitCode: number | null = null;
  graceful = true;
  client!: SimulatorClient;
  writes: Array<{ kind: string; credentials?: unknown; snapshotDelayMs?: 1_000 }> = [];
  tasks: Array<{ callback: () => void; cancelled: boolean }> = [];
  readonly stdin = new Writable({
    write: (chunk: Buffer, _encoding, done) => {
      const message = JSON.parse(chunk.toString('utf8')) as typeof this.writes[number];
      this.writes.push(message);
      if (message.kind === 'launch') {
        const clock: TimerClock = {
          now: () => Date.parse('2026-09-28T12:00:00.000Z'),
          set: (callback) => {
            const task = { callback, cancelled: false }; this.tasks.push(task);
            return task as unknown as ReturnType<typeof setTimeout>;
          },
          clear: (timer) => { (timer as unknown as typeof this.tasks[number]).cancelled = true; },
        };
        this.client = new SimulatorClient(clock);
        this.client.start(message.credentials, message.snapshotDelayMs);
      } else this.client?.stop();
      done();
    },
    final: (done) => { if (this.graceful) this.exit(); done(); },
  });
  completeScenario() { for (const task of this.tasks) if (!task.cancelled) { task.cancelled = true; task.callback(); } }
  exit() {
    if (this.exitCode !== null) return;
    this.client?.stop(); this.exitCode = 0; this.emit('exit', 0, null);
  }
  kill() { this.exit(); return true; }
}
async function setup() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  const children: RecoveryChild[] = [];
  const spawnFake = (() => {
    expect(children.filter((child) => child.exitCode === null)).toHaveLength(0);
    const child = new RecoveryChild(); children.push(child);
    return child as unknown as ChildProcess;
  }) as typeof spawn;
  const controller = new SimulatorController('/tmp/simulator.js', spawnFake, () => {}, 500, true);
  controllers.push(controller);
  await controller.start();
  await until(() => children[0].client.phase === 'running');
  const firstSession = controller.ingress.readCurrent().sessionId;
  children[0].completeScenario();
  await until(() => controller.ingress.readCurrent().revision === 6);
  return { controller, children, firstSession };
}

describe('bounded development recovery controller', () => {
  it('waits for child termination and socket loss, replaces exactly once, and holds the replacement snapshot', async () => {
    const { controller, children, firstSession } = await setup();
    const firstSource = children[0].client.source.instanceId;
    children[0].graceful = false;
    await vi.advanceTimersByTimeAsync(2_000);
    await until(() => controller.ingress.readCurrent().phase === 'disconnected');
    expect(children[0].writes.at(-1)?.kind).toBe('shutdown');
    expect(children).toHaveLength(1);
    children[0].exit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(children).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => children.length === 2 && children[1].client.phase === 'synchronizing');
    expect(children[1].client.source.instanceId).not.toBe(firstSource);
    expect(controller.ingress.readCurrent()).toMatchObject({ phase: 'synchronizing', revision: 6 });
    expect(controller.ingress.readCurrent().sessionId).not.toBe(firstSession);
    expect(controller.ingress.readCurrent().agents?.[2].state).toBe('waiting');
    expect(children[1].writes[0].snapshotDelayMs).toBe(1_000);
    await vi.advanceTimersByTimeAsync(999);
    expect(controller.ingress.readCurrent().revision).toBe(6);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => children[1].client.phase === 'running');
    expect(controller.ingress.readCurrent()).toMatchObject({ phase: 'ready', revision: 7 });
    expect(controller.ingress.readCurrent().agents?.map((agent) => agent.state)).toEqual(['idle', 'waiting', 'working']);
    children[1].completeScenario();
    await until(() => controller.ingress.readCurrent().revision === 12);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(children).toHaveLength(2);
    await controller.stop();
    expect(children.every((child) => child.exitCode !== null)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['before-loss', 'replacement-delay', 'snapshot-delay'] as const)('shutdown during %s cancels future work', async (point) => {
    const { controller, children } = await setup();
    if (point !== 'before-loss') {
      await vi.advanceTimersByTimeAsync(2_000);
      await until(() => controller.ingress.readCurrent().phase === 'disconnected');
      await vi.advanceTimersByTimeAsync(0);
    }
    if (point === 'snapshot-delay') {
      await vi.advanceTimersByTimeAsync(2_000);
      await until(() => children.length === 2 && children[1].client.phase === 'synchronizing');
    }
    await controller.stop();
    const count = children.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(children).toHaveLength(count);
    expect(children.every((child) => child.exitCode !== null)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an unexpected exit cannot schedule duplicate replacements', async () => {
    const { controller, children } = await setup();
    children[0].exit(); children[0].emit('exit', 0, null);
    await until(() => controller.ingress.readCurrent().phase === 'disconnected');
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_000);
    await until(() => children.length === 2 && children[1].client.phase === 'synchronizing');
    await vi.advanceTimersByTimeAsync(1_000);
    await until(() => children[1].client.phase === 'running');
    children[1].completeScenario();
    await until(() => controller.ingress.readCurrent().revision === 12);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(children).toHaveLength(2);
  });
});


it('shutdown while awaiting first-child termination prevents a replacement', async () => {
  const { controller, children } = await setup();
  children[0].graceful = false;
  await vi.advanceTimersByTimeAsync(2_000);
  await until(() => controller.ingress.readCurrent().phase === 'disconnected');
  const stopped = controller.stop();
  await vi.advanceTimersByTimeAsync(500);
  await stopped;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(children).toHaveLength(1);
  expect(children[0].exitCode).not.toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
