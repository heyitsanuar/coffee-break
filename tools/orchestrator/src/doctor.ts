import { access, constants, mkdtemp, realpath, readFile, lstat, readlink, open, rm } from 'node:fs/promises';
import type { BigIntStats } from 'node:fs';
import { arch, homedir, platform, tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { commandEvidence, commandSucceeded, runCommand, type CommandResult } from './process.js';
import { guardProfile, guarded, type Runner } from './guard.js';
import { POLICY, policyDigest, sha256, VERSION } from './policy.js';
import { decide, identityDigest, type Check, type CommandEvidence, type DiagnosticReport, type ToolIdentity } from './contracts.js';
import { detectCapabilities, supportedVersion } from './codex-capabilities.js';
import { pendingSecurity, probeSecurity } from './probes/security.js';

export const METADATA_COMMANDS = {
  node: ['--version'], npm: ['--version'], git: ['--version'], gh: ['--version'], codex: ['--version'],
  execHelp: ['exec', '--help'], sandboxHelp: ['sandbox', '--help'],
} as const;

export async function findExecutable(name: string): Promise<string | null> {
  const candidates = name === 'node' ? [process.execPath] : (process.env.PATH ?? '').split(delimiter).filter(Boolean).map(dir => resolve(dir, name));
  if (name === 'codex') candidates.push('/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex');
  for (const path of candidates) {
    try { await access(path, constants.X_OK); if ((await lstat(await realpath(path))).isFile()) return await realpath(path); } catch { /* try next installed path */ }
  }
  return null;
}
export function versionCheck(name: string, path: string | null, result?: CommandResult): { check: Check; tool: ToolIdentity } {
  const tool: ToolIdentity = { path, version: null };
  const check: Check = { id: `tool.${name}`, required: true, status: 'unverified', evidenceType: 'metadata', reason: 'Metadata execution unavailable or ambiguous.' };
  if (!path) return { tool, check: { ...check, status: 'fail', reason: 'Executable missing from the supported search paths.' } };
  if (!result || !commandSucceeded(result)) return { tool, check: { ...check, status: result?.timedOut || result?.overflow || result?.spawnError || result?.cleanupConfirmed === false ? 'fail' : 'unverified' } };
  const patterns: Record<string, RegExp> = { node: /^v(\d+)\.\d+\.\d+$/, npm: /^(\d+)\.\d+\.\d+$/, git: /^git version (\d+)\.\d+\.\d+(?: \(Apple Git-\d+\))?$/, gh: /^gh version (\d+)\.\d+\.\d+(?: \(\d{4}-\d{2}-\d{2}\))?$/, codex: /^codex-cli (\d+)\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/ };
  const line = result.stdout.trim().split('\n')[0]?.trim() ?? '';
  const match = patterns[name]?.exec(line);
  if (!match) return { tool, check: { ...check, status: 'unsupported', reason: 'Unrecognized version output; exit code zero is insufficient.' } };
  // Only a constrained version line is public; never arbitrary stderr/help text.
  tool.version = line;
  const compatible = name === 'codex' ? supportedVersion(result.stdout) : name === 'node' ? Number(match[1]) >= 22 : name === 'npm' ? Number(match[1]) >= 10 : Number(match[1]) >= 2;
  return { tool, check: { ...check, status: compatible ? 'pass' : 'unsupported', reason: compatible ? 'Installed version matches the documented baseline.' : 'Installed version is outside the explicitly supported baseline.' } };
}

interface RepositorySnapshot { root: string; head: string; status: string; contentDigest: string }
class UnsafeRepositoryPath extends Error {}
interface InspectedNode { path: string; stat: BigIntStats }

function contained(root: string, path: string): boolean {
  const distance = relative(root, path);
  return distance !== '' && !isAbsolute(distance) && !distance.split(sep).includes('..');
}

function relativeParts(path: string): string[] {
  const parts = path.split('/');
  if (isAbsolute(path) || parts.some(part => !part || part === '.' || part === '..')) throw new UnsafeRepositoryPath();
  return parts;
}

async function inspectInput(root: string, path: string): Promise<InspectedNode[]> {
  const parts = relativeParts(path);
  const target = resolve(root, path);
  if (!contained(root, target) || await realpath(root) !== root) throw new UnsafeRepositoryPath();
  const nodes: InspectedNode[] = [];
  let current = root;
  for (let index = -1; index < parts.length; index++) {
    if (index >= 0) current = join(current, parts[index]);
    const stat = await lstat(current, { bigint: true });
    const final = index === parts.length - 1;
    if (final ? !stat.isFile() && !stat.isSymbolicLink() : !stat.isDirectory() || stat.isSymbolicLink()) throw new UnsafeRepositoryPath();
    nodes.push({ path: current, stat });
  }
  const parent = dirname(target);
  if (await realpath(parent) !== parent || parent !== root && !contained(root, parent)) throw new UnsafeRepositoryPath();
  return nodes;
}

function sameNode(before: BigIntStats, after: BigIntStats): boolean {
  return before.dev === after.dev && before.ino === after.ino && before.mode === after.mode && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}

async function hashRepositoryInput(root: string, path: string): Promise<string> {
  // Node has no portable openat/dirfd walk. Audit every ancestor, then verify
  // the opened inode before reading. Recheck the chain and content metadata;
  // these checks detect changes but are not atomic against hostile ABA races.
  const inspected = await inspectInput(root, path);
  const final = inspected[inspected.length - 1];
  const verify = async (): Promise<void> => {
    const current = await inspectInput(root, path);
    if (current.length !== inspected.length || current.some((node, index) => !sameNode(inspected[index].stat, node.stat))) throw new UnsafeRepositoryPath();
  };
  try {
    if (final.stat.isSymbolicLink()) {
      const target = await readlink(final.path);
      await verify();
      return sha256(target);
    }
    const handle = await open(final.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if (!sameNode(final.stat, await handle.stat({ bigint: true }))) throw new UnsafeRepositoryPath();
      await verify();
      const contents = await handle.readFile();
      if (!sameNode(final.stat, await handle.stat({ bigint: true }))) throw new UnsafeRepositoryPath();
      await verify();
      return sha256(contents);
    } finally { await handle.close(); }
  } catch { throw new UnsafeRepositoryPath(); }
}

async function repositorySnapshot(git: string, cwd: string, execute: (id: string, executable: string, args: readonly string[], cwd: string) => Promise<CommandResult>): Promise<RepositorySnapshot | null> {
  const args = ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'core.untrackedCache=false'];
  const run = (id: string, command: string[]) => execute(`repository.${id}`, git, [...args, ...command], cwd);
  const root = await run('root', ['rev-parse', '--show-toplevel']);
  const head = await run('head', ['rev-parse', 'HEAD']);
  const status = await run('status', ['status', '--porcelain=v1', '--untracked-files=all']);
  const files = await run('files', ['ls-files', '-z']);
  if (![root, head, status, files].every(commandSucceeded) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head.stdout.trim())) return null;
  const repositoryRoot = await realpath(root.stdout.trim());
  const hashes: string[] = [];
  for (const path of files.stdout.split('\0').filter(Boolean).sort()) {
    relativeParts(path);
    // Hash only approved project inputs, never account/auth files or arbitrary symlink targets.
    if (!/^(apps\/|packages\/|docs\/design\/|\.agents\/|\.codex\/agents\/|AGENTS\.md$|package(?:-lock)?\.json$)/.test(path)) continue;
    try {
      const digest = await hashRepositoryInput(repositoryRoot, path);
      hashes.push(`${path}:${digest}`);
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') hashes.push(`${path}:missing`); else throw error; }
  }
  return { root: repositoryRoot, head: head.stdout.trim(), status: status.stdout, contentDigest: sha256(hashes.join('\n')) };
}

