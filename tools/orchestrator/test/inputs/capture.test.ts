import { mkdtemp, realpath, rm, writeFile, mkdir, symlink, link, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import type { MockInstance } from 'vitest';
vi.mock('node:fs/promises', async original => { const value = await original<typeof fs>(); return { ...value, open: vi.fn(value.open) }; });
import { parseIssue } from '../../src/inputs/contracts.js';
import { captureInputs, verifyFreshness, readInputFile, gitRepository, type CaptureConfig } from '../../src/inputs/capture.js';
import { issue, sha, bytes, filterRepositoryFixture } from './fixtures.js';
import { fingerprint } from '../../src/inputs/bundle.js';
import { sha256 } from '../../src/policy.js';
import { WorkflowStore } from '../../src/workflow/store.js';
import { event } from '../workflow/fixtures.js';
import { bundleReference } from '../../src/inputs/bundle.js';

export async function captureFixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-input-capture-')));
  await writeFile(join(root, 'policy.md'), bytes); await writeFile(join(root, 'import.md'), bytes);
  const config: CaptureConfig = { schemaVersion: 1, repository: 'owner/repo', story: { id: 'TEST-1', issue: 7 }, baselineSha: sha, selected: [{ path: 'policy.md', kind: 'policy', provenance: { origin: 'fixture', limitations: [] } }], imports: ['developer_discovery', 'planner_scope'].map(kind => ({ kind, path: join(root, 'import.md'), origin: 'fixture', basisSha: sha, limitations: [], compatibility: { mode: 'exact', policyDigest: null, rationale: '' } })) as CaptureConfig['imports'], scope: { allowedChanges: ['src/a.ts'], nonGoals: ['No execution'], validationPlan: ['test'], unresolvedDecisions: [] } };
  const repository = { observe: vi.fn(async () => ({ head: sha, status: '' })), read: vi.fn(async () => ({ mode: '100644', bytes: Buffer.from(bytes) })) };
  return { root, config, repository, options: { repository, issue: vi.fn(async () => issue()), now: () => '2026-10-17T12:00:00.000Z' }, clean: () => rm(root, { recursive: true, force: true }) };
}
const runId = '11111111-1111-4111-8111-111111111111';
it.each([
  ['assume-unchanged', ['--assume-unchanged'], 'clean'],
  ['skip-worktree', ['--skip-worktree'], 'process'],
  ['both flags', ['--assume-unchanged', '--skip-worktree'], 'process'],
] as const)('rejects %s on a modified unselected tracked file without changing the index or existing bundle', async (_label, flags, kind) => {
  const f = await filterRepositoryFixture(kind);
  try {
    const options = { repository: gitRepository(f.execute), issue: async () => issue() };
    const existing = await captureInputs(f.config, runId, f.root, options); const reference = bundleReference(existing.core);
    const storageRoot = join(f.base, 'runs'); const store = new WorkflowStore(storageRoot);
    expect((await store.create(event('run.created', { repository: { id: f.config.repository, root: f.root }, story: f.config.story, baselineSha: f.config.baselineSha }))).exitCode).toBe(0);
    expect((await store.publishInputs(runId, 1, existing)).exitCode).toBe(0);
    expect((await store.attachInputs(runId, 1, reference, 'accept')).exitCode).toBe(0);
    const retained = async () => { const dir = join(storageRoot, runId); return Promise.all((await fs.readdir(dir)).sort().map(async name => [name, (await fs.readFile(join(dir, name))).toString('base64')])); };
    const beforeBundle = await retained(); const beforeFingerprint = fingerprint(existing.core);
    expect(f.config.selected.some(file => file.path === 'unselected.md')).toBe(false);
    for (const flag of flags) await f.flagUnselected(flag);
    await writeFile(join(f.root, 'unselected.md'), 'unselected changed\n');
    const beforeIndex = await fs.readFile(join(f.root, '.git/index')); const beforeCalls = f.calls.length;
    // Collect all three outcomes before asserting, so the red run exercises
    // false-clean observation, false capture and false freshness independently.
    const [observed, captured, fresh] = await Promise.allSettled([
      options.repository.observe(f.root), captureInputs(f.config, runId, f.root, options), verifyFreshness(existing.core, f.config, runId, f.root, options),
    ]);
    for (const result of [observed, captured]) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'READ_GIT_INDEX_FLAGS_UNSUPPORTED' });
    }
    expect(fresh).toMatchObject({ status: 'fulfilled', value: { status: 'unverified', code: 'READ_GIT_INDEX_FLAGS_UNSUPPORTED' } });
    expect(f.calls.slice(beforeCalls).some(args => args.includes('status'))).toBe(false);
    expect(await fs.readFile(join(f.root, '.git/index'))).toEqual(beforeIndex);
    expect(await retained()).toEqual(beforeBundle); expect(fingerprint(existing.core)).toBe(beforeFingerprint);
    expect((await store.verifyInputs(runId)).core).toEqual(existing.core);
  } finally { await f.clean(); }
});
it.each(['clean', 'process'] as const)('captures and checks freshness without invoking local filter.%s', async kind => {
  const f = await filterRepositoryFixture(kind);
  try {
    const options = { repository: gitRepository(f.execute), issue: async () => issue() };
    const captured = await captureInputs(f.config, runId, f.root, options);
    expect(captured.blobs.get(sha256(bytes))).toEqual(bytes);
    expect(await verifyFreshness(captured.core, f.config, runId, f.root, options)).toMatchObject({ status: 'fresh' });
    await writeFile(join(f.root, '.gitattributes'), 'policy.md filter=other\n');
    await expect(captureInputs(f.config, runId, f.root, options)).rejects.toThrow('DIRTY_CHECKOUT');
    expect(await verifyFreshness(captured.core, f.config, runId, f.root, options)).toMatchObject({ status: 'drift', code: 'DIRTY_CHECKOUT' });
    await writeFile(join(f.root, '.gitattributes'), 'policy.md filter=sentinel\n'); await writeFile(join(f.root, 'new.txt'), 'untracked');
    await expect(captureInputs(f.config, runId, f.root, options)).rejects.toThrow('DIRTY_CHECKOUT');
    expect(await verifyFreshness(captured.core, f.config, runId, f.root, options)).toMatchObject({ status: 'drift', code: 'DIRTY_CHECKOUT' });
    await rm(join(f.root, 'new.txt')); await rename(join(f.root, '.git/index'), join(f.base, 'preserved-index'));
    await expect(captureInputs(f.config, runId, f.root, options)).rejects.toThrow('READ_GIT_ISOLATION_UNVERIFIED');
    expect(await verifyFreshness(captured.core, f.config, runId, f.root, options)).toMatchObject({ status: 'unverified', code: 'READ_GIT_ISOLATION_UNVERIFIED' });
  } finally { await f.clean(); }
});
it('captures pinned bytes and exact imports and checks all mutable sources twice', async () => {
  const f = await captureFixture();
  try {
    const result = await captureInputs(f.config, runId, f.root, f.options);
    expect(result.blobs.get(sha256(bytes))).toEqual(bytes); expect(result.capture.checkout).toEqual({ clean: true, head: sha });
    expect(f.repository.read).toHaveBeenCalledWith(f.root, sha, 'policy.md'); expect(f.repository.observe).toHaveBeenCalledTimes(2);
    expect((await verifyFreshness(result.core, f.config, runId, f.root, f.options)).status).toBe('fresh');
    f.options.issue.mockResolvedValue({ ...issue(), title: 'Changed' });
    expect((await verifyFreshness(result.core, f.config, runId, f.root, f.options)).status).toBe('drift');
    f.options.issue.mockRejectedValue(new Error('offline'));
    expect((await verifyFreshness(result.core, f.config, runId, f.root, f.options)).status).toBe('unverified');
  } finally { await f.clean(); }
});
it.each(['dirty', 'untracked', 'head', 'during', 'bytes', 'mode', 'imports'])('blocks %s without creating artifacts', async mode => {
  const f = await captureFixture();
  try {
    if (mode === 'dirty' || mode === 'untracked') f.repository.observe.mockResolvedValue({ head: sha, status: mode === 'dirty' ? ' M policy.md\0' : '?? new.txt\0' });
    if (mode === 'head') f.repository.observe.mockResolvedValue({ head: 'b'.repeat(40), status: '' });
    if (mode === 'during') f.repository.observe.mockResolvedValueOnce({ head: sha, status: '' }).mockResolvedValue({ head: 'b'.repeat(40), status: '' });
    if (mode === 'bytes') f.repository.read.mockResolvedValue({ mode: '100644', bytes: Buffer.from('changed') });
    if (mode === 'mode') f.repository.read.mockResolvedValue({ mode: '120000', bytes });
    if (mode === 'imports') f.config.imports = [];
    await expect(captureInputs(f.config, runId, f.root, f.options)).rejects.toThrow();
  } finally { await f.clean(); }
});
it('requires explicit historical basis policy and blocks the actual US-037 pilot', async () => {
  const f = await captureFixture();
  try {
    f.config.imports[0].basisSha = 'b'.repeat(40);
    await expect(captureInputs(f.config, runId, f.root, f.options)).rejects.toThrow('IMPORT_BASIS_MISMATCH');
    f.config.imports[0].compatibility = { mode: 'historical', rationale: 'Historical evidence only', policyDigest: sha256(bytes) };
    expect((await captureInputs(f.config, runId, f.root, f.options)).core.imports[0].basisSha).toBe('b'.repeat(40));
    f.config.repository = 'heyitsanuar/coffee-break'; f.config.story = { id: 'US-037', issue: 88 };
    const pilot = { ...issue(), repository: f.config.repository, number: 88, url: 'https://github.com/heyitsanuar/coffee-break/issues/88', body: '## Acceptance Criteria\n' + Array.from({ length: 6 }, (_, i) => `- [ ] AC-0${i + 1}: Criterion ${i + 1}`).join('\n') };
    const pilotFields: Record<string, unknown> = { ...pilot }; delete pilotFields.criteria; f.options.issue.mockResolvedValue(parseIssue(pilotFields));
    await expect(captureInputs(f.config, runId, f.root, f.options)).rejects.toThrow('PILOT_INPUTS_REQUIRED');
  } finally { await f.clean(); }
});
it('rejects ancestor/final symlinks, hardlinks, sensitive paths and oversize files before returning bytes', async () => {
  const f = await captureFixture();
  try {
    await symlink(join(f.root, 'policy.md'), join(f.root, 'link.md')); await expect(readInputFile(join(f.root, 'link.md'), 100)).rejects.toThrow();
    await link(join(f.root, 'policy.md'), join(f.root, 'hard.md')); await expect(readInputFile(join(f.root, 'hard.md'), 100)).rejects.toThrow();
    await mkdir(join(f.root, 'directory')); await symlink(join(f.root, 'directory'), join(f.root, 'alias'));
    await writeFile(join(f.root, 'directory', 'file.md'), 'fixture'); await expect(readInputFile(join(f.root, 'alias', 'file.md'), 100)).rejects.toThrow();
    await writeFile(join(f.root, '.env'), 'synthetic'); await expect(readInputFile(join(f.root, '.env'), 100)).rejects.toThrow('SENSITIVE_PATH');
    await expect(readInputFile(join(f.root, 'import.md'), 1)).rejects.toThrow('RESOURCE_LIMIT');
  } finally { await f.clean(); }
});
it('reads committed binary bytes via fixed Git tree/blob operations without filters', async () => {
  const calls: string[] = [];
  const repository = gitRepository(async op => { calls.push(op.type); if (op.type === 'tree') return Buffer.from(`100644 blob ${sha}\tpolicy.md\0`); if (op.type === 'blob') return Buffer.from([0, 255, 128, 13, 10]); throw new Error('unexpected'); });
  expect((await repository.read('/fixture', sha, 'policy.md')).bytes).toEqual(Buffer.from([0, 255, 128, 13, 10])); expect(calls).toEqual(['tree', 'blob']);
});
it('verifies a copied design manifest and its exact self-omission without rewriting provenance', async () => {
  const f = await captureFixture();
  try {
    const base = 'docs/design/studies/ep-07/refinements'; await mkdir(join(f.root, base), { recursive: true });
    const path = base + '/artifact-manifest.json'; const self = { path, absolutePath: '/old/machine/' + path, note: 'This inventory file; self-hash intentionally omitted.' };
    const original = Buffer.from(JSON.stringify({ status: 'PROPOSED REFINEMENTS — NOT APPROVED', baselineHead: sha, newFiles: [self], preservation: 'fixture' }));
    await writeFile(join(f.root, path), original); f.config.selected.push({ path, kind: 'manifest', provenance: { origin: 'PR #98 static study', limitations: ['Not runtime evidence'] } });
    f.repository.read.mockImplementation(async (_root?: string, _sha?: string, p?: string) => ({ mode: '100644', bytes: p === path ? original : bytes }));
    const captured = await captureInputs(f.config, runId, f.root, f.options); expect(captured.blobs.get(sha256(original))).toEqual(original); expect(fingerprint(captured.core)).toHaveLength(64);
    const bad = Buffer.from(JSON.stringify({ status: 'PROPOSED', baselineHead: sha, newFiles: [{ ...self, note: 'Some other exception' }], preservation: 'fixture' }));
    await writeFile(join(f.root, path), bad); f.repository.read.mockImplementation(async (_root?: string, _sha?: string, p?: string) => ({ mode: '100644', bytes: p === path ? bad : bytes }));
    await expect(captureInputs(f.config, runId, f.root, f.options)).rejects.toThrow('MANIFEST_INVALID');
  } finally { await f.clean(); }
});
it('reads an actual committed binary through local Git without UTF-8 conversion or source writes', async () => {
  const { fileURLToPath } = await import('node:url'); const { readFile } = await import('node:fs/promises');
  const root = fileURLToPath(new URL('../../../../', import.meta.url)).replace(/\/$/, ''); const path = 'docs/design/studies/ep-07/refinements/renders/integrated-overview-1100x760.png';
  const repository = gitRepository(); const { head } = await repository.observe(root);
  const result = await repository.read(root, head, path);
  expect(result.mode).toBe('100644'); expect(result.bytes).toEqual(await readFile(join(root, path)));
});
it('reports observed baseline changes as drift while unavailable sources remain unverified', async () => {
  const f = await captureFixture();
  try {
    const original = await captureInputs(f.config, runId, f.root, f.options); f.repository.observe.mockResolvedValue({ head: 'b'.repeat(40), status: '' });
    expect(await verifyFreshness(original.core, f.config, runId, f.root, f.options)).toMatchObject({ status: 'drift', code: 'BASELINE_CHANGED' });
  } finally { await f.clean(); }
});
it('classifies missing input files explicitly and cancels before any capture I/O', async () => {
  const f = await captureFixture();
  try {
    await expect(readInputFile(join(f.root, 'missing.md'), 100)).rejects.toThrow('INPUT_FILE_MISSING');
    const controller = new AbortController(); controller.abort();
    await expect(captureInputs(f.config, runId, f.root, { ...f.options, signal: controller.signal })).rejects.toThrow('CAPTURE_INTERRUPTED');
    expect(f.repository.observe).not.toHaveBeenCalled();
  } finally { await f.clean(); }
});

