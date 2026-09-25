import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { LocalIngress, type LaunchCredentials } from './ingress/localIngress.js';

export function simulationEnabled(flag: string | undefined, developmentUrl: string | undefined, packaged: boolean): boolean {
  return flag === '1' && Boolean(developmentUrl) && !packaged;
}

type Spawn = typeof spawn;

export class SimulatorController {
  readonly ingress: LocalIngress;
  private child: ChildProcess | null = null;
  private childExit: Promise<void> | null = null;
  private stopping: Promise<void> | null = null;
  private started = false;
  private stopped = false;

  constructor(
    private readonly entryPath = join(__dirname, 'simulator.js'),
    private readonly spawnChild: Spawn = spawn,
    private readonly diagnostic: (code: string) => void = (code) => { process.stderr.write(`simulator:${code}\n`); },
    private readonly shutdownGraceMs = 500,
  ) {
    this.ingress = new LocalIngress({
      onLaunchCredentials: (credentials) => this.launch(credentials),
      onDiagnostic: (code) => this.diagnostic(`ingress_${code}`),
    });
    this.ingress.subscribe((change) => {
      if (change.kind === 'snapshot') this.diagnostic('snapshot_accepted');
      if (change.kind === 'event') this.diagnostic(`event_${change.event.id}`);
    });
  }

  async start(): Promise<void> {
    if (this.started || this.stopped) throw new Error('simulator_controller_single_use');
    this.started = true;
    await this.ingress.start();
  }

  private launch(credentials: LaunchCredentials): void {
    if (this.child || this.stopped) throw new Error('simulator_already_launched');
    const child = this.spawnChild(process.execPath, [this.entryPath], {
      shell: false,
      env: { ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    this.child = child;
    this.childExit = new Promise<void>((resolve) => {
      child.once('exit', () => {
        if (!this.stopped) this.diagnostic('child_exited');
        resolve();
      });
      child.once('error', () => {
        if (!this.stopped) this.diagnostic('child_error');
        resolve();
      });
    });
    child.stdin?.on('error', () => { if (!this.stopped) this.diagnostic('control_pipe_error'); });
    child.stdin?.write(`${JSON.stringify({ kind: 'launch', credentials })}\n`);
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopped = true;
    this.stopping = this.shutdown();
    return this.stopping;
  }

  private async shutdown(): Promise<void> {
    const child = this.child;
    if (child && child.exitCode === null) {
      try { child.stdin?.end('{"kind":"shutdown"}\n'); } catch { /* force fallback below */ }
      if (!await this.waitForExit(this.shutdownGraceMs)) {
        child.kill('SIGTERM');
        if (!await this.waitForExit(this.shutdownGraceMs)) {
          child.kill('SIGKILL');
          await this.waitForExit(this.shutdownGraceMs);
        }
      }
    }
    await this.ingress.stop();
  }

  private async waitForExit(milliseconds: number): Promise<boolean> {
    if (!this.childExit) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ended = await Promise.race([
      this.childExit.then(() => true),
      new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), milliseconds); }),
    ]);
    if (timer) clearTimeout(timer);
    return ended;
  }
}
