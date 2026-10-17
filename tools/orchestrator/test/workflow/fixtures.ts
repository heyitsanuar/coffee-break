import { randomUUID } from 'node:crypto';
import { reduce } from '../../src/workflow/reducer.js';
import type { EventType, Payloads, RunState, WorkflowEvent } from '../../src/workflow/contracts.js';

export const runId = '11111111-1111-4111-8111-111111111111';
export const at = '2026-10-16T12:00:00.000Z';
export const ref = { id: 'fixture', digest: 'b'.repeat(64) };
export const reason = { code: 'FIXTURE_REASON', evidence: [ref] };
export const identity = { repository: { id: 'heyitsanuar/coffee-break', root: '/synthetic/repository' }, story: { id: 'ORCH-002', issue: 101 }, baselineSha: 'a'.repeat(40) };
export function event<K extends EventType>(type: K, payload: Payloads[K], state: RunState | null = null): WorkflowEvent {
  return { schemaVersion: 1, eventId: randomUUID(), runId: state?.runId ?? runId, expectedRevision: state?.revision ?? 0, at, type, payload } as WorkflowEvent;
}
export function initial(): RunState { return reduce(null, event('run.created', identity)).state!; }
export function advance(state: RunState, type: EventType, payload: Payloads[EventType]): RunState {
  const result = reduce(state, event(type, payload, state));
  if (result.disposition !== 'accepted') throw new Error(result.code);
  return result.state!;
}
export function running(): RunState {
  return advance(advance(initial(), 'inputs.accepted', { input: ref }), 'attempt.started', { attemptId: 'attempt-1' });
}
export function waiting(): RunState { return advance(running(), 'attempt.succeeded', { attemptId: 'attempt-1', report: ref }); }
