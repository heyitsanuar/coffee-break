import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { IngressChange, IngressState, LocalIngress } from './ingress/localIngress.js';
import { agentStateChannels } from '../shared/agentState.js';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), removeHandler: vi.fn() } }));
import { registerAgentStateIpc } from './agentStateIpc.js';

const initial: IngressState = {
  revision: 0, phase: 'awaiting-connector', sessionId: null, agents: null,
};

function harness() {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, generation: unknown) => unknown>();
  const ipc = {
    handle: vi.fn((channel: string, handler: (event: IpcMainInvokeEvent, generation: unknown) => unknown) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => { handlers.delete(channel); }),
  };
  const sender = Object.assign(new EventEmitter(), {
    mainFrame: {},
    getURL: (): string => 'file:///coffee-break/index.html',
    isDestroyed: () => false,
    send: vi.fn(),
  });
  const window = { webContents: sender } as unknown as BrowserWindow;
  let current = initial;
  const listeners = new Set<(change: IngressChange) => void>();
  const source = {
    readCurrent: vi.fn(() => current),
    subscribe: vi.fn((listener: (change: IngressChange) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }),
  } as unknown as Pick<LocalIngress, 'readCurrent' | 'subscribe'>;
  const registration = registerAgentStateIpc(source, ipc as unknown as Parameters<typeof registerAgentStateIpc>[1]);
  registration.attachWindow(window, sender.getURL());
  const event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  const invoke = (channel: string, generation: unknown, from = event) => handlers.get(channel)!(from, generation);
  return {
    ipc, sender, source, listeners, registration, invoke, event,
    setCurrent(value: IngressState) { current = value; },
    emit(change: IngressChange) { for (const listener of listeners) listener(change); },
  };
}

describe('main agent-state IPC boundary', () => {
  it('subscribes before the synchronous read and projects only trusted renderer fields', () => {
    const h = harness();
    h.source.readCurrent = vi.fn(() => {
      expect(h.listeners.size).toBe(1);
      h.emit({ kind: 'connection', state: initial });
      return { ...initial, token: 'secret', port: 1234 } as IngressState;
    });
    expect(h.invoke(agentStateChannels.open, 1)).toEqual(initial);
    expect(h.sender.send).toHaveBeenCalledWith(agentStateChannels.change, {
      generation: 1, change: { kind: 'connection', state: initial },
    });
    expect(JSON.stringify(h.sender.send.mock.calls)).not.toMatch(/secret|1234|socket|diagnostic/);
    h.registration.dispose();
  });

  it('projects accepted event payload, not raw event metadata', () => {
    const h = harness();
    h.invoke(agentStateChannels.open, 1);
    const agent = { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'working' as const, activity: 'Working' };
    const state = { revision: 1, phase: 'ready' as const, sessionId: 'session-1', agents: [agent] };
    h.emit({ kind: 'event', state, event: {
      id: 'event-secret', type: 'agent.state.changed', timestamp: '2026-09-25T00:00:00.000Z',
      source: { kind: 'local-connector', instanceId: 'connector-secret' }, payload: agent,
    } });
    expect(h.sender.send).toHaveBeenCalledWith(agentStateChannels.change, {
      generation: 1, change: { kind: 'event', state, agent },
    });
    expect(JSON.stringify(h.sender.send.mock.calls)).not.toMatch(/event-secret|connector-secret/);
    h.registration.dispose();
  });

  it('does not let a stale close remove a replacement watch', () => {
    const h = harness();
    h.invoke(agentStateChannels.open, 1);
    h.invoke(agentStateChannels.open, 2);
    expect(h.listeners.size).toBe(1);
    h.invoke(agentStateChannels.close, 1);
    expect(h.listeners.size).toBe(1);
    expect(() => h.invoke(agentStateChannels.open, 1)).toThrow('agent_state_stale_watch');
    expect(h.listeners.size).toBe(1);
    h.invoke(agentStateChannels.close, 2);
    expect(h.listeners.size).toBe(0);
    h.registration.dispose();
  });

  it('rejects non-main-frame and non-application documents', () => {
    const h = harness();
    expect(() => h.invoke(agentStateChannels.open, 1,
      { ...h.event, senderFrame: {} } as unknown as IpcMainInvokeEvent)).toThrow();
    expect(() => h.invoke(agentStateChannels.open, 0)).toThrow();
    h.sender.getURL = () => 'https://example.test/';
    expect(() => h.invoke(agentStateChannels.open, 1)).toThrow();
    const foreign = Object.assign(new EventEmitter(), {
      ...h.sender, getURL: () => 'https://example.test/',
    });
    expect(() => h.invoke(agentStateChannels.open, 1, {
      ...h.event, sender: foreign, senderFrame: foreign.mainFrame,
    } as unknown as IpcMainInvokeEvent)).toThrow();
    expect(h.listeners.size).toBe(0);
    h.registration.dispose();
  });

  it('cleans subscriptions on navigation, renderer loss, and window destruction', () => {
    const h = harness();
    h.invoke(agentStateChannels.open, 1);
    h.sender.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });
    expect(h.listeners.size).toBe(0);
    h.invoke(agentStateChannels.open, 2);
    h.sender.emit('render-process-gone');
    expect(h.listeners.size).toBe(0);
    h.invoke(agentStateChannels.open, 3);
    h.sender.emit('destroyed');
    expect(h.listeners.size).toBe(0);
    expect(() => h.invoke(agentStateChannels.open, 4)).toThrow();
    h.registration.dispose();
    expect(h.ipc.removeHandler).toHaveBeenCalledWith(agentStateChannels.open);
  });
});
