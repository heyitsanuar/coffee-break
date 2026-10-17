import { isAbsolute } from 'node:path';
import { sha256 } from '../policy.js';

export const LIMITS = { event: 16_384, record: 32_768, snapshot: 1_048_576, journal: 16_777_216, records: 10_000, lock: 4_096, cli: 16_384, references: 1_024 } as const;
export class WorkflowError extends Error {
  constructor(public readonly code: string, public readonly exitCode = 1) { super(code); }
}
export function demand(condition: unknown, code = 'INVALID_SCHEMA'): asserts condition { if (!condition) throw new WorkflowError(code); }
export function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  demand(value !== null && typeof value === 'object' && !Array.isArray(value));
  const result = value as Record<string, unknown>;
  demand(Object.keys(result).length === keys.length && keys.every(key => Object.hasOwn(result, key)));
  return result;
}
export function version(value: unknown): void { if (value !== 1) throw new WorkflowError('UNSUPPORTED_SCHEMA', 3); }
export function text(value: unknown, maximum = 256): asserts value is string { demand(typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= maximum && !/[\x00-\x1f\x7f]/.test(value)); }
export function integer(value: unknown): asserts value is number { demand(Number.isSafeInteger(value) && Number(value) >= 0); }
export function uuid(value: unknown): asserts value is string { demand(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value), 'INVALID_RUN_OR_EVENT_ID'); }
export function digest(value: unknown): asserts value is string { demand(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)); }
export function timestamp(value: unknown): asserts value is string { demand(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value); }
export function canonical(value: unknown, maximum: number = LIMITS.event): string {
  let nodes = 0;
  const visit = (item: unknown, depth: number): unknown => {
    demand(depth <= 16 && ++nodes <= 20_000, 'RESOURCE_LIMIT');
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'string') { demand(Buffer.byteLength(item) <= maximum, 'RESOURCE_LIMIT'); return item; }
    if (typeof item === 'number') { demand(Number.isFinite(item)); return item; }
    demand(typeof item === 'object' && (Array.isArray(item) || Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null));
    if (Array.isArray(item)) return item.map(child => visit(child, depth + 1));
    return Object.fromEntries(Object.keys(item as object).sort().map(key => [key, visit((item as Record<string, unknown>)[key], depth + 1)]));
  };
  const encoded = JSON.stringify(visit(value, 0));
  demand(Buffer.byteLength(encoded) <= maximum, 'RESOURCE_LIMIT'); return encoded;
}
export const hash = (value: unknown, maximum: number = LIMITS.event): string => sha256(canonical(value, maximum));
export interface Reference { id: string; digest: string }
export interface Reason { code: string; evidence: Reference[] }
export interface Repository { id: string; root: string }
export interface Story { id: string; issue: number }
export const STAGES = ['inputs', 'designer_review', 'po_approval', 'handoff'] as const;
export const STATUSES = ['ready', 'in_flight', 'awaiting_approval', 'paused', 'blocked', 'failed', 'interrupted', 'approved', 'handoff_ready', 'cancelled'] as const;
export type Stage = typeof STAGES[number];
export type Status = typeof STATUSES[number];
export interface Attempt { id: string; status: 'running' | 'succeeded' | 'failed' | 'interrupted'; settled: boolean; startedAt: string; endedAt: string | null; report: Reference | null; reason: Reason | null; reconciliation: Reference | null }
export interface Review { revision: number; artifact: Reference; inputDigest: string }
export interface ApprovalReference extends Reference {
  subject: { runId: string; repositoryId: string; storyId: string; reviewedStage: 'po_approval'; reviewedRevision: number; baselineSha: string; inputDigest: string; artifactDigest: string };
  validity: 'active' | 'stale';
}
export interface RunState {
  schemaVersion: 1; runId: string; repository: Repository; story: Story; baselineSha: string;
  stage: Stage; status: Status; revision: number; journalSequence: number;
  input: Reference | null; attempts: Attempt[]; approvalRefs: ApprovalReference[]; review: Review | null;
  reason: Reason | null; evidence: Reference[]; pausedFrom: Status | null; handoff: Reference | null;
  createdAt: string; updatedAt: string;
}
export interface Payloads {
  'run.created': { repository: Repository; story: Story; baselineSha: string };
  'inputs.accepted': { input: Reference };
  'inputs.changed': { input: Reference };
  'attempt.started': { attemptId: string };
  'attempt.succeeded': { attemptId: string; report: Reference };
  'attempt.failed': { attemptId: string; reason: Reason };
  'attempt.interrupted': { attemptId: string; reason: Reason };
  'attempt.reconciled': { attemptId: string; evidence: Reference };
  'run.blocked': { reason: Reason };
  'run.paused': Record<string, never>;
  'run.resumed': Record<string, never>;
  'run.cancelled': { reason: Reason };
  'approval.validated': { approval: ApprovalReference };
  'handoff.recorded': { approvalId: string; artifact: Reference };
}
export type EventType = keyof Payloads;
export type WorkflowEvent = { [K in EventType]: { schemaVersion: 1; eventId: string; runId: string; expectedRevision: number; at: string; type: K; payload: Payloads[K] } }[EventType];
export const EVENT_FIELDS = ['schemaVersion', 'eventId', 'runId', 'expectedRevision', 'at', 'type', 'payload'] as const;
export function reference(value: unknown): void { const o = object(value, ['id', 'digest']); text(o.id); digest(o.digest); }
function references(value: unknown, limit: number = LIMITS.references): void { demand(Array.isArray(value) && value.length <= limit, 'RESOURCE_LIMIT'); value.forEach(reference); }
export function reason(value: unknown): void { const o = object(value, ['code', 'evidence']); demand(typeof o.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(o.code)); references(o.evidence, 32); }
function baseline(value: unknown): void { demand(typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)); }
function repository(value: unknown): void { const o = object(value, ['id', 'root']); text(o.id); text(o.root, 4_096); demand(isAbsolute(o.root)); }
function story(value: unknown): void { const o = object(value, ['id', 'issue']); text(o.id); integer(o.issue); demand(o.issue > 0); }
function approval(value: unknown): void {
  const o = object(value, ['id', 'digest', 'subject', 'validity']); text(o.id); digest(o.digest); demand(o.validity === 'active' || o.validity === 'stale');
  const s = object(o.subject, ['runId', 'repositoryId', 'storyId', 'reviewedStage', 'reviewedRevision', 'baselineSha', 'inputDigest', 'artifactDigest']);
  uuid(s.runId); text(s.repositoryId); text(s.storyId); demand(s.reviewedStage === 'po_approval'); integer(s.reviewedRevision); baseline(s.baselineSha); digest(s.inputDigest); digest(s.artifactDigest);
}
export function parseEvent(value: unknown): WorkflowEvent {
  canonical(value); const o = object(value, EVENT_FIELDS); version(o.schemaVersion); uuid(o.eventId); uuid(o.runId); integer(o.expectedRevision); timestamp(o.at);
  demand(typeof o.type === 'string' && Object.hasOwn(PAYLOAD_FIELDS, o.type), 'UNKNOWN_EVENT');
  const p = object(o.payload, PAYLOAD_FIELDS[o.type as EventType]);
  switch (o.type as EventType) {
    case 'run.created': repository(p.repository); story(p.story); baseline(p.baselineSha); break;
    case 'inputs.accepted': case 'inputs.changed': reference(p.input); break;
    case 'attempt.started': text(p.attemptId); break;
    case 'attempt.succeeded': text(p.attemptId); reference(p.report); break;
    case 'attempt.failed': case 'attempt.interrupted': text(p.attemptId); reason(p.reason); break;
    case 'attempt.reconciled': text(p.attemptId); reference(p.evidence); break;
    case 'run.blocked': case 'run.cancelled': reason(p.reason); break;
    case 'approval.validated': approval(p.approval); break;
    case 'handoff.recorded': text(p.approvalId); reference(p.artifact); break;
    case 'run.paused': case 'run.resumed': break;
  }
  return value as WorkflowEvent;
}
const PAYLOAD_FIELDS: Record<EventType, readonly string[]> = {
  'run.created': ['repository', 'story', 'baselineSha'], 'inputs.accepted': ['input'], 'inputs.changed': ['input'], 'attempt.started': ['attemptId'],
  'attempt.succeeded': ['attemptId', 'report'], 'attempt.failed': ['attemptId', 'reason'], 'attempt.interrupted': ['attemptId', 'reason'], 'attempt.reconciled': ['attemptId', 'evidence'],
  'run.blocked': ['reason'], 'run.paused': [], 'run.resumed': [], 'run.cancelled': ['reason'], 'approval.validated': ['approval'], 'handoff.recorded': ['approvalId', 'artifact'],
};
export function parseState(value: unknown): RunState {
  canonical(value, LIMITS.snapshot);
  const o = object(value, ['schemaVersion', 'runId', 'repository', 'story', 'baselineSha', 'stage', 'status', 'revision', 'journalSequence', 'input', 'attempts', 'approvalRefs', 'review', 'reason', 'evidence', 'pausedFrom', 'handoff', 'createdAt', 'updatedAt']);
  version(o.schemaVersion); uuid(o.runId); repository(o.repository); story(o.story); baseline(o.baselineSha); integer(o.revision); integer(o.journalSequence);
  demand(o.journalSequence >= o.revision && o.revision > 0);
  demand(STAGES.includes(o.stage as Stage) && STATUSES.includes(o.status as Status)); timestamp(o.createdAt); timestamp(o.updatedAt);
  if (o.input !== null) reference(o.input); if (o.reason !== null) reason(o.reason); if (o.handoff !== null) reference(o.handoff); references(o.evidence);
  demand(Array.isArray(o.attempts) && o.attempts.length <= LIMITS.references, 'RESOURCE_LIMIT');
  for (const item of o.attempts) {
    const a = object(item, ['id', 'status', 'settled', 'startedAt', 'endedAt', 'report', 'reason', 'reconciliation']);
    text(a.id); demand(['running', 'succeeded', 'failed', 'interrupted'].includes(String(a.status)) && typeof a.settled === 'boolean'); timestamp(a.startedAt);
    if (a.endedAt !== null) timestamp(a.endedAt); if (a.report !== null) reference(a.report); if (a.reason !== null) reason(a.reason); if (a.reconciliation !== null) reference(a.reconciliation);
    demand(a.status === 'running' ? !a.settled && a.endedAt === null : a.endedAt !== null);
    demand(!['succeeded', 'failed'].includes(String(a.status)) || a.settled);
  }
  const attempts = o.attempts as Attempt[];
  demand(new Set(attempts.map(a => a.id)).size === attempts.length && attempts.filter(a => !a.settled).length <= 1);
  demand(Array.isArray(o.approvalRefs) && o.approvalRefs.length <= LIMITS.references, 'RESOURCE_LIMIT'); o.approvalRefs.forEach(approval);
  if (o.review !== null) { const r = object(o.review, ['revision', 'artifact', 'inputDigest']); integer(r.revision); reference(r.artifact); digest(r.inputDigest); demand(Number(r.revision) <= Number(o.revision)); }
  demand(o.status === 'paused' ? ['ready', 'awaiting_approval', 'blocked', 'failed', 'interrupted', 'approved'].includes(String(o.pausedFrom)) : o.pausedFrom === null);
  const effective = o.status === 'paused' ? o.pausedFrom : o.status;
  demand(effective !== 'awaiting_approval' || o.stage === 'po_approval' && o.review !== null);
  demand(!['approved', 'handoff_ready'].includes(String(effective)) || o.stage === 'handoff' && (o.approvalRefs as ApprovalReference[]).some(a => a.validity === 'active'));
  demand(o.status !== 'in_flight' || o.stage === 'designer_review' && attempts.some(a => a.status === 'running' && !a.settled));
  demand(o.status !== 'ready' || ['inputs', 'designer_review'].includes(String(o.stage)));
  demand(o.stage === 'inputs' || o.input !== null);
  demand(!['blocked', 'failed', 'interrupted', 'cancelled'].includes(String(o.status)) || o.reason !== null);
  demand(o.status !== 'handoff_ready' || o.handoff !== null);
  const approvals = o.approvalRefs as ApprovalReference[];
  const review = o.review as Review | null;
  demand(new Set(approvals.map(a => a.id)).size === approvals.length && approvals.filter(a => a.validity === 'active').length <= 1);
  for (const a of approvals) {
    demand(a.subject.runId === o.runId && a.subject.repositoryId === (o.repository as Repository).id && a.subject.storyId === (o.story as Story).id && a.subject.baselineSha === o.baselineSha && a.subject.reviewedRevision <= Number(o.revision));
    if (a.validity === 'active') demand(review && a.subject.reviewedRevision === review.revision && a.subject.artifactDigest === review.artifact.digest && a.subject.inputDigest === (o.input as Reference | null)?.digest);
  }
  demand(!['ready', 'paused', 'cancelled', 'approved', 'handoff_ready', 'awaiting_approval'].includes(String(o.status)) || attempts.every(a => a.settled));
  demand(o.stage !== 'inputs' || attempts.every(a => a.settled));
  demand(effective !== 'awaiting_approval' || review?.inputDigest === (o.input as Reference | null)?.digest);
  return value as RunState;
}
