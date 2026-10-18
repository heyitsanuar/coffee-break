import { mkdtemp, realpath, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ArtifactStore } from '../../src/inputs/artifacts.js';
import { StoragePaths } from '../../src/workflow/paths.js';
import { WorkflowStore } from '../../src/workflow/store.js';
import { prepared, core } from './fixtures.js';
import { event, runId } from '../workflow/fixtures.js';
import { bundleReference } from '../../src/inputs/bundle.js';
import { acquire } from '../../src/workflow/lock.js';

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-artifacts-'))); const store = new WorkflowStore(root);
  const c = core(); const created = await store.create(event('run.created', { repository: { id: c.repository, root: '/fixture' }, story: c.story, baselineSha: c.baselineSha }));
  expect(created.exitCode).toBe(0);
  return { root, store, dir: await new StoragePaths(root).open(runId), clean: () => rm(root, { recursive: true, force: true }) };
}
it('publishes immutable inputs without workflow progress, then attaches under the existing writer lock', async () => {
  const f = await fixture();
  try {
    const p = prepared(); const ref = bundleReference(p.core);
    expect(await f.store.publishInputs(runId, 1, p)).toMatchObject({ exitCode: 0, committed: false, state: { revision: 1, input: null } });
    expect((await f.store.verifyInputs(runId, ref)).core).toEqual(p.core);
    const original = await readFile(join(f.dir.path, `bundle-${ref.digest}.json`));
    const attached = await f.store.attachInputs(runId, 1, ref, 'accept');
    expect(attached).toMatchObject({ exitCode: 0, committed: true, state: { revision: 2, stage: 'designer_review', input: ref } });
    expect((await new WorkflowStore(f.root).verifyInputs(runId)).core).toEqual(p.core);
    expect((await f.store.publishInputs(runId, 2, p)).exitCode).toBe(0);
    expect(await readFile(join(f.dir.path, `bundle-${ref.digest}.json`))).toEqual(original);
    expect((await f.store.recover(runId, 2)).exitCode).toBe(0);
  } finally { await f.clean(); }
});
it.each(['beforeWrite', 'afterWrite', 'beforePublish', 'afterPublish'] as const)('preserves evidence at %s without attaching or adopting it on recovery', async point => {
  const f = await fixture();
  try {
    const faulty = new WorkflowStore(f.root, { artifactFault: async (where, handle, data) => { if (where === point) { if (where === 'beforeWrite') await handle!.write(data!.subarray(0, 3)); throw new Error('fixture'); } } });
    const before = await readFile(join(f.dir.path, 'journal.jsonl'));
    expect((await faulty.publishInputs(runId, 1, prepared())).exitCode).toBe(1);
    const names = await readdir(f.dir.path); expect(names.some(n => n.startsWith('artifact.tmp-') || n.startsWith('blob-'))).toBe(true);
    expect((await f.store.recover(runId, 1)).state?.input).toBeNull(); expect(await readFile(join(f.dir.path, 'journal.jsonl'))).toEqual(before);
    expect((await f.store.attachInputs(runId, 1, bundleReference(core()), 'accept')).exitCode).toBe(1);
    expect(await readdir(f.dir.path)).toEqual(names);
  } finally { await f.clean(); }
});
it('counts failed temporary artifacts in quota and never evicts evidence', async () => {
  const f = await fixture();
  try {
    const name = f.dir.temporary('artifact.tmp'); await f.dir.create(name, Buffer.alloc(40));
    const lease = await acquire(f.dir);
    try { const store = new ArtifactStore(f.dir, { quota: 45, writerToken: lease.owner.token }); await expect(store.publishBundle(prepared())).rejects.toThrow('ARTIFACT_QUOTA'); }
    finally { await lease.release(); }
    expect((await readFile(join(f.dir.path, name))).length).toBe(40);
    expect((await f.store.status(runId)).state?.revision).toBe(1);
  } finally { await f.clean(); }
});
it('blocks missing/corrupt content and wrong run bindings without replacing accepted bytes', async () => {
  const f = await fixture();
  try {
    await f.store.publishInputs(runId, 1, prepared()); const ref = bundleReference(core());
    const path = join(f.dir.path, `blob-${core().files[0].digest}.bin`); await writeFile(path, 'corrupt');
    await expect(f.store.verifyInputs(runId, ref)).rejects.toThrow('CONTENT_MISMATCH');
    expect((await f.store.attachInputs(runId, 1, ref, 'accept')).exitCode).toBe(1);
    expect((await f.store.publishInputs(runId, 1, prepared())).exitCode).toBe(1); expect(await readFile(path, 'utf8')).toBe('corrupt');
    await rm(path); await expect(f.store.verifyInputs(runId, ref)).rejects.toThrow();
    const wrong = prepared('33333333-3333-4333-8333-333333333333'); expect((await f.store.publishInputs(runId, 1, wrong)).exitCode).toBe(1);
  } finally { await f.clean(); }
});
it('requires explicit replacement and re-acceptance, preserving previous bundles and journal', async () => {
  const f = await fixture();
  try {
    const p = prepared(); await f.store.publishInputs(runId, 1, p); await f.store.attachInputs(runId, 1, bundleReference(p.core), 'accept');
    const next = prepared(); next.core.scope.nonGoals.push('New scope');
    const { prepareBundle } = await import('../../src/inputs/bundle.js'); const replacement = prepareBundle(next.core, next.blobs, { ...next.capture, id: '33333333-3333-4333-8333-333333333333' });
    const oldJournal = await readFile(join(f.dir.path, 'journal.jsonl'));
    await f.store.publishInputs(runId, 2, replacement);
    expect((await f.store.attachInputs(runId, 2, bundleReference(replacement.core), 'accept')).exitCode).toBe(1);
    expect((await f.store.attachInputs(runId, 2, bundleReference(replacement.core), 'replace')).state).toMatchObject({ stage: 'inputs', revision: 3 });
    expect((await new WorkflowStore(f.root).recover(runId, 3)).state?.stage).toBe('inputs');
    expect((await f.store.attachInputs(runId, 3, bundleReference(replacement.core), 'accept')).state).toMatchObject({ stage: 'designer_review', revision: 4 });
    expect((await readFile(join(f.dir.path, 'journal.jsonl'))).subarray(0, oldJournal.length)).toEqual(oldJournal);
    expect((await f.store.verifyInputs(runId, bundleReference(p.core))).core).toEqual(p.core);
  } finally { await f.clean(); }
});
it('keeps legacy controls but blocks new consumers of unverified references', async () => {
  const f = await fixture();
  try {
    await expect(f.store.verifyInputs(runId)).rejects.toThrow('INPUTS_REQUIRED');
    const result = await f.store.apply(runId, event('inputs.accepted', { input: { id: 'legacy', digest: 'b'.repeat(64) } }, (await f.store.status(runId)).state));
    expect(result.exitCode).toBe(0); await expect(f.store.verifyInputs(runId)).rejects.toThrow('LEGACY_INPUT_UNVERIFIED');
    expect((await f.store.apply(runId, event('run.paused', {}, result.state))).exitCode).toBe(0);
  } finally { await f.clean(); }
});
it('audits both A-to-B-to-C bypass rejections across restart and accepts only the selected B', async () => {
  const f = await fixture();
  try {
    const { prepareBundle } = await import('../../src/inputs/bundle.js');
    const a = prepared(); const make = (label: string, id: string) => { const p = prepared(); p.core.scope.nonGoals.push(label); return prepareBundle(p.core, p.blobs, { ...p.capture, id }); };
    const b = make('B', '33333333-3333-4333-8333-333333333333'); const c = make('C', '44444444-4444-4444-8444-444444444444');
    await f.store.publishInputs(runId, 1, a); expect((await f.store.attachInputs(runId, 1, bundleReference(a.core), 'accept')).exitCode).toBe(0);
    await f.store.publishInputs(runId, 2, b); expect((await f.store.attachInputs(runId, 2, bundleReference(b.core), 'replace')).exitCode).toBe(0);
    await f.store.publishInputs(runId, 3, c);
    const rejected = await f.store.attachInputs(runId, 3, bundleReference(c.core), 'accept');
    const restarted = new WorkflowStore(f.root); expect((await restarted.recover(runId, 3)).exitCode).toBe(0);
    const applied = await restarted.apply(runId, event('inputs.accepted', { input: bundleReference(c.core) }, (await restarted.status(runId)).state));
    for (const result of [rejected, applied]) expect(result).toMatchObject({ exitCode: 1, committed: true, disposition: 'rejected', storage: { code: 'INPUT_REPLACEMENT_REQUIRED' }, state: { revision: 3, stage: 'inputs', input: bundleReference(b.core) } });
    const journal = (await readFile(join(f.dir.path, 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    expect(journal.filter(r => r.code === 'INPUT_REPLACEMENT_REQUIRED')).toHaveLength(2);
    const replayed = await new WorkflowStore(f.root).status(runId); expect(replayed).toMatchObject({ exitCode: 0, state: { revision: 3, stage: 'inputs', input: bundleReference(b.core) } });
    expect(await restarted.apply(runId, event('inputs.accepted', { input: bundleReference(b.core) }, replayed.state))).toMatchObject({ exitCode: 0, disposition: 'accepted', state: { revision: 4, stage: 'designer_review', input: bundleReference(b.core) } });
    expect((await new WorkflowStore(f.root).status(runId)).state?.input).toEqual(bundleReference(b.core));
  } finally { await f.clean(); }
});
it('preserves a real killed publisher and recovers only workflow metadata without adopting artifacts', async () => {
  const f = await fixture(); const { compileRuntime, worker } = await import('../workflow/process-fixtures.js'); const { readLock, localLockEnvironment } = await import('../../src/workflow/lock.js'); const { hostname } = await import('node:os');
  let child: ReturnType<typeof worker> | undefined;
  try {
    child = worker(f.root, await compileRuntime(f.root), 'artifact-hold'); expect((await child.next()).phase).toBe('input-ready');
    const p = prepared(); const next = child.next(); child.child.send!({ ...p, blobs: [...p.blobs].map(([id, b]) => [id, b.toString('base64')]) });
    expect((await next).phase).toBe('artifact-written'); const token = (await readLock(f.dir))!.owner.token;
    expect((await f.store.publishInputs(runId, 1, prepared())).storage.health).toBe('busy');
    await child.stop(); const temporary = (await readdir(f.dir.path)).find(n => n.startsWith('artifact.tmp-'))!; const original = await readFile(join(f.dir.path, temporary));
    const recovering = new WorkflowStore(f.root, { lockEnvironment: { ...localLockEnvironment, identity: async () => ({ pid: process.pid, uid: process.getuid!(), host: hostname(), bootId: 'controlled-process-fixture', processStartedAt: new Date(performance.timeOrigin).toISOString() }) } });
    expect(await recovering.recover(runId, 1, { lockToken: token })).toMatchObject({ exitCode: 0, state: { revision: 1, input: null } });
    expect(await readFile(join(f.dir.path, temporary))).toEqual(original);
    await expect(recovering.verifyInputs(runId)).rejects.toThrow('INPUTS_REQUIRED');
    expect((await recovering.publishInputs(runId, 1, prepared())).exitCode).toBe(0);
  } finally { await child?.stop(); await f.clean(); }
}, 10_000);
it('replays exact attachment metadata as an audited duplicate without reapplying it', async () => {
  const f = await fixture();
  try {
    await f.store.publishInputs(runId, 1, prepared()); const metadata = { eventId: '66666666-6666-4666-8666-666666666666', at: '2026-10-17T12:00:00.000Z' };
    expect((await f.store.attachInputs(runId, 1, bundleReference(core()), 'accept', metadata)).exitCode).toBe(0);
    expect(await f.store.attachInputs(runId, 1, bundleReference(core()), 'accept', metadata)).toMatchObject({ exitCode: 0, disposition: 'duplicate', state: { revision: 2, journalSequence: 3 } });
  } finally { await f.clean(); }
});
it('refuses low-level publication across an unresolved journal intent without clearing evidence', async () => {
  const f = await fixture();
  try {
    await f.dir.create('intent.json', Buffer.from('{"uncertain":"fixture"}')); const lease = await acquire(f.dir);
    try { await expect(new ArtifactStore(f.dir, { writerToken: lease.owner.token }).publishBundle(prepared())).rejects.toThrow('RECOVERY_REQUIRED'); }
    finally { await lease.release(); }
    expect(await readFile(join(f.dir.path, 'intent.json'), 'utf8')).toBe('{"uncertain":"fixture"}');
    expect((await readdir(f.dir.path)).some(n => n.startsWith('blob-'))).toBe(false);
  } finally { await f.clean(); }
});
