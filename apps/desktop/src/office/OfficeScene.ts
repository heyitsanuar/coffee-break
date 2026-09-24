import Phaser from 'phaser';

export const OFFICE_SCENE_WIDTH = 640;
export const OFFICE_SCENE_HEIGHT = 360;

export class OfficeScene extends Phaser.Scene {
  constructor() {
    super('office');
  }

  create(): void {
    const room = this.add.graphics();

    room.fillStyle(0xd9ddd0);
    room.fillRect(0, 0, OFFICE_SCENE_WIDTH, 136);
    room.fillStyle(0xb98f68);
    room.fillRect(0, 136, OFFICE_SCENE_WIDTH, OFFICE_SCENE_HEIGHT - 136);
    room.fillStyle(0x6f5645);
    room.fillRect(0, 132, OFFICE_SCENE_WIDTH, 8);
    room.lineStyle(4, 0x4b403a);
    room.strokeRect(18, 18, OFFICE_SCENE_WIDTH - 36, OFFICE_SCENE_HEIGHT - 36);

    this.add.text(32, 28, 'Office preview', {
      color: '#302b29',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
    });
  }
}
