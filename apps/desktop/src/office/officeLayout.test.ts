import { describe, expect, it } from 'vitest';
import {
  OFFICE_AGENT_ANCHORS,
  OFFICE_ART_HEIGHT,
  OFFICE_ART_WIDTH,
  OFFICE_DEPTHS,
  OFFICE_SCENE_HEIGHT,
  OFFICE_SCENE_WIDTH,
} from './officeLayout';

describe('office layout', () => {
  it('uses artwork that scales exactly twice into the scene', () => {
    expect(OFFICE_ART_WIDTH * 2).toBe(OFFICE_SCENE_WIDTH);
    expect(OFFICE_ART_HEIGHT * 2).toBe(OFFICE_SCENE_HEIGHT);
  });

  it('keeps the future agent layer between the room layers', () => {
    expect(OFFICE_DEPTHS.background).toBeLessThan(OFFICE_DEPTHS.futureAgents);
    expect(OFFICE_DEPTHS.futureAgents).toBeLessThan(OFFICE_DEPTHS.foreground);
  });

  it('defines the three approved unique agent anchors', () => {
    expect(OFFICE_AGENT_ANCHORS.map(({ x, y }) => [x, y])).toEqual([
      [136, 248],
      [320, 248],
      [520, 248],
    ]);

    const coordinates = new Set(
      OFFICE_AGENT_ANCHORS.map(({ x, y }) => `${x},${y}`),
    );

    expect(coordinates.size).toBe(OFFICE_AGENT_ANCHORS.length);
  });

  it('keeps every clearance region inside the scene', () => {
    for (const { clearance } of OFFICE_AGENT_ANCHORS) {
      expect(clearance.x).toBeGreaterThanOrEqual(0);
      expect(clearance.y).toBeGreaterThanOrEqual(0);
      expect(clearance.x + clearance.width).toBeLessThanOrEqual(OFFICE_SCENE_WIDTH);
      expect(clearance.y + clearance.height).toBeLessThanOrEqual(OFFICE_SCENE_HEIGHT);
    }
  });

  it('keeps the three clearance regions from overlapping', () => {
    for (let first = 0; first < OFFICE_AGENT_ANCHORS.length; first += 1) {
      for (let second = first + 1; second < OFFICE_AGENT_ANCHORS.length; second += 1) {
        const a = OFFICE_AGENT_ANCHORS[first].clearance;
        const b = OFFICE_AGENT_ANCHORS[second].clearance;
        const overlaps = a.x < b.x + b.width
          && a.x + a.width > b.x
          && a.y < b.y + b.height
          && a.y + a.height > b.y;

        expect(overlaps).toBe(false);
      }
    }
  });
});
