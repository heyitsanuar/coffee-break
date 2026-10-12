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
      ['office-section-title', '-1'], ['agents-section-title', '-1'], ['worlds-section-title', '-1'], ['projects-section-title', '-1'],
    ]);
    expect(markup.match(/tabindex=/g)).toHaveLength(4);
    runtime.dispose();
  });

  it('provides real named destinations and native world/expansion controls', () => {
    const store = { getSnapshot: () => initialAgentState, subscribe: () => () => {}, subscribeAcceptedUpdates: () => () => {} };
    const runtime = createOfficePresentationRuntime(store, { matches: false, addEventListener() {}, removeEventListener() {} });
    const markup = renderToStaticMarkup(<Application store={store} runtime={runtime} />);
    const navigation = markup.match(/<nav[^>]*>(.*?)<\/nav>/)?.[0] ?? '';
    expect(navigation).toContain('aria-label="Homepage sections"');
    expect([...navigation.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(match => match[1])).toEqual(['Office', 'Agents', 'Projects']);
    expect(navigation).toContain('aria-current="location"');
    expect(navigation).not.toContain('href=');
    expect(markup).toContain('Studio, current authored world. View Worlds');
    expect(markup).toContain('Worlds — current office and future previews');
    expect(markup).toContain('3 inhabitants');
    expect(markup).toMatch(/<button[^>]*aria-label="Expand office within the application"[^>]*>Expand<\/button>/);
    expect(markup).not.toContain('Available in a future update.');
    expect(markup).not.toContain('Project context is reserved');
    expect(markup).not.toContain('class="projects-section"');
    expect(markup).toContain('No GitHub account, repository, or provider is connected.');
    expect(markup).toContain('<h3 id="projects-section-title" class="section-destination" tabindex="-1"><span class="sr-only">Projects — </span>Harbor</h3>');
    const rail = markup.slice(markup.indexOf('class="contextual-rail"'));
    expect(rail.indexOf('class="agent-inspection"')).toBeLessThan(rail.indexOf('class="worlds-composition-region"'));
    expect(rail.indexOf('class="worlds-composition-region"')).toBeLessThan(rail.indexOf('class="sample-composition-region"'));
    expect(markup.match(/<h1/g)).toHaveLength(1);
    runtime.dispose();
  });

  it('keeps logical panel order and the Office heading separate from the Studio action', () => {
    const store = { getSnapshot: () => initialAgentState, subscribe: () => () => {}, subscribeAcceptedUpdates: () => () => {} };
    const runtime = createOfficePresentationRuntime(store, { matches: false, addEventListener() {}, removeEventListener() {} });
    const markup = renderToStaticMarkup(<Application store={store} runtime={runtime} />);
    const positions = ['agents-section', 'agent-inspection', 'worlds-section', 'sample-activity'].map(name => markup.indexOf(`class="${name}"`));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(markup).toMatch(/<h2[^>]*id="office-section-title"[^>]*aria-label="Office — Studio"/);
    expect(markup).toContain('aria-labelledby="office-section-title"');
    expect(markup).toContain('aria-label="Studio, current authored world. View Worlds"');
    expect(markup).not.toMatch(/tabindex="[1-9]/);
    runtime.dispose();
  });
});
