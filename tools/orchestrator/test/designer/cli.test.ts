import { expect, it, vi } from 'vitest';
vi.mock('node:child_process', () => ({ spawn: vi.fn(() => { throw new Error('PROCESS_LAUNCH_FORBIDDEN'); }), exec: vi.fn(() => { throw new Error('PROCESS_LAUNCH_FORBIDDEN'); }), execFile: vi.fn(() => { throw new Error('PROCESS_LAUNCH_FORBIDDEN'); }), execSync: vi.fn(() => { throw new Error('PROCESS_LAUNCH_FORBIDDEN'); }), execFileSync: vi.fn(() => { throw new Error('PROCESS_LAUNCH_FORBIDDEN'); }), spawnSync: vi.fn(() => { throw new Error('PROCESS_LAUNCH_FORBIDDEN'); }), fork: vi.fn(() => { throw new Error('PROCESS_LAUNCH_FORBIDDEN'); }) }));
import * as child from 'node:child_process';
import { runDesigner } from '../../src/designer/cli.js';
import { WorkflowStore } from '../../src/workflow/store.js';
import { harness, requestId, decisionId } from './fixtures.js';

it('prepares, inspects and records denial without launching any process', async () => {
  const f = await harness();
  try {
    const prepared = await runDesigner(['prepare', f.runId, '--revision', '2', '--recipe', f.recipe.id, '--request-id', requestId], f.store); expect(prepared.code).toBe(0); expect(JSON.parse(prepared.stdout).allowLaunch).toBe(false);
    expect((await runDesigner(['inspect', f.runId, '--preparation', requestId], f.store)).code).toBe(0);
    const denied = await runDesigner(['admission', f.runId, '--preparation', requestId, '--revision', '2', '--request-id', decisionId], f.store);
    expect(denied.code).toBe(3); expect(JSON.parse(denied.stdout).admission.allowLaunch).toBe(false);
    for (const command of Object.values(child)) if (vi.isMockFunction(command)) expect(command).not.toHaveBeenCalled();
  } finally { await f.clean(); }
});
it('has no production recipe, environment override or hidden execution command', async () => {
  const f = await harness();
  try {
    vi.stubEnv('CB_FLOW_ALLOW_LAUNCH', 'true'); vi.stubEnv('CODEX_SANDBOX', 'danger-full-access');
    const production = new WorkflowStore(f.storage);
    const result = await runDesigner(['prepare', f.runId, '--revision', '2', '--recipe', f.recipe.id, '--request-id', requestId], production);
    expect(result.code).toBe(1); expect(JSON.parse(result.stdout).status).toBe('RECIPE_NOT_APPROVED');
    for (const cmd of ['launch', 'execute', 'resume']) expect((await runDesigner([cmd, f.runId], f.store)).code).toBe(2);
    for (const flag of ['--force', '--approve', '--model', '--shell', '--diagnostics']) expect((await runDesigner(['prepare', f.runId, '--revision', '2', '--recipe', f.recipe.id, '--request-id', requestId, flag, 'true'], f.store)).code).toBe(2);
  } finally { vi.unstubAllEnvs(); await f.clean(); }
});
