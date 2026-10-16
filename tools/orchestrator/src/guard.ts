import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CommandResult, CommandSpec } from './process.js';
import { runCommand } from './process.js';

export type Runner = (spec: CommandSpec) => Promise<CommandResult>;
const quote = (path: string): string => JSON.stringify(path);

// An independent safety envelope, not evidence that Codex enforces its policy.
// The native run permits fixture mutations/network so Codex's denials are observable.
export function guardProfile(writableFixture?: string, port?: number, protectedFixture?: string): string {
  const sensitive = ['.codex', '.ssh', '.aws', '.config', 'Library/Keychains', 'Library/Application Support/gh', '.netrc', '.npmrc', '.git-credentials'];
  return ['(version 1)', '(allow default)', '(deny file-write*)', '(deny network*)',
    ...sensitive.map(path => `(deny file-read* (subpath ${quote(join(homedir(), path))}))`),
    ...(protectedFixture ? [`(deny file-read* (literal ${quote(protectedFixture)}))`] : []),
    ...(writableFixture ? [`(allow file-write* (subpath ${quote(writableFixture)}))`] : []),
    ...(port ? [`(allow network-outbound (remote ip ${quote(`127.0.0.1:${port}`)}))`] : []),
  ].join('\n');
}
export function guarded(spec: CommandSpec, profile: string, runner: Runner = runCommand): Promise<CommandResult> {
  return runner({ ...spec, executable: '/usr/bin/sandbox-exec', args: ['-p', profile, spec.executable, ...spec.args] });
}
