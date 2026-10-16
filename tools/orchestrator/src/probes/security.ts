import { createServer, type Server, type Socket } from 'node:net';
import { rm, access } from 'node:fs/promises';
import type { Check, CommandEvidence } from '../contracts.js';
import { commandEvidence, commandSucceeded, runCommand, type CommandResult } from '../process.js';
import { guarded, guardProfile, type Runner } from '../guard.js';
import { POLICY, sha256 } from '../policy.js';
import { makeFixture, treeDigest, type Fixture } from './fixtures.js';
import { HELPER } from './helper.js';

const OPERATIONS = ['allowedRead', 'create', 'modify', 'rename', 'delete', 'credential', 'controller', 'symlink', 'gitWrite', 'childWrite', 'childCredential', 'network'] as const;
export const pendingSecurity = (reason: string): Check[] => OPERATIONS.map(id => ({ id: `security.${id}`, required: true, status: 'unverified', evidenceType: 'native', reason }));

export function parseProbe(result: CommandResult): Record<string, unknown> | null {
  if (!commandSucceeded(result)) return null;
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}
export function classifyProbe(result: CommandResult, networkControl: boolean): Check[] {
  const parsed = parseProbe(result);
  return OPERATIONS.map(id => {
    const actual = parsed?.[id];
    const expected = id === 'allowedRead' ? 'allowed' : 'denied';
    const violated = expected === 'denied' && actual === 'allowed' || expected === 'allowed' && actual === 'denied';
    const status = violated ? 'fail' : id === 'network' && !networkControl ? 'unverified' : actual === expected ? 'pass' : 'unverified';
    return { id: `security.${id}`, required: true, status, evidenceType: 'native', reason: status === 'pass' ? 'Fixed fixture operation matched the expected policy result.' : status === 'fail' ? 'Fixture operation violated the expected policy.' : 'Execution, denial type or positive control was not established.' };
  });
}
export function nativeOverrides(f: Fixture): string[] {
  const name = 'cb_flow_probe';
  const prefix = `permissions.${name}`;
  const entries = [
    `default_permissions="${name}"`,
    `${prefix}.filesystem."/"="read"`,
    `${prefix}.filesystem.":minimal"="read"`,
    `${prefix}.filesystem.":workspace_roots"."."="read"`,
    ...[f.credential, f.controller].map(path => `${prefix}.filesystem.${JSON.stringify(path)}="deny"`),
    `${prefix}.network.enabled=false`,
  ];
  return entries.flatMap(entry => ['-c', entry]);
}

interface ListenerResult { port?: number; error: string | null; cancelled: boolean }

function listenForProbe(server: Server, signal?: AbortSignal): Promise<ListenerResult> {
  if (signal?.aborted) return Promise.resolve({ error: null, cancelled: true });
  return new Promise(resolve => {
    let done = false;
    let cancelled = false;
    let expired = false;
    const finish = (error: string | null, port?: number): void => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      signal?.removeEventListener('abort', abort);
      resolve({ error, port, cancelled });
    };
    const close = (): void => {
      try { server.close(() => { if (cancelled || expired) finish(expired ? 'TIMEOUT' : null); }); }
      catch { finish('CLOSE_FAILED'); }
    };
    const abort = (): void => { cancelled = true; close(); };
    const deadline = setTimeout(() => { expired = true; close(); finish('TIMEOUT'); }, 2_000);
    // Retain these guards for this one-use server's lifetime: close/abort may
    // precede a queued bind error or listening event. No late error can escape,
    // and a late successful bind is immediately closed.
    server.on('error', (error: NodeJS.ErrnoException) => {
      const code = error.code;
      finish(code && /^[A-Z_]+$/.test(code) ? code : 'UNAVAILABLE');
    });
    server.on('listening', () => {
      if (cancelled || expired || done) { close(); return; }
      const address = server.address();
      finish(address && typeof address !== 'string' ? null : 'UNAVAILABLE', address && typeof address !== 'string' ? address.port : undefined);
    });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { cancelled = true; finish(null); return; }
    try { server.listen(0, '127.0.0.1'); }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      finish(code && /^[A-Z_]+$/.test(code) ? code : 'UNAVAILABLE');
    }
  });
}

