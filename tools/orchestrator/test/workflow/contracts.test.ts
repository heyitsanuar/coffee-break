import { expect, it } from 'vitest';
import { canonical, parseEvent, parseState } from '../../src/workflow/contracts.js';
import { event, identity, initial } from './fixtures.js';

it('strictly validates versioned identity and event/state fields', () => {
  const created = event('run.created', identity);
  expect(parseEvent(JSON.parse(canonical(created)))).toEqual(created);
  expect(parseState(initial())).toEqual(initial());
  for (const change of [{ schemaVersion: 2 }, { type: 'approve' }, { actor: 'PO' }, { runId: '../escape' }, { expectedRevision: -1 }, { at: 'not-a-date' }, { payload: { ...identity, baselineSha: 'short' } }]) {
    expect(() => parseEvent({ ...created, ...change })).toThrow();
  }
  const missing = { ...created } as Record<string, unknown>; delete missing.eventId;
  expect(() => parseEvent(missing)).toThrow();
  for (const change of [{ schemaVersion: 9 }, { stage: 'handoff', status: 'awaiting_approval' }, { approvalRefs: [{ actor: 'PO' }] }, { journalSequence: -1 }, { status: 'paused', pausedFrom: null }]) expect(() => parseState({ ...initial(), ...change })).toThrow();
});
it('canonicalizes key order and rejects non-JSON, deep and oversized data', () => {
  expect(canonical({ b: 2, a: { z: 1, y: 0 } })).toBe(canonical({ a: { y: 0, z: 1 }, b: 2 }));
  for (const value of [NaN, undefined, new Date(), { a: undefined }, 'x'.repeat(70_000)]) expect(() => canonical(value)).toThrow();
  let deep: unknown = null; for (let i = 0; i < 30; i++) deep = { deep };
  expect(() => canonical(deep)).toThrow();
});
