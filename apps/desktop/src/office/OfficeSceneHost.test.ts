import { describe, expect, it, vi } from 'vitest';
import {
  mountOfficeScene,
  type CreateOfficeGame,
  type OfficeGameModule,
} from './OfficeSceneHost';

const flushModuleLoad = async (): Promise<void> => {
  await Promise.resolve();
};

const createHost = (): HTMLElement => ({
  replaceChildren: vi.fn(),
}) as unknown as HTMLElement;

describe('mountOfficeScene', () => {
  it('does not create a game when cleanup happens before loading completes', async () => {
    let finishLoading!: (module: OfficeGameModule) => void;
    const createOfficeGame = vi.fn<CreateOfficeGame>();
    const loadOfficeGame = vi.fn(() => new Promise<OfficeGameModule>((resolve) => {
      finishLoading = resolve;
    }));
    const host = createHost();

    const cleanup = mountOfficeScene(host, loadOfficeGame);
    cleanup();
    finishLoading({ createOfficeGame });
    await flushModuleLoad();

    expect(createOfficeGame).not.toHaveBeenCalled();
    expect(host.replaceChildren).toHaveBeenCalledOnce();
  });

  it('creates the game after loading and destroys it with its canvas', async () => {
    const destroy = vi.fn();
    const createOfficeGame = vi.fn<CreateOfficeGame>(() => ({ destroy }));
    const host = createHost();

    const cleanup = mountOfficeScene(host, async () => ({ createOfficeGame }));
    await flushModuleLoad();

    expect(createOfficeGame).toHaveBeenCalledOnce();
    expect(createOfficeGame).toHaveBeenCalledWith(host);

    cleanup();

    expect(destroy).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledWith(true);
    expect(host.replaceChildren).toHaveBeenCalledOnce();
  });

  it('leaves only the current game active after cleanup and remount', async () => {
    const games = [
      { destroy: vi.fn() },
      { destroy: vi.fn() },
    ];
    const createOfficeGame = vi.fn<CreateOfficeGame>()
      .mockReturnValueOnce(games[0])
      .mockReturnValueOnce(games[1]);
    const loadOfficeGame = async (): Promise<OfficeGameModule> => ({
      createOfficeGame,
    });
    const host = createHost();

    const cleanupFirst = mountOfficeScene(host, loadOfficeGame);
    await flushModuleLoad();
    cleanupFirst();

    const cleanupSecond = mountOfficeScene(host, loadOfficeGame);
    await flushModuleLoad();

    expect(createOfficeGame).toHaveBeenCalledTimes(2);
    expect(games[0].destroy).toHaveBeenCalledOnce();
    expect(games[1].destroy).not.toHaveBeenCalled();

    cleanupSecond();
    expect(games[1].destroy).toHaveBeenCalledOnce();
  });
});
