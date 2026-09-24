export const OFFICE_SCENE_WIDTH = 640;
export const OFFICE_SCENE_HEIGHT = 360;
export const OFFICE_ART_WIDTH = 320;
export const OFFICE_ART_HEIGHT = 180;
export const OFFICE_ART_SCALE = 2;

export const OFFICE_DEPTHS = Object.freeze({
  background: 0,
  futureAgents: 10,
  foreground: 20,
});

export interface OfficeClearanceRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface OfficeAgentAnchor {
  readonly id: 'left-workstation' | 'right-workstation' | 'coffee-break';
  readonly x: number;
  readonly y: number;
  readonly clearance: OfficeClearanceRegion;
}

const createAgentAnchor = (
  id: OfficeAgentAnchor['id'],
  x: number,
  y: number,
): Readonly<OfficeAgentAnchor> => Object.freeze({
  id,
  x,
  y,
  clearance: Object.freeze({
    x: x - 24,
    y: y - 56,
    width: 48,
    height: 64,
  }),
});

export const OFFICE_AGENT_ANCHORS: readonly Readonly<OfficeAgentAnchor>[] = Object.freeze([
  createAgentAnchor('left-workstation', 136, 248),
  createAgentAnchor('right-workstation', 320, 248),
  createAgentAnchor('coffee-break', 520, 248),
]);
