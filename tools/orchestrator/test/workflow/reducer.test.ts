import { expect, it } from 'vitest';
import { reduce, TRANSITIONS } from '../../src/workflow/reducer.js';
import { canonical } from '../../src/workflow/contracts.js';
import { advance, event, identity, initial, reason, ref, running, waiting } from './fixtures.js';

it('is deterministic and never mutates input state/events', () => {
  const state = initial(); const input = event('inputs.accepted', { input: ref }, state);
  const before = canonical([state, input]);
  expect(reduce(state, input)).toEqual(reduce(state, input));
  expect(canonical([state, input])).toBe(before);
  const next = reduce(state, input).state!; input.payload = { input: { ...ref, digest: 'c'.repeat(64) } };
  expect(next.input?.digest).toBe(ref.digest);
  expect(TRANSITIONS).toHaveProperty('run.paused');
});
it('models inputs, attempts, approval wait and preserves the exact paused target', () => {
  const state = waiting(); expect(state.status).toBe('awaiting_approval'); expect(state.approvalRefs).toEqual([]);
  const paused = advance(state, 'run.paused', {});
  const resumed = advance(paused, 'run.resumed', {});
  expect(resumed.status).toBe('awaiting_approval'); expect(resumed.stage).toBe('po_approval');
  expect(resumed.attempts).toEqual(state.attempts); expect(resumed.review).toEqual(state.review);
  for (const [type, payload] of [['attempt.started', { attemptId: 'another' }], ['run.resumed', {}], ['handoff.recorded', { approvalId: 'fixture', artifact: ref }]] as const) expect(reduce(state, event(type, payload, state)).code).toBe('ILLEGAL_TRANSITION');
});
it('requires reconciliation before an unsettled attempt can be resumed, paused or cancelled', () => {
  const state = running();
  for (const [type, payload] of [['run.paused', {}], ['run.cancelled', { reason }]] as const) expect(reduce(state, event(type, payload, state)).code).toBe('ATTEMPT_UNSETTLED');
  const interrupted = advance(state, 'attempt.interrupted', { attemptId: 'attempt-1', reason });
  expect(reduce(interrupted, event('run.resumed', {}, interrupted)).code).toBe('ATTEMPT_UNSETTLED');
  const reconciled = advance(interrupted, 'attempt.reconciled', { attemptId: 'attempt-1', evidence: ref });
  const resumed = advance(reconciled, 'run.resumed', {});
  expect(resumed.status).toBe('ready'); expect(resumed.attempts[0].status).toBe('interrupted'); expect(resumed.attempts[0].reason).toEqual(reason);
});
it('retains failure/block/cancellation reasons and makes cancellation terminal', () => {
  const failed = advance(running(), 'attempt.failed', { attemptId: 'attempt-1', reason });
  expect(advance(failed, 'run.resumed', {}).attempts).toEqual(failed.attempts);
  const blocked = advance(initial(), 'run.blocked', { reason }); expect(blocked.reason).toEqual(reason);
  const cancelled = advance(blocked, 'run.cancelled', { reason });
  expect(cancelled.status).toBe('cancelled'); expect(cancelled.reason).toEqual(reason);
  for (const [type, payload] of [['run.resumed', {}], ['run.paused', {}], ['run.blocked', { reason }], ['inputs.accepted', { input: ref }]] as const) expect(reduce(cancelled, event(type, payload, cancelled)).code).toBe('ILLEGAL_TRANSITION');
});
it('requires exact synthetic approval identity and preserves stale approval history on input change', () => {
  const state = waiting();
  const approval = { ...ref, subject: { runId: state.runId, repositoryId: state.repository.id, storyId: state.story.id, reviewedStage: 'po_approval' as const, reviewedRevision: state.review!.revision, baselineSha: state.baselineSha, inputDigest: state.input!.digest, artifactDigest: state.review!.artifact.digest }, validity: 'active' as const };
  for (const changed of [{ baselineSha: 'c'.repeat(40) }, { reviewedRevision: 0 }, { storyId: 'US-037' }, { inputDigest: 'c'.repeat(64) }]) expect(reduce(state, event('approval.validated', { approval: { ...approval, subject: { ...approval.subject, ...changed } } }, state)).code).toBe('APPROVAL_MISMATCH');
  const approved = advance(state, 'approval.validated', { approval });
  expect(approved.stage).toBe('handoff'); expect(approved.status).toBe('approved');
  expect(advance(approved, 'handoff.recorded', { approvalId: approval.id, artifact: ref }).status).toBe('handoff_ready');
  const changed = advance(approved, 'inputs.changed', { input: { ...ref, digest: 'c'.repeat(64) } });
  expect(changed.stage).toBe('inputs'); expect(changed.approvalRefs[0].validity).toBe('stale');
});
it('rejects wrong run, stale revisions, unknown events and repeated creation', () => {
  const state = initial();
  expect(reduce(state, event('run.created', identity, state)).disposition).toBe('rejected');
  expect(reduce(state, { ...event('run.paused', {}, state), expectedRevision: 0 }).disposition).toBe('stale');
  expect(reduce(state, { ...event('run.paused', {}, state), runId: '22222222-2222-4222-8222-222222222222' }).code).toBe('RUN_MISMATCH');
  expect(reduce(state, { ...event('run.paused', {}, state), type: 'timer.approved' })).toMatchObject({ disposition: 'rejected', state });
});
it('binds verified pending replacements during reduction while preserving opaque legacy transitions', () => {
  const bundle = (value: string) => ({ id: `bundle-v1:${value.repeat(64)}`, digest: value.repeat(64) });
  const selected = advance(advance(initial(), 'inputs.accepted', { input: bundle('a') }), 'inputs.changed', { input: bundle('b') });
  for (const input of [bundle('c'), { id: 'legacy', digest: 'b'.repeat(64) }, { id: bundle('b').id, digest: 'c'.repeat(64) }]) {
    expect(reduce(selected, event('inputs.accepted', { input }, selected))).toMatchObject({ disposition: 'rejected', code: 'INPUT_REPLACEMENT_REQUIRED', state: selected });
  }
  expect(advance(selected, 'inputs.accepted', { input: bundle('b') })).toMatchObject({ input: bundle('b'), stage: 'designer_review' });
  const legacy = advance(initial(), 'inputs.changed', { input: ref });
  expect(advance(legacy, 'inputs.accepted', { input: { ...ref, id: 'other' } }).stage).toBe('designer_review');
});

