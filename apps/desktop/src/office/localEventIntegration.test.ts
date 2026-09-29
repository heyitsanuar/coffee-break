import { EventEmitter, once } from 'node:events';
import { connect, type NetConnectOpts, type Socket } from 'node:net';
import type { BrowserWindow, IpcMainInvokeEvent, IpcRendererEvent } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgentStateApi } from '../../electron/agentStatePreload.js';
import { createAgentStateStore } from '../agentState/store.js';
import { deriveOfficePresentation } from './officePresentation.js';
import { agentStateChannels } from '../../shared/agentState.js';
import { LocalIngress, type IngressChange } from '../../electron/ingress/localIngress.js';
import { encodeFrame, MAX_FRAME_BYTES } from '../../electron/ingress/protocol.js';
import { SimulatorClient } from '../../electron/simulator/client.js';
import { initialAgents, type TimerClock } from '../../electron/simulator/scenario.js';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), removeHandler: vi.fn() } }));
import { registerAgentStateIpc } from '../../electron/agentStateIpc.js';

const ingresses: LocalIngress[] = [];
afterEach(async () => { for (const ingress of ingresses.splice(0)) await ingress.stop(); });

function manualClock() {
  const tasks: Array<{ delay: number; callback: () => void; cancelled: boolean }> = [];
  const clock: TimerClock = {
    now: () => Date.parse('2026-09-25T12:00:00.000Z'),
    set: (callback, delay) => {
      const task = { delay, callback, cancelled: false };
      tasks.push(task);
      return task as unknown as ReturnType<typeof setTimeout>;
    },
    clear: (timer) => { (timer as unknown as typeof tasks[number]).cancelled = true; },
  };
  return { clock, advance: (delay: number) => {
    for (const task of tasks.filter((item) => item.delay <= delay && !item.cancelled)) {
      task.cancelled = true;
      task.callback();
    }
  } };
}

// Only Electron's unavailable IPC/WebContents wiring is replaced here.
function joinedRenderer(ingress: LocalIngress) {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, generation: unknown) => unknown>();
  const listeners = new Set<(event: IpcRendererEvent, packet: unknown) => void>();
  const sender = Object.assign(new EventEmitter(), {
    mainFrame: {},
    getURL: () => 'file:///coffee-break/index.html',
    isDestroyed: () => false,
    send(channel: string, packet: unknown) {
      expect(channel).toBe(agentStateChannels.change);
      for (const listener of listeners) listener({} as IpcRendererEvent, packet);
    },
  });
  const registration = registerAgentStateIpc(ingress, {
    handle: (channel, handler) => { handlers.set(channel, handler); },
    removeHandler: (channel) => { handlers.delete(channel); },
  });
  registration.attachWindow({ webContents: sender } as unknown as BrowserWindow, sender.getURL());
  const ipc = {
    on(channel: string, listener: (event: IpcRendererEvent, packet: unknown) => void) {
      expect(channel).toBe(agentStateChannels.change);
      listeners.add(listener);
      return ipc;
    },
    removeListener(_channel: string, listener: (event: IpcRendererEvent, packet: unknown) => void) {
      listeners.delete(listener);
      return ipc;
    },
    invoke: (channel: string, generation: unknown) => Promise.resolve().then(() => handlers.get(channel)!({
      sender, senderFrame: sender.mainFrame,
    } as unknown as IpcMainInvokeEvent, generation)),
  };
  const store = createAgentStateStore(createAgentStateApi(ipc as Parameters<typeof createAgentStateApi>[0]));
  return { store, close: async () => {
    store.stop();
    await Promise.resolve();
    expect(listeners.size).toBe(0);
    registration.dispose();
  } };
}

