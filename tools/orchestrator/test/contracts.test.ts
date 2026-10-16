import { describe, expect, it } from 'vitest';
import { decide, identityDigest, isFresh, type Check } from '../src/contracts.js';
import { POLICY } from '../src/policy.js';

const check = (status: Check['status'], required = true): Check => ({ id: status, required, status, evidenceType: 'metadata', reason: 'fixture' });

describe('fail-closed readiness', () => {
  it('requires executed evidence for every required check', () => {
    expect(decide([check('pass')])).toEqual({ ready: true, blockers: [], exitCode: 0 });
    for (const status of ['unsupported', 'unverified'] as const) expect(decide([check('pass'), check(status)])).toEqual({ ready: false, blockers: [status], exitCode: 3 });
    expect(decide([check('unverified'), check('fail')]).exitCode).toBe(1);
    expect(decide([]).ready).toBe(false);
    expect(decide([check('unverified', false)]).ready).toBe(false);
    expect(decide([check('pass'), check('fail', false)]).ready).toBe(true);
  });
  it('binds evidence to executable, policy, baseline and cleanliness', () => {
    const identity = { repositoryRoot: '/fixture', head: 'a'.repeat(40), statusDigest: 'clean', codexSha256: 'b'.repeat(64), policyDigest: 'c'.repeat(64) };
    const digest = identityDigest(identity);
    expect(isFresh(digest, identity)).toBe(true);
    for (const key of Object.keys(identity) as Array<keyof typeof identity>) expect(isFresh(digest, { ...identity, [key]: 'changed' })).toBe(false);
    expect(POLICY.limits).toEqual({ commandMs: 30000, probeMs: 60000, outputBytes: 1048576, graceMs: 3000 });
  });
});
