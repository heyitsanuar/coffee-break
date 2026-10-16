import { spawn } from 'node:child_process';
import { POLICY, sha256 } from './policy.js';
import type { CommandEvidence } from './contracts.js';

export interface CommandSpec {
  executable: string;
  args: readonly string[];
  cwd: string;
  limits?: Partial<{ commandMs: number; probeMs: number; outputBytes: number; graceMs: number }>;
  signal?: AbortSignal;
}
export interface CommandResult extends Omit<CommandEvidence, 'id' | 'outputDigest' | 'aliasSetupWarning' | 'guardUnavailable'> {
  stdout: string;
  stderr: string;
}

// No HOME, CODEX_HOME, tokens, proxy settings, shell startup or Node injection.
export function allowedEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { PATH: source.PATH ?? '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', NO_COLOR: '1', NPM_CONFIG_USERCONFIG: '/dev/null', NPM_CONFIG_GLOBALCONFIG: '/dev/null', NPM_CONFIG_UPDATE_NOTIFIER: 'false' };
}
export const commandSucceeded = (result: CommandResult): boolean => result.exitCode === 0 && !result.spawnError && !result.signal && !result.timedOut && !result.overflow && !result.interrupted && result.signals.length === 0 && result.cleanupConfirmed;
export function commandEvidence(id: string, result: CommandResult): CommandEvidence {
  const { stdout, stderr, ...bounded } = result;
  return { id, ...bounded, outputDigest: sha256(stdout + '\0' + stderr), aliasSetupWarning: /could not create PATH aliases/.test(stderr), guardUnavailable: /sandbox_init:.*Operation not permitted|sandbox-exec:.*not permitted/i.test(stderr) };
}

export function runCommand(spec: CommandSpec): Promise<CommandResult> {
  const limits = { ...POLICY.limits, ...spec.limits };
  const started = Date.now();
  const result: CommandResult = { exitCode: null, signal: null, timedOut: false, overflow: false, interrupted: false, cleanupConfirmed: false, bytesObserved: 0, durationMs: 0, signals: [], stdout: '', stderr: '' };
  if (spec.signal?.aborted) return Promise.resolve({ ...result, interrupted: true, cleanupConfirmed: true });
  return new Promise(resolve => {
    const child = spawn(spec.executable, [...spec.args], { cwd: spec.cwd, shell: false, detached: true, env: allowedEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
    let finished = false;
    let stopping = false;
    let closed = false;
    let storedBytes = 0;
    const buffers: { stdout: Buffer[]; stderr: Buffer[] } = { stdout: [], stderr: [] };
    let escalation: ReturnType<typeof setTimeout> | undefined;
    let verification: ReturnType<typeof setTimeout> | undefined;
    const groupExists = (): boolean => {
      if (!child.pid) return false;
      try { process.kill(-child.pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
    };
    const send = (signal: NodeJS.Signals): void => {
      if (!child.pid || !groupExists()) return;
      result.signals.push(signal);
      try { process.kill(-child.pid, signal); } catch { /* verification below determines success */ }
    };
    const finish = (): void => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline); clearTimeout(escalation); clearTimeout(verification);
      spec.signal?.removeEventListener('abort', interrupt);
      child.stdout.destroy(); child.stderr.destroy(); child.unref();
      for (const channel of ['stdout', 'stderr'] as const) {
        try { result[channel] = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(buffers[channel])); } catch { result[channel] = ''; }
      }
      result.durationMs = Date.now() - started;
      result.cleanupConfirmed = !groupExists();
      resolve(result);
    };
    const verify = (until: number): void => {
      if (!groupExists()) { finish(); return; }
      if (Date.now() >= until) { finish(); return; }
      verification = setTimeout(() => verify(until), 20);
    };
    const stop = (): void => {
      if (stopping || finished) return;
      stopping = true;
      send('SIGTERM');
      escalation = setTimeout(() => { send('SIGKILL'); verify(Date.now() + limits.graceMs); }, limits.graceMs);
      if (closed && !groupExists()) finish();
    };
    const interrupt = (): void => { result.interrupted = true; stop(); };
    const deadline = setTimeout(() => { result.timedOut = true; stop(); }, limits.commandMs);
    spec.signal?.addEventListener('abort', interrupt, { once: true });
    const collect = (channel: 'stdout' | 'stderr', data: Buffer): void => {
      result.bytesObserved += data.length;
      const available = Math.max(0, limits.outputBytes - storedBytes);
      const bounded = data.subarray(0, available);
      if (bounded.length) buffers[channel].push(Buffer.from(bounded));
      storedBytes += bounded.length;
      if (result.bytesObserved > limits.outputBytes) { result.overflow = true; stop(); }
    };
    child.stdout.on('data', (data: Buffer) => collect('stdout', data));
    child.stderr.on('data', (data: Buffer) => collect('stderr', data));
    child.on('error', error => { result.spawnError = /^[A-Z0-9_]+$/.test((error as NodeJS.ErrnoException).code ?? '') ? (error as NodeJS.ErrnoException).code : 'SPAWN_ERROR'; });
    child.on('exit', (code, signal) => { result.exitCode = code; result.signal = signal; if (groupExists()) stop(); });
    child.on('close', () => {
      closed = true;
      if (!groupExists()) finish();
      else stop(); // A parent exiting 0 does not excuse surviving descendants.
    });
  });
}
