import Phaser from 'phaser';
import officeRoomBackgroundUrl from './assets/office-room-background.png';
import officeRoomForegroundUrl from './assets/office-room-foreground.png';
import {
  OFFICE_ART_SCALE,
  OFFICE_DEPTHS,
  OFFICE_SCENE_HEIGHT,
  OFFICE_SCENE_WIDTH,
} from './officeLayout';

export { OFFICE_SCENE_HEIGHT, OFFICE_SCENE_WIDTH } from './officeLayout';

const OFFICE_BACKGROUND_TEXTURE = 'office-room-background';
const OFFICE_FOREGROUND_TEXTURE = 'office-room-foreground';

export class OfficeScene extends Phaser.Scene {
  constructor() {
    super('office');
  }

  preload(): void {
    this.load.image(OFFICE_BACKGROUND_TEXTURE, officeRoomBackgroundUrl);
    this.load.image(OFFICE_FOREGROUND_TEXTURE, officeRoomForegroundUrl);
  }

  create(): void {
    if (
      !this.textures.exists(OFFICE_BACKGROUND_TEXTURE)
      || !this.textures.exists(OFFICE_FOREGROUND_TEXTURE)
    ) {
      this.createFallbackRoom();
      return;
    }

    this.add.image(0, 0, OFFICE_BACKGROUND_TEXTURE)
      .setOrigin(0)
      .setScale(OFFICE_ART_SCALE)
      .setDepth(OFFICE_DEPTHS.background);

    this.add.image(0, 0, OFFICE_FOREGROUND_TEXTURE)
      .setOrigin(0)
      .setScale(OFFICE_ART_SCALE)
      .setDepth(OFFICE_DEPTHS.foreground);
  }

  private createFallbackRoom(): void {
    const room = this.add.graphics();

    room.fillStyle(0xf5e7c8);
    room.fillRect(0, 0, OFFICE_SCENE_WIDTH, 92);
    room.fillStyle(0xb77a4e);
    room.fillRect(0, 92, OFFICE_SCENE_WIDTH, OFFICE_SCENE_HEIGHT - 92);
    room.fillStyle(0x5b3a2e);
    room.fillRect(0, 84, OFFICE_SCENE_WIDTH, 8);

    room.fillStyle(0x8b5a3c);
    room.fillRect(28, 120, 160, 48);
    room.fillRect(212, 120, 160, 48);
    room.fillStyle(0x41576c);
    room.fillRect(80, 92, 56, 32);
    room.fillRect(264, 92, 56, 32);

    room.fillStyle(0xbf6b4c);
    room.fillRect(436, 184, 176, 140);
    room.fillStyle(0x516757);
    room.fillRect(448, 104, 156, 64);
    room.fillStyle(0x2d3036);
    room.fillRect(466, 72, 44, 40);

    room.lineStyle(4, 0x4b403a);
    room.strokeRect(8, 8, OFFICE_SCENE_WIDTH - 16, OFFICE_SCENE_HEIGHT - 16);
  }
}
