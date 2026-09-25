import { randomUUID } from 'node:crypto';
import { connect, type Socket } from 'node:net';
import type { EventSource } from '@coffee-break/contracts';
import type { LaunchCredentials } from '../ingress/localIngress.js';
import { initialAgents, realClock, scheduleScenario, type TimerClock } from './scenario.js';

const FRAME_LIMIT = 16_384;

export function parseLaunch(value: unknown): LaunchCredentials {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_launch');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).sort().join(',') !== 'host,port,token'
    || item.host !== '127.0.0.1'
    || !Number.isInteger(item.port) || (item.port as number) < 1 || (item.port as number) > 65_535
    || typeof item.token !== 'string' || !/^[0-9a-f]{64}$/.test(item.token)) {
    throw new Error('invalid_launch');
  }
  return item as unknown as LaunchCredentials;
}

export class SimulatorClient {
  readonly source: EventSource;
  phase: 'starting' | 'connecting' | 'authenticating' | 'synchronizing' | 'running' | 'connected-idle' | 'shutting-down' = 'starting';
  private socket: Socket | null = null;
  private buffered = Buffer.alloc(0);
  private cancelScenario: (() => void) | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly clock: TimerClock = realClock,
    private readonly onFailure: (code: string) => void = () => {},
    private readonly createSocket: typeof connect = connect,
  ) {
    this.source = { kind: 'local-connector', instanceId: `sim-${randomUUID()}` };
  }

  start(value: unknown): void {
    if (this.phase !== 'starting') throw new Error('simulator_already_started');
    const launch = parseLaunch(value);
    this.phase = 'connecting';
    const socket = this.createSocket({ host: launch.host, port: launch.port });
    this.socket = socket;
    socket.on('connect', () => {
      if (this.stopped) return;
      this.phase = 'authenticating';
      this.write({ kind: 'hello', version: 1, token: launch.token, source: this.source });
      this.armTimeout();
    });
    socket.on('data', (chunk: Buffer) => {
      try { this.receive(chunk); } catch { this.fail('protocol_error'); }
    });
    socket.on('error', () => this.fail('socket_error'));
    socket.on('close', () => {
      if (!this.stopped) this.fail('socket_closed');
    });
  }

  private write(message: unknown): void {
    const bytes = Buffer.from(JSON.stringify(message), 'utf8');
    if (bytes.length > FRAME_LIMIT) throw new Error('frame_too_large');
    this.socket?.write(Buffer.concat([bytes, Buffer.from('\n')]));
  }

  private armTimeout(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.fail('ack_timeout'), 5_000);
  }

  private receive(chunk: Buffer): void {
    let offset = 0;
    while (offset < chunk.length) {
      const end = chunk.indexOf(0x0a, offset);
      const segment = chunk.subarray(offset, end === -1 ? chunk.length : end);
      if (this.buffered.length + segment.length > FRAME_LIMIT) throw new Error('frame_too_large');
      this.buffered = Buffer.concat([this.buffered, segment]);
      if (end === -1) return;
      const frame = this.buffered;
      this.buffered = Buffer.alloc(0);
      if (!frame.length || frame.includes(0x0d)) throw new Error('invalid_frame');
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(frame);
      this.message(JSON.parse(decoded));
      offset = end + 1;
    }
  }

  private message(value: unknown): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_ack');
    const ack = value as Record<string, unknown>;
    if (this.phase === 'authenticating'
      && Object.keys(ack).sort().join(',') === 'kind,version'
      && ack.kind === 'hello-accepted' && ack.version === 1) {
      this.phase = 'synchronizing';
      this.write({ kind: 'snapshot', version: 1, source: this.source, agents: initialAgents });
      this.armTimeout();
      return;
    }
    if (this.phase === 'synchronizing'
      && Object.keys(ack).sort().join(',') === 'kind,revision,version'
      && ack.kind === 'snapshot-accepted' && ack.version === 1
      && Number.isSafeInteger(ack.revision) && (ack.revision as number) > 0) {
      if (this.timeout) clearTimeout(this.timeout);
      this.timeout = null;
      this.phase = 'running';
      this.cancelScenario = scheduleScenario(this.source, (event) => {
        this.write({ kind: 'event', version: 1, event });
      }, this.clock, () => { this.phase = 'connected-idle'; });
      return;
    }
    throw new Error('invalid_ack');
  }

  private fail(code: string): void {
    if (this.stopped) return;
    this.stop();
    this.onFailure(code);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.phase = 'shutting-down';
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    this.cancelScenario?.();
    this.cancelScenario = null;
    this.socket?.destroy();
    this.socket = null;
    this.buffered = Buffer.alloc(0);
  }
}
