import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { OfficeAgentPresentation } from './officePresentation';
import { createWorkstationMotion, getWorkstationGeometry, workstationMarks } from './workstationPresentation';

const presentation = (state: OfficeAgentPresentation['state'], live = true, reducedMotion = false): OfficeAgentPresentation => ({
  id: 'mock-agent-ari', state, visual: state ?? 'placeholder', activity: 'Trusted activity', live, reducedMotion,
});
function fixture() {
  const graphics = { scene: {} as object | undefined, clear: vi.fn(), fillStyle: vi.fn(), fillRect: vi.fn() };
  const tasks: Array<{ delay: number; loop: boolean; callback: () => void; remove: ReturnType<typeof vi.fn> }> = [];
  const motion = createWorkstationMotion('mock-agent-ari', graphics, (delay, callback, loop = false) => {
    const task = { delay, callback, loop, remove: vi.fn() }; tasks.push(task); return task;
  });
  const draw = () => graphics.fillRect.mock.calls.slice(-workstationMarks('working').length);
  return { graphics, tasks, motion, draw };
}

describe('bounded monitor geometry and vocabulary', () => {
  it('binds Ari/Mina by identity and existing anchors, with no Sol monitor', () => {
    expect(getWorkstationGeometry('mock-agent-ari', true)).toEqual({ x: 316, y: 102, width: 40, height: 16 });
    expect(getWorkstationGeometry('mock-agent-mina', true)).toEqual({ x: 504, y: 102, width: 40, height: 16 });
    expect(getWorkstationGeometry('mock-agent-sol', true)).toBeUndefined();
    expect(getWorkstationGeometry('mock-agent-sol', false)).toBeUndefined();
  });
  it.each(['mock-agent-ari', 'mock-agent-mina'] as const)('%s fallback inset stays inside its fallback monitor', id => {
    const inset = getWorkstationGeometry(id, false)!;
    const outer = { x: id === 'mock-agent-ari' ? 312 : 500, y: 98, width: 48, height: 28 };
    expect(inset.y).toBe(102);
    expect(inset.x).toBeGreaterThanOrEqual(outer.x); expect(inset.y).toBeGreaterThanOrEqual(outer.y);
    expect(inset.x + inset.width).toBeLessThanOrEqual(outer.x + outer.width);
    expect(inset.y + inset.height).toBeLessThanOrEqual(outer.y + outer.height);
  });
  it('keeps every static/alternate/widened source rectangle inside both 20 × 8 insets', () => {
    for (const state of ['idle', 'working', 'waiting', 'completed', 'error'] as const) {
      for (const frame of ['stable', 'working-alternate', 'completed-widened'] as const) {
        for (const { x, y, width, height } of workstationMarks(state, frame)) {
          expect([x, y, width, height].every(Number.isInteger)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
          expect(width).toBeGreaterThan(0); expect(height).toBeGreaterThan(0);
          expect(x + width).toBeLessThanOrEqual(20); expect(y + height).toBeLessThanOrEqual(8);
        }
      }
    }
  });
  it('uses quiet Idle, unequal diagonal Working, equal separated Waiting and different open/closed outlines', () => {
    expect(workstationMarks('idle')).toEqual([]); expect(workstationMarks(null)).toEqual([]);
    const [a, b] = workstationMarks('working');
    expect(a.width).not.toBe(b.width); expect(a.y).not.toBe(b.y);
    const [left, right] = workstationMarks('waiting');
    expect(left.width).toBe(left.height); expect(right.width).toBe(left.width); expect(right.height).toBe(left.height);
    expect(left.y).toBe(right.y); expect(left.x + left.width).toBeLessThan(right.x);
    expect(workstationMarks('completed')).toHaveLength(3);
    expect(workstationMarks('error')).not.toEqual(workstationMarks('completed'));
    expect(workstationMarks('completed', 'completed-widened')[0].x).toBe(workstationMarks('completed')[0].x - 1);
    expect(workstationMarks('completed', 'completed-widened')[1].x).toBe(workstationMarks('completed')[1].x + 1);
  });
  it.each(['idle', 'working', 'waiting', 'completed', 'error'] as const)('draws intentional static %s without scheduling while reduced', state => {
    const f = fixture(); f.motion.apply(presentation(state, true, true));
    expect(f.graphics.fillRect.mock.calls).toEqual([[0, 0, 20, 8], ...workstationMarks(state).map(r => [r.x, r.y, r.width, r.height])]);
    expect(f.tasks).toHaveLength(0);
  });
});

describe('monitor cosmetic lifetime', () => {
  it('starts stable Working, cycles every 1200 ms, and ignores activity/reason-only updates', () => {
    const f = fixture(); f.motion.apply(presentation('working'));
    expect(f.draw()).toEqual(workstationMarks('working').map(r => [r.x, r.y, r.width, r.height]));
    expect(f.tasks[0]).toMatchObject({ delay: 1200, loop: true });
    f.tasks[0].callback(); expect(f.draw()).toEqual(workstationMarks('working', 'working-alternate').map(r => [r.x, r.y, r.width, r.height]));
    const calls = f.graphics.clear.mock.calls.length;
    f.motion.apply({ ...presentation('working'), activity: 'Changed', reason: 'approval_required' });
    expect(f.graphics.clear).toHaveBeenCalledTimes(calls); expect(f.tasks).toHaveLength(1);
    f.tasks[0].callback(); expect(f.draw()).toEqual(workstationMarks('working').map(r => [r.x, r.y, r.width, r.height]));
  });
  it.each(['waiting', 'completed', 'error'] as const)('%s immediately cancels Working and rejects its stale callback', state => {
    const f = fixture(); f.motion.apply(presentation('working')); f.motion.apply(presentation(state));
    expect(f.tasks[0].remove).toHaveBeenCalledOnce();
    const calls = f.graphics.clear.mock.calls.length; f.tasks[0].callback();
    expect(f.graphics.clear).toHaveBeenCalledTimes(calls); expect(f.tasks).toHaveLength(1);
  });
  it.each(['retained', 'reduced'] as const)('%s Working always settles to the intentional frame and only live permitted work resumes', policy => {
    const f = fixture(); f.motion.apply(presentation('working')); f.tasks[0].callback();
    f.motion.apply(presentation('working', policy !== 'retained', policy === 'reduced'));
    expect(f.tasks[0].remove).toHaveBeenCalledOnce();
    expect(f.draw()).toEqual(workstationMarks('working').map(r => [r.x, r.y, r.width, r.height]));
    f.motion.apply(presentation('working', false, false)); expect(f.tasks).toHaveLength(1);
    f.motion.apply(presentation('working')); expect(f.tasks).toHaveLength(2);
  });
  it('widens eligible Completed once for 500 ms, settles, and never manufactures or replays it', () => {
    const f = fixture(); f.motion.apply(presentation('completed'));
    f.motion.apply({ ...presentation('completed'), activity: 'Changed' }); expect(f.tasks).toHaveLength(0);
    const token = { id: 'mock-agent-ari' as const, state: 'completed' as const, sequence: 1 };
    f.motion.acknowledge(token); f.motion.acknowledge(token);
    expect(f.tasks).toHaveLength(1); expect(f.tasks[0]).toMatchObject({ delay: 500, loop: false });
    expect(f.graphics.fillRect.mock.calls.slice(-3)).toEqual(workstationMarks('completed', 'completed-widened').map(r => [r.x, r.y, r.width, r.height]));
    f.tasks[0].callback(); expect(f.graphics.fillRect.mock.calls.slice(-3)).toEqual(workstationMarks('completed').map(r => [r.x, r.y, r.width, r.height]));
    f.motion.apply(presentation('completed', false)); f.motion.apply(presentation('completed'));
    f.motion.apply(presentation('completed', true, true)); f.motion.apply(presentation('completed')); f.motion.acknowledge(token);
    expect(f.tasks).toHaveLength(1);
  });
  it.each(['lifecycle', 'retained', 'reduced', 'dispose'] as const)('%s supersedes widening; late completion is harmless', reason => {
    const f = fixture(); f.motion.apply(presentation('completed'));
    f.motion.acknowledge({ id: 'mock-agent-ari', state: 'completed', sequence: 1 });
    if (reason === 'dispose') f.motion.dispose();
    else f.motion.apply(presentation(reason === 'lifecycle' ? 'waiting' : 'completed', reason !== 'retained', reason === 'reduced'));
    expect(f.tasks[0].remove).toHaveBeenCalledOnce();
    const calls = f.graphics.clear.mock.calls.length; f.tasks[0].callback(); expect(f.graphics.clear).toHaveBeenCalledTimes(calls);
  });
  it('does not animate Error, reduced/retained Completed, or another identity', () => {
    const f = fixture(); f.motion.apply(presentation('error')); f.motion.acknowledge({ id: 'mock-agent-ari', state: 'error', sequence: 1 });
    f.motion.apply(presentation('completed', false)); f.motion.acknowledge({ id: 'mock-agent-ari', state: 'completed', sequence: 2 });
    f.motion.apply(presentation('completed', true, true)); f.motion.acknowledge({ id: 'mock-agent-ari', state: 'completed', sequence: 3 });
    const calls = f.graphics.clear.mock.calls.length;
    f.motion.apply({ ...presentation('working'), id: 'mock-agent-mina' });
    f.motion.acknowledge({ id: 'mock-agent-sol', state: 'completed', sequence: 4 });
    expect(f.graphics.clear).toHaveBeenCalledTimes(calls); expect(f.tasks).toHaveLength(0);
  });
  it.each(['working', 'completed'] as const)('disposes %s safely after installed Phaser GameObject destruction and ignores all late work', state => {
    const GameObject = createRequire(import.meta.url)('phaser/src/gameobjects/GameObject') as typeof import('phaser').GameObjects.GameObject;
    const f = fixture(); f.motion.apply(presentation(state));
    if (state === 'completed') f.motion.acknowledge({ id: 'mock-agent-ari', state: 'completed', sequence: 1 });
    const target = Object.assign(f.graphics, { commandBuffer: [] as number[], preDestroy() { this.commandBuffer = []; },
      emit: vi.fn(), removeAllListeners: vi.fn(), removeFromDisplayList: vi.fn(), removeFromUpdateList: vi.fn() });
    GameObject.prototype.destroy.call(target as unknown as import('phaser').GameObjects.GameObject, true);
    expect(target.scene).toBeUndefined(); const calls = f.graphics.clear.mock.calls.length;
    expect(() => { f.motion.dispose(); f.motion.dispose(); f.tasks[0].callback(); f.motion.apply(presentation('working')); }).not.toThrow();
    expect(f.tasks[0].remove).toHaveBeenCalledOnce(); expect(f.graphics.clear).toHaveBeenCalledTimes(calls);
  });
});
