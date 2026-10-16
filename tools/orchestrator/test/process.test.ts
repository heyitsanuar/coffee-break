import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { runCommand, allowedEnvironment, commandSucceeded } from '../src/process.js';

it('scrubs ambient secrets and unsafe runtime injection variables', () => {
  const env = allowedEnvironment({ PATH: '/usr/bin', GH_TOKEN: 'never-forward-this', OPENAI_API_KEY: 'secret', NODE_OPTIONS: '--require=malicious', SSH_AUTH_SOCK: '/socket', HOME: '/private-home' });
  expect(env.GH_TOKEN).toBeUndefined(); expect(env.OPENAI_API_KEY).toBeUndefined(); expect(env.NODE_OPTIONS).toBeUndefined(); expect(env.SSH_AUTH_SOCK).toBeUndefined(); expect(env.HOME).toBeUndefined();
});
it('classifies missing executables and nonzero exits without leaking exception contents', async () => {
  const missing = await runCommand({ executable: '/nonexistent/cb-flow', args: [], cwd: process.cwd() });
  expect(missing.spawnError).toBe('ENOENT'); expect(commandSucceeded(missing)).toBe(false);
  const failed = await runCommand({ executable: process.execPath, args: ['-e', 'process.exit(9)'], cwd: process.cwd() });
  expect(failed.exitCode).toBe(9); expect(failed.cleanupConfirmed).toBe(true);
});
it('bounds combined output and cleans up even after a misleading early success', async () => {
  const result = await runCommand({ executable: process.execPath, args: ['-e', 'process.stdout.write("x".repeat(20000));process.stderr.write("y".repeat(20000))'], cwd: process.cwd(), limits: { outputBytes: 128 } });
  expect(result.overflow).toBe(true); expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(128); expect(commandSucceeded(result)).toBe(false);
});
it('escalates deadlines and terminates an owned child group, without killing unrelated processes', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'cb-flow-process-'));
  try {
    const marker = join(fixture, 'pid');
    const program = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('node:fs').writeFileSync(process.argv[1],String(c.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`;
    const result = await runCommand({ executable: process.execPath, args: ['-e', program, marker], cwd: fixture, limits: { commandMs: 300, graceMs: 100 } });
    expect(result.timedOut).toBe(true); expect(result.cleanupConfirmed).toBe(true); expect(result.signals).toContain('SIGKILL');
    expect(existsSync(marker)).toBe(true);
    const pid = Number(await readFile(marker, 'utf8')); expect(() => process.kill(pid, 0)).toThrow();
  } finally { await rm(fixture, { recursive: true, force: true }); }
}, 5000);
it('cancels without claiming success', async () => {
  const controller = new AbortController(); setTimeout(() => controller.abort(), 100);
  const result = await runCommand({ executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: process.cwd(), signal: controller.signal, limits: { graceMs: 50 } });
  expect(result.interrupted).toBe(true); expect(result.cleanupConfirmed).toBe(true); expect(commandSucceeded(result)).toBe(false);
});
it('rejects an early zero exit that leaves a descendant running', async () => {
  const program = `require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'}).unref()`;
  const result = await runCommand({ executable: process.execPath, args: ['-e', program], cwd: process.cwd(), limits: { commandMs: 1000, graceMs: 50 } });
  expect(result.exitCode).toBe(0);
  expect(result.cleanupConfirmed).toBe(true);
  expect(result.signals).toContain('SIGTERM');
  expect(commandSucceeded(result)).toBe(false);
});
it('bounds invalid UTF-8 output without creating replacement-character amplification', async () => {
  const result = await runCommand({ executable: process.execPath, args: ['-e', 'process.stdout.write(Buffer.alloc(1000,255))'], cwd: process.cwd(), limits: { outputBytes: 128 } });
  expect(result.overflow).toBe(true);
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(128);
  expect(commandSucceeded(result)).toBe(false);
});
