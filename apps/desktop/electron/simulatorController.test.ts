import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import type { ChildProcess, spawn } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { simulationEnabled, SimulatorController } from './simulatorController.js';

class FakeChild extends EventEmitter {
  exitCode: number | null = null;
  writes: string[] = [];
  signals: string[] = [];
  readonly stdin = new Writable({
    write: (chunk: Buffer, _encoding, done) => { this.writes.push(chunk.toString('utf8')); done(); },
    final: (done) => { if (this.graceful) this.exit(); done(); },
  });
  graceful = true;
  ignoreTerm = false;
  exit() { if (this.exitCode !== null) return; this.exitCode = 0; this.emit('exit', 0, null); }
  kill(signal: NodeJS.Signals) { this.signals.push(signal); if (signal !== 'SIGTERM' || !this.ignoreTerm) this.exit(); return true; }
}

const controllers: SimulatorController[] = [];
afterEach(async () => { for (const controller of controllers.splice(0)) await controller.stop(); });

describe('simulator activation and main ownership', () => {
  it('requires an exact main-side signal, a dev URL and an unpackaged app', () => {
    expect(simulationEnabled(undefined, 'http://localhost:5173', false)).toBe(false);
    expect(simulationEnabled('0', 'http://localhost:5173', false)).toBe(false);
    expect(simulationEnabled('1', undefined, false)).toBe(false);
    expect(simulationEnabled('1', 'http://localhost:5173', true)).toBe(false);
    expect(simulationEnabled('1', 'http://localhost:5173', false)).toBe(true);
  });

  it('starts ingress first, hands credentials only through stdin, and launches once', async () => {
    const child = new FakeChild();
    const calls: Array<{ command: string; args: unknown; options: unknown }> = [];
    const spawnFake: typeof spawn = ((command, args, options) => {
      calls.push({ command, args, options });
      return child as unknown as ChildProcess;
    }) as typeof spawn;
    const diagnostics: string[] = [];
    const controller = new SimulatorController('/tmp/simulator.js', spawnFake, (code) => diagnostics.push(code));
    controllers.push(controller);
    await controller.start();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ command: process.execPath, args: ['/tmp/simulator.js'], options: {
      shell: false, env: { ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'inherit', 'inherit'],
    } });
    const message = JSON.parse(child.writes[0]) as { kind: string; credentials: { token: string; host: string; port: number } };
    expect(message.kind).toBe('launch');
    expect(message.credentials.host).toBe('127.0.0.1');
    expect(message.credentials.port).toBeGreaterThan(0);
    expect(message.credentials.token).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(calls)).not.toContain(message.credentials.token);
    expect(JSON.stringify(diagnostics)).not.toContain(message.credentials.token);
    expect(JSON.stringify(controller.ingress.readCurrent())).not.toContain(message.credentials.token);
    await expect(controller.start()).rejects.toThrow('simulator_controller_single_use');
    await controller.stop();
    expect(child.writes[1]).toBe('{"kind":"shutdown"}\n');
    expect(child.exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    await controller.stop();
  });

  it('does not restart after unexpected child exit and terminates an uncooperative child', async () => {
    const first = new FakeChild();
    const children = [first];
    const diagnostics: string[] = [];
    const spawnFake: typeof spawn = (() => first as unknown as ChildProcess) as typeof spawn;
    const controller = new SimulatorController('/tmp/simulator.js', spawnFake, (code) => diagnostics.push(code), 1);
    controllers.push(controller);
    await controller.start();
    first.exit();
    expect(diagnostics).toContain('child_exited');
    expect(children).toHaveLength(1);
    await controller.stop();

    const second = new FakeChild();
    second.graceful = false;
    second.ignoreTerm = true;
    const stubborn = new SimulatorController('/tmp/simulator.js',
      (() => second as unknown as ChildProcess) as typeof spawn, () => {}, 1);
    controllers.push(stubborn);
    await stubborn.start();
    await stubborn.stop();
    expect(second.signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(second.exitCode).toBe(0);
  });

  it('stops safely before startup without launching a child or listener', async () => {
    let launches = 0;
    const controller = new SimulatorController('/tmp/simulator.js',
      (() => { launches++; throw new Error('unexpected_spawn'); }) as typeof spawn, () => {});
    await controller.stop();
    await expect(controller.start()).rejects.toThrow('simulator_controller_single_use');
    expect(launches).toBe(0);
  });
});
