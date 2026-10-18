import type { FileHandle } from 'node:fs/promises';
import { canonical, demand, integer, LIMITS, object, uuid, version, type Reference, type RunState } from '../workflow/contracts.js';
import { readLock } from '../workflow/lock.js';
import { emptyView, replay, stateAfter, type JournalView } from '../workflow/journal.js';
import type { RunDirectory } from '../workflow/paths.js';
import { sha256 } from '../policy.js';
import { INPUT_LIMITS, parseCapture, parseCore, requirePilotInputs, type BundleCore, type CaptureRecord } from './contracts.js';
import { fingerprint, referenceDigest, requiredBlobs, verifyBytes, verifyCapture, type PreparedBundle } from './bundle.js';
import { reportIdentity, validateReport, type ReportContext, type ValidatedReport } from '../reports/contracts.js';

export type ArtifactFault = (point: 'beforeWrite' | 'afterWrite' | 'beforePublish' | 'afterPublish', handle?: FileHandle, bytes?: Buffer) => Promise<void>;
const noFault: ArtifactFault = async () => {};
const decode = (bytes: Buffer): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
const artifactName = (name: string): boolean => /^(?:blob-|bundle-|capture-|report-|artifact\.tmp-)/.test(name);
export function bindBundle(core: BundleCore, capture: CaptureRecord, state: RunState): void {
  verifyCapture(core, capture, state.runId);
  demand(core.repository === state.repository.id && canonical(core.story) === canonical(state.story) && core.baselineSha === state.baselineSha && capture.root === state.repository.root, 'BUNDLE_CONTEXT_MISMATCH'); requirePilotInputs(core);
}
// Caller must hold the run's writer lease for publication. Public workflow APIs
// acquire it internally; immutable reads never adopt temporary/orphaned files.
export class ArtifactStore {
  private readonly quota: number;
  private readonly fault: ArtifactFault;
  private readonly writerToken?: string;
  constructor(private readonly dir: RunDirectory, options: { quota?: number; fault?: ArtifactFault; writerToken?: string } = {}) {
    this.quota = Math.min(INPUT_LIMITS.retained, options.quota ?? INPUT_LIMITS.retained); demand(Number.isSafeInteger(this.quota) && this.quota >= 0, 'RESOURCE_LIMIT'); this.fault = options.fault ?? noFault;
    this.writerToken = options.writerToken;
  }
  private async requireWriter(): Promise<void> {
    demand(this.writerToken && (await readLock(this.dir))?.owner.token === this.writerToken, 'ARTIFACT_WRITER_REQUIRED');
  }
  private async writableState(): Promise<RunState> {
    await this.requireWriter(); demand(!await this.dir.inspect('intent.json'), 'RECOVERY_REQUIRED');
    const view = await replay(this.dir); demand(view.health === 'ok', view.code ?? 'JOURNAL_BLOCKED'); demand(view.state, 'RUN_UNINITIALIZED');
    const bytes = await this.dir.read('snapshot.json', LIMITS.snapshot); demand(bytes, 'RECOVERY_REQUIRED');
    const snapshot = object(decode(bytes), ['schemaVersion', 'sequence', 'headHash', 'state']); version(snapshot.schemaVersion);
    demand(canonical(snapshot, LIMITS.snapshot) === canonical({ schemaVersion: 1, sequence: view.records.length, headHash: view.headHash, state: view.state }, LIMITS.snapshot), 'RECOVERY_REQUIRED');
    return view.state;
  }
  private async put(name: string, bytes: Buffer): Promise<'created' | 'duplicate'> {
    await this.requireWriter();
    const used = (await this.dir.entries()).filter(e => artifactName(e.name)).reduce((n, e) => n + e.size, 0n);
    demand(used <= BigInt(this.quota), 'ARTIFACT_QUOTA');
    const old = await this.dir.read(name, Math.max(INPUT_LIMITS.object, INPUT_LIMITS.report));
    if (old) { demand(old.equals(bytes), 'ARTIFACT_CONFLICT'); return 'duplicate'; }
    demand(used + BigInt(bytes.length) <= BigInt(this.quota), 'ARTIFACT_QUOTA');
    const temporary = this.dir.temporary('artifact.tmp');
    await this.dir.create(temporary, bytes, async handle => { await this.fault('afterWrite', handle, bytes); }, async handle => { await this.fault('beforeWrite', handle, bytes); });
    await this.dir.sync(); await this.fault('beforePublish');
    // No cooperative publisher can race this check while the writer lease is
    // held. Portable rename is not a hostile same-user no-replace guarantee.
    await this.requireWriter(); await this.dir.move(temporary, name, false); await this.dir.sync(); await this.fault('afterPublish'); return 'created';
  }
  async publishBundle(prepared: PreparedBundle): Promise<Reference> {
    const state = await this.writableState(); bindBundle(prepared.core, prepared.capture, state);
    const { core, blobs, capture } = prepared; verifyBytes(core, blobs); verifyCapture(core, capture, this.dir.path.split('/').at(-1)!); requirePilotInputs(core);
    const manifest = Buffer.from(canonical(core, INPUT_LIMITS.manifest)); const captured = Buffer.from(canonical(capture, INPUT_LIMITS.manifest));
    demand(manifest.length + captured.length + [...blobs.values()].reduce((n, b) => n + b.length, 0) <= INPUT_LIMITS.bundle, 'RESOURCE_LIMIT');
    const id = fingerprint(core); demand(sha256(manifest) === id, 'NONCANONICAL_BUNDLE');
    for (const [digest, bytes] of [...blobs].sort(([a], [b]) => a < b ? -1 : 1)) await this.put(`blob-${digest}.bin`, bytes);
    await this.put(`bundle-${id}.json`, manifest); await this.put(`capture-${capture.id}.json`, captured);
    await this.verifyBundle({ id: `bundle-v1:${id}`, digest: id }); return { id: `bundle-v1:${id}`, digest: id };
  }
  async verifyBundle(reference: Reference, state?: RunState): Promise<{ core: BundleCore; captures: CaptureRecord[] }> {
    const id = referenceDigest(reference); const bytes = await this.dir.read(`bundle-${id}.json`, INPUT_LIMITS.manifest); demand(bytes, 'BUNDLE_MISSING'); demand(sha256(bytes) === id, 'CONTENT_MISMATCH');
    const core = parseCore(decode(bytes)); demand(fingerprint(core) === id && bytes.equals(Buffer.from(canonical(core, INPUT_LIMITS.manifest))), 'CONTENT_MISMATCH');
    const blobs = new Map<string, Buffer>();
    for (const [id, length] of requiredBlobs(core)) { const bytes = await this.dir.read(`blob-${id}.bin`, Math.min(INPUT_LIMITS.object, length)); demand(bytes && bytes.length === length && sha256(bytes) === id, 'CONTENT_MISMATCH'); blobs.set(id, bytes); }
    verifyBytes(core, blobs);
    const captures: CaptureRecord[] = [];
    for (const entry of await this.dir.entries()) {
      if (!entry.name.startsWith('capture-')) continue;
      const raw = await this.dir.read(entry.name, INPUT_LIMITS.manifest); demand(raw, 'CAPTURE_MISSING'); const capture = parseCapture(decode(raw));
      demand(entry.name === `capture-${capture.id}.json` && capture.runId === this.dir.path.split('/').at(-1), 'CAPTURE_MISMATCH');
      if (capture.fingerprint === id) { verifyCapture(core, capture, capture.runId); if (state) bindBundle(core, capture, state); captures.push(capture); }
    }
    demand(captures.length > 0, 'CAPTURE_REQUIRED'); return { core, captures };
  }
  async publishReport(payload: unknown, context: ReportContext): Promise<{ disposition: 'created' | 'duplicate'; report: ValidatedReport }> {
    const state = await this.writableState(); demand(canonical(state, LIMITS.snapshot) === canonical(context.state, LIMITS.snapshot), 'REPORT_CONTEXT_MISMATCH');
    const report = validateReport(payload, context); uuid(report.envelope.reportId); demand(report.envelope.runId === this.dir.path.split('/').at(-1), 'REPORT_CONTEXT_MISMATCH');
    await this.verifyBundle({ id: `bundle-v1:${context.inputFingerprint}`, digest: context.inputFingerprint }, context.state);
    const name = `report-${report.envelope.reportId}.json`; const old = await this.dir.read(name, INPUT_LIMITS.report);
    if (old) {
      const raw = object(decode(old), ['schemaVersion', 'kind', 'envelope', 'observation', 'payload', 'assessment']);
      demand(reportIdentity(raw as unknown as ValidatedReport) === reportIdentity(report), 'REPORT_ID_CONFLICT');
      const stored = await this.readReport(old, context); return { disposition: 'duplicate', report: stored };
    }
    await this.put(name, Buffer.from(canonical(report, INPUT_LIMITS.report))); return { disposition: 'created', report };
  }
  private async readReport(bytes: Buffer, context: ReportContext): Promise<ValidatedReport> {
    const r = object(decode(bytes), ['schemaVersion', 'kind', 'envelope', 'observation', 'payload', 'assessment']); version(r.schemaVersion); demand(r.kind === 'agent-report', 'REPORT_INVALID');
    const observation = object(r.observation, ['revision', 'journalSequence']); integer(observation.revision); integer(observation.journalSequence);
    const journal = await replay(this.dir); demand(journal.health === 'ok', journal.code ?? 'JOURNAL_BLOCKED');
    demand(observation.journalSequence > 0 && observation.journalSequence <= journal.records.length, 'REPORT_CONTEXT_MISMATCH');
    let prefix: JournalView = emptyView();
    for (const record of journal.records.slice(0, observation.journalSequence)) prefix = { ...prefix, state: stateAfter(prefix, record), records: [...prefix.records, record], headHash: record.hash };
    demand(prefix.state && prefix.state.revision === observation.revision && prefix.state.runId === context.state.runId, 'REPORT_CONTEXT_MISMATCH');
    const saved = r.envelope as ValidatedReport['envelope']; const result = validateReport(r.payload, { ...context, state: prefix.state, receivedAt: saved.receivedAt }, saved);
    demand(canonical(result, INPUT_LIMITS.report) === canonical(r, INPUT_LIMITS.report), 'REPORT_INTEGRITY'); return result;
  }
  async verifyReport(reportId: string, context: ReportContext): Promise<ValidatedReport> {
    await this.verifyBundle({ id: `bundle-v1:${context.inputFingerprint}`, digest: context.inputFingerprint }, context.state);
    uuid(reportId); demand(reportId === context.reportId, 'REPORT_CONTEXT_MISMATCH'); const bytes = await this.dir.read(`report-${reportId}.json`, INPUT_LIMITS.report); demand(bytes, 'REPORT_MISSING');
    return this.readReport(bytes, context);
  }
}