export async function probeSecurity(codex: string | null, signal?: AbortSignal, runner: Runner = runCommand): Promise<{ checks: Check[]; commands: CommandEvidence[]; guardDigest: string; nativeDigest: string }> {
  const fixture = await makeFixture();
  const commands: CommandEvidence[] = [];
  const checks: Check[] = [];
  const sockets = new Set<Socket>();
  const server = createServer(socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); socket.end(); });
  let port: number | undefined;
  let listenerError: string | null = null;
  let nativeDigest = '';
  let profile = '';
  const execute = async (id: string, executable: string, args: string[]): Promise<CommandResult> => {
    const result = await guarded({ executable, args, cwd: fixture.workspace, signal, limits: { commandMs: POLICY.limits.probeMs } }, profile, runner);
    commands.push(commandEvidence(id, result));
    return result;
  };
  try {
    const before = await treeDigest(fixture.root);
    // Parent owns the endpoint. Failure to bind is unverified, never proof of denial.
    const listener = await listenForProbe(server, signal);
    port = listener.port;
    listenerError = listener.error;
    profile = guardProfile(fixture.root, port, fixture.guardFile);
    // The independent guard must deny this file even though native fixtures are writable.
    // Exclude its sentinel from that write allowance with a specific deny rule.
    profile += `\n(deny file-write* (literal ${JSON.stringify(fixture.guardFile)}))`;
    const args = JSON.stringify({ ...fixture, port });
    const guard = signal?.aborted || listener.cancelled ? null : parseProbe(await execute('security.guard-control', process.execPath, ['-e', HELPER, args, 'guard']));
    const guardPass = guard?.guardRead === 'denied' && guard?.guardWrite === 'denied';
    checks.push({ id: 'security.outer-guard', required: true, status: guardPass ? 'pass' : guard ? 'fail' : 'unverified', evidenceType: 'native', reason: guardPass ? 'Independent OS guard denied its synthetic read/write sentinel.' : 'Independent guard enforcement was not established; Codex was not started.' });
    const control = guardPass && port && !signal?.aborted ? parseProbe(await execute('security.network-control', process.execPath, ['-e', HELPER, args, 'network-control'])) : null;
    checks.push({ id: 'security.network-positive-control', required: true, status: control?.network === 'allowed' ? 'pass' : 'unverified', evidenceType: 'native', reason: 'Controlled loopback connection must succeed under the outer guard before a native denial can pass.', evidence: { listenerBound: port !== undefined, listenerError } });
    if (guardPass && codex && !signal?.aborted) {
      const overrides = nativeOverrides(fixture);
      nativeDigest = sha256(JSON.stringify({ overrides: overrides.map(value => value.replaceAll(fixture.root, '<fixture>')), helper: HELPER, guard: profile.replaceAll(fixture.root, '<fixture>') }));
      const native = await execute('security.codex-native', codex, ['--no-daemon', ...overrides, 'sandbox', '--permission-profile', 'cb_flow_probe', '--include-managed-config', '--cd', fixture.workspace, '--', process.execPath, '-e', HELPER, args, 'probe']);
      checks.push(...classifyProbe(native, control?.network === 'allowed'));
    } else checks.push(...pendingSecurity(guardPass ? 'Required Codex metadata capabilities were not established; no Codex sandbox command was started.' : 'Native Codex boundary not exercised because the independent safety guard was unavailable.'));
    checks.push({ id: 'security.fixture-integrity', required: true, status: await treeDigest(fixture.root) === before ? 'pass' : 'fail', evidenceType: 'observation', reason: 'Complete fixture tree checked after the attempted probes; symlinks are hashed without following them.' });
  } finally {
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    // Never remove a directory while an unconfirmed descendant could still use it.
    if (commands.every(command => command.cleanupConfirmed)) {
      await rm(fixture.root, { recursive: true, force: true });
      let removed = false;
      try { await access(fixture.root); } catch (error) { removed = (error as NodeJS.ErrnoException).code === 'ENOENT'; }
      checks.push({ id: 'security.fixture-cleanup', required: true, status: removed ? 'pass' : 'fail', evidenceType: 'observation', reason: removed ? 'Owned fixture directory removed.' : 'Fixture removal could not be confirmed.' });
    } else checks.push({ id: 'security.fixture-cleanup', required: true, status: 'fail', evidenceType: 'observation', reason: 'Descendant cleanup unconfirmed; fixture retained for operator recovery.', evidence: { fixture: fixture.root } });
  }
  return { checks, commands, guardDigest: sha256(profile.replaceAll(fixture.root, '<fixture>')), nativeDigest };
}
