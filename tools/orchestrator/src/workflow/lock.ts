import { readFile } from 'node:fs/promises';
import { hostname, platform } from 'node:os';
import { randomUUID } from 'node:crypto';
import { canonical, demand, integer, LIMITS, object, text, timestamp, uuid, version, WorkflowError } from './contracts.js';
import { sameFile, type FileIdentity, type RunDirectory } from './paths.js';

export interface ProcessIdentity { pid: number; uid: number; host: string; bootId: string | null; processStartedAt: string }
export interface Owner extends ProcessIdentity { schemaVersion: 1; token: string; createdAt: string }
export interface LockEnvironment {
  identity(): Promise<ProcessIdentity>;
  exists(pid: number): 'present' | 'absent' | 'unknown' | Promise<'present' | 'absent' | 'unknown'>;
  now(): string;
}
let bootIdentity: Promise<string | null> | undefined;
async function boot(): Promise<string | null> {
  try {
    // Recovery must not launch even an OS metadata helper. Node has no portable
    // macOS boot-session API: leave it unknown rather than spawning sysctl or
    // treating an approximate wall-clock/uptime estimate as stable identity.
    const value = platform() === 'linux' ? (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim() : '';
    return /^[0-9a-f-]{36}$/i.test(value) ? value.toLowerCase() : null;
  } catch { return null; }
}
export const localLockEnvironment: LockEnvironment = {
  identity: async () => ({ pid: process.pid, uid: process.getuid?.() ?? -1, host: hostname(), bootId: await (bootIdentity ??= boot()), processStartedAt: new Date(performance.timeOrigin).toISOString() }),
  exists: pid => { try { process.kill(pid, 0); return 'present'; } catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH' ? 'absent' : 'unknown'; } },
  now: () => new Date().toISOString(),
};
function parseOwner(value: unknown): Owner {
  const o = object(value, ['schemaVersion', 'token', 'pid', 'uid', 'host', 'bootId', 'processStartedAt', 'createdAt']);
  version(o.schemaVersion); uuid(o.token); integer(o.pid); integer(o.uid); demand(o.pid > 0); text(o.host);
  if (o.bootId !== null) text(o.bootId); timestamp(o.processStartedAt); timestamp(o.createdAt); demand(o.processStartedAt <= o.createdAt, 'LOCK_OWNER_AMBIGUOUS');
  return value as Owner;
}
export async function readLock(dir: RunDirectory, name: 'writer.lock' | 'recovery.lock' = 'writer.lock'): Promise<{ owner: Owner; identity: FileIdentity } | null> {
  const before = await dir.inspect(name); if (!before) return null;
  const bytes = await dir.read(name, LIMITS.lock); demand(bytes, 'LOCK_CHANGED');
  let owner: Owner;
  try { owner = parseOwner(JSON.parse(bytes.toString('utf8'))); }
  catch (error) { if (error instanceof WorkflowError && error.code === 'UNSUPPORTED_SCHEMA') throw error; throw new WorkflowError('LOCK_METADATA_INVALID'); }
  const after = await dir.inspect(name); demand(after && sameFile(before.identity, after.identity), 'LOCK_CHANGED');
  return { owner, identity: before.identity };
}
export async function acquire(dir: RunDirectory, environment = localLockEnvironment, name: 'writer.lock' | 'recovery.lock' = 'writer.lock'): Promise<{ owner: Owner; release(): Promise<void> }> {
  const owner = parseOwner({ schemaVersion: 1, token: randomUUID(), ...await environment.identity(), createdAt: environment.now() });
  let identity: FileIdentity;
  try { identity = await dir.create(name, Buffer.from(canonical(owner))); }
  catch (error) { if (error instanceof WorkflowError && error.code === 'FILE_EXISTS' || (error as NodeJS.ErrnoException).code === 'EEXIST') throw new WorkflowError('LOCK_BUSY'); throw error; }
  await dir.sync();
  return { owner, release: async () => {
    const current = await readLock(dir, name);
    demand(current && sameFile(identity, current.identity) && current.owner.token === owner.token, 'LOCK_CHANGED');
    await dir.remove(name, identity); await dir.sync();
  } };
}
export async function reconcileLock(dir: RunDirectory, token: string, environment = localLockEnvironment): Promise<void> {
  const guard = await acquire(dir, environment, 'recovery.lock');
  try {
    const observed = await readLock(dir); demand(observed && observed.owner.token === token, 'LOCK_CHANGED');
    const current = await environment.identity(); const owner = observed.owner;
    // PID absence is insufficient: require explicit token/inode observation and
    // matching host, UID and independently read boot session. A reused PID or
    // unavailable identity causes conservative refusal, never an override.
    demand(current.host === owner.host && current.uid === owner.uid && current.bootId !== null && current.bootId === owner.bootId && owner.processStartedAt <= owner.createdAt && owner.createdAt <= environment.now(), 'LOCK_OWNER_AMBIGUOUS');
    demand(await environment.exists(owner.pid) === 'absent', 'LOCK_OWNER_AMBIGUOUS');
    const checked = await readLock(dir);
    demand(checked && checked.owner.token === token && sameFile(observed.identity, checked.identity) && canonical(checked.owner) === canonical(owner), 'LOCK_CHANGED');
    demand(await environment.exists(owner.pid) === 'absent', 'LOCK_OWNER_AMBIGUOUS');
    await dir.remove('writer.lock', observed.identity); await dir.sync();
  } finally { await guard.release(); }
}
