import { randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { WorkflowStore } from '../../src/workflow/store.js';
import { encode } from '../../src/designer/contracts.js';
import { ArtifactStore } from '../../src/inputs/artifacts.js';
import { acquire } from '../../src/workflow/lock.js';
import { bundleReference, prepareBundle } from '../../src/inputs/bundle.js';
import { harness, requestId, decisionId, at } from './fixtures.js';

it('publishes receipt last, preserves workflow bytes, and verifies after restart', async () => {
  const f = await harness();
  try {
    const before = await readFile(join(f.dir.path, 'journal.jsonl')); const snapshot = await readFile(join(f.dir.path, 'snapshot.json'));
    const result = await f.prepare(); expect(result).toMatchObject({ exitCode: 0, committed: false, preparation: { authorization: 'none', freshness: { overall: 'unverified' } } });
    const inspected = await new WorkflowStore(f.storage).inspectDesigner(f.runId, requestId); expect(inspected.status).toBe('verified');
    const duplicate = await f.prepare(); expect(duplicate.preparation).toEqual(result.preparation);
    const admission = await f.store.designerAdmission(f.runId, 2, requestId, decisionId);
    expect(admission).toMatchObject({ exitCode: 3, admission: { decision: 'deny', allowLaunch: false, authorization: 'none' } });
    expect(admission.admission!.blockers).toContain('PHASE_A_EXECUTION_DISABLED');
    expect(await f.store.designerAdmission(f.runId, 2, requestId, decisionId)).toEqual(admission);
    expect(await readFile(join(f.dir.path, 'journal.jsonl'))).toEqual(before); expect(await readFile(join(f.dir.path, 'snapshot.json'))).toEqual(snapshot);
    expect((await f.store.status(f.runId)).state).toMatchObject({ revision: 2, attempts: [], approvalRefs: [], handoff: null });
  } finally { await f.clean(); }
});
it('keeps portable identity while rejecting cross-run receipts and mismatched journal bindings', async () => {
  const a = await harness(); const b = await harness();
  try {
    const ar = (await a.prepare()).preparation!; const br = (await b.prepare()).preparation!; expect(ar.job).toEqual(br.job); expect(ar.workflow.runId).not.toBe(br.workflow.runId);
    const path = join(b.dir.path, `preparation-${requestId}.json`); await writeFile(path, await readFile(join(a.dir.path, `preparation-${requestId}.json`)));
    await expect(b.store.inspectDesigner(b.runId, requestId)).rejects.toThrow('PREPARATION_CONTEXT_MISMATCH');
    const forged = { ...br, workflow: { ...br.workflow, journalHeadHash: ar.workflow.journalHeadHash } }; await writeFile(path, encode(forged));
    await expect(b.store.inspectDesigner(b.runId, requestId)).rejects.toThrow('PREPARATION_CONTEXT_MISMATCH');
  } finally { await a.clean(); await b.clean(); }
});
it('retains historical preparation after input replacement, rejects stale revision and request reuse', async () => {
  const f = await harness();
  try {
    await f.prepare(); const p = f.bundle; const c = structuredClone(p.core); c.scope.nonGoals.push('Changed scope');
    const next = prepareBundle(c, p.blobs, { ...p.capture, id: randomUUID() }); await f.store.publishInputs(f.runId, 2, next);
    expect((await f.store.attachInputs(f.runId, 2, bundleReference(c), 'replace')).exitCode).toBe(0);
    expect((await f.store.attachInputs(f.runId, 3, bundleReference(c), 'accept')).exitCode).toBe(0);
    expect((await f.store.inspectDesigner(f.runId, requestId)).status).toBe('stale');
    expect((await f.store.prepareDesigner(f.runId, 2, f.recipe.id, randomUUID())).storage.code).toBe('STALE_REVISION');
    expect((await f.store.prepareDesigner(f.runId, 4, f.recipe.id, requestId)).storage.code).toBe('PREPARATION_REQUEST_CONFLICT');
    const result = await f.store.designerAdmission(f.runId, 4, requestId, decisionId);
    expect(result.exitCode).toBe(3); expect(result.admission!.blockers).toContain('ACCEPTED_INPUT_CHANGED');
    expect(result.admission!.blockers).toContain('PREPARATION_BINDING_STALE');
  } finally { await f.clean(); }
});
it('rejects request-ID content changes without overwriting evidence', async () => {
  const f = await harness();
  try {
    await f.prepare(); const original = await readFile(join(f.dir.path, `preparation-${requestId}.json`));
    const altered = { ...f.recipe, version: 'synthetic/2' };
    const other = new WorkflowStore(f.storage, { designerRecipes: [altered] });
    expect((await other.prepareDesigner(f.runId, 2, f.recipe.id, requestId)).storage.code).toBe('PREPARATION_REQUEST_CONFLICT');
    expect(await readFile(join(f.dir.path, `preparation-${requestId}.json`))).toEqual(original);
    await f.store.designerAdmission(f.runId, 2, requestId, decisionId);
    const second = await f.store.prepareDesigner(f.runId, 2, f.recipe.id, randomUUID());
    expect((await f.store.designerAdmission(f.runId, 2, second.preparation!.requestId, decisionId)).storage.code).toBe('ADMISSION_REQUEST_CONFLICT');
  } finally { await f.clean(); }
});
it.each(['beforeWrite', 'afterWrite', 'beforePublish', 'afterRename', 'afterPublish'] as const)('preserves partial publication at %s, with no automatic orphan adoption', async point => {
  const f = await harness();
  try {
    const before = await readFile(join(f.dir.path, 'journal.jsonl'));
    const faulty = new WorkflowStore(f.storage, { designerRecipes: [f.recipe], artifactFault: async where => { if (where === point) throw new Error('controlled failure'); } });
    expect((await faulty.prepareDesigner(f.runId, 2, f.recipe.id, requestId)).exitCode).toBe(1);
    const names = await readdir(f.dir.path); expect(names.some(n => n.startsWith('artifact.tmp-') || n.startsWith('blob-'))).toBe(true);
    await expect(new WorkflowStore(f.storage).inspectDesigner(f.runId, requestId)).rejects.toThrow('PREPARATION_MISSING');
    expect((await f.store.recover(f.runId, 2)).exitCode).toBe(0); expect(await readdir(f.dir.path)).toEqual(names);
    expect(await readFile(join(f.dir.path, 'journal.jsonl'))).toEqual(before);
    expect((await f.prepare()).exitCode).toBe(0);
  } finally { await f.clean(); }
});
it.each(['beforePublish', 'afterRename', 'afterPublish'] as const)('handles failure at receipt %s conservatively, with explicit restart verification', async point => {
  const f = await harness();
  try {
    let hit = false;
    const faulty = new WorkflowStore(f.storage, { designerRecipes: [f.recipe], artifactFault: async (where, _handle, bytes) => {
      if (where === point && bytes && bytes.toString().includes('"kind":"designer-preparation-receipt"')) { hit = true; throw new Error('receipt boundary'); }
    } });
    expect((await faulty.prepareDesigner(f.runId, 2, f.recipe.id, requestId)).exitCode).toBe(1); expect(hit).toBe(true);
    const saved = await readdir(f.dir.path);
    if (point === 'beforePublish') await expect(f.store.inspectDesigner(f.runId, requestId)).rejects.toThrow('PREPARATION_MISSING');
    else expect((await f.store.inspectDesigner(f.runId, requestId)).status).toBe('verified');
    expect(await readdir(f.dir.path)).toEqual(saved); expect((await f.prepare()).exitCode).toBe(0);
  } finally { await f.clean(); }
});
it('rejects corruption and a pending journal intent without repairing either', async () => {
  const f = await harness();
  try {
    const result = await f.prepare(); const target = join(f.dir.path, `blob-${result.preparation!.projection.digest}.bin`);
    await writeFile(target, 'corrupt'); await expect(f.store.inspectDesigner(f.runId, requestId)).rejects.toThrow('CONTENT_MISMATCH');
    expect((await f.store.designerAdmission(f.runId, 2, requestId, decisionId)).exitCode).toBe(1);
    await f.dir.create('intent.json', Buffer.from('{"uncertain":true}'));
    expect((await f.prepare()).exitCode).toBe(1); expect(await readFile(join(f.dir.path, 'intent.json'), 'utf8')).toBe('{"uncertain":true}');
  } finally { await f.clean(); }
});
it('counts all new artifacts, orphan documents and failed temporaries toward shared quotas', async () => {
  const f = await harness();
  try {
    await f.prepare(); const entries = await f.dir.entries(); const total = entries.filter(e => /^(blob|bundle|capture|job|projection|preparation|admission|artifact\.tmp)-/.test(e.name)).reduce((n, e) => n + Number(e.size), 0);
    const temporary = f.dir.temporary('artifact.tmp'); await f.dir.create(temporary, Buffer.alloc(23));
    const lease = await acquire(f.dir);
    try {
      const store = new ArtifactStore(f.dir, { quota: total + 22, writerToken: lease.owner.token });
      await expect(store.designerQuota([])).rejects.toThrow('ARTIFACT_QUOTA');
      await expect(store.publishBundle(f.bundle)).rejects.toThrow('ARTIFACT_QUOTA');
    } finally { await lease.release(); }
    expect((await readFile(join(f.dir.path, temporary))).length).toBe(23);
  } finally { await f.clean(); }
});
it('uses the existing single-writer lease and rejects concurrent publishers', async () => {
  const f = await harness();
  try {
    const lease = await acquire(f.dir);
    try { expect((await f.prepare()).storage.code).toBe('LOCK_BUSY'); } finally { await lease.release(); }
    const results = await Promise.all([f.prepare(), f.prepare()]); expect(results.some(r => r.exitCode === 0)).toBe(true); expect(results.some(r => r.storage.code === 'LOCK_BUSY')).toBe(true);
  } finally { await f.clean(); }
});
it('does not settle interrupted attempts or bypass blocked/paused workflow status', async () => {
  const f = await harness();
  try {
    const state = (await f.store.status(f.runId)).state!;
    await f.store.apply(f.runId, { schemaVersion: 1, type: 'attempt.started', eventId: randomUUID(), runId: f.runId, expectedRevision: 2, at, payload: { attemptId: 'metadata-only-test' } });
    const recovered = await f.store.recover(f.runId, state.revision + 1);
    const result = await f.store.prepareDesigner(f.runId, recovered.state!.revision, f.recipe.id, requestId);
    expect(result.storage.code).toBe('WORKFLOW_NOT_PREPARABLE'); expect((await f.store.status(f.runId)).state!.attempts[0].settled).toBe(false);
  } finally { await f.clean(); }
});
it('reverifies published manifest closure before acknowledging preparation', async () => {
  const f = await harness();
  try {
    let changed = false;
    const faulty = new WorkflowStore(f.storage, { designerRecipes: [f.recipe], artifactFault: async (where, _handle, bytes) => {
      if (!changed && where === 'afterPublish' && bytes?.toString().includes('"kind":"designer-job"')) {
        changed = true; const name = (await readdir(f.dir.path)).find(n => n.startsWith('job-'))!; await writeFile(join(f.dir.path, name), 'corrupt');
      }
    } });
    const result = await faulty.prepareDesigner(f.runId, 2, f.recipe.id, requestId); expect(changed).toBe(true); expect(result.exitCode).toBe(1);
    expect((await readdir(f.dir.path)).some(n => n.startsWith('preparation-'))).toBe(false);
  } finally { await f.clean(); }
});
it('enforces entry-count limits even for zero-byte orphan objects', async () => {
  const f = await harness(); const { vi } = await import('vitest');
  try {
    const lease = await acquire(f.dir);
    try {
      const entries = await f.dir.entries(); const spy = vi.spyOn(f.dir, 'entries').mockResolvedValue([...entries, ...Array.from({ length: 4096 - entries.length }, (_, i) => ({ name: `orphan-${i}`, size: 0n }))]);
      await expect(new ArtifactStore(f.dir, { writerToken: lease.owner.token }).designerQuota([])).rejects.toThrow('ARTIFACT_ENTRY_LIMIT'); spy.mockRestore();
    } finally { await lease.release(); }
  } finally { await f.clean(); }
});
it('invalidates current binding on an audited rejection even when the revision is unchanged', async () => {
  const f = await harness();
  try {
    await f.prepare();
    const rejected = await f.store.apply(f.runId, { schemaVersion: 1, type: 'attempt.succeeded', eventId: randomUUID(), runId: f.runId, expectedRevision: 2, at, payload: { attemptId: 'absent', report: { id: 'untrusted-claim', digest: 'c'.repeat(64) } } });
    expect(rejected.disposition).toBe('rejected'); expect(rejected.state!.revision).toBe(2);
    expect((await f.store.inspectDesigner(f.runId, requestId)).status).toBe('stale');
    expect((await f.prepare()).storage.code).toBe('PREPARATION_REQUEST_CONFLICT');
    const result = await f.store.designerAdmission(f.runId, 2, requestId, decisionId);
    expect(result.admission!.blockers).toContain('PREPARATION_BINDING_STALE');
  } finally { await f.clean(); }
});
it.each(['beforePublish', 'afterRename', 'afterPublish'] as const)('preserves denied-admission evidence on %s failure without workflow progress', async point => {
  const f = await harness();
  try {
    await f.prepare(); const journal = await readFile(join(f.dir.path, 'journal.jsonl'));
    const faulty = new WorkflowStore(f.storage, { artifactFault: async (where, _handle, bytes) => {
      if (where === point && bytes?.toString().includes('"kind":"designer-admission-decision"')) throw new Error('controlled decision publication failure');
    } });
    expect((await faulty.designerAdmission(f.runId, 2, requestId, decisionId)).exitCode).toBe(1);
    const names = await readdir(f.dir.path); expect(names.some(n => n.startsWith('admission-') || n.startsWith('artifact.tmp-'))).toBe(true);
    const retried = await f.store.designerAdmission(f.runId, 2, requestId, decisionId); expect(retried.exitCode).toBe(3); expect(retried.admission!.allowLaunch).toBe(false);
    expect(await readFile(join(f.dir.path, 'journal.jsonl'))).toEqual(journal);
  } finally { await f.clean(); }
});
