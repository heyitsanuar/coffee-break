import Phaser from 'phaser';
import agentLifecycleUrl from './assets/agent-lifecycle.png';
import mockAgentsUrl from './assets/mock-agents.png';
import officeRoomBackgroundUrl from './assets/office-room-background.png';
import officeRoomForegroundUrl from './assets/office-room-foreground.png';
import {
  MOCK_AGENT_FRAME_HEIGHT,
  MOCK_AGENT_FRAME_WIDTH,
  MOCK_AGENT_RENDER_SCALE,
  MOCK_AGENTS,
  type MockAgentId,
} from './mockAgents';
import {
  OFFICE_AGENT_ANCHORS,
  OFFICE_ART_SCALE,
  OFFICE_DEPTHS,
  OFFICE_SCENE_HEIGHT,
  OFFICE_SCENE_WIDTH,
} from './officeLayout';
import { createCharacterMotion } from './applyOfficeVisual';
import { AGENT_LIFECYCLE_TEXTURE, WORKING_FRAME_RATE, workingFrames } from './agentLifecycleFrames';
import type { OfficeAcknowledgement } from './officePresentationRuntime';
import type { OfficeAgentPresentation } from './officePresentation';

export { OFFICE_SCENE_HEIGHT, OFFICE_SCENE_WIDTH } from './officeLayout';

const OFFICE_BACKGROUND_TEXTURE = 'office-room-background';
const OFFICE_FOREGROUND_TEXTURE = 'office-room-foreground';
const MOCK_AGENTS_TEXTURE = 'mock-agents';

export class OfficeScene extends Phaser.Scene {
  private readonly agentSprites = new Map<MockAgentId, Phaser.GameObjects.Sprite>();
  private readonly statusLabels = new Map<MockAgentId, Phaser.GameObjects.Text>();
  private readonly presentations = new Map<MockAgentId, OfficeAgentPresentation>();
  private readonly motions = new Map<MockAgentId, ReturnType<typeof createCharacterMotion>>();
  private selectionIndicator?: Phaser.GameObjects.Graphics;
  private selectedAgentId: MockAgentId | null = null;

  constructor(private readonly onAgentSelected: (agentId: MockAgentId) => void = () => {}) {
    super('office');
  }

  setSelectedAgent(agentId: MockAgentId | null): void {
    this.selectedAgentId = agentId;
    this.updateSelectionIndicator();
  }

  setAgentPresentation(agentId: MockAgentId, presentation: OfficeAgentPresentation): void {
    this.presentations.set(agentId, presentation);
    this.motions.get(agentId)?.apply(presentation);
  }

  acknowledge(value: OfficeAcknowledgement): void {
    this.motions.get(value.id)?.acknowledge(value);
  }

  preload(): void {
    this.load.image(OFFICE_BACKGROUND_TEXTURE, officeRoomBackgroundUrl);
    this.load.image(OFFICE_FOREGROUND_TEXTURE, officeRoomForegroundUrl);
    this.load.spritesheet(AGENT_LIFECYCLE_TEXTURE, agentLifecycleUrl, {
      frameWidth: MOCK_AGENT_FRAME_WIDTH, frameHeight: MOCK_AGENT_FRAME_HEIGHT,
    });
    this.load.spritesheet(MOCK_AGENTS_TEXTURE, mockAgentsUrl, {
      frameWidth: MOCK_AGENT_FRAME_WIDTH,
      frameHeight: MOCK_AGENT_FRAME_HEIGHT,
    });
  }

