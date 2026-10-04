import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { OfficeAcknowledgement, OfficePresentationRuntime } from './officePresentationRuntime';
import type { createAgentStateStore } from '../agentState/store';
import { ConnectionStatus } from './ConnectionStatus';
import { AgentInspectionPanel } from './AgentInspectionPanel';
import { AgentSelector } from './AgentSelector';
import { SelectedAgentSummary, selectedAgentFeedback } from './SelectedAgentSummary';
import { OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import type { OfficeGame, OnAgentSelected } from './createOfficeGame';
import { MOCK_AGENTS, type MockAgentId } from './mockAgents';
import { sameAgentPresentation, type OfficeAgentPresentation } from './officePresentation';

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
  acknowledge(value: OfficeAcknowledgement): void;
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
    acknowledge(value) {
      if (!disposed) game?.acknowledge(value); // Drop transient notifications while loading; never replay.
    },
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

// Direct subscriptions preserve rapid accepted transitions independently of React batching.
export function bindOfficePresentation(runtime: OfficePresentationRuntime, mount: OfficeSceneMount): () => void {
  const update = () => {
    const current = runtime.getSnapshot();
    for (const agent of MOCK_AGENTS) mount.setAgentPresentation(agent.id, current[agent.id]);
  };
  const unsubscribe = runtime.subscribe(update);
  const unsubscribeAcknowledgements = runtime.subscribeAcknowledgements(value => mount.acknowledge(value));
  update(); // Initialization is settled; acknowledgement notifications are never replayed.
  return () => { unsubscribe(); unsubscribeAcknowledgements(); };
}

type OfficeStore = Pick<ReturnType<typeof createAgentStateStore>, 'subscribe' | 'getSnapshot'>;

export function OfficeSceneHost({ store, runtime }: { readonly store: OfficeStore; readonly runtime: OfficePresentationRuntime }): React.JSX.Element {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const presentations = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<OfficeSceneMount | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<MockAgentId | null>(null);
  const selectionRef = useRef(selectedAgentId);
  selectionRef.current = selectedAgentId; // Latest host authority for a game remount, not persistent selection state.
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
    mount.setSelectedAgent(selectionRef.current);
    const unbind = bindOfficePresentation(runtime, mount);

    return () => {
      unbind();
      if (mountRef.current === mount) {
        mountRef.current = undefined;
      }
      mount.destroy();
    };
  }, [handleAgentSelected, runtime]);

  useEffect(() => {
    mountRef.current?.setSelectedAgent(selectedAgentId);
  }, [selectedAgentId]);


  const officeDescription = MOCK_AGENTS.map(({ id, displayName }) =>
    `${displayName} ${OFFICE_STATUS_LABELS[presentations[id].visual] || 'awaiting simulation'}`).join(', ');

  const selected = { selectedAgentId, presentation: selectedAgentId ? presentations[selectedAgentId] : null };

  return (
    <>
      <ConnectionStatus snapshot={snapshot} />
      <p className="sr-only" aria-live="polite" aria-atomic="true">{selectedAgentFeedback(selected)}</p>
      <div className="office-composition">
        <div className="office-world">
          <AgentSelector selectedAgentId={selectedAgentId} onSelectAgent={handleAgentSelected} />
          <SelectedAgentSummary {...selected} />
          <div
            ref={hostRef}
            className="office-scene-host"
            role="img"
            aria-label={`Pixel-art local simulation office: ${officeDescription}`}
          />
        </div>
        <AgentInspectionPanel
          {...selected}
          onClearSelection={() => setSelectedAgentId(null)}
        />
      </div>
    </>
  );
}
