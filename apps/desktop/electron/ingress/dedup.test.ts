import { describe, expect, it } from 'vitest';
import { RecentEventIds } from './dedup.js';

describe('bounded event deduplication', () => {
  it('keys by source and event ID without refreshing duplicates', () => {
    const ids = new RecentEventIds(2);
    expect(ids.accept('source-a', 'evt-1')).toBe(true);
    expect(ids.accept('source-a', 'evt-2')).toBe(true);
    expect(ids.accept('source-a', 'evt-1')).toBe(false);
    expect(ids.accept('source-b', 'evt-1')).toBe(true);
    expect(ids.size).toBe(2);
    expect(ids.accept('source-a', 'evt-1')).toBe(true);
    ids.clear();
    expect(ids.size).toBe(0);
  });

  it('retains at most the default 4,096 accepted keys', () => {
    const ids = new RecentEventIds();
    for (let index = 0; index <= 4_096; index++) {
      expect(ids.accept('source', `evt-${index}`)).toBe(true);
    }
    expect(ids.size).toBe(4_096);
    expect(ids.accept('source', 'evt-0')).toBe(true);
    expect(ids.accept('source', 'evt-4096')).toBe(false);
  });
});
