import { createHash } from 'node:crypto';

export const VERSION = '0.1.0';
export const POLICY = {
  version: 'orch-001/1',
  platform: 'darwin-arm64',
  codexVersion: '0.162.0-alpha.17.2',
  limits: { commandMs: 30_000, probeMs: 60_000, outputBytes: 1_048_576, graceMs: 3_000 },
  restrictions: {
    inference: false, shell: false, ambientSecrets: false,
    network: 'denied; independent guard permits the controlled loopback positive control only',
    writes: 'owned disposable fixtures only',
    metadata: 'fixed version/help commands inside an OS guard',
    native: 'Codex named permission profile inside an independent OS guard',
    pluginsAndMcp: 'unverified; shell sandbox is insufficient evidence',
    authorization: 'diagnostics never authorize implementation',
  },
} as const;

export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const policyDigest = sha256(JSON.stringify(POLICY));
