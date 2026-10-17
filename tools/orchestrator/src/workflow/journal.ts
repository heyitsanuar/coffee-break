import type { FileHandle } from 'node:fs/promises';
import { canonical, demand, digest, hash, integer, LIMITS, object, parseEvent, parseState, uuid, version, WorkflowError, type RunState, type WorkflowEvent } from './contracts.js';
import { approvalEvent, reduce, type Disposition } from './reducer.js';
import { writeAll, type RunDirectory } from './paths.js';

export type Origin = 'operator' | 'controller' | 'recovery';
export interface Request { event: WorkflowEvent | null; eventId: string | null; inputDigest: string; validationCode: string | null }
export interface JournalRecord {
  schemaVersion: 1; sequence: number; request: Request; origin: Origin; disposition: Disposition; code: string;
  originalSequence: number | null; originalDisposition: Disposition | null; fromRevision: number; toRevision: number;
  stateDigest: string; previousHash: string; hash: string;
}
export interface JournalView { records: JournalRecord[]; state: RunState | null; headHash: string; bytes: number; health: 'ok' | 'torn' | 'corrupt' | 'unsupported' | 'limit'; code: string | null }
export type FaultPoint = 'beforeAppend' | 'beforeWrite' | 'beforeJournalSync' | 'afterJournalSync' | 'beforeSnapshotSync' | 'beforeSnapshotRename' | 'afterSnapshotRename';
export type Fault = (point: FaultPoint, handle?: FileHandle, bytes?: Buffer) => Promise<void>;
export const noFault: Fault = async () => {};
export const emptyView = (): JournalView => ({ records: [], state: null, headHash: '0'.repeat(64), bytes: 0, health: 'ok', code: null });
function normalize(input: unknown): Request {
  const inputDigest = hash(input); let eventId: string | null = null;
  try { const claimed = (input as Record<string, unknown>)?.eventId; uuid(claimed); eventId = claimed; } catch { /* unaddressable malformed event */ }
  try { return { event: structuredClone(parseEvent(input)), eventId, inputDigest, validationCode: null }; }
  catch (error) { return { event: null, eventId, inputDigest, validationCode: error instanceof WorkflowError ? error.code : 'INVALID_SCHEMA' }; }
}
function result(view: JournalView, request: Request): { disposition: Disposition; code: string; state: RunState | null; originalSequence: number | null; originalDisposition: Disposition | null } {
  const original = request.eventId ? view.records.find(record => record.request.eventId === request.eventId) : undefined;
  if (original) return {
    disposition: original.request.inputDigest === request.inputDigest ? 'duplicate' : 'conflict',
    code: original.request.inputDigest === request.inputDigest ? 'DUPLICATE' : 'EVENT_ID_CONFLICT', state: view.state,
    originalSequence: original.sequence, originalDisposition: original.disposition,
  };
  if (!request.event) return { disposition: 'rejected', code: request.validationCode!, state: view.state, originalSequence: null, originalDisposition: null };
  // Intentionally no production override, verifier flag, role or actor escape.
  const reduced = approvalEvent(request.event) ? { disposition: 'rejected' as const, code: 'APPROVAL_ADMISSION_DISABLED', state: view.state } : reduce(view.state, request.event);
  return { ...reduced, originalSequence: null, originalDisposition: null };
}
export function stateAfter(view: JournalView, record: JournalRecord): RunState | null {
  const next = result(view, record.request).state;
  return next ? parseState({ ...next, journalSequence: record.sequence }) : null;
}
function build(view: JournalView, request: Request, origin: Origin): JournalRecord {
  const decision = result(view, request); const sequence = view.records.length + 1;
  const next = decision.state ? { ...decision.state, journalSequence: sequence } : null;
  if (next) parseState(next);
  const body = {
    schemaVersion: 1 as const, sequence, request, origin, disposition: decision.disposition, code: decision.code,
    originalSequence: decision.originalSequence, originalDisposition: decision.originalDisposition,
    fromRevision: view.state?.revision ?? 0, toRevision: next?.revision ?? 0,
    stateDigest: hash(next, LIMITS.snapshot), previousHash: view.headHash,
  };
  return { ...body, hash: hash(body, LIMITS.record) };
}
export function makeRecord(view: JournalView, input: unknown, origin: Origin): JournalRecord {
  demand(view.health === 'ok', 'JOURNAL_BLOCKED'); demand(view.records.length < LIMITS.records, 'RESOURCE_LIMIT');
  demand(['operator', 'controller', 'recovery'].includes(origin), 'INVALID_ORIGIN');
  const record = build(view, normalize(input), origin); canonical(record, LIMITS.record); return record;
}
function parseRecord(value: unknown): JournalRecord {
  const r = object(value, ['schemaVersion', 'sequence', 'request', 'origin', 'disposition', 'code', 'originalSequence', 'originalDisposition', 'fromRevision', 'toRevision', 'stateDigest', 'previousHash', 'hash']);
  version(r.schemaVersion); integer(r.sequence); demand(r.sequence > 0); integer(r.fromRevision); integer(r.toRevision);
  demand(['operator', 'controller', 'recovery'].includes(String(r.origin)) && ['accepted', 'rejected', 'stale', 'conflict', 'duplicate'].includes(String(r.disposition)));
  demand(typeof r.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(r.code));
  if (r.originalSequence !== null) integer(r.originalSequence);
  demand(r.originalDisposition === null || ['accepted', 'rejected', 'stale', 'conflict', 'duplicate'].includes(String(r.originalDisposition)));
  digest(r.stateDigest); digest(r.previousHash); digest(r.hash);
  const q = object(r.request, ['event', 'eventId', 'inputDigest', 'validationCode']); digest(q.inputDigest);
  if (q.eventId !== null) uuid(q.eventId);
  if (q.event !== null) { parseEvent(q.event); demand(q.eventId === (q.event as WorkflowEvent).eventId && q.inputDigest === hash(q.event) && q.validationCode === null); }
  else demand(typeof q.validationCode === 'string' && ['INVALID_SCHEMA', 'INVALID_RUN_OR_EVENT_ID', 'UNSUPPORTED_SCHEMA', 'UNKNOWN_EVENT', 'RESOURCE_LIMIT'].includes(q.validationCode));
  return value as JournalRecord;
}
export async function replay(dir: RunDirectory): Promise<JournalView> {
  const view = emptyView(); const bytes = await dir.read('journal.jsonl', LIMITS.journal);
  demand(bytes !== null, 'JOURNAL_MISSING'); view.bytes = bytes.length;
  let offset = 0;
  while (offset < bytes.length) {
    if (view.records.length >= LIMITS.records) return { ...view, health: 'limit', code: 'RESOURCE_LIMIT' };
    const end = bytes.indexOf(10, offset);
    if (end === -1) return bytes.length - offset > LIMITS.record ? { ...view, health: 'limit', code: 'RESOURCE_LIMIT' } : { ...view, health: 'torn', code: 'TORN_JOURNAL_TAIL' };
    const line = bytes.subarray(offset, end);
    if (!line.length || line.length > LIMITS.record) return { ...view, health: line.length > LIMITS.record ? 'limit' : 'corrupt', code: line.length > LIMITS.record ? 'RESOURCE_LIMIT' : 'JOURNAL_CORRUPT' };
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(line);
      const record = parseRecord(JSON.parse(decoded));
      demand(record.sequence === view.records.length + 1 && record.previousHash === view.headHash, 'JOURNAL_CORRUPT');
      const expected = build(view, record.request, record.origin);
      demand(canonical(expected, LIMITS.record) === canonical(record, LIMITS.record), 'JOURNAL_CORRUPT');
      view.state = stateAfter(view, record); view.records.push(record); view.headHash = record.hash;
    } catch (error) { return { ...view, health: error instanceof WorkflowError && error.code === 'UNSUPPORTED_SCHEMA' ? 'unsupported' : 'corrupt', code: error instanceof WorkflowError && error.code === 'UNSUPPORTED_SCHEMA' ? error.code : 'JOURNAL_CORRUPT' }; }
    offset = end + 1;
  }
  return view;
}
export async function appendRecord(dir: RunDirectory, view: JournalView, record: JournalRecord, fault: Fault = noFault): Promise<void> {
  demand(view.health === 'ok' && record.sequence === view.records.length + 1 && record.previousHash === view.headHash, 'JOURNAL_BLOCKED');
  const bytes = Buffer.from(canonical(record, LIMITS.record) + '\n'); demand(view.bytes + bytes.length <= LIMITS.journal && record.sequence <= LIMITS.records, 'RESOURCE_LIMIT');
  await fault('beforeAppend'); const handle = await dir.openAppend('journal.jsonl');
  try {
    demand((await handle.stat()).size === view.bytes, 'JOURNAL_CHANGED');
    await fault('beforeWrite', handle, bytes); await writeAll(handle, bytes);
    await fault('beforeJournalSync', handle); await handle.sync();
    await fault('afterJournalSync', handle);
  } finally { await handle.close(); }
}
