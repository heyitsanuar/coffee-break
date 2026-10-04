import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createAgentStateStore } from '../agentState/store';
import { createOfficePresentationRuntime } from './officePresentationRuntime';
import { bindOfficePresentation } from './OfficeSceneHost';
import type { AgentStateMessage, TrustedAgentState } from '../../shared/agentState';

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      textures = { exists: vi.fn(() => true) };
      anims = { exists: vi.fn(() => false), create: vi.fn() };
      events = { once: vi.fn() };
      time = { delayedCall: vi.fn(() => ({ remove: vi.fn() })), addEvent: vi.fn(() => ({ remove: vi.fn() })) };
      add = { sprite: vi.fn(), text: vi.fn(), rectangle: vi.fn(() => ({ setStrokeStyle: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() })), graphics: vi.fn(() => graphics()) };
    },
    Input: { Events: { POINTER_DOWN: 'pointerdown' } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  },
}));

import { OfficeScene } from './OfficeScene';
import type { MockAgentId } from './mockAgents';
import type { OfficeAgentPresentation } from './officePresentation';

function presentation(id: MockAgentId, visual: OfficeAgentPresentation['visual']): OfficeAgentPresentation {
  return { id, state: visual === 'placeholder' ? null : visual === 'coffee' ? 'waiting' : visual,
    activity: visual === 'placeholder' ? null : 'Trusted activity', visual, live: true, reducedMotion: false };
}

function sprite() {
  const instance = {
    scene: {} as object | undefined,
    setName: vi.fn(), setOrigin: vi.fn(), setScale: vi.fn(), setDepth: vi.fn(),
    setInteractive: vi.fn(), on: vi.fn(), setTexture: vi.fn(), play: vi.fn(), stop: vi.fn(), setFrame: vi.fn(),
  };
  for (const key of ['setName', 'setOrigin', 'setScale', 'setDepth', 'setInteractive', 'on'] as const) {
    instance[key].mockReturnValue(instance);
  }
  return instance;
}

function label() {
  const instance = { setOrigin: vi.fn(), setDepth: vi.fn(), setVisible: vi.fn(), setText: vi.fn() };
  for (const key of ['setOrigin', 'setDepth', 'setVisible'] as const) instance[key].mockReturnValue(instance);
  return instance;
}

function graphics() {
  const instance = { scene: {} as object | undefined, commandBuffer: [] as number[],
    clear: vi.fn(), fillStyle: vi.fn(), fillRect: vi.fn(), setVisible: vi.fn(), setPosition: vi.fn(), setScale: vi.fn(), setDepth: vi.fn(),
    preDestroy() { this.commandBuffer = []; }, emit: vi.fn(), removeAllListeners: vi.fn(),
    removeFromDisplayList: vi.fn(), removeFromUpdateList: vi.fn(),
  };
  for (const key of ['clear', 'fillStyle', 'fillRect', 'setVisible', 'setPosition', 'setScale', 'setDepth'] as const) instance[key].mockReturnValue(instance);
  return instance;
}

function monitorScene(roomArtwork = true) {
  const scene = new OfficeScene();
  const internals = scene as unknown as {
    add: { sprite: ReturnType<typeof vi.fn>; text: ReturnType<typeof vi.fn>; graphics: ReturnType<typeof vi.fn> };
    time: { addEvent: ReturnType<typeof vi.fn>; delayedCall: ReturnType<typeof vi.fn> };
    events: { once: ReturnType<typeof vi.fn> };
    workstations: Map<MockAgentId, { dispose(): void }>;
    coffeeSteam?: { dispose(): void };
    presentations: Map<MockAgentId, unknown>; motions: Map<MockAgentId, unknown>;
    agentSprites: Map<MockAgentId, unknown>; statusLabels: Map<MockAgentId, unknown>;
    createMockAgents(artwork: boolean): void;
  };
  const sprites = [sprite(), sprite(), sprite()];
  sprites.forEach(item => internals.add.sprite.mockReturnValueOnce(item));
  sprites.forEach(() => { internals.add.text.mockReturnValueOnce(label()).mockReturnValueOnce(label()); });
  internals.createMockAgents(roomArtwork);
  const monitors = internals.add.graphics.mock.results.map(({ value }) => value as ReturnType<typeof graphics>);
  return { scene, internals, monitors: monitors.slice(0, 2), steam: monitors[2], sprites };
}

