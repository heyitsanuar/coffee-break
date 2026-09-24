import type { OfficeAgentAnchor } from './officeLayout';

export const MOCK_AGENT_FRAME_WIDTH = 20;
export const MOCK_AGENT_FRAME_HEIGHT = 24;
export const MOCK_AGENT_RENDER_SCALE = 2;

export type MockAgentId = 'mock-agent-ari' | 'mock-agent-mina' | 'mock-agent-sol';
export type MockAgentState = 'idle' | 'working' | 'break';
export type MockAgentMode = 'simulated';
export type MockAgentAnimationCue = 'breathing' | 'typing-tablet' | 'mug-raise';

export interface MockAgentAnimation {
  readonly frames: readonly [number, number];
  readonly frameRate: number;
  readonly repeat: -1;
  readonly cue: MockAgentAnimationCue;
}

export interface MockAgentFixture {
  readonly id: MockAgentId;
  readonly displayName: string;
  readonly state: MockAgentState;
  readonly activity: string;
  readonly mode: MockAgentMode;
  readonly anchorId: OfficeAgentAnchor['id'];
  readonly animation: Readonly<MockAgentAnimation>;
}

const createMockAgent = (
  fixture: MockAgentFixture,
): Readonly<MockAgentFixture> => Object.freeze({
  ...fixture,
  animation: Object.freeze({
    ...fixture.animation,
    frames: Object.freeze([...fixture.animation.frames]) as unknown as readonly [number, number],
  }),
});

export const MOCK_AGENTS: readonly Readonly<MockAgentFixture>[] = Object.freeze([
  createMockAgent({
    id: 'mock-agent-ari',
    displayName: 'Ari',
    state: 'idle',
    activity: 'Waiting for a task',
    mode: 'simulated',
    anchorId: 'left-workstation',
    animation: {
      frames: [0, 1],
      frameRate: 2,
      repeat: -1,
      cue: 'breathing',
    },
  }),
  createMockAgent({
    id: 'mock-agent-mina',
    displayName: 'Mina',
    state: 'working',
    activity: 'Reviewing mock changes',
    mode: 'simulated',
    anchorId: 'right-workstation',
    animation: {
      frames: [2, 3],
      frameRate: 4,
      repeat: -1,
      cue: 'typing-tablet',
    },
  }),
  createMockAgent({
    id: 'mock-agent-sol',
    displayName: 'Sol',
    state: 'break',
    activity: 'Taking a coffee break',
    mode: 'simulated',
    anchorId: 'coffee-break',
    animation: {
      frames: [4, 5],
      frameRate: 2,
      repeat: -1,
      cue: 'mug-raise',
    },
  }),
]);

export const getMockAgent = (
  agentId: MockAgentId | null,
): Readonly<MockAgentFixture> | undefined => (
  agentId === null ? undefined : MOCK_AGENTS.find(({ id }) => id === agentId)
);
