import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentInspectionPanel } from './AgentInspectionPanel';
import type { OfficeGame, OnAgentSelected } from './createOfficeGame';
import type { MockAgentId } from './mockAgents';

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

  void loadGame().then(({ createOfficeGame }) => {
    if (!disposed) {
      game = createOfficeGame(host, (agentId) => {
        if (!disposed) {
          onAgentSelected(agentId);
        }
      });
      game.setSelectedAgent(selectedAgentId);
    }
  });

  return {
    setSelectedAgent(agentId) {
      selectedAgentId = agentId;
      game?.setSelectedAgent(agentId);
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

export function OfficeSceneHost(): React.JSX.Element {
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

  return (
    <>
      <div
        ref={hostRef}
        className="office-scene-host"
        role="img"
        aria-label="Pixel-art office with three simulated agents: one idle, one working, and one on break"
      />
      <AgentInspectionPanel
        selectedAgentId={selectedAgentId}
        onSelectAgent={handleAgentSelected}
        onClearSelection={() => setSelectedAgentId(null)}
      />
    </>
  );
}
