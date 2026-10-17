import { mkdtemp, realpath, rm, readFile, writeFile, appendFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { WorkflowStore } from '../../src/workflow/store.js';
import { canonical, LIMITS } from '../../src/workflow/contracts.js';
import { event, identity, reason, ref, runId, waiting } from './fixtures.js';
import { compileRuntime, worker } from './process-fixtures.js';
import { hostname } from 'node:os';
import { localLockEnvironment, readLock } from '../../src/workflow/lock.js';
import { StoragePaths } from '../../src/workflow/paths.js';

async function fixture() { const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-store-'))); return { root, store: new WorkflowStore(root), clean: () => rm(root, { recursive: true, force: true }) }; }
it('keeps journal authority, distinct counters and historical rejected dispositions', async () => {
  const f = await fixture();
  try {
    const created = await f.store.create(event('run.created', identity)); expect(created.committed).toBe(true);
    const pause = event('run.paused', {}, created.state);
    const paused = await f.store.apply(runId, pause); expect(paused.state?.status).toBe('paused');
    const duplicate = await f.store.apply(runId, pause); expect(duplicate).toMatchObject({ disposition: 'duplicate', originalDisposition: 'accepted', state: { revision: 2, journalSequence: 3 } });
    expect((await f.store.apply(runId, { ...pause, at: '2026-10-17T12:00:00.000Z' })).disposition).toBe('conflict');
    const state = (await f.store.status(runId)).state!;
    const rejected = await f.store.apply(runId, event('inputs.accepted', { input: ref }, state)); expect(rejected.disposition).toBe('rejected');
    expect(rejected.state?.revision).toBe(2); expect(rejected.state?.journalSequence).toBe(5);
    expect((await new WorkflowStore(f.root).recover(runId, 2)).state?.status).toBe('paused');
  } finally { await f.clean(); }
});
it.each(['beforeSnapshotSync', 'beforeSnapshotRename', 'afterSnapshotRename'] as const)('reports committed state separately when %s fails', async point => {
  const f = await fixture();
  try {
    await f.store.create(event('run.created', identity)); const state = (await f.store.status(runId)).state!;
    const faulty = new WorkflowStore(f.root, { fault: async where => { if (where === point) throw new Error('synthetic'); } });
    const result = await faulty.apply(runId, event('run.paused', {}, state));
    expect(result).toMatchObject({ committed: true, exitCode: 1, state: { status: 'paused', revision: 2 }, storage: { health: 'snapshot_stale' } });
    expect((await f.store.apply(runId, event('run.resumed', {}, result.state))).storage.health).toBe('recovery_required');
    expect(await f.store.recover(runId, 2)).toMatchObject({ exitCode: 0, state: { status: 'paused' }, storage: { health: 'ok' } });
  } finally { await f.clean(); }
});
it.each(['beforeAppend', 'beforeJournalSync', 'afterJournalSync', 'partialWrite'] as const)('fences uncertain %s across restart until explicit recovery', async point => {
  const f = await fixture();
  try {
    const created = await f.store.create(event('run.created', identity)); const pause = event('run.paused', {}, created.state);
    const faulty = new WorkflowStore(f.root, { fault: async (where, handle, bytes) => {
      if (point === 'partialWrite' && where === 'beforeWrite') { await handle!.write(bytes!.subarray(0, 12)); throw new Error('partial'); }
      if (where === point) throw new Error('fault');
    } });
    expect(await faulty.apply(runId, pause)).toMatchObject({ committed: false, storage: { health: 'uncertain' } });
    const restarted = new WorkflowStore(f.root); expect((await restarted.apply(runId, pause)).exitCode).not.toBe(0);
    const bytes = await readFile(join(f.root, runId, 'journal.jsonl'));
    const recovery = await restarted.recover(runId, point === 'beforeAppend' || point === 'partialWrite' ? 1 : 2);
    if (point === 'partialWrite') {
      expect(recovery.exitCode).not.toBe(0); expect(await readFile(join(f.root, runId, 'journal.jsonl'))).toEqual(bytes);
    } else {
      expect(recovery.exitCode).toBe(0); expect((await readdir(join(f.root, runId))).some(name => name.startsWith('intent.reconciled-'))).toBe(true);
      const replayed = await restarted.apply(runId, pause);
      expect(replayed.disposition).toBe(point === 'beforeAppend' ? 'accepted' : 'duplicate'); expect(replayed.state?.revision).toBe(2);
    }
  } finally { await f.clean(); }
});
it.each(['beforeJournalSync', 'beforeSnapshotSync'] as const)('handles an actual injected sync rejection at %s', async point => {
  const f = await fixture();
  try {
    const created = await f.store.create(event('run.created', identity));
    const faulty = new WorkflowStore(f.root, { fault: async (where, handle) => { if (where === point) vi.spyOn(handle!, 'sync').mockRejectedValue(Object.assign(new Error('synthetic'), { code: 'EIO' })); } });
    const result = await faulty.apply(runId, event('run.paused', {}, created.state));
    expect(result.committed).toBe(point === 'beforeSnapshotSync'); expect(result.exitCode).toBe(1);
    expect((await f.store.recover(runId, 2)).exitCode).toBe(0);
  } finally { await f.clean(); }
});
it('rebuilds missing/stale/corrupt snapshots, but refuses ahead, mismatched and future-version snapshots', async () => {
  const f = await fixture();
  try {
    await f.store.create(event('run.created', identity)); const path = join(f.root, runId, 'snapshot.json'); const baseline = await readFile(path);
    await rm(path); expect((await f.store.recover(runId, 1)).exitCode).toBe(0);
    await writeFile(path, '{'); expect((await f.store.recover(runId, 1)).exitCode).toBe(0);
    expect((await readdir(join(f.root, runId))).some(name => name.startsWith('snapshot.corrupt-'))).toBe(true);
    const snapshot = JSON.parse(baseline.toString());
    for (const [change, code] of [[{ sequence: 100 }, 'SNAPSHOT_AHEAD'], [{ headHash: 'f'.repeat(64) }, 'SNAPSHOT_MISMATCH'], [{ schemaVersion: 2 }, 'UNSUPPORTED_SCHEMA']] as const) {
      await writeFile(path, canonical({ ...snapshot, ...change }, LIMITS.snapshot)); const before = await readFile(path);
      expect((await f.store.recover(runId, 1)).storage.code).toBe(code); expect(await readFile(path)).toEqual(before);
    }
  } finally { await f.clean(); }
});
it('recovers in-flight metadata as interrupted, never settles it or grants approval', async () => {
  const f = await fixture();
  try {
    let result = await f.store.create(event('run.created', identity));
    result = await f.store.apply(runId, event('inputs.accepted', { input: ref }, result.state));
    result = await f.store.apply(runId, event('attempt.started', { attemptId: 'one' }, result.state), 'controller');
    const recovered = await f.store.recover(runId, result.state!.revision);
    expect(recovered.state).toMatchObject({ status: 'interrupted', attempts: [{ settled: false }] });
    expect((await f.store.apply(runId, event('run.cancelled', { reason }, recovered.state))).storage.code).toBe('ATTEMPT_UNSETTLED');
    const fixed = await f.store.apply(runId, event('attempt.reconciled', { attemptId: 'one', evidence: ref }, recovered.state), 'controller');
    const resumed = await f.store.apply(runId, event('run.resumed', {}, fixed.state)); expect(resumed.state?.status).toBe('ready');
  } finally { await f.clean(); }
});
it('preserves approval wait across restart/pause/resume and disables production approval/handoff admission', async () => {
  const f = await fixture();
  try {
    let result = await f.store.create(event('run.created', identity));
    for (const [type, payload] of [['inputs.accepted', { input: ref }], ['attempt.started', { attemptId: 'attempt-1' }], ['attempt.succeeded', { attemptId: 'attempt-1', report: ref }]] as const) result = await f.store.apply(runId, event(type, payload, result.state), 'controller');
    const state = result.state!;
    const synthetic = waiting();
    const approval = { ...ref, subject: { runId, repositoryId: state.repository.id, storyId: state.story.id, reviewedStage: 'po_approval' as const, reviewedRevision: synthetic.review!.revision, baselineSha: state.baselineSha, inputDigest: ref.digest, artifactDigest: ref.digest }, validity: 'active' as const };
    expect((await f.store.apply(runId, event('approval.validated', { approval }, state), 'controller')).storage.code).toBe('APPROVAL_ADMISSION_DISABLED');
    const recovered = await new WorkflowStore(f.root).recover(runId, state.revision);
    expect(recovered.state?.status).toBe('awaiting_approval'); expect(recovered.state?.approvalRefs).toEqual([]);
    const paused = await f.store.apply(runId, event('run.paused', {}, recovered.state));
    expect((await f.store.apply(runId, event('run.resumed', {}, paused.state))).state?.status).toBe('awaiting_approval');
  } finally { await f.clean(); }
});
it('allows read-only prefix inspection but no mutation across a torn or corrupt journal', async () => {
  const f = await fixture();
  try {
    await f.store.create(event('run.created', identity)); const path = join(f.root, runId, 'journal.jsonl');
    await appendFile(path, '{'); const before = await readFile(path);
    expect(await f.store.status(runId)).toMatchObject({ state: { revision: 1 }, storage: { code: 'TORN_JOURNAL_TAIL' } });
    await writeFile(join(f.root, runId, 'intent.json'), '{', { mode: 0o600 });
    expect(await f.store.status(runId)).toMatchObject({ state: { revision: 1 }, storage: { code: 'TORN_JOURNAL_TAIL' } });
    expect((await f.store.recover(runId, 1)).exitCode).not.toBe(0); expect(await readFile(path)).toEqual(before);
    await appendFile(path, '\nbad\n'); expect((await f.store.status(runId)).storage.code).toBe('JOURNAL_CORRUPT');
  } finally { await f.clean(); }
});
it('rejects oversized snapshots and malformed intents without repairing or hiding them', async () => {
  const f = await fixture();
  try {
    await f.store.create(event('run.created', identity)); const path = join(f.root, runId, 'snapshot.json'); const snapshot = await readFile(path);
    await writeFile(path, Buffer.alloc(LIMITS.snapshot + 1)); expect((await f.store.recover(runId, 1)).storage.code).toBe('RESOURCE_LIMIT');
    await writeFile(path, snapshot); const intent = join(f.root, runId, 'intent.json'); await writeFile(intent, '{', { mode: 0o600 });
    expect((await f.store.recover(runId, 1)).storage.code).toBe('INTENT_INVALID'); expect(await readFile(intent, 'utf8')).toBe('{');
  } finally { await f.clean(); }
});
it('rejects unsupported intent versions with exit 3 without modifying them', async () => {
  const f = await fixture();
  try {
    await f.store.create(event('run.created', identity)); const path = join(f.root, runId, 'intent.json');
    const bytes = canonical({ schemaVersion: 2, eventId: runId, inputDigest: ref.digest, sequence: 2, previousHash: ref.digest }); await writeFile(path, bytes, { mode: 0o600 });
    expect(await f.store.recover(runId, 1)).toMatchObject({ exitCode: 3, storage: { code: 'UNSUPPORTED_SCHEMA' } }); expect(await readFile(path, 'utf8')).toBe(bytes);
  } finally { await f.clean(); }
});
it('launches no process during recovery after a cold module restart', async () => {
  const f = await fixture(); let child: ReturnType<typeof worker> | undefined;
  try {
    await f.store.create(event('run.created', identity));
    child = worker(f.root, await compileRuntime(f.root), 'recover-cold');
    const result = await child.next(); expect(result.report?.exitCode).toBe(0); expect(result.processLaunchAttempts).toBe(0);
  } finally { await child?.stop(); await f.clean(); }
}, 10_000);
it.each(['commit', 'crash'] as const)('coordinates real controllers at a journal barrier and handles %s without dist output', async outcome => {
  const f = await fixture(); const workers: ReturnType<typeof worker>[] = [];
  try {
    await f.store.create(event('run.created', identity)); const runtime = await compileRuntime(f.root);
    const first = worker(f.root, runtime, 'store-hold'); workers.push(first); expect((await first.next()).phase).toBe('journal-written');
    const second = worker(f.root, runtime, 'store-pause'); workers.push(second);
    expect((await second.next()).report?.storage.code).toBe('LOCK_BUSY');
    if (outcome === 'commit') {
      const completion = first.next(); first.child.send!('go'); expect((await completion).report).toMatchObject({ committed: true, state: { revision: 2, status: 'paused' } });
    } else {
      const dir = await new StoragePaths(f.root).open(runId); const token = (await readLock(dir))!.owner.token; await first.stop();
      const recovery = new WorkflowStore(f.root, { lockEnvironment: { ...localLockEnvironment, identity: async () => ({ pid: process.pid, uid: process.getuid!(), host: hostname(), bootId: 'controlled-process-fixture', processStartedAt: new Date(performance.timeOrigin).toISOString() }) } });
      expect(await recovery.recover(runId, 2, { lockToken: token })).toMatchObject({ exitCode: 0, state: { revision: 2, status: 'paused' } });
    }
    const status = await f.store.status(runId); expect(status).toMatchObject({ exitCode: 0, state: { revision: 2, journalSequence: 2 } });
  } finally { await Promise.all(workers.map(w => w.stop())); await f.clean(); }
}, 10_000);

it('audits blocked settlement/cancellation after interruption and preserves obligations across restart', async () => {
  const f = await fixture();
  try {
    let result = await f.store.create(event('run.created', identity));
    result = await f.store.apply(runId, event('inputs.accepted', { input: ref }, result.state));
    result = await f.store.apply(runId, event('attempt.started', { attemptId: 'one' }, result.state), 'controller');
    result = await f.store.recover(runId, result.state!.revision);
    const interrupted = structuredClone(result.state!.attempts[0]);
    result = await f.store.apply(runId, event('run.blocked', { reason }, result.state));
    const restarted = new WorkflowStore(f.root);
    result = await restarted.recover(runId, result.state!.revision);
    const revision = result.state!.revision;
    const failedEvent = event('attempt.failed', { attemptId: 'one', reason }, result.state);
    result = await restarted.apply(runId, failedEvent, 'controller');
    expect(result).toMatchObject({ committed: true, disposition: 'rejected', storage: { code: 'RECONCILIATION_REQUIRED' }, state: { status: 'blocked', revision } });
    expect(result.state!.attempts).toEqual([interrupted]);
    const cancelEvent = event('run.cancelled', { reason }, result.state);
    result = await restarted.apply(runId, cancelEvent);
    expect(result).toMatchObject({ committed: true, disposition: 'rejected', storage: { code: 'ATTEMPT_UNSETTLED' }, state: { status: 'blocked', revision } });
    const afterRestart = await new WorkflowStore(f.root).recover(runId, revision);
    expect(afterRestart.state!.attempts).toEqual([interrupted]);
    const journalPath = join(f.root, runId, 'journal.jsonl');
    const audited = await readFile(journalPath, 'utf8');
    const records = audited.trimEnd().split('\n').map(line => JSON.parse(line));
    expect(records.slice(-2).map(record => [record.request.event.eventId, record.disposition, record.code])).toEqual([
      [failedEvent.eventId, 'rejected', 'RECONCILIATION_REQUIRED'], [cancelEvent.eventId, 'rejected', 'ATTEMPT_UNSETTLED'],
    ]);
    result = await restarted.apply(runId, event('attempt.reconciled', { attemptId: 'one', evidence: ref }, afterRestart.state), 'controller');
    expect(result).toMatchObject({ exitCode: 0, state: { status: 'blocked', attempts: [{ ...interrupted, settled: true, reconciliation: ref }] } });
    result = await new WorkflowStore(f.root).recover(runId, result.state!.revision);
    result = await restarted.apply(runId, event('run.resumed', {}, result.state));
    expect(result.state?.status).toBe('ready'); expect(result.state?.attempts[0].reason).toEqual(interrupted.reason);
    expect((await restarted.apply(runId, event('run.cancelled', { reason }, result.state))).state?.status).toBe('cancelled');
    expect((await readFile(journalPath, 'utf8')).startsWith(audited)).toBe(true);
  } finally { await f.clean(); }
});
it.each(['beforeAppend', 'partialWrite'] as const)('keeps an uninitialized creation blocked after %s across repeated recovery', async point => {
  const f = await fixture();
  try {
    const creation = event('run.created', identity);
    const faulty = new WorkflowStore(f.root, { fault: async (where, handle, bytes) => {
      if (point === 'partialWrite' && where === 'beforeWrite') { await handle!.write(bytes!.subarray(0, 12)); throw new Error('partial creation'); }
      if (where === point) throw new Error('creation append failure');
    } });
    expect(await faulty.create(creation)).toMatchObject({ committed: false, state: null, exitCode: 1, storage: { health: 'uncertain' } });
    const directory = join(f.root, runId); const journalPath = join(directory, 'journal.jsonl'); const intentPath = join(directory, 'intent.json');
    const journal = await readFile(journalPath); const intent = await readFile(intentPath); const names = await readdir(directory);
    expect(journal.length).toBe(point === 'beforeAppend' ? 0 : 12);
    for (let restart = 0; restart < 2; restart++) {
      const store = new WorkflowStore(f.root);
      for (const result of [await store.status(runId), await store.recover(runId, 0), await store.apply(runId, creation)]) {
        expect(result).toMatchObject({ state: null, committed: false, exitCode: 1, storage: { health: 'blocked', code: point === 'beforeAppend' ? 'RUN_UNINITIALIZED' : 'TORN_JOURNAL_TAIL' } });
      }
      expect((await store.create(creation)).exitCode).not.toBe(0);
      expect(await readFile(journalPath)).toEqual(journal); expect(await readFile(intentPath)).toEqual(intent);
      expect(await readdir(directory)).toEqual(names); expect(names).not.toContain('snapshot.json');
    }
  } finally { await f.clean(); }
});
it.each(['beforeJournalSync', 'afterJournalSync'] as const)('recovers complete unacknowledged creation at %s without recreating it', async point => {
  const f = await fixture();
  try {
    const creation = event('run.created', identity);
    const faulty = new WorkflowStore(f.root, { fault: async where => { if (where === point) throw new Error('creation acknowledgement failure'); } });
    expect(await faulty.create(creation)).toMatchObject({ committed: false, state: null, exitCode: 1, storage: { health: 'uncertain' } });
    const directory = join(f.root, runId); const journalPath = join(directory, 'journal.jsonl');
    const journal = await readFile(journalPath); const intent = await readFile(join(directory, 'intent.json'));
    expect(journal.toString().trimEnd().split('\n')).toHaveLength(1);
    expect((await new WorkflowStore(f.root).status(runId)).storage.health).toBe('recovery_required');
    for (let restart = 0; restart < 2; restart++) {
      const store = new WorkflowStore(f.root);
      expect(await store.recover(runId, 1)).toMatchObject({ exitCode: 0, storage: { health: 'ok' }, state: { runId, revision: 1, journalSequence: 1, status: 'ready', attempts: [] } });
      expect((await store.status(runId)).state?.revision).toBe(1);
      expect(await readFile(journalPath)).toEqual(journal);
      const archives = (await readdir(directory)).filter(name => name.startsWith('intent.reconciled-'));
      expect(archives).toHaveLength(1); expect(await readFile(join(directory, archives[0]))).toEqual(intent);
    }
    expect((await f.store.apply(runId, creation)).disposition).toBe('duplicate');
  } finally { await f.clean(); }
});
it('refuses a healthy null checkpoint without committed creation even when no intent survives', async () => {
  const f = await fixture();
  try {
    const creation = event('run.created', identity);
    const faulty = new WorkflowStore(f.root, { fault: async where => { if (where === 'beforeAppend') throw new Error('creation failure'); } });
    await faulty.create(creation);
    const directory = join(f.root, runId); await rm(join(directory, 'intent.json'));
    const snapshot = canonical({ schemaVersion: 1, sequence: 0, headHash: '0'.repeat(64), state: null });
    await writeFile(join(directory, 'snapshot.json'), snapshot, { mode: 0o600 });
    expect(await f.store.status(runId)).toMatchObject({ state: null, exitCode: 1, storage: { health: 'blocked', code: 'RUN_UNINITIALIZED' } });
    expect(await f.store.recover(runId, 0)).toMatchObject({ state: null, exitCode: 1, storage: { health: 'blocked', code: 'RUN_UNINITIALIZED' } });
    expect((await f.store.apply(runId, creation)).exitCode).toBe(1);
    expect(await readFile(join(directory, 'snapshot.json'), 'utf8')).toBe(snapshot);
    expect(await readFile(join(directory, 'journal.jsonl'), 'utf8')).toBe('');
  } finally { await f.clean(); }
});
