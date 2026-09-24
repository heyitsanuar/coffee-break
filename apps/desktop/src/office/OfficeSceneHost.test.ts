import { describe, expect, it, vi } from 'vitest';
import {
  mountOfficeScene,
  type CreateOfficeGame,
  type OfficeGame,
  type OfficeGameModule,
} from './OfficeSceneHost';
import type { MockAgentId } from './mockAgents';

const flushModuleLoad = async (): Promise<void> => {
  await Promise.resolve();
};

const createHost = (): HTMLElement => ({
  replaceChildren: vi.fn(),
}) as unknown as HTMLElement;

const createGame = (): OfficeGame => ({
  destroy: vi.fn(),
  setSelectedAgent: vi.fn(),
});

describe('mountOfficeScene', () => {
  it('does not create a game when cleanup happens before loading completes', async () => {
    let finishLoading!: (module: OfficeGameModule) => void;
    const createOfficeGame = vi.fn<CreateOfficeGame>();
    const loadOfficeGame = vi.fn(() => new Promise<OfficeGameModule>((resolve) => {
      finishLoading = resolve;
    }));
    const host = createHost();
    const onAgentSelected = vi.fn();

    const mount = mountOfficeScene(host, onAgentSelected, loadOfficeGame);
    mount.destroy();
    finishLoading({ createOfficeGame });
    await flushModuleLoad();

    expect(createOfficeGame).not.toHaveBeenCalled();
    expect(host.replaceChildren).toHaveBeenCalledOnce();
  });

  it('creates the game after loading and destroys it with its canvas', async () => {
    const game = createGame();
    const createOfficeGame = vi.fn<CreateOfficeGame>(() => game);
    const host = createHost();
    const onAgentSelected = vi.fn();

    const mount = mountOfficeScene(host, onAgentSelected, async () => ({ createOfficeGame }));
    await flushModuleLoad();

    expect(createOfficeGame).toHaveBeenCalledOnce();
    expect(createOfficeGame).toHaveBeenCalledWith(host, expect.any(Function));

    mount.destroy();

    expect(game.destroy).toHaveBeenCalledOnce();
    expect(game.destroy).toHaveBeenCalledWith(true);
    expect(host.replaceChildren).toHaveBeenCalledOnce();
  });

  it('applies the latest selection after asynchronous loading finishes', async () => {
    let finishLoading!: (module: OfficeGameModule) => void;
    const game = createGame();
    const createOfficeGame = vi.fn<CreateOfficeGame>(() => game);
    const loadOfficeGame = () => new Promise<OfficeGameModule>((resolve) => {
      finishLoading = resolve;
    });
    const mount = mountOfficeScene(createHost(), vi.fn(), loadOfficeGame);

    mount.setSelectedAgent('mock-agent-ari');
    mount.setSelectedAgent('mock-agent-mina');
    finishLoading({ createOfficeGame });
    await flushModuleLoad();

    expect(game.setSelectedAgent).toHaveBeenCalledOnce();
    expect(game.setSelectedAgent).toHaveBeenCalledWith('mock-agent-mina');
  });

  it('ignores selection callbacks after the game is destroyed', async () => {
    let emitSelection!: (agentId: MockAgentId) => void;
    const onAgentSelected = vi.fn();
    const createOfficeGame = vi.fn<CreateOfficeGame>((_host, callback) => {
      emitSelection = callback;
      return createGame();
    });
    const mount = mountOfficeScene(
      createHost(),
      onAgentSelected,
      async () => ({ createOfficeGame }),
    );
    await flushModuleLoad();

    emitSelection('mock-agent-ari');
    mount.destroy();
    emitSelection('mock-agent-sol');

    expect(onAgentSelected).toHaveBeenCalledOnce();
    expect(onAgentSelected).toHaveBeenCalledWith('mock-agent-ari');
  });

  it('leaves only the current game active after cleanup and remount', async () => {
    const games = [
      createGame(),
      createGame(),
    ];
    const createOfficeGame = vi.fn<CreateOfficeGame>()
      .mockReturnValueOnce(games[0])
      .mockReturnValueOnce(games[1]);
    const loadOfficeGame = async (): Promise<OfficeGameModule> => ({
      createOfficeGame,
    });
    const host = createHost();

    const firstMount = mountOfficeScene(host, vi.fn(), loadOfficeGame);
    await flushModuleLoad();
    firstMount.setSelectedAgent('mock-agent-sol');
    firstMount.destroy();

    const secondMount = mountOfficeScene(host, vi.fn(), loadOfficeGame);
    secondMount.setSelectedAgent('mock-agent-sol');
    await flushModuleLoad();

    expect(createOfficeGame).toHaveBeenCalledTimes(2);
    expect(games[0].destroy).toHaveBeenCalledOnce();
    expect(games[1].destroy).not.toHaveBeenCalled();

    expect(games[1].setSelectedAgent).toHaveBeenCalledWith('mock-agent-sol');

    secondMount.destroy();
    expect(games[1].destroy).toHaveBeenCalledOnce();
  });
});
