import { mkdtemp, realpath, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { runWorkflow } from '../../src/workflow/cli.js';
import { WorkflowStore } from '../../src/workflow/store.js';
import { at, identity, runId } from './fixtures.js';

it('exposes only bounded workflow controls, never approval or arbitrary-event injection', async () => {
  const fake = { create: vi.fn(), status: vi.fn(), apply: vi.fn(), recover: vi.fn() } as unknown as WorkflowStore;
  for (const args of [[], ['approve', runId], ['handoff', runId], ['transition', runId, '--event', '{}'], ['status', '../escape'], ['status', runId, '--lock-token', runId], ['pause', runId], ['recover', runId, '--inspect', '--revision', '1'], ['cancel', runId, '--revision', '1', '--reason', 'x'.repeat(20_000)], ['pause', runId, '--revision', '1', '--revision', '2'], ['pause', runId, '--revision', '-1']]) {
    const result = await runWorkflow(args, { store: fake }); expect(result.code).toBe(2);
  }
  expect(fake.apply).not.toHaveBeenCalled(); expect(fake.recover).not.toHaveBeenCalled();
});
it('creates, inspects, pauses, resumes and cancels without implying approval or readiness', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-cli-')));
  try {
    const store = new WorkflowStore(root); const context = { store, now: () => at };
    const created = await runWorkflow(['create', '--repository-id', identity.repository.id, '--repository-root', identity.repository.root, '--story', identity.story.id, '--issue', '101', '--baseline', identity.baselineSha], context);
    expect(created.code).toBe(0); const state = JSON.parse(created.stdout).state;
    expect(state.approvalRefs).toEqual([]); expect(created.stdout).not.toContain('"ready":');
    const path = join(root, state.runId, 'journal.jsonl'); const before = await readFile(path);
    expect((await runWorkflow(['recover', state.runId, '--inspect'], context)).code).toBe(0); expect(await readFile(path)).toEqual(before);
    const paused = await runWorkflow(['pause', state.runId, '--revision', '1'], context); expect(paused.code).toBe(0);
    expect((await runWorkflow(['resume', state.runId, '--revision', '1'], context)).code).toBe(1);
    expect((await runWorkflow(['resume', state.runId, '--revision', '2'], context)).code).toBe(0);
    expect((await runWorkflow(['cancel', state.runId, '--revision', '3', '--reason', 'OPERATOR_CANCELLED'], context)).code).toBe(0);
    expect((await runWorkflow(['resume', state.runId, '--revision', '4'], context)).code).toBe(1);
    expect(JSON.parse((await runWorkflow(['status', state.runId], context)).stdout).state.status).toBe('cancelled');
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('supports exact event replay metadata without manufacturing a new transition', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-cli-')));
  try {
    const store = new WorkflowStore(root); const context = { store, now: () => at };
    const create = await store.create({ schemaVersion: 1, eventId: runId, runId, expectedRevision: 0, at, type: 'run.created', payload: identity }); expect(create.exitCode).toBe(0);
    const args = ['pause', runId, '--revision', '1', '--event-id', '22222222-2222-4222-8222-222222222222', '--at', at];
    expect((await runWorkflow(args, context)).code).toBe(0);
    const replayed = JSON.parse((await runWorkflow(args, context)).stdout); expect(replayed.disposition).toBe('duplicate'); expect(replayed.originalDisposition).toBe('accepted'); expect(replayed.state.revision).toBe(2);
  } finally { await rm(root, { recursive: true, force: true }); }
});
