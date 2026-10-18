import { isAbsolute } from 'node:path';
import { canonical, demand, digest, integer, object, timestamp, uuid, version } from '../workflow/contracts.js';

const MiB = 1024 * 1024;
export const INPUT_LIMITS = { files: 256, object: 8 * MiB, issue: MiB, imported: 2 * MiB, manifest: MiB, bundle: 64 * MiB, report: MiB, retained: 256 * MiB } as const;
export function documentText(value: unknown, maximum = INPUT_LIMITS.manifest, empty = false): asserts value is string {
  demand(typeof value === 'string' && (empty || value.length > 0) && Buffer.byteLength(value) <= maximum && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value), 'INVALID_DOCUMENT');
}
function sourceOrigin(value: unknown): void {
  documentText(value, 4096);
  demand(!isAbsolute(value) && !value.startsWith('\\') && !/^file:|^[A-Za-z]:[\\/]/i.test(value), 'PORTABLE_ORIGIN_REQUIRED');
}
export function strings(value: unknown, maximum = 256, allowEmpty = true): asserts value is string[] {
  demand(Array.isArray(value) && value.length <= maximum && (allowEmpty || value.length > 0), 'RESOURCE_LIMIT'); value.forEach(v => documentText(v, 8192));
}
export function fullSha(value: unknown): asserts value is string { demand(typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value), 'BASELINE_REQUIRED'); }
export function repositoryId(value: unknown): asserts value is string { demand(typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) && !value.split('/').some(p => p === '.' || p === '..'), 'REPOSITORY_MISMATCH'); }
export function safeRelative(value: unknown): asserts value is string {
  documentText(value, 4096);
  demand(!isAbsolute(value) && !/[\\:\x00-\x1f\x7f]/.test(value) && value.split('/').every(p => p !== '' && p !== '.' && p !== '..'), 'UNSAFE_PATH');
  const parts = value.split('/');
  demand(!parts.some((p, i) => /^(?:\.git|\.ssh|\.aws|\.azure|\.kube|\.config|\.docker|\.gnupg|\.env(?:\..*)?|\.npmrc|\.netrc|auth\.json|credentials?(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|ed25519|ecdsa|dsa)(?:\.pub)?)$/i.test(p) || /\.(?:pem|key|p12|pfx)$/i.test(p) || p === '.codex' && !['agents', 'attachments'].includes(parts[i + 1])), 'SENSITIVE_PATH');
}
export interface Criterion { id: string; text: string }
export function extractCriteria(body: string): Criterion[] {
  const lines = body.split(/\r?\n/); let inside = false; const result: Criterion[] = [];
  for (const line of lines) {
    if (/^##\s+Acceptance Criteria\s*$/i.test(line)) { demand(!inside && !result.length, 'AC_SECTION_INVALID'); inside = true; continue; }
    if (inside && /^##\s/.test(line)) inside = false;
    if (!inside) continue;
    const match = /^- \[[ xX]\] (AC-\d{2,}): (.+)$/.exec(line);
    if (match) result.push({ id: match[1], text: match[2] });
    else demand(line.trim() === '', 'AC_SECTION_INVALID');
  }
  demand(result.length > 0 && result.length <= 256 && new Set(result.map(c => c.id)).size === result.length, 'AC_IDENTITIES_INVALID'); return result;
}
export interface IssueSnapshot { repository: string; number: number; url: string; title: string; body: string; state: 'OPEN' | 'CLOSED'; criteria: Criterion[] }
export function parseIssue(value: unknown): IssueSnapshot {
  const raw = value as Record<string, unknown>;
  const keys = ['repository', 'number', 'url', 'title', 'body', 'state'];
  const o = object(value, raw && Object.hasOwn(raw, 'criteria') ? [...keys, 'criteria'] : keys);
  canonical(o, INPUT_LIMITS.issue); repositoryId(o.repository); integer(o.number); demand(o.number > 0, 'ISSUE_MISMATCH');
  demand(o.url === `https://github.com/${o.repository}/issues/${o.number}`, 'ISSUE_MISMATCH'); documentText(o.title, 4096); documentText(o.body, INPUT_LIMITS.issue);
  demand(o.state === 'OPEN' || o.state === 'CLOSED', 'ISSUE_INVALID'); const criteria = extractCriteria(o.body);
  if (Object.hasOwn(o, 'criteria')) demand(canonical(o.criteria, INPUT_LIMITS.issue) === canonical(criteria, INPUT_LIMITS.issue), 'AC_IDENTITIES_INVALID');
  const snapshot = { ...o, criteria } as unknown as IssueSnapshot; canonical(snapshot, INPUT_LIMITS.issue); return snapshot;
}
export type FileKind = 'source' | 'static_design' | 'manifest' | 'policy' | 'template';
export interface SelectedFile { path: string; kind: FileKind; digest: string; bytes: number; sourceSha: string; provenance: { origin: string; limitations: string[] } }
export type ImportKind = 'developer_discovery' | 'planner_scope';
export interface ImportedInput { schemaVersion: 1; kind: ImportKind; origin: string; basisSha: string; digest: string; bytes: number; limitations: string[]; compatibility: { mode: 'exact' | 'historical'; policyDigest: string | null; rationale: string } }
export interface Scope { allowedChanges: string[]; nonGoals: string[]; validationPlan: string[]; unresolvedDecisions: string[] }
export interface BundleCore {
  schemaVersion: 1; kind: 'scope-bundle'; repository: string; story: { id: string; issue: number }; baselineSha: string;
  checkout: { clean: true }; issue: IssueSnapshot; files: SelectedFile[]; imports: ImportedInput[]; scope: Scope;
  applicable: Array<{ kind: 'policy' | 'template'; path: string; digest: string }>;
}
export function parseScope(value: unknown): Scope {
  const s = object(value, ['allowedChanges', 'nonGoals', 'validationPlan', 'unresolvedDecisions']);
  strings(s.allowedChanges, 256, false); s.allowedChanges.forEach(p => safeRelative(p.endsWith('/**') ? p.slice(0, -3) : p));
  strings(s.nonGoals, 256, false); strings(s.validationPlan, 256, false); strings(s.unresolvedDecisions); return value as Scope;
}
export function parseCore(value: unknown): BundleCore {
  canonical(value, INPUT_LIMITS.manifest);
  const o = object(value, ['schemaVersion', 'kind', 'repository', 'story', 'baselineSha', 'checkout', 'issue', 'files', 'imports', 'scope', 'applicable']);
  version(o.schemaVersion); demand(o.kind === 'scope-bundle'); repositoryId(o.repository); fullSha(o.baselineSha);
  const s = object(o.story, ['id', 'issue']); documentText(s.id, 256); integer(s.issue);
  demand(object(o.checkout, ['clean']).clean === true, 'DIRTY_CHECKOUT');
  const issue = parseIssue(o.issue); demand(issue.repository === o.repository && issue.number === s.issue, 'ISSUE_MISMATCH');
  demand(Array.isArray(o.files) && o.files.length > 0 && o.files.length <= INPUT_LIMITS.files, 'RESOURCE_LIMIT');
  for (const value of o.files) {
    const f = object(value, ['path', 'kind', 'digest', 'bytes', 'sourceSha', 'provenance']); safeRelative(f.path); digest(f.digest); integer(f.bytes); demand(f.bytes <= INPUT_LIMITS.object, 'RESOURCE_LIMIT'); fullSha(f.sourceSha); demand(f.sourceSha === o.baselineSha, 'SOURCE_SHA_MISMATCH');
    demand(['source', 'static_design', 'manifest', 'policy', 'template'].includes(String(f.kind)), 'UNSUPPORTED_REFERENCE');
    if (f.path.startsWith('docs/design/')) demand(f.kind === 'static_design' || f.kind === 'manifest', 'EVIDENCE_CLASSIFICATION');
    const p = object(f.provenance, ['origin', 'limitations']); sourceOrigin(p.origin); strings(p.limitations);
  }
  const files = o.files as SelectedFile[]; demand(new Set(files.map(f => f.path)).size === files.length, 'DUPLICATE_PATH');
  demand(Array.isArray(o.applicable) && o.applicable.length > 0 && o.applicable.length <= INPUT_LIMITS.files, 'POLICY_REQUIRED');
  for (const item of o.applicable) {
    const a = object(item, ['kind', 'path', 'digest']); demand(a.kind === 'policy' || a.kind === 'template'); safeRelative(a.path); digest(a.digest);
    demand(files.some(f => f.path === a.path && f.kind === a.kind && f.digest === a.digest), 'POLICY_MISMATCH');
  }
  const applicable = o.applicable as BundleCore['applicable'];
  demand(applicable.some(a => a.kind === 'policy') && new Set(applicable.map(a => a.path)).size === applicable.length, 'POLICY_REQUIRED');
  demand(files.filter(f => f.kind === 'policy' || f.kind === 'template').every(f => applicable.some(a => a.path === f.path)), 'POLICY_MISMATCH');
  demand(Array.isArray(o.imports) && o.imports.length === 2, 'IMPORTS_REQUIRED');
  for (const value of o.imports) {
    const i = object(value, ['schemaVersion', 'kind', 'origin', 'basisSha', 'digest', 'bytes', 'limitations', 'compatibility']); version(i.schemaVersion);
    demand(i.kind === 'developer_discovery' || i.kind === 'planner_scope', 'IMPORTS_REQUIRED'); sourceOrigin(i.origin); fullSha(i.basisSha); digest(i.digest); integer(i.bytes); demand(i.bytes > 0 && i.bytes <= INPUT_LIMITS.imported, 'RESOURCE_LIMIT'); strings(i.limitations);
    const c = object(i.compatibility, ['mode', 'policyDigest', 'rationale']); documentText(c.rationale, 8192, true);
    if (c.mode === 'exact') demand(i.basisSha === o.baselineSha && c.policyDigest === null, 'IMPORT_BASIS_MISMATCH');
    else { demand(c.mode === 'historical' && c.rationale !== '', 'BASIS_POLICY_REQUIRED'); digest(c.policyDigest); demand(applicable.some(a => a.kind === 'policy' && a.digest === c.policyDigest), 'BASIS_POLICY_REQUIRED'); }
  }
  demand(new Set((o.imports as ImportedInput[]).map(i => i.kind)).size === 2, 'IMPORTS_REQUIRED'); parseScope(o.scope);
  const total = Buffer.byteLength(canonical(o, INPUT_LIMITS.manifest)) + files.reduce((n, f) => n + f.bytes, 0) + (o.imports as ImportedInput[]).reduce((n, i) => n + i.bytes, 0);
  demand(total <= INPUT_LIMITS.bundle, 'RESOURCE_LIMIT'); return value as BundleCore;
}
export interface CaptureRecord { schemaVersion: 1; kind: 'input-capture'; id: string; runId: string; fingerprint: string; root: string; capturedAt: string; issueAdapter: string; checkout: { clean: true; head: string }; issueUrl: string }
export function parseCapture(value: unknown): CaptureRecord {
  const o = object(value, ['schemaVersion', 'kind', 'id', 'runId', 'fingerprint', 'root', 'capturedAt', 'issueAdapter', 'checkout', 'issueUrl']); version(o.schemaVersion); demand(o.kind === 'input-capture'); uuid(o.id); uuid(o.runId); digest(o.fingerprint); documentText(o.root, 4096); demand(isAbsolute(o.root)); timestamp(o.capturedAt); documentText(o.issueAdapter, 256); documentText(o.issueUrl, 4096);
  const c = object(o.checkout, ['clean', 'head']); demand(c.clean === true); fullSha(c.head); return value as CaptureRecord;
}
export function requirePilotInputs(core: BundleCore): void {
  // No authoritative US-037 discovery/scope digests have been supplied or
  // approved. There is deliberately no user/agent override or approval flag.
  demand(!(core.repository.toLowerCase() === 'heyitsanuar/coffee-break' && (core.story.id.toUpperCase() === 'US-037' || core.story.issue === 88)), 'PILOT_INPUTS_REQUIRED');
}
