import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { core, bytes } from '../inputs/fixtures.js';
import { prepareBundle, bundleReference } from '../../src/inputs/bundle.js';
import { sha256 } from '../../src/policy.js';
import { WorkflowStore } from '../../src/workflow/store.js';
import { StoragePaths } from '../../src/workflow/paths.js';
import { loadAssets } from '../../src/designer/prepare.js';
import type { DesignerRecipe } from '../../src/designer/recipes.js';
import type { ArtifactFault } from '../../src/inputs/artifacts.js';
export const requestId = '55555555-5555-4555-8555-555555555555';
export const decisionId = '66666666-6666-4666-8666-666666666666';
export const at = '2026-10-18T12:00:00.000Z';
export async function synthetic(runId: string = randomUUID(), root = '/synthetic/test-only') {
  const c = core(); const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
  const paths = ['docs/design/studies/ep-07/renders/compact.png', 'docs/design/studies/ep-07/renders/desktop.png'];
  const manifestPath = 'docs/design/studies/ep-07/render-record.json';
  const manifest = Buffer.from(JSON.stringify({ status: 'DESIGN STUDY ONLY', baselineHead: c.baselineSha, records: paths.map(path => ({ file: path.split('/').at(-1), width: 1, height: 1, sha256: sha256(png), bytes: png.length })) }));
  const file = (path: string, kind: 'static_design' | 'manifest', data: Buffer) => ({ path, kind, digest: sha256(data), bytes: data.length, sourceSha: c.baselineSha, provenance: { origin: 'synthetic-test-only', limitations: ['Not approved production inputs'] } });
  c.files.push(file(manifestPath, 'manifest', manifest), ...paths.map(p => file(p, 'static_design', png)));
  c.issue.body += '\n'; // Original data, never a controller instruction.
  const blobs = new Map([[sha256(bytes), bytes], [sha256(png), png], [sha256(manifest), manifest]]);
  const bundle = prepareBundle(c, blobs, { runId, root, capturedAt: at, issueAdapter: 'synthetic-test-only' });
  const recipe: DesignerRecipe = { schemaVersion: 1, id: 'synthetic-two-images', version: 'synthetic/1', testOnly: true, repository: c.repository, storyId: c.story.id, requiredImages: paths.map(path => ({ path, digest: sha256(png), logicalPath: `files/${path.split('/').at(-1)}` })) };
  return { bundle, recipe, assets: await loadAssets() };
}
export async function harness(options: { runId?: string; fault?: ArtifactFault } = {}) {
  const runId = options.runId ?? randomUUID(); const storage = await realpath(await mkdtemp(join(tmpdir(), 'cb-designer-'))); const data = await synthetic(runId);
  const store = new WorkflowStore(storage, { designerRecipes: [data.recipe], artifactFault: options.fault });
  const created = await store.create({ schemaVersion: 1, type: 'run.created', eventId: randomUUID(), runId, expectedRevision: 0, at, payload: { repository: { id: data.bundle.core.repository, root: data.bundle.capture.root }, story: data.bundle.core.story, baselineSha: data.bundle.core.baselineSha } });
  if (created.exitCode) throw new Error(created.storage.code);
  const published = await store.publishInputs(runId, 1, data.bundle); if (published.exitCode) throw new Error(published.storage.code);
  const accepted = await store.attachInputs(runId, 1, bundleReference(data.bundle.core), 'accept'); if (accepted.exitCode) throw new Error(accepted.storage.code);
  return { ...data, runId, storage, store, dir: await new StoragePaths(storage).open(runId), clean: () => rm(storage, { recursive: true, force: true }), prepare: () => store.prepareDesigner(runId, 2, data.recipe.id, requestId) };
}