it('preserves reconciliation obligations through blocking and rejects settlement without evidence', () => {
  const blockedRunning = advance(running(), 'run.blocked', { reason });
  expect(advance(blockedRunning, 'attempt.failed', { attemptId: 'attempt-1', reason }).attempts[0]).toMatchObject({ status: 'failed', settled: true });
  const interrupted = advance(running(), 'attempt.interrupted', { attemptId: 'attempt-1', reason });
  const blocked = advance(interrupted, 'run.blocked', { reason });
  const before = canonical(blocked);
  const failed = reduce(blocked, event('attempt.failed', { attemptId: 'attempt-1', reason }, blocked));
  expect(failed).toMatchObject({ disposition: 'rejected', code: 'RECONCILIATION_REQUIRED', state: blocked });
  expect(canonical(blocked)).toBe(before);
  expect(failed.state!.attempts).toEqual(interrupted.attempts);
  expect(reduce(failed.state, event('run.cancelled', { reason }, failed.state)).code).toBe('ATTEMPT_UNSETTLED');
  expect(reduce(blocked, event('attempt.interrupted', { attemptId: 'attempt-1', reason }, blocked)).code).toBe('RECONCILIATION_REQUIRED');
  expect(reduce(blocked, event('attempt.reconciled', { attemptId: 'other', evidence: ref }, blocked)).disposition).toBe('rejected');
  expect(reduce(blocked, { ...event('attempt.reconciled', { attemptId: 'attempt-1', evidence: ref }, blocked), payload: { attemptId: 'attempt-1', evidence: {} } }).disposition).toBe('rejected');
  const reconciled = advance(blocked, 'attempt.reconciled', { attemptId: 'attempt-1', evidence: ref });
  expect(reconciled.attempts[0]).toEqual({ ...interrupted.attempts[0], settled: true, reconciliation: ref });
  expect(reconciled.evidence).toContainEqual(ref);
  const resumed = advance(reconciled, 'run.resumed', {});
  expect(resumed.status).toBe('ready'); expect(resumed.attempts).toEqual(reconciled.attempts);
  expect(advance(resumed, 'run.cancelled', { reason }).status).toBe('cancelled');
});
