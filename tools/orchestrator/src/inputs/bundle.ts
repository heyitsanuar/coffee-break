import { randomUUID } from 'node:crypto';
import { canonical, demand, digest, WorkflowError } from '../workflow/contracts.js';
import { sha256 } from '../policy.js';
import { INPUT_LIMITS, parseCore, parseCapture, fullSha, safeRelative, documentText, type BundleCore, type CaptureRecord } from './contracts.js';

export interface PreparedBundle { core: BundleCore; blobs: Map<string, Buffer>; capture: CaptureRecord }
export function canonicalCore(value: unknown): BundleCore {
  const core = structuredClone(parseCore(value));
  const order = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
  core.files.sort((a, b) => order(a.path, b.path)); core.imports.sort((a, b) => order(a.kind, b.kind)); core.applicable.sort((a, b) => order(a.path, b.path));
  return core;
}
export const fingerprint = (core: unknown): string => sha256(canonical(canonicalCore(core), INPUT_LIMITS.manifest));
export function requiredBlobs(core: BundleCore): Map<string, number> {
  const result = new Map<string, number>();
  for (const item of [...core.files, ...core.imports]) { demand(!result.has(item.digest) || result.get(item.digest) === item.bytes, 'CONTENT_MISMATCH'); result.set(item.digest, item.bytes); }
  return result;
}
export function verifyBytes(core: BundleCore, blobs: ReadonlyMap<string, Buffer>): void {
  parseCore(core); const expected = requiredBlobs(core); demand(blobs.size === expected.size, 'BLOB_SET_MISMATCH');
  for (const [id, bytes] of expected) { const content = blobs.get(id); demand(content && content.length === bytes && sha256(content) === id, 'CONTENT_MISMATCH'); }
  verifySelectedReferences(core, new Map(blobs));
}
export function prepareBundle(core: BundleCore, blobs: ReadonlyMap<string, Buffer>, context: { runId: string; root: string; capturedAt: string; id?: string; issueAdapter: string }): PreparedBundle {
  core = canonicalCore(core); verifyBytes(core, blobs);
  const capture = parseCapture({ schemaVersion: 1, kind: 'input-capture', id: context.id ?? randomUUID(), runId: context.runId, fingerprint: fingerprint(core), root: context.root, capturedAt: context.capturedAt, issueAdapter: context.issueAdapter, checkout: { clean: true, head: core.baselineSha }, issueUrl: core.issue.url });
  return { core: structuredClone(core), blobs: new Map([...blobs].map(([id, value]) => [id, Buffer.from(value)])), capture };
}
export function verifyCapture(core: BundleCore, capture: CaptureRecord, runId: string): void {
  parseCapture(capture); demand(capture.runId === runId && capture.fingerprint === fingerprint(core) && capture.checkout.head === core.baselineSha && capture.issueUrl === core.issue.url, 'CAPTURE_MISMATCH');
}
export function compareBundles(original: BundleCore, current: BundleCore): { status: 'fresh' | 'drift'; changed: string[] } {
  original = canonicalCore(original); current = canonicalCore(current);
  const changed = (Object.keys(original) as Array<keyof BundleCore>).filter(key => canonical(original[key], INPUT_LIMITS.manifest) !== canonical(current[key], INPUT_LIMITS.manifest));
  return { status: changed.length ? 'drift' : 'fresh', changed };
}
export const bundleReference = (core: BundleCore): { id: string; digest: string } => { const value = fingerprint(core); return { id: `bundle-v1:${value}`, digest: value }; };
export function referenceDigest(reference: { id: string; digest: string }): string {
  digest(reference.digest); demand(reference.id === `bundle-v1:${reference.digest}`, 'LEGACY_INPUT_UNVERIFIED'); return reference.digest;
}

