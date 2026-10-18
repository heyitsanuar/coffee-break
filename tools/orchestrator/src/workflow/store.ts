import { randomUUID } from 'node:crypto';
import { canonical, demand, digest, hash, integer, LIMITS, object, parseEvent, parseState, uuid, version, WorkflowError, type RunState } from './contracts.js';
import { acquire, localLockEnvironment, readLock, reconcileLock, type LockEnvironment } from './lock.js';
import { appendRecord, makeRecord, noFault, replay, stateAfter, type Fault, type JournalView, type Origin } from './journal.js';
import type { Disposition } from './reducer.js';
import { StoragePaths, type RunDirectory } from './paths.js';
import { ArtifactStore, bindBundle, type ArtifactFault } from '../inputs/artifacts.js';
import type { PreparedBundle } from '../inputs/bundle.js';
import type { Reference } from './contracts.js';

type SnapshotHealth = 'current' | 'missing' | 'stale' | 'corrupt' | 'ahead' | 'mismatch' | 'unsupported' | 'not_checked';
type Health = 'ok' | 'blocked' | 'busy' | 'recovery_required' | 'uncertain' | 'snapshot_stale';
export interface Operation {
  schemaVersion: 1; runId: string; state: RunState | null; committed: boolean; disposition: Disposition | null;
  originalDisposition: Disposition | null; originalSequence: number | null; eventId: string | null; inputDigest: string | null;
  storage: { health: Health; code: string; snapshot: SnapshotHealth | null }; exitCode: number; lockToken?: string;
}
interface SnapshotCheck { health: SnapshotHealth; bytes: Buffer | null }
interface Intent { schemaVersion: 1; eventId: string | null; inputDigest: string; sequence: number; previousHash: string }
interface Inspection { view: JournalView; snapshot: SnapshotCheck; intent: Intent | null }
function operation(id: string, state: RunState | null, health: Health, code: string, exitCode = health === 'ok' ? 0 : 1): Operation {
  return { schemaVersion: 1, runId: id, state, committed: false, disposition: null, originalDisposition: null, originalSequence: null, eventId: null, inputDigest: null, storage: { health, code, snapshot: null }, exitCode };
}
function errorCode(error: unknown): string {
  if (error instanceof WorkflowError) return error.code;
  const errno = (error as NodeJS.ErrnoException)?.code;
  return errno && /^E[A-Z]+$/.test(errno) ? `IO_${errno}` : 'IO_FAILURE';
}
async function inspectSnapshot(dir: RunDirectory, view: JournalView): Promise<SnapshotCheck> {
  const bytes = await dir.read('snapshot.json', LIMITS.snapshot); if (!bytes) return { health: 'missing', bytes: null };
  try {
    const s = object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), ['schemaVersion', 'sequence', 'headHash', 'state']);
    version(s.schemaVersion); integer(s.sequence); digest(s.headHash);
    if (s.sequence > view.records.length) return { health: 'ahead', bytes };
    if (s.state !== null) parseState(s.state);
    const record = s.sequence ? view.records[s.sequence - 1] : null;
    if (s.headHash !== (record?.hash ?? '0'.repeat(64)) || hash(s.state, LIMITS.snapshot) !== (record?.stateDigest ?? hash(null)) || s.state !== null && (s.state as RunState).journalSequence !== s.sequence) return { health: 'mismatch', bytes };
    return { health: s.sequence === view.records.length ? 'current' : 'stale', bytes };
  } catch (error) { return { health: error instanceof WorkflowError && error.code === 'UNSUPPORTED_SCHEMA' ? 'unsupported' : 'corrupt', bytes }; }
}
async function readIntent(dir: RunDirectory): Promise<Intent | null> {
  const bytes = await dir.read('intent.json', LIMITS.lock); if (!bytes) return null;
  try {
    const o = object(JSON.parse(bytes.toString('utf8')), ['schemaVersion', 'eventId', 'inputDigest', 'sequence', 'previousHash']);
    version(o.schemaVersion); if (o.eventId !== null) uuid(o.eventId); digest(o.inputDigest); integer(o.sequence); demand(o.sequence > 0); digest(o.previousHash);
    return o as unknown as Intent;
  } catch (error) { if (error instanceof WorkflowError && error.code === 'UNSUPPORTED_SCHEMA') throw error; throw new WorkflowError('INTENT_INVALID'); }
}
function assertReplay(view: JournalView): void { demand(view.health === 'ok', view.code ?? 'JOURNAL_BLOCKED'); }
function assertSnapshot(snapshot: SnapshotCheck): void {
  if (snapshot.health === 'unsupported') throw new WorkflowError('UNSUPPORTED_SCHEMA', 3);
  demand(snapshot.health !== 'ahead', 'SNAPSHOT_AHEAD'); demand(snapshot.health !== 'mismatch', 'SNAPSHOT_MISMATCH');
}
export class WorkflowStore {
  private readonly paths: StoragePaths;
  private readonly fault: Fault;
  private readonly environment: LockEnvironment;
  private readonly artifactFault?: ArtifactFault;
  constructor(root?: string, options: { fault?: Fault; lockEnvironment?: LockEnvironment; artifactFault?: ArtifactFault } = {}) {
    this.paths = new StoragePaths(root); this.fault = options.fault ?? noFault; this.environment = options.lockEnvironment ?? localLockEnvironment;
    this.artifactFault = options.artifactFault;
  }
  private failure(id: string, error: unknown, state: RunState | null = null): Operation {
    const code = errorCode(error); return operation(id, state, code === 'LOCK_BUSY' ? 'busy' : 'blocked', code, error instanceof WorkflowError ? error.exitCode : 1);
  }
  private async inspect(dir: RunDirectory, id: string): Promise<Inspection> {
    const view = await replay(dir); demand(!view.state || view.state.runId === id, 'RUN_MISMATCH');
    // A broken journal is already an absolute write barrier. Preserve inspection
    // of its verified prefix even if secondary checkpoint/intent data is broken.
    if (view.health !== 'ok') return { view, snapshot: { health: 'not_checked', bytes: null }, intent: null };
    return { view, snapshot: await inspectSnapshot(dir, view), intent: await readIntent(dir) };
  }
  private report(id: string, check: Inspection): Operation {
    const { view, snapshot, intent } = check;
    let result: Operation;
    if (view.health !== 'ok') result = operation(id, view.state, 'blocked', view.code!, view.health === 'unsupported' ? 3 : 1);
    else if (snapshot.health === 'ahead' || snapshot.health === 'mismatch' || snapshot.health === 'unsupported') result = operation(id, view.state, 'blocked', snapshot.health === 'unsupported' ? 'UNSUPPORTED_SCHEMA' : `SNAPSHOT_${snapshot.health.toUpperCase()}`, snapshot.health === 'unsupported' ? 3 : 1);
    else if (!view.state) result = operation(id, null, 'blocked', 'RUN_UNINITIALIZED');
    else if (intent || snapshot.health !== 'current') result = operation(id, view.state, 'recovery_required', 'RECOVERY_REQUIRED');
    else result = operation(id, view.state, 'ok', 'OK');
    result.storage.snapshot = snapshot.health; return result;
  }
  async status(id: string): Promise<Operation> {
    try {
      const dir = await this.paths.open(id); const lock = await readLock(dir);
      if (lock) return { ...operation(id, null, 'busy', 'LOCK_BUSY'), lockToken: lock.owner.token };
      const check = await this.inspect(dir, id);
      demand(!await readLock(dir) && (await dir.inspect('journal.jsonl'))?.stat.size === BigInt(check.view.bytes), 'CONCURRENT_CHANGE'); return this.report(id, check);
    } catch (error) { return this.failure(id, error); }
  }
  private async owned(id: string, action: (dir: RunDirectory, writerToken: string) => Promise<Operation>, lockToken?: string): Promise<Operation> {
    let result: Operation; let lease: Awaited<ReturnType<typeof acquire>> | undefined;
    try {
      const dir = await this.paths.open(id);
      if (lockToken !== undefined) await reconcileLock(dir, lockToken, this.environment);
      lease = await acquire(dir, this.environment); result = await action(dir, lease.owner.token);
    } catch (error) { result = this.failure(id, error); }
    if (lease) {
      try { await lease.release(); } catch { result.storage = { ...result.storage, health: 'blocked', code: 'LOCK_RELEASE_FAILED' }; result.exitCode = 1; }
    }
    return result;
  }
  async create(input: unknown): Promise<Operation> {
    let id = '';
    try {
      const event = parseEvent(input); id = event.runId;
      demand(event.type === 'run.created' && event.expectedRevision === 0, 'INVALID_CREATION');
      const dir = await this.paths.create(id); await dir.create('journal.jsonl', Buffer.alloc(0)); await dir.sync();
      return this.owned(id, async owned => this.commit(owned, await replay(owned), event, 'operator'));
    } catch (error) { return this.failure(id, error); }
  }
  async apply(id: string, input: unknown, origin: Origin = 'operator'): Promise<Operation> {
    return this.owned(id, async dir => {
      const check = await this.inspect(dir, id); const report = this.report(id, check); if (report.exitCode) return report;
      // Legacy opaque references remain metadata only. New bundle references
      // cannot bypass artifact verification through the existing event API.
      // Pending-input identity is reduced by makeRecord for BOTH entry points;
      // rejected substitutions still commit an audit record and replay safely.
      const event = (() => { try { return parseEvent(input); } catch { return null; } })();
      if (event && (event.type === 'inputs.accepted' || event.type === 'inputs.changed') && event.payload.input.id.startsWith('bundle-v1:') && makeRecord(check.view, input, origin).disposition === 'accepted') await new ArtifactStore(dir).verifyBundle(event.payload.input, check.view.state!);
      if (event?.type === 'attempt.started' && check.view.state?.input?.id.startsWith('bundle-v1:') && makeRecord(check.view, input, origin).disposition === 'accepted') await new ArtifactStore(dir).verifyBundle(check.view.state.input, check.view.state);
      return this.commit(dir, check.view, input, origin);
    });
  }
  async publishInputs(id: string, expectedRevision: number, prepared: PreparedBundle): Promise<Operation & { artifact?: { reference: Reference; captureId: string } }> {
    return this.owned(id, async (dir, writerToken) => {
      const check = await this.inspect(dir, id); const report = this.report(id, check); if (report.exitCode) return report;
      demand(check.view.state?.revision === expectedRevision, 'STALE_REVISION');
      bindBundle(prepared.core, prepared.capture, check.view.state);
      const reference = await new ArtifactStore(dir, { fault: this.artifactFault, writerToken }).publishBundle(prepared);
      return Object.assign(operation(id, check.view.state, 'ok', 'BUNDLE_PUBLISHED'), { artifact: { reference, captureId: prepared.capture.id } });
    });
  }
  async attachInputs(id: string, expectedRevision: number, reference: Reference, mode: 'accept' | 'replace', metadata: { eventId?: string; at?: string } = {}): Promise<Operation> {
    return this.owned(id, async dir => {
      const check = await this.inspect(dir, id); const report = this.report(id, check); if (report.exitCode) return report;
      const state = check.view.state!;
      demand(mode === 'accept' || mode === 'replace', 'INVALID_ARGUMENTS');
      const event = { schemaVersion: 1, runId: id, eventId: metadata.eventId ?? randomUUID(), at: metadata.at ?? this.environment.now(), expectedRevision, type: mode === 'accept' ? 'inputs.accepted' : 'inputs.changed', payload: { input: reference } };
      if (makeRecord(check.view, event, 'operator').disposition !== 'accepted') return this.commit(dir, check.view, event, 'operator');
      await new ArtifactStore(dir).verifyBundle(reference, state);
      if (mode === 'accept') demand(state.stage === 'inputs' && (!state.input || canonical(state.input) === canonical(reference)), 'INPUT_REPLACEMENT_REQUIRED');
      else demand(state.input && canonical(state.input) !== canonical(reference), 'INPUT_REPLACEMENT_REQUIRED');
      return this.commit(dir, check.view, event, 'operator');
    });
  }
  async verifyInputs(id: string, candidate?: Reference): Promise<Awaited<ReturnType<ArtifactStore['verifyBundle']>> & { state: RunState; active: boolean }> {
    const first = await this.status(id); demand(first.exitCode === 0 && first.state, first.storage.code); const reference = candidate ?? first.state.input; demand(reference, 'INPUTS_REQUIRED');
    const result = await new ArtifactStore(await this.paths.open(id)).verifyBundle(reference, first.state);
    const last = await this.status(id); demand(last.exitCode === 0 && last.state?.journalSequence === first.state.journalSequence, 'CONCURRENT_CHANGE');
    return { ...result, state: first.state, active: first.state.input !== null && canonical(reference) === canonical(first.state.input) };
  }
  private async snapshot(dir: RunDirectory, view: JournalView): Promise<void> {
    const bytes = Buffer.from(canonical({ schemaVersion: 1, sequence: view.records.length, headHash: view.headHash, state: view.state }, LIMITS.snapshot));
    const name = dir.temporary('snapshot.tmp'); await dir.create(name, bytes, handle => this.fault('beforeSnapshotSync', handle));
    await this.fault('beforeSnapshotRename');
    await dir.move(name, 'snapshot.json', true); await this.fault('afterSnapshotRename'); await dir.sync();
  }
  private async archiveIntent(dir: RunDirectory): Promise<void> {
    await dir.move('intent.json', dir.temporary('intent.reconciled')); await dir.sync();
  }
  private async commit(dir: RunDirectory, view: JournalView, input: unknown, origin: Origin): Promise<Operation> {
    const id = dir.path.split(/[\\/]/).at(-1)!;
    const record = makeRecord(view, input, origin);
    const projectedState = stateAfter(view, record);
    // Reject an unrepresentable checkpoint before committing its transition.
    canonical({ schemaVersion: 1, sequence: record.sequence, headHash: record.hash, state: projectedState }, LIMITS.snapshot);
    const result = operation(id, view.state, 'uncertain', 'DURABILITY_UNCERTAIN');
    Object.assign(result, { disposition: record.disposition, originalDisposition: record.originalDisposition, originalSequence: record.originalSequence, eventId: record.request.eventId, inputDigest: record.request.inputDigest });
    const intent: Intent = { schemaVersion: 1, eventId: record.request.eventId, inputDigest: record.request.inputDigest, sequence: record.sequence, previousHash: record.previousHash };
    try {
      // A durable intent fences future writers even if append/sync completion is
      // unknown after a crash. It is never a committed workflow transition.
      await dir.create('intent.json', Buffer.from(canonical(intent))); await dir.sync();
      await appendRecord(dir, view, record, this.fault);
    } catch { return result; }
    const next: JournalView = { ...view, records: [...view.records, record], state: projectedState, headHash: record.hash, bytes: view.bytes + Buffer.byteLength(canonical(record, LIMITS.record)) + 1 };
    result.committed = true; result.state = next.state;
    try { await this.snapshot(dir, next); await dir.remove('intent.json'); await dir.sync(); }
    catch { result.storage = { health: 'snapshot_stale', code: 'COMMITTED_SNAPSHOT_STALE', snapshot: 'stale' }; result.exitCode = 1; return result; }
    result.storage = { health: 'ok', code: record.code, snapshot: 'current' };
    result.exitCode = record.disposition === 'accepted' || record.disposition === 'duplicate' && record.originalDisposition === 'accepted' ? 0 : record.code === 'UNSUPPORTED_SCHEMA' ? 3 : 1;
    return result;
  }
  async recover(id: string, expectedRevision: number, options: { lockToken?: string; eventId?: string; at?: string } = {}): Promise<Operation> {
    return this.owned(id, async dir => {
      const check = await this.inspect(dir, id); const { view, snapshot, intent } = check;
      // An intent is uncertainty evidence, never a committed run identity. Do
      // not checkpoint null state or archive that evidence as reconciled.
      if (view.health !== 'ok' || !view.state || ['ahead', 'mismatch', 'unsupported'].includes(snapshot.health)) return this.report(id, check);
      assertReplay(view); assertSnapshot(snapshot);
      if ((view.state?.revision ?? 0) !== expectedRevision) return operation(id, view.state, 'blocked', 'STALE_REVISION');
      if (intent) {
        demand(intent.sequence <= view.records.length + 1, 'INTENT_MISMATCH');
        const previous = intent.sequence > 1 ? view.records[intent.sequence - 2]?.hash : '0'.repeat(64);
        demand(previous === intent.previousHash, 'INTENT_MISMATCH');
        const record = view.records[intent.sequence - 1];
        demand(!record || record.request.inputDigest === intent.inputDigest && record.request.eventId === intent.eventId, 'INTENT_MISMATCH');
      }
      // Establish the recovered complete prefix at the current durability
      // boundary. Never append, truncate or reinterpret a torn final record.
      const handle = await dir.openAppend('journal.jsonl'); try { await handle.sync(); } finally { await handle.close(); }
      if (snapshot.health === 'corrupt' && snapshot.bytes) { await dir.create(dir.temporary('snapshot.corrupt'), snapshot.bytes); await dir.sync(); }
      await this.snapshot(dir, view);
      if (intent) await this.archiveIntent(dir);
      const pending = view.state?.attempts.find(attempt => !attempt.settled && attempt.status === 'running');
      if (pending) {
        return this.commit(dir, view, { schemaVersion: 1, runId: id, eventId: options.eventId ?? randomUUID(), expectedRevision, at: options.at ?? this.environment.now(), type: 'attempt.interrupted', payload: { attemptId: pending.id, reason: { code: 'RECOVERY_RECONCILIATION_REQUIRED', evidence: [] } } }, 'recovery');
      }
      const result = operation(id, view.state, 'ok', intent ? 'RECOVERED_UNCERTAINTY' : 'RECOVERED'); result.storage.snapshot = 'current'; return result;
    }, options.lockToken);
  }
}
