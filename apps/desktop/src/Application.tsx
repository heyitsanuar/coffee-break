import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { OfficeSceneHost } from './office/OfficeSceneHost';
import { ConnectionStatus } from './office/ConnectionStatus';
import type { createAgentStateStore } from './agentState/store';
import type { OfficePresentationRuntime } from './office/officePresentationRuntime';
import { restoredOfficeScroll } from './office/officeExpansion';

export function Application({ store, runtime }: {
  readonly store: Pick<ReturnType<typeof createAgentStateStore>, 'subscribe' | 'getSnapshot'>;
  readonly runtime: OfficePresentationRuntime;
}): React.JSX.Element {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [destination, setDestination] = useState('Office');
  const [expanded, setExpanded] = useState(false);
  const expansionButton = useRef<HTMLButtonElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const previousExpanded = useRef(false);
  useLayoutEffect(() => {
    if (previousExpanded.current === expanded) return;
    previousExpanded.current = expanded;
    expansionButton.current?.focus({ preventScroll: true });
    expansionButton.current?.setAttribute('data-return-focus', 'true');
    const page = document.documentElement;
    window.scrollTo({ top: expanded ? 0 : restoredOfficeScroll(savedScroll.current, page.scrollHeight, page.clientHeight), behavior: 'instant' });
    // Restoration is synchronous after this layout commit: no callback can outlive disposal.
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); setExpanded(false); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [expanded]);
  useLayoutEffect(() => {
    if (!toolbar.current) return;
    const update = () => document.documentElement.style.setProperty('--studio-clearance', `${toolbar.current!.getBoundingClientRect().height + 20}px`);
    const observer = new ResizeObserver(update);
    observer.observe(toolbar.current); update();
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--studio-clearance'); };
  }, []);
  return <main className="app-shell" data-expanded={expanded}>
    <header className="application-header">
      <div className="office-heading" hidden={expanded}>
        <span className="brand-mark" aria-hidden="true">☕</span>
        <h1 id="office-title">Coffee Break</h1>
      </div>
      <nav className="homepage-navigation" aria-label="Homepage sections" hidden={expanded}>
        {['Office', 'Agents', 'Projects'].map(label => <button
          key={label}
          type="button"
          aria-current={destination === label ? 'location' : undefined}
          onClick={() => {
            const heading = document.getElementById(`${label.toLowerCase()}-section-title`);
            if (!heading) return;
            heading.focus({ preventScroll: true });
            heading.scrollIntoView({ behavior: 'instant', block: 'start' });
            setDestination(label);
          }}
        >{label}</button>)}
      </nav>
      <ConnectionStatus snapshot={snapshot} />
    </header>
    <section className="office-panel" aria-labelledby="office-section-title">
      <OfficeSceneHost store={store} runtime={runtime} expanded={expanded} toolbarRef={toolbar} expansionButtonRef={expansionButton}
        onToggleExpansion={() => { if (!expanded) savedScroll.current = window.scrollY; setExpanded(!expanded); }} />
    </section>
  </main>;
}
