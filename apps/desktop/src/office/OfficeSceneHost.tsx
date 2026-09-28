import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { createAgentStateStore } from '../agentState/store';
import { ConnectionStatus } from './ConnectionStatus';
import { AgentInspectionPanel } from './AgentInspectionPanel';
import { OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import type { OfficeGame, OnAgentSelected } from './createOfficeGame';
import { MOCK_AGENTS, type MockAgentId } from './mockAgents';
import { deriveOfficePresentation, sameAgentPresentation, type OfficeAgentPresentation } from './officePresentation';

export type { OfficeGame } from './createOfficeGame';

export type CreateOfficeGame = (
  parent: HTMLElement,
  onAgentSelected: OnAgentSelected,
) => OfficeGame;

export interface OfficeGameModule {
  createOfficeGame: CreateOfficeGame;
}

export type LoadOfficeGame = () => Promise<OfficeGameModule>;

export interface OfficeSceneMount {
  destroy(): void;
  setSelectedAgent(agentId: MockAgentId | null): void;
  setAgentPresentation(agentId: MockAgentId, presentation: OfficeAgentPresentation): void;
}

const loadOfficeGame = (): Promise<OfficeGameModule> => import('./createOfficeGame');

export function mountOfficeScene(
  host: HTMLElement,
  onAgentSelected: OnAgentSelected,
  loadGame: LoadOfficeGame = loadOfficeGame,
): OfficeSceneMount {
  let disposed = false;
  let game: OfficeGame | undefined;
  let selectedAgentId: MockAgentId | null = null;
  const presentations = new Map<MockAgentId, OfficeAgentPresentation>();

  void loadGame().then(({ createOfficeGame }) => {
    if (!disposed) {
      game = createOfficeGame(host, (agentId) => {
        if (!disposed) {
          onAgentSelected(agentId);
        }
      });
      game.setSelectedAgent(selectedAgentId);
      for (const [id, presentation] of presentations) game.setAgentPresentation(id, presentation);
    }
  });

  return {
    setSelectedAgent(agentId) {
      if (disposed) return;
      selectedAgentId = agentId;
      game?.setSelectedAgent(agentId);
    },
    setAgentPresentation(agentId, presentation) {
      if (disposed) return;
      const previous = presentations.get(agentId);
      if (previous && sameAgentPresentation(previous, presentation)) return;
      presentations.set(agentId, presentation);
      game?.setAgentPresentation(agentId, presentation);
    },
    destroy() {
      disposed = true;
      const mountedGame = game;
      game = undefined;
      mountedGame?.destroy(true);
      host.replaceChildren();
    },
  };
}

type OfficeStore = Pick<ReturnType<typeof createAgentStateStore>, 'subscribe' | 'getSnapshot'>;

export function OfficeSceneHost({ store }: { readonly store: OfficeStore }): React.JSX.Element {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const presentations = useMemo(() => deriveOfficePresentation(snapshot), [snapshot.agentsById]);
  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<OfficeSceneMount | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<MockAgentId | null>(null);
  const handleAgentSelected = useCallback((agentId: MockAgentId): void => {
    setSelectedAgentId(agentId);
  }, []);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return undefined;
    }

    const mount = mountOfficeScene(host, handleAgentSelected);
    mountRef.current = mount;

    return () => {
      if (mountRef.current === mount) {
        mountRef.current = undefined;
      }
      mount.destroy();
    };
  }, [handleAgentSelected]);

  useEffect(() => {
    mountRef.current?.setSelectedAgent(selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    for (const agent of MOCK_AGENTS) {
      mountRef.current?.setAgentPresentation(agent.id, presentations[agent.id]);
    }
  }, [presentations]);

  const officeDescription = MOCK_AGENTS.map(({ id, displayName }) =>
    `${displayName} ${OFFICE_STATUS_LABELS[presentations[id].visual] || 'awaiting simulation'}`).join(', ');

  return (
    <>
      <ConnectionStatus snapshot={snapshot} />
      <div
        ref={hostRef}
        className="office-scene-host"
        role="img"
        aria-label={`Pixel-art local simulation office: ${officeDescription}`}
      />
      <AgentInspectionPanel
        selectedAgentId={selectedAgentId}
        presentation={selectedAgentId ? presentations[selectedAgentId] : null}
        onSelectAgent={handleAgentSelected}
        onClearSelection={() => setSelectedAgentId(null)}
      />
    </>
  );
}
