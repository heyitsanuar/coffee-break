import { constants, type BigIntStats } from 'node:fs';
import { lstat, mkdir, open, realpath, readdir, rename, unlink, type FileHandle } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { demand, uuid, WorkflowError } from './contracts.js';

export function defaultStorageRoot(os = platform(), home = homedir()): string {
  if (os === 'darwin') return join(home, 'Library', 'Application Support', 'coffee-break-dev-orchestrator', 'v1', 'runs');
  if (os === 'linux') return join(home, '.local', 'state', 'coffee-break-dev-orchestrator', 'v1', 'runs');
  throw new WorkflowError('UNSUPPORTED_STORAGE_PLATFORM', 3);
}
export interface FileIdentity { dev: string; ino: string }
const identity = (stat: BigIntStats): FileIdentity => ({ dev: String(stat.dev), ino: String(stat.ino) });
export const sameFile = (a: FileIdentity, b: FileIdentity): boolean => a.dev === b.dev && a.ino === b.ino;
const inside = (root: string, path: string): boolean => { const part = relative(root, path); return part === '' || !isAbsolute(part) && !part.split(sep).includes('..'); };
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
function privateNode(stat: BigIntStats, directory: boolean): void {
  demand(typeof process.getuid === 'function', 'UNSUPPORTED_STORAGE_PLATFORM');
  demand(stat.uid === BigInt(process.getuid()) && (stat.mode & 0o077n) === 0n && (directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1n), 'UNSAFE_PATH');
}
async function chain(path: string, privateRoot: string): Promise<Array<{ path: string; identity: FileIdentity }>> {
  const root = parse(path).root; let current = root;
  const result: Array<{ path: string; identity: FileIdentity }> = [];
  for (const part of ['', ...relative(root, path).split(sep).filter(Boolean)]) {
    if (part) current = join(current, part);
    const stat = await lstat(current, { bigint: true });
    demand(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_PATH');
    if (inside(privateRoot, current)) privateNode(stat, true);
    result.push({ path: current, identity: identity(stat) });
  }
  demand(await realpath(path) === path, 'UNSAFE_PATH'); return result;
}
async function unchanged(before: Awaited<ReturnType<typeof chain>>, root: string): Promise<void> {
  const after = await chain(before[before.length - 1].path, root);
  demand(after.length === before.length && before.every((node, i) => sameFile(node.identity, after[i].identity)), 'DIRECTORY_CHANGED');
}
async function syncDirectory(path: string, expected: FileIdentity): Promise<void> {
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { demand(sameFile(identity(await handle.stat({ bigint: true })), expected), 'DIRECTORY_CHANGED'); await handle.sync(); }
  finally { await handle.close(); }
}
export async function writeAll(handle: FileHandle, bytes: Buffer): Promise<void> {
  let offset = 0;
  while (offset < bytes.length) { const result = await handle.write(bytes, offset, bytes.length - offset, null); demand(result.bytesWritten > 0, 'SHORT_WRITE'); offset += result.bytesWritten; }
}
// These checks target cooperative processes in owner-private local storage. They
// are deliberately not an atomic openat walk or a hostile same-user sandbox.
export class StoragePaths {
  readonly root: string;
  private readonly privacyRoot: string;
  constructor(root?: string) {
    const selected = root ?? defaultStorageRoot(); demand(isAbsolute(selected), 'UNSAFE_PATH'); this.root = resolve(selected);
    this.privacyRoot = root === undefined ? dirname(dirname(this.root)) : this.root;
  }
  async prepare(): Promise<void> {
    demand(typeof process.getuid === 'function' && constants.O_NOFOLLOW !== undefined, 'UNSUPPORTED_STORAGE_PLATFORM');
    const root = parse(this.root).root; let current = root;
    for (const part of relative(root, this.root).split(sep).filter(Boolean)) {
      current = join(current, part);
      const parent = await lstat(dirname(current), { bigint: true });
      let created = false;
      try { await mkdir(current, { mode: 0o700 }); created = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      const stat = await lstat(current, { bigint: true }); demand(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_PATH');
      if (inside(this.privacyRoot, current)) privateNode(stat, true);
      if (created) await syncDirectory(dirname(current), identity(parent));
    }
    await chain(this.root, this.privacyRoot);
  }
  async create(id: string): Promise<RunDirectory> {
    uuid(id); await this.prepare(); const before = await chain(this.root, this.privacyRoot);
    await mkdir(join(this.root, id), { mode: 0o700 }); await unchanged(before, this.privacyRoot);
    await syncDirectory(this.root, before[before.length - 1].identity);
    return this.open(id);
  }
  async open(id: string): Promise<RunDirectory> {
    uuid(id); const path = join(this.root, id); demand(inside(this.root, path), 'UNSAFE_PATH');
    const nodes = await chain(path, this.privacyRoot); return new RunDirectory(path, this.privacyRoot, nodes);
  }
}
export class RunDirectory {
  constructor(readonly path: string, private readonly root: string, private readonly anchor: Awaited<ReturnType<typeof chain>>) {}
  private filename(name: string): string {
    demand(/^(?:journal\.jsonl|snapshot\.json|writer\.lock|recovery\.lock|intent\.json|(?:snapshot\.tmp|snapshot\.corrupt|intent\.reconciled|artifact\.tmp|capture|report|preparation|admission)-[0-9a-f-]{36}\.json|blob-[a-f0-9]{64}\.bin|(?:bundle|job|projection)-[a-f0-9]{64}\.json)$/.test(name), 'UNSAFE_PATH');
    return join(this.path, name);
  }
  async verify(): Promise<void> { await unchanged(this.anchor, this.root); }
  async inspect(name: string): Promise<{ stat: BigIntStats; identity: FileIdentity } | null> {
    const path = this.filename(name); await this.verify();
    try { const stat = await lstat(path, { bigint: true }); privateNode(stat, false); return { stat, identity: identity(stat) }; }
    catch (error) { if (missing(error)) return null; throw error; }
  }
  private async descriptor(name: string, flags: number, existing: boolean): Promise<FileHandle> {
    const path = this.filename(name); const before = await this.inspect(name);
    demand(existing ? before !== null : before === null, existing ? 'FILE_MISSING' : 'FILE_EXISTS');
    const handle = await open(path, flags | constants.O_NOFOLLOW, 0o600);
    try {
      const stat = await handle.stat({ bigint: true }); privateNode(stat, false);
      demand(!before || sameFile(before.identity, identity(stat)), 'FILE_CHANGED'); await this.verify();
      const current = await this.inspect(name); demand(current && sameFile(identity(stat), current.identity), 'FILE_CHANGED');
      return handle;
    } catch (error) { await handle.close(); throw error; }
  }
  async create(name: string, bytes: Buffer, beforeSync?: (handle: FileHandle) => Promise<void>, beforeWrite?: (handle: FileHandle) => Promise<void>): Promise<FileIdentity> {
    const handle = await this.descriptor(name, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, false);
    try { await beforeWrite?.(handle); await writeAll(handle, bytes); await beforeSync?.(handle); await handle.sync(); return identity(await handle.stat({ bigint: true })); } finally { await handle.close(); }
  }
  async openAppend(name: string): Promise<FileHandle> { return this.descriptor(name, constants.O_WRONLY | constants.O_APPEND, true); }
  async read(name: string, limit: number): Promise<Buffer | null> {
    const found = await this.inspect(name); if (!found) return null;
    demand(found.stat.size <= BigInt(limit), 'RESOURCE_LIMIT');
    const handle = await this.descriptor(name, constants.O_RDONLY, true);
    try {
      const before = await handle.stat({ bigint: true }); const bytes = Buffer.alloc(limit + 1); let total = 0;
      while (total < bytes.length) { const read = await handle.read(bytes, total, bytes.length - total, null); if (!read.bytesRead) break; total += read.bytesRead; }
      demand(total <= limit, 'RESOURCE_LIMIT');
      const after = await handle.stat({ bigint: true });
      demand(before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs, 'CONCURRENT_CHANGE');
      const current = await this.inspect(name); demand(current && sameFile(identity(after), current.identity), 'FILE_CHANGED'); await this.verify();
      return bytes.subarray(0, total);
    } finally { await handle.close(); }
  }
  async remove(name: string, expected?: FileIdentity): Promise<void> {
    const found = await this.inspect(name); if (!found) return;
    demand(!expected || sameFile(found.identity, expected), 'FILE_CHANGED'); await this.verify(); await unlink(this.filename(name));
  }
  async move(from: string, to: string, replace = false): Promise<void> {
    demand(await this.inspect(from), 'FILE_MISSING'); const target = await this.inspect(to);
    demand(replace || !target, 'FILE_EXISTS'); await this.verify(); await rename(this.filename(from), this.filename(to)); await this.verify();
  }
  async sync(): Promise<void> {
    await this.verify(); await syncDirectory(this.path, this.anchor[this.anchor.length - 1].identity);
  }
  async entries(): Promise<Array<{ name: string; size: bigint }>> {
    await this.verify(); const entries: Array<{ name: string; size: bigint }> = [];
    for (const name of await readdir(this.path)) { const found = await this.inspect(name); demand(found, 'CONCURRENT_CHANGE'); entries.push({ name, size: found.stat.size }); }
    await this.verify(); return entries;
  }
  temporary(kind: 'snapshot.tmp' | 'snapshot.corrupt' | 'intent.reconciled' | 'artifact.tmp'): string { return `${kind}-${randomUUID()}.json`; }
}
