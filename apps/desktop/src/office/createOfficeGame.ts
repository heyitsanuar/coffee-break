import Phaser from 'phaser';
import {
  OFFICE_SCENE_HEIGHT,
  OFFICE_SCENE_WIDTH,
  OfficeScene,
} from './OfficeScene';

export function createOfficeGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: OFFICE_SCENE_WIDTH,
    height: OFFICE_SCENE_HEIGHT,
    scene: OfficeScene,
    backgroundColor: '#d9ddd0',
    pixelArt: true,
    antialias: false,
    autoFocus: false,
    input: false,
    banner: false,
  });
}
