import { useEffect, useRef } from 'react';

export interface OfficeGame {
  destroy(removeCanvas: boolean): void;
}

export type CreateOfficeGame = (parent: HTMLElement) => OfficeGame;

export interface OfficeGameModule {
  createOfficeGame: CreateOfficeGame;
}

export type LoadOfficeGame = () => Promise<OfficeGameModule>;

const loadOfficeGame = (): Promise<OfficeGameModule> => import('./createOfficeGame');

export function mountOfficeScene(
  host: HTMLElement,
  loadGame: LoadOfficeGame = loadOfficeGame,
): () => void {
  let disposed = false;
  let game: OfficeGame | undefined;

  void loadGame().then(({ createOfficeGame }) => {
    if (!disposed) {
      game = createOfficeGame(host);
    }
  });

  return () => {
    disposed = true;
    const mountedGame = game;
    game = undefined;
    mountedGame?.destroy(true);
    host.replaceChildren();
  };
}

export function OfficeSceneHost(): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return undefined;
    }

    return mountOfficeScene(host);
  }, []);

  return (
    <div
      ref={hostRef}
      className="office-scene-host"
      role="img"
      aria-label="Pixel-art office with three simulated agents: one idle, one working, and one on break"
    />
  );
}
