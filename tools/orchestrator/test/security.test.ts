import { readFile, rm, writeFile } from 'node:fs/promises';
import * as net from 'node:net';
import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import { decide } from '../src/contracts.js';
import { commandEvidence, runCommand, type CommandResult } from '../src/process.js';
import { makeFixture, treeDigest } from '../src/probes/fixtures.js';
import { HELPER } from '../src/probes/helper.js';
import { classifyProbe, parseProbe, pendingSecurity, probeSecurity } from '../src/probes/security.js';

vi.mock('node:net', async importOriginal => {
  const original = await importOriginal<typeof import('node:net')>();
  return { ...original, createServer: vi.fn(original.createServer) };
});

export const result = (stdout: string, overrides: Partial<CommandResult> = {}): CommandResult => ({ stdout, stderr: '', exitCode: 0, signal: null, timedOut: false, overflow: false, interrupted: false, cleanupConfirmed: true, bytesObserved: Buffer.byteLength(stdout), durationMs: 1, signals: [], ...overrides });
const denied = { allowedRead: 'allowed', create: 'denied', modify: 'denied', rename: 'denied', delete: 'denied', credential: 'denied', controller: 'denied', symlink: 'denied', gitWrite: 'denied', childWrite: 'denied', childCredential: 'denied', network: 'denied' };

it('requires complete operation evidence, explicit policy errors and a network positive control', () => {
  expect(decide(classifyProbe(result(JSON.stringify(denied)), true)).ready).toBe(true);
  for (const value of ['', 'success', '{}', '[]', 'null', JSON.stringify({ ...denied, network: 'ambiguous' })]) expect(decide(classifyProbe(result(value), true)).ready).toBe(false);
  expect(decide(classifyProbe(result(JSON.stringify(denied)), false)).ready).toBe(false);
  expect(decide(classifyProbe(result(JSON.stringify({ ...denied, network: 'allowed' })), false)).exitCode).toBe(1);
  expect(decide(classifyProbe(result(JSON.stringify({ ...denied, credential: 'allowed' })), true)).exitCode).toBe(1);
  for (const overrides of [{ exitCode: 9 }, { timedOut: true }, { cleanupConfirmed: false }, { overflow: true }]) expect(parseProbe(result(JSON.stringify(denied), overrides))).toBeNull();
  expect(decide(pendingSecurity('not executed')).ready).toBe(false);
});

