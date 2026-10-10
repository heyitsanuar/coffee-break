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
    expect(markup).toContain('Choose someone in the office or below.');
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(3);
    expect(markup).toContain('aria-disabled="true"');
    const destinations = [...markup.matchAll(/<h[23][^>]*id="([^"]+)"[^>]*tabindex="(-?\d+)"/g)];
    expect(destinations.map(match => [match[1], match[2]])).toEqual([
      ['office-section-title', '-1'], ['agents-section-title', '-1'], ['projects-section-title', '-1'],
    ]);
    expect(markup.match(/tabindex=/g)).toHaveLength(3);
    runtime.dispose();
  });

  it('provides real named destinations and an honest disabled Expand affordance', () => {
    const store = { getSnapshot: () => initialAgentState, subscribe: () => () => {}, subscribeAcceptedUpdates: () => () => {} };
    const runtime = createOfficePresentationRuntime(store, { matches: false, addEventListener() {}, removeEventListener() {} });
    const markup = renderToStaticMarkup(<Application store={store} runtime={runtime} />);
    const navigation = markup.match(/<nav[^>]*>(.*?)<\/nav>/)?.[0] ?? '';
    expect(navigation).toContain('aria-label="Homepage sections"');
    expect([...navigation.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(match => match[1])).toEqual(['Office', 'Agents', 'Projects']);
    expect(navigation).toContain('aria-current="location"');
    expect(navigation).not.toContain('href=');
    expect(markup).toContain('Office — </span>Studio');
    expect(markup).toContain('Current authored world');
    expect(markup).toContain('3 inhabitants');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="expand-unavailable"[^>]*>Expand<\/button>/);
    expect(markup).toContain('id="expand-unavailable">Available in a future update.');
    expect(markup).not.toContain('Project context is reserved');
    expect(markup).not.toContain('class="projects-section"');
    expect(markup).toContain('No GitHub account, repository, or provider is connected.');
    expect(markup).toContain('<h3 id="projects-section-title" class="section-destination" tabindex="-1"><span class="sr-only">Projects — </span>Harbor</h3>');
    const rail = markup.slice(markup.indexOf('class="contextual-rail"'));
    expect(rail).toMatch(/<section class="agent-inspection"[\s\S]*?<\/section><section class="sample-activity"/);
    expect(markup.match(/<h1/g)).toHaveLength(1);
    runtime.dispose();
  });
});
