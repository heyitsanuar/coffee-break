import { canonical, demand, LIMITS, uuid, WorkflowError } from '../workflow/contracts.js';
import { WorkflowStore } from '../workflow/store.js';
import { DESIGNER_LIMITS } from './contracts.js';

const flags: Record<string, readonly string[]> = { prepare: ['revision', 'recipe', 'request-id'], inspect: ['preparation'], admission: ['preparation', 'revision', 'request-id'] };
export async function runDesigner(args: string[], store = new WorkflowStore()): Promise<{ code: number; stdout: string; stderr: string }> {
  let valid = false;
  const output = (code: number, value: unknown) => ({ code, stdout: canonical(value, DESIGNER_LIMITS.document) + '\n', stderr: '' });
  try {
    demand(args.reduce((n, a) => n + Buffer.byteLength(a) + 1, 0) <= LIMITS.cli, 'INVALID_ARGUMENTS');
    const [command, id] = args; demand(Object.hasOwn(flags, command), 'INVALID_ARGUMENTS'); uuid(id);
    const options = new Map<string, string>();
    for (let i = 2; i < args.length; i += 2) { const key = args[i].slice(2); const value = args[i + 1]; demand(args[i].startsWith('--') && flags[command].includes(key) && !options.has(key) && value && value.length <= 256 && !value.startsWith('--') && !/[\x00-\x1f\x7f]/.test(value), 'INVALID_ARGUMENTS'); options.set(key, value); }
    demand(flags[command].every(k => options.has(k)), 'INVALID_ARGUMENTS');
    let revision = 0;
    if (options.has('revision')) { const value = options.get('revision')!; demand(/^(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)), 'INVALID_ARGUMENTS'); revision = Number(value); }
    for (const key of ['preparation', 'request-id']) if (options.has(key)) uuid(options.get(key)); valid = true;
    if (command === 'inspect') {
      const result = await store.inspectDesigner(id, options.get('preparation')!);
      // Bounded operational summary; full immutable documents remain in private storage.
      return output(result.status === 'verified' ? 0 : 3, { schemaVersion: 1, status: result.status, preparation: result.receipt, job: result.receipt.job, errors: result.errors, authorization: 'none' });
    }
    const result = command === 'prepare' ? await store.prepareDesigner(id, revision, options.get('recipe')!, options.get('request-id')!) : await store.designerAdmission(id, revision, options.get('preparation')!, options.get('request-id')!);
    return output(result.exitCode, { schemaVersion: 1, status: result.storage.code, preparation: 'preparation' in result ? result.preparation ?? null : null, admission: 'admission' in result ? result.admission ?? null : null, authorization: 'none', allowLaunch: false });
  } catch (error) {
    const code = !valid ? 2 : error instanceof WorkflowError && error.exitCode === 3 ? 3 : 1;
    return output(code, { schemaVersion: 1, status: 'blocked', code: !valid ? 'INVALID_ARGUMENTS' : error instanceof WorkflowError ? error.code : 'DESIGNER_OPERATION_FAILED', authorization: 'none', allowLaunch: false });
  }
}
