import type { AgentLifecycleState } from '@coffee-break/contracts';
import { getMockAgent, type MockAgentId } from './mockAgents';
import { OFFICE_ART_SCALE } from './officeLayout';
import type { OfficeAgentPresentation } from './officePresentation';
import type { OfficeAcknowledgement } from './officePresentationRuntime';
import { ACKNOWLEDGEMENT_DURATION } from './agentLifecycleFrames';

interface PixelRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
type MonitorFrame = 'stable' | 'working-alternate' | 'completed-widened';
const rect = (x: number, y: number, width: number, height: number): PixelRect => ({ x, y, width, height });
const forms: Readonly<Record<AgentLifecycleState, readonly PixelRect[]>> = {
  idle: [],
  working: [rect(6, 2, 3, 2), rect(11, 4, 4, 2)],
  waiting: [rect(6, 3, 3, 3), rect(11, 3, 3, 3)],
  completed: [rect(7, 2, 1, 4), rect(12, 2, 1, 4), rect(7, 6, 6, 1)],
  error: [rect(9, 1, 2, 1), rect(8, 2, 1, 1), rect(11, 2, 1, 1), rect(7, 3, 1, 2),
    rect(12, 3, 1, 2), rect(8, 5, 1, 1), rect(11, 5, 1, 1), rect(9, 6, 2, 1)],
};
const workingAlternate = [rect(6, 2, 4, 2), rect(11, 4, 3, 2)];
const completedWidened = [rect(6, 2, 1, 4), rect(13, 2, 1, 4), rect(6, 6, 8, 1)];

export function workstationMarks(state: AgentLifecycleState | null, frame: MonitorFrame = 'stable'): readonly PixelRect[] {
  if (state === null) return [];
  if (state === 'working' && frame === 'working-alternate') return workingAlternate;
  if (state === 'completed' && frame === 'completed-widened') return completedWidened;
  return forms[state];
}

export function getWorkstationGeometry(id: MockAgentId, _roomArtwork: boolean): PixelRect | undefined {
  const anchor = getMockAgent(id)?.anchorId;
  if (anchor !== 'left-workstation' && anchor !== 'right-workstation') return undefined;
  // Both authored and fallback monitors share the approved 20 × 8 logical inset.
  return rect((anchor === 'left-workstation' ? 158 : 192) * OFFICE_ART_SCALE,
    (anchor === 'left-workstation' ? 51 : 84) * OFFICE_ART_SCALE, 20 * OFFICE_ART_SCALE, 8 * OFFICE_ART_SCALE);
}

interface MonitorGraphics {
  readonly scene: unknown;
  clear(): unknown;
  fillStyle(colour: number, alpha: number): unknown;
  fillRect(x: number, y: number, width: number, height: number): unknown;
}

export function createWorkstationMotion(
  id: MockAgentId, graphics: MonitorGraphics,
  schedule: (delay: number, callback: () => void, loop?: boolean) => { remove(): void },
) {
  let current: OfficeAgentPresentation | undefined;
  let timer: { remove(): void } | undefined;
  let generation = 0;
  let lastSequence = 0;
  let disposed = false;
  const cancel = () => { generation++; timer?.remove(); timer = undefined; };
  const draw = (frame: MonitorFrame = 'stable') => {
    if (disposed || !graphics.scene || !current) return;
    graphics.clear();
    graphics.fillStyle(0x66839b, 1); // Existing room screen field; no brightness cycling.
    graphics.fillRect(0, 0, 20, 8);
    graphics.fillStyle(0x2d3036, 1);
    for (const { x, y, width, height } of workstationMarks(current.state, frame)) graphics.fillRect(x, y, width, height);
  };
  return {
    apply(next: OfficeAgentPresentation) {
      if (disposed || next.id !== id) return;
      const unchanged = current?.state === next.state && current.live === next.live && current.reducedMotion === next.reducedMotion;
      current = next;
      if (unchanged) return;
      cancel(); draw();
      if (next.state === 'working' && next.live && !next.reducedMotion) {
        const episode = generation;
        let alternate = false;
        timer = schedule(1200, () => {
          if (disposed || episode !== generation) return;
          alternate = !alternate; draw(alternate ? 'working-alternate' : 'stable');
        }, true);
      }
    },
    acknowledge(value: OfficeAcknowledgement) {
      if (disposed || value.id !== id || value.sequence <= lastSequence) return;
      lastSequence = value.sequence;
      if (value.state !== 'completed' || current?.state !== 'completed' || !current.live || current.reducedMotion) return;
      cancel(); draw('completed-widened');
      const episode = generation;
      timer = schedule(ACKNOWLEDGEMENT_DURATION.completed, () => {
        if (disposed || episode !== generation) return;
        timer = undefined; draw();
      });
    },
    dispose() { if (disposed) return; disposed = true; cancel(); }, // DisplayList may already have destroyed Graphics.
  };
}