describe('OfficeScene presentation handoff', () => {
  it('completes shutdown after Phaser destroys sprites, including timers and controller ownership', () => {
    const GameObject = createRequire(import.meta.url)('phaser/src/gameobjects/GameObject') as typeof import('phaser').GameObjects.GameObject;
    const scene = new OfficeScene();
    const internals = scene as unknown as {
      add: { sprite: ReturnType<typeof vi.fn>; text: ReturnType<typeof vi.fn> };
      events: { once: ReturnType<typeof vi.fn> };
      time: { delayedCall: ReturnType<typeof vi.fn> };
      motions: Map<MockAgentId, { dispose(): void }>;
      agentSprites: Map<MockAgentId, unknown>;
      statusLabels: Map<MockAgentId, unknown>;
      presentations: Map<MockAgentId, unknown>;
      selectionIndicator?: unknown;
      createMockAgents(): void;
    };
    const sprites = [sprite(), sprite(), sprite()];
    const remove = vi.fn();
    let complete!: () => void;
    internals.time.delayedCall.mockImplementation((_delay, callback) => { complete = callback; return { remove }; });
    sprites.forEach(item => internals.add.sprite.mockReturnValueOnce(item));
    sprites.forEach(() => { internals.add.text.mockReturnValueOnce(label()).mockReturnValueOnce(label()); });
    internals.createMockAgents();
    scene.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'completed'));
    scene.acknowledge({ id: 'mock-agent-ari', state: 'completed', sequence: 1 });
    internals.selectionIndicator = {};
    const controllers = [...internals.motions.values()];

    for (const item of sprites) {
      // Match Sprite.stop/preDestroy semantics; use the installed GameObject.destroy ordering.
      const target = Object.assign(item, {
        anims: { stop: vi.fn() } as { stop(): void } | undefined,
        preDestroy() { this.anims = undefined; },
        emit: vi.fn(), removeAllListeners: vi.fn(),
        removeFromDisplayList: vi.fn(), removeFromUpdateList: vi.fn(),
      });
      item.stop.mockImplementation(() => target.anims!.stop());
      GameObject.prototype.destroy.call(target as unknown as import('phaser').GameObjects.GameObject, true);
      expect(target.scene).toBeUndefined();
      expect(() => item.stop()).toThrow(TypeError); // This seam cannot hide the reported failure.
    }

    const shutdown = internals.events.once.mock.calls.find(([event]) => event === 'shutdown')![1];
    expect(() => shutdown()).not.toThrow();
    expect(remove).toHaveBeenCalledOnce();
    for (const map of [internals.motions, internals.agentSprites, internals.statusLabels, internals.presentations]) expect(map.size).toBe(0);
    expect(internals.selectionIndicator).toBeUndefined();
    expect(() => { controllers.forEach(controller => controller.dispose()); shutdown(); complete(); }).not.toThrow();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('uses the latest pre-create value, then mutates only the target sprite and label', () => {
    const scene = new OfficeScene();
    const internals = scene as unknown as {
      add: { sprite: ReturnType<typeof vi.fn>; text: ReturnType<typeof vi.fn> };
      createMockAgents(): void;
    };
    const sprites = [sprite(), sprite(), sprite()];
    const labels = [label(), label(), label()];
    sprites.forEach((item) => internals.add.sprite.mockReturnValueOnce(item));
    labels.forEach((item) => internals.add.text.mockReturnValueOnce(label()).mockReturnValueOnce(item));

    scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'working'));
    scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'coffee'));
    internals.createMockAgents();

    expect(internals.add.sprite).toHaveBeenCalledTimes(3);
    expect(internals.add.text).toHaveBeenCalledTimes(6);
    expect(sprites[2].play).toHaveBeenCalledExactlyOnceWith('office-agent-mock-agent-sol', true);
    expect(labels[2].setText).toHaveBeenLastCalledWith('Coffee break');
    expect(labels[2].setText).not.toHaveBeenCalledWith('Working');

    sprites.forEach((item) => { item.play.mockClear(); item.stop.mockClear(); item.setFrame.mockClear(); });
    labels.forEach((item) => item.setText.mockClear());
    scene.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'completed'));
    expect(sprites[0].stop).toHaveBeenCalledOnce();
    expect(labels[0].setText).toHaveBeenCalledExactlyOnceWith('Completed');
    expect(sprites[1].stop).not.toHaveBeenCalled();
    expect(sprites[2].stop).not.toHaveBeenCalled();
    expect(labels[1].setText).not.toHaveBeenCalled();
    expect(labels[2].setText).not.toHaveBeenCalled();
    scene.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'completed'));
    expect(sprites[0].stop).toHaveBeenCalledOnce();
    expect(internals.add.sprite).toHaveBeenCalledTimes(3);
  });
});

