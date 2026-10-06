import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AgentSelector } from './AgentSelector';
import type { ReactElement } from 'react';

describe('compact native selector', () => {
  it('has exactly three named controls in identity order with one pressed state', () => {
    const markup = renderToStaticMarkup(<AgentSelector selectedAgentId="mock-agent-mina" onSelectAgent={vi.fn()} />);
    expect(markup.match(/aria-label="Select (Ari|Mina|Sol)"/g)).toEqual([
      'aria-label="Select Ari"', 'aria-label="Select Mina"', 'aria-label="Select Sol"',
    ]);
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(markup.match(/aria-controls="agent-inspection-details"/g)).toHaveLength(3);
    expect(markup).toContain('✓');
  });
  it('activates the matching identity and has no focus-selection handler', () => {
    const onSelectAgent = vi.fn();
    const element = AgentSelector({ selectedAgentId: null, onSelectAgent });
    const children = (element.props as { children: ReactElement<{ onClick(): void; onFocus?: () => void }>[] }).children;
    expect(onSelectAgent).not.toHaveBeenCalled();
    for (const child of children) expect(child.props.onFocus).toBeUndefined();
    children.forEach(child => child.props.onClick());
    expect(onSelectAgent.mock.calls).toEqual([['mock-agent-ari'], ['mock-agent-mina'], ['mock-agent-sol']]);
  });
});
