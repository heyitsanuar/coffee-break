import agentLifecycleUrl from './assets/agent-lifecycle.png';
import { AGENT_LIFECYCLE_COLUMNS, stableLifecycleFrame } from './agentLifecycleFrames';
import { MOCK_AGENT_FRAME_HEIGHT, MOCK_AGENT_FRAME_WIDTH, type MockAgentId } from './mockAgents';

/** Decorative 16×16 identity window from canonical Idle art; no separate portrait assets. */
export function AgentPortrait({ id, size }: { readonly id: MockAgentId; readonly size: 32 | 48 }): React.JSX.Element {
  const frame = stableLifecycleFrame(id, 'idle');
  const scale = size / 16;
  return <span className="agent-portrait" aria-hidden="true" style={{
    width: size, height: size,
    backgroundImage: `url(${agentLifecycleUrl})`,
    backgroundSize: `${MOCK_AGENT_FRAME_WIDTH * AGENT_LIFECYCLE_COLUMNS * scale}px ${MOCK_AGENT_FRAME_HEIGHT * 3 * scale}px`,
    backgroundPosition: `${-(frame % AGENT_LIFECYCLE_COLUMNS * MOCK_AGENT_FRAME_WIDTH + 2) * scale}px ${-Math.floor(frame / AGENT_LIFECYCLE_COLUMNS) * MOCK_AGENT_FRAME_HEIGHT * scale}px`,
  }} />;
}