export async function doctor(probe: boolean, options: { runner?: Runner; locate?: typeof findExecutable; cwd?: string; signal?: AbortSignal } = {}): Promise<DiagnosticReport> {
  const runner = options.runner ?? runCommand;
  const locate = options.locate ?? findExecutable;
  const cwd = options.cwd ?? process.cwd();
  const controller = new AbortController();
  const interrupt = (): void => controller.abort();
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  options.signal?.addEventListener('abort', interrupt, { once: true });
  if (options.signal?.aborted) interrupt();
  let scratch: string | null = null;
  const checks: Check[] = [];
  const commands: CommandEvidence[] = [];
  const tools: Record<string, ToolIdentity> = {};
  const profile = guardProfile();
  const report: DiagnosticReport = {
    schemaVersion: 1, diagnosticVersion: VERSION, generatedAt: new Date().toISOString(),
    host: { os: platform(), architecture: arch(), node: process.version },
    repository: { root: null, head: null, clean: null, statusDigest: null }, tools,
    policy: { version: POLICY.version, digest: policyDigest, restrictions: POLICY.restrictions, guardDigest: sha256(profile), nativeDigest: null },
    fingerprint: null, checks, commands, ...decide([]),
  };
  const execute = async (id: string, executable: string, args: readonly string[], workingDirectory = scratch ?? cwd): Promise<CommandResult> => {
    const result = await guarded({ executable, args, cwd: workingDirectory, signal: controller.signal }, profile, runner);
    commands.push(commandEvidence(id, result));
    return result;
  };
  try {
    scratch = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-metadata-')));
    checks.push({ id: 'host.platform', required: true, status: platform() === 'darwin' && arch() === 'arm64' ? 'pass' : 'unsupported', evidenceType: 'metadata', reason: 'Only macOS arm64 is validated by this policy.' });
    for (const name of ['node', 'npm', 'git', 'gh', 'codex'] as const) {
      const path = await locate(name);
      const result = path ? await execute(`metadata.${name}`, path, METADATA_COMMANDS[name]) : undefined;
      const found = versionCheck(name, path, result);
      tools[name] = found.tool; checks.push(found.check);
      if (name === 'codex' && path) tools[name].sha256 = sha256(await readFile(path));
    }
    const codex = tools.codex?.path;
    if (codex && checks.find(check => check.id === 'tool.codex')?.status === 'pass') {
      const execHelp = await execute('metadata.exec-help', codex, METADATA_COMMANDS.execHelp);
      const sandboxHelp = await execute('metadata.sandbox-help', codex, METADATA_COMMANDS.sandboxHelp);
      checks.push(...detectCapabilities(commandSucceeded(execHelp) ? execHelp.stdout : '', commandSucceeded(sandboxHelp) ? sandboxHelp.stdout : ''));
    } else checks.push({ id: 'codex.interfaces', required: true, status: 'unverified', evidenceType: 'metadata', reason: 'Help inspection withheld because the exact Codex version was not established.' });

    // Observe presence only. No authentication files or user configuration contents are read.
    let accountConfigurationPresent = false;
    try { await lstat(join(homedir(), '.codex', 'config.toml')); accountConfigurationPresent = true; } catch { /* absent/denied */ }
    checks.push({ id: 'security.plugins-mcp', required: true, status: 'unverified', evidenceType: 'observation', reason: 'No non-inference proof of effective external-tool/plugin/MCP isolation. Shell denials and role TOML are insufficient.', evidence: { accountConfigurationPresent, configurationContentsRead: false, ambientSecretsForwarded: false } });

    const git = tools.git?.path;
    const before = git ? await repositorySnapshot(git, cwd, execute) : null;
    checks.push({ id: 'repository.baseline', required: true, status: before ? 'pass' : 'unverified', evidenceType: 'observation', reason: before ? 'Full HEAD, status and protected project-input hashes captured.' : 'Repository baseline could not be established.' });
    if (before) report.repository = { root: before.root, head: before.head, clean: before.status.length === 0, statusDigest: sha256(before.status + before.contentDigest) };

    const capable = checks.filter(check => check.id.startsWith('codex.') || check.id === 'tool.codex').every(check => check.status === 'pass');
    if (probe) {
      const security = await probeSecurity(codex && capable ? codex : null, controller.signal, runner);
      checks.push(...security.checks); commands.push(...security.commands);
      report.policy.guardDigest = security.guardDigest; report.policy.nativeDigest = security.nativeDigest || null;
    } else checks.push(...pendingSecurity('Not executed. Explicit --probe-security is required.'));

    const after = git && before ? await repositorySnapshot(git, cwd, execute) : null;
    checks.push({ id: 'repository.integrity', required: true, status: before && after ? JSON.stringify(before) === JSON.stringify(after) ? 'pass' : 'fail' : 'unverified', evidenceType: 'observation', reason: 'Compares HEAD, working-tree status and protected input hashes before/after diagnostics.' });
    const codexHash = codex ? sha256(await readFile(codex)) : null;
    checks.push({ id: 'codex.identity-stable', required: true, status: codexHash ? codexHash === tools.codex.sha256 ? 'pass' : 'fail' : 'unverified', evidenceType: 'observation', reason: 'Executable content identity compared before/after diagnostics.' });
    checks.push({ id: 'process.cleanup', required: true, status: commands.every(command => command.cleanupConfirmed) ? 'pass' : 'fail', evidenceType: 'observation', reason: 'Every owned process group must be confirmed terminated.' });
    if (before && report.repository.statusDigest && codexHash) report.fingerprint = identityDigest({ repositoryRoot: before.root, head: before.head, statusDigest: report.repository.statusDigest, codexSha256: codexHash, policyDigest: sha256(policyDigest + report.policy.guardDigest + report.policy.nativeDigest) });
  } catch (error) {
    checks.push(error instanceof UnsafeRepositoryPath
      ? { id: 'repository.path-safety', required: true, status: 'fail', evidenceType: 'observation', reason: 'Unsafe or changing repository input path detected; repository evidence rejected.' }
      : { id: 'diagnostic.internal', required: true, status: 'fail', evidenceType: 'observation', reason: 'Diagnostic execution could not complete safely; raw exception details omitted.' });
  } finally {
    if (scratch && commands.every(command => command.cleanupConfirmed)) {
      try { await rm(scratch, { recursive: true, force: true }); } catch { checks.push({ id: 'metadata.cleanup', required: true, status: 'fail', evidenceType: 'observation', reason: 'Disposable metadata scratch cleanup failed.' }); }
    } else if (scratch) checks.push({ id: 'metadata.cleanup', required: true, status: 'fail', evidenceType: 'observation', reason: 'Scratch retained because a process group could not be confirmed terminated.', evidence: { fixture: scratch } });
    process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); options.signal?.removeEventListener('abort', interrupt);
  }
  Object.assign(report, decide(checks));
  if (controller.signal.aborted) { report.ready = false; report.blockers.push('operator.interrupted'); report.exitCode = commands.every(command => command.cleanupConfirmed) ? 130 : 1; }
  return report;
}