describe('OfficeScene workstation integration', () => {
  it.each([true, false])('creates exactly two pixel-scaled overlays at the correct artwork=%s positions', artwork => {
    const { internals, monitors } = monitorScene(artwork);
    expect(internals.add.graphics).toHaveBeenCalledTimes(artwork ? 3 : 2);
    expect([...internals.workstations.keys()]).toEqual(['mock-agent-ari', 'mock-agent-mina']);
    expect(monitors[0].setPosition).toHaveBeenCalledWith(88, artwork ? 80 : 100);
    expect(monitors[1].setPosition).toHaveBeenCalledWith(272, artwork ? 80 : 100);
    for (const monitor of monitors) { expect(monitor.setScale).toHaveBeenCalledWith(2); expect(monitor.setDepth).toHaveBeenCalledWith(1); }
  });
  it('updates only the matching monitor, reuses objects, and sends the same Completed transition to character and monitor', () => {
    const { scene, internals, monitors, sprites } = monitorScene();
    monitors.forEach(monitor => monitor.clear.mockClear());
    scene.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'working'));
    expect(monitors[0].clear).toHaveBeenCalledOnce(); expect(monitors[1].clear).not.toHaveBeenCalled();
    monitors[0].clear.mockClear();
    scene.setAgentPresentation('mock-agent-mina', presentation('mock-agent-mina', 'completed'));
    expect(monitors[0].clear).not.toHaveBeenCalled(); expect(monitors[1].clear).toHaveBeenCalledOnce();
    const before = internals.time.addEvent.mock.calls.length;
    scene.acknowledge({ id: 'mock-agent-mina', state: 'completed', sequence: 1 });
    expect(sprites[1].setFrame).toHaveBeenCalledOnce(); expect(internals.time.delayedCall).toHaveBeenCalledWith(500, expect.any(Function));
    expect(internals.time.addEvent.mock.calls.slice(before)).toEqual([[expect.objectContaining({ delay: 500, loop: false })]]);
    scene.setSelectedAgent('mock-agent-mina');
    const counts = monitors.map(monitor => monitor.clear.mock.calls.length);
    scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'error'));
    scene.acknowledge({ id: 'mock-agent-sol', state: 'completed', sequence: 2 });
    expect(monitors.map(monitor => monitor.clear.mock.calls.length)).toEqual(counts);
    expect(internals.add.graphics).toHaveBeenCalledTimes(3);
  });
  it('finishes every cleanup after actual GameObject destruction precedes the scene listener', () => {
    const GameObject = createRequire(import.meta.url)('phaser/src/gameobjects/GameObject') as typeof import('phaser').GameObjects.GameObject;
    const f = monitorScene();
    const tasks: Array<{ callback: () => void; remove: ReturnType<typeof vi.fn> }> = [];
    f.internals.time.addEvent.mockImplementation(({ callback }) => { const task = { callback, remove: vi.fn() }; tasks.push(task); return task; });
    f.scene.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'working'));
    f.scene.setAgentPresentation('mock-agent-mina', presentation('mock-agent-mina', 'completed'));
    f.scene.acknowledge({ id: 'mock-agent-mina', state: 'completed', sequence: 1 });
    const controllers = [...f.internals.workstations.values()];
    for (const monitor of f.monitors) GameObject.prototype.destroy.call(monitor as unknown as import('phaser').GameObjects.GameObject, true);
    for (const sprite of f.sprites) {
      const target = Object.assign(sprite, { anims: { stop: vi.fn() } as { stop(): void } | undefined,
        preDestroy() { this.anims = undefined; }, emit: vi.fn(), removeAllListeners: vi.fn(), removeFromDisplayList: vi.fn(), removeFromUpdateList: vi.fn() });
      sprite.stop.mockImplementation(() => target.anims!.stop());
      GameObject.prototype.destroy.call(target as unknown as import('phaser').GameObjects.GameObject, true);
    }
    const counts = f.monitors.map(monitor => monitor.clear.mock.calls.length);
    const shutdown = f.internals.events.once.mock.calls.find(([event]) => event === 'shutdown')![1];
    expect(() => { shutdown(); shutdown(); controllers.forEach(controller => controller.dispose()); tasks.forEach(task => task.callback()); }).not.toThrow();
    for (const task of tasks) expect(task.remove).toHaveBeenCalledOnce();
    expect(f.monitors.map(monitor => monitor.clear.mock.calls.length)).toEqual(counts);
    for (const map of [f.internals.workstations, f.internals.motions, f.internals.agentSprites, f.internals.statusLabels, f.internals.presentations]) expect(map.size).toBe(0);
  });
  it('uses real store/runtime/host delivery: current, same-state, activity, reason, restoration and remount stay settled', async () => {
    let emit!: (message: AgentStateMessage) => void;
    const store = createAgentStateStore({ watch(fn) { emit = fn; return { ready: Promise.resolve(), close() {} }; } });
    const runtime = createOfficePresentationRuntime(store, { matches: false, addEventListener() {}, removeEventListener() {} });
    const f = monitorScene();
    const bind = (scene: OfficeScene) => bindOfficePresentation(runtime, {
      setAgentPresentation: (id, value) => scene.setAgentPresentation(id, value),
      acknowledge: value => scene.acknowledge(value), setSelectedAgent: id => scene.setSelectedAgent(id), destroy() {},
    });
    const unbind = bind(f.scene);
    await store.start();
    let value: TrustedAgentState = { revision: 1, sessionId: 'session-1', phase: 'ready', agents: ['Ari', 'Mina', 'Sol'].map(name => ({
      agent: { id: `mock-agent-${name.toLowerCase()}`, displayName: name }, state: 'completed', activity: 'Trusted fixture',
    })) };
    const event = (state: 'working' | 'completed', activity = 'Changed', reason?: 'approval_required') => {
      const agent = { ...value.agents![0], state, activity, ...(reason ? { reason } : {}) };
      value = { ...value, revision: value.revision + 1, agents: [agent, ...value.agents!.slice(1)] };
      emit({ kind: 'change', change: { kind: 'event', state: value, agent } });
    };
    emit({ kind: 'current', state: value }); event('completed'); event('completed', 'Activity-only'); event('completed', 'Reason-only', 'approval_required');
    f.scene.setSelectedAgent('mock-agent-ari');
    value = { ...value, revision: value.revision + 1, sessionId: 'session-2' };
    emit({ kind: 'change', change: { kind: 'snapshot', state: value } });
    expect(f.internals.time.addEvent).not.toHaveBeenCalled();
    event('working'); event('completed');
    expect(f.internals.time.addEvent.mock.calls.map(([config]) => config.delay)).toEqual([1200, 500]);
    const remount = monitorScene(); const detach = bind(remount.scene);
    expect(remount.internals.time.addEvent).not.toHaveBeenCalled();
    expect(remount.monitors[0].fillRect).toHaveBeenLastCalledWith(7, 6, 6, 1);
    unbind(); detach(); runtime.dispose(); store.stop();
  });
});

