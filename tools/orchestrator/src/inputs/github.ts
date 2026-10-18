import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { constants } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { demand, integer, object, WorkflowError } from '../workflow/contracts.js';
import { fullSha, INPUT_LIMITS, parseIssue, repositoryId, safeRelative, type IssueSnapshot } from './contracts.js';

export type ReadOperation = { type: 'issue'; repository: string; issue: number } | { type: 'root'; root: string } | { type: 'head'; root: string } | { type: 'status'; root: string } | { type: 'tree'; root: string; sha: string; path: string } | { type: 'blob'; root: string; sha: string };
type GitMetadata = { type: 'metadata'; root: string };
type ReadOptions = { spawn?: typeof nodeSpawn; timeoutMs?: number; outputBytes?: number; signal?: AbortSignal };
interface ReadPlan { executable: 'gh' | 'git'; args: string[]; cwd: string; limit: number }
export type ReadExecutor = (operation: ReadOperation) => Promise<Buffer>;
export function controllerEnvironment(program: 'gh' | 'git', source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const common = { PATH: source.PATH ?? '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', NO_COLOR: '1' };
  // Only gh receives the host's normal home/config location. Tokens, alternate
  // config paths, proxies and injection variables are not forwarded. This is
  // trusted controller authentication, not an agent sandbox or read-only token.
  return program === 'gh' ? { ...common, HOME: homedir(), GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GH_PAGER: 'cat' }
    : { ...common, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_ATTR_NOSYSTEM: '1' };
}
export function readPlan(op: ReadOperation): ReadPlan {
  demand(op.type !== 'status', 'READ_GIT_ISOLATION_REQUIRED');
  return planRead(op);
}
function planRead(op: ReadOperation | GitMetadata): ReadPlan {
  if (op.type === 'issue') {
    object(op, ['type', 'repository', 'issue']); repositoryId(op.repository); integer(op.issue); demand(op.issue > 0, 'ISSUE_MISMATCH');
    return { executable: 'gh', args: ['issue', 'view', String(op.issue), '--repo', op.repository, '--json', 'number,url,title,body,state'], cwd: '/', limit: INPUT_LIMITS.issue };
  }
  demand(['root', 'head', 'status', 'tree', 'blob', 'metadata'].includes(op.type), 'READ_OPERATION_UNSUPPORTED');
  const fields = op.type === 'tree' ? ['type', 'root', 'sha', 'path'] : op.type === 'blob' ? ['type', 'root', 'sha'] : ['type', 'root']; object(op, fields);
  demand(typeof op.root === 'string' && op.root.startsWith('/') && !/[\x00-\x1f]/.test(op.root), 'UNSAFE_PATH');
  let command: string[];
  if (op.type === 'root') command = ['rev-parse', '--show-toplevel'];
  else if (op.type === 'head') command = ['rev-parse', '--verify', 'HEAD'];
  else if (op.type === 'status') command = ['status', '--porcelain=v1', '--untracked-files=all', '-z'];
  else if (op.type === 'metadata') command = ['rev-parse', '--absolute-git-dir', '--path-format=absolute', '--git-common-dir', '--show-object-format'];
  else if (op.type === 'tree') { fullSha(op.sha); safeRelative(op.path); command = ['ls-tree', '-z', '--full-tree', op.sha, '--', op.path]; }
  else { fullSha(op.sha); command = ['cat-file', 'blob', op.sha]; }
  return { executable: 'git', args: ['--no-optional-locks', '--no-replace-objects', '--no-lazy-fetch', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'core.untrackedCache=false', ...command], cwd: op.root, limit: op.type === 'blob' ? INPUT_LIMITS.object : INPUT_LIMITS.manifest };
}
export function runRead(op: ReadOperation, options: ReadOptions = {}): Promise<Buffer> {
  const plan = planRead(op);
  return op.type === 'status' ? isolatedStatus(op.root, options) : executeRead(plan, options);
}
// No worktree-inspecting command runs with repository configuration. Copy only
// inert metadata into a private Git directory, never config, hooks or attributes.
// Local filters cannot race this isolation: their definitions are never loaded.
async function isolatedStatus(root: string, options: ReadOptions): Promise<Buffer> {
  let scratch: string | undefined; const deadline = Date.now() + Math.min(options.timeoutMs ?? 30_000, 30_000);
  const read = (plan: ReadPlan, env: NodeJS.ProcessEnv = {}) => {
    demand(Date.now() < deadline, 'READ_TIMEOUT');
    return executeRead(plan, { ...options, timeoutMs: deadline - Date.now() }, env);
  };
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(await read(planRead({ type: 'metadata', root })));
    const values = decoded.split('\n'); demand(values.length === 4 && values[3] === '', 'READ_GIT_ISOLATION_UNVERIFIED');
    const [gitDir, commonDir, format] = values;
    demand([gitDir, commonDir].every(path => isAbsolute(path) && !/[\\\x00-\x1f]/.test(path)) && ['sha1', 'sha256'].includes(format), 'READ_GIT_ISOLATION_UNVERIFIED');
    // Derive metadata names rather than --git-path's resolved targets, so a
    // symlinked index/exclude cannot bypass descriptor/type checks.
    demand(await realpath(gitDir) === gitDir && await realpath(commonDir) === commonDir, 'READ_GIT_ISOLATION_UNVERIFIED');
    const index = join(gitDir, 'index'), objects = join(commonDir, 'objects'), excludes = join(commonDir, 'info/exclude');
    demand(await realpath(objects) === objects && (await lstat(objects)).isDirectory(), 'READ_GIT_ISOLATION_UNVERIFIED');
    const indexBytes = await metadataBytes(index); const excludeBytes = await metadataBytes(excludes, true);
    const head = new TextDecoder('utf-8', { fatal: true }).decode(await read(planRead({ type: 'head', root }))).trim(); fullSha(head);
    demand(head.length === (format === 'sha1' ? 40 : 64), 'READ_GIT_ISOLATION_UNVERIFIED');
    scratch = await realpath(await mkdtemp(join(tmpdir(), 'cb-git-observation-')));
    for (const name of ['objects', 'refs', 'info']) await mkdir(join(scratch, name), { mode: 0o700 });
    const put = (path: string, data: Buffer | string) => writeFile(join(scratch!, path), data, { mode: 0o600, flag: 'wx' });
    await put('config', `[core]\nrepositoryformatversion=${format === 'sha1' ? 0 : 1}\nbare=false\n${format === 'sha256' ? '[extensions]\nobjectformat=sha256\n' : ''}`);
    await put('HEAD', head + '\n'); await put('index', indexBytes!); if (excludeBytes) await put('info/exclude', excludeBytes);
    const base = planRead({ type: 'status', root });
    const prefix = [`--git-dir=${scratch}`, `--work-tree=${root}`, ...base.args.slice(0, base.args.indexOf('status')), '-c', 'core.attributesFile=/dev/null', '-c', 'core.excludesFile=/dev/null'];
    const env = { GIT_OBJECT_DIRECTORY: objects };
    const entries = new TextDecoder('utf-8', { fatal: true }).decode(await read({ ...base, args: [...prefix, 'ls-files', '--stage', '-v', '-z'], limit: INPUT_LIMITS.object }, env));
    // Submodule status can recurse into another repository's configuration;
    // sparse/split indexes need metadata not represented by this bounded view.
    demand(entries === '' || entries.endsWith('\0'), 'READ_GIT_ISOLATION_UNVERIFIED');
    for (const entry of entries.split('\0').slice(0, -1)) {
      const match = /^([A-Za-z]) (100644|100755|120000) ([a-f0-9]{40}(?:[a-f0-9]{24})?) ([0-3])\t[^\0]+$/.exec(entry);
      demand(match && match[3].length === head.length, 'READ_GIT_ISOLATION_UNVERIFIED');
      // -v lowercases assume-unchanged tags; S/s denotes skip-worktree.
      // Inspect every index entry before status can trust a suppressed check.
      demand(!['h', 'S', 's'].includes(match[1]), 'READ_GIT_INDEX_FLAGS_UNSUPPORTED');
      demand(match[1] === 'H' && match[4] === '0', 'READ_GIT_ISOLATION_UNVERIFIED');
    }
    return await read({ ...base, args: [...prefix, 'status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=all', '-z'] }, env);
  } catch (error) {
    if (error instanceof WorkflowError && /^READ_(TIMEOUT|INTERRUPTED|OUTPUT_LIMIT|CLEANUP_UNVERIFIED|GIT_INDEX_FLAGS_UNSUPPORTED)$/.test(error.code)) throw error;
    throw new WorkflowError('READ_GIT_ISOLATION_UNVERIFIED');
  } finally {
    if (scratch) { try { await rm(scratch, { recursive: true }); } catch { throw new WorkflowError('READ_CLEANUP_UNVERIFIED'); } }
  }
}
async function metadataBytes(path: string, optional = false): Promise<Buffer | null> {
  try {
    const before = await lstat(path, { bigint: true });
    demand(before.isFile() && before.nlink === 1n && before.size <= BigInt(INPUT_LIMITS.object) && await realpath(path) === path, 'READ_GIT_ISOLATION_UNVERIFIED');
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const same = (stat: typeof before) => before.dev === stat.dev && before.ino === stat.ino && before.mode === stat.mode && before.nlink === stat.nlink && before.size === stat.size && before.mtimeNs === stat.mtimeNs && before.ctimeNs === stat.ctimeNs;
      demand(same(await handle.stat({ bigint: true })), 'READ_GIT_ISOLATION_UNVERIFIED');
      const data = Buffer.alloc(Number(before.size) + 1); let size = 0;
      while (size < data.length) { const next = await handle.read(data, size, data.length - size, null); if (!next.bytesRead) break; size += next.bytesRead; }
      demand(size === Number(before.size) && same(await handle.stat({ bigint: true })) && same(await lstat(path, { bigint: true })) && await realpath(path) === path, 'READ_GIT_ISOLATION_UNVERIFIED');
      return data.subarray(0, size);
    } finally { await handle.close(); }
  } catch (error) { if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
function executeRead(plan: ReadPlan, options: ReadOptions, extraEnvironment: NodeJS.ProcessEnv = {}): Promise<Buffer> {
  const limit = Math.min(plan.limit, options.outputBytes ?? plan.limit);
  if (options.signal?.aborted) return Promise.reject(new WorkflowError('READ_INTERRUPTED'));
  return new Promise((resolve, reject) => {
    let child: ChildProcess; let failure: string | null = null; let size = 0; let closed = false; let finished = false; const chunks: Buffer[] = [];
    let killTimer: ReturnType<typeof setTimeout> | undefined; let poll: ReturnType<typeof setTimeout> | undefined;
    const exists = (): boolean => { if (!child?.pid) return false; try { process.kill(-child.pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; } };
    const signal = (value: NodeJS.Signals): void => { if (child?.pid) { try { process.kill(-child.pid, value); } catch { /* verified below */ } } };
    const finish = (): void => {
      if (finished) return; finished = true; clearTimeout(deadline); clearTimeout(killTimer); clearTimeout(poll); options.signal?.removeEventListener('abort', abort);
      if (failure) reject(new WorkflowError(failure)); else resolve(Buffer.concat(chunks));
    };
    const stop = (code: string): void => {
      failure ??= code; if (killTimer) return; signal('SIGTERM');
      killTimer = setTimeout(() => { signal('SIGKILL'); const until = Date.now() + 3000;
        const check = (): void => { if (!exists() && closed) finish(); else if (Date.now() >= until) { failure = 'READ_CLEANUP_UNVERIFIED'; finish(); } else poll = setTimeout(check, 20); }; check();
      }, child?.pid ? 3000 : 0);
    };
    const abort = (): void => stop('READ_INTERRUPTED');
    const deadline = setTimeout(() => stop('READ_TIMEOUT'), Math.min(options.timeoutMs ?? 30_000, 30_000));
    try { child = (options.spawn ?? nodeSpawn)(plan.executable, plan.args, { cwd: plan.cwd, env: { ...controllerEnvironment(plan.executable), ...extraEnvironment }, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { failure = 'READ_SPAWN_FAILED'; finish(); return; }
    options.signal?.addEventListener('abort', abort, { once: true });
    child.stdout!.on('data', (chunk: Buffer) => { size += chunk.length; if (size > limit) stop('READ_OUTPUT_LIMIT'); else if (!failure) chunks.push(Buffer.from(chunk)); });
    child.stderr!.on('data', (chunk: Buffer) => { size += chunk.length; if (size > limit) stop('READ_OUTPUT_LIMIT'); });
    child.on('error', () => { closed = true; failure = 'READ_SPAWN_FAILED'; if (exists()) stop(failure); else finish(); });
    child.on('close', (code, sig) => { closed = true; if (code !== 0 || sig) failure ??= 'READ_FAILED'; if (exists()) stop('READ_CHILD_SURVIVED'); else finish(); });
    if (options.signal?.aborted) abort();
  });
}
export async function readIssue(repository: string, issue: number, execute: ReadExecutor = runRead): Promise<IssueSnapshot> {
  repositoryId(repository); integer(issue); demand(issue > 0, 'ISSUE_MISMATCH');
  try {
    const bytes = await execute({ type: 'issue', repository, issue }); demand(bytes.length <= INPUT_LIMITS.issue, 'RESOURCE_LIMIT');
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const raw = object(value, ['number', 'url', 'title', 'body', 'state']); demand(raw.number === issue && raw.url === `https://github.com/${repository}/issues/${issue}`, 'ISSUE_MISMATCH');
    return parseIssue({ repository, ...raw });
  } catch (error) { if (error instanceof WorkflowError) throw error; throw new WorkflowError('ISSUE_READ_FAILED'); }
}