  create(): void {
    const roomTexturesAvailable = this.textures.exists(OFFICE_BACKGROUND_TEXTURE)
      && this.textures.exists(OFFICE_FOREGROUND_TEXTURE);

    if (roomTexturesAvailable) {
      this.add.image(0, 0, OFFICE_BACKGROUND_TEXTURE)
        .setOrigin(0)
        .setScale(OFFICE_ART_SCALE)
        .setDepth(OFFICE_DEPTHS.background);
    } else {
      this.createFallbackRoom();
    }

    this.createMockAgents();
    this.selectionIndicator = this.add.graphics()
      .setDepth(OFFICE_DEPTHS.futureAgents + 1);
    this.updateSelectionIndicator();

    if (roomTexturesAvailable) {
      this.add.image(0, 0, OFFICE_FOREGROUND_TEXTURE)
        .setOrigin(0)
        .setScale(OFFICE_ART_SCALE)
        .setDepth(OFFICE_DEPTHS.foreground);
    }
  }

  private createMockAgents(): void {
    if (!this.textures.exists(MOCK_AGENTS_TEXTURE) || !this.textures.exists(AGENT_LIFECYCLE_TEXTURE)) {
      console.error('Mock agent spritesheet failed to load.');
      return;
    }

    for (const agent of MOCK_AGENTS) {
      const anchor = OFFICE_AGENT_ANCHORS.find(({ id }) => id === agent.anchorId);

      if (!anchor) {
        console.error(`Mock agent anchor was not found: ${agent.anchorId}`);
        continue;
      }

      const animationKey = `office-agent-${agent.id}`;

      if (!this.anims.exists(animationKey)) {
        this.anims.create({
          key: animationKey,
          frames: agent.animation.frames.map((frame) => ({
            key: MOCK_AGENTS_TEXTURE,
            frame,
          })),
          frameRate: agent.animation.frameRate,
          repeat: agent.animation.repeat,
        });
      }

      const workingKey = `office-agent-${agent.id}-working`;
      if (!this.anims.exists(workingKey)) this.anims.create({
        key: workingKey, frames: workingFrames(agent.id).map(frame => ({ key: AGENT_LIFECYCLE_TEXTURE, frame })),
        frameRate: WORKING_FRAME_RATE, repeat: -1,
      });

      const sprite = this.add.sprite(anchor.x, anchor.y, MOCK_AGENTS_TEXTURE)
        .setName(agent.id)
        .setOrigin(0.5, 1)
        .setScale(MOCK_AGENT_RENDER_SCALE)
        .setDepth(OFFICE_DEPTHS.futureAgents)
        .setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.POINTER_DOWN, () => this.onAgentSelected(agent.id));

      const label = this.add.text(anchor.x, anchor.y + 8, '', {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#302b29',
        backgroundColor: '#f5f1e9', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 0).setDepth(OFFICE_DEPTHS.futureAgents + 2).setVisible(false);

      this.agentSprites.set(agent.id, sprite);
      this.statusLabels.set(agent.id, label);
      const motion = createCharacterMotion(agent, sprite, label,
        (delay, callback) => this.time.delayedCall(delay, callback));
      this.motions.set(agent.id, motion);
      motion.apply(this.presentations.get(agent.id) ?? {
        id: agent.id, state: null, activity: null, visual: 'placeholder', live: false, reducedMotion: true,
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const motion of this.motions.values()) motion.dispose();
      this.motions.clear();
      this.agentSprites.clear();
      this.statusLabels.clear();
      this.presentations.clear();
      this.selectionIndicator = undefined;
    });
  }

  private updateSelectionIndicator(): void {
    const indicator = this.selectionIndicator;

    if (!indicator) {
      return;
    }

    indicator.clear();
    const selectedSprite = this.selectedAgentId
      ? this.agentSprites.get(this.selectedAgentId)
      : undefined;

    if (!selectedSprite) {
      return;
    }

    const x = selectedSprite.x - 23;
    const y = selectedSprite.y - 55;

    indicator.lineStyle(3, 0x302b29, 1);
    indicator.strokeRect(x, y, 46, 54);
    indicator.lineStyle(1, 0xf5e7c8, 1);
    indicator.strokeRect(x + 2, y + 2, 42, 50);
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