// Steam receives only the existing presentation discriminant, never a second activity matcher.
describe('OfficeScene contextual mug integration', () => {
  it('creates exactly one artwork steam overlay at measured source-scaled coordinates, reused across episodes', () => {
    const f = monitorScene();
    expect(f.steam.setPosition).toHaveBeenCalledWith(574, 192);
    expect(f.steam.setScale).toHaveBeenCalledWith(2); expect(f.steam.setDepth).toHaveBeenCalledWith(1);
    expect(f.steam.setVisible).toHaveBeenLastCalledWith(false);
    f.scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'coffee'));
    expect(f.steam.setVisible).toHaveBeenLastCalledWith(true);
    expect(f.sprites[2].play).toHaveBeenLastCalledWith('office-agent-mock-agent-sol', true);
    expect(f.internals.time.addEvent).toHaveBeenCalledWith(expect.objectContaining({ delay: 1600, loop: true }));
    f.scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'working'));
    expect(f.steam.setVisible).toHaveBeenLastCalledWith(false);
    expect(f.sprites[2].play).toHaveBeenLastCalledWith('office-agent-mock-agent-sol-working', true);
    f.scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'coffee'));
    expect(f.internals.add.graphics).toHaveBeenCalledTimes(3);
  });
  it('fallback creates no steam controller/object, even with coffee presentation', () => {
    const f = monitorScene(false);
    f.scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'coffee'));
    expect(f.steam).toBeUndefined(); expect(f.internals.coffeeSteam).toBeUndefined();
    expect(f.internals.add.graphics).toHaveBeenCalledTimes(2); expect(f.internals.time.addEvent).not.toHaveBeenCalled();
    expect(f.sprites[2].play).toHaveBeenLastCalledWith('office-agent-mock-agent-sol', true);
  });
  it('ignores selection, acknowledgements, redundant Sol updates and other identities without restarting', () => {
    const f = monitorScene();
    f.scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'coffee'));
    const count = f.steam.clear.mock.calls.length;
    f.scene.setSelectedAgent('mock-agent-sol');
    f.scene.acknowledge({ id: 'mock-agent-sol', state: 'completed', sequence: 1 });
    f.scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'coffee'));
    f.scene.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'waiting'));
    f.scene.setAgentPresentation('mock-agent-mina', presentation('mock-agent-mina', 'error'));
    expect(f.steam.clear).toHaveBeenCalledTimes(count); expect(f.internals.time.addEvent).toHaveBeenCalledOnce();
  });
  it('rapid coffee supersession removes steam in the same update and rejects late callbacks', () => {
    const f = monitorScene(); const remove = vi.fn(); let stale!: () => void;
    f.internals.time.addEvent.mockImplementation(({ callback }) => { stale = callback; return { remove }; });
    f.scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'coffee'));
    f.scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'waiting'));
    expect(f.sprites[2].stop).toHaveBeenCalled(); expect(f.steam.setVisible).toHaveBeenLastCalledWith(false);
    const count = f.steam.clear.mock.calls.length; stale();
    expect(f.steam.clear).toHaveBeenCalledTimes(count); expect(remove).toHaveBeenCalledOnce();
  });
  it('clears ownership/timer without Graphics mutation after installed Phaser destroys the steam object', () => {
    const GameObject = createRequire(import.meta.url)('phaser/src/gameobjects/GameObject') as typeof import('phaser').GameObjects.GameObject;
    const f = monitorScene(); const remove = vi.fn(); let stale!: () => void;
    f.internals.time.addEvent.mockImplementation(({ callback }) => { stale = callback; return { remove }; });
    f.scene.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol', 'coffee'));
    const controller = f.internals.coffeeSteam!;
    GameObject.prototype.destroy.call(f.steam as unknown as import('phaser').GameObjects.GameObject, true);
    expect(f.steam.scene).toBeUndefined();
    f.steam.clear.mockImplementation(() => { throw new Error('draw after destroyed'); });
    f.steam.setVisible.mockImplementation(() => { throw new Error('visibility after destroyed'); });
    const shutdown = f.internals.events.once.mock.calls.find(([event]) => event === 'shutdown')![1];
    expect(() => { shutdown(); shutdown(); controller.dispose(); stale(); }).not.toThrow();
    expect(remove).toHaveBeenCalledOnce(); expect(f.internals.coffeeSteam).toBeUndefined();
    for (const map of [f.internals.workstations, f.internals.motions, f.internals.presentations, f.internals.agentSprites, f.internals.statusLabels]) expect(map.size).toBe(0);
  });
  it('real store/runtime/host delivery preserves live phase, retains static coffee, restores and remounts from A', async () => {
    let emit!: (message: AgentStateMessage) => void;
    const store = createAgentStateStore({ watch(fn) { emit = fn; return { ready: Promise.resolve(), close() {} }; } });
    const runtime = createOfficePresentationRuntime(store, { matches: false, addEventListener() {}, removeEventListener() {} });
    const f = monitorScene();
    const bind = (scene: OfficeScene) => bindOfficePresentation(runtime, {
      setAgentPresentation: (id, value) => scene.setAgentPresentation(id, value), acknowledge: value => scene.acknowledge(value),
      setSelectedAgent: id => scene.setSelectedAgent(id), destroy() {},
    });
    const detach = bind(f.scene); await store.start();
    const value: TrustedAgentState = { revision: 1, sessionId: 'coffee-session', phase: 'ready', agents: [
      { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle', activity: 'Ready' },
      { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'idle', activity: 'Ready' },
      { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting', activity: 'Taking a coffee break in the simulated office' },
    ] };
    emit({ kind: 'current', state: value });
    const initial = f.steam.fillRect.mock.calls.slice(-4);
    const [config] = f.internals.time.addEvent.mock.calls[0]; config.callback();
    const b = f.steam.fillRect.mock.calls.slice(-4); expect(b).not.toEqual(initial);
    emit({ kind: 'change', change: { kind: 'snapshot', state: value } });
    expect(f.steam.fillRect.mock.calls.slice(-4)).toEqual(b); expect(f.internals.time.addEvent).toHaveBeenCalledOnce();
    emit({ kind: 'change', change: { kind: 'connection', state: { ...value, phase: 'disconnected' } } });
    expect(f.steam.fillRect.mock.calls.slice(-4)).toEqual(initial);
    emit({ kind: 'change', change: { kind: 'snapshot', state: { ...value, revision: 2, sessionId: 'restored-session' } } });
    expect(f.steam.fillRect.mock.calls.slice(-4)).toEqual(initial); expect(f.internals.time.addEvent).toHaveBeenCalledTimes(2);
    const remount = monitorScene(); const detachRemount = bind(remount.scene);
    expect(remount.steam.fillRect.mock.calls.slice(-4)).toEqual(initial);
    expect(remount.internals.time.addEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ delay: 1600, loop: true }));
    detach(); detachRemount(); runtime.dispose(); store.stop();
  });
});

