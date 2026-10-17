import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { acquire, reconcileLock, readLock, type LockEnvironment } from '../../src/workflow/lock.js';
import { StoragePaths } from '../../src/workflow/paths.js';
import { at, runId } from './fixtures.js';
import { compileRuntime, worker } from './process-fixtures.js';
import { hostname } from 'node:os';
import { canonical } from '../../src/workflow/contracts.js';

const environment = (pid: number, existence: 'present' | 'absent' | 'unknown' = 'present'): LockEnvironment => ({ identity: async () => ({ pid, uid: process.getuid!(), host: 'fixture-host', bootId: 'fixture-boot', processStartedAt: at }), exists: () => existence, now: () => at });
it('never steals active, ambiguous, foreign-boot, reused-PID or malformed locks', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-lock-')));
  try {
    const dir = await new StoragePaths(root).create(runId); const lease = await acquire(dir, environment(123));
    await expect(acquire(dir, environment(456))).rejects.toThrow('LOCK_BUSY');
    for (const state of ['present', 'unknown'] as const) await expect(reconcileLock(dir, lease.owner.token, environment(456, state))).rejects.toThrow('LOCK_OWNER_AMBIGUOUS');
    await expect(reconcileLock(dir, 'wrong', environment(456, 'absent'))).rejects.toThrow('LOCK_CHANGED');
    await expect(reconcileLock(dir, lease.owner.token, { ...environment(456, 'absent'), identity: async () => ({ ...lease.owner, pid: 456, bootId: null }) })).rejects.toThrow('LOCK_OWNER_AMBIGUOUS');
    await lease.release(); await dir.create('writer.lock', Buffer.from('{'));
    await expect(reconcileLock(dir, 'wrong', environment(456, 'absent'))).rejects.toThrow();
    expect(await dir.read('writer.lock', 4096)).toEqual(Buffer.from('{'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('reconciles a corroborated dead owner only explicitly and protects replacement locks', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-lock-')));
  try {
    const dir = await new StoragePaths(root).create(runId); const lease = await acquire(dir, environment(123));
    await reconcileLock(dir, lease.owner.token, environment(456, 'absent')); expect(await readLock(dir)).toBeNull();
    const replacement = await acquire(dir, environment(456));
    await expect(lease.release()).rejects.toThrow('LOCK_CHANGED'); expect((await readLock(dir))?.owner.token).toBe(replacement.owner.token);
    await replacement.release();
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('serializes reconcilers and refuses a lock replaced during liveness checks', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-lock-')));
  try {
    const dir = await new StoragePaths(root).create(runId); const lease = await acquire(dir, environment(123));
    const held = await acquire(dir, environment(456), 'recovery.lock');
    await expect(reconcileLock(dir, lease.owner.token, environment(456, 'absent'))).rejects.toThrow('LOCK_BUSY'); await held.release();
    let replacement: Awaited<ReturnType<typeof acquire>> | undefined;
    await expect(reconcileLock(dir, lease.owner.token, { ...environment(456, 'absent'), exists: async () => { await lease.release(); replacement = await acquire(dir, environment(789)); return 'absent' as const; } })).rejects.toThrow('LOCK_CHANGED');
    expect((await readLock(dir))?.owner.token).toBe(replacement!.owner.token); await replacement!.release();
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('bounds lock metadata and leaves unsupported or ambiguous metadata untouched', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-lock-')));
  try {
    const dir = await new StoragePaths(root).create(runId); await dir.create('writer.lock', Buffer.alloc(4097));
    await expect(readLock(dir)).rejects.toThrow('RESOURCE_LIMIT');
    await expect(reconcileLock(dir, 'anything', environment(456, 'absent'))).rejects.toThrow('RESOURCE_LIMIT');
    expect((await dir.inspect('writer.lock'))?.stat.size).toBe(4097n);
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('classifies unsupported lock schemas distinctly and preserves their bytes', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-lock-')));
  try {
    const dir = await new StoragePaths(root).create(runId); const lease = await acquire(dir, environment(123)); await lease.release();
    const bytes = Buffer.from(canonical({ ...lease.owner, schemaVersion: 2 })); await dir.create('writer.lock', bytes);
    await expect(readLock(dir)).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEMA', exitCode: 3 });
    expect(await dir.read('writer.lock', 4096)).toEqual(bytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('excludes a competing real process and reconciles a killed owner with competing real reconcilers', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-lock-process-')));
  const workers: ReturnType<typeof worker>[] = [];
  try {
    const dir = await new StoragePaths(root).create(runId); const runtime = await compileRuntime(root);
    const first = worker(root, runtime, 'hold'); workers.push(first); const held = await first.next(); expect(held.ok).toBe(true);
    const second = worker(root, runtime, 'attempt'); workers.push(second); expect(await second.next()).toMatchObject({ ok: false, code: 'LOCK_BUSY' });
    await expect(reconcileLock(dir, held.token!, { ...environment(process.pid), identity: async () => ({ pid: process.pid, uid: process.getuid!(), host: hostname(), bootId: 'controlled-process-fixture', processStartedAt: at }), exists: pid => { try { process.kill(pid, 0); return 'present'; } catch { return 'absent'; } }, now: () => new Date().toISOString() })).rejects.toThrow('LOCK_OWNER_AMBIGUOUS');
    await first.stop();
    const a = worker(root, runtime, 'reconcile', held.token); const b = worker(root, runtime, 'reconcile', held.token); workers.push(a, b);
    await Promise.all([a.next(), b.next()]); const results = [a.next(), b.next()]; a.child.send!('go'); b.child.send!('go');
    const decisions = await Promise.all(results); expect(decisions.filter(r => r.ok)).toHaveLength(1); expect(decisions.filter(r => !r.ok)).toHaveLength(1); expect(await readLock(dir)).toBeNull();
  } finally { await Promise.all(workers.map(w => w.stop())); await rm(root, { recursive: true, force: true }); }
}, 10_000);
