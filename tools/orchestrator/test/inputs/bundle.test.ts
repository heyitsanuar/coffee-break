import { expect, it } from 'vitest';
import { canonicalCore, compareBundles, fingerprint, prepareBundle } from '../../src/inputs/bundle.js';
import { INPUT_LIMITS, parseCore, parseIssue } from '../../src/inputs/contracts.js';
import { core, bytes, issue, prepared } from './fixtures.js';
import { sha256 } from '../../src/policy.js';

it('normalizes manifest collection order without changing original imported bytes', () => {
  const a = core(); a.files.push({ ...a.files[0], path: 'template.md', kind: 'template' }); a.applicable.push({ kind: 'template', path: 'template.md', digest: a.files[0].digest });
  const b = structuredClone(a); b.files.reverse(); b.imports.reverse(); b.applicable.reverse();
  expect(fingerprint(a)).toBe(fingerprint(b)); expect(compareBundles(a, b)).toEqual({ status: 'fresh', changed: [] });
  expect(prepareBundle(b, new Map([[sha256(bytes), bytes]]), prepared().capture).core).toEqual(canonicalCore(a));
});
it.each(['object', 'import', 'bundle', 'manifest', 'issue'])('enforces actual %s byte bounds', category => {
  const c = core();
  if (category === 'object') c.files[0].bytes = INPUT_LIMITS.object + 1;
  if (category === 'import') c.imports[0].bytes = INPUT_LIMITS.imported + 1;
  if (category === 'bundle') c.files = Array.from({ length: 9 }, (_, i) => ({ ...c.files[0], kind: i ? 'source' : 'policy', path: i ? `source-${i}.txt` : 'policy.md', bytes: INPUT_LIMITS.object }));
  if (category === 'manifest') c.scope.unresolvedDecisions = Array(200).fill('x'.repeat(8192));
  if (category === 'issue') expect(() => parseIssue({ ...issue(), body: 'x'.repeat(INPUT_LIMITS.issue + 1) })).toThrow();
  else expect(() => parseCore(c)).toThrow('RESOURCE_LIMIT');
});
it('does not accept missing declared digests or relabel PNGs as runtime evidence', () => {
  const c = core(); const path = 'docs/design/studies/ep-07/refinements/artifact-manifest.json';
  const manifest = Buffer.from(JSON.stringify({ baselineHead: c.baselineSha, newFiles: [{ path: 'docs/design/studies/ep-07/other.png' }] }));
  c.files.push({ path, digest: sha256(manifest), bytes: manifest.length, kind: 'manifest', sourceSha: c.baselineSha, provenance: { origin: 'fixture', limitations: [] } });
  expect(() => prepareBundle(c, new Map([[sha256(bytes), bytes], [sha256(manifest), manifest]]), prepared().capture)).toThrow('MANIFEST_INVALID');
  expect(() => parseCore({ ...core(), files: [{ ...core().files[0], path: 'docs/design/studies/ep-07/image.png', kind: 'source' }] })).toThrow('EVIDENCE_CLASSIFICATION');
});
it('reads published PNG and manifest bytes unchanged with historical provenance and the documented self-entry', async () => {
  const { readFile } = await import('node:fs/promises');
  const paths = ['docs/design/studies/ep-07/README.md', 'docs/design/studies/ep-07/refinements/README.md', 'docs/design/studies/ep-07/refinements/artifact-manifest.json', 'docs/design/studies/ep-07/refinements/renders/integrated-overview-1100x760.png', 'docs/design/studies/ep-07/refinements/renders/integrated-compact-760x540.png', 'docs/design/studies/ep-07/refinements/renders/integrated-compact-full-flow.png'];
  const c = core(); const blobs = new Map([[sha256(bytes), bytes]]);
  for (const path of paths) {
    const data = await readFile(new URL('../../../../' + path, import.meta.url)); const digest = sha256(data); blobs.set(digest, data);
    c.files.push({ path, digest, bytes: data.length, kind: path.endsWith('artifact-manifest.json') ? 'manifest' : 'static_design', sourceSha: c.baselineSha, provenance: { origin: 'copied published PR-98 reference', limitations: ['Static study; not runtime evidence'] } });
  }
  const result = prepareBundle(c, blobs, prepared().capture);
  const manifest = result.blobs.get(c.files.find(f => f.path.endsWith('artifact-manifest.json'))!.digest)!.toString();
  expect(manifest).toContain('/Users/asdf/'); expect(manifest).toContain('self-hash intentionally omitted');
  expect(result.core.files.filter(f => f.path.endsWith('.png')).every(f => f.kind === 'static_design')).toBe(true);
});
it('rejects nonportable metadata origins and unsupported multiline AC formats rather than losing text', () => {
  const c = core(); c.imports[0].origin = '/different/machine/report.md'; expect(() => parseCore(c)).toThrow('PORTABLE_ORIGIN_REQUIRED');
  expect(() => parseIssue({ ...issue(), body: issue().body + '  silently lost continuation\n' })).toThrow('AC_SECTION_INVALID');
});
