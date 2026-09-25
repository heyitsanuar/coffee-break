import type { IpcRenderer, IpcRendererEvent } from 'electron';
import {
  agentStateChannels,
  type AgentStateApi,
  type AgentStateMessage,
  type TrustedAgentChange,
  type TrustedAgentState,
} from '../shared/agentState.js';

type Ipc = Pick<IpcRenderer, 'on' | 'removeListener' | 'invoke'>;

export function createAgentStateApi(ipc: Ipc): AgentStateApi {
  let nextGeneration = 0;
  let active: { close(): void } | null = null;

  return {
    watch(listener) {
      active?.close();
      const generation = ++nextGeneration;
      let closed = false;
      let initializing = true;
      const buffered: TrustedAgentChange[] = [];
      let resolveReady!: () => void;
      let rejectReady!: (error: unknown) => void;
      const ready = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });

      const close = () => {
        if (closed) return;
        closed = true;
        ipc.removeListener(agentStateChannels.change, onChange);
        if (active === watch) active = null;
        if (initializing) rejectReady(new Error('agent_state_watch_closed'));
        void ipc.invoke(agentStateChannels.close, generation).catch(() => {});
      };
      const deliver = (message: AgentStateMessage) => {
        try { listener(message); } catch (error) {
          close();
          throw error;
        }
      };
      const onChange = (_event: IpcRendererEvent, packet: { generation: number; change: TrustedAgentChange }) => {
        if (closed || packet?.generation !== generation) return;
        if (initializing) buffered.push(packet.change);
        else deliver({ kind: 'change', change: packet.change });
      };
      const watch = { ready, close };
      active = watch;
      ipc.on(agentStateChannels.change, onChange);
      void ipc.invoke(agentStateChannels.open, generation).then((state: TrustedAgentState) => {
        if (closed) {
          // A close may have reached main before its still-pending open.
          void ipc.invoke(agentStateChannels.close, generation).catch(() => {});
          return;
        }
        try {
          deliver({ kind: 'current', state });
          while (buffered.length && !closed) deliver({ kind: 'change', change: buffered.shift()! });
          if (!closed) {
            initializing = false;
            resolveReady();
          }
        } catch (error) {
          if (!closed) close();
          rejectReady(error);
        }
      }, (error: unknown) => {
        if (!closed) {
          close();
          rejectReady(error);
        }
      });
      return watch;
    },
  };
}
