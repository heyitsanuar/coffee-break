import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AgentSelector } from './AgentSelector';
import type { ReactElement } from 'react';
import { initialAgentState } from '../agentState/reducer';
import { deriveOfficePresentation } from './officePresentation';
const presentations = deriveOfficePresentation(initialAgentState);

describe('compact native selector', () => {
  it('has exactly three named controls in identity order with one pressed state', () => {
    const markup = renderToStaticMarkup(<AgentSelector selectedAgentId="mock-agent-mina" onSelectAgent={vi.fn()} presentations={presentations} />);
    expect(markup.match(/aria-label="Select (Ari|Mina|Sol), No trusted state"/g)).toEqual([
      'aria-label="Select Ari, No trusted state"', 'aria-label="Select Mina, No trusted state"', 'aria-label="Select Sol, No trusted state"',
    ]);
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(markup.match(/aria-controls="agent-inspection-details"/g)).toHaveLength(3);
    expect(markup).toContain('✓');
  });
  it('activates the matching identity and has no focus-selection handler', () => {
    const onSelectAgent = vi.fn();
    const element = AgentSelector({ selectedAgentId: null, onSelectAgent, presentations });
    const group = (element.props as { children: ReactElement[] }).children[0];
    const children = (group.props as { children: ReactElement<{ onClick(): void; onFocus?: () => void }>[] }).children;
    expect(onSelectAgent).not.toHaveBeenCalled();
    for (const child of children) expect(child.props.onFocus).toBeUndefined();
    children.forEach(child => child.props.onClick());
    expect(onSelectAgent.mock.calls).toEqual([['mock-agent-ari'], ['mock-agent-mina'], ['mock-agent-sol']]);
  });
});

it('keeps accurate freshness/lifecycle names and shared non-color equivalents, including coffee Waiting', () => {
  const values = deriveOfficePresentation({ ...initialAgentState, connection: 'connected', synchronized: true,
    agentsById: {
      'mock-agent-ari': { state: 'working', activity: 'Do not expose exact activity' },
      'mock-agent-mina': { state: 'error', activity: 'Exact error', reason: 'approval_required' },
      'mock-agent-sol': { state: 'waiting', activity: 'Taking a coffee break in the simulated office' },
    } });
  for (const live of [true, false]) {
    const next = Object.fromEntries(Object.entries(values).map(([id, p]) => [id, { ...p, live }])) as typeof values;
    const markup = renderToStaticMarkup(<AgentSelector selectedAgentId="mock-agent-mina" onSelectAgent={vi.fn()} presentations={next} />);
    const description = live ? 'Current information' : 'Last known information, not live';
    for (const [name, state] of [['Ari', 'Working'], ['Mina', 'Error'], ['Sol', 'Waiting']]) expect(markup).toContain(`Select ${name}, ${state}, ${description}`);
    expect(markup).not.toContain('Coffee break');
    expect(markup).not.toContain('Do not expose exact activity');
    expect(markup).not.toContain('aria-live');
    expect(markup).toContain('Dots describe information freshness, not online presence.');
    expect(markup).toContain('data-freshness="no-state"'); // Shared legend.
  }
});
