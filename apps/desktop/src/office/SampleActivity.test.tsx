import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SampleActivity } from './SampleActivity';

describe('SampleActivity', () => {
  it('keeps provenance above Harbor and exactly three non-interactive ordered examples', () => {
    const markup = renderToStaticMarkup(<SampleActivity />);
    const rows = [...markup.matchAll(/<li>(.*?)<\/li>/g)].map(match => match[1]);
    expect(rows).toHaveLength(3);
    const expected = [
      ['Ari', 'Search panel draft opened', 'H-13 · Example PR #19', '10:10'],
      ['Mina', 'Query privacy ready for review', 'H-14 · Example PR #20', '10:20'],
      ['Sol', 'Notes search sample updated', 'H-15 · Example work item', '10:30'],
    ];
    rows.forEach((row, index) => {
      let previous = -1;
      for (const text of expected[index]) {
        expect(row.indexOf(text)).toBeGreaterThan(previous);
        previous = row.indexOf(text);
      }
      expect(row).toContain('width:32px;height:32px');
      expect(row).toContain('aria-hidden="true"');
      expect(row).toContain('Example time ');
      for (const tag of ['<a ', '<button', '<summary', 'aria-pressed', 'freshness-dot', 'role="button"']) expect(row).not.toContain(tag);
    });
    expect(markup).toContain('aria-label="Recent Activity — Sample"');
    expect(markup).toContain('aria-label="Fixed sample activity sequence"');
    expect(markup.indexOf('Fixed example sequence · Not runtime history')).toBeLessThan(markup.indexOf('id="projects-section-title"'));
    expect(markup.indexOf('id="projects-section-title"')).toBeLessThan(markup.indexOf('<ol'));
    expect(markup).toContain('aria-hidden="true">Sample</span>');
    expect(markup).not.toContain('aria-live');
  });

  it('offers a closed native disclosure with exact fictional copy and an always-visible Projects destination', () => {
    const markup = renderToStaticMarkup(<SampleActivity />);
    expect(markup).toContain('<details class="sample-project-context">');
    expect(markup).not.toContain(' open=');
    expect(markup).toContain('<summary aria-label="Project context for Harbor — fictional example">Project context</summary>');
    expect(markup.indexOf('id="projects-section-title"')).toBeLessThan(markup.indexOf('<details'));
    for (const copy of [
      'Fictional workspace · Example content only', '/ Local notes search', 'Fictional project context',
      'Harbor is a fictional workspace illustrating local notes search. The activity sequence and project identifiers are examples, not current agent assignments.',
      'Example repository', 'harbor-demo/local-notes-search', 'Example branch', 'example/h-14-query-privacy',
      'No GitHub account, repository, or provider is connected.',
    ]) expect(markup).toContain(copy);
    expect(markup).not.toContain('href=');
    expect(markup).not.toContain('<button');
  });
});
