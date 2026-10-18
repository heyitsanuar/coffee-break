import { expect, it } from 'vitest';
import { validateReport, reportIdentity, humanReport } from '../../src/reports/contracts.js';

import { reportFixture } from './fixtures.js';
it('binds trusted provenance and does not turn recommendations into authorization', () => {
  const { context, payload } = reportFixture(); const report = validateReport(payload, context);
  expect(report.envelope).toMatchObject({ runId: context.state.runId, sourceSha: context.sourceSha, inputFingerprint: context.inputFingerprint, role: 'designer' });
  expect(report.assessment.successfulCompletion).toBe(true); expect(report).not.toHaveProperty('approved');
  expect(humanReport(report)).toContain('&lt;script&gt;'); expect(humanReport(report)).not.toContain('<script>');
  expect(reportIdentity(validateReport(payload, { ...context, receivedAt: '2026-10-18T12:00:00.000Z' }))).toBe(reportIdentity(report));
});
it.each(['run', 'role', 'stage', 'attempt', 'source', 'input', 'payload-identity'])('rejects spoofed %s', mode => {
  const { context, payload } = reportFixture(); const c = structuredClone(context);
  if (mode === 'run') c.state.runId = '55555555-5555-4555-8555-555555555555';
  if (mode === 'role') c.role = 'developer' as never;
  if (mode === 'stage') c.stage = 'handoff' as never;
  if (mode === 'attempt') c.attemptId = 'invented';
  if (mode === 'source') c.sourceSha = 'b'.repeat(40);
  if (mode === 'input') c.inputFingerprint = 'c'.repeat(64);
  if (mode === 'payload-identity') Object.assign(payload, { runId: 'spoofed' });
  // Wrong run binding is tested through the explicit envelope assertion as well.
  if (mode === 'run') expect(() => validateReport(payload, c, { runId: context.state.runId })).toThrow();
  else expect(() => validateReport(payload, c)).toThrow();
});
it.each(['missing-ac', 'duplicate-ac', 'unknown-ac', 'unknown-evidence', 'missing-section', 'na', 'oversize'])('rejects report %s', mode => {
  const { context, payload } = reportFixture(); const p = structuredClone(payload);
  if (mode === 'missing-ac') p.coverage.pop();
  if (mode === 'duplicate-ac') p.coverage.push(p.coverage[0]);
  if (mode === 'unknown-ac') p.coverage[0].acId = 'AC-99';
  if (mode === 'unknown-evidence') p.evidence[0].id = 'unavailable';
  if (mode === 'missing-section') delete (p as Partial<typeof p>).risks;
  if (mode === 'na') p.coverage[0] = { ...p.coverage[0], state: 'not-applicable', rationale: 'Trust me' };
  if (mode === 'oversize') p.summary = 'x'.repeat(1024 * 1024 + 1);
  expect(() => validateReport(p, context)).toThrow();
});
it.each(['partial', 'interrupted'])('retains valid %s output without successful completion', completion => {
  const { context, payload } = reportFixture(); expect(validateReport({ ...payload, completion }, context).assessment.successfulCompletion).toBe(false);
});
it('keeps native/runtime claims on imported evidence unverified and supports explicit N/A policy', () => {
  const { context, payload } = reportFixture();
  payload.evidence = [{ id: 'import:developer_discovery', kind: 'native_observation', claim: 'Sandbox passed' }];
  payload.coverage[0].evidence = ['import:developer_discovery'];
  const report = validateReport(payload, context); expect(report.assessment.unsupportedClaims).toEqual(['import:developer_discovery']); expect(report.assessment.coverage[0].state).toBe('not-evidenced');
  payload.coverage[0] = { acId: 'AC-01', state: 'not-applicable', evidence: [], rationale: 'Explicit scope exclusion' };
  context.notApplicable = { policyDigest: context.core.applicable[0].digest, acIds: ['AC-01'] };
  expect(validateReport(payload, context).assessment.coverage[0].state).toBe('not-applicable');
});
it('cannot reuse a settled historical attempt against newly selected inputs', () => {
  const { context, payload } = reportFixture(); context.state.attempts[0] = { ...context.state.attempts[0], status: 'interrupted', endedAt: context.receivedAt, settled: true, reconciliation: { id: 'fixture', digest: 'b'.repeat(64) } }; context.state.status = 'ready';
  expect(() => validateReport(payload, context)).toThrow('REPORT_CONTEXT_MISMATCH');
});
it('never reports an imported claim as a verified validation result', () => {
  const { context, payload } = reportFixture();
  const report = validateReport({ ...payload, evidence: [{ id: 'import:developer_discovery', kind: 'native_observation', claim: 'Native passed' }], coverage: payload.coverage.map(c => ({ ...c, state: 'not-evidenced', evidence: [] })), validationPerformed: [{ name: 'Native sandbox', result: 'pass', evidence: ['import:developer_discovery'] }] }, context);
  expect(report.assessment.validationPerformed).toEqual([{ name: 'Native sandbox', result: 'unverified' }]);
});
