import Phaser from 'phaser';
import type { MockAgentId } from './mockAgents';
import type { OfficeAcknowledgement } from './officePresentationRuntime';
import type { OfficeAgentPresentation } from './officePresentation';
import {
  OFFICE_SCENE_HEIGHT,
  OFFICE_SCENE_WIDTH,
  OfficeScene,
} from './OfficeScene';

export type OnAgentSelected = (agentId: MockAgentId) => void;

export interface OfficeGame {
  acknowledge(value: OfficeAcknowledgement): void;
  destroy(removeCanvas: boolean): void;
  setSelectedAgent(agentId: MockAgentId | null): void;
  setAgentPresentation(agentId: MockAgentId, presentation: OfficeAgentPresentation): void;
}

export function createOfficeGame(
  parent: HTMLElement,
  onAgentSelected: OnAgentSelected,
): OfficeGame {
  const scene = new OfficeScene(onAgentSelected);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: OFFICE_SCENE_WIDTH,
    height: OFFICE_SCENE_HEIGHT,
    scene,
    backgroundColor: '#d9ddd0',
    pixelArt: true,
    antialias: false,
    autoFocus: false,
    banner: false,
  });

  return {
    acknowledge: value => scene.acknowledge(value),
    destroy: (removeCanvas) => game.destroy(removeCanvas),
    setSelectedAgent: (agentId) => scene.setSelectedAgent(agentId),
    setAgentPresentation: (agentId, presentation) => scene.setAgentPresentation(agentId, presentation),
  };
}
