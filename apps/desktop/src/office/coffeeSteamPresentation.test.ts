import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createCoffeeSteamMotion } from './coffeeSteamPresentation';
import type { OfficeAgentPresentation } from './officePresentation';

const presentation = (visual: OfficeAgentPresentation['visual'] = 'coffee', live = true, reducedMotion = false): OfficeAgentPresentation => ({
  id: 'mock-agent-sol', state: visual === 'placeholder' ? null : visual === 'coffee' ? 'waiting' : visual,
  visual, activity: 'Already-derived presentation', live, reducedMotion,
});
function fixture() {
  let marks: number[][] = [];
  const graphics = { scene: {} as object | undefined,
    clear: vi.fn(() => { marks = []; }), setVisible: vi.fn(), fillStyle: vi.fn(),
    fillRect: vi.fn((...rect: number[]) => { marks.push(rect); }),
  };
  const tasks: Array<{ delay: number; callback: () => void; remove: ReturnType<typeof vi.fn> }> = [];
  const motion = createCoffeeSteamMotion(graphics, (delay, callback) => {
    const interval = setInterval(callback, delay);
    const task = { delay, callback, remove: vi.fn(() => clearInterval(interval)) }; tasks.push(task); return task;
  });
  return { graphics, tasks, motion, marks: () => structuredClone(marks) };
}
function timed(run: (f: ReturnType<typeof fixture>) => void) {
  vi.useFakeTimers(); const f = fixture();
  try { run(f); } finally { f.motion.dispose(); vi.useRealTimers(); }
}