it('detects ineffective restrictions and mutations without disclosing synthetic credentials', async () => {
  const fixture = await makeFixture();
  try {
    const secret = await readFile(fixture.credential, 'utf8');
    const before = await treeDigest(fixture.root);
    // Deliberately unisolated trusted helper, confined to disposable test fixtures.
    const executed = await runCommand({ executable: process.execPath, args: ['-e', HELPER, JSON.stringify(fixture), 'probe'], cwd: fixture.workspace });
    expect(decide(classifyProbe(executed, false)).exitCode).toBe(1);
    expect(await treeDigest(fixture.root)).not.toBe(before);
    expect(executed.stdout).not.toContain(secret);
    expect(JSON.stringify(commandEvidence('test', executed))).not.toContain(secret);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

it('hashes symlink targets as paths, and detects protected state and Git fixture changes', async () => {
  const fixture = await makeFixture();
  try {
    const before = await treeDigest(fixture.root);
    await writeFile(fixture.gitFile, 'changed');
    expect(await treeDigest(fixture.root)).not.toBe(before);
    const second = await treeDigest(fixture.root);
    await writeFile(fixture.controller, 'changed');
    expect(await treeDigest(fixture.root)).not.toBe(second);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

it('stops before Codex if the independent guard is unavailable, and cleans fixtures', async () => {
  const calls: string[][] = [];
  const report = await probeSecurity('/never/execute/codex', undefined, async spec => { calls.push([...spec.args]); return result('', { exitCode: 71, stderr: 'sandbox-exec: sandbox_init: Operation not permitted' }); });
  expect(calls).toHaveLength(1);
  expect(report.commands[0].guardUnavailable).toBe(true);
  expect(report.checks.find(check => check.id === 'security.outer-guard')?.status).toBe('unverified');
  expect(report.checks.find(check => check.id === 'security.fixture-cleanup')?.status).toBe('pass');
  expect(decide(report.checks).ready).toBe(false);
});

it('retains fixtures and blocks readiness when child cleanup is unconfirmed', async () => {
  const report = await probeSecurity(null, undefined, async () => result('', { cleanupConfirmed: false }));
  const cleanup = report.checks.find(check => check.id === 'security.fixture-cleanup');
  expect(cleanup?.status).toBe('fail');
  expect(decide(report.checks).exitCode).toBe(1);
  // The mock spawned nothing; the test can remove its owned retained fixture.
  await rm(String(cleanup?.evidence?.fixture), { recursive: true, force: true });
});

it('adapts only fixed non-inference commands and records distinct native evidence', async () => {
  const calls: string[][] = [];
  const report = await probeSecurity('/mock/codex', undefined, async spec => {
    calls.push([...spec.args]);
    const mode = spec.args.at(-1);
    if (mode === 'guard') return result(JSON.stringify({ guardRead: 'denied', guardWrite: 'denied' }));
    if (mode === 'network-control') return result(JSON.stringify({ network: 'allowed' }));
    expect(mode).toBe('probe');
    expect(spec.args).toContain('--no-daemon');
    expect(spec.args).toContain('--permission-profile');
    expect(spec.args).toContain('--include-managed-config');
    expect(spec.args).toContain('sandbox');
    expect(spec.args).not.toContain('exec');
    return result(JSON.stringify(denied), { stderr: 'WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)' });
  });
  expect(calls.length).toBeGreaterThanOrEqual(2);
  expect(report.checks.find(check => check.id === 'security.credential')?.status).toBe('pass');
  expect(report.checks.find(check => check.id === 'security.fixture-integrity')?.status).toBe('pass');
  expect(report.commands.find(command => command.id === 'security.codex-native')?.aliasSetupWarning).toBe(true);
  expect(report.nativeDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(report)).not.toContain('WARNING:');
});

it('classifies the exact saved sandbox_apply failure without reporting enforcement passed', async () => {
  const stderr = 'sandbox-exec: sandbox_apply: Operation not permitted\n';
  const failed = result('', { exitCode: 71, stderr, bytesObserved: Buffer.byteLength(stderr) });
  const evidence = commandEvidence('security.guard-control', failed);
  expect(evidence.guardUnavailable).toBe(true);
  expect(evidence.bytesObserved).toBe(53);
  expect(evidence.outputDigest).toBe('97e23c13336291c8a51cc1da026d43627fa6cbe70a39d676001d38bd66d9a113');
  const report = await probeSecurity('/never/execute/codex', undefined, async () => failed);
  expect(report.checks.find(check => check.id === 'security.outer-guard')?.status).toBe('unverified');
  expect(decide(report.checks)).toMatchObject({ ready: false, exitCode: 3 });
});

class PendingListener extends EventEmitter {
  listening = false;
  listen = vi.fn(() => { this.start?.(); return this; });
  close = vi.fn((callback?: (error?: Error) => void) => {
    this.listening = false;
    setImmediate(() => { this.emit('close'); callback?.(); });
    return this;
  });
  address = () => ({ address: '127.0.0.1', family: 'IPv4', port: 12345 });
  start?: () => void;
}
it('cancels before listen without starting a listener or a subprocess, and removes fixtures', async () => {
  const controller = new AbortController(); controller.abort();
  const server = new PendingListener();
  const create = vi.spyOn(net, 'createServer').mockReturnValue(server as unknown as net.Server);
  const runner = vi.fn(async () => result(''));
  try {
    const report = await probeSecurity(null, controller.signal, runner);
    expect(server.listen).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
    expect(report.checks.find(check => check.id === 'security.fixture-cleanup')?.status).toBe('pass');
    expect(decide(report.checks).ready).toBe(false);
  } finally { create.mockRestore(); }
});
it.each(['error', 'listening'] as const)('closes a pending listener on cancellation and handles its late %s event', async event => {
  const controller = new AbortController();
  const server = new PendingListener();
  const uncaught: unknown[] = [];
  server.start = () => {
    controller.abort();
    setImmediate(() => {
      try {
        if (event === 'error') server.emit('error', Object.assign(new Error('synthetic listen EPERM'), { code: 'EPERM' }));
        else { server.listening = true; server.emit('listening'); }
      } catch (error) { uncaught.push(error); }
    });
  };
  const create = vi.spyOn(net, 'createServer').mockReturnValue(server as unknown as net.Server);
  const runner = vi.fn(async () => result(''));
  try {
    const report = await probeSecurity(null, controller.signal, runner);
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(server.listen).toHaveBeenCalledOnce();
    expect(server.close).toHaveBeenCalled();
    expect(server.listening).toBe(false);
    expect(uncaught).toEqual([]);
    expect(() => server.emit('error', Object.assign(new Error('late synthetic error'), { code: 'EPERM' }))).not.toThrow();
    expect(runner).not.toHaveBeenCalled();
    expect(report.checks.find(check => check.id === 'security.fixture-cleanup')?.status).toBe('pass');
    expect(decide(report.checks)).toMatchObject({ ready: false, exitCode: 3 });
  } finally { create.mockRestore(); }
});
it('bounds a pending bind at two seconds and closes any later successful bind', async () => {
  const server = new PendingListener();
  const create = vi.spyOn(net, 'createServer').mockReturnValue(server as unknown as net.Server);
  const runner = vi.fn(async () => result('', { exitCode: 71 }));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    const pending = probeSecurity(null, undefined, runner);
    for (let attempt = 0; attempt < 5_000 && !server.listen.mock.calls.length; attempt++) await new Promise<void>(resolve => setImmediate(resolve));
    expect(server.listen).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(runner).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const report = await pending;
    expect(report.checks.find(check => check.id === 'security.network-positive-control')?.evidence?.listenerError).toBe('TIMEOUT');
    expect(decide(report.checks)).toMatchObject({ ready: false, exitCode: 3 });
    server.listening = true; server.emit('listening');
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(server.listening).toBe(false);
    expect(server.close).toHaveBeenCalled();
    expect(report.checks.find(check => check.id === 'security.fixture-cleanup')?.status).toBe('pass');
  } finally { create.mockRestore(); vi.useRealTimers(); }
});
