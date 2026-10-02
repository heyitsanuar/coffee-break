import type { MockAgentFixture } from './mockAgents';
import type { OfficeAgentPresentation, OfficeVisual } from './officePresentation';
import type { OfficeAcknowledgement } from './officePresentationRuntime';
import { ACKNOWLEDGEMENT_DURATION, AGENT_LIFECYCLE_TEXTURE, acknowledgementFrame, stableLifecycleFrame } from './agentLifecycleFrames';

export interface SpriteVisualPort {
  readonly scene: unknown;
  play(key: string, ignoreIfPlaying?: boolean): unknown;
  stop(): unknown;
  setFrame(frame: number): unknown;
  setTexture(key: string, frame?: number): unknown;
}
export interface LabelVisualPort {
  setText(value: string): unknown;
  setVisible(value: boolean): unknown;
}
export const OFFICE_STATUS_LABELS: Readonly<Record<OfficeVisual, string>> = {
  placeholder: '', idle: 'Idle', working: 'Working', waiting: 'Waiting',
  completed: 'Completed', error: 'Error', coffee: 'Coffee break',
};
export function applyOfficeVisual(
  agent: MockAgentFixture, presentation: OfficeAgentPresentation,
  sprite: SpriteVisualPort, label: LabelVisualPort,
): void {
  const { visual, live, reducedMotion } = presentation;
  sprite.stop();
  if (visual === 'coffee') {
    sprite.setTexture('mock-agents', agent.animation.frames[0]);
    if (live && !reducedMotion) sprite.play(`office-agent-${agent.id}`, true);
  } else {
    const state = visual === 'placeholder' ? 'idle' : visual;
    sprite.setTexture(AGENT_LIFECYCLE_TEXTURE, stableLifecycleFrame(agent.id, state));
    if (visual === 'working' && live && !reducedMotion) sprite.play(`office-agent-${agent.id}-working`, true);
  }
  const text = OFFICE_STATUS_LABELS[visual];
  label.setText(text);
  label.setVisible(text.length > 0);
}
export function createCharacterMotion(
  agent: MockAgentFixture, sprite: SpriteVisualPort, label: LabelVisualPort,
  schedule: (delay: number, callback: () => void) => { remove(): void },
) {
  let current: OfficeAgentPresentation | undefined;
  let timer: { remove(): void } | undefined;
  let generation = 0;
  let lastSequence = 0;
  let disposed = false;
  const cancel = () => { generation++; timer?.remove(); timer = undefined; };
  return {
    apply(next: OfficeAgentPresentation) {
      if (disposed) return;
      const unchanged = current?.visual === next.visual && current.live === next.live
        && current.reducedMotion === next.reducedMotion;
      current = next;
      if (unchanged) return;
      cancel();
      applyOfficeVisual(agent, next, sprite, label);
    },
    acknowledge(value: OfficeAcknowledgement) {
      if (disposed || value.id !== agent.id || value.sequence <= lastSequence) return;
      lastSequence = value.sequence;
      if (!current?.live || current.reducedMotion || current.visual !== value.state) return;
      cancel();
      const episode = generation;
      sprite.stop();
      sprite.setFrame(acknowledgementFrame(agent.id, value.state));
      timer = schedule(ACKNOWLEDGEMENT_DURATION[value.state], () => {
        if (disposed || generation !== episode || !current) return;
        timer = undefined;
        applyOfficeVisual(agent, current, sprite, label);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      // Phaser clears scene/anims when DisplayList destruction precedes our shutdown listener.
      if (sprite.scene) sprite.stop();
    },
  };
}