describe('mug steam presentation', () => {
  it('draws sparse integer source pixels inside the 5 × 6 transparent envelope in both frames', () => timed(f => {
    f.motion.apply(presentation()); const a = f.marks();
    vi.advanceTimersByTime(1600); const b = f.marks();
    for (const frame of [a, b]) {
      expect(frame).toHaveLength(4);
      for (const [x, y, width, height] of frame) {
        expect([x, y, width, height].every(Number.isInteger)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(width).toBeGreaterThan(0); expect(height).toBeGreaterThan(0);
        expect(x + width).toBeLessThanOrEqual(5); expect(y + height).toBeLessThanOrEqual(6);
      }
    }
    expect(b.slice(0, 3)).toEqual(a.slice(0, 3)); expect(b[3][0] - a[3][0]).toBe(1);
    expect(f.graphics.fillStyle).toHaveBeenCalledWith(0xf7f0df, 1);
    expect(f.graphics.setVisible).toHaveBeenLastCalledWith(true);
  }));
  it('starts A immediately, then B at 1600 ms and A at 3200 ms with only one looping timer', () => timed(f => {
    f.motion.apply(presentation()); const a = f.marks();
    expect(f.tasks).toHaveLength(1); expect(f.tasks[0].delay).toBe(1600);
    vi.advanceTimersByTime(1599); expect(f.marks()).toEqual(a);
    vi.advanceTimersByTime(1); const b = f.marks(); expect(b).not.toEqual(a);
    vi.advanceTimersByTime(1600); expect(f.marks()).toEqual(a);
    vi.advanceTimersByTime(1600); expect(f.marks()).toEqual(b);
    expect(vi.getTimerCount()).toBe(1);
  }));
  it.each(['waiting', 'working', 'completed', 'error', 'idle', 'placeholder'] as const)(
    'coffee → %s clears synchronously and obsolete callbacks cannot resurrect it', visual => timed(f => {
      f.motion.apply(presentation()); vi.advanceTimersByTime(1600);
      f.motion.apply(presentation(visual));
      expect(f.marks()).toEqual([]); expect(f.graphics.setVisible).toHaveBeenLastCalledWith(false);
      expect(f.tasks[0].remove).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
      const calls = f.graphics.clear.mock.calls.length;
      f.tasks[0].callback(); vi.advanceTimersByTime(6400);
      expect(f.graphics.clear).toHaveBeenCalledTimes(calls);
    }),
  );
  it.each(['retained', 'reduced'] as const)('%s settles B to A, remains static, then resumes from A', policy => timed(f => {
    f.motion.apply(presentation()); const a = f.marks(); vi.advanceTimersByTime(1600);
    f.motion.apply(presentation('coffee', policy !== 'retained', policy === 'reduced'));
    expect(f.marks()).toEqual(a); expect(f.graphics.setVisible).toHaveBeenLastCalledWith(true);
    expect(vi.getTimerCount()).toBe(0); f.tasks[0].callback(); vi.advanceTimersByTime(6400);
    expect(f.marks()).toEqual(a);
    f.motion.apply(presentation()); expect(f.marks()).toEqual(a); expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1600); expect(f.marks()).not.toEqual(a);
  }));
  it('reduced motion disabled while retained does not start motion; non-coffee never loops', () => timed(f => {
    f.motion.apply(presentation('coffee', false, true)); const a = f.marks();
    f.motion.apply(presentation('coffee', false, false)); expect(f.marks()).toEqual(a);
    f.motion.apply(presentation('waiting')); expect(f.marks()).toEqual([]);
    expect(f.tasks).toHaveLength(0);
  }));
  it('identical live traffic and activity/reason changes preserve phase, and other identities are ignored', () => timed(f => {
    f.motion.apply(presentation()); vi.advanceTimersByTime(1600); const b = f.marks();
    f.motion.apply(presentation());
    f.motion.apply({ ...presentation(), activity: 'Inspection-only change', reason: 'approval_required' });
    f.motion.apply({ ...presentation('waiting'), id: 'mock-agent-ari' });
    f.motion.apply({ ...presentation('error'), id: 'mock-agent-mina' });
    expect(f.marks()).toEqual(b); expect(f.tasks).toHaveLength(1);
    vi.advanceTimersByTime(1600); expect(f.marks()).not.toEqual(b);
  }));
  it('a superseded episode cannot draw over a new coffee episode', () => timed(f => {
    f.motion.apply(presentation()); const old = f.tasks[0];
    f.motion.apply(presentation('working')); f.motion.apply(presentation()); const a = f.marks();
    old.callback(); expect(f.marks()).toEqual(a); expect(vi.getTimerCount()).toBe(1);
  }));
  it.each([false, true])('initial cached coffee is A with reducedMotion=%s and no acknowledgement', reduced => timed(f => {
    f.motion.apply(presentation('coffee', true, reduced));
    expect(f.marks()).toEqual([[2, 4, 1, 2], [1, 3, 2, 1], [1, 2, 1, 1], [2, 1, 2, 1]]);
    expect(vi.getTimerCount()).toBe(reduced ? 0 : 1);
  }));
  it.each([false, true])('idempotent disposal is safe after destroyed=%s, never draws or mutates visibility, and cancels all late work', destroyed => timed(f => {
    f.motion.apply(presentation());
    if (destroyed) {
      const GameObject = createRequire(import.meta.url)('phaser/src/gameobjects/GameObject') as typeof import('phaser').GameObjects.GameObject;
      const target = Object.assign(f.graphics, { commandBuffer: [] as number[], preDestroy() { this.commandBuffer = []; },
        emit: vi.fn(), removeAllListeners: vi.fn(), removeFromDisplayList: vi.fn(), removeFromUpdateList: vi.fn() });
      GameObject.prototype.destroy.call(target as unknown as import('phaser').GameObjects.GameObject, true);
      expect(f.graphics.scene).toBeUndefined();
      // Drawing/visibility after actual destruction must fail at this seam.
      f.graphics.clear.mockImplementation(() => { throw new Error('drawing after destruction'); });
      f.graphics.setVisible.mockImplementation(() => { throw new Error('visibility after destruction'); });
    }
    const counts = [f.graphics.clear.mock.calls.length, f.graphics.setVisible.mock.calls.length];
    expect(() => { f.motion.dispose(); f.motion.dispose(); f.tasks[0].callback(); f.motion.apply(presentation()); }).not.toThrow();
    expect([f.graphics.clear.mock.calls.length, f.graphics.setVisible.mock.calls.length]).toEqual(counts);
    expect(f.tasks[0].remove).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  }));
});
