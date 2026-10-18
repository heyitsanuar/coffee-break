import { expect, it } from 'vitest';
import { parseManifest, parseProjection, parseReceipt, parseDecision } from '../../src/designer/contracts.js';
import { harness, requestId, decisionId, synthetic } from './fixtures.js';
import { prepareJob } from '../../src/designer/prepare.js';

it.each(['schemaVersion', 'repository', 'story', 'projection', 'preparationPolicy', 'recipe', 'template', 'resolvedPrompt', 'reportSchema', 'diagnosticPolicy', 'execution'] as const)('rejects missing manifest %s', async field => {
  const f = await synthetic(); const manifest = { ...prepareJob(f.bundle.core, f.bundle.blobs, f.recipe, f.assets).manifest }; delete (manifest as Record<string, unknown>)[field]; expect(() => parseManifest(manifest)).toThrow();
});
it('rejects unsafe paths, duplicate destinations, unknown provenance and unbounded counts', async () => {
  const f = await synthetic(); const p = prepareJob(f.bundle.core, f.bundle.blobs, f.recipe, f.assets).projection;
  for (const logicalPath of ['../escape', '/absolute', 'files/../../escape', 'files/auth.json', 'files/a\\b', 'files/a:b']) expect(() => parseProjection({ ...p, entries: [{ ...p.entries[0], logicalPath }, ...p.entries.slice(1)] })).toThrow();
  expect(() => parseProjection({ ...p, entries: [p.entries[0], ...p.entries] })).toThrow();
  expect(() => parseProjection({ ...p, entries: p.entries.map((e, i) => i === 0 ? { ...e, source: { ...e.source, execute: true } } : e) })).toThrow();
  expect(() => parseProjection({ ...p, entries: Array(261).fill(p.entries[0]) })).toThrow();
});
it('rejects nested unknown fields and false success claims in saved records', async () => {
  const f = await harness();
  try {
    const receipt = (await f.prepare()).preparation!;
    expect(() => parseReceipt({ ...receipt, workflow: { ...receipt.workflow, approval: true } })).toThrow();
    const d = (await f.store.designerAdmission(f.runId, 2, requestId, decisionId)).admission!;
    expect(() => parseDecision({ ...d, checks: d.checks.slice().reverse() })).toThrow();
    expect(() => parseDecision({ ...d, controller: { ...d.controller, pluginPass: true } })).toThrow();
    expect(() => parseDecision({ ...d, checks: [...d.checks, d.checks[0]] })).toThrow();
  } finally { await f.clean(); }
});
