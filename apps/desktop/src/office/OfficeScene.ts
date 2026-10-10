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
import { agentFreshness, type OfficeAgentPresentation } from './officePresentation';
import { createWorkstationMotion, getWorkstationGeometry } from './workstationPresentation';
import { createCoffeeSteamMotion } from './coffeeSteamPresentation';

export { OFFICE_SCENE_HEIGHT, OFFICE_SCENE_WIDTH } from './officeLayout';

const OFFICE_BACKGROUND_TEXTURE = 'office-room-background';
const OFFICE_FOREGROUND_TEXTURE = 'office-room-foreground';
const MOCK_AGENTS_TEXTURE = 'mock-agents';
const PLAQUE_POSITIONS: Record<MockAgentId, readonly [number, number]> = {
  'mock-agent-ari': [234, 184], 'mock-agent-mina': [316, 250], 'mock-agent-sol': [176, 292],
};

export class OfficeScene extends Phaser.Scene {
  private readonly agentSprites = new Map<MockAgentId, Phaser.GameObjects.Sprite>();
  private readonly statusLabels = new Map<MockAgentId, Phaser.GameObjects.Text>();
  private readonly plaques = new Map<MockAgentId, Phaser.GameObjects.Graphics>();
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
    this.drawPlaque(agentId);
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

    for (const [text, y, width] of [['Meeting Room', 40, 120], ['Focus Room', 212, 104]] as const) {
      this.add.rectangle(544, y, width, 24, 0x101d2b).setDepth(12);
      this.add.text(544, y, text, {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#e8edf6',
      }).setOrigin(0.5).setDepth(12);
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

      const [plaqueX, plaqueY] = PLAQUE_POSITIONS[agent.id];
      this.plaques.set(agent.id, this.add.graphics().setName(`office-plaque-${agent.id}`)
        .setPosition(plaqueX, plaqueY).setDepth(12));
      this.add.text(plaqueX + 22, plaqueY + 4, agent.displayName, {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#e8edf6',
      }).setOrigin(0).setDepth(12);

      const label = this.add.text(plaqueX + 8, plaqueY + 18, 'No state', {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#a4b5ca',
      }).setOrigin(0).setDepth(12);

      this.agentSprites.set(agent.id, sprite);
      this.statusLabels.set(agent.id, label);
      // Motion owns only the context line; missing lifecycle never hides persistent identity/freshness.
      const motion = createCharacterMotion(agent, sprite, {
        setText: value => label.setText(value || 'No state'), setVisible: () => label,
      },
        (delay, callback) => this.time.delayedCall(delay, callback));
      this.motions.set(agent.id, motion);
      const presentation: OfficeAgentPresentation = this.presentations.get(agent.id) ?? {
        id: agent.id, state: null, activity: null, visual: 'placeholder', live: false, reducedMotion: true,
      };
      motion.apply(presentation);
      this.drawPlaque(agent.id);

      if (agent.id === 'mock-agent-sol') {
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
      this.plaques.clear();
      this.presentations.clear();
      this.selectionIndicator = undefined;
    });
  }

  private updateSelectionIndicator(): void {
    for (const id of this.plaques.keys()) this.drawPlaque(id);
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

  private drawPlaque(id: MockAgentId): void {
    const plaque = this.plaques.get(id);
    if (!plaque) return;
    const background = 0x101d2b;
    plaque.clear().fillStyle(background, 1).fillRect(0, 0, 88, 36);
    plaque.fillStyle(this.selectedAgentId === id ? 0xd8ad85 : 0x637d99, 1);
    // Filled strips keep every painted border pixel inside the approved rectangle.
    for (const [x, y, w, h] of [[0, 0, 88, 2], [0, 34, 88, 2], [0, 2, 2, 32], [86, 2, 2, 32]]) plaque.fillRect(x, y, w, h);
    const presentation = this.presentations.get(id);
    const freshness = presentation ? agentFreshness(presentation) : 'no-state';
    plaque.fillStyle(freshness === 'current' ? 0x3ddc97 : 0xa4b5ca, 1);
    for (const [x, y, w, h] of [[10, 6, 4, 2], [8, 8, 8, 4], [10, 12, 4, 2]]) plaque.fillRect(x, y, w, h);
    if (freshness !== 'current') {
      plaque.fillStyle(background, 1).fillRect(freshness === 'last-known' ? 12 : 10, 8, freshness === 'last-known' ? 2 : 4, 4);
    }
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
    for (const [deskX, deskY] of [[260, 116], [328, 182]]) {
      room.fillStyle(0xe4ad65);
      room.fillRect(deskX, deskY, 108, 44);
      room.fillStyle(0x283044);
      room.fillRect(deskX + 52, deskY - 18, 48, 28);
      room.fillRect(deskX + 14, deskY + 24, 36, 42);
    }
    room.fillStyle(0x34425a);
    room.fillRect(230, 260, 18, 8);
    room.fillStyle(0xb3b7c1);
    room.fillRect(230, 260, 18, 2);
    room.fillStyle(0x8ca57b);
    room.fillRect(234, 260, 8, 8);
    room.fillRect(242, 262, 4, 4);
    room.fillStyle(0xfbebc9);
    room.fillRect(234, 260, 8, 2);
    room.fillStyle(0x775743);
    room.fillRect(236, 262, 4, 2);
    room.fillStyle(0x8991b0);
    room.fillRect(464, 20, 160, 160);
    room.fillRect(464, 196, 160, 136);
    room.fillStyle(0x283044);
    room.fillRect(456, 20, 8, 312);
    room.fillRect(464, 180, 160, 16);
    room.fillStyle(0xdfa35c);
    room.fillRect(498, 90, 92, 40);
    room.fillRect(512, 264, 78, 36);
    room.fillStyle(0x42587c);
    for (const x of [506, 554]) {
      room.fillRect(x, 68, 28, 26);
      room.fillRect(x, 128, 28, 38);
    }
    room.fillRect(530, 296, 28, 30);
    room.fillStyle(0x283044);
    room.fillRect(524, 244, 40, 24);
    room.lineStyle(4, 0x283044);
    room.strokeRect(8, 8, OFFICE_SCENE_WIDTH - 16, OFFICE_SCENE_HEIGHT - 16);
  }
}
