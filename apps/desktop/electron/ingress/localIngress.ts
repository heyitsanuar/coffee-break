import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type Server, type Socket } from 'node:net';
import type { AgentCurrentState, AgentStateChangedEvent, EventSource } from '@coffee-break/contracts';
import { RecentEventIds } from './dedup.js';
import {
  encodeFrame, JsonLineDecoder, ProtocolError, validateEventMessage,
  validateHello, validateSnapshot,
} from './protocol.js';

export type IngressPhase = 'awaiting-connector' | 'synchronizing' | 'ready' | 'disconnected';

export interface IngressState {
  revision: number;
  phase: IngressPhase;
  sessionId: string | null;
  agents: AgentCurrentState[] | null;
}

export type IngressChange =
  | { kind: 'connection'; state: IngressState }
  | { kind: 'snapshot'; state: IngressState }
  | { kind: 'event'; state: IngressState; event: AgentStateChangedEvent };

export interface LaunchCredentials {
  host: '127.0.0.1';
  port: number;
  token: string;
}

interface Session {
  socket: Socket;
  decoder: JsonLineDecoder;
  stage: 'hello' | 'snapshot' | 'ready' | 'closed';
  pending: boolean;
  source: EventSource | null;
  id: string | null;
  timer: NodeJS.Timeout | null;
}

export interface LocalIngressOptions {
  /** Main-process launch boundary only. US-015 will pass these to its owned child. */
  onLaunchCredentials: (credentials: LaunchCredentials) => void;
  onDiagnostic?: (code: string) => void;
  handshakeTimeoutMs?: number;
  snapshotTimeoutMs?: number;
}

const HOST = '127.0.0.1' as const;
const MAX_PENDING = 4;
const DEFAULT_TIMEOUT_MS = 5_000;

