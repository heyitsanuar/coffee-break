import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      textures = { exists: vi.fn(() => true) };
      anims = { exists: vi.fn(() => false), create: vi.fn() };
      events = { once: vi.fn() };
      add = { sprite: vi.fn(), text: vi.fn() };
    },
    Input: { Events: { POINTER_DOWN: 'pointerdown' } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  },
}));

import { OfficeScene } from './OfficeScene';
import type { MockAgentId } from './mockAgents';
import type { OfficeAgentPresentation } from './officePresentation';

function presentation(id: MockAgentId, visual: OfficeAgentPresentation['visual']): OfficeAgentPresentation {
  return { id, state: visual === 'placeholder' ? null : visual === 'coffee' ? 'waiting' : visual,
    activity: visual === 'placeholder' ? null : 'Trusted activity', visual };
}

function sprite() {
  const instance = {
    setName: vi.fn(), setOrigin: vi.fn(), setScale: vi.fn(), setDepth: vi.fn(),
    setInteractive: vi.fn(), on: vi.fn(), play: vi.fn(), stop: vi.fn(), setFrame: vi.fn(),
  };
  for (const key of ['setName', 'setOrigin', 'setScale', 'setDepth', 'setInteractive', 'on'] as const) {
    instance[key].mockReturnValue(instance);
  }
  return instance;
}

function label() {
  const instance = { setOrigin: vi.fn(), setDepth: vi.fn(), setVisible: vi.fn(), setText: vi.fn() };
  for (const key of ['setOrigin', 'setDepth', 'setVisible'] as const) instance[key].mockReturnValue(instance);
  return instance;
}

describe('OfficeScene presentation handoff', () => {
  it('uses the latest pre-create value, then mutates only the target sprite and label', () => {
    const scene = new OfficeScene();
    const internals = scene as unknown as {
      add: { sprite: ReturnType<typeof vi.fn>; text: ReturnType<typeof vi.fn> };
      createMockAgents(): void;
    };
    const sprites = [sprite(), sprite(), sprite()];
    const labels = [label(), label(), label()];
    sprites.forEach((item) => internals.add.sprite.mockReturnValueOnce(item));
    labels.forEach((item) => internals.add.text.mockReturnValueOnce(item));

    scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'working'));
    scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'coffee'));
    internals.createMockAgents();

    expect(internals.add.sprite).toHaveBeenCalledTimes(3);
    expect(internals.add.text).toHaveBeenCalledTimes(3);
    expect(sprites[2].play).toHaveBeenCalledExactlyOnceWith('office-agent-mock-agent-sol', true);
    expect(labels[2].setText).toHaveBeenLastCalledWith('Coffee break');
    expect(labels[2].setText).not.toHaveBeenCalledWith('Working');

    sprites.forEach((item) => { item.play.mockClear(); item.stop.mockClear(); item.setFrame.mockClear(); });
    labels.forEach((item) => item.setText.mockClear());
    scene.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'completed'));
    expect(sprites[0].stop).toHaveBeenCalledOnce();
    expect(labels[0].setText).toHaveBeenCalledExactlyOnceWith('Completed');
    expect(sprites[1].stop).not.toHaveBeenCalled();
    expect(sprites[2].stop).not.toHaveBeenCalled();
    expect(labels[1].setText).not.toHaveBeenCalled();
    expect(labels[2].setText).not.toHaveBeenCalled();
    scene.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'completed'));
    expect(sprites[0].stop).toHaveBeenCalledOnce();
    expect(internals.add.sprite).toHaveBeenCalledTimes(3);
  });
});
