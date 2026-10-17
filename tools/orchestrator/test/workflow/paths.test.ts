import { mkdtemp, realpath, rm, mkdir, symlink, writeFile, link, rename, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi, type MockInstance } from 'vitest';
import * as fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { StoragePaths, defaultStorageRoot } from '../../src/workflow/paths.js';
import { runId } from './fixtures.js';

vi.mock('node:fs/promises', async importOriginal => {
  const original = await importOriginal<typeof fs>(); return { ...original, open: vi.fn(original.open) };
});

it('selects a separate portable namespace and permits only validated private run paths', async () => {
  expect(defaultStorageRoot('darwin', '/home/user')).toBe('/home/user/Library/Application Support/coffee-break-dev-orchestrator/v1/runs');
  expect(defaultStorageRoot('linux', '/home/user')).toBe('/home/user/.local/state/coffee-break-dev-orchestrator/v1/runs');
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-storage-')));
  try {
    const paths = new StoragePaths(root); const dir = await paths.create(runId);
    await dir.create('journal.jsonl', Buffer.from('baseline'));
    expect((await dir.read('journal.jsonl', 100))?.toString()).toBe('baseline');
    for (const id of ['../escape', '/absolute', '.', 'not-a-uuid']) await expect(paths.open(id)).rejects.toThrow();
    await expect(dir.create('../escape', Buffer.from('no'))).rejects.toThrow();
    await expect(dir.create('journal.jsonl', Buffer.from('overwrite'))).rejects.toThrow();
    await expect(dir.read('journal.jsonl', 2)).rejects.toThrow('RESOURCE_LIMIT');
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('rejects ancestor/final symlinks, hard links, permissive files and special files', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-storage-')));
  try {
    const dir = await new StoragePaths(root).create(runId);
    const target = join(root, 'synthetic-target'); await writeFile(target, 'unchanged', { mode: 0o600 });
    await symlink(target, join(dir.path, 'journal.jsonl')); await expect(dir.read('journal.jsonl', 100)).rejects.toThrow('UNSAFE_PATH'); await rm(join(dir.path, 'journal.jsonl'));
    await link(target, join(dir.path, 'journal.jsonl')); await expect(dir.openAppend('journal.jsonl')).rejects.toThrow('UNSAFE_PATH'); await rm(join(dir.path, 'journal.jsonl'));
    await writeFile(join(dir.path, 'journal.jsonl'), 'x', { mode: 0o644 }); await expect(dir.read('journal.jsonl', 100)).rejects.toThrow('UNSAFE_PATH'); await rm(join(dir.path, 'journal.jsonl'));
    await mkdir(join(dir.path, 'journal.jsonl')); await expect(dir.read('journal.jsonl', 100)).rejects.toThrow('UNSAFE_PATH'); await rm(join(dir.path, 'journal.jsonl'), { recursive: true });
    execFileSync('/usr/bin/mkfifo', [join(dir.path, 'journal.jsonl')]); await expect(dir.openAppend('journal.jsonl')).rejects.toThrow('UNSAFE_PATH'); await rm(join(dir.path, 'journal.jsonl'));
    await rename(dir.path, join(root, 'original')); await symlink(join(root, 'original'), dir.path); await expect(dir.create('snapshot.json', Buffer.from('{}'))).rejects.toThrow('UNSAFE_PATH');
    await rm(dir.path); await rename(join(root, 'original'), dir.path); await chmod(dir.path, 0o777); await expect(new StoragePaths(root).open(runId)).rejects.toThrow('UNSAFE_PATH');
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('detects controlled directory replacement even when the replacement is a real private directory', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-storage-')));
  try {
    const paths = new StoragePaths(root); const dir = await paths.create(runId);
    await rename(dir.path, join(root, 'original')); await mkdir(dir.path, { mode: 0o700 });
    await expect(dir.create('snapshot.json', Buffer.from('{}'))).rejects.toThrow('DIRECTORY_CHANGED');
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('refuses a descriptor redirected by a controlled parent swap before any append', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-storage-')));
  let spy: MockInstance<typeof fs.open> | undefined;
  try {
    const dir = await new StoragePaths(root).create(runId); await dir.create('journal.jsonl', Buffer.from('original'));
    const originalOpen = (await vi.importActual<typeof fs>('node:fs/promises')).open;
    const path = join(dir.path, 'journal.jsonl'); let changed = false;
    spy = vi.spyOn(fs, 'open').mockImplementation(async (...args: Parameters<typeof fs.open>) => {
      if (args[0] === path && !changed) {
        changed = true; await rename(dir.path, join(root, 'original')); await mkdir(dir.path, { mode: 0o700 });
        await writeFile(path, 'unrelated synthetic replacement', { mode: 0o600 });
      }
      return originalOpen(...args);
    });
    await expect(dir.openAppend('journal.jsonl')).rejects.toThrow('FILE_CHANGED');
    expect(changed).toBe(true); expect(await fs.readFile(path, 'utf8')).toBe('unrelated synthetic replacement');
    expect(await fs.readFile(join(root, 'original', 'journal.jsonl'), 'utf8')).toBe('original');
  } finally { spy?.mockRestore(); await rm(root, { recursive: true, force: true }); }
});
