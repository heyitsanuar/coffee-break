import * as fs from 'node:fs/promises';
import { mkdtemp, readFile, writeFile, rm, mkdir, symlink, rename, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { doctor, METADATA_COMMANDS, versionCheck } from '../src/doctor.js';
import type { CommandSpec, CommandResult } from '../src/process.js';

vi.mock('node:fs/promises', async importOriginal => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return { ...original, readFile: vi.fn(original.readFile), open: vi.fn(original.open) };
});

const result = (stdout: string, overrides: Partial<CommandResult> = {}): CommandResult => ({ stdout, stderr: '', exitCode: 0, signal: null, timedOut: false, overflow: false, interrupted: false, cleanupConfirmed: true, bytesObserved: Buffer.byteLength(stdout), durationMs: 1, signals: [], ...overrides });
const execHelp = `Run Codex non-interactively
Usage: codex exec [OPTIONS] [PROMPT]
instructions read from stdin
Options:
  --json  JSONL
  --output-schema <FILE>
  --output-last-message <FILE>
  --cd <DIR>
  --sandbox <SANDBOX_MODE>  read-only
  --image <FILE>
  --ignore-user-config
  --disable <FEATURE>`;
const sandboxHelp = 'Usage: codex sandbox [OPTIONS] [COMMAND]\nOptions:\n  --permission-profile <NAME>\n  --include-managed-config\n  --cd <DIR>';

it('separates missing, incompatible, ambiguous and actual versions', () => {
  expect(versionCheck('node', null).check.status).toBe('fail');
  expect(versionCheck('node', '/node', result('v20.0.0')).check.status).toBe('unsupported');
  expect(versionCheck('npm', '/npm', result('9.0.0')).check.status).toBe('unsupported');
  expect(versionCheck('codex', '/codex', result('codex-cli 0.162.0-alpha.17.3')).check.status).toBe('unsupported');
  expect(versionCheck('git', '/git', result('success')).check.status).toBe('unsupported');
  expect(versionCheck('gh', '/gh', result('gh version 2.102.0\nhttps://github.com/cli/cli')).check.status).toBe('pass');
  expect(versionCheck('node', '/node', result('v24.22.0', { timedOut: true })).check.status).toBe('fail');
  expect(versionCheck('node', '/node', result('v24.22.0', { exitCode: 1 })).check.status).not.toBe('pass');
});

