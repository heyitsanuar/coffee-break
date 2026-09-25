import { ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron';
import type { AgentCurrentState } from '@coffee-break/contracts';
import { agentStateChannels, type TrustedAgentChange, type TrustedAgentState } from '../shared/agentState.js';
import type { IngressChange, IngressState, LocalIngress } from './ingress/localIngress.js';

type Source = Pick<LocalIngress, 'readCurrent' | 'subscribe'>;
type Ipc = Pick<typeof ipcMain, 'handle' | 'removeHandler'>;

function projectAgent(value: AgentCurrentState): AgentCurrentState {
  return {
    agent: { id: value.agent.id, displayName: value.agent.displayName },
    state: value.state,
    activity: value.activity,
    ...(value.reason === undefined ? {} : { reason: value.reason }),
  };
}

export function projectState(value: IngressState): TrustedAgentState {
  return {
    revision: value.revision,
    phase: value.phase,
    sessionId: value.sessionId,
    agents: value.agents?.map(projectAgent) ?? null,
  };
}

function projectChange(value: IngressChange): TrustedAgentChange {
  if (value.kind === 'event') {
    return { kind: 'event', state: projectState(value.state), agent: projectAgent(value.event.payload) };
  }
  return { kind: value.kind, state: projectState(value.state) };
}

export function registerAgentStateIpc(source: Source, ipc: Ipc = ipcMain) {
  const windows = new Map<WebContents, { expectedUrl: string; detach: () => void }>();
  const active = new Map<WebContents, { generation: number; unsubscribe: () => void }>();

  const close = (sender: WebContents) => {
    active.get(sender)?.unsubscribe();
    active.delete(sender);
  };
  const allowed = (event: IpcMainEvent | IpcMainInvokeEvent) =>
    event.senderFrame === event.sender.mainFrame &&
    windows.get(event.sender)?.expectedUrl === event.sender.getURL();
  const validGeneration = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

  ipc.handle(agentStateChannels.open, (event, generation: unknown) => {
    if (!allowed(event) || !validGeneration(generation)) throw new Error('agent_state_unauthorized');
    const sender = event.sender;
    if (active.has(sender) && generation <= active.get(sender)!.generation) {
      throw new Error('agent_state_stale_watch');
    }
    close(sender);
    const unsubscribe = source.subscribe((change) => {
      if (active.get(sender)?.generation === generation && !sender.isDestroyed()) {
        sender.send(agentStateChannels.change, { generation, change: projectChange(change) });
      }
    });
    active.set(sender, { generation, unsubscribe });
    try {
      // Both operations are synchronous in the same main-process turn.
      return projectState(source.readCurrent());
    } catch (error) {
      close(sender);
      throw error;
    }
  });

  ipc.handle(agentStateChannels.close, (event, generation: unknown) => {
    if (!allowed(event) || !validGeneration(generation)) throw new Error('agent_state_unauthorized');
    if (active.get(event.sender)?.generation === generation) close(event.sender);
  });

  return {
    attachWindow(window: BrowserWindow, expectedUrl: string) {
      const sender = window.webContents;
      if (windows.has(sender)) return;
      const onNavigation = (details: { isMainFrame: boolean; isSameDocument: boolean }) => {
        if (details.isMainFrame && !details.isSameDocument) close(sender);
      };
      const onGone = () => close(sender);
      const onDestroyed = () => {
        close(sender);
        detach();
      };
      const detach = () => {
        sender.off('did-start-navigation', onNavigation);
        sender.off('render-process-gone', onGone);
        sender.off('destroyed', onDestroyed);
        windows.delete(sender);
      };
      windows.set(sender, { expectedUrl, detach });
      sender.on('did-start-navigation', onNavigation);
      sender.on('render-process-gone', onGone);
      sender.on('destroyed', onDestroyed);
    },
    dispose() {
      for (const sender of windows.keys()) close(sender);
      for (const { detach } of windows.values()) detach();
      ipc.removeHandler(agentStateChannels.open);
      ipc.removeHandler(agentStateChannels.close);
    },
  };
}