it('keeps all persistent nameplates independent of lifecycle, freshness and reduced motion', () => {
  const f = monitorScene();
  const calls = f.internals.add.text.mock.calls;
  expect(calls.filter(([, , text]) => ['Ari', 'Mina', 'Sol'].includes(text)).map(([, , text]) => text)).toEqual(['Ari', 'Mina', 'Sol']);
  const names = [0, 2, 4].map(index => f.internals.add.text.mock.results[index].value as ReturnType<typeof label>);
  for (const visual of ['idle', 'working', 'waiting', 'completed', 'error', 'coffee'] as const) {
    f.scene.setAgentPresentation('mock-agent-sol', { ...presentation('mock-agent-sol', visual), live: false, reducedMotion: true });
  }
  for (const name of names) {
    expect(name.setText).not.toHaveBeenCalled();
    expect(name.setVisible).not.toHaveBeenCalled();
  }
  const solLabel = f.internals.add.text.mock.results[5].value as ReturnType<typeof label>;
  expect(solLabel.setText).toHaveBeenLastCalledWith('Coffee break');
});

it('forwards direct sprite identity and draws only the existing static double outline', () => {
  const callback = vi.fn();
  const scene = new OfficeScene(callback);
  const internal = scene as unknown as {
    add: { sprite: ReturnType<typeof vi.fn>; text: ReturnType<typeof vi.fn> };
    createMockAgents(): void;
    selectionIndicator: { clear: ReturnType<typeof vi.fn>; lineStyle: ReturnType<typeof vi.fn>; strokeRect: ReturnType<typeof vi.fn> };
  };
  const sprites = [sprite(), sprite(), sprite()];
  Object.assign(sprites[0], { x: 136, y: 248 });
  for (const item of sprites) internal.add.sprite.mockReturnValueOnce(item);
  sprites.forEach(() => internal.add.text.mockReturnValueOnce(label()).mockReturnValueOnce(label()));
  internal.createMockAgents();
  const pointer = sprites[0].on.mock.calls.find(([event]) => event === 'pointerdown')![1] as () => void;
  pointer();
  expect(callback).toHaveBeenCalledExactlyOnceWith('mock-agent-ari');
  internal.selectionIndicator = { clear: vi.fn(), lineStyle: vi.fn(), strokeRect: vi.fn() };
  scene.setSelectedAgent('mock-agent-ari');
  expect(internal.selectionIndicator.strokeRect.mock.calls).toEqual([[113, 193, 46, 54], [115, 195, 42, 50]]);
  scene.setSelectedAgent(null);
  expect(internal.selectionIndicator.clear).toHaveBeenCalledTimes(2);
});
