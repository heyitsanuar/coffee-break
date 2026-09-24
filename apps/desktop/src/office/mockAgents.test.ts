import { describe, expect, it } from 'vitest';
import { OFFICE_AGENT_ANCHORS } from './officeLayout';
import {
  MOCK_AGENT_FRAME_HEIGHT,
  MOCK_AGENT_FRAME_WIDTH,
  MOCK_AGENT_RENDER_SCALE,
  MOCK_AGENTS,
  getMockAgent,
} from './mockAgents';

describe('mock agent fixtures', () => {
  it('defines exactly three unique simulated agents with complete identities', () => {
    expect(MOCK_AGENTS).toHaveLength(3);
    expect(new Set(MOCK_AGENTS.map(({ id }) => id)).size).toBe(3);
    expect(new Set(MOCK_AGENTS.map(({ displayName }) => displayName)).size).toBe(3);

    for (const agent of MOCK_AGENTS) {
      expect(agent.id.trim()).not.toBe('');
      expect(agent.displayName.trim()).not.toBe('');
      expect(agent.activity.trim()).not.toBe('');
      expect(agent.mode).toBe('simulated');
    }
  });

  it('starts one agent in each approved presentation state', () => {
    expect(MOCK_AGENTS.map(({ state }) => state).sort()).toEqual([
      'break',
      'idle',
      'working',
    ]);
  });

  it('resolves each stable ID to its typed fixture', () => {
    for (const agent of MOCK_AGENTS) {
      expect(getMockAgent(agent.id)).toBe(agent);
    }

    expect(getMockAgent(null)).toBeUndefined();
  });

  it('keeps the approved identities, activities, anchors, and animation rates', () => {
    expect(MOCK_AGENTS).toMatchObject([
      {
        id: 'mock-agent-ari',
        displayName: 'Ari',
        state: 'idle',
        activity: 'Waiting for a task',
        anchorId: 'left-workstation',
        animation: { frameRate: 2, cue: 'breathing' },
      },
      {
        id: 'mock-agent-mina',
        displayName: 'Mina',
        state: 'working',
        activity: 'Reviewing mock changes',
        anchorId: 'right-workstation',
        animation: { frameRate: 4, cue: 'typing-tablet' },
      },
      {
        id: 'mock-agent-sol',
        displayName: 'Sol',
        state: 'break',
        activity: 'Taking a coffee break',
        anchorId: 'coffee-break',
        animation: { frameRate: 2, cue: 'mug-raise' },
      },
    ]);
  });

  it('uses every approved anchor exactly once', () => {
    const anchorIds = OFFICE_AGENT_ANCHORS.map(({ id }) => id);
    const fixtureAnchorIds = MOCK_AGENTS.map(({ anchorId }) => anchorId);

    expect(fixtureAnchorIds.sort()).toEqual(anchorIds.sort());
    expect(new Set(fixtureAnchorIds).size).toBe(OFFICE_AGENT_ANCHORS.length);
  });

  it('keeps displayed frames inside every selected clearance region', () => {
    for (const agent of MOCK_AGENTS) {
      const anchor = OFFICE_AGENT_ANCHORS.find(({ id }) => id === agent.anchorId);

      expect(anchor).toBeDefined();
      expect(MOCK_AGENT_FRAME_WIDTH * MOCK_AGENT_RENDER_SCALE)
        .toBeLessThanOrEqual(anchor!.clearance.width);
      expect(MOCK_AGENT_FRAME_HEIGHT * MOCK_AGENT_RENDER_SCALE)
        .toBeLessThanOrEqual(anchor!.clearance.height);
    }
  });

  it('defines looping multi-frame animations with distinct non-color cues', () => {
    for (const agent of MOCK_AGENTS) {
      expect(agent.animation.frames.length).toBeGreaterThanOrEqual(2);
      expect(agent.animation.frameRate).toBeGreaterThan(0);
      expect(agent.animation.repeat).toBe(-1);
      expect(agent.animation.cue.trim()).not.toBe('');
    }

    expect(new Set(MOCK_AGENTS.map(({ animation }) => animation.cue)).size).toBe(3);
  });
});