export function verifySelectedReferences(core: BundleCore, blobs: Map<string, Buffer>): void {
  const declared = new Map<string, string>();
  const dimensions = new Map<string, { width: number; height: number }>();
  for (const f of core.files.filter(f => f.kind === 'manifest')) {
    const bytes = blobs.get(f.digest)!; let value: Record<string, unknown>;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Record<string, unknown>; } catch { throw new WorkflowError('MANIFEST_INVALID'); }
    demand(value && !Array.isArray(value) && typeof value === 'object', 'MANIFEST_INVALID'); fullSha(value.baselineHead);
    let entries: unknown; let render = false;
    if (f.path === 'docs/design/studies/ep-07/refinements/artifact-manifest.json') {
      demand(Object.keys(value).length === 4 && ['status', 'baselineHead', 'newFiles', 'preservation'].every(k => Object.hasOwn(value, k)), 'MANIFEST_INVALID'); documentText(value.status, 4096); documentText(value.preservation, 8192); entries = value.newFiles;
    } else if (f.path === 'docs/design/studies/ep-07/refinements/preservation-manifest.json') {
      demand(Object.keys(value).length === 3 && ['baselineHead', 'originalFiles', 'ignoredMetadata'].every(k => Object.hasOwn(value, k)), 'MANIFEST_INVALID'); documentText(value.ignoredMetadata, 8192); entries = value.originalFiles;
    } else if (['docs/design/studies/ep-07/render-record.json', 'docs/design/studies/ep-07/refinements/render-record.json'].includes(f.path)) {
      demand(Object.keys(value).length === 3 && ['status', 'baselineHead', 'records'].every(k => Object.hasOwn(value, k)) && value.status === 'DESIGN STUDY ONLY', 'MANIFEST_INVALID'); entries = value.records; render = true;
    }
    else throw new WorkflowError('UNSUPPORTED_MANIFEST');
    demand(Array.isArray(entries) && entries.length > 0 && entries.length <= INPUT_LIMITS.files, 'MANIFEST_INVALID'); const seen = new Set<string>();
    for (const value of entries) {
      demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'MANIFEST_INVALID'); const e = value as Record<string, unknown>;
      if (render) { documentText(e.file, 256); demand(!e.file.includes('/') && Number.isSafeInteger(e.width) && Number(e.width) > 0 && Number(e.width) <= 8192 && Number.isSafeInteger(e.height) && Number(e.height) > 0 && Number(e.height) <= 8192, 'MANIFEST_INVALID'); }
      const p = render ? f.path.slice(0, f.path.lastIndexOf('/') + 1) + 'renders/' + String(e.file) : e.path; safeRelative(p);
      demand(p.startsWith('docs/design/studies/ep-07/') && !seen.has(p), 'MANIFEST_INVALID'); seen.add(p);
      if (p === f.path && f.path === 'docs/design/studies/ep-07/refinements/artifact-manifest.json') {
        demand(e.note === 'This inventory file; self-hash intentionally omitted.' && !Object.hasOwn(e, 'sha256') && !Object.hasOwn(e, 'bytes') && Object.keys(e).every(k => ['path', 'absolutePath', 'note'].includes(k)), 'MANIFEST_INVALID'); continue;
      }
      demand(typeof e.sha256 === 'string' && /^[a-f0-9]{64}$/.test(e.sha256), 'MANIFEST_INVALID');
      demand(!declared.has(p) || declared.get(p) === e.sha256, 'MANIFEST_INVALID'); declared.set(p, e.sha256);
      if (render) dimensions.set(p, { width: Number(e.width), height: Number(e.height) });
      const selected = core.files.find(s => s.path === p);
      if (selected) demand(selected.digest === e.sha256 && (!Object.hasOwn(e, 'bytes') || e.bytes === selected.bytes), 'MANIFEST_CONTENT_MISMATCH');
    }
  }
  for (const file of core.files.filter(f => f.path.toLowerCase().endsWith('.png'))) {
    demand(file.kind === 'static_design' && declared.get(file.path) === file.digest, 'PNG_MANIFEST_REQUIRED'); const b = blobs.get(file.digest)!;
    demand(b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.readUInt32BE(16) > 0 && b.readUInt32BE(16) <= 8192 && b.readUInt32BE(20) > 0 && b.readUInt32BE(20) <= 8192, 'PNG_HEADER_INVALID');
    const size = dimensions.get(file.path); if (size) demand(size.width === b.readUInt32BE(16) && size.height === b.readUInt32BE(20), 'PNG_DIMENSION_MISMATCH');
  }
}
