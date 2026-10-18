import type { ReportContext } from '../../src/reports/contracts.js';
import { prepared } from '../inputs/fixtures.js';
import { running } from '../workflow/fixtures.js';
import { bundleReference } from '../../src/inputs/bundle.js';
export function reportFixture() {
  const bundle = prepared(); const state = running(); state.repository = { id: bundle.core.repository, root: '/fixture' }; state.story = bundle.core.story; state.baselineSha = bundle.core.baselineSha; state.input = bundleReference(bundle.core);
  const context: ReportContext = { state, core: bundle.core, reportId: '44444444-4444-4444-8444-444444444444', attemptId: 'attempt-1', role: 'designer', stage: 'designer_review', sourceSha: state.baselineSha, inputFingerprint: state.input.digest, producer: { id: 'fixture', adapter: 'test/v1' }, receivedAt: '2026-10-17T12:00:00.000Z', observations: [], coveragePolicy: { 'AC-01': ['source_inspection'], 'AC-02': ['runtime_observation'] }, notApplicable: null };
  const payload = { summary: '<script>untrusted</script>', recommendation: 'review', coverage: [{ acId: 'AC-01', state: 'evidenced', evidence: ['policy.md'], rationale: '' }, { acId: 'AC-02', state: 'not-evidenced', evidence: [], rationale: 'Not run' }], findings: [], risks: [], openDecisions: [], unperformedChecks: ['Native accessibility'], inspectedFiles: ['policy.md'], evidence: [{ id: 'policy.md', kind: 'source_inspection', claim: 'Read source' }], validationPerformed: [], uncertainty: [], limitations: ['Not runtime evidence'], completion: 'complete' };
  return { context, payload };
}
