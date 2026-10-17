#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { VERSION } from './policy.js';

const HELP = `cb-flow ${VERSION} — local, non-inference diagnostics
Usage:
  cb-flow --help
  cb-flow --version
  cb-flow doctor [--json] [--probe-security]
  cb-flow run create|status|pause|resume|cancel|recover [options]

doctor inspects fixed tool metadata. --probe-security explicitly enables
disposable native probes. Readiness never grants implementation approval.
Exit codes: 0 success; 1 failed check/internal error; 2 usage;
3 unsupported/unverified; 130 interrupted after cleanup.
`;
interface Report { ready: boolean; blockers: string[]; exitCode: number }
type Doctor = (probe: boolean) => Promise<Report>;
export async function runCli(args: string[], doctor?: Doctor): Promise<{ code: number; stdout: string; stderr: string }> {
  if (args.length === 1 && args[0] === '--help') return { code: 0, stdout: HELP, stderr: '' };
  if (args.length === 1 && args[0] === '--version') return { code: 0, stdout: VERSION + '\n', stderr: '' };
  if (args[0] === 'run') return (await import('./workflow/cli.js')).runWorkflow(args.slice(1));
  if (args[0] !== 'doctor' || args.slice(1).some(arg => !['--json', '--probe-security'].includes(arg)) || new Set(args).size !== args.length) return { code: 2, stdout: '', stderr: HELP };
  try {
    const execute = doctor ?? (await import('./doctor.js')).doctor;
    const report = await execute(args.includes('--probe-security'));
    const stdout = args.includes('--json') ? JSON.stringify(report, null, 2) + '\n' : `ready=${report.ready}\nexitCode=${report.exitCode}\nblockers=${report.blockers.join(', ') || 'none'}\nUse --json for bounded evidence.\n`;
    return { code: report.exitCode, stdout, stderr: '' };
  } catch {
    const failure = { schemaVersion: 1, diagnosticVersion: VERSION, ready: false, blockers: ['diagnostic.internal'], exitCode: 1 };
    return { code: 1, stdout: args.includes('--json') ? JSON.stringify(failure) + '\n' : '', stderr: args.includes('--json') ? '' : 'Diagnostics could not complete. Readiness is blocked; no raw exception details are emitted.\n' };
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runCli(process.argv.slice(2));
  process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.code;
}
