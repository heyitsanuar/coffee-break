import { connect, Server, type Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalIngress, type IngressChange, type LaunchCredentials } from './localIngress.js';
import { encodeFrame } from './protocol.js';

const source = (instanceId = 'sim-1') => ({ kind: 'local-connector' as const, instanceId });
const agents = () => [
  { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle', activity: 'Available' },
  { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'working', activity: 'Reviewing' },
  { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting', activity: 'Taking a coffee break' },
];
const hello = (token: string, instanceId = 'sim-1') =>
  ({ kind: 'hello', version: 1, token, source: source(instanceId) });
const snapshot = (instanceId = 'sim-1') =>
  ({ kind: 'snapshot', version: 1, source: source(instanceId), agents: agents() });
const event = (id: string, state = 'working', instanceId = 'sim-1', timestamp = '2026-09-25T12:00:00.000Z') => ({
  kind: 'event', version: 1, event: {
    id, type: 'agent.state.changed', timestamp, source: source(instanceId),
    payload: { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state, activity: `Now ${state}` },
  },
});

interface Client {
  socket: Socket;
  send: (message: unknown) => void;
  frame: () => Promise<unknown>;
  closed: Promise<void>;
}

async function openClient(port: number): Promise<Client> {
  const socket = connect({ host: '127.0.0.1', port });
  socket.on('error', () => { /* rejected connections close normally */ });
  const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()));
  const frames: unknown[] = [];
  const readers: Array<(frame: unknown) => void> = [];
  let buffered = '';
  socket.on('data', (chunk: Buffer) => {
    buffered += chunk.toString('utf8');
    let end: number;
    while ((end = buffered.indexOf('\n')) !== -1) {
      const frame: unknown = JSON.parse(buffered.slice(0, end));
      buffered = buffered.slice(end + 1);
      const reader = readers.shift();
      if (reader) reader(frame);
      else frames.push(frame);
    }
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  return {
    socket,
    send: (message) => socket.write(encodeFrame(message)),
    frame: () => frames.length
      ? Promise.resolve(frames.shift())
      : new Promise((resolve) => readers.push(resolve)),
    closed,
  };
}

const started: LocalIngress[] = [];
afterEach(async () => {
  for (const ingress of started.splice(0)) await ingress.stop();
});

async function start(options: Partial<ConstructorParameters<typeof LocalIngress>[0]> = {}) {
  let credentials: LaunchCredentials | undefined;
  const diagnostics: string[] = [];
  const ingress = new LocalIngress({
    ...options,
    onLaunchCredentials: (value) => { credentials = value; },
    onDiagnostic: (code) => { diagnostics.push(code); },
  });
  started.push(ingress);
  const address = await ingress.start();
  return { ingress, address, credentials: credentials!, diagnostics };
}

async function authenticate(client: Client, token: string, instanceId = 'sim-1') {
  client.send(hello(token, instanceId));
  expect(await client.frame()).toEqual({ kind: 'hello-accepted', version: 1 });
}

async function synchronize(client: Client, instanceId = 'sim-1') {
  client.send(snapshot(instanceId));
  expect(await client.frame()).toMatchObject({ kind: 'snapshot-accepted', version: 1 });
}

function nextChange(ingress: LocalIngress, kind: IngressChange['kind']): Promise<IngressChange> {
  return new Promise((resolve) => {
    const unsubscribe = ingress.subscribe((change) => {
      if (change.kind === kind) { unsubscribe(); resolve(change); }
    });
  });
}

describe('main-owned loopback ingress', () => {
  it('uses an ephemeral loopback listener and keeps the token out of general state and notifications', async () => {
    const { ingress, address, credentials, diagnostics } = await start();
    expect(address.host).toBe('127.0.0.1');
    expect(address.port).toBeGreaterThan(0);
    expect(credentials).toEqual({ ...address, token: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(JSON.stringify(address)).not.toContain(credentials.token);
    expect(JSON.stringify(ingress.readCurrent())).not.toContain(credentials.token);
    const change = nextChange(ingress, 'connection');
    const client = await openClient(address.port);
    await authenticate(client, credentials.token);
    expect(JSON.stringify(await change)).not.toContain(credentials.token);
    expect(JSON.stringify(diagnostics)).not.toContain(credentials.token);
  });

  it('rejects invalid tokens, unsupported versions, malformed hello, and application data before authentication', async () => {
    const { address, credentials, ingress, diagnostics } = await start();
    for (const message of [
      hello('0'.repeat(64)),
      { ...hello(credentials.token), version: 2 },
      { kind: 'hello', version: 1, source: source() },
      snapshot(),
      event('early'),
    ]) {
      const client = await openClient(address.port);
      client.send(message);
      await client.closed;
      expect(ingress.readCurrent().revision).toBe(0);
    }
    expect(diagnostics).toContain('authentication_failed');
    expect(diagnostics).toContain('unsupported_version');
    expect(diagnostics).not.toContain('invalid_json');
  });

  it('requires one authenticated socket and a complete initial snapshot before events', async () => {
    const { address, credentials, ingress } = await start();
    const first = await openClient(address.port);
    await authenticate(first, credentials.token);
    const second = await openClient(address.port);
    second.send(hello(credentials.token, 'sim-2'));
    await second.closed;
    expect(ingress.readCurrent().phase).toBe('synchronizing');
    first.send(event('before-snapshot'));
    await first.closed;
    expect(ingress.readCurrent().revision).toBe(0);
    const third = await openClient(address.port);
    await authenticate(third, credentials.token);
    await synchronize(third);
    expect(ingress.readCurrent()).toMatchObject({ revision: 1, phase: 'ready', agents: agents() });
    third.send(snapshot());
    await third.closed;
    expect(ingress.readCurrent().revision).toBe(1);
    expect(ingress.readCurrent().agents).toEqual(agents());
  });

  it('parses fragmented and coalesced frames in arrival order, ignoring timestamps for ordering', async () => {
    const { address, credentials, ingress } = await start();
    const client = await openClient(address.port);
    const bytes = encodeFrame(hello(credentials.token));
    client.socket.write(bytes.subarray(0, 5));
    client.socket.write(bytes.subarray(5));
    expect(await client.frame()).toMatchObject({ kind: 'hello-accepted' });
    await synchronize(client);
    const delivered: string[] = [];
    const final = new Promise<void>((resolve) => {
      const unsubscribe = ingress.subscribe((change) => {
        if (change.kind !== 'event') return;
        delivered.push(change.event.id);
        if (delivered.length === 2) { unsubscribe(); resolve(); }
      });
    });
    client.socket.write(Buffer.concat([
      encodeFrame(event('one', 'working', 'sim-1', '2026-09-25T12:01:00.000Z')),
      encodeFrame(event('two', 'completed', 'sim-1', '2026-09-25T12:00:00.000Z')),
    ]));
    await final;
    expect(delivered).toEqual(['one', 'two']);
    expect(ingress.readCurrent().agents?.[0].state).toBe('completed');
    expect(ingress.readCurrent().revision).toBe(3);
  });

  it('deduplicates valid events, preserves the last mirror on disconnect, and replaces it on a new session snapshot', async () => {
    const { address, credentials, ingress } = await start();
    const first = await openClient(address.port);
    await authenticate(first, credentials.token);
    await synchronize(first);
    const firstSession = ingress.readCurrent().sessionId;
    const accepted = nextChange(ingress, 'event');
    first.send(event('same'));
    await accepted;
    expect(ingress.readCurrent().revision).toBe(2);
    first.send(event('same', 'error'));
    first.socket.end();
    await first.closed;
    expect(ingress.readCurrent()).toMatchObject({ revision: 2, phase: 'disconnected' });
    expect(ingress.readCurrent().agents?.[0].state).toBe('working');
    const second = await openClient(address.port);
    await authenticate(second, credentials.token, 'sim-2');
    await synchronize(second, 'sim-2');
    expect(ingress.readCurrent()).toMatchObject({ revision: 3, phase: 'ready', agents: agents() });
    expect(ingress.readCurrent().sessionId).not.toBe(firstSession);
    const next = nextChange(ingress, 'event');
    second.send(event('same', 'completed', 'sim-2'));
    await next;
    expect(ingress.readCurrent().revision).toBe(4);
    expect(ingress.readCurrent().agents?.[0].state).toBe('completed');
  });

  it('rejects bad snapshots and events without advancing revision or mutating the mirror', async () => {
    const { address, credentials, ingress } = await start();
    const first = await openClient(address.port);
    await authenticate(first, credentials.token);
    first.send({ ...snapshot(), agents: [agents()[0], agents()[0], agents()[2]] });
    await first.closed;
    expect(ingress.readCurrent().revision).toBe(0);
    const second = await openClient(address.port);
    await authenticate(second, credentials.token);
    await synchronize(second);
    second.send({ ...event('bad'), event: { ...event('bad').event, source: source('wrong') } });
    await second.closed;
    expect(ingress.readCurrent().revision).toBe(1);
    expect(ingress.readCurrent().agents).toEqual(agents());
  });

  it('closes malformed, invalid UTF-8, and oversized input before authentication', async () => {
    const { address, ingress } = await start();
    for (const bytes of [
      Buffer.from('{bad}\n'),
      Buffer.from([0xc3, 0x28, 0x0a]),
      Buffer.alloc(16_385, 0x61),
    ]) {
      const client = await openClient(address.port);
      client.socket.write(bytes);
      await client.closed;
      expect(ingress.readCurrent().revision).toBe(0);
    }
  });

  it('bounds pending hellos and closes an authenticated session lacking a snapshot', async () => {
    const { address, credentials, ingress } = await start({ snapshotTimeoutMs: 20 });
    const pending = await Promise.all(Array.from({ length: 4 }, () => openClient(address.port)));
    const excess = await openClient(address.port);
    await excess.closed;
    expect(ingress.readCurrent().revision).toBe(0);
    pending[0].socket.end();
    await pending[0].closed;
    const next = await openClient(address.port);
    const disconnected = new Promise<void>((resolve) => {
      const unsubscribe = ingress.subscribe((change) => {
        if (change.kind === 'connection' && change.state.phase === 'disconnected') {
          unsubscribe();
          resolve();
        }
      });
    });
    await authenticate(next, credentials.token);
    await next.closed;
    await disconnected;
    expect(ingress.readCurrent()).toMatchObject({ revision: 0, phase: 'disconnected' });
  });

  it('closes pending handshakes and all sockets on shutdown, then refuses new connections', async () => {
    const { address, credentials, ingress } = await start();
    const pending = await openClient(address.port);
    const active = await openClient(address.port);
    await authenticate(active, credentials.token);
    await ingress.stop();
    await ingress.stop();
    await Promise.all([pending.closed, active.closed]);
    expect(ingress.readCurrent().revision).toBe(0);
    await expect(new Promise<void>((resolve, reject) => {
      const socket = connect({ host: address.host, port: address.port });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', reject);
    })).rejects.toThrow();
    await expect(ingress.start()).rejects.toThrow('ingress_stopped');
  });

  it('stops safely before start and remains single-use', async () => {
    const ingress = new LocalIngress({ onLaunchCredentials: () => { throw new Error('unexpected_launch'); } });
    const stopping = ingress.stop();
    expect(ingress.stop()).toBe(stopping);
    await stopping;
    await expect(ingress.start()).rejects.toThrow('ingress_stopped');
  });

  it('waits for a pending listen before shutdown and leaves no reachable listener', async () => {
    let server: Server | undefined;
    let boundPort: number | undefined;
    let closed = false;
    let handedOff = false;
    const originalListen = Server.prototype.listen;
    const spy = vi.spyOn(Server.prototype, 'listen').mockImplementation(function (this: Server, ...args: unknown[]) {
      server = this;
      this.once('listening', () => {
        const address = this.address();
        if (address && typeof address !== 'string') boundPort = address.port;
      });
      this.once('close', () => { closed = true; });
      return Reflect.apply(originalListen, this, args) as Server;
    });
    const ingress = new LocalIngress({ onLaunchCredentials: () => { handedOff = true; } });
    started.push(ingress);
    try {
      const startPromise = ingress.start();
      const stopPromise = ingress.stop();
      await expect(startPromise).rejects.toThrow('ingress_stopped');
      await expect(stopPromise).resolves.toBeUndefined();
      expect(handedOff).toBe(false);
      expect(boundPort).toBeGreaterThan(0);
      expect(closed).toBe(true);
      expect(server?.listening).toBe(false);
      expect(server?.address()).toBeNull();
      expect(server?.listenerCount('listening')).toBe(0);
      expect(server?.listenerCount('error')).toBe(0);
      expect(server?.listenerCount('close')).toBe(0);
      await expect(new Promise<void>((resolve, reject) => {
        const socket = connect({ host: '127.0.0.1', port: boundPort! });
        socket.once('connect', () => { socket.destroy(); resolve(); });
        socket.once('error', reject);
      })).rejects.toThrow();
      await expect(ingress.start()).rejects.toThrow('ingress_stopped');
    } finally {
      spy.mockRestore();
    }
  });
});