/** Main-process capability. Ordinary app startup does not instantiate it. */
export class LocalIngress {
  #server: Server | null = null;
  #lifecycle: 'new' | 'starting' | 'running' | 'stopping' | 'stopped' = 'new';
  #listenPromise: Promise<void> | null = null;
  #stopPromise: Promise<void> | null = null;
  #serverErrorHandler: (() => void) | null = null;
  #token: Buffer | null = null;
  #sockets = new Set<Socket>();
  #active: Session | null = null;
  #pending = 0;
  #nextSessionId = 0;
  #dedup = new RecentEventIds();
  #listeners = new Set<(change: IngressChange) => void>();
  #state: IngressState = {
    revision: 0, phase: 'awaiting-connector', sessionId: null, agents: null,
  };

  constructor(private readonly options: LocalIngressOptions) {}

  async start(): Promise<{ host: typeof HOST; port: number }> {
    if (this.#lifecycle === 'stopping' || this.#lifecycle === 'stopped') {
      throw new Error('ingress_stopped');
    }
    if (this.#lifecycle !== 'new') throw new Error('ingress_already_started');
    this.#lifecycle = 'starting';
    this.#token = randomBytes(32);
    const server = createServer((socket) => this.#accept(socket));
    this.#server = server;
    const onServerError = () => this.options.onDiagnostic?.('listener_error');
    this.#serverErrorHandler = onServerError;
    server.on('error', onServerError);
    this.#listenPromise = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        server.off('listening', onListening);
        server.off('error', onStartupError);
      };
      const onListening = () => { cleanup(); resolve(); };
      const onStartupError = (error: Error) => { cleanup(); reject(error); };
      server.once('listening', onListening);
      server.once('error', onStartupError);
      try { server.listen(0, HOST); } catch (error) { cleanup(); reject(error); }
    });
    try {
      await this.#listenPromise;
      if (this.#lifecycle !== 'starting') throw new Error('ingress_stopped');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('ingress_address_unavailable');
      const token = this.#token;
      if (!token) throw new Error('ingress_stopped');
      this.options.onLaunchCredentials({ host: HOST, port: address.port, token: token.toString('hex') });
      if (this.#lifecycle !== 'starting') throw new Error('ingress_stopped');
      this.#lifecycle = 'running';
      return { host: HOST, port: address.port };
    } catch (error) {
      const interrupted = this.#shutdownRequested();
      await this.stop();
      if (interrupted) throw new Error('ingress_stopped');
      throw error;
    }
  }

  #shutdownRequested(): boolean {
    return this.#lifecycle === 'stopping' || this.#lifecycle === 'stopped';
  }

  readCurrent(): IngressState {
    return structuredClone(this.#state);
  }

  subscribe(listener: (change: IngressChange) => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  stop(): Promise<void> {
    if (this.#stopPromise) return this.#stopPromise;
    this.#lifecycle = 'stopping';
    this.#stopPromise = this.#shutdown();
    return this.#stopPromise;
  }

  async #shutdown(): Promise<void> {
    const server = this.#server;
    // A pending listen must settle before deciding whether the listener needs closing.
    await this.#listenPromise?.catch(() => {});
    this.#active = null;
    for (const socket of this.#sockets) socket.destroy();
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (server && this.#serverErrorHandler) server.off('error', this.#serverErrorHandler);
    this.#serverErrorHandler = null;
    this.#sockets.clear();
    this.#pending = 0;
    this.#token?.fill(0);
    this.#token = null;
    this.#dedup.clear();
    this.#listeners.clear();
    this.#server = null;
    this.#listenPromise = null;
    this.#lifecycle = 'stopped';
  }

  #emit(change: IngressChange): void {
    for (const listener of this.#listeners) {
      try { listener(structuredClone(change)); } catch { this.options.onDiagnostic?.('listener_failed'); }
    }
  }

  #close(session: Session, code: string): void {
    if (session.stage === 'closed') return;
    if (session.timer) clearTimeout(session.timer);
    session.timer = null;
    session.stage = 'closed';
    this.options.onDiagnostic?.(code);
    session.socket.destroy();
  }

  #timeout(session: Session, milliseconds: number): void {
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => this.#close(session, 'session_timeout'), milliseconds);
  }

  #accept(socket: Socket): void {
    socket.on('error', () => { /* the close handler owns cleanup */ });
    if (this.#pending >= MAX_PENDING) {
      this.options.onDiagnostic?.('pending_limit');
      socket.destroy();
      return;
    }
    this.#pending++;
    this.#sockets.add(socket);
    const session: Session = {
      socket, decoder: new JsonLineDecoder(), stage: 'hello', pending: true,
      source: null, id: null, timer: null,
    };
    this.#timeout(session, this.options.handshakeTimeoutMs ?? DEFAULT_TIMEOUT_MS);
    socket.on('data', (chunk: Buffer) => {
      try {
        session.decoder.push(chunk, (message) => this.#message(session, message));
      } catch (error) {
        this.#close(session, error instanceof ProtocolError ? error.code : 'invalid_message');
      }
    });
    socket.on('close', () => {
      if (session.timer) clearTimeout(session.timer);
      try { session.decoder.finish(); } catch { this.options.onDiagnostic?.('partial_frame'); }
      this.#sockets.delete(socket);
      if (session.pending) this.#pending--;
      if (this.#active === session) {
        this.#active = null;
        this.#state = { ...this.#state, phase: 'disconnected' };
        this.#emit({ kind: 'connection', state: this.readCurrent() });
      }
    });
  }

  #message(session: Session, message: unknown): void {
    if (session.stage === 'closed') throw new ProtocolError('closed_session');
    if (session.stage === 'hello') {
      const hello = validateHello(message);
      const provided = Buffer.from(hello.token, 'hex');
      if (!this.#token || !timingSafeEqual(provided, this.#token)) {
        throw new ProtocolError('authentication_failed');
      }
      if (this.#active) throw new ProtocolError('connector_already_connected');
      this.#pending--;
      session.pending = false;
      session.stage = 'snapshot';
      session.source = hello.source;
      session.id = `session-${++this.#nextSessionId}`;
      this.#active = session;
      this.#state = { ...this.#state, phase: 'synchronizing', sessionId: session.id };
      this.#emit({ kind: 'connection', state: this.readCurrent() });
      this.#timeout(session, this.options.snapshotTimeoutMs ?? DEFAULT_TIMEOUT_MS);
      socketWrite(session.socket, { kind: 'hello-accepted', version: 1 });
      return;
    }
    if (this.#active !== session) throw new ProtocolError('stale_session');
    if (session.stage === 'snapshot') {
      const snapshot = validateSnapshot(message, session.source!);
      session.stage = 'ready';
      if (session.timer) clearTimeout(session.timer);
      session.timer = null;
      this.#state = {
        revision: this.#state.revision + 1,
        phase: 'ready',
        sessionId: session.id,
        agents: snapshot.agents,
      };
      this.#emit({ kind: 'snapshot', state: this.readCurrent() });
      socketWrite(session.socket, { kind: 'snapshot-accepted', version: 1, revision: this.#state.revision });
      return;
    }
    const event = validateEventMessage(message, session.source!);
    if (!this.#dedup.accept(event.source.instanceId, event.id)) return;
    const agents = this.#state.agents!.map((agent) =>
      agent.agent.id === event.payload.agent.id ? event.payload : agent);
    this.#state = { ...this.#state, revision: this.#state.revision + 1, agents };
    this.#emit({ kind: 'event', state: this.readCurrent(), event });
  }
}

function socketWrite(socket: Socket, value: unknown): void {
  socket.write(encodeFrame(value));
}
