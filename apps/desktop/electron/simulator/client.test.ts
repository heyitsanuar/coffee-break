import { EventEmitter } from 'node:events';
import type { Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { parseLaunch, SimulatorClient } from './client.js';

const launch = { host: '127.0.0.1' as const, port: 12345, token: 'a'.repeat(64) };

class FakeSocket extends EventEmitter {
  written: unknown[] = [];
  destroyed = false;
  write(bytes: Buffer) { this.written.push(JSON.parse(bytes.toString('utf8').trim())); return true; }
  destroy() { this.destroyed = true; this.emit('close'); return this; }
  data(bytes: Buffer) { this.emit('data', bytes); }
}

function frame(value: unknown): Buffer { return Buffer.from(`${JSON.stringify(value)}\n`); }

describe('simulator protocol client', () => {
  it('validates private launch credentials without reflecting them in errors', () => {
    expect(parseLaunch(launch)).toEqual(launch);
    for (const invalid of [{ ...launch, host: '0.0.0.0' }, { ...launch, port: 0 }, { ...launch, token: 'bad' }]) {
      expect(() => parseLaunch(invalid)).toThrow('invalid_launch');
    }
  });

  it('waits for fragmented/coalesced acknowledgments and sends one snapshot before any event', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-25T12:00:00.000Z'));
      const socket = new FakeSocket();
      const failures: string[] = [];
      const client = new SimulatorClient(undefined, (code) => failures.push(code),
        (() => socket as unknown as Socket) as typeof import('node:net').connect);
      client.start(launch);
      expect(socket.written).toEqual([]);
      socket.emit('connect');
      expect(socket.written[0]).toEqual({ kind: 'hello', version: 1, token: launch.token, source: client.source });
      const hello = frame({ kind: 'hello-accepted', version: 1 });
      socket.data(hello.subarray(0, 4));
      expect(socket.written).toHaveLength(1);
      socket.data(hello.subarray(4));
      expect(socket.written[1]).toMatchObject({ kind: 'snapshot', version: 1, agents: expect.any(Array) });
      expect((socket.written[1] as { agents: unknown[] }).agents).toHaveLength(3);
      expect(socket.written).toHaveLength(2);
      const accepted = frame({ kind: 'snapshot-accepted', version: 1, revision: 1 });
      socket.data(accepted.subarray(0, 2));
      expect(socket.written).toHaveLength(2);
      socket.data(accepted.subarray(2));
      vi.advanceTimersByTime(5_000);
      expect((socket.written.slice(2) as Array<{ event: { id: string } }>).map((item) => item.event.id))
        .toEqual(['sim-001', 'sim-002', 'sim-003', 'sim-004', 'sim-005']);
      expect(client.phase).toBe('connected-idle');
      vi.advanceTimersByTime(100_000);
      expect(socket.written).toHaveLength(7);
      expect(socket.destroyed).toBe(false);
      expect(failures).toEqual([]);
      client.stop();
      expect(socket.destroyed).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it('fails closed on authentication failure, invalid framing and missing ready acknowledgment', () => {
    vi.useFakeTimers();
    try {
      for (const bytes of [frame({ kind: 'wrong', version: 1 }), Buffer.from([0xc3, 0x28, 0x0a]), Buffer.alloc(16_385, 0x61)]) {
        const socket = new FakeSocket();
        const failures: string[] = [];
        const client = new SimulatorClient(undefined, (code) => failures.push(code),
          (() => socket as unknown as Socket) as typeof import('node:net').connect);
        client.start(launch);
        socket.emit('connect');
        socket.data(bytes);
        expect(socket.destroyed).toBe(true);
        expect(failures).toEqual(['protocol_error']);
        expect(failures.join()).not.toContain(launch.token);
      }
      const socket = new FakeSocket();
      const failures: string[] = [];
      const client = new SimulatorClient(undefined, (code) => failures.push(code),
        (() => socket as unknown as Socket) as typeof import('node:net').connect);
      client.start(launch);
      socket.emit('connect');
      socket.data(frame({ kind: 'hello-accepted', version: 1 }));
      vi.advanceTimersByTime(5_000);
      expect(failures).toEqual(['ack_timeout']);
      expect(socket.destroyed).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it('uses a fresh source ID for each client process instance', () => {
    expect(new SimulatorClient().source.instanceId).not.toBe(new SimulatorClient().source.instanceId);
  });

  it('cancels work when stopped before ready and while events are pending', () => {
    vi.useFakeTimers();
    try {
      const early = new FakeSocket();
      const earlyClient = new SimulatorClient(undefined, () => {},
        (() => early as unknown as Socket) as typeof import('node:net').connect);
      earlyClient.start(launch);
      early.emit('connect');
      earlyClient.stop();
      vi.advanceTimersByTime(20_000);
      expect(early.written).toHaveLength(1);
      expect(early.destroyed).toBe(true);

      const active = new FakeSocket();
      const activeClient = new SimulatorClient(undefined, () => {},
        (() => active as unknown as Socket) as typeof import('node:net').connect);
      activeClient.start(launch);
      active.emit('connect');
      active.data(Buffer.concat([
        frame({ kind: 'hello-accepted', version: 1 }),
        frame({ kind: 'snapshot-accepted', version: 1, revision: 1 }),
      ]));
      vi.advanceTimersByTime(1_000);
      activeClient.stop();
      activeClient.stop();
      vi.advanceTimersByTime(20_000);
      expect((active.written.slice(2) as Array<{ event: { id: string } }>).map((item) => item.event.id))
        .toEqual(['sim-001']);
      expect(active.destroyed).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});
