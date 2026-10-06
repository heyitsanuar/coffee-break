import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { AgentPortrait } from './AgentPortrait';
import { AgentSelector } from './AgentSelector';
import { MOCK_AGENTS } from './mockAgents';

it.each(MOCK_AGENTS)('derives $displayName portraits from its canonical Idle row at integer 2×/3×', agent => {
  const row = MOCK_AGENTS.indexOf(agent);
  for (const size of [32, 48] as const) {
    const scale = size / 16;
    const markup = renderToStaticMarkup(<AgentPortrait id={agent.id} size={size} />);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain(`width:${size}px;height:${size}px`);
    expect(markup).toContain('agent-lifecycle.png');
    expect(markup).toContain(`background-size:${160 * scale}px ${72 * scale}px`);
    expect(markup).toContain(`background-position:${-2 * scale}px ${-row * 24 * scale}px`);
    expect(markup).not.toContain('role=');
  }
});

it('uses crisp canonical windows and a structurally reserved check independent of selection', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  expect(css).toContain('image-rendering: pixelated');
  expect(css).toContain('white-space: pre-wrap');
  expect(css).toContain('height: 44px');
  for (const selectedAgentId of [null, ...MOCK_AGENTS.map(agent => agent.id)]) {
    const markup = renderToStaticMarkup(<AgentSelector selectedAgentId={selectedAgentId} onSelectAgent={() => {}} />);
    expect(markup.match(/width:32px;height:32px/g)).toHaveLength(3);
    expect(markup.match(/class="agent-selector-check" aria-hidden="true">✓/g)).toHaveLength(3);
    expect(markup.match(/type="button"/g)).toHaveLength(3);
    for (const detail of ['Activity', 'Last known', 'Current information', 'Offline']) expect(markup).not.toContain(detail);
  }
});
