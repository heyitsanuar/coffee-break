import { expect, it } from 'vitest';
import { supportedVersion } from '../../src/codex-capabilities.js';
import { parseDecision, parseReceipt } from '../../src/designer/contracts.js';
import { harness, requestId, decisionId } from './fixtures.js';

it('keeps all native prerequisites unverified and the observed CLI mismatch unsupported', async () => {
  const f = await harness();
  try {
    await f.prepare(); const decision = (await f.store.designerAdmission(f.runId, 2, requestId, decisionId)).admission!;
    expect(supportedVersion('codex-cli 0.163.0-alpha.10.2')).toBe(false);
    expect(decision.checks.find(c => c.id === 'cli-identity')!.status).toBe('unverified');
    for (const id of ['diagnostics', 'input-freshness', 'filesystem-isolation', 'credential-isolation', 'network-isolation', 'plugins-mcp', 'hooks', 'delegation', 'process-containment']) expect(decision.checks.find(c => c.id === id)).toMatchObject({ status: 'unverified', evidence: [] });
    expect(decision.blockers).toContain('PHASE_A_EXECUTION_DISABLED');
    for (const mutation of [{ decision: 'allow' }, { allowLaunch: true }, { authorization: 'approved' }, { phase: 'B' }, { sessionId: 'fake' }]) expect(() => parseDecision({ ...decision, ...mutation })).toThrow();
    for (const id of ['diagnostics', 'cli-identity', 'plugins-mcp', 'network-isolation']) expect(() => parseDecision({ ...decision, checks: decision.checks.map(c => c.id === id ? { ...c, status: 'pass' } : c) })).toThrow('PHASE_A_EVIDENCE_UNVERIFIED');
    expect(() => parseDecision({ ...decision, blockers: [] })).toThrow();
  } finally { await f.clean(); }
});
it('rejects receipt provenance, freshness and authority fabrication', async () => {
  const f = await harness();
  try {
    const receipt = (await f.prepare()).preparation!;
    for (const mutation of [{ authorization: 'approved' }, { attemptId: 'fake' }, { freshness: { ...receipt.freshness, overall: 'fresh' } }, { controller: { ...receipt.controller, sourceSha: 'a'.repeat(40) } }, { schemaVersion: 2 }]) expect(() => parseReceipt({ ...receipt, ...mutation })).toThrow();
  } finally { await f.clean(); }
});
