import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { LocalIngress, type LaunchCredentials } from './ingress/localIngress.js';

export function simulationEnabled(flag: string | undefined, developmentUrl: string | undefined, packaged: boolean): boolean {
  return flag === '1' && Boolean(developmentUrl) && !packaged;
}

export function recoverySimulationEnabled(flag: string | undefined, simulated: boolean): boolean {
  return simulated && flag === '1';
}

type Spawn = typeof spawn;
interface OwnedChild {
  process: ChildProcess;
  exited: boolean;
  exit: Promise<void>;
  stopping: Promise<boolean> | null;
}

export class SimulatorController {
  readonly ingress: LocalIngress;
  private child: OwnedChild | null = null;
  private stopping: Promise<void> | null = null;
  private started = false;
  private stopped = false;
  private credentials: LaunchCredentials | null = null;
  private replacementScheduled = false;
  private recovery: Promise<void> | null = null;
  private cancelDelay: (() => void) | null = null;
  private cancelDisconnect: (() => void) | null = null;
  private unsubscribe: () => void;

  constructor(
    private readonly entryPath = join(__dirname, 'simulator.js'),
    private readonly spawnChild: Spawn = spawn,
    private readonly diagnostic: (code: string) => void = (code) => { process.stderr.write(`simulator:${code}\n`); },
    private readonly shutdownGraceMs = 500,
    private readonly recoveryMode = false,
  ) {
    this.ingress = new LocalIngress({
      onLaunchCredentials: (credentials) => {
        if (this.recoveryMode) this.credentials = credentials;
        this.launch(credentials);
      },
      onDiagnostic: (code) => this.diagnostic(`ingress_${code}`),
    });
    this.unsubscribe = this.ingress.subscribe((change) => {
      if (change.kind === 'snapshot') this.diagnostic('snapshot_accepted');
      if (change.kind === 'event') {
        this.diagnostic(`event_${change.event.id}`);
        if (this.recoveryMode && change.event.id === 'sim-005' && !this.replacementScheduled && !this.stopped) {
          this.replacementScheduled = true;
          this.recovery = this.replaceOnce().catch(() => { this.diagnostic('replacement_failed'); });
        }
      }
    });
  }

  async start(): Promise<void> {
    if (this.started || this.stopped) throw new Error('simulator_controller_single_use');
    this.started = true;
    await this.ingress.start();
  }

  private launch(credentials: LaunchCredentials, snapshotDelayMs: 0 | 1_000 = 0): void {
    if (this.child || this.stopped) throw new Error('simulator_already_launched');
    const child = this.spawnChild(process.execPath, [this.entryPath], {
      shell: false, env: { ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'inherit', 'inherit'],
    });
    const owned: OwnedChild = { process: child, exited: false, exit: Promise.resolve(), stopping: null };
    this.child = owned;
    owned.exit = new Promise<void>((resolve) => {
      const finish = (code: string) => {
        owned.exited = true;
        child.off('exit', onExit);
        child.off('error', onError);
        child.stdin?.off('error', onPipeError);
        if (!this.stopped) this.diagnostic(code);
        resolve();
      };
      const onExit = () => finish('child_exited');
      const onError = () => {
        if (!this.stopped) this.diagnostic('child_error');
        // Failed spawn has no live process; a process error alone is not proof of exit.
        if (child.pid === undefined) finish('child_spawn_failed');
      };
      const onPipeError = () => { if (!this.stopped) this.diagnostic('control_pipe_error'); };
      child.once('exit', onExit);
      child.on('error', onError);
      child.stdin?.on('error', onPipeError);
    });
    child.stdin?.write(`${JSON.stringify({ kind: 'launch', credentials,
      ...(snapshotDelayMs ? { snapshotDelayMs } : {}),
    })}\n`);
  }

  private delay(milliseconds: number): Promise<boolean> {
    return new Promise((resolve) => {
      const finish = (elapsed: boolean) => { clearTimeout(timer); this.cancelDelay = null; resolve(elapsed); };
      const timer = setTimeout(() => finish(true), milliseconds);
      this.cancelDelay = () => finish(false);
    });
  }

  private disconnected(): Promise<boolean> {
    if (this.ingress.readCurrent().phase === 'disconnected') return Promise.resolve(true);
    return new Promise((resolve) => {
      const finish = (lost: boolean) => {
        clearTimeout(timer); unsubscribe(); this.cancelDisconnect = null; resolve(lost);
      };
      const unsubscribe = this.ingress.subscribe((change) => {
        if (change.state.phase === 'disconnected') finish(true);
      });
      const timer = setTimeout(() => finish(false), 5_000);
      this.cancelDisconnect = () => finish(false);
    });
  }

  private async replaceOnce(): Promise<void> {
    if (!await this.delay(2_000) || this.stopped) return;
    const first = this.child;
    if (!first) return;
    const lost = this.disconnected();
    const terminated = await this.stopChild(first);
    if (!terminated) this.cancelDisconnect?.();
    if (!await lost || !terminated || this.stopped) return;
    this.child = null;
    if (!await this.delay(2_000) || this.stopped || !this.credentials) return;
    const credentials = this.credentials;
    this.credentials = null;
    this.launch(credentials, 1_000);
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopped = true;
    this.cancelDelay?.();
    this.cancelDisconnect?.();
    this.unsubscribe();
    this.credentials = null;
    this.stopping = this.shutdown();
    return this.stopping;
  }

  private async shutdown(): Promise<void> {
    await this.recovery;
    if (this.child) await this.stopChild(this.child);
    this.child = null;
    await this.ingress.stop();
  }

  private stopChild(child: OwnedChild): Promise<boolean> {
    if (child.stopping) return child.stopping;
    child.stopping = (async () => {
      if (child.exited) return true;
      try { child.process.stdin?.end('{"kind":"shutdown"}\n'); } catch { /* force fallback below */ }
      if (await this.waitForExit(child, this.shutdownGraceMs)) return true;
      child.process.kill('SIGTERM');
      if (await this.waitForExit(child, this.shutdownGraceMs)) return true;
      child.process.kill('SIGKILL');
      const ended = await this.waitForExit(child, this.shutdownGraceMs);
      if (!ended) this.diagnostic('child_shutdown_failed');
      return ended;
    })();
    return child.stopping;
  }

  private async waitForExit(child: OwnedChild, milliseconds: number): Promise<boolean> {
    if (child.exited) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ended = await Promise.race([
      child.exit.then(() => true),
      new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), milliseconds); }),
    ]);
    if (timer) clearTimeout(timer);
    return ended;
  }
}
