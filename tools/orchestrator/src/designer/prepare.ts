import { fileURLToPath } from 'node:url';
import { readInputFile } from '../inputs/capture.js';
import { requirePilotInputs, type BundleCore } from '../inputs/contracts.js';
import { bundleReference, verifyBytes } from '../inputs/bundle.js';
import { canonical, demand, WorkflowError, type Reference } from '../workflow/contracts.js';
import { POLICY, policyDigest, sha256 } from '../policy.js';
import { content, decode, DESIGNER_LIMITS, encode, parseManifest, parseProjection, type DesignerInputProjection, type DesignerJobManifest, type ProjectionEntry } from './contracts.js';
import { parseRecipe, PREPARATION_POLICY, preparationPolicyBytes, type DesignerRecipe } from './recipes.js';

export interface DesignerAssets { template: Buffer; schema: Buffer }
export interface PreparedJob { job: Reference; manifest: DesignerJobManifest; projection: DesignerInputProjection; blobs: Map<string, Buffer> }
// Fixed package-owned resources only; source and compiled layouts differ by one level.
export async function loadAssets(): Promise<DesignerAssets> {
  const read = async (name: string): Promise<Buffer> => {
    for (const prefix of ['../../', '../../../']) {
      try { return await readInputFile(fileURLToPath(new URL(prefix + name, import.meta.url)), DESIGNER_LIMITS.document); }
      catch (error) { if (!(error instanceof WorkflowError && error.code === 'INPUT_FILE_MISSING')) throw error; }
    }
    throw new WorkflowError('DESIGNER_ASSET_MISSING');
  };
  return { template: await read('templates/designer-v1.txt'), schema: await read('schemas/designer-report-v1.schema.json') };
}
export function prepareJob(core: BundleCore, inputBlobs: ReadonlyMap<string, Buffer>, rawRecipe: DesignerRecipe, assets: DesignerAssets): PreparedJob {
  requirePilotInputs(core); verifyBytes(core, inputBlobs); const recipe = parseRecipe(rawRecipe);
  demand(recipe.repository === core.repository && recipe.storyId === core.story.id, 'RECIPE_CONTEXT_MISMATCH');
  const blobs = new Map<string, Buffer>(); const entries: ProjectionEntry[] = [];
  const retain = (bytes: Buffer) => { demand(bytes.length <= 8_388_608, 'RESOURCE_LIMIT'); const ref = content(bytes); blobs.set(ref.digest, Buffer.from(bytes)); return ref; };
  for (const [index, file] of [...core.files].sort((a, b) => a.path < b.path ? -1 : 1).entries()) {
    const image = recipe.requiredImages.find(i => i.path === file.path);
    if (image) demand(file.kind === 'static_design' && image.digest === file.digest, 'IMAGE_DIGEST_MISMATCH');
    entries.push({ logicalPath: image?.logicalPath ?? `files/source-${String(index).padStart(3, '0')}.bin`, source: { kind: 'bundle-file', path: file.path, sourceSha: file.sourceSha }, blob: retain(inputBlobs.get(file.digest)!), mediaType: image ? 'image/png' : 'application/octet-stream' });
  }
  for (const image of recipe.requiredImages) demand(entries.some(e => e.source.kind === 'bundle-file' && e.source.path === image.path && e.blob.digest === image.digest && e.mediaType === 'image/png'), 'REQUIRED_IMAGE_MISSING');
  for (const item of core.imports) entries.push({ logicalPath: `imports/${item.kind}.bin`, source: { kind: 'bundle-import', importKind: item.kind, basisSha: item.basisSha }, blob: retain(inputBlobs.get(item.digest)!), mediaType: 'application/octet-stream' });
  entries.push({ logicalPath: 'inputs/issue.json', source: { kind: 'bundle-issue' }, blob: retain(encode(core.issue)), mediaType: 'application/json' });
  entries.push({ logicalPath: 'inputs/scope.json', source: { kind: 'bundle-scope' }, blob: retain(encode(core.scope)), mediaType: 'application/json' });
  entries.sort((a, b) => a.logicalPath < b.logicalPath ? -1 : 1);
  demand(new Set(entries.map(e => e.logicalPath.toLowerCase())).size === entries.length, 'IMAGE_COLLISION');
  const projection = parseProjection({ schemaVersion: 1, kind: 'designer-input-projection', bundle: bundleReference(core), sourceSha: core.baselineSha, entries, requiredImages: recipe.requiredImages.map(i => i.logicalPath).sort(), materialization: 'logical-only' });
  const template = new TextDecoder('utf-8', { fatal: true }).decode(assets.template); demand(template.split('{{context}}').length === 2 && !template.replace('{{context}}', '').includes('{{'), 'TEMPLATE_INVALID');
  const schema = decode(assets.schema) as Record<string, unknown>; demand(schema?.$id === 'coffee-break/designer-report/v1' && schema.type === 'object' && schema.additionalProperties === false, 'REPORT_SCHEMA_INVALID');
  const context = canonical({ classification: 'untrusted-data', repository: core.repository, story: core.story, sourceSha: core.baselineSha, bundle: bundleReference(core), projection: content(encode(projection)), inputs: entries.map(e => ({ path: e.logicalPath, digest: e.blob.digest, classification: 'untrusted-data' })), authorization: 'none' }, DESIGNER_LIMITS.document);
  const prompt = Buffer.from(template.replace('{{context}}', () => context)); demand(prompt.length <= DESIGNER_LIMITS.document, 'RESOURCE_LIMIT');
  const manifest = parseManifest({ schemaVersion: 1, kind: 'designer-job', repository: core.repository, story: core.story, sourceSha: core.baselineSha, bundle: bundleReference(core), projection: retain(encode(projection)), preparationPolicy: { version: PREPARATION_POLICY.version, blob: retain(preparationPolicyBytes) }, recipe: { version: recipe.version, blob: retain(encode(recipe)) }, template: { version: 'designer-template/1', blob: retain(assets.template) }, resolvedPrompt: retain(prompt), reportSchema: { version: 'designer-report/1', blob: retain(assets.schema) }, diagnosticPolicy: { version: POLICY.version, digest: policyDigest, requiredCodexVersion: POLICY.codexVersion }, execution: { phase: 'A', launch: 'disabled', model: null, effectiveSettings: null } });
  const digest = sha256(encode(manifest)); return { job: { id: `designer-job-v1:${digest}`, digest }, manifest, projection, blobs };
}
