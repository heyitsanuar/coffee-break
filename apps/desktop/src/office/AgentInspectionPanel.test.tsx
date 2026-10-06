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
    onClearSelection={vi.fn()}
  />,
);

describe('AgentInspectionPanel', () => {
  it('shows no invented runtime state before a trusted snapshot', () => {
    const markup = renderPanel('mock-agent-ari', {
      id: 'mock-agent-ari', state: null, activity: null, live: true, reducedMotion: false, visual: 'placeholder',
    });
    expect(markup).toContain('<h2 id="agent-inspection-title">Ari</h2>');
    expect(markup).toContain('No trusted agent state available yet.');
    expect(markup).not.toContain('Waiting for a task');
    expect(markup).not.toContain('<dt>Activity</dt>');
  });

  it('renders selected trusted lifecycle, activity, and optional reason atomically', () => {
    const markup = renderPanel('mock-agent-mina', {
      id: 'mock-agent-mina', state: 'waiting', activity: 'Waiting for approval',
      reason: 'approval_required', live: true, reducedMotion: false, visual: 'waiting',
    });
    expect(markup).toContain('<h2 id="agent-inspection-title">Mina</h2>');
    expect(markup).toContain('<p class="agent-inspection-lifecycle">Waiting</p>');
    expect(markup).toContain('<dd>Waiting for approval</dd>');
    expect(markup).toContain('<dd>Approval required</dd>');
    expect(markup).not.toContain('Reviewing mock changes');
    expect(markup).not.toContain('<h2 id="agent-inspection-title">Ari</h2>');
  });

  it('keeps Sol lifecycle waiting when its presentation is coffee', () => {
    const markup = renderPanel('mock-agent-sol', {
      id: 'mock-agent-sol', state: 'waiting',
      activity: 'Taking a coffee break in the simulated office', live: true, reducedMotion: false, visual: 'coffee',
    });
    expect(markup).toContain('<p class="agent-inspection-lifecycle">Waiting</p>');
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
    expect(after).toContain('<h2 id="agent-inspection-title">Ari</h2>');
    expect(after).not.toContain('<h2 id="agent-inspection-title">Mina</h2>');
  });

  it('restores the invitation and makes clearing non-operative when no agent is selected', () => {
    const markup = renderPanel(null);
    expect(markup).toContain('Choose someone in the office or below.');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toContain('<dt>Name</dt>');
  });
});

it('preserves exact retained fields, qualifies once, and does not announce full details', () => {
  const markup = renderPanel('mock-agent-mina', {
    id: 'mock-agent-mina', state: 'waiting', activity: 'A long trusted activity / literal & text',
    reason: 'capacity_exhausted', live: false, reducedMotion: true, visual: 'waiting',
  });
  expect(markup).toContain('<p class="agent-inspection-lifecycle">Waiting</p>');
  expect(markup).toContain('A long trusted activity / literal &amp; text');
  expect(markup).toContain('Capacity exhausted');
  expect(markup.match(/Last known/g)).toHaveLength(1);
  expect(markup).not.toContain('aria-live');
  expect(markup).not.toContain('aria-atomic');
});

it('omits absent reason and shows live freshness without truncating long content', () => {
  const activity = 'unbroken'.repeat(64);
  const markup = renderPanel('mock-agent-ari', {
    id: 'mock-agent-ari', state: 'error', activity, live: true, reducedMotion: false, visual: 'error',
  });
  expect(markup).toContain(activity);
  expect(markup).not.toContain('<dt>Reason</dt>');
  expect(markup).not.toContain('Last known');
  expect(markup).toContain('Current information');
});

it('orders identity, lifecycle, freshness and verbatim multiline activity, without invented fields', () => {
  const activity = 'First exact line\n' + 'unbroken'.repeat(60);
  const markup = renderPanel('mock-agent-sol', {
    id: 'mock-agent-sol', state: 'waiting', activity, reason: 'approval_required', live: false, reducedMotion: false, visual: 'waiting',
  });
  const parts = ['>Sol</h2>', '>Waiting</p>', 'Last known · Not live', '<dt>Activity</dt>', activity, '<dt>Reason</dt>'];
  for (let i = 1; i < parts.length; i++) expect(markup.indexOf(parts[i])).toBeGreaterThan(markup.indexOf(parts[i - 1]));
  for (const field of ['Name', 'Current state', 'Model', 'Tokens', 'Cost', 'Productivity', 'History', 'Provider', 'Offline', 'Coffee break']) expect(markup).not.toContain(`<dt>${field}</dt>`);
  expect(markup).not.toContain('Taking a coffee break');
});

it('keeps Clear stable and guards empty activation without managing focus', () => {
  const onClearSelection = vi.fn();
  const clear = (id: MockAgentId | null) => {
    const panel = AgentInspectionPanel({ selectedAgentId: id, presentation: null, onClearSelection });
    return (panel.props as { children: React.ReactElement<{ onClick(): void; 'aria-disabled': boolean; disabled?: boolean; onFocus?: () => void }>[] }).children[2];
  };
  const empty = clear(null);
  expect(empty.type).toBe('button'); expect(empty.props.disabled).toBeUndefined();
  expect(empty.props['aria-disabled']).toBe(true); empty.props.onClick(); expect(onClearSelection).not.toHaveBeenCalled();
  const selected = clear('mock-agent-ari'); expect(selected.type).toBe(empty.type);
  expect(selected.props.onFocus).toBeUndefined(); selected.props.onClick(); expect(onClearSelection).toHaveBeenCalledOnce();
});

it('selected without state has identity and no inferred lifecycle, freshness, activity or reason', () => {
  const markup = renderPanel('mock-agent-mina');
  expect(markup).toContain('width:48px;height:48px'); expect(markup).toContain('>Mina</h2>');
  for (const value of ['agent-inspection-lifecycle', 'agent-inspection-freshness', '<dt>Activity', '<dt>Reason']) expect(markup).not.toContain(value);
});
