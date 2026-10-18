import { expect, it } from 'vitest';
import { parseIssue, parseCore, safeRelative, INPUT_LIMITS } from '../../src/inputs/contracts.js';
import { fingerprint, prepareBundle, compareBundles } from '../../src/inputs/bundle.js';
import { sha256 } from '../../src/policy.js';

import { core, issue, prepared, bytes } from './fixtures.js';

it('requires exact issue identity/ACs and never accepts empty or duplicate criteria', () => {
  expect(issue().criteria.map(c => c.id)).toEqual(['AC-01', 'AC-02']);
  for (const change of [{ body: '' }, { repository: 'other/repo' }, { state: 'UNKNOWN' }, { number: 0 }, { body: issue().body + '- [ ] AC-01: Duplicate\n' }]) expect(() => parseIssue({ ...issue(), ...change })).toThrow();
  expect(() => parseCore({ ...core(), schemaVersion: 2 })).toThrow('UNSUPPORTED_SCHEMA');
  expect(() => parseCore({ ...core(), extra: true })).toThrow();
});
it.each(['../outside', '/absolute', 'a/../b', 'a//b', '.git/config', '.env', 'x/.env.local', '.aws/credentials', 'id_rsa', 'private.pem', 'auth.json', 'a\\b'])('rejects excluded path %s before reads', path => expect(() => safeRelative(path)).toThrow());
it('keeps portable identity independent of capture/run/time/root and canonical key order', () => {
  const a = prepared(); const b = prepareBundle(core(), new Map([[sha256(bytes), bytes]]), { ...a.capture, root: '/different', runId: '33333333-3333-4333-8333-333333333333', capturedAt: '2026-10-18T12:00:00.000Z' });
  expect(fingerprint(a.core)).toBe(fingerprint(b.core)); expect(a.capture).not.toEqual(b.capture);
  expect(fingerprint(JSON.parse(JSON.stringify(core())))).toBe(fingerprint(core()));
  expect(compareBundles(a.core, b.core)).toEqual({ status: 'fresh', changed: [] });
});
it('detects every relevant category of input drift', () => {
  const original = core();
  const changes = [
    (c: ReturnType<typeof core>) => { c.issue.title += '!'; },
    (c: ReturnType<typeof core>) => { c.issue.state = 'CLOSED'; },
    (c: ReturnType<typeof core>) => { c.issue.body = c.issue.body.replace('Exact', 'Changed'); c.issue.criteria[0].text = 'Changed criterion'; },
    (c: ReturnType<typeof core>) => { c.baselineSha = 'b'.repeat(40); c.files[0].sourceSha = c.baselineSha; c.imports.forEach(i => { i.basisSha = c.baselineSha; }); },
    (c: ReturnType<typeof core>) => { c.files[0].digest = 'c'.repeat(64); c.applicable[0].digest = c.files[0].digest; },
    (c: ReturnType<typeof core>) => { c.imports[0].digest = 'd'.repeat(64); },
    (c: ReturnType<typeof core>) => { c.scope.allowedChanges.push('src/other.ts'); },
    (c: ReturnType<typeof core>) => { c.scope.nonGoals.push('Other'); },
    (c: ReturnType<typeof core>) => { c.scope.validationPlan.push('test'); },
    (c: ReturnType<typeof core>) => { c.scope.unresolvedDecisions.push('Pending'); },
    (c: ReturnType<typeof core>) => { c.files.push({ ...c.files[0], path: 'template.md', kind: 'template' }); c.applicable.push({ kind: 'template', path: 'template.md', digest: c.files[0].digest }); },
  ];
  for (const change of changes) { const c = structuredClone(original); change(c); expect(fingerprint(c)).not.toBe(fingerprint(original)); expect(compareBundles(original, c).status).toBe('drift'); }
});
it('rejects missing imports, unbound policy, dirty state, unsafe scope and size/count violations', () => {
  for (const change of [{ imports: [] }, { applicable: [] }, { checkout: { clean: false } }, { scope: { ...core().scope, allowedChanges: ['../outside'] } }, { files: Array(257).fill(core().files[0]) }]) expect(() => parseCore({ ...core(), ...change })).toThrow();
  expect(INPUT_LIMITS).toMatchObject({ files: 256, object: 8 * 1024 * 1024, issue: 1024 * 1024, imported: 2 * 1024 * 1024, manifest: 1024 * 1024, bundle: 64 * 1024 * 1024, report: 1024 * 1024, retained: 256 * 1024 * 1024 });
  expect(() => prepareBundle(core(), new Map([[sha256(bytes), Buffer.from('wrong')]]), prepared().capture)).toThrow('CONTENT_MISMATCH');
});
