import { expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { issue, filterRepositoryFixture } from './fixtures.js';
import { writeFile, readFile, access, rm, rename, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { readIssue, readPlan, runRead, controllerEnvironment } from '../../src/inputs/github.js';

it('uses only fixed read-only operations and separates host authentication from diagnostic policy', async () => {
  const result = issue(); const response: Record<string, unknown> = { ...result }; delete response.repository; delete response.criteria;
  const execute = vi.fn(async () => Buffer.from(JSON.stringify(response)));
  expect(await readIssue('owner/repo', 7, execute)).toEqual(result);
  expect(execute).toHaveBeenCalledExactlyOnceWith({ type: 'issue', repository: 'owner/repo', issue: 7 });
  const plan = readPlan({ type: 'issue', repository: 'owner/repo', issue: 7 });
  expect(plan.args).toEqual(['issue', 'view', '7', '--repo', 'owner/repo', '--json', 'number,url,title,body,state']);
  expect(() => readPlan({ type: 'issue', repository: 'owner/repo;evil', issue: 7 })).toThrow();
  expect(() => readPlan({ type: 'write' } as never)).toThrow();
  const env = controllerEnvironment('gh', { PATH: '/usr/bin', GH_TOKEN: 'synthetic', GITHUB_TOKEN: 'synthetic', NODE_OPTIONS: 'evil', GH_CONFIG_DIR: '/evil', HTTPS_PROXY: 'evil' });
  expect(env).toMatchObject({ GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' });
  expect(env).not.toHaveProperty('GH_TOKEN'); expect(env).not.toHaveProperty('NODE_OPTIONS'); expect(env).not.toHaveProperty('GH_CONFIG_DIR');
});
it.each(['throw', 'empty', 'invalid', 'wrong-repo', 'wrong-number', 'missing-body'])('fails closed on issue read %s', async mode => {
  const data: Record<string, unknown> = { ...issue() }; delete data.repository; delete data.criteria;
  if (mode === 'wrong-repo') data.url = 'https://github.com/other/repo/issues/7';
  if (mode === 'wrong-number') data.number = 8;
  if (mode === 'missing-body') delete data.body;
  await expect(readIssue('owner/repo', 7, async () => { if (mode === 'throw') throw new Error('synthetic secret'); return Buffer.from(mode === 'empty' ? '' : mode === 'invalid' ? '{' : JSON.stringify(data)); })).rejects.toThrow();
});
it('bounds output, deadlines and spawn/nonzero failures without returning raw diagnostics', async () => {
  const fake = (mode: string) => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), pid: undefined as number | undefined, kill: vi.fn() });
    queueMicrotask(() => { if (mode === 'error') child.emit('error', new Error('secret')); else if (mode === 'overflow') { child.stdout.write(Buffer.alloc(200)); child.emit('close', 0); } else if (mode === 'nonzero') { child.stderr.write('secret'); child.emit('close', 1); } });
    return child;
  };
  for (const mode of ['error', 'overflow', 'nonzero', 'timeout']) await expect(runRead({ type: 'issue', repository: 'owner/repo', issue: 7 }, { spawn: () => fake(mode) as never, timeoutMs: 5, outputBytes: 100 })).rejects.toThrow(/^READ_/);
});
it.each(['clean', 'process'] as const)('isolates local filter.%s before status and retains tracked/untracked cleanliness checks', async kind => {
  const f = await filterRepositoryFixture(kind);
  try {
    const beforeIndex = await readFile(join(f.root, '.git/index')); const beforeConfig = await readFile(join(f.root, '.git/config'));
    const observe = () => f.execute({ type: 'status', root: f.root });
    expect((await observe()).length).toBe(0);
    await writeFile(join(f.root, '.git/info/exclude'), 'locally-ignored.txt\n'); await writeFile(join(f.root, 'locally-ignored.txt'), 'ignored'); expect((await observe()).length).toBe(0);
    await writeFile(join(f.root, 'ignored.txt'), 'ignored'); expect((await observe()).length).toBe(0);
    await writeFile(join(f.root, 'policy.md'), 'dirty'); expect((await observe()).toString()).toContain('policy.md');
    await writeFile(join(f.root, 'policy.md'), 'original\r\nbytes\n'); await writeFile(join(f.root, 'new.txt'), 'untracked'); expect((await observe()).toString()).toContain('?? new.txt');
    expect(await readFile(join(f.root, '.git/index'))).toEqual(beforeIndex); expect(await readFile(join(f.root, '.git/config'))).toEqual(beforeConfig);
    for (const call of f.calls.filter(args => args.includes('status'))) await expect(access(call.find(a => a.startsWith('--git-dir='))!.slice(10))).rejects.toThrow();
  } finally { await f.clean(); }
});
it.each(['missing', 'symlink'] as const)('fails before status with %s index, without falling back', async mode => {
  const f = await filterRepositoryFixture('process');
  try {
    if (mode === 'missing') await rm(join(f.root, '.git/index'));
    else { await rename(join(f.root, '.git/index'), join(f.base, 'preserved-index')); await symlink(join(f.base, 'preserved-index'), join(f.root, '.git/index')); }
    await expect(f.execute({ type: 'status', root: f.root })).rejects.toThrow('READ_GIT_ISOLATION_UNVERIFIED');
    expect(f.calls.some(args => args.includes('status'))).toBe(false);
  } finally { await f.clean(); }
});
it.each(['gitlink', 'unsupported-cli', 'malformed-metadata', 'aborted'] as const)('blocks %s before any status command and cleans private metadata', async mode => {
  const f = await filterRepositoryFixture('process'); const calls: string[][] = [];
  try {
    const controller = new AbortController(); if (mode === 'aborted') controller.abort();
    const spawn: typeof f.guardedSpawn = ((program: string, args: string[], options: Parameters<typeof f.guardedSpawn>[2]) => {
      const argv = args; calls.push(argv);
      if (mode === 'unsupported-cli') throw new Error('Unsupported isolation option');
      if (mode === 'malformed-metadata' || argv.includes('ls-files')) {
        const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), pid: undefined });
        queueMicrotask(() => { child.stdout.write(mode === 'malformed-metadata' ? '/unknown\n' : `160000 ${'a'.repeat(40)} 0\tsubmodule\0`); child.emit('close', 0); });
        return child as never;
      }
      return f.guardedSpawn(program, args, options!);
    }) as typeof f.guardedSpawn;
    await expect(runRead({ type: 'status', root: f.root }, { spawn, signal: controller.signal })).rejects.toThrow(mode === 'aborted' ? 'READ_INTERRUPTED' : 'READ_GIT_ISOLATION_UNVERIFIED');
    expect(calls.some(args => args.includes('status'))).toBe(false);
    for (const call of calls.filter(args => args.includes('ls-files'))) await expect(access(call.find(a => a.startsWith('--git-dir='))!.slice(10))).rejects.toThrow();
    if (mode === 'aborted') expect(calls).toEqual([]);
  } finally { await f.clean(); }
});
it('does not expose an executable status plan without isolation', () => {
  expect(() => readPlan({ type: 'status', root: '/fixture' })).toThrow('READ_GIT_ISOLATION_REQUIRED');
});
it.each(['missing-tag', 'unknown-tag', 'unmerged', 'missing-nul', 'truncated', 'unknown-mode'] as const)('rejects ambiguous flag inspection: %s', async mode => {
  const f = await filterRepositoryFixture('process'); let inspection: string[] | undefined;
  try {
    const spawn: typeof f.guardedSpawn = ((program: string, args: string[], options: Parameters<typeof f.guardedSpawn>[2]) => {
      if (!args.includes('ls-files')) return f.guardedSpawn(program, args, options!);
      inspection = args;
      const output = mode === 'truncated' ? 'H 100644' : `${mode === 'missing-tag' ? '' : mode === 'unknown-tag' ? 'X ' : 'H '}${mode === 'unknown-mode' ? '040000' : '100644'} ${'a'.repeat(40)} ${mode === 'unmerged' ? 1 : 0}\tunselected.md${mode === 'missing-nul' ? '' : '\0'}`;
      const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), pid: undefined });
      queueMicrotask(() => { child.stdout.write(output); child.emit('close', 0); }); return child as never;
    }) as typeof f.guardedSpawn;
    const beforeIndex = await readFile(join(f.root, '.git/index'));
    await expect(runRead({ type: 'status', root: f.root }, { spawn })).rejects.toThrow('READ_GIT_ISOLATION_UNVERIFIED');
    expect(f.calls.some(args => args.includes('status'))).toBe(false);
    expect(await readFile(join(f.root, '.git/index'))).toEqual(beforeIndex);
    expect(inspection).toBeDefined(); await expect(access(inspection!.find(a => a.startsWith('--git-dir='))!.slice(10))).rejects.toThrow();
  } finally { await f.clean(); }
});
