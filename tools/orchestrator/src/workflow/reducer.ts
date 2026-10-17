import { canonical, parseEvent, parseState, WorkflowError, type EventType, type RunState, type Status, type WorkflowEvent } from './contracts.js';

export type Disposition = 'accepted' | 'rejected' | 'stale' | 'conflict' | 'duplicate';
export interface Reduction { disposition: Exclude<Disposition, 'duplicate'>; code: string; state: RunState | null }
// Every event has an explicit source-status set. Additional identity/stage guards
// below narrow these pairs; absent pairs are rejected, including terminal states.
export const TRANSITIONS: Readonly<Record<EventType, readonly (Status | 'absent')[]>> = {
  'run.created': ['absent'], 'inputs.accepted': ['ready'], 'inputs.changed': ['ready', 'awaiting_approval', 'approved', 'blocked', 'failed', 'interrupted'],
  'attempt.started': ['ready'], 'attempt.succeeded': ['in_flight'], 'attempt.failed': ['in_flight', 'blocked'],
  'attempt.interrupted': ['in_flight', 'blocked'], 'attempt.reconciled': ['interrupted', 'blocked'],
  'run.blocked': ['ready', 'in_flight', 'awaiting_approval', 'blocked', 'failed', 'interrupted', 'approved'],
  'run.paused': ['ready', 'awaiting_approval', 'blocked', 'failed', 'interrupted', 'approved', 'in_flight'],
  'run.resumed': ['paused', 'blocked', 'failed', 'interrupted'],
  'run.cancelled': ['ready', 'in_flight', 'awaiting_approval', 'paused', 'blocked', 'failed', 'interrupted', 'approved'],
  'approval.validated': ['awaiting_approval'], 'handoff.recorded': ['approved'],
};
export const approvalEvent = (event: WorkflowEvent): boolean => event.type === 'approval.validated' || event.type === 'handoff.recorded';
export function reduce(previous: RunState | null, input: unknown): Reduction {
  const reject = (code: string, disposition: Reduction['disposition'] = 'rejected'): Reduction => ({ disposition, code, state: previous });
  let event: WorkflowEvent;
  try { event = structuredClone(parseEvent(input)); if (previous) parseState(previous); } catch (error) { return reject(error instanceof WorkflowError ? error.code : 'INVALID_SCHEMA'); }
  if (previous && previous.runId !== event.runId) return reject('RUN_MISMATCH');
  if ((previous?.revision ?? 0) !== event.expectedRevision) return reject('STALE_REVISION', 'stale');
  if (!TRANSITIONS[event.type].includes(previous?.status ?? 'absent')) return reject('ILLEGAL_TRANSITION');
  if (event.type === 'run.created') {
    return { disposition: 'accepted', code: 'ACCEPTED', state: parseState({ schemaVersion: 1, runId: event.runId, ...structuredClone(event.payload), stage: 'inputs', status: 'ready', revision: 1, journalSequence: 1, input: null, attempts: [], approvalRefs: [], review: null, reason: null, evidence: [], pausedFrom: null, handoff: null, createdAt: event.at, updatedAt: event.at }) };
  }
  if (!previous) return reject('RUN_MISSING');
  const state = structuredClone(previous);
  const unsettled = state.attempts.find(a => !a.settled);
  if (['run.paused', 'run.resumed', 'run.cancelled', 'inputs.changed', 'attempt.started'].includes(event.type) && unsettled) return reject('ATTEMPT_UNSETTLED');
  const sameAttempt = (id: string): boolean => unsettled?.id === id;
  switch (event.type) {
    case 'inputs.accepted':
      if (state.stage !== 'inputs') return reject('ILLEGAL_TRANSITION');
      state.input = event.payload.input; state.stage = 'designer_review'; break;
    case 'inputs.changed':
      state.input = event.payload.input; state.stage = 'inputs'; state.status = 'ready'; state.review = null; state.reason = null;
      state.approvalRefs = state.approvalRefs.map(a => ({ ...a, validity: 'stale' })); break;
    case 'attempt.started':
      if (state.stage !== 'designer_review' || !state.input || state.attempts.some(a => a.id === event.payload.attemptId)) return reject('ATTEMPT_MISMATCH');
      state.status = 'in_flight'; state.reason = null;
      state.attempts.push({ id: event.payload.attemptId, status: 'running', settled: false, startedAt: event.at, endedAt: null, report: null, reason: null, reconciliation: null }); break;
    case 'attempt.succeeded':
      if (!sameAttempt(event.payload.attemptId) || !state.input) return reject('ATTEMPT_MISMATCH');
      if (unsettled!.status !== 'running') return reject('RECONCILIATION_REQUIRED');
      Object.assign(unsettled!, { status: 'succeeded', settled: true, endedAt: event.at, report: event.payload.report });
      state.stage = 'po_approval'; state.status = 'awaiting_approval'; state.reason = null;
      state.review = { revision: state.revision + 1, artifact: event.payload.report, inputDigest: state.input.digest }; break;
    case 'attempt.failed': case 'attempt.interrupted':
      if (!sameAttempt(event.payload.attemptId)) return reject('ATTEMPT_MISMATCH');
      // The obligation belongs to the persisted attempt, not its outer run
      // status. Only explicit reconciliation may settle an interrupted attempt.
      if (unsettled!.status !== 'running') return reject('RECONCILIATION_REQUIRED');
      Object.assign(unsettled!, { status: event.type === 'attempt.failed' ? 'failed' : 'interrupted', settled: event.type === 'attempt.failed', endedAt: event.at, reason: event.payload.reason });
      state.status = event.type === 'attempt.failed' ? 'failed' : 'interrupted'; state.reason = event.payload.reason; state.evidence = event.payload.reason.evidence; break;
    case 'attempt.reconciled':
      if (!sameAttempt(event.payload.attemptId) || unsettled?.status !== 'interrupted') return reject('ATTEMPT_MISMATCH');
      unsettled.settled = true; unsettled.reconciliation = event.payload.evidence; state.evidence = [...state.evidence, event.payload.evidence]; break;
    case 'run.blocked': state.status = 'blocked'; state.reason = event.payload.reason; state.evidence = event.payload.reason.evidence; break;
    case 'run.paused': state.pausedFrom = state.status; state.status = 'paused'; break;
    case 'run.resumed':
      state.status = state.pausedFrom ?? (state.stage === 'po_approval' ? 'awaiting_approval' : state.stage === 'handoff' ? 'approved' : 'ready'); state.pausedFrom = null;
      if (state.status === 'ready') state.reason = null;
      break;
    case 'run.cancelled': state.status = 'cancelled'; state.pausedFrom = null; state.reason = event.payload.reason; state.evidence = event.payload.reason.evidence; break;
    case 'approval.validated': {
      const a = event.payload.approval;
      const expected = { runId: state.runId, repositoryId: state.repository.id, storyId: state.story.id, reviewedStage: 'po_approval', reviewedRevision: state.review?.revision, baselineSha: state.baselineSha, inputDigest: state.input?.digest, artifactDigest: state.review?.artifact.digest };
      if (state.stage !== 'po_approval' || a.validity !== 'active' || canonical(a.subject) !== canonical(expected) || state.approvalRefs.some(item => item.id === a.id)) return reject('APPROVAL_MISMATCH');
      state.approvalRefs.push(a); state.stage = 'handoff'; state.status = 'approved'; break;
    }
    case 'handoff.recorded':
      if (!state.approvalRefs.some(a => a.id === event.payload.approvalId && a.validity === 'active')) return reject('APPROVAL_MISMATCH');
      state.handoff = event.payload.artifact; state.status = 'handoff_ready'; break;
  }
  state.revision++; state.journalSequence++; state.updatedAt = event.at;
  try { return { disposition: 'accepted', code: 'ACCEPTED', state: parseState(state) }; } catch (error) { return reject(error instanceof WorkflowError ? error.code : 'INVALID_STATE'); }
}
