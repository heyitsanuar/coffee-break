import { canonical, demand, digest, LIMITS, timestamp, uuid, WorkflowError } from '../workflow/contracts.js';
import { WorkflowStore } from '../workflow/store.js';
import { INPUT_LIMITS } from './contracts.js';
import { captureInputs, parseConfig, readInputFile, verifyFreshness, type CaptureOptions } from './capture.js';
import { humanReport, validateReport } from '../reports/contracts.js';

const flags: Record<string, readonly string[]> = { 'inputs.capture': ['config', 'revision'], 'inputs.attach': ['digest', 'revision', 'mode', 'event-id', 'at'], 'inputs.verify': ['digest'], 'inputs.fresh': ['config'], 'report.validate': ['payload', 'attempt', 'report-id', 'human'] };
interface Context { store?: WorkflowStore; captureOptions?: CaptureOptions; now?: () => string }
const jsonFile = async (path: string, limit: number): Promise<unknown> => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readInputFile(path, limit)));
export async function runInputs(args: string[], context: Context = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  let validated = false;
  const controller = new AbortController(); const interrupt = (): void => controller.abort();
  const output = (code: number, value: unknown): { code: number; stdout: string; stderr: string } => ({ code, stdout: canonical(value, INPUT_LIMITS.report) + '\n', stderr: '' });
  try {
    demand(args.reduce((n, a) => n + Buffer.byteLength(a) + 1, 0) <= LIMITS.cli, 'INVALID_ARGUMENTS');
    const command = args[0] + '.' + args[1]; demand(Object.hasOwn(flags, command), 'INVALID_ARGUMENTS'); const id = args[2]; uuid(id);
    const options = new Map<string, string>(); let cursor = 3;
    while (cursor < args.length) {
      const flag = args[cursor++]; demand(flag.startsWith('--'), 'INVALID_ARGUMENTS'); const key = flag.slice(2); demand(flags[command].includes(key) && !options.has(key), 'INVALID_ARGUMENTS');
      if (key === 'human') options.set(key, 'true'); else { const value = args[cursor++]; demand(value && !value.startsWith('--') && Buffer.byteLength(value) <= 4096 && !/[\x00-\x1f\x7f]/.test(value), 'INVALID_ARGUMENTS'); options.set(key, value); }
    }
    const required = (key: string): string => { const value = options.get(key); demand(value, 'INVALID_ARGUMENTS'); return value; };
    const revision = (): number => { const raw = required('revision'); demand(/^(0|[1-9]\d*)$/.test(raw) && Number.isSafeInteger(Number(raw)), 'INVALID_ARGUMENTS'); return Number(raw); };
    let rev = 0; let reference: { id: string; digest: string } | undefined; let mode: 'accept' | 'replace' = 'accept';
    if (command === 'inputs.capture' || command === 'inputs.fresh') required('config');
    if (command === 'inputs.capture' || command === 'inputs.attach') rev = revision();
    if (command === 'inputs.attach' || options.has('digest')) { const value = required('digest'); digest(value); reference = { id: `bundle-v1:${value}`, digest: value }; }
    if (command === 'inputs.attach') {
      const value = required('mode'); demand(value === 'accept' || value === 'replace', 'INVALID_ARGUMENTS'); mode = value;
      demand(options.has('event-id') === options.has('at'), 'INVALID_ARGUMENTS'); if (options.has('event-id')) { uuid(options.get('event-id')); timestamp(options.get('at')); }
    }
    if (command === 'report.validate') { required('payload'); required('attempt'); uuid(required('report-id')); }
    validated = true; const store = context.store ?? new WorkflowStore();
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    if (command === 'inputs.capture') {
      const state = await store.status(id); demand(state.exitCode === 0 && state.state, state.storage.code); demand(state.state.revision === rev, 'STALE_REVISION');
      const config = parseConfig(await jsonFile(required('config'), INPUT_LIMITS.manifest));
      const bundle = await captureInputs(config, id, state.state.repository.root, { ...context.captureOptions, now: context.now, signal: controller.signal });
      const result = await store.publishInputs(id, rev, bundle); return output(result.exitCode, result);
    }
    if (command === 'inputs.attach') { const result = await store.attachInputs(id, rev, reference!, mode, { eventId: options.get('event-id'), at: options.get('at') }); return output(result.exitCode, result); }
    const verified = await store.verifyInputs(id, reference);
    if (command === 'inputs.verify') return output(0, { schemaVersion: 1, integrity: 'verified', active: verified.active, runId: id, inputFingerprint: verified.captures[0].fingerprint, captureIds: verified.captures.map(c => c.id), freshness: 'not-requested', authorization: 'none' });
    if (command === 'inputs.fresh') {
      const config = parseConfig(await jsonFile(required('config'), INPUT_LIMITS.manifest)); const result = await verifyFreshness(verified.core, config, id, verified.state.repository.root, { ...context.captureOptions, now: context.now, signal: controller.signal });
      return output(result.status === 'fresh' ? 0 : result.status === 'drift' ? 1 : 3, { schemaVersion: 1, ...result, authorization: 'none' });
    }
    const report = validateReport(await readInputFile(required('payload'), INPUT_LIMITS.report), { state: verified.state, core: verified.core, reportId: required('report-id'), attemptId: required('attempt'), role: 'designer', stage: 'designer_review', sourceSha: verified.state.baselineSha, inputFingerprint: verified.state.input!.digest, producer: { id: 'unverified-external-output', adapter: 'cb-flow/validation-only/v1' }, receivedAt: (context.now ?? (() => new Date().toISOString()))(), observations: [], coveragePolicy: Object.fromEntries(verified.core.issue.criteria.map(c => [c.id, []])), notApplicable: null });
    return options.has('human') ? { code: 0, stdout: humanReport(report), stderr: '' } : output(0, { schemaVersion: 1, report, authorization: 'none' });
  } catch (error) {
    const code = !validated ? 2 : error instanceof WorkflowError && error.exitCode === 3 ? 3 : 1;
    return output(code, { schemaVersion: 1, status: 'blocked', code: !validated ? 'INVALID_ARGUMENTS' : error instanceof WorkflowError ? error.code : 'INPUT_OPERATION_FAILED', authorization: 'none', exitCode: code });
  } finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
