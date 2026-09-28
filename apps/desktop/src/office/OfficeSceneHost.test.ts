import { describe, expect, it, vi } from 'vitest';
import {
  mountOfficeScene,
  type CreateOfficeGame,
  type OfficeGame,
  type OfficeGameModule,
} from './OfficeSceneHost';
import { createAgentStateStore } from '../agentState/store';
import { deriveOfficePresentation } from './officePresentation';
import type { AgentStateMessage, TrustedAgentState } from '../../shared/agentState';
import type { MockAgentId } from './mockAgents';
import type { OfficeAgentPresentation } from './officePresentation';

const flushModuleLoad = async (): Promise<void> => {
  await Promise.resolve();
};

const createHost = (): HTMLElement => ({
  replaceChildren: vi.fn(),
}) as unknown as HTMLElement;

const createGame = (): OfficeGame => ({
  destroy: vi.fn(),
  setSelectedAgent: vi.fn(),
  setAgentPresentation: vi.fn(),
});
const presentation = (id: MockAgentId, state: 'idle' | 'working' = 'idle'): OfficeAgentPresentation => ({
  id, state, activity: state === 'idle' ? 'Ready for a task' : 'Implementing the change', visual: state,
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

  it('keeps only latest values arriving before module load and targets later updates', async () => {
    let finishLoading!: (module: OfficeGameModule) => void;
    const game = createGame();
    const createOfficeGame = vi.fn<CreateOfficeGame>(() => game);
    const mount = mountOfficeScene(createHost(), vi.fn(),
      () => new Promise<OfficeGameModule>((resolve) => { finishLoading = resolve; }));
    mount.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari'));
    mount.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'working'));
    mount.setAgentPresentation('mock-agent-mina', presentation('mock-agent-mina'));
    finishLoading({ createOfficeGame });
    await flushModuleLoad();
    expect(createOfficeGame).toHaveBeenCalledOnce();
    expect(game.setAgentPresentation).toHaveBeenCalledTimes(2);
    expect(game.setAgentPresentation).toHaveBeenCalledWith('mock-agent-ari', presentation('mock-agent-ari', 'working'));
    expect(game.setAgentPresentation).toHaveBeenCalledWith('mock-agent-mina', presentation('mock-agent-mina'));
    mount.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'working'));
    expect(game.setAgentPresentation).toHaveBeenCalledTimes(2);
    mount.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari'));
    expect(game.setAgentPresentation).toHaveBeenCalledTimes(3);
    expect(game.setAgentPresentation).toHaveBeenLastCalledWith('mock-agent-ari', presentation('mock-agent-ari'));
    mount.destroy();
  });

  it('preserves selection and skips unchanged agents on a disconnected or repeated presentation', async () => {
    const game = createGame();
    const mount = mountOfficeScene(createHost(), vi.fn(), async () => ({ createOfficeGame: () => game }));
    await flushModuleLoad();
    mount.setSelectedAgent('mock-agent-sol');
    mount.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari'));
    mount.setAgentPresentation('mock-agent-mina', presentation('mock-agent-mina'));
    mount.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol'));
    (game.setAgentPresentation as ReturnType<typeof vi.fn>).mockClear();
    mount.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari', 'working'));
    mount.setAgentPresentation('mock-agent-mina', presentation('mock-agent-mina'));
    mount.setAgentPresentation('mock-agent-sol', presentation('mock-agent-sol'));
    expect(game.setAgentPresentation).toHaveBeenCalledOnce();
    expect(game.setAgentPresentation).toHaveBeenCalledWith('mock-agent-ari', presentation('mock-agent-ari', 'working'));
    expect(game.setSelectedAgent).toHaveBeenLastCalledWith('mock-agent-sol');
    mount.destroy();
    mount.setAgentPresentation('mock-agent-ari', presentation('mock-agent-ari'));
    expect(game.setAgentPresentation).toHaveBeenCalledOnce();
  });
});


it('passes actual store loss and new-session snapshots through one mounted game with stable selection', async () => {
  let emit!: (message: AgentStateMessage) => void;
  const store = createAgentStateStore({ watch(listener) { emit = listener; return { ready: Promise.resolve(), close: vi.fn() }; } });
  const game = createGame();
  const create = vi.fn(() => game);
  const mount = mountOfficeScene(createHost(), vi.fn(), async () => ({ createOfficeGame: create }));
  const update = () => {
    const presentations = deriveOfficePresentation(store.getSnapshot());
    for (const id of Object.keys(presentations) as MockAgentId[]) mount.setAgentPresentation(id, presentations[id]);
  };
  const unsubscribe = store.subscribe(update);
  await store.start();
  await flushModuleLoad();
  const agents: TrustedAgentState['agents'] = [
    { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'completed', activity: 'Change implemented' },
    { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'completed', activity: 'Review complete' },
    { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'waiting', activity: 'Taking a coffee break in the simulated office' },
  ];
  const ready: TrustedAgentState = { revision: 6, sessionId: 'session-1', phase: 'ready', agents };
  emit({ kind: 'current', state: ready });
  mount.setSelectedAgent('mock-agent-sol');
  (game.setAgentPresentation as ReturnType<typeof vi.fn>).mockClear();
  emit({ kind: 'change', change: { kind: 'connection', state: { ...ready, phase: 'disconnected' } } });
  emit({ kind: 'change', change: { kind: 'connection', state: { ...ready, phase: 'synchronizing', sessionId: 'session-2' } } });
  expect(game.setAgentPresentation).not.toHaveBeenCalled();
  expect(store.getSnapshot().synchronized).toBe(false);
  const fresh = [...agents.slice(0, 2), { ...agents[2], state: 'working' as const, activity: 'Finishing a task' }];
  emit({ kind: 'change', change: { kind: 'snapshot', state: { ...ready, revision: 7, sessionId: 'session-2', agents: fresh } } });
  expect(game.setAgentPresentation).toHaveBeenCalledOnce();
  expect(game.setAgentPresentation).toHaveBeenCalledWith('mock-agent-sol', expect.objectContaining({ visual: 'working', activity: 'Finishing a task' }));
  expect(game.setSelectedAgent).toHaveBeenLastCalledWith('mock-agent-sol');
  expect(create).toHaveBeenCalledOnce();
  expect(game.destroy).not.toHaveBeenCalled();
  unsubscribe(); store.stop(); mount.destroy();
});