it('uses fixed guarded metadata only, never runs inference, and preserves dirty repository inputs', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'cb-flow-doctor-test-'));
  const input = join(cwd, 'AGENTS.md');
  await writeFile(input, 'protected baseline');
  const before = await readFile(input, 'utf8');
  const calls: CommandSpec[] = [];
  const paths: Record<string, string> = { node: process.execPath, npm: '/usr/bin/true', git: '/usr/bin/git', gh: '/usr/bin/false', codex: '/usr/bin/printf' };
  const versions: Record<string, string> = { [paths.node]: 'v24.22.0', [paths.npm]: '12.2.0', [paths.git]: 'git version 2.54.0', [paths.gh]: 'gh version 2.102.0', [paths.codex]: 'codex-cli 0.162.0-alpha.17.2' };
  const runner = async (spec: CommandSpec): Promise<CommandResult> => {
    calls.push(spec);
    expect(spec.executable).toBe('/usr/bin/sandbox-exec');
    const command = spec.args.slice(3);
    if (command[0] === '--version') return result(versions[spec.args[2]]);
    if (command[0] === 'exec') { expect(command).toEqual(['exec', '--help']); return result(execHelp); }
    if (command[0] === 'sandbox') { expect(command).toEqual(['sandbox', '--help']); return result(sandboxHelp); }
    if (command.includes('--show-toplevel')) return result(cwd);
    if (command.includes('HEAD')) return result('a'.repeat(40));
    if (command.includes('status')) return result(' M package.json\n');
    if (command.includes('ls-files')) return result('AGENTS.md\0');
    throw new Error('Unexpected executable request');
  };
  try {
    const report = await doctor(false, { cwd, runner, locate: async name => paths[name] });
    expect(report.repository.head).toBe('a'.repeat(40));
    expect(report.repository.clean).toBe(false);
    expect(report.checks.find(check => check.id === 'repository.integrity')?.status).toBe('pass');
    expect(report.checks.find(check => check.id === 'security.plugins-mcp')?.status).toBe('unverified');
    expect(report.commands.every(command => !('stdout' in command) && !('stderr' in command))).toBe(true);
    expect(report.ready).toBe(false); expect(report.exitCode).toBe(3);
    expect(report.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(input, 'utf8')).toBe(before);
    expect(calls.some(call => call.args.includes('sandbox') && !call.args.includes('--help'))).toBe(false);
    for (const args of Object.values(METADATA_COMMANDS)) expect(args.some(arg => arg === '--help' || arg === '--version')).toBe(true);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

it('treats missing tools and unperformed native probes as blockers', async () => {
  const report = await doctor(false, { locate: async () => null });
  expect(report.ready).toBe(false); expect(report.exitCode).toBe(1);
  expect(report.tools.codex.path).toBeNull();
  expect(report.checks.filter(check => check.id.startsWith('security.') && check.status === 'pass')).toEqual([]);
  expect(report.commands).toEqual([]);
});

function inspectFixture(cwd: string, tracked: string) {
  return doctor(false, { cwd, locate: async name => name === 'git' ? '/usr/bin/git' : null, runner: async spec => {
    const command = spec.args.slice(3);
    if (command.includes('--version')) return result('git version 2.54.0');
    if (command.includes('--show-toplevel')) return result(cwd);
    if (command.includes('HEAD')) return result('a'.repeat(40));
    if (command.includes('status')) return result('');
    if (command.includes('ls-files')) return result(tracked + '\0');
    throw new Error('Unexpected fixture command');
  } });
}
it('rejects a tracked input beneath a symlinked ancestor without reading its target', async () => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-path-test-')));
  const repo = join(fixture, 'repo');
  const sibling = join(fixture, 'repo-sibling');
  await mkdir(join(repo, 'apps'), { recursive: true });
  await mkdir(sibling);
  await writeFile(join(sibling, 'input.txt'), 'synthetic private fixture only');
  await symlink(sibling, join(repo, 'apps', 'linked'));
  const read = vi.spyOn(fs, 'readFile').mockClear();
  try {
    const report = await inspectFixture(repo, 'apps/linked/input.txt');
    expect(report.checks.find(check => check.id === 'repository.path-safety')?.status).toBe('fail');
    expect(report.ready).toBe(false); expect(report.exitCode).toBe(1);
    expect(report.repository.head).toBeNull();
    expect(read).not.toHaveBeenCalled();
  } finally { read.mockRestore(); await rm(fixture, { recursive: true, force: true }); }
});
it('rejects an ancestor swapped after inspection before reading the opened descriptor', async () => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-path-race-')));
  const repo = join(fixture, 'repo');
  const directory = join(repo, 'apps');
  const sibling = join(fixture, 'repo-sibling');
  const input = join(directory, 'input.txt');
  await mkdir(directory, { recursive: true }); await mkdir(sibling);
  await writeFile(input, 'approved synthetic input');
  await writeFile(join(sibling, 'input.txt'), 'synthetic outside fixture target');
  const originalOpen = (await vi.importActual<typeof fs>('node:fs/promises')).open;
  let swapped = false;
  let descriptorRead = false;
  const open = vi.spyOn(fs, 'open').mockImplementation(async (...args: Parameters<typeof fs.open>) => {
    if (args[0] === input && !swapped) {
      swapped = true;
      await rename(directory, join(repo, 'original-apps'));
      await symlink(sibling, directory);
      const handle = await originalOpen(...args);
      vi.spyOn(handle, 'readFile').mockImplementation(async () => { descriptorRead = true; throw new Error('Unsafe descriptor read'); });
      return handle;
    }
    return originalOpen(...args);
  });
  try {
    const report = await inspectFixture(repo, 'apps/input.txt');
    expect(swapped).toBe(true);
    expect(descriptorRead).toBe(false);
    expect(report.checks.find(check => check.id === 'repository.path-safety')?.status).toBe('fail');
    expect(report.ready).toBe(false);
  } finally { open.mockRestore(); await rm(fixture, { recursive: true, force: true }); }
});
it('hashes a final symlink as text without reading its synthetic outside target', async () => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-path-link-')));
  const repo = join(fixture, 'repo');
  await mkdir(join(repo, 'apps'), { recursive: true });
  const target = join(fixture, 'synthetic-private.txt');
  await writeFile(target, 'synthetic target is never read');
  await symlink(target, join(repo, 'apps', 'input.txt'));
  const read = vi.spyOn(fs, 'readFile').mockClear();
  try {
    const report = await inspectFixture(repo, 'apps/input.txt');
    expect(report.checks.find(check => check.id === 'repository.baseline')?.status).toBe('pass');
    expect(report.checks.find(check => check.id === 'repository.integrity')?.status).toBe('pass');
    expect(read).not.toHaveBeenCalled();
  } finally { read.mockRestore(); await rm(fixture, { recursive: true, force: true }); }
});
it.each(['absolute', 'parent traversal'])('rejects an unsafe %s tracked path', async kind => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-path-invalid-')));
  const repo = join(fixture, 'repo');
  const sibling = join(fixture, 'repo-sibling');
  await mkdir(join(repo, 'apps'), { recursive: true }); await mkdir(sibling);
  const target = join(sibling, 'input.txt');
  await writeFile(target, 'synthetic target inside the owned test fixture');
  try {
    const report = await inspectFixture(repo, kind === 'absolute' ? target : 'apps/../../repo-sibling/input.txt');
    expect(report.checks.find(check => check.id === 'repository.path-safety')?.status).toBe('fail');
    expect(report.ready).toBe(false);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
