import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SelectedAgentSummary, selectedAgentFeedback } from './SelectedAgentSummary';
import type { OfficeAgentPresentation } from './officePresentation';

const presentation: OfficeAgentPresentation = {
  id: 'mock-agent-ari', state: 'working', activity: 'Exact activity excluded from summary',
  reason: 'approval_required', live: true, visual: 'working', reducedMotion: false,
};
describe('selected concise feedback', () => {
  it.each([
    [presentation, 'Ari · Working'],
    [{ ...presentation, live: false }, 'Ari · Working · Last known'],
    [null, 'Ari · No trusted agent state available yet.'],
    [{ ...presentation, state: null, activity: null, visual: 'placeholder' as const }, 'Ari · No trusted agent state available yet.'],
  ])('uses trusted lifecycle and freshness without activity or reason', (value, expected) => {
    const props = { selectedAgentId: 'mock-agent-ari' as const, presentation: value };
    expect(selectedAgentFeedback(props)).toBe(expected);
    const markup = renderToStaticMarkup(<SelectedAgentSummary {...props} />);
    expect(markup).toContain(expected);
    expect(markup).toContain('class="selected-agent-summary"');
    expect(markup).not.toContain('aria-live');
    expect(markup).not.toContain('agent-portrait');
    expect(markup).not.toContain(presentation.activity!);
    expect(markup).not.toContain('Approval required');
  });
  it('omits selected summary when nothing is selected', () => {
    expect(renderToStaticMarkup(<SelectedAgentSummary selectedAgentId={null} presentation={null} />)).toBe('');
  });
  it('keeps coffee feedback as trusted Waiting', () => {
    expect(selectedAgentFeedback({ selectedAgentId: 'mock-agent-sol', presentation: {
      ...presentation, id: 'mock-agent-sol', state: 'waiting', visual: 'coffee',
    } })).toBe('Sol · Waiting');
  });
});
