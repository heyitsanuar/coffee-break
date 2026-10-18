import { canonical, demand, digest, integer, object, reference, STAGES, STATUSES, timestamp, uuid, version, type Reference, type Stage, type Status } from '../workflow/contracts.js';
import { documentText, fullSha, repositoryId, safeRelative, strings } from '../inputs/contracts.js';
import { sha256 } from '../policy.js';

export const DESIGNER_LIMITS = { document: 1_048_576, record: 65_536, entries: 260, images: 16, bytes: 67_108_864, directoryEntries: 4096 } as const;
export interface BlobRef { digest: string; bytes: number }
export interface VersionedAsset { version: string; blob: BlobRef }
export interface WorkflowBinding { runId: string; revision: number; journalSequence: number; journalHeadHash: string; stage: Stage; status: Status; acceptedInput: Reference }
// No build-time source attestation exists. null is intentional, never the job's source SHA.
export interface ControllerProvenance { producer: 'cb-flow'; component: 'designer-preparation'; version: string; sourceSha: null; preparationPolicy: VersionedAsset }
export type ProjectionSource = { kind: 'bundle-file'; path: string; sourceSha: string } | { kind: 'bundle-import'; importKind: 'developer_discovery' | 'planner_scope'; basisSha: string } | { kind: 'bundle-issue' } | { kind: 'bundle-scope' };
export interface ProjectionEntry { logicalPath: string; source: ProjectionSource; blob: BlobRef; mediaType: 'image/png' | 'text/plain' | 'application/json' | 'application/octet-stream' }
export interface DesignerInputProjection { schemaVersion: 1; kind: 'designer-input-projection'; bundle: Reference; sourceSha: string; entries: ProjectionEntry[]; requiredImages: string[]; materialization: 'logical-only' }
export interface DesignerJobManifest {
  schemaVersion: 1; kind: 'designer-job'; repository: string; story: { id: string; issue: number }; sourceSha: string; bundle: Reference;
  projection: BlobRef; preparationPolicy: VersionedAsset; recipe: VersionedAsset; template: VersionedAsset; resolvedPrompt: BlobRef; reportSchema: VersionedAsset;
  diagnosticPolicy: { version: string; digest: string; requiredCodexVersion: string };
  execution: { phase: 'A'; launch: 'disabled'; model: null; effectiveSettings: null };
}
export interface DesignerPreparationReceipt {
  schemaVersion: 1; kind: 'designer-preparation-receipt'; requestId: string; requestDigest: string; preparedAt: string; controller: ControllerProvenance; workflow: WorkflowBinding;
  job: Reference; projection: BlobRef; result: 'prepared'; integrity: 'verified';
  freshness: { retainedBundle: 'verified'; selectedWorkingFiles: 'not-checked'; repositoryHeadAndCleanliness: 'unverified'; githubIssue: 'unverified'; overall: 'unverified' };
  warnings: string[]; authorization: 'none';
}
export const CHECK_IDS = ['workflow', 'accepted-input', 'input-integrity', 'input-freshness', 'diagnostics', 'cli-identity', 'image-support', 'filesystem-isolation', 'credential-isolation', 'network-isolation', 'plugins-mcp', 'hooks', 'delegation', 'process-containment', 'operator-invocation', 'phase-a'] as const;
export interface AdmissionCheck { id: typeof CHECK_IDS[number]; status: 'pass' | 'fail' | 'unsupported' | 'unverified'; code: string; evidence: Reference[] }
export interface DesignerAdmissionDecision {
  schemaVersion: 1; kind: 'designer-admission-decision'; requestId: string; requestDigest: string; evaluatedAt: string; controller: ControllerProvenance;
  preparationId: string; preparationDigest: string; job: Reference; observedWorkflow: WorkflowBinding;
  invocation: { origin: 'operator-command'; command: 'designer.admission' };
  checks: AdmissionCheck[]; blockers: string[]; phase: 'A'; decision: 'deny'; allowLaunch: false; authorization: 'none';
}
export interface JobInspection { status: 'verified' | 'stale'; receipt: DesignerPreparationReceipt; manifest: DesignerJobManifest; projection: DesignerInputProjection; errors: string[] }
export interface DesignerJobVerifier {
  inspect(request: { runId: string; preparationId: string }): Promise<JobInspection>;
  evaluateAdmission(request: { runId: string; preparationId: string; expectedRevision: number; requestId: string }): Promise<DesignerAdmissionDecision>;
}
export const encode = (value: unknown, limit: number = DESIGNER_LIMITS.document): Buffer => Buffer.from(canonical(value, limit));
export const content = (bytes: Buffer): BlobRef => ({ digest: sha256(bytes), bytes: bytes.length });
export function decode(bytes: Buffer): unknown { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
export function blob(value: unknown): asserts value is BlobRef { const o = object(value, ['digest', 'bytes']); digest(o.digest); integer(o.bytes); demand(o.bytes <= 8_388_608, 'RESOURCE_LIMIT'); }
function asset(value: unknown): void { const o = object(value, ['version', 'blob']); documentText(o.version, 128); blob(o.blob); demand(o.blob.bytes <= DESIGNER_LIMITS.document, 'RESOURCE_LIMIT'); }
export function bundleRef(value: unknown): asserts value is Reference { reference(value); const r = value as Reference; demand(r.id === `bundle-v1:${r.digest}`, 'LEGACY_INPUT_UNVERIFIED'); }
export function jobRef(value: unknown): asserts value is Reference { reference(value); const r = value as Reference; demand(r.id === `designer-job-v1:${r.digest}`, 'JOB_REFERENCE_INVALID'); }
function header(value: unknown, fields: string[], kind: string, limit: number = DESIGNER_LIMITS.document): Record<string, unknown> { canonical(value, limit); const o = object(value, ['schemaVersion', 'kind', ...fields]); version(o.schemaVersion); demand(o.kind === kind, 'DESIGNER_KIND_INVALID'); return o; }
function sorted(values: string[]): void { demand(new Set(values).size === values.length && values.every((s, i) => i === 0 || values[i - 1] < s), 'DESIGNER_ORDER_INVALID'); }
export function parseProjection(value: unknown): DesignerInputProjection {
  const o = header(value, ['bundle', 'sourceSha', 'entries', 'requiredImages', 'materialization'], 'designer-input-projection'); bundleRef(o.bundle); fullSha(o.sourceSha); demand(o.materialization === 'logical-only');
  demand(Array.isArray(o.entries) && o.entries.length > 0 && o.entries.length <= DESIGNER_LIMITS.entries, 'RESOURCE_LIMIT');
  let bytes = 0;
  for (const raw of o.entries) {
    const e = object(raw, ['logicalPath', 'source', 'blob', 'mediaType']); safeRelative(e.logicalPath); demand(/^(?:files|imports|inputs)\/[a-zA-Z0-9._-]+$/.test(e.logicalPath), 'UNSAFE_PATH'); blob(e.blob); bytes += e.blob.bytes;
    demand(['image/png', 'text/plain', 'application/json', 'application/octet-stream'].includes(String(e.mediaType)));
    const s = e.source as Record<string, unknown>;
    if (s?.kind === 'bundle-file') { object(s, ['kind', 'path', 'sourceSha']); safeRelative(s.path); fullSha(s.sourceSha); demand(s.sourceSha === o.sourceSha, 'SOURCE_SHA_MISMATCH'); }
    else if (s?.kind === 'bundle-import') { object(s, ['kind', 'importKind', 'basisSha']); demand(['developer_discovery', 'planner_scope'].includes(String(s.importKind))); fullSha(s.basisSha); }
    else { object(s, ['kind']); demand(s.kind === 'bundle-issue' || s.kind === 'bundle-scope'); }
  }
  demand(bytes <= DESIGNER_LIMITS.bytes, 'RESOURCE_LIMIT'); sorted((o.entries as ProjectionEntry[]).map(e => e.logicalPath)); strings(o.requiredImages, DESIGNER_LIMITS.images, false); sorted(o.requiredImages);
  demand(o.requiredImages.every(p => (o.entries as ProjectionEntry[]).some(e => e.logicalPath === p && e.mediaType === 'image/png')), 'REQUIRED_IMAGE_MISSING');
  return structuredClone(value) as DesignerInputProjection;
}
export function parseManifest(value: unknown): DesignerJobManifest {
  const o = header(value, ['repository', 'story', 'sourceSha', 'bundle', 'projection', 'preparationPolicy', 'recipe', 'template', 'resolvedPrompt', 'reportSchema', 'diagnosticPolicy', 'execution'], 'designer-job');
  repositoryId(o.repository); const s = object(o.story, ['id', 'issue']); documentText(s.id, 256); integer(s.issue); demand(s.issue > 0); fullSha(o.sourceSha); bundleRef(o.bundle); blob(o.projection); blob(o.resolvedPrompt);
  demand(o.projection.bytes <= DESIGNER_LIMITS.document && o.resolvedPrompt.bytes <= DESIGNER_LIMITS.document, 'RESOURCE_LIMIT'); for (const key of ['preparationPolicy', 'recipe', 'template', 'reportSchema']) asset(o[key]);
  const p = object(o.diagnosticPolicy, ['version', 'digest', 'requiredCodexVersion']); documentText(p.version, 128); digest(p.digest); documentText(p.requiredCodexVersion, 128);
  demand(canonical(o.execution) === canonical({ phase: 'A', launch: 'disabled', model: null, effectiveSettings: null }), 'PHASE_A_EXECUTION_DISABLED'); return structuredClone(value) as DesignerJobManifest;
}
export function binding(value: unknown): asserts value is WorkflowBinding {
  const o = object(value, ['runId', 'revision', 'journalSequence', 'journalHeadHash', 'stage', 'status', 'acceptedInput']); uuid(o.runId); integer(o.revision); integer(o.journalSequence); demand(o.revision > 0 && o.journalSequence > 0); digest(o.journalHeadHash); demand(STAGES.includes(o.stage as Stage) && STATUSES.includes(o.status as Status)); bundleRef(o.acceptedInput);
}
function controller(value: unknown): void {
  const o = object(value, ['producer', 'component', 'version', 'sourceSha', 'preparationPolicy']); demand(o.producer === 'cb-flow' && o.component === 'designer-preparation' && o.sourceSha === null); documentText(o.version, 128); asset(o.preparationPolicy);
}
export function parseReceipt(value: unknown): DesignerPreparationReceipt {
  const o = header(value, ['requestId', 'requestDigest', 'preparedAt', 'controller', 'workflow', 'job', 'projection', 'result', 'integrity', 'freshness', 'warnings', 'authorization'], 'designer-preparation-receipt', DESIGNER_LIMITS.record);
  uuid(o.requestId); digest(o.requestDigest); timestamp(o.preparedAt); controller(o.controller); binding(o.workflow); jobRef(o.job); blob(o.projection); demand(o.result === 'prepared' && o.integrity === 'verified' && o.authorization === 'none');
  demand(canonical(o.freshness) === canonical({ retainedBundle: 'verified', selectedWorkingFiles: 'not-checked', repositoryHeadAndCleanliness: 'unverified', githubIssue: 'unverified', overall: 'unverified' })); strings(o.warnings, 64); return structuredClone(value) as DesignerPreparationReceipt;
}
export function parseDecision(value: unknown): DesignerAdmissionDecision {
  const o = header(value, ['requestId', 'requestDigest', 'evaluatedAt', 'controller', 'preparationId', 'preparationDigest', 'job', 'observedWorkflow', 'invocation', 'checks', 'blockers', 'phase', 'decision', 'allowLaunch', 'authorization'], 'designer-admission-decision', DESIGNER_LIMITS.record);
  uuid(o.requestId); digest(o.requestDigest); timestamp(o.evaluatedAt); controller(o.controller); uuid(o.preparationId); digest(o.preparationDigest); jobRef(o.job); binding(o.observedWorkflow);
  demand(canonical(o.invocation) === canonical({ origin: 'operator-command', command: 'designer.admission' }));
  demand(o.phase === 'A' && o.decision === 'deny' && o.allowLaunch === false && o.authorization === 'none', 'PHASE_A_EXECUTION_DISABLED');
  demand(Array.isArray(o.checks) && o.checks.length === CHECK_IDS.length); const ids: string[] = [];
  for (const raw of o.checks) { const c = object(raw, ['id', 'status', 'code', 'evidence']); demand(CHECK_IDS.includes(c.id as AdmissionCheck['id'])); ids.push(String(c.id)); demand(['pass', 'fail', 'unsupported', 'unverified'].includes(String(c.status))); documentText(c.code, 64); demand(Array.isArray(c.evidence) && c.evidence.length <= 32); c.evidence.forEach(reference); }
  demand(new Set(ids).size === CHECK_IDS.length && ids.every((id, i) => id === CHECK_IDS[i]), 'ADMISSION_CHECK_ORDER');
  for (const check of o.checks as AdmissionCheck[]) {
    demand(/^[A-Z][A-Z0-9_]{0,63}$/.test(check.code), 'ADMISSION_CODE_INVALID');
    if (['diagnostics', 'cli-identity', 'image-support', 'filesystem-isolation', 'credential-isolation', 'network-isolation', 'plugins-mcp', 'hooks', 'delegation', 'process-containment', 'input-freshness'].includes(check.id)) demand(check.status === 'unverified' && check.evidence.length === 0, 'PHASE_A_EVIDENCE_UNVERIFIED');
    if (check.id === 'phase-a') demand(check.status === 'unsupported' && check.code === 'PHASE_A_EXECUTION_DISABLED', 'PHASE_A_EXECUTION_DISABLED');
  } strings(o.blockers, 64, false); demand(o.blockers.includes('PHASE_A_EXECUTION_DISABLED')); demand(new Set(o.blockers).size === o.blockers.length);
  demand(canonical(o.blockers) === canonical([...new Set((o.checks as AdmissionCheck[]).filter(c => c.status !== 'pass').map(c => c.code))]), 'ADMISSION_BLOCKERS_INVALID'); return structuredClone(value) as DesignerAdmissionDecision;
}
