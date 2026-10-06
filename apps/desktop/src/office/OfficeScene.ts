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
import { createWorkstationMotion, getWorkstationGeometry } from './workstationPresentation';
import { createCoffeeSteamMotion } from './coffeeSteamPresentation';

export { OFFICE_SCENE_HEIGHT, OFFICE_SCENE_WIDTH } from './officeLayout';

const OFFICE_BACKGROUND_TEXTURE = 'office-room-background';
const OFFICE_FOREGROUND_TEXTURE = 'office-room-foreground';
const MOCK_AGENTS_TEXTURE = 'mock-agents';

export class OfficeScene extends Phaser.Scene {
  private readonly agentSprites = new Map<MockAgentId, Phaser.GameObjects.Sprite>();
  private readonly statusLabels = new Map<MockAgentId, Phaser.GameObjects.Text>();
  private readonly presentations = new Map<MockAgentId, OfficeAgentPresentation>();
  private readonly motions = new Map<MockAgentId, ReturnType<typeof createCharacterMotion>>();
  private readonly workstations = new Map<MockAgentId, ReturnType<typeof createWorkstationMotion>>();
  private coffeeSteam?: ReturnType<typeof createCoffeeSteamMotion>;
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
    this.workstations.get(agentId)?.apply(presentation);
    if (agentId === 'mock-agent-sol') this.coffeeSteam?.apply(presentation);
  }

  acknowledge(value: OfficeAcknowledgement): void {
    this.motions.get(value.id)?.acknowledge(value);
    this.workstations.get(value.id)?.acknowledge(value);
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

    this.createMockAgents(roomTexturesAvailable);
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

  private createMockAgents(roomArtwork = true): void {
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
        .setInteractive({
          useHandCursor: true,
          // Input is frame-local before bottom-center origin and integer display scale.
          hitArea: new Phaser.Geom.Rectangle(
            MOCK_AGENT_FRAME_WIDTH / 2 + (anchor.clearance.x - anchor.x) / MOCK_AGENT_RENDER_SCALE,
            MOCK_AGENT_FRAME_HEIGHT + (anchor.clearance.y - anchor.y) / MOCK_AGENT_RENDER_SCALE,
            anchor.clearance.width / MOCK_AGENT_RENDER_SCALE,
            anchor.clearance.height / MOCK_AGENT_RENDER_SCALE,
          ),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        })
        .on(Phaser.Input.Events.POINTER_DOWN, () => this.onAgentSelected(agent.id));

      // Ordinary scene-owned objects: identity stays visible independently of lifecycle/freshness.
      this.add.rectangle(anchor.x, anchor.y - 66, 44, 18, 0xf5e7c8)
        .setStrokeStyle(1, 0x5b3a2e).setDepth(OFFICE_DEPTHS.futureAgents + 2);
      this.add.text(anchor.x, anchor.y - 66, agent.displayName, {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#302b29',
      }).setOrigin(0.5).setDepth(OFFICE_DEPTHS.futureAgents + 2);

      const label = this.add.text(anchor.x, anchor.y + 8, '', {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#625a56',
        backgroundColor: '#f5f1e9', padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 0).setDepth(OFFICE_DEPTHS.futureAgents + 2).setVisible(false);

      this.agentSprites.set(agent.id, sprite);
      this.statusLabels.set(agent.id, label);
      const motion = createCharacterMotion(agent, sprite, label,
        (delay, callback) => this.time.delayedCall(delay, callback));
      this.motions.set(agent.id, motion);
      const presentation: OfficeAgentPresentation = this.presentations.get(agent.id) ?? {
        id: agent.id, state: null, activity: null, visual: 'placeholder', live: false, reducedMotion: true,
      };
      motion.apply(presentation);

      if (roomArtwork && agent.id === 'mock-agent-sol') {
        const steam = this.add.graphics().setPosition(230, 248)
          .setScale(OFFICE_ART_SCALE).setDepth(OFFICE_DEPTHS.background + 1).setVisible(false);
        this.coffeeSteam = createCoffeeSteamMotion(steam,
          (delay, callback) => this.time.addEvent({ delay, callback, loop: true }));
        this.coffeeSteam.apply(presentation);
      }

      const inset = getWorkstationGeometry(agent.id, roomArtwork);
      if (inset) {
        const graphics = this.add.graphics().setPosition(inset.x, inset.y)
          .setScale(OFFICE_ART_SCALE).setDepth(OFFICE_DEPTHS.background + 1);
        const workstation = createWorkstationMotion(agent.id, graphics,
          (delay, callback, loop = false) => this.time.addEvent({ delay, callback, loop }));
        this.workstations.set(agent.id, workstation);
        workstation.apply(presentation);
      }
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.coffeeSteam?.dispose();
      this.coffeeSteam = undefined;
      for (const workstation of this.workstations.values()) workstation.dispose();
      this.workstations.clear();
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

    // Simple geometry only: same zones, anchors and monitor insets as the authored sheets.
    room.fillStyle(0xcc894f);
    room.fillRect(0, 0, OFFICE_SCENE_WIDTH, OFFICE_SCENE_HEIGHT);
    room.fillStyle(0x626b94);
    room.fillRect(0, 0, OFFICE_SCENE_WIDTH, 54);
    room.fillRect(0, 0, 16, OFFICE_SCENE_HEIGHT);
    room.fillRect(624, 0, 16, OFFICE_SCENE_HEIGHT);
    room.fillRect(0, 336, OFFICE_SCENE_WIDTH, 24);
    room.fillStyle(0x4b576e);
    room.fillRect(24, 94, 184, 100);
    room.fillStyle(0xb74f82);
    room.fillRect(80, 84, 96, 40);
    room.fillStyle(0x8590b0);
    room.fillRect(16, 198, 226, 132);
    room.fillStyle(0x4b576e);
    room.fillRect(20, 216, 180, 72);
    for (const deskX of [260, 448]) {
      room.fillStyle(0xe4ad65);
      room.fillRect(deskX, 116, 104, 36);
      room.fillStyle(0x283044);
      room.fillRect(deskX + 52, 98, 48, 28);
      room.fillRect(deskX + 18, 140, 30, 34);
    }
    room.lineStyle(4, 0x283044);
    room.strokeRect(8, 8, OFFICE_SCENE_WIDTH - 16, OFFICE_SCENE_HEIGHT - 16);
  }
}
