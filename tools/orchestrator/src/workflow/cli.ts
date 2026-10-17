import { randomUUID } from 'node:crypto';
import { demand, integer, LIMITS, parseEvent, timestamp, uuid, WorkflowError, type WorkflowEvent } from './contracts.js';
import { WorkflowStore } from './store.js';

const FLAGS: Record<string, readonly string[]> = {
  create: ['repository-id', 'repository-root', 'story', 'issue', 'baseline', 'json'],
  status: ['json'], pause: ['revision', 'event-id', 'at', 'json'], resume: ['revision', 'event-id', 'at', 'json'],
  cancel: ['revision', 'reason', 'event-id', 'at', 'json'], recover: ['inspect', 'revision', 'lock-token', 'event-id', 'at', 'json'],
};
interface Context { store?: WorkflowStore; now?: () => string }
export async function runWorkflow(args: string[], context: Context = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  let validated = false;
  try {
    demand(args.reduce((sum, arg) => sum + Buffer.byteLength(arg) + 1, 0) <= LIMITS.cli, 'INVALID_ARGUMENTS');
    const [command] = args; demand(Object.hasOwn(FLAGS, command ?? ''), 'INVALID_ARGUMENTS');
    const options = new Map<string, string>(); let cursor = 1; let id = '';
    if (command !== 'create') { id = args[cursor++] ?? ''; uuid(id); }
    while (cursor < args.length) {
      const flag = args[cursor++]; demand(flag.startsWith('--'), 'INVALID_ARGUMENTS'); const key = flag.slice(2);
      demand(FLAGS[command].includes(key) && !options.has(key), 'INVALID_ARGUMENTS');
      if (key === 'json' || key === 'inspect') options.set(key, 'true');
      else { const value = args[cursor++]; demand(value && !value.startsWith('--') && Buffer.byteLength(value) <= 4_096 && !/[\x00-\x1f\x7f]/.test(value), 'INVALID_ARGUMENTS'); options.set(key, value); }
    }
    const required = (key: string): string => { const value = options.get(key); demand(value, 'INVALID_ARGUMENTS'); return value; };
    const number = (key: string): number => { const value = required(key); demand(/^(?:0|[1-9]\d*)$/.test(value), 'INVALID_ARGUMENTS'); const result = Number(value); integer(result); return result; };
    const now = context.now ?? (() => new Date().toISOString());
    const replayMetadata = (): { eventId: string; at: string } => {
      demand(options.has('event-id') === options.has('at'), 'INVALID_ARGUMENTS');
      const metadata = { eventId: options.get('event-id') ?? randomUUID(), at: options.get('at') ?? now() };
      uuid(metadata.eventId); timestamp(metadata.at); return metadata;
    };
    // Finish argument validation before selecting storage or issuing any writes.
    let event: WorkflowEvent | null = null; let revision = 0; let metadata: { eventId: string; at: string } | undefined;
    if (command === 'create') {
      id = randomUUID();
      event = parseEvent({ schemaVersion: 1, runId: id, eventId: randomUUID(), expectedRevision: 0, at: now(), type: 'run.created', payload: {
        repository: { id: required('repository-id'), root: required('repository-root') }, story: { id: required('story'), issue: number('issue') }, baselineSha: required('baseline'),
      } });
    } else if (command !== 'status') {
      if (command === 'recover' && options.has('inspect')) demand([...options.keys()].every(key => ['inspect', 'json'].includes(key)), 'INVALID_ARGUMENTS');
      else {
        revision = number('revision'); metadata = replayMetadata();
        if (options.has('lock-token')) uuid(options.get('lock-token'));
        if (command !== 'recover') event = parseEvent({ schemaVersion: 1, runId: id, ...metadata, expectedRevision: revision,
          type: command === 'pause' ? 'run.paused' : command === 'resume' ? 'run.resumed' : 'run.cancelled',
          payload: command === 'cancel' ? { reason: { code: required('reason'), evidence: [] } } : {},
        });
      }
    }
    validated = true;
    const store = context.store ?? new WorkflowStore();
    const report = command === 'create' ? await store.create(event)
      : command === 'status' || options.has('inspect') ? await store.status(id)
      : command === 'recover' ? await store.recover(id, revision, { lockToken: options.get('lock-token'), ...metadata })
      : await store.apply(id, event, 'operator');
    return { code: report.exitCode, stdout: JSON.stringify({ ...report, request: event }, null, 2) + '\n', stderr: '' };
  } catch (error) {
    const code = error instanceof WorkflowError && error.code === 'UNSUPPORTED_STORAGE_PLATFORM' ? 3 : validated ? 1 : 2;
    return { code, stdout: JSON.stringify({ schemaVersion: 1, operation: 'run', storage: { health: 'blocked', code: code === 3 ? 'UNSUPPORTED_STORAGE_PLATFORM' : validated ? 'WORKFLOW_FAILURE' : 'INVALID_ARGUMENTS' }, exitCode: code }) + '\n', stderr: '' };
  }
}
