import { mkdtemp, realpath, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { reportFixture } from './fixtures.js';
import { prepared, core } from '../inputs/fixtures.js';
import { event, runId } from '../workflow/fixtures.js';
import { bundleReference } from '../../src/inputs/bundle.js';
import { StoragePaths } from '../../src/workflow/paths.js';
import { WorkflowStore } from '../../src/workflow/store.js';
import { acquire } from '../../src/workflow/lock.js';
import { ArtifactStore, type ArtifactFault } from '../../src/inputs/artifacts.js';

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-report-storage-'))); const store = new WorkflowStore(root); const c = core();
  await store.create(event('run.created', { repository: { id: c.repository, root: '/fixture' }, story: c.story, baselineSha: c.baselineSha }));
  await store.publishInputs(runId, 1, prepared()); await store.attachInputs(runId, 1, bundleReference(c), 'accept');
  const started = await store.apply(runId, event('attempt.started', { attemptId: 'attempt-1' }, (await store.status(runId)).state), 'controller');
  const dir = await new StoragePaths(root).open(runId); const { payload, context } = reportFixture(); context.state = started.state!;
  return { root, dir, store, payload, context, clean: () => rm(root, { recursive: true, force: true }) };
}
it('requires writer ownership and preserves duplicate/conflicting report identities without journal mutation', async () => {
  const f = await fixture();
  try {
    await expect(new ArtifactStore(f.dir).publishReport(f.payload, f.context)).rejects.toThrow('ARTIFACT_WRITER_REQUIRED');
    const before = await readFile(join(f.dir.path, 'journal.jsonl')); const lease = await acquire(f.dir);
    try {
      const storage = new ArtifactStore(f.dir, { writerToken: lease.owner.token });
      expect((await storage.publishReport(f.payload, f.context)).disposition).toBe('created');
      const path = join(f.dir.path, `report-${f.context.reportId}.json`); const original = await readFile(path);
      expect((await storage.publishReport(f.payload, { ...f.context, receivedAt: '2026-10-18T12:00:00.000Z' })).disposition).toBe('duplicate');
      await expect(storage.publishReport({ ...f.payload, summary: 'different' }, f.context)).rejects.toThrow('REPORT_ID_CONFLICT');
      await expect(storage.publishReport(f.payload, { ...f.context, producer: { id: 'different', adapter: 'test/v1' } })).rejects.toThrow('REPORT_ID_CONFLICT');
      expect(await readFile(path)).toEqual(original); expect((await storage.verifyReport(f.context.reportId, f.context)).payload.summary).toBe(f.payload.summary);
    } finally { await lease.release(); }
    expect(await readFile(join(f.dir.path, 'journal.jsonl'))).toEqual(before);
  } finally { await f.clean(); }
});
it.each(['beforeWrite', 'beforePublish', 'afterPublish'] as const)('preserves interrupted report publication at %s without settling its attempt', async point => {
  const f = await fixture();
  try {
    const lease = await acquire(f.dir); const before = await readFile(join(f.dir.path, 'journal.jsonl'));
    const fault: ArtifactFault = async (where, handle, bytes) => { if (where === point) { if (where === 'beforeWrite') await handle!.write(bytes!.subarray(0, 7)); throw new Error('interrupted'); } };
    try { await expect(new ArtifactStore(f.dir, { writerToken: lease.owner.token, fault }).publishReport(f.payload, f.context)).rejects.toThrow('interrupted'); } finally { await lease.release(); }
    expect((await readdir(f.dir.path)).some(n => n.startsWith('artifact.tmp-') || n.startsWith('report-'))).toBe(true);
    expect(await readFile(join(f.dir.path, 'journal.jsonl'))).toEqual(before);
    expect((await new WorkflowStore(f.root).recover(runId, 3)).state?.attempts[0]).toMatchObject({ status: 'interrupted', settled: false });
  } finally { await f.clean(); }
});

it('classifies unsupported stored report versions distinctly and preserves their bytes', async () => {
  const f = await fixture();
  try {
    const { validateReport } = await import('../../src/reports/contracts.js');
    const future = Buffer.from(JSON.stringify({ ...validateReport(f.payload, f.context), schemaVersion: 2 }));
    const path = join(f.dir.path, `report-${f.context.reportId}.json`); await writeFile(path, future, { mode: 0o600 });
    await expect(new ArtifactStore(f.dir).verifyReport(f.context.reportId, f.context)).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEMA', exitCode: 3 });
    expect(await readFile(path)).toEqual(future);
  } finally { await f.clean(); }
});
it('refuses unjournaled attempt provenance and preserves report verification across later recovery', async () => {
  const f = await fixture();
  try {
    const lease = await acquire(f.dir);
    try {
      const store = new ArtifactStore(f.dir, { writerToken: lease.owner.token }); const fake = structuredClone(f.context); fake.attemptId = 'never-journaled'; fake.state.attempts[0].id = fake.attemptId;
      await expect(store.publishReport(f.payload, fake)).rejects.toThrow('REPORT_CONTEXT_MISMATCH');
      await store.publishReport(f.payload, f.context);
    } finally { await lease.release(); }
    const recovered = await f.store.recover(runId, 3);
    expect(recovered.state?.attempts[0].status).toBe('interrupted');
    const historical = await new ArtifactStore(f.dir).verifyReport(f.context.reportId, { ...f.context, state: recovered.state! });
    expect(historical.payload.summary).toBe(f.payload.summary);
    expect(historical.assessment.successfulCompletion).toBe(true);
    expect((await f.store.status(runId)).state?.attempts[0].settled).toBe(false);
  } finally { await f.clean(); }
});
