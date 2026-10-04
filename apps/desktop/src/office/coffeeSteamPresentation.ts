import type { OfficeAgentPresentation } from './officePresentation';

// Source pixels within the measured 5 × 6 envelope above the existing sage mug.
const frames = [
  [[2, 4, 1, 2], [1, 3, 2, 1], [1, 2, 1, 1], [2, 1, 2, 1]],
  [[2, 4, 1, 2], [1, 3, 2, 1], [1, 2, 1, 1], [3, 1, 2, 1]],
] as const;

interface SteamGraphics {
  readonly scene: unknown;
  clear(): unknown;
  setVisible(visible: boolean): unknown;
  fillStyle(colour: number, alpha: number): unknown;
  fillRect(x: number, y: number, width: number, height: number): unknown;
}

export function createCoffeeSteamMotion(
  graphics: SteamGraphics,
  schedule: (delay: number, callback: () => void) => { remove(): void },
) {
  let current: OfficeAgentPresentation | undefined;
  let timer: { remove(): void } | undefined;
  let generation = 0;
  let disposed = false;
  const cancel = () => { generation++; timer?.remove(); timer = undefined; };
  const draw = (frame = 0) => {
    if (disposed || !graphics.scene || !current) return;
    graphics.clear();
    const coffee = current.visual === 'coffee';
    graphics.setVisible(coffee);
    if (!coffee) return;
    graphics.fillStyle(0xf7f0df, 1); // Existing mug-opening cream, transparent elsewhere.
    for (const [x, y, width, height] of frames[frame]) graphics.fillRect(x, y, width, height);
  };
  return {
    apply(next: OfficeAgentPresentation) {
      if (disposed || next.id !== 'mock-agent-sol') return;
      const unchanged = current && (current.visual === 'coffee') === (next.visual === 'coffee')
        && current.live === next.live && current.reducedMotion === next.reducedMotion;
      current = next;
      if (unchanged) return;
      cancel(); draw();
      if (next.visual === 'coffee' && next.live && !next.reducedMotion) {
        const episode = generation;
        let frame = 0;
        timer = schedule(1600, () => {
          if (disposed || episode !== generation) return;
          frame = 1 - frame; draw(frame);
        });
      }
    },
    // DisplayList destruction can precede scene cleanup: never draw or change visibility here.
    dispose() { if (disposed) return; disposed = true; cancel(); },
  };
}
