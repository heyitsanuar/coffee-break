import { describe, expect, it, vi } from 'vitest';
import { applyOfficeVisual, OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import { MOCK_AGENTS } from './mockAgents';
import type { OfficeVisual } from './officePresentation';

function render(id: string, visual: OfficeVisual) {
  const agent = MOCK_AGENTS.find((item) => item.id === id);
  if (!agent) throw new Error(`Missing fixture ${id}`);
  const sprite = { play: vi.fn(), stop: vi.fn(), setFrame: vi.fn() };
  const label = { setText: vi.fn(), setVisible: vi.fn() };
  applyOfficeVisual(agent, visual, sprite, label);
  return { agent, sprite, label };
}

describe('office scene visual application', () => {
  it.each(['placeholder', 'idle', 'working', 'waiting', 'completed', 'error', 'coffee'] as const)(
    'uses readable text for %s without relying on color', (visual) => {
      const { label } = render('mock-agent-sol', visual);
      expect(label.setText).toHaveBeenCalledExactlyOnceWith(OFFICE_STATUS_LABELS[visual]);
      expect(label.setVisible).toHaveBeenCalledExactlyOnceWith(visual !== 'placeholder');
    },
  );

  it('plays only the appropriate existing agent animations', () => {
    for (const [id, visual] of [
      ['mock-agent-ari', 'idle'],
      ['mock-agent-mina', 'working'],
      ['mock-agent-sol', 'coffee'],
    ] as const) {
      const { sprite } = render(id, visual);
      expect(sprite.play).toHaveBeenCalledExactlyOnceWith(`office-agent-${id}`, true);
      expect(sprite.stop).not.toHaveBeenCalled();
    }
  });

  it('stops an inappropriate animation and returns only the target sprite to its neutral frame', () => {
    const { agent, sprite, label } = render('mock-agent-sol', 'waiting');
    expect(sprite.play).not.toHaveBeenCalled();
    expect(sprite.stop).toHaveBeenCalledOnce();
    expect(sprite.setFrame).toHaveBeenCalledExactlyOnceWith(agent.animation.frames[0]);
    expect(label.setText).toHaveBeenCalledExactlyOnceWith('Waiting');
  });
});
