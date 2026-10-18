import { ArtifactStore, bindBundle, type DesignerObject } from '../inputs/artifacts.js';
import { requiredBlobs } from '../inputs/bundle.js';
import { canonical, demand, hash, type RunState } from '../workflow/contracts.js';
import { replay, emptyView, stateAfter, type JournalView } from '../workflow/journal.js';
import type { RunDirectory } from '../workflow/paths.js';
import { sha256 } from '../policy.js';
import { content, decode, DESIGNER_LIMITS, encode, parseReceipt, parseManifest, parseProjection, type DesignerPreparationReceipt, type WorkflowBinding, type JobInspection } from './contracts.js';
import { prepareJob, type DesignerAssets } from './prepare.js';
import { provenance, type DesignerRecipe, parseRecipe } from './recipes.js';

export function workflowBinding(state: RunState, journalHeadHash: string): WorkflowBinding {
  demand(state.input, 'INPUTS_REQUIRED'); return { runId: state.runId, revision: state.revision, journalSequence: state.journalSequence, journalHeadHash, stage: state.stage, status: state.status, acceptedInput: state.input };
}
export function eligible(state: RunState): void {
  demand(state.stage === 'designer_review' && state.status === 'ready' && !state.attempts.some(a => !a.settled), 'WORKFLOW_NOT_PREPARABLE');
}
export async function retainedBundle(store: ArtifactStore, state: RunState) {
  demand(state.input, 'INPUTS_REQUIRED'); const verified = await store.verifyBundle(state.input, state);
  const blobs = new Map<string, Buffer>(); for (const [digest, bytes] of requiredBlobs(verified.core)) blobs.set(digest, await store.readDesignerBlob({ digest, bytes })); return { ...verified, blobs };
}
export async function verifyPreparation(dir: RunDirectory, store: ArtifactStore, current: RunState, preparationId: string): Promise<JobInspection> {
  const bytes = await store.readDesignerDocument('preparation', preparationId); demand(bytes, 'PREPARATION_MISSING'); const receipt = parseReceipt(decode(bytes)); demand(bytes.equals(encode(receipt, DESIGNER_LIMITS.record)), 'NONCANONICAL_PREPARATION');
  demand(receipt.requestId === preparationId && receipt.workflow.runId === current.runId, 'PREPARATION_CONTEXT_MISMATCH');
  const journal = await replay(dir); demand(journal.health === 'ok', journal.code ?? 'JOURNAL_BLOCKED');
  const count = receipt.workflow.journalSequence; demand(count <= journal.records.length && journal.records[count - 1]?.hash === receipt.workflow.journalHeadHash, 'PREPARATION_CONTEXT_MISMATCH');
  let prefix: JournalView = emptyView();
  for (const record of journal.records.slice(0, count)) prefix = { ...prefix, state: stateAfter(prefix, record), records: [...prefix.records, record], headHash: record.hash };
  demand(prefix.state && canonical(workflowBinding(prefix.state, prefix.headHash)) === canonical(receipt.workflow), 'PREPARATION_CONTEXT_MISMATCH'); eligible(prefix.state);
  const raw = await store.readDesignerDocument('job', receipt.job.digest); demand(raw && sha256(raw) === receipt.job.digest, 'CONTENT_MISMATCH');
  const manifest = parseManifest(decode(raw)); const projected = await store.readDesignerDocument('projection', manifest.projection.digest); demand(projected && canonical(content(projected)) === canonical(manifest.projection), 'CONTENT_MISMATCH'); const projection = parseProjection(decode(projected));
  const { core, blobs } = await retainedBundle(store, prefix.state); bindBundle(core, (await store.verifyBundle(manifest.bundle, prefix.state)).captures[0], prefix.state);
  const template = await store.readDesignerBlob(manifest.template.blob); const schema = await store.readDesignerBlob(manifest.reportSchema.blob); const recipe = parseRecipe(decode(await store.readDesignerBlob(manifest.recipe.blob)));
  const expected = prepareJob(core, blobs, recipe, { template, schema });
  demand(encode(manifest).equals(encode(expected.manifest)) && encode(projection).equals(encode(expected.projection)) && canonical(receipt.job) === canonical(expected.job) && canonical(receipt.projection) === canonical(manifest.projection), 'PREPARATION_INTEGRITY');
  for (const [digest, bytes] of expected.blobs) await store.readDesignerBlob({ digest, bytes: bytes.length });
  demand(canonical(receipt.controller) === canonical(provenance()), 'CONTROLLER_PROVENANCE_MISMATCH');
  const expectedRequest = hash({ kind: 'designer.prepare', workflow: receipt.workflow, recipe: recipe.id, job: receipt.job }, DESIGNER_LIMITS.document);
  demand(receipt.requestDigest === expectedRequest, 'PREPARATION_REQUEST_CONFLICT');
  const active = canonical(workflowBinding(current, journal.headHash)) === canonical(receipt.workflow);
  return { status: active ? 'verified' : 'stale', receipt, manifest, projection, errors: active ? [] : ['PREPARATION_BINDING_STALE'] };
}
export async function publishPreparation(dir: RunDirectory, store: ArtifactStore, state: RunState, recipe: DesignerRecipe, assets: DesignerAssets, requestId: string, now: string): Promise<DesignerPreparationReceipt> {
  eligible(state); const retained = await retainedBundle(store, state); const prepared = prepareJob(retained.core, retained.blobs, recipe, assets); const view = await replay(dir);
  const workflow = workflowBinding(state, view.headHash); const requestDigest = hash({ kind: 'designer.prepare', workflow, recipe: recipe.id, job: prepared.job }, DESIGNER_LIMITS.document);
  const old = await store.readDesignerDocument('preparation', requestId);
  if (old) { const existing = await verifyPreparation(dir, store, state, requestId); demand(existing.receipt.requestDigest === requestDigest && existing.status === 'verified', 'PREPARATION_REQUEST_CONFLICT'); await dir.sync(); return existing.receipt; }
  const receipt = parseReceipt({ schemaVersion: 1, kind: 'designer-preparation-receipt', requestId, requestDigest, preparedAt: now, controller: provenance(), workflow, job: prepared.job, projection: prepared.manifest.projection, result: 'prepared', integrity: 'verified', freshness: { retainedBundle: 'verified', selectedWorkingFiles: 'not-checked', repositoryHeadAndCleanliness: 'unverified', githubIssue: 'unverified', overall: 'unverified' }, warnings: ['SYNTHETIC_TEST_ONLY', 'INPUT_FRESHNESS_UNVERIFIED', 'PHASE_A_EXECUTION_DISABLED'], authorization: 'none' });
  const objects: DesignerObject[] = [...prepared.blobs].sort(([a], [b]) => a < b ? -1 : 1).map(([id, bytes]) => ({ kind: 'blob', id, bytes }));
  objects.push({ kind: 'projection', id: prepared.manifest.projection.digest, bytes: encode(prepared.projection) }, { kind: 'job', id: prepared.job.digest, bytes: encode(prepared.manifest) }, { kind: 'preparation', id: requestId, bytes: encode(receipt, DESIGNER_LIMITS.record) });
  await store.designerQuota(objects);
  for (const item of objects.slice(0, -1)) await store.publishDesignerObject(item);
  // Closure and binding are re-read before publishing the receipt, never adopted from orphans.
  const again = await retainedBundle(store, state); demand(canonical(again.core, DESIGNER_LIMITS.document) === canonical(retained.core, DESIGNER_LIMITS.document), 'CONCURRENT_CHANGE');
  const after = await replay(dir); demand(after.headHash === view.headHash, 'CONCURRENT_CHANGE');
  for (const [digest, bytes] of prepared.blobs) await store.readDesignerBlob({ digest, bytes: bytes.length });
  for (const item of objects.filter(o => o.kind === 'job' || o.kind === 'projection')) {
    const saved = await store.readDesignerDocument(item.kind as 'job' | 'projection', item.id); demand(saved?.equals(item.bytes), 'PREPARATION_INTEGRITY');
  }
  await store.publishDesignerObject(objects.at(-1)!);
  const verified = await verifyPreparation(dir, store, state, requestId); demand(verified.status === 'verified', 'CONCURRENT_CHANGE'); return verified.receipt;
}
