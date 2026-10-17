import { mkdtemp, realpath, rm, appendFile, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { appendRecord, makeRecord, replay } from '../../src/workflow/journal.js';
import { StoragePaths } from '../../src/workflow/paths.js';
import { canonical, LIMITS } from '../../src/workflow/contracts.js';
import { event, identity, runId } from './fixtures.js';

it('journals accepted, rejected, duplicate, conflicting and stale dispositions with distinct counters', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-journal-')));
  try {
    const dir = await new StoragePaths(root).create(runId); await dir.create('journal.jsonl', Buffer.alloc(0));
    const created = event('run.created', identity); let view = await replay(dir);
    for (const input of [created, created, { ...created, at: '2026-10-17T12:00:00.000Z' }, { ...event('run.resumed', {}), expectedRevision: 0 }]) {
      const record = makeRecord(view, input, 'operator'); await appendRecord(dir, view, record); view = await replay(dir);
    }
    expect(view.health).toBe('ok'); expect(view.records.map(r => r.disposition)).toEqual(['accepted', 'duplicate', 'conflict', 'stale']);
    expect(view.records[1]).toMatchObject({ originalSequence: 1, originalDisposition: 'accepted' });
    expect(view.state).toMatchObject({ revision: 1, journalSequence: 4 });
    const invalid = { ...event('run.paused', {}, view.state), type: 'unknown', actor: 'PO' };
    await appendRecord(dir, view, makeRecord(view, invalid, 'operator'));
    view = await replay(dir); expect(view.records.at(-1)?.disposition).toBe('rejected'); expect(view.records.at(-1)?.request.event).toBeNull();
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('preserves a torn final record and rejects interior corruption, sequence gaps, hashes and versions', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-journal-')));
  try {
    const dir = await new StoragePaths(root).create(runId); await dir.create('journal.jsonl', Buffer.alloc(0));
    const view = await replay(dir); await appendRecord(dir, view, makeRecord(view, event('run.created', identity), 'operator'));
    const path = join(dir.path, 'journal.jsonl'); const baseline = await readFile(path);
    await appendFile(path, '{"torn":'); const torn = await readFile(path);
    expect(await replay(dir)).toMatchObject({ health: 'torn', state: { revision: 1 } }); expect(await readFile(path)).toEqual(torn);
    for (const tail of ['bad\n', canonical({ ...JSON.parse(baseline.toString()), sequence: 9 }, LIMITS.record) + '\n', canonical({ ...JSON.parse(baseline.toString()), hash: '0'.repeat(64) }, LIMITS.record) + '\n']) {
      await writeFile(path, Buffer.concat([baseline, Buffer.from(tail)])); expect((await replay(dir)).health).toBe('corrupt');
    }
    await writeFile(path, canonical({ ...JSON.parse(baseline.toString()), schemaVersion: 2 }, LIMITS.record) + '\n');
    expect((await replay(dir)).health).toBe('unsupported');
  } finally { await rm(root, { recursive: true, force: true }); }
});
it.each(['beforeAppend', 'beforeJournalSync', 'afterJournalSync', 'partialWrite'] as const)('retains evidence on %s without assuming rollback', async point => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-journal-')));
  try {
    const dir = await new StoragePaths(root).create(runId); await dir.create('journal.jsonl', Buffer.alloc(0)); const view = await replay(dir);
    const record = makeRecord(view, event('run.created', identity), 'operator');
    await expect(appendRecord(dir, view, record, async (where, handle, bytes) => {
      if (point === 'partialWrite' && where === 'beforeWrite') { await handle!.write(bytes!.subarray(0, 17)); throw new Error('fault'); }
      if (where === point) throw new Error('fault');
    })).rejects.toThrow('fault');
    const after = await replay(dir);
    expect(after.health).toBe(point === 'partialWrite' ? 'torn' : 'ok');
    expect(after.records.length).toBe(['beforeJournalSync', 'afterJournalSync'].includes(point) ? 1 : 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('blocks oversized records/tails/scans without truncating or dropping the verified prefix', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cb-flow-journal-')));
  try {
    const dir = await new StoragePaths(root).create(runId); await dir.create('journal.jsonl', Buffer.alloc(0));
    const empty = await replay(dir);
    expect(() => makeRecord({ ...empty, records: Array(LIMITS.records).fill({}) }, event('run.created', identity), 'operator')).toThrow('RESOURCE_LIMIT');
    const path = join(dir.path, 'journal.jsonl');
    for (const end of ['', '\n']) { await writeFile(path, 'x'.repeat(LIMITS.record + 1) + end); expect(await replay(dir)).toMatchObject({ health: 'limit', code: 'RESOURCE_LIMIT' }); }
    await writeFile(path, Buffer.alloc(LIMITS.journal + 1)); await expect(replay(dir)).rejects.toThrow('RESOURCE_LIMIT');
  } finally { await rm(root, { recursive: true, force: true }); }
});
