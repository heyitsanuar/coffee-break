import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, mkdir, readFile, readdir, lstat, readlink, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { sha256 } from '../policy.js';

export interface Fixture {
  root: string;
  workspace: string;
  input: string;
  inputHash: string;
  credential: string;
  controller: string;
  protectedFile: string;
  gitFile: string;
  escape: string;
  guardFile: string;
}
export async function makeFixture(): Promise<Fixture> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-')));
  try {
    const workspace = join(root, 'workspace');
    await mkdir(join(workspace, '.git'), { recursive: true });
    const input = join(workspace, 'input.txt');
    const credential = join(root, 'synthetic-credentials');
    const controller = join(root, 'controller-state');
    const protectedFile = join(workspace, 'protected.txt');
    const gitFile = join(workspace, '.git', 'HEAD');
    const guardFile = join(root, 'guard-only');
    const inputText = 'ORCH-001 approved synthetic input\n';
    await writeFile(input, inputText);
    await writeFile(protectedFile, 'protected synthetic baseline\n');
    await writeFile(gitFile, 'ref: refs/heads/synthetic\n');
    // Never returned, printed, included in argv, or embedded in the helper source.
    await writeFile(credential, randomBytes(32).toString('hex'), { mode: 0o600 });
    await writeFile(controller, 'synthetic approval: false\n', { mode: 0o600 });
    await writeFile(guardFile, 'guard safety sentinel\n', { mode: 0o600 });
    const escape = join(workspace, 'credential-link');
    await symlink(credential, escape);
    return { root, workspace, input, inputHash: sha256(inputText), credential, controller, protectedFile, gitFile, escape, guardFile };
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}
export async function treeDigest(root: string): Promise<string> {
  const entries: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    for (const name of (await readdir(dir)).sort()) {
      const path = join(dir, name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) entries.push(`${relative(root, path)}:link:${await readlink(path)}`);
      else if (stat.isDirectory()) { entries.push(`${relative(root, path)}:directory`); await visit(path); }
      else if (stat.isFile()) entries.push(`${relative(root, path)}:${sha256(await readFile(path))}`);
      else throw new Error('Unsupported fixture file type');
    }
  };
  await visit(root);
  return sha256(entries.join('\n'));
}
