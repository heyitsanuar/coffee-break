import { describe, expect, it, vi } from 'vitest';
import { applyOfficeVisual, createCharacterMotion, OFFICE_STATUS_LABELS } from './applyOfficeVisual';
import { MOCK_AGENTS } from './mockAgents';
import type { OfficeAgentPresentation, OfficeVisual } from './officePresentation';
import { acknowledgementFrame, stableLifecycleFrame } from './agentLifecycleFrames';

const presentation = (id: OfficeAgentPresentation['id'], visual: OfficeVisual, live = true, reducedMotion = false): OfficeAgentPresentation => ({
  id, visual, state: visual === 'placeholder' ? null : visual === 'coffee' ? 'waiting' : visual,
  activity: 'Trusted activity', live, reducedMotion,
});
function fixture(index = 0) {
  const agent = MOCK_AGENTS[index];
  const sprite = { scene: {}, play: vi.fn(), stop: vi.fn(), setFrame: vi.fn(), setTexture: vi.fn() };
  const label = { setText: vi.fn(), setVisible: vi.fn() };
  const timers: Array<{ delay: number; callback: () => void; remove: ReturnType<typeof vi.fn> }> = [];
  const motion = createCharacterMotion(agent, sprite, label, (delay, callback) => {
    const task = { delay, callback, remove: vi.fn() }; timers.push(task); return task;
  });
  return { agent, sprite, label, timers, motion, apply: (visual: OfficeVisual, live = true, reduced = false) => motion.apply(presentation(agent.id, visual, live, reduced)) };
}
describe('shared character vocabulary', () => {
  for (const [index, agent] of MOCK_AGENTS.entries()) {
    it.each(['idle', 'working', 'waiting', 'completed', 'error'] as const)(`${agent.displayName} renders intentional %s stable frame and keeps its label`, state => {
      const f = fixture(index); f.apply(state, false);
      expect(f.sprite.setTexture).toHaveBeenLastCalledWith('agent-lifecycle', stableLifecycleFrame(agent.id, state));
      expect(f.sprite.play).not.toHaveBeenCalled(); expect(f.label.setText).toHaveBeenLastCalledWith(OFFICE_STATUS_LABELS[state]);
    });
    it(`${agent.displayName} loops only live working; retained/reduced use stable work`, () => {
      const f = fixture(index); f.apply('working'); expect(f.sprite.play).toHaveBeenLastCalledWith(`office-agent-${agent.id}-working`, true);
      f.sprite.play.mockClear(); f.apply('working', false); f.apply('working', true, true);
      expect(f.sprite.play).not.toHaveBeenCalled(); expect(f.sprite.setTexture).toHaveBeenLastCalledWith('agent-lifecycle', stableLifecycleFrame(agent.id, 'working'));
    });
  }
  it('idle is still; coffee uses original frames only while live and motion enabled', () => {
    const f = fixture(2); f.apply('idle'); expect(f.sprite.play).not.toHaveBeenCalled();
    f.apply('coffee'); expect(f.sprite.setTexture).toHaveBeenLastCalledWith('mock-agents', 4);
    expect(f.sprite.play).toHaveBeenLastCalledWith('office-agent-mock-agent-sol', true);
    f.sprite.play.mockClear(); f.apply('coffee', false); f.apply('coffee', true, true);
    expect(f.sprite.play).not.toHaveBeenCalled(); expect(f.label.setText).toHaveBeenLastCalledWith('Coffee break');
  });
  it('placeholder shows no invented lifecycle label', () => {
    const f = fixture(); applyOfficeVisual(f.agent, presentation(f.agent.id, 'placeholder', false), f.sprite, f.label);
    expect(f.label.setText).toHaveBeenLastCalledWith(''); expect(f.label.setVisible).toHaveBeenLastCalledWith(false);
  });
});
describe('non-replayable character reactions', () => {
  it('stops a live sprite on disposal only once and ignores later work', () => {
    const f = fixture(); f.apply('completed');
    f.motion.acknowledge({ id: f.agent.id, state: 'completed', sequence: 1 });
    f.sprite.stop.mockClear();
    f.motion.dispose(); f.motion.dispose();
    expect(f.sprite.stop).toHaveBeenCalledOnce();
    expect(f.timers[0].remove).toHaveBeenCalledOnce();
    f.sprite.setTexture.mockClear(); f.sprite.setFrame.mockClear();
    f.timers[0].callback(); f.apply('working');
    f.motion.acknowledge({ id: f.agent.id, state: 'error', sequence: 2 });
    expect(f.sprite.setTexture).not.toHaveBeenCalled();
    expect(f.sprite.setFrame).not.toHaveBeenCalled();
  });
  it.each(['completed', 'error'] as const)('acknowledges %s once then settles after its approved duration', state => {
    const f = fixture(); f.apply(state);
    const ack = { id: f.agent.id, state, sequence: 1 }; f.motion.acknowledge(ack);
    expect(f.sprite.setFrame).toHaveBeenLastCalledWith(acknowledgementFrame(f.agent.id, state));
    expect(f.timers[0].delay).toBe(state === 'completed' ? 500 : 400);
    f.motion.acknowledge(ack); expect(f.timers).toHaveLength(1);
    f.timers[0].callback(); expect(f.sprite.setTexture).toHaveBeenLastCalledWith('agent-lifecycle', stableLifecycleFrame(f.agent.id, state));
  });
  it.each(['lifecycle', 'retained', 'reduced', 'dispose'] as const)('%s cancels unfinished reaction; stale callback cannot overwrite', kind => {
    const f = fixture(); f.apply('completed'); f.motion.acknowledge({ id: f.agent.id, state: 'completed', sequence: 1 });
    if (kind === 'dispose') f.motion.dispose();
    else f.apply(kind === 'lifecycle' ? 'working' : 'completed', kind !== 'retained', kind === 'reduced');
    expect(f.timers[0].remove).toHaveBeenCalledOnce();
    const before = f.sprite.setTexture.mock.calls.length; f.timers[0].callback(); expect(f.sprite.setTexture).toHaveBeenCalledTimes(before);
    f.motion.dispose();
  });
  it('activity/reason-only render delivery does not restart a reaction or loop', () => {
    const f = fixture(); f.apply('completed'); f.motion.acknowledge({ id: f.agent.id, state: 'completed', sequence: 1 });
    f.motion.apply({ ...presentation(f.agent.id, 'completed'), activity: 'New text', reason: 'approval_required' });
    expect(f.timers[0].remove).not.toHaveBeenCalled(); expect(f.sprite.setFrame).toHaveBeenCalledOnce();
  });
  it('reduced-motion off and live restoration remain settled, including repeated old notification', () => {
    const f = fixture(); const ack = { id: f.agent.id, state: 'error' as const, sequence: 1 };
    f.apply('error', false); f.motion.acknowledge(ack); f.apply('error', true); f.motion.acknowledge(ack);
    f.apply('error', true, true); f.apply('error'); expect(f.timers).toHaveLength(0);
  });
});
