import { canonical, demand, object, parseState, timestamp, uuid, version, type RunState } from '../workflow/contracts.js';
import { sha256 } from '../policy.js';
import { documentText, fullSha, INPUT_LIMITS, parseCore, strings, type BundleCore } from '../inputs/contracts.js';
import { fingerprint, referenceDigest } from '../inputs/bundle.js';

export type EvidenceKind = 'static_design' | 'source_inspection' | 'test_execution' | 'runtime_observation' | 'native_observation' | 'imported_claim';
export interface Observation { id: string; digest: string; kind: EvidenceKind; runId: string; inputFingerprint: string; sourceSha: string }
export interface ReportContext {
  state: RunState; core: BundleCore; reportId: string; attemptId: string; role: 'designer'; stage: 'designer_review'; sourceSha: string; inputFingerprint: string;
  producer: { id: string; adapter: string }; receivedAt: string; observations: Observation[];
  coveragePolicy: Record<string, EvidenceKind[]>; notApplicable: { policyDigest: string; acIds: string[] } | null;
}
interface Coverage { acId: string; state: 'evidenced' | 'partial' | 'not-evidenced' | 'not-applicable'; evidence: string[]; rationale: string }
export interface ReportPayload {
  summary: string; recommendation: 'review' | 'revise' | 'blocked' | 'inconclusive'; coverage: Coverage[];
  findings: Array<{ id: string; severity: 'low' | 'medium' | 'high'; message: string; evidence: string[] }>;
  risks: string[]; openDecisions: string[]; unperformedChecks: string[]; inspectedFiles: string[];
  evidence: Array<{ id: string; kind: EvidenceKind; claim: string }>;
  validationPerformed: Array<{ name: string; result: 'pass' | 'fail' | 'unverified'; evidence: string[] }>;
  uncertainty: string[]; limitations: string[]; completion: 'complete' | 'partial' | 'interrupted';
}
export interface ValidatedReport {
  schemaVersion: 1; kind: 'agent-report'; envelope: { reportId: string; runId: string; repository: string; story: { id: string; issue: number }; role: 'designer'; stage: 'designer_review'; attemptId: string; sourceSha: string; inputFingerprint: string; producer: { id: string; adapter: string }; receivedAt: string; receipt: 'validation-only' };
  observation: { revision: number; journalSequence: number };
  payload: ReportPayload; assessment: { successfulCompletion: boolean; unsupportedClaims: string[]; coverage: Coverage[]; validationPerformed: Array<{ name: string; result: 'pass' | 'fail' | 'unverified' }> };
}
const kinds: EvidenceKind[] = ['static_design', 'source_inspection', 'test_execution', 'runtime_observation', 'native_observation', 'imported_claim'];
export function validateReport(input: unknown, context: ReportContext, suppliedBindings?: Partial<ValidatedReport['envelope']>): ValidatedReport {
  parseState(context.state); parseCore(context.core); uuid(context.reportId); timestamp(context.receivedAt); fullSha(context.sourceSha);
  const { state, core } = context;
  const attempt = state.attempts.find(a => a.id === context.attemptId && !a.settled && ['running', 'interrupted'].includes(a.status));
  demand(context.role === 'designer' && context.stage === 'designer_review' && attempt && state.stage === 'designer_review', 'REPORT_CONTEXT_MISMATCH');
  demand(state.repository.id === core.repository && canonical(state.story) === canonical(core.story) && state.baselineSha === core.baselineSha && context.sourceSha === core.baselineSha && state.input && referenceDigest(state.input) === fingerprint(core) && context.inputFingerprint === fingerprint(core), 'REPORT_CONTEXT_MISMATCH');
  object(context.producer, ['id', 'adapter']); documentText(context.producer.id, 256); documentText(context.producer.adapter, 256);
  const envelope: ValidatedReport['envelope'] = { reportId: context.reportId, runId: state.runId, repository: core.repository, story: core.story, role: 'designer', stage: 'designer_review', attemptId: context.attemptId, sourceSha: context.sourceSha, inputFingerprint: context.inputFingerprint, producer: context.producer, receivedAt: context.receivedAt, receipt: 'validation-only' };
  if (suppliedBindings) for (const [key, value] of Object.entries(suppliedBindings)) demand(Object.hasOwn(envelope, key) && canonical(value) === canonical(envelope[key as keyof typeof envelope]), 'REPORT_CONTEXT_MISMATCH');
  if (Buffer.isBuffer(input)) demand(input.length <= INPUT_LIMITS.report, 'RESOURCE_LIMIT');
  const value: unknown = Buffer.isBuffer(input) ? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input)) : input;
  canonical(value, INPUT_LIMITS.report);
  const p = object(value, ['summary', 'recommendation', 'coverage', 'findings', 'risks', 'openDecisions', 'unperformedChecks', 'inspectedFiles', 'evidence', 'validationPerformed', 'uncertainty', 'limitations', 'completion']);
  documentText(p.summary); demand(['review', 'revise', 'blocked', 'inconclusive'].includes(String(p.recommendation))); demand(['complete', 'partial', 'interrupted'].includes(String(p.completion)));
  for (const key of ['risks', 'openDecisions', 'unperformedChecks', 'inspectedFiles', 'uncertainty', 'limitations']) strings(p[key]);
  demand((p.inspectedFiles as string[]).every(path => core.files.some(f => f.path === path)), 'INSPECTED_FILE_UNKNOWN');
  const known = new Map<string, { kind: EvidenceKind; verified: boolean }>();
  for (const f of core.files) known.set(f.path, { kind: f.kind === 'static_design' || f.kind === 'manifest' ? 'static_design' : 'source_inspection', verified: true });
  for (const i of core.imports) known.set(`import:${i.kind}`, { kind: 'imported_claim', verified: false });
  demand(Array.isArray(context.observations) && context.observations.length <= 256, 'RESOURCE_LIMIT');
  for (const item of context.observations) {
    object(item, ['id', 'digest', 'kind', 'runId', 'inputFingerprint', 'sourceSha']); documentText(item.id, 256); demand(/^[a-f0-9]{64}$/.test(item.digest) && kinds.includes(item.kind) && item.kind !== 'imported_claim' && !known.has(item.id) && item.runId === state.runId && item.inputFingerprint === context.inputFingerprint && item.sourceSha === context.sourceSha, 'OBSERVATION_MISMATCH'); known.set(item.id, { kind: item.kind, verified: true });
  }
  demand(Array.isArray(p.evidence) && p.evidence.length <= 256, 'RESOURCE_LIMIT'); const claims = new Map<string, { kind: EvidenceKind; verified: boolean }>();
  for (const item of p.evidence) {
    const e = object(item, ['id', 'kind', 'claim']); documentText(e.id, 4096); documentText(e.claim, 8192); demand(kinds.includes(e.kind as EvidenceKind) && known.has(e.id) && !claims.has(e.id), 'EVIDENCE_UNKNOWN');
    const actual = known.get(e.id)!; claims.set(e.id, { kind: e.kind as EvidenceKind, verified: actual.verified && actual.kind === e.kind });
  }
  const refs = (value: unknown): string[] => { strings(value); demand(new Set(value).size === value.length && value.every(id => claims.has(id)), 'EVIDENCE_UNKNOWN'); return value; };
  const expected = core.issue.criteria.map(c => c.id); demand(Array.isArray(p.coverage) && p.coverage.length === expected.length, 'AC_COVERAGE_INVALID');
  demand(Object.keys(context.coveragePolicy).length === expected.length && expected.every(id => Object.hasOwn(context.coveragePolicy, id) && Array.isArray(context.coveragePolicy[id]) && context.coveragePolicy[id].every(kind => kinds.includes(kind))), 'COVERAGE_POLICY_INVALID');
  if (context.notApplicable) demand(core.applicable.some(a => a.kind === 'policy' && a.digest === context.notApplicable!.policyDigest) && new Set(context.notApplicable.acIds).size === context.notApplicable.acIds.length && context.notApplicable.acIds.every(id => expected.includes(id)), 'NA_POLICY_INVALID');
  const seen = new Set<string>(); const coverage: Coverage[] = [];
  for (const item of p.coverage) {
    const c = object(item, ['acId', 'state', 'evidence', 'rationale']); demand(typeof c.acId === 'string' && expected.includes(c.acId) && !seen.has(c.acId), 'AC_COVERAGE_INVALID'); seen.add(c.acId); documentText(c.rationale, 8192, true); const evidence = refs(c.evidence);
    demand(['evidenced', 'partial', 'not-evidenced', 'not-applicable'].includes(String(c.state)), 'AC_COVERAGE_INVALID');
    if (c.state === 'not-applicable') demand(c.rationale !== '' && context.notApplicable?.acIds.includes(c.acId), 'NA_POLICY_REQUIRED');
    if (c.state === 'evidenced' || c.state === 'partial') demand(evidence.length > 0, 'EVIDENCE_REQUIRED');
    const supported = evidence.some(id => claims.get(id)!.verified && context.coveragePolicy[c.acId as string].includes(claims.get(id)!.kind));
    coverage.push({ acId: c.acId, state: ['evidenced', 'partial'].includes(String(c.state)) && !supported ? 'not-evidenced' : c.state as Coverage['state'], evidence, rationale: c.rationale });
  }
  demand(Array.isArray(p.findings) && p.findings.length <= 128, 'RESOURCE_LIMIT'); const findingIds = new Set<string>();
  for (const item of p.findings) { const f = object(item, ['id', 'severity', 'message', 'evidence']); documentText(f.id, 256); demand(!findingIds.has(f.id) && ['low', 'medium', 'high'].includes(String(f.severity))); findingIds.add(f.id); documentText(f.message, 8192); refs(f.evidence); }
  demand(Array.isArray(p.validationPerformed) && p.validationPerformed.length <= 256, 'RESOURCE_LIMIT');
  const validations: ValidatedReport['assessment']['validationPerformed'] = [];
  for (const item of p.validationPerformed) {
    const v = object(item, ['name', 'result', 'evidence']); documentText(v.name, 256); demand(['pass', 'fail', 'unverified'].includes(String(v.result))); const ids = refs(v.evidence); if (v.result !== 'unverified') demand(ids.length > 0, 'EVIDENCE_REQUIRED');
    const observed = ids.some(id => claims.get(id)!.verified && ['test_execution', 'runtime_observation', 'native_observation'].includes(claims.get(id)!.kind));
    validations.push({ name: v.name, result: observed ? v.result as 'pass' | 'fail' | 'unverified' : 'unverified' });
  }
  const result: ValidatedReport = { schemaVersion: 1, kind: 'agent-report', envelope: structuredClone(envelope), observation: { revision: state.revision, journalSequence: state.journalSequence }, payload: structuredClone(value) as ReportPayload, assessment: { successfulCompletion: p.completion === 'complete' && attempt.status === 'running', unsupportedClaims: [...claims].filter(([, c]) => !c.verified).map(([id]) => id), coverage, validationPerformed: validations } };
  canonical(result, INPUT_LIMITS.report); return result;
}
export function reportIdentity(report: ValidatedReport): string {
  version(report.schemaVersion); demand(report.kind === 'agent-report'); const bindings: Partial<ValidatedReport['envelope']> = { ...report.envelope }; delete bindings.receivedAt;
  return sha256(canonical({ schemaVersion: 1, kind: report.kind, bindings, payload: report.payload }, INPUT_LIMITS.report));
}
export function humanReport(report: ValidatedReport): string {
  const escape = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return `Report ${report.envelope.reportId}\n${escape(report.payload.summary)}\nCompletion: ${report.payload.completion}\nRecommendation: ${report.payload.recommendation}\nNo approval or execution authorization.\n`;
}