it('detects a controlled parent replacement before reading redirected descriptor bytes', async () => {
  const f = await captureFixture();
  try {
    const directory = join(f.root, 'source'); await mkdir(directory); const path = join(directory, 'file.md'); await writeFile(path, 'original');
    const originalOpen = (await vi.importActual<typeof fs>('node:fs/promises')).open; let reads: MockInstance<FileHandle['read']> | undefined; let swapped = false;
    const spy = vi.spyOn(fs, 'open').mockImplementation(async (...args: Parameters<typeof fs.open>) => {
      if (args[0] === path && !swapped) { swapped = true; await rename(directory, join(f.root, 'preserved')); await mkdir(directory); await writeFile(path, 'replacement'); }
      const handle = await originalOpen(...args); if (args[0] === path) reads = vi.spyOn(handle, 'read'); return handle;
    });
    try { await expect(readInputFile(path, 100)).rejects.toThrow('SOURCE_CHANGED'); expect(swapped).toBe(true); expect(reads).toBeDefined(); expect(reads).not.toHaveBeenCalled(); }
    finally { spy.mockRestore(); }
    expect(await fs.readFile(join(f.root, 'preserved', 'file.md'), 'utf8')).toBe('original'); expect(await fs.readFile(path, 'utf8')).toBe('replacement');
  } finally { await f.clean(); }
});
