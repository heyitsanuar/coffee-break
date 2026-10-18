import { parseCore, parseIssue } from '../../src/inputs/contracts.js';
import { prepareBundle } from '../../src/inputs/bundle.js';
import { sha256 } from '../../src/policy.js';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { controllerEnvironment, runRead, type ReadExecutor } from '../../src/inputs/github.js';
import type { CaptureConfig } from '../../src/inputs/capture.js';
export const sha = 'a'.repeat(40);
export const bytes = Buffer.from('original\r\nbytes\n');
export const issue = () => parseIssue({ repository: 'owner/repo', number: 7, url: 'https://github.com/owner/repo/issues/7', title: 'Story', body: '## Acceptance Criteria\n- [ ] AC-01: Exact criterion\n- [ ] AC-02: Another criterion\n', state: 'OPEN' });
export const core = () => parseCore({ schemaVersion: 1, kind: 'scope-bundle', repository: 'owner/repo', story: { id: 'TEST-1', issue: 7 }, baselineSha: sha, checkout: { clean: true }, issue: issue(), files: [{ path: 'policy.md', kind: 'policy', digest: sha256(bytes), bytes: bytes.length, sourceSha: sha, provenance: { origin: 'fixture', limitations: [] } }], imports: ['developer_discovery', 'planner_scope'].map(kind => ({ schemaVersion: 1, kind, origin: 'fixture', basisSha: sha, digest: sha256(bytes), bytes: bytes.length, limitations: [], compatibility: { mode: 'exact', policyDigest: null, rationale: '' } })), scope: { allowedChanges: ['src/main.ts'], nonGoals: ['No execution'], validationPlan: ['typecheck'], unresolvedDecisions: [] }, applicable: [{ kind: 'policy', path: 'policy.md', digest: sha256(bytes) }] });
export const prepared = (runId = '11111111-1111-4111-8111-111111111111') => prepareBundle(core(), new Map([[sha256(bytes), bytes]]), { runId, root: '/fixture', capturedAt: '2026-10-17T12:00:00.000Z', id: '22222222-2222-4222-8222-222222222222', issueAdapter: 'fixture/v1' });

// All setup commands and inputs are controlled. A spawn guard rejects the old
// unsafe status invocation BEFORE Git can try even the inert sentinel command.
export async function filterRepositoryFixture(kind: 'clean' | 'process') {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'cb-filter-regression-'))); const root = join(base, 'repo'); await mkdir(root);
  const git = async (...args: string[]) => (await promisify(execFile)('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, env: controllerEnvironment('git') })).stdout.trim();
  try {
    await git('-c', 'init.templateDir=/dev/null', 'init');
    await mkdir(join(root, '.git/info'), { recursive: true });
    await writeFile(join(root, 'policy.md'), bytes); await writeFile(join(root, 'unselected.md'), 'unselected original\n'); await writeFile(join(root, '.gitattributes'), 'policy.md filter=sentinel\n'); await writeFile(join(root, '.gitignore'), 'ignored.txt\n');
    await git('add', '--', 'policy.md', 'unselected.md', '.gitattributes', '.gitignore');
    await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '-m', 'Controlled fixture');
    const baselineSha = await git('rev-parse', 'HEAD');
    await git('config', '--local', `filter.sentinel.${kind}`, 'ORCH003_FILTER_MUST_NOT_RUN');
    await git('config', '--local', 'filter.sentinel.required', 'true');
    await writeFile(join(base, 'import.md'), bytes);
    const config: CaptureConfig = { schemaVersion: 1, repository: 'owner/repo', story: { id: 'TEST-1', issue: 7 }, baselineSha, selected: [{ path: 'policy.md', kind: 'policy', provenance: { origin: 'fixture', limitations: [] } }], imports: ['developer_discovery', 'planner_scope'].map(kind => ({ kind, path: join(base, 'import.md'), origin: 'fixture', basisSha: baselineSha, limitations: [], compatibility: { mode: 'exact', policyDigest: null, rationale: '' } })) as CaptureConfig['imports'], scope: core().scope };
    const calls: string[][] = [];
    const guardedSpawn: typeof spawn = ((program: string, args: string[], options: Parameters<typeof spawn>[2]) => {
      calls.push(args);
      if (args.includes('status') && !args.some(a => a.startsWith('--git-dir=') && a !== `--git-dir=${join(root, '.git')}`)) throw new Error('UNISOLATED_STATUS_REFUSED');
      return spawn(program, args, options!);
    }) as typeof spawn;
    const execute: ReadExecutor = op => runRead(op, { spawn: guardedSpawn });
    // update-index may refresh other entries while setting flags. Disable the
    // known fixture-only sentinel for setup, without changing stored config.
    const flagUnselected = (flag: '--assume-unchanged' | '--skip-worktree') => git('-c', 'filter.sentinel.clean=', '-c', 'filter.sentinel.process=', '-c', 'filter.sentinel.required=false', 'update-index', flag, '--', 'unselected.md');
    return { root, base, config, calls, guardedSpawn, execute, flagUnselected, clean: () => rm(base, { recursive: true, force: true }) };
  } catch (error) { await rm(base, { recursive: true, force: true }); throw error; }
}
