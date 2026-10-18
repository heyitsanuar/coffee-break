import { constants, type BigIntStats } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, parse, relative, sep } from 'node:path';
import { sha256 } from '../policy.js';
import { canonical, demand, object, uuid, version, WorkflowError } from '../workflow/contracts.js';
import { documentText, fullSha, INPUT_LIMITS, parseCore, parseIssue, parseScope, repositoryId, requirePilotInputs, safeRelative, strings, type BundleCore, type FileKind, type ImportedInput, type IssueSnapshot, type Scope, type SelectedFile } from './contracts.js';
import { compareBundles, prepareBundle, verifySelectedReferences, type PreparedBundle } from './bundle.js';
import { readIssue, runRead, type ReadExecutor } from './github.js';

export interface CaptureConfig { schemaVersion: 1; repository: string; story: { id: string; issue: number }; baselineSha: string; selected: Array<{ path: string; kind: FileKind; provenance: { origin: string; limitations: string[] } }>; imports: Array<Omit<ImportedInput, 'schemaVersion' | 'digest' | 'bytes'> & { path: string }>; scope: Scope }
export interface RepositoryReader { observe(root: string): Promise<{ head: string; status: string }>; read(root: string, sha: string, path: string): Promise<{ mode: string; bytes: Buffer }> }
export interface CaptureOptions { repository?: RepositoryReader; issue?: (repository: string, issue: number) => Promise<IssueSnapshot>; now?: () => string; signal?: AbortSignal }
const decode = (bytes: Buffer): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
export function gitRepository(execute: ReadExecutor = runRead): RepositoryReader {
  return {
    observe: async root => {
      demand(decode(await execute({ type: 'root', root })).trim() === root, 'REPOSITORY_ROOT_MISMATCH');
      const head = decode(await execute({ type: 'head', root })).trim(); fullSha(head);
      return { head, status: decode(await execute({ type: 'status', root })) };
    },
    read: async (root, sha, path) => {
      safeRelative(path); fullSha(sha);
      const entry = decode(await execute({ type: 'tree', root, sha, path }));
      demand(entry.length > 0, 'SOURCE_FILE_MISSING');
      const match = /^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})\t([^\0]+)\0$/.exec(entry);
      demand(match && match[3] === path, 'GIT_MODE_OR_PATH_UNSUPPORTED');
      const bytes = await execute({ type: 'blob', root, sha: match[2] }); demand(bytes.length <= INPUT_LIMITS.object, 'RESOURCE_LIMIT'); return { mode: match[1], bytes };
    },
  };
}
const same = (a: BigIntStats, b: BigIntStats): boolean => a.dev === b.dev && a.ino === b.ino && a.mode === b.mode && a.uid === b.uid && (a.isDirectory() && b.isDirectory() || a.nlink === b.nlink && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs);
export async function readInputFile(path: string, limit: number): Promise<Buffer> {
  try { return await checkedInputFile(path, limit); }
  catch (error) {
    if (error instanceof WorkflowError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    throw new WorkflowError(code === 'ENOENT' ? 'INPUT_FILE_MISSING' : code === 'EACCES' || code === 'EPERM' ? 'INPUT_FILE_UNREADABLE' : 'INPUT_READ_FAILED');
  }
}
async function checkedInputFile(path: string, limit: number): Promise<Buffer> {
  demand(isAbsolute(path) && !/[\\\x00-\x1f]/.test(path), 'UNSAFE_PATH');
  const selected = relative(parse(path).root, path); safeRelative(selected); const parts = selected.split(sep);
  const inspect = async (): Promise<Array<{ path: string; stat: BigIntStats }>> => {
    const nodes: Array<{ path: string; stat: BigIntStats }> = []; let current = parse(path).root;
    for (let i = -1; i < parts.length; i++) {
      if (i >= 0) current = join(current, parts[i]); const stat = await lstat(current, { bigint: true });
      demand(!stat.isSymbolicLink() && (i === parts.length - 1 ? stat.isFile() && stat.nlink === 1n : stat.isDirectory()), 'UNSAFE_PATH'); nodes.push({ path: current, stat });
    }
    demand(await realpath(path) === path, 'UNSAFE_PATH'); return nodes;
  };
  const before = await inspect(); const last = before.at(-1)!; demand(last.stat.size <= BigInt(limit), 'RESOURCE_LIMIT');
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const verify = async (): Promise<void> => { const after = await inspect(); demand(after.length === before.length && before.every((n, i) => same(n.stat, after[i].stat)), 'SOURCE_CHANGED'); };
  try {
    demand(same(last.stat, await handle.stat({ bigint: true })), 'SOURCE_CHANGED'); await verify();
    const data = Buffer.alloc(limit + 1); let length = 0;
    while (length < data.length) { const result = await handle.read(data, length, data.length - length, null); if (!result.bytesRead) break; length += result.bytesRead; }
    demand(length <= limit, 'RESOURCE_LIMIT'); demand(same(last.stat, await handle.stat({ bigint: true })), 'SOURCE_CHANGED'); await verify(); return data.subarray(0, length);
  } finally { await handle.close(); }
}
export function parseConfig(value: unknown): CaptureConfig {
  canonical(value, INPUT_LIMITS.manifest); const o = object(value, ['schemaVersion', 'repository', 'story', 'baselineSha', 'selected', 'imports', 'scope']); version(o.schemaVersion); repositoryId(o.repository); fullSha(o.baselineSha); parseScope(o.scope);
  const story = object(o.story, ['id', 'issue']); documentText(story.id, 256); demand(Number.isSafeInteger(story.issue) && Number(story.issue) > 0);
  demand(Array.isArray(o.selected) && o.selected.length > 0 && o.selected.length <= INPUT_LIMITS.files, 'RESOURCE_LIMIT');
  for (const value of o.selected) { const s = object(value, ['path', 'kind', 'provenance']); safeRelative(s.path); demand(['source', 'static_design', 'manifest', 'policy', 'template'].includes(String(s.kind)), 'UNSUPPORTED_REFERENCE'); const p = object(s.provenance, ['origin', 'limitations']); documentText(p.origin, 4096); strings(p.limitations); }
  demand(new Set((o.selected as CaptureConfig['selected']).map(s => s.path)).size === o.selected.length, 'DUPLICATE_PATH');
  demand(Array.isArray(o.imports) && o.imports.length === 2, 'IMPORTS_REQUIRED');
  for (const value of o.imports) { const i = object(value, ['kind', 'path', 'origin', 'basisSha', 'limitations', 'compatibility']); documentText(i.path, 4096); demand(isAbsolute(i.path), 'UNSAFE_PATH'); documentText(i.origin, 4096); fullSha(i.basisSha); strings(i.limitations); object(i.compatibility, ['mode', 'policyDigest', 'rationale']); }
  return structuredClone(value) as CaptureConfig;
}
export async function captureInputs(raw: CaptureConfig, runId: string, root: string, options: CaptureOptions = {}): Promise<PreparedBundle> {
  const config = parseConfig(raw); uuid(runId); demand(!options.signal?.aborted, 'CAPTURE_INTERRUPTED');
  demand(isAbsolute(root), 'UNSAFE_PATH'); let canonicalRoot: string;
  try { canonicalRoot = await realpath(root); } catch { throw new WorkflowError('REPOSITORY_ROOT_UNAVAILABLE'); }
  demand(canonicalRoot === root, 'UNSAFE_PATH');
  const execute: ReadExecutor = op => runRead(op, { signal: options.signal });
  const repo = options.repository ?? gitRepository(execute); const before = await repo.observe(root);
  demand(before.head === config.baselineSha, 'BASELINE_CHANGED'); demand(before.status === '', 'DIRTY_CHECKOUT');
  const blobs = new Map<string, Buffer>(); const files: SelectedFile[] = []; const observed = new Map<string, string>(); let total = 0;
  for (const selected of config.selected) {
    const committed = await repo.read(root, config.baselineSha, selected.path); demand(['100644', '100755'].includes(committed.mode), 'GIT_MODE_OR_PATH_UNSUPPORTED'); demand(committed.bytes.length <= INPUT_LIMITS.object, 'RESOURCE_LIMIT');
    total += committed.bytes.length; demand(total <= INPUT_LIMITS.bundle, 'RESOURCE_LIMIT');
    const working = await readInputFile(join(root, selected.path), INPUT_LIMITS.object); const digest = sha256(committed.bytes); demand(working.equals(committed.bytes), 'SOURCE_CHANGED');
    files.push({ ...selected, sourceSha: config.baselineSha, bytes: committed.bytes.length, digest }); blobs.set(digest, Buffer.from(committed.bytes)); observed.set(join(root, selected.path), digest);
    demand([...blobs.values()].reduce((n, b) => n + b.length, 0) <= INPUT_LIMITS.bundle, 'RESOURCE_LIMIT');
  }
  const imports: ImportedInput[] = [];
  for (const item of config.imports) {
    const data = await readInputFile(item.path, INPUT_LIMITS.imported); const digest = sha256(data); blobs.set(digest, data); observed.set(item.path, digest);
    total += data.length; demand(total <= INPUT_LIMITS.bundle, 'RESOURCE_LIMIT');
    imports.push({ schemaVersion: 1, kind: item.kind, origin: item.origin, basisSha: item.basisSha, limitations: item.limitations, compatibility: item.compatibility, digest, bytes: data.length });
  }
  const issue = parseIssue(await (options.issue ?? ((repository, issue) => readIssue(repository, issue, execute)))(config.repository, config.story.issue));
  const core = parseCore({ schemaVersion: 1, kind: 'scope-bundle', repository: config.repository, story: config.story, baselineSha: config.baselineSha, checkout: { clean: true }, issue, files: files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0), imports: imports.sort((a, b) => a.kind < b.kind ? -1 : 1), scope: config.scope, applicable: files.filter(f => f.kind === 'policy' || f.kind === 'template').map(f => ({ kind: f.kind, path: f.path, digest: f.digest })) });
  verifySelectedReferences(core, blobs); requirePilotInputs(core);
  for (const [path, digest] of observed) demand(sha256(await readInputFile(path, config.imports.some(i => i.path === path) ? INPUT_LIMITS.imported : INPUT_LIMITS.object)) === digest, 'SOURCE_CHANGED');
  const after = await repo.observe(root); demand(after.head === before.head && after.status === '', 'SOURCE_CHANGED');
  demand(!options.signal?.aborted, 'CAPTURE_INTERRUPTED');
  return prepareBundle(core, blobs, { runId, root, capturedAt: (options.now ?? (() => new Date().toISOString()))(), issueAdapter: options.issue ? 'injected-read/v1' : 'gh-read/v1' });
}
export async function verifyFreshness(original: BundleCore, config: CaptureConfig, runId: string, root: string, options: CaptureOptions = {}): Promise<{ status: 'fresh' | 'drift' | 'unverified'; changed: string[]; code: string }> {
  parseCore(original);
  try { const current = await captureInputs(config, runId, root, options); const result = compareBundles(original, current.core); return { ...result, code: result.status === 'fresh' ? 'FRESH' : 'INPUT_DRIFT' }; }
  catch (error) { const code = error instanceof WorkflowError ? error.code : 'FRESHNESS_UNAVAILABLE'; return { status: ['BASELINE_CHANGED', 'DIRTY_CHECKOUT', 'SOURCE_CHANGED'].includes(code) ? 'drift' : 'unverified', changed: [], code }; }
}
