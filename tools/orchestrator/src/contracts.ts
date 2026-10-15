import { sha256 } from './policy.js';

export type Status = 'pass' | 'fail' | 'unsupported' | 'unverified';
export interface Check {
  id: string;
  required: boolean;
  status: Status;
  evidenceType: 'metadata' | 'native' | 'observation';
  reason: string;
  evidence?: Record<string, string | number | boolean | null>;
}
export interface Identity {
  repositoryRoot: string;
  head: string;
  statusDigest: string;
  codexSha256: string;
  policyDigest: string;
}
export function identityDigest(identity: Identity): string {
  return sha256(JSON.stringify([identity.repositoryRoot, identity.head, identity.statusDigest, identity.codexSha256, identity.policyDigest]));
}
export const isFresh = (digest: string, current: Identity): boolean => digest === identityDigest(current);

export function decide(checks: readonly Check[]): { ready: boolean; blockers: string[]; exitCode: number } {
  const required = checks.filter(check => check.required);
  const blockers = required.filter(check => check.status !== 'pass').map(check => check.id);
  if (!required.length) blockers.push('missing-required-evidence');
  return { ready: blockers.length === 0, blockers, exitCode: required.some(check => check.status === 'fail') ? 1 : blockers.length ? 3 : 0 };
}

export interface CommandEvidence {
  id: string;
  exitCode: number | null;
  spawnError?: string;
  signal: string | null;
  timedOut: boolean;
  overflow: boolean;
  interrupted: boolean;
  cleanupConfirmed: boolean;
  bytesObserved: number;
  durationMs: number;
  signals: string[];
  outputDigest: string;
  aliasSetupWarning: boolean;
  guardUnavailable: boolean;
}
export interface ToolIdentity {
  path: string | null;
  version: string | null;
  sha256?: string;
}
export interface DiagnosticReport {
  schemaVersion: 1;
  diagnosticVersion: string;
  generatedAt: string;
  host: { os: string; architecture: string; node: string };
  repository: { root: string | null; head: string | null; clean: boolean | null; statusDigest: string | null };
  tools: Record<string, ToolIdentity>;
  policy: { version: string; digest: string; restrictions: Record<string, string | boolean>; guardDigest: string | null; nativeDigest: string | null };
  fingerprint: string | null;
  checks: Check[];
  commands: CommandEvidence[];
  ready: boolean;
  blockers: string[];
  exitCode: number;
}
