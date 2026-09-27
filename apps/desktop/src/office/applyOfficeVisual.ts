import type { MockAgentFixture } from './mockAgents';
import type { OfficeVisual } from './officePresentation';

export interface SpriteVisualPort {
  play(key: string, ignoreIfPlaying?: boolean): unknown;
  stop(): unknown;
  setFrame(frame: number): unknown;
}

export interface LabelVisualPort {
  setText(value: string): unknown;
  setVisible(value: boolean): unknown;
}

export const OFFICE_STATUS_LABELS: Readonly<Record<OfficeVisual, string>> = {
  placeholder: '',
  idle: 'Idle',
  working: 'Working',
  waiting: 'Waiting',
  completed: 'Completed',
  error: 'Error',
  coffee: 'Coffee break',
};

export function applyOfficeVisual(
  agent: MockAgentFixture,
  visual: OfficeVisual,
  sprite: SpriteVisualPort,
  label: LabelVisualPort,
): void {
  const animated = (agent.id === 'mock-agent-ari' && visual === 'idle')
    || (agent.id === 'mock-agent-mina' && visual === 'working')
    || (agent.id === 'mock-agent-sol' && visual === 'coffee');
  if (animated) sprite.play(`office-agent-${agent.id}`, true);
  else {
    sprite.stop();
    sprite.setFrame(agent.animation.frames[0]);
  }
  const text = OFFICE_STATUS_LABELS[visual];
  label.setText(text);
  label.setVisible(text.length > 0);
}