describe('joined local transport to renderer presentation (Electron wiring faked)', () => {
  it('synchronizes all agents, presents scripted updates, and suppresses a changed-payload duplicate', async () => {
    const timer = manualClock();
    let socket!: Socket;
    let acceptedEvent!: Extract<IngressChange, { kind: 'event' }>['event'];
    const client = new SimulatorClient(timer.clock, () => {}, ((options: NetConnectOpts) => {
      socket = connect(options);
      return socket;
    }) as typeof connect);
    const ingress = new LocalIngress({ onLaunchCredentials: (credentials) => client.start(credentials) });
    ingresses.push(ingress);
    ingress.subscribe((change) => { if (change.kind === 'event') acceptedEvent = change.event; });
    const renderer = joinedRenderer(ingress);
    try {
      await renderer.store.start();
      await ingress.start();
      await vi.waitFor(() => expect(client.phase).toBe('running'));
      expect(renderer.store.getSnapshot()).toMatchObject({ revision: 1, connection: 'connected', synchronized: true });
      const snapshot = renderer.store.getSnapshot();
      for (const initial of initialAgents) {
        expect(snapshot.agentsById[initial.agent.id as keyof typeof snapshot.agentsById])
          .toEqual({ state: initial.state, activity: initial.activity });
      }
      expect(deriveOfficePresentation(renderer.store.getSnapshot())['mock-agent-mina'].visual).toBe('waiting');
      timer.advance(1_000);
      await vi.waitFor(() => expect(renderer.store.getSnapshot().revision).toBe(2));
      expect(deriveOfficePresentation(renderer.store.getSnapshot())['mock-agent-ari'])
        .toMatchObject({ visual: 'working', activity: 'Implementing the change' });
      socket.write(encodeFrame({ kind: 'event', version: 1, event: {
        ...acceptedEvent, payload: { ...acceptedEvent.payload, state: 'error', activity: 'Duplicate must not replace Ari' },
      } }));
      // The next scripted event is a same-socket ordering barrier for the duplicate.
      timer.advance(2_000);
      await vi.waitFor(() => expect(renderer.store.getSnapshot().revision).toBe(3));
      expect(ingress.readCurrent().revision).toBe(3);
      expect(deriveOfficePresentation(renderer.store.getSnapshot())['mock-agent-ari'])
        .toMatchObject({ visual: 'working', activity: 'Implementing the change' });
      expect(deriveOfficePresentation(renderer.store.getSnapshot())['mock-agent-mina'])
        .toMatchObject({ visual: 'working', activity: 'Reviewing the change' });
    } finally { client.stop(); await renderer.close(); }
  });

  it.each(['unauthenticated', 'invalid authenticated', 'oversized authenticated'] as const)(
    '%s input cannot alter trusted renderer agents or revision', async (input) => {
      let socket!: Socket;
      let port = 0;
      const diagnostics: string[] = [];
      const client = new SimulatorClient(manualClock().clock, () => {}, ((options: NetConnectOpts) => {
        socket = connect(options);
        return socket;
      }) as typeof connect);
      const ingress = new LocalIngress({ onDiagnostic: (code) => diagnostics.push(code), onLaunchCredentials: (credentials) => {
        port = credentials.port;
        client.start(credentials);
      } });
      ingresses.push(ingress);
      const renderer = joinedRenderer(ingress);
      try {
        await renderer.store.start();
        await ingress.start();
        await vi.waitFor(() => expect(client.phase).toBe('running'));
        const before = renderer.store.getSnapshot();
        if (input === 'unauthenticated') {
          const stranger = connect({ host: '127.0.0.1', port });
          stranger.on('error', () => {});
          const closed = once(stranger, 'close');
          stranger.write(encodeFrame({ kind: 'hello', version: 1, token: '0'.repeat(64), source: client.source }));
          await closed;
          expect(renderer.store.getSnapshot().connection).toBe('connected');
        } else {
          const closed = once(socket, 'close');
          socket.write(input === 'invalid authenticated'
            ? encodeFrame({ kind: 'event', version: 1, event: { invalid: true } })
            : Buffer.alloc(MAX_FRAME_BYTES + 1, 0x61));
          await closed;
          await vi.waitFor(() => expect(renderer.store.getSnapshot().connection).toBe('disconnected'));
          expect(renderer.store.getSnapshot().synchronized).toBe(false);
        }
        expect(renderer.store.getSnapshot().agentsById).toEqual(before.agentsById);
        expect(renderer.store.getSnapshot().revision).toBe(before.revision);
        expect(ingress.readCurrent().revision).toBe(before.revision);
        expect(diagnostics).toContain(input === 'unauthenticated' ? 'authentication_failed'
          : input === 'invalid authenticated' ? 'invalid_fields' : 'frame_too_large');
      } finally { client.stop(); await renderer.close(); }
    },
  );
});
