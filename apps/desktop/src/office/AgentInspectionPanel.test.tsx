import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AgentInspectionPanel } from './AgentInspectionPanel';
import type { MockAgentId } from './mockAgents';
import type { OfficeAgentPresentation } from './officePresentation';

const renderPanel = (
  selectedAgentId: MockAgentId | null,
  presentation: OfficeAgentPresentation | null = null,
): string => renderToStaticMarkup(
  <AgentInspectionPanel
    selectedAgentId={selectedAgentId}
    presentation={presentation}
    onSelectAgent={vi.fn()}
    onClearSelection={vi.fn()}
  />,
);

describe('AgentInspectionPanel', () => {
  it('retains accessible selection controls and a truthful local-simulation label', () => {
    const markup = renderPanel('mock-agent-ari');
    expect(markup).toContain('aria-label="Select Ari"');
    expect(markup).toContain('aria-label="Select Mina"');
    expect(markup).toContain('aria-label="Select Sol"');
    expect(markup.match(/aria-controls="agent-inspection-details"/g)).toHaveLength(3);
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(markup).toContain('Local simulation');
  });

  it('shows no invented runtime state before a trusted snapshot', () => {
    const markup = renderPanel('mock-agent-ari', {
      id: 'mock-agent-ari', state: null, activity: null, live: true, reducedMotion: false, visual: 'placeholder',
    });
    expect(markup).toContain('<dd>Ari</dd>');
    expect(markup).toContain('No local simulation state yet');
    expect(markup).not.toContain('Waiting for a task');
    expect(markup).not.toContain('<dt>Activity</dt>');
  });

  it('renders selected trusted lifecycle, activity, and optional reason atomically', () => {
    const markup = renderPanel('mock-agent-mina', {
      id: 'mock-agent-mina', state: 'waiting', activity: 'Waiting for approval',
      reason: 'approval_required', live: true, reducedMotion: false, visual: 'waiting',
    });
    expect(markup).toContain('<dd>Mina</dd>');
    expect(markup).toContain('<dd>Waiting</dd>');
    expect(markup).toContain('<dd>Waiting for approval</dd>');
    expect(markup).toContain('<dd>Approval required</dd>');
    expect(markup).not.toContain('Reviewing mock changes');
    expect(markup).not.toContain('<dd>Ari</dd>');
  });

  it('keeps Sol lifecycle waiting when its presentation is coffee', () => {
    const markup = renderPanel('mock-agent-sol', {
      id: 'mock-agent-sol', state: 'waiting',
      activity: 'Taking a coffee break in the simulated office', live: true, reducedMotion: false, visual: 'coffee',
    });
    expect(markup).toContain('<dd>Waiting</dd>');
    expect(markup).toContain('<dd>Taking a coffee break in the simulated office</dd>');
    expect(markup).not.toContain('<dd>Coffee break</dd>');
  });

  it('updates selected details without changing selected identity', () => {
    const before = renderPanel('mock-agent-ari', {
      id: 'mock-agent-ari', state: 'idle', activity: 'Ready for a task', live: true, reducedMotion: false, visual: 'idle',
    });
    const after = renderPanel('mock-agent-ari', {
      id: 'mock-agent-ari', state: 'working', activity: 'Implementing the change', live: true, reducedMotion: false, visual: 'working',
    });
    expect(before).toContain('<dd>Ready for a task</dd>');
    expect(after).toContain('<dd>Implementing the change</dd>');
    expect(after).toContain('<dd>Ari</dd>');
    expect(after).not.toContain('<dd>Mina</dd>');
  });

  it('restores the prompt and disables clearing when no agent is selected', () => {
    const markup = renderPanel(null);
    expect(markup).toContain('Select an agent to inspect its simulated activity.');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('<dt>Name</dt>');
  });
});
