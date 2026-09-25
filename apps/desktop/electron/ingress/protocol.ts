import type {
  AgentCurrentState,
  AgentStateChangedEvent,
  EventSource,
} from '@coffee-break/contracts';

export const PROTOCOL_VERSION = 1;
export const MAX_FRAME_BYTES = 16_384;

export interface HelloMessage {
  kind: 'hello';
  version: 1;
  token: string;
  source: EventSource;
}

export interface SnapshotMessage {
  kind: 'snapshot';
  version: 1;
  source: EventSource;
  agents: AgentCurrentState[];
}

export const KNOWN_AGENTS = {
  'mock-agent-ari': 'Ari',
  'mock-agent-mina': 'Mina',
  'mock-agent-sol': 'Sol',
} as const;

export class ProtocolError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export class JsonLineDecoder {
  private buffered = Buffer.alloc(0);

  get bufferedBytes(): number {
    return this.buffered.length;
  }

  push(chunk: Buffer, onMessage?: (message: unknown) => void): unknown[] {
    const messages: unknown[] = [];
    let offset = 0;
    while (offset < chunk.length) {
      const lineEnd = chunk.indexOf(0x0a, offset);
      const end = lineEnd === -1 ? chunk.length : lineEnd;
      const segment = chunk.subarray(offset, end);
      if (this.buffered.length + segment.length > MAX_FRAME_BYTES) {
        throw new ProtocolError('frame_too_large');
      }
      this.buffered = Buffer.concat([this.buffered, segment]);
      if (lineEnd === -1) break;
      const frame = this.buffered;
      this.buffered = Buffer.alloc(0);
      if (frame.length === 0 || frame.includes(0x0d)) {
        throw new ProtocolError('invalid_framing');
      }
      let decoded: string;
      try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(frame);
      } catch {
        throw new ProtocolError('invalid_utf8');
      }
      let message: unknown;
      try {
        message = JSON.parse(decoded);
      } catch {
        throw new ProtocolError('invalid_json');
      }
      messages.push(message);
      onMessage?.(message);
      offset = lineEnd + 1;
    }
    return messages;
  }

  finish(): void {
    if (this.buffered.length !== 0) throw new ProtocolError('partial_frame');
  }
}

const record = (value: unknown, code: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProtocolError(code);
  }
  return value as Record<string, unknown>;
};

const keys = (value: Record<string, unknown>, required: string[], optional: string[] = []): void => {
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !Object.hasOwn(value, key))
    || Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ProtocolError('invalid_fields');
  }
};

const identifier = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value)) {
    throw new ProtocolError('invalid_identifier');
  }
  return value;
};

const text = (value: unknown, maxBytes: number): string => {
  if (typeof value !== 'string' || value.trim() !== value
    || Buffer.byteLength(value, 'utf8') < 1 || Buffer.byteLength(value, 'utf8') > maxBytes
    || /[\x00-\x1f\x7f]/.test(value)
    || Buffer.from(value, 'utf8').toString('utf8') !== value) {
    throw new ProtocolError('invalid_text');
  }
  return value;
};

const sourceValue = (value: unknown): EventSource => {
  const object = record(value, 'invalid_source');
  keys(object, ['kind', 'instanceId']);
  if (object.kind !== 'local-connector') throw new ProtocolError('invalid_source');
  return { kind: 'local-connector', instanceId: identifier(object.instanceId) };
};

const sameSource = (value: unknown, expected: EventSource): EventSource => {
  const source = sourceValue(value);
  if (source.instanceId !== expected.instanceId) throw new ProtocolError('source_mismatch');
  return source;
};

const agentState = (value: unknown): AgentCurrentState => {
  const object = record(value, 'invalid_agent_state');
  keys(object, ['agent', 'state', 'activity'], ['reason']);
  const agent = record(object.agent, 'invalid_agent');
  keys(agent, ['id', 'displayName']);
  const knownName = KNOWN_AGENTS[agent.id as keyof typeof KNOWN_AGENTS];
  if (!knownName || agent.displayName !== knownName) throw new ProtocolError('unknown_agent');
  text(agent.displayName, 64);
  if (!['idle', 'working', 'waiting', 'completed', 'error'].includes(object.state as string)) {
    throw new ProtocolError('invalid_state');
  }
  const activity = text(object.activity, 512);
  if (Object.hasOwn(object, 'reason')
    && !['approval_required', 'capacity_exhausted'].includes(object.reason as string)) {
    throw new ProtocolError('invalid_reason');
  }
  return {
    agent: { id: agent.id as string, displayName: knownName },
    state: object.state as AgentCurrentState['state'],
    activity,
    ...(Object.hasOwn(object, 'reason') ? { reason: object.reason as AgentCurrentState['reason'] } : {}),
  };
};

const versioned = (value: unknown, kind: string, required: string[]): Record<string, unknown> => {
  const object = record(value, 'invalid_message');
  keys(object, ['kind', 'version', ...required]);
  if (object.kind !== kind) throw new ProtocolError('invalid_kind');
  if (object.version !== PROTOCOL_VERSION) throw new ProtocolError('unsupported_version');
  return object;
};

export function validateHello(value: unknown): HelloMessage {
  const object = versioned(value, 'hello', ['token', 'source']);
  if (typeof object.token !== 'string' || !/^[0-9a-f]{64}$/.test(object.token)) {
    throw new ProtocolError('invalid_token');
  }
  return { kind: 'hello', version: 1, token: object.token, source: sourceValue(object.source) };
}

export function validateSnapshot(value: unknown, expected: EventSource): SnapshotMessage {
  const object = versioned(value, 'snapshot', ['source', 'agents']);
  const source = sameSource(object.source, expected);
  if (!Array.isArray(object.agents) || object.agents.length !== 3) {
    throw new ProtocolError('invalid_snapshot');
  }
  const agents = object.agents.map(agentState);
  if (new Set(agents.map((entry) => entry.agent.id)).size !== 3) {
    throw new ProtocolError('invalid_snapshot');
  }
  return { kind: 'snapshot', version: 1, source, agents };
}

export function validateEventMessage(value: unknown, expected: EventSource): AgentStateChangedEvent {
  const message = versioned(value, 'event', ['event']);
  const event = record(message.event, 'invalid_event');
  keys(event, ['id', 'type', 'timestamp', 'source', 'payload']);
  const id = identifier(event.id);
  if (event.type !== 'agent.state.changed') throw new ProtocolError('invalid_event_type');
  if (typeof event.timestamp !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.timestamp)
    || Number.isNaN(Date.parse(event.timestamp))
    || new Date(event.timestamp).toISOString() !== event.timestamp) {
    throw new ProtocolError('invalid_timestamp');
  }
  return {
    id,
    type: 'agent.state.changed',
    timestamp: event.timestamp,
    source: sameSource(event.source, expected),
    payload: agentState(event.payload),
  };
}

export function encodeFrame(value: unknown): Buffer {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8');
  if (bytes.length > MAX_FRAME_BYTES) throw new ProtocolError('frame_too_large');
  return Buffer.concat([bytes, Buffer.from('\n')]);
}
