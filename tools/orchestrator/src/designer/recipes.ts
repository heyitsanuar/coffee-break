import { demand, digest, object, version } from '../workflow/contracts.js';
import { documentText, repositoryId, safeRelative } from '../inputs/contracts.js';
import { content, DESIGNER_LIMITS, encode, type ControllerProvenance } from './contracts.js';
import { VERSION } from '../policy.js';

export interface DesignerRecipe {
  schemaVersion: 1; id: string; version: string; testOnly: true; repository: string; storyId: string;
  requiredImages: Array<{ path: string; digest: string; logicalPath: string }>;
}
// There is no approved production recipe. Only a trusted, injected test catalog
// may supply synthetic recipes. No environment variable or CLI flag enables it.
const CATALOG: readonly DesignerRecipe[] = Object.freeze([]);
export function parseRecipe(value: unknown): DesignerRecipe {
  encode(value); const r = object(value, ['schemaVersion', 'id', 'version', 'testOnly', 'repository', 'storyId', 'requiredImages']); version(r.schemaVersion);
  documentText(r.id, 128); documentText(r.version, 128); documentText(r.storyId, 256); repositoryId(r.repository); demand(r.testOnly === true, 'PRODUCTION_RECIPE_UNAPPROVED');
  demand(!(String(r.repository).toLowerCase() === 'heyitsanuar/coffee-break' && String(r.storyId).toUpperCase() === 'US-037'), 'PILOT_INPUTS_REQUIRED');
  demand(Array.isArray(r.requiredImages) && r.requiredImages.length > 0 && r.requiredImages.length <= DESIGNER_LIMITS.images, 'RESOURCE_LIMIT');
  for (const raw of r.requiredImages) { const i = object(raw, ['path', 'digest', 'logicalPath']); safeRelative(i.path); digest(i.digest); safeRelative(i.logicalPath); demand(/^files\/[a-zA-Z0-9._-]+\.png$/.test(i.logicalPath), 'UNSAFE_PATH'); demand(String(i.path).endsWith('.png'), 'IMAGE_FORMAT_UNSUPPORTED'); }
  const images = r.requiredImages as DesignerRecipe['requiredImages'];
  demand(new Set(images.map(i => i.path)).size === images.length && new Set(images.map(i => i.logicalPath.toLowerCase())).size === images.length, 'IMAGE_COLLISION');
  demand(images.every((i, n) => n === 0 || images[n - 1].path < i.path), 'DESIGNER_ORDER_INVALID'); return structuredClone(value) as DesignerRecipe;
}
export function resolveRecipe(id: string, catalog: readonly DesignerRecipe[] = CATALOG): DesignerRecipe {
  demand(catalog.filter(r => r.id === id).length === 1, 'RECIPE_NOT_APPROVED'); return parseRecipe(catalog.find(r => r.id === id));
}
export const PREPARATION_POLICY = {
  version: 'designer-preparation/1', phase: 'A', execution: 'disabled', materialization: 'logical-only', freshness: 'unverified', limits: DESIGNER_LIMITS,
} as const;
export const preparationPolicyBytes = encode(PREPARATION_POLICY);
export function provenance(): ControllerProvenance {
  return { producer: 'cb-flow', component: 'designer-preparation', version: VERSION, sourceSha: null, preparationPolicy: { version: PREPARATION_POLICY.version, blob: content(preparationPolicyBytes) } };
}
