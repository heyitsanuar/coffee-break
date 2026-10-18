import { mkdtemp, realpath, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { runInputs } from '../../src/inputs/cli.js';
import { WorkflowStore } from '../../src/workflow/store.js';
import { event, runId } from '../workflow/fixtures.js';
import { bytes, core, issue, sha } from './fixtures.js';
import type { CaptureConfig } from '../../src/inputs/capture.js';

it('rejects unknown commands, duplicate/oversized flags and arbitrary event/executable injection before I/O', async () => {
  const store = { status: vi.fn(), publishInputs: vi.fn(), attachInputs: vi.fn(), verifyInputs: vi.fn() } as unknown as WorkflowStore;
  for (const args of [[], ['inputs', 'approve', runId], ['inputs', 'capture', '../escape'], ['inputs', 'capture', runId, '--exec', 'evil'], ['inputs', 'verify', runId, '--digest', 'bad'], ['inputs', 'attach', runId, '--digest', 'b'.repeat(64), '--revision', '1', '--mode', 'accept', '--revision', '2'], ['report', 'validate', runId, '--payload', 'x'.repeat(20_000)]]) expect((await runInputs(args, { store })).code).toBe(2);
  expect(store.status).not.toHaveBeenCalled(); expect(store.publishInputs).not.toHaveBeenCalled();
});
it('captures/attaches/verifies/fresh-checks explicitly and validates reports without storing or approving them', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-input-cli-')));
  try {
    const checkout = join(root, 'checkout'); await mkdir(checkout); await writeFile(join(checkout, 'policy.md'), bytes); await writeFile(join(root, 'import.md'), bytes);
    const c = core(); const store = new WorkflowStore(join(root, 'runs'));
    await store.create(event('run.created', { repository: { id: c.repository, root: checkout }, story: c.story, baselineSha: sha }));
    const config: CaptureConfig = { schemaVersion: 1, repository: c.repository, story: c.story, baselineSha: sha, selected: c.files.map(f => ({ path: f.path, kind: f.kind, provenance: f.provenance })), imports: c.imports.map(i => ({ kind: i.kind, origin: i.origin, basisSha: i.basisSha, limitations: i.limitations, compatibility: i.compatibility, path: join(root, 'import.md') })), scope: c.scope };
    const path = join(root, 'config.json'); await writeFile(path, JSON.stringify(config));
    const getIssue = vi.fn(async () => issue()); const context = { store, captureOptions: { repository: { observe: async () => ({ head: sha, status: '' }), read: async () => ({ mode: '100644', bytes }) }, issue: getIssue }, now: () => '2026-10-17T12:00:00.000Z' };
    const captured = await runInputs(['inputs', 'capture', runId, '--config', path, '--revision', '1'], context); expect(captured.code).toBe(0);
    const digest = JSON.parse(captured.stdout).artifact.reference.digest; expect((await store.status(runId)).state?.input).toBeNull();
    expect((await runInputs(['inputs', 'attach', runId, '--digest', digest, '--mode', 'accept', '--revision', '1'], context)).code).toBe(0);
    expect((await runInputs(['inputs', 'verify', runId], context)).code).toBe(0);
    const journalPath = join(root, 'runs', runId, 'journal.jsonl'); const before = await readFile(journalPath);
    expect((await runInputs(['inputs', 'fresh', runId, '--config', path], context)).code).toBe(0);
    getIssue.mockResolvedValue({ ...issue(), title: 'changed' }); expect((await runInputs(['inputs', 'fresh', runId, '--config', path], context)).code).toBe(1);
    getIssue.mockRejectedValue(new Error('offline secret')); const unavailable = await runInputs(['inputs', 'fresh', runId, '--config', path], context); expect(unavailable.code).toBe(3); expect(unavailable.stdout).not.toContain('secret');
    expect(await readFile(journalPath)).toEqual(before);
    let state = (await store.status(runId)).state; state = (await store.apply(runId, event('attempt.started', { attemptId: 'actual-attempt' }, state), 'controller')).state;
    const payload = { summary: '<unsafe>', recommendation: 'review', completion: 'partial', coverage: c.issue.criteria.map(a => ({ acId: a.id, state: 'not-evidenced', evidence: [], rationale: 'Not executed' })), findings: [], risks: [], openDecisions: [], unperformedChecks: ['Runtime checks'], inspectedFiles: [], evidence: [], validationPerformed: [], uncertainty: [], limitations: ['Synthetic output'] };
    const payloadPath = join(root, 'payload.json'); await writeFile(payloadPath, JSON.stringify(payload)); const unchanged = await readFile(journalPath);
    const report = await runInputs(['report', 'validate', runId, '--payload', payloadPath, '--attempt', 'actual-attempt', '--report-id', '44444444-4444-4444-8444-444444444444'], context);
    expect(report.code).toBe(0); expect(JSON.parse(report.stdout).report.assessment.successfulCompletion).toBe(false);
    const human = await runInputs(['report', 'validate', runId, '--payload', payloadPath, '--attempt', 'actual-attempt', '--report-id', '44444444-4444-4444-8444-444444444444', '--human'], context);
    expect(human.stdout).toContain('&lt;unsafe&gt;'); expect(human.stdout).not.toContain('<unsafe>'); expect(await readFile(journalPath)).toEqual(unchanged);
    expect((await readdir(join(root, 'runs', runId))).some(name => name.startsWith('report-'))).toBe(false);
    expect(state?.approvalRefs).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('retains unsupported-schema/platform exit 3 at the input CLI boundary', async () => {
  const { WorkflowError } = await import('../../src/workflow/contracts.js');
  const store = { verifyInputs: vi.fn(async () => { throw new WorkflowError('UNSUPPORTED_STORAGE_PLATFORM', 3); }) } as unknown as WorkflowStore;
  expect((await runInputs(['inputs', 'verify', runId], { store })).code).toBe(3);
});
