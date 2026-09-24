import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AgentInspectionPanel } from './AgentInspectionPanel';
import type { MockAgentId } from './mockAgents';

const renderPanel = (selectedAgentId: MockAgentId | null): string => renderToStaticMarkup(
  <AgentInspectionPanel
    selectedAgentId={selectedAgentId}
    onSelectAgent={vi.fn()}
    onClearSelection={vi.fn()}
  />,
);

describe('AgentInspectionPanel', () => {
  it('renders accessible selector buttons linked to the details region', () => {
    const markup = renderPanel('mock-agent-ari');

    expect(markup).toContain('aria-label="Select Ari"');
    expect(markup).toContain('aria-label="Select Mina"');
    expect(markup).toContain('aria-label="Select Sol"');
    expect(markup.match(/aria-controls="agent-inspection-details"/g)).toHaveLength(3);
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(2);
  });

  it.each([
    ['mock-agent-ari', 'Ari', 'idle', 'Waiting for a task'],
    ['mock-agent-mina', 'Mina', 'working', 'Reviewing mock changes'],
    ['mock-agent-sol', 'Sol', 'break', 'Taking a coffee break'],
  ] as const)(
    'renders fixture-backed details for %s without stale values',
    (selectedAgentId, name, state, activity) => {
      const markup = renderPanel(selectedAgentId);

      expect(markup).toContain(`<dd>${name}</dd>`);
      expect(markup).toContain(`<dd>${state}</dd>`);
      expect(markup).toContain(`<dd>${activity}</dd>`);
      expect(markup).toContain('Simulated');

      for (const otherName of ['Ari', 'Mina', 'Sol'].filter((value) => value !== name)) {
        expect(markup).not.toContain(`<dd>${otherName}</dd>`);
      }
    },
  );

  it('restores the prompt and disables clearing when no agent is selected', () => {
    const markup = renderPanel(null);

    expect(markup).toContain('Select an agent to inspect its simulated activity.');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('<dt>Name</dt>');
  });
});
