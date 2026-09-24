import Phaser from 'phaser';
import type { MockAgentId } from './mockAgents';
import {
  OFFICE_SCENE_HEIGHT,
  OFFICE_SCENE_WIDTH,
  OfficeScene,
} from './OfficeScene';

export type OnAgentSelected = (agentId: MockAgentId) => void;

export interface OfficeGame {
  destroy(removeCanvas: boolean): void;
  setSelectedAgent(agentId: MockAgentId | null): void;
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
    destroy: (removeCanvas) => game.destroy(removeCanvas),
    setSelectedAgent: (agentId) => scene.setSelectedAgent(agentId),
  };
}
