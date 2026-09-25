import { describe, expect, it } from 'vitest';
import {
  JsonLineDecoder,
  MAX_FRAME_BYTES,
  ProtocolError,
  validateEventMessage,
  validateHello,
  validateSnapshot,
} from './protocol.js';

const source = { kind: 'local-connector' as const, instanceId: 'sim-1' };
const token = 'a'.repeat(64);
const agents = [
  { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'idle', activity: 'Waiting for a task' },
  { agent: { id: 'mock-agent-mina', displayName: 'Mina' }, state: 'working', activity: 'Reviewing changes' },
  { agent: { id: 'mock-agent-sol', displayName: 'Sol' }, state: 'idle', activity: 'Taking a coffee break' },
];
const hello = () => ({ kind: 'hello', version: 1, token, source });
const snapshot = () => ({ kind: 'snapshot', version: 1, source, agents: structuredClone(agents) });
const event = () => ({
  kind: 'event', version: 1,
  event: {
    id: 'evt-1', type: 'agent.state.changed', timestamp: '2026-09-25T12:00:00.000Z',
    source, payload: { agent: { id: 'mock-agent-ari', displayName: 'Ari' }, state: 'working', activity: 'Working on a task' },
  },
});

describe('JSON Lines framing', () => {
  it('reassembles fragments and parses multiple frames in one input', () => {
    const decoder = new JsonLineDecoder();
    expect(decoder.push(Buffer.from('{"kind":"he'))).toEqual([]);
    expect(decoder.push(Buffer.from('llo"}\n{"kind":"event"}\n'))).toEqual([
      { kind: 'hello' }, { kind: 'event' },
    ]);
    expect(() => decoder.finish()).not.toThrow();
  });

  it('rejects malformed JSON, blank lines, CR, invalid UTF-8, and partial EOF', () => {
    for (const bytes of [
      Buffer.from('{bad}\n'), Buffer.from('\n'), Buffer.from('{}\r\n'),
      Buffer.from([0xc3, 0x28, 0x0a]),
    ]) {
      expect(() => new JsonLineDecoder().push(bytes)).toThrow();
    }
    const partial = new JsonLineDecoder();
    partial.push(Buffer.from('{}'));
    expect(() => partial.finish()).toThrow();
  });

  it('allows the exact byte limit and rejects one more byte without unbounded buffering', () => {
    const exact = JSON.stringify({ text: 'x'.repeat(MAX_FRAME_BYTES - 11) });
    expect(Buffer.byteLength(exact)).toBe(MAX_FRAME_BYTES);
    expect(new JsonLineDecoder().push(Buffer.from(`${exact}\n`))).toHaveLength(1);
    const decoder = new JsonLineDecoder();
    expect(() => decoder.push(Buffer.alloc(MAX_FRAME_BYTES + 1, 0x61))).toThrow();
    expect(decoder.bufferedBytes).toBeLessThanOrEqual(MAX_FRAME_BYTES);
  });

  it('classifies only parsing failures as invalid_json, preserving handler errors', () => {
    expect(() => new JsonLineDecoder().push(Buffer.from('{bad}\n'))).toThrow('invalid_json');
    expect(() => new JsonLineDecoder().push(Buffer.from('{}\n'), () => {
      throw new ProtocolError('authentication_failed');
    })).toThrow('authentication_failed');
    expect(() => new JsonLineDecoder().push(Buffer.from(`${JSON.stringify({ ...hello(), version: 2 })}\n`), (message) => {
      validateHello(message);
    })).toThrow('unsupported_version');
  });
});

describe('strict wire validation', () => {
  it('accepts a valid hello and rejects wrong version, malformed token, and unknown fields', () => {
    expect(validateHello(hello())).toMatchObject({ source });
    expect(() => validateHello({ ...hello(), version: 2 })).toThrow();
    expect(() => validateHello({ ...hello(), token: 'short' })).toThrow();
    expect(() => validateHello({ ...hello(), extra: true })).toThrow();
  });

  it('requires a complete three-agent snapshot with matching source', () => {
    expect(validateSnapshot(snapshot(), source).agents).toHaveLength(3);
    expect(() => validateSnapshot({ ...snapshot(), agents: agents.slice(0, 2) }, source)).toThrow();
    expect(() => validateSnapshot({ ...snapshot(), agents: [agents[0], agents[0], agents[2]] }, source)).toThrow();
    expect(() => validateSnapshot({ ...snapshot(), agents: [agents[0], agents[1], {
      ...agents[2], agent: { id: 'unknown', displayName: 'Other' },
    }] }, source)).toThrow();
    expect(() => validateSnapshot(snapshot(), { ...source, instanceId: 'other' })).toThrow();
  });

  it('validates complete events, identity, lifecycle, activity, reason, and timestamp', () => {
    expect(validateEventMessage(event(), source).payload.state).toBe('working');
    const withReason = event();
    Object.assign(withReason.event.payload, { reason: 'capacity_exhausted' });
    expect(validateEventMessage(withReason, source).payload.reason).toBe('capacity_exhausted');
    for (const value of [
      { ...event(), event: { ...event().event, id: '' } },
      { ...event(), event: { ...event().event, type: 'unknown' } },
      { ...event(), event: { ...event().event, timestamp: '2026-02-30T12:00:00.000Z' } },
      { ...event(), event: { ...event().event, source: { ...source, instanceId: 'other' } } },
      { ...event(), event: { ...event().event, payload: { ...event().event.payload, state: 'break' } } },
      { ...event(), event: { ...event().event, payload: { ...event().event.payload, activity: 'x'.repeat(513) } } },
      { ...event(), event: { ...event().event, payload: { ...event().event.payload, activity: '' } } },
      { ...event(), event: { ...event().event, payload: { ...event().event.payload, reason: 'unknown' } } },
      { ...event(), event: { ...event().event, payload: { ...event().event.payload, agent: { id: 'mock-agent-ari', displayName: 'Wrong' } } } },
      { ...event(), event: { ...event().event, payload: { ...event().event.payload, extra: true } } },
      { ...event(), extra: true },
    ]) {
      expect(() => validateEventMessage(value, source)).toThrow();
    }
  });
});
