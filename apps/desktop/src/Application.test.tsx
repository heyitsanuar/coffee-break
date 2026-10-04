import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Application } from './Application';
import { initialAgentState } from './agentState/reducer';
import { createOfficePresentationRuntime } from './office/officePresentationRuntime';

describe('North Star application composition', () => {
  it('places one global availability region in the compact identity header', () => {
    const store = { getSnapshot: () => initialAgentState, subscribe: () => () => {}, subscribeAcceptedUpdates: () => () => {} };
    const runtime = createOfficePresentationRuntime(store, { matches: false, addEventListener() {}, removeEventListener() {} });
    const markup = renderToStaticMarkup(<Application store={store} runtime={runtime} />);
    const header = markup.slice(0, markup.indexOf('</header>'));
    expect(header).toContain('Coffee Break');
    expect(header).toContain('Connecting to local simulation…');
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    runtime.dispose();
  });

  it('keeps the room before semantic selection controls and reserves unselected inspection', () => {
    const store = { getSnapshot: () => initialAgentState, subscribe: () => () => {}, subscribeAcceptedUpdates: () => () => {} };
    const runtime = createOfficePresentationRuntime(store, { matches: false, addEventListener() {}, removeEventListener() {} });
    const markup = renderToStaticMarkup(<Application store={store} runtime={runtime} />);
    expect(markup.indexOf('class="office-scene-host"')).toBeLessThan(markup.indexOf('class="agent-selector"'));
    expect(markup.indexOf('class="agent-selector"')).toBeLessThan(markup.indexOf('class="agent-inspection"'));
    expect(markup).toContain('Local simulation · No provider connection');
    expect(markup).toContain('Select an agent to inspect its simulated activity.');
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(3);
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('tabindex');
    runtime.dispose();
  });
});
