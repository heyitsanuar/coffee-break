import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { MOCK_AGENTS, MOCK_AGENT_FRAME_WIDTH, MOCK_AGENT_FRAME_HEIGHT } from './mockAgents';
import { stableLifecycleFrame, acknowledgementFrame, workingFrames, WORKING_FRAME_RATE } from './agentLifecycleFrames';
it('PNG and all named frames fit the approved 8×3 grid with distinct five-state stable poses', () => {
  const png = readFileSync(new URL('./assets/agent-lifecycle.png', import.meta.url));
  expect([...png.subarray(0, 8)]).toEqual([137,80,78,71,13,10,26,10]);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([160,72]);
  expect([MOCK_AGENT_FRAME_WIDTH, MOCK_AGENT_FRAME_HEIGHT]).toEqual([20,24]);
  for (const [row, agent] of MOCK_AGENTS.entries()) {
    const stable = ['idle', 'working', 'waiting', 'completed', 'error'].map(state => stableLifecycleFrame(agent.id, state as Parameters<typeof stableLifecycleFrame>[1]));
    expect(stable).toEqual([0,1,2,3,4].map(column => row * 8 + column));
    expect(workingFrames(agent.id)).toEqual([row * 8 + 1, row * 8 + 5]);
    expect(acknowledgementFrame(agent.id, 'completed')).toBe(row * 8 + 6);
    expect(acknowledgementFrame(agent.id, 'error')).toBe(row * 8 + 7);
  }
  expect(2 / WORKING_FRAME_RATE).toBeCloseTo(1.2);
});
