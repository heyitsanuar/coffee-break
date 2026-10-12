import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { OfficeAcknowledgement, OfficePresentationRuntime } from './officePresentationRuntime';
import type { createAgentStateStore } from '../agentState/store';
import { AgentInspectionPanel } from './AgentInspectionPanel';
import { SampleActivity } from './SampleActivity';
import { WorldPreviews } from './WorldPreviews';
import { AgentSelector } from './AgentSelector';
import { SelectedAgentSummary, selectedAgentFeedback } from './SelectedAgentSummary';
import { OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import type { OfficeGame, OnAgentSelected } from './createOfficeGame';
import { MOCK_AGENTS, type MockAgentId } from './mockAgents';
import { sameAgentPresentation, agentFreshness, FRESHNESS_COPY, type OfficeAgentPresentation } from './officePresentation';

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

export function OfficeSceneHost({ store, runtime, expanded = false, onToggleExpansion, expansionButtonRef, toolbarRef }: {
  readonly store: OfficeStore; readonly runtime: OfficePresentationRuntime;
  readonly expanded?: boolean; readonly onToggleExpansion?: () => void;
  readonly expansionButtonRef?: React.RefObject<HTMLButtonElement | null>;
  readonly toolbarRef?: React.RefObject<HTMLDivElement | null>;
}): React.JSX.Element {
  const presentations = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  const hostRef = useRef<HTMLDivElement>(null);
  const compositionRef = useRef<HTMLDivElement>(null);
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

  useLayoutEffect(() => {
    const composition = compositionRef.current!;
    const context = composition.querySelector<HTMLElement>('.office-context')!;
    const worlds = composition.querySelector<HTMLElement>('.worlds-composition-region')!;
    const toolbar = composition.querySelector<HTMLElement>('.studio-toolbar')!;
    const rail = composition.querySelector<HTMLElement>('.contextual-rail')!;
    // Anchor the single gallery beside Agents without changing its logical DOM order.
    const update = () => {
      const top = context.getBoundingClientRect().bottom - composition.getBoundingClientRect().top + 12;
      composition.style.setProperty('--worlds-top', `${top}px`);
      composition.style.setProperty('--worlds-bottom', `${Math.max(top + worlds.getBoundingClientRect().height, rail.getBoundingClientRect().height)}px`);
    };
    const observer = new ResizeObserver(update);
    for (const element of [context, worlds, toolbar, rail]) observer.observe(element);
    update();
    return () => { observer.disconnect(); composition.style.removeProperty('--worlds-top'); composition.style.removeProperty('--worlds-bottom'); };
  }, [expanded]);

  const officeDescription = MOCK_AGENTS.map(({ id, displayName }) => {
    const presentation = presentations[id];
    const freshness = FRESHNESS_COPY[agentFreshness(presentation)].description;
    const lifecycle = presentation.state === null ? 'No state' : OFFICE_STATUS_LABELS[presentation.state];
    return `${displayName}, ${lifecycle}, ${freshness}${presentation.visual === 'coffee' ? ', Coffee break' : ''}`;
  }).join('; ');

  const selected = { selectedAgentId, presentation: selectedAgentId ? presentations[selectedAgentId] : null };

  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{selectedAgentFeedback(selected)}</p>
      <div className="office-composition" ref={compositionRef} onFocusCapture={event => {
        const control = event.target as HTMLElement;
        const toolbar = event.currentTarget.querySelector<HTMLElement>('.studio-toolbar')!;
        if (!control.matches('button:focus-visible, summary:focus-visible') || toolbar.contains(control)) return;
        const bounds = control.getBoundingClientRect();
        const clearance = bounds.top - toolbar.getBoundingClientRect().bottom;
        if (clearance < 6) window.scrollBy({ top: clearance - 6, behavior: 'instant' });
        else if (bounds.bottom > window.innerHeight - 6) window.scrollBy({ top: bounds.bottom - window.innerHeight + 6, behavior: 'instant' });
      }}>
        <div className="office-world">
          <div className="studio-toolbar" ref={toolbarRef}>
            <h2 id="office-section-title" className="section-destination" tabIndex={-1} aria-label="Office — Studio">
              <button type="button" className="studio-gallery-control" disabled={expanded}
                aria-label={expanded ? 'Studio, current authored world' : 'Studio, current authored world. View Worlds'}
                onClick={() => {
                  const heading = document.getElementById('worlds-section-title');
                  heading?.focus({ preventScroll: true });
                  heading?.scrollIntoView({ behavior: 'instant', block: 'start' });
                }}>Studio</button>
            </h2>
            <span className="inhabitant-count">{MOCK_AGENTS.length} inhabitants</span>
            <div className="expand-reservation">
              <span className="expansion-instruction" hidden={!expanded}>Expanded office. Use Exit or press Escape to return.</span>
              <span hidden={!expanded}>Exit to view Worlds.</span>
              <button type="button" ref={expansionButtonRef} onClick={onToggleExpansion}
                onBlur={event => event.currentTarget.removeAttribute('data-return-focus')}
                aria-label={expanded ? 'Exit expanded office' : 'Expand office within the application'}>{expanded ? 'Exit' : 'Expand'}</button>
            </div>
          </div>
          <div
            ref={hostRef}
            className="office-scene-host"
            role="img"
            aria-label={`Pixel-art local simulation office: ${officeDescription}. Meeting Room and Focus Room are empty decorative zones.`}
          />
          <small className="office-context">Local simulation · No provider connection</small>
          <SelectedAgentSummary {...selected} />
          <section className="agents-section" aria-labelledby="agents-section-title">
            <h2 id="agents-section-title" className="section-destination" tabIndex={-1}>Agents</h2>
            <AgentSelector selectedAgentId={selectedAgentId} onSelectAgent={handleAgentSelected} presentations={presentations} />
          </section>
        </div>
        <div className="contextual-rail">
          <AgentInspectionPanel
            {...selected}
            onClearSelection={() => setSelectedAgentId(null)}
          />
          <div className="worlds-composition-region" hidden={expanded}><WorldPreviews /></div>
          <div className="sample-composition-region" hidden={expanded}><SampleActivity /></div>
        </div>
      </div>
    </>
  );
}
