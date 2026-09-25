import { createInterface } from 'node:readline';
import { SimulatorClient } from './client.js';

// stdin is a private, one-purpose parent channel. EOF also signals parent loss.
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let launched = false;
let stopped = false;
const client = new SimulatorClient(undefined, (code) => finish(1, code));

function finish(status: number, code?: string): void {
  if (stopped) return;
  stopped = true;
  client.stop();
  lines.close();
  process.stdin.destroy();
  if (code) process.stderr.write(`simulator:${code}\n`);
  process.exitCode = status;
}

lines.on('line', (line) => {
  if (stopped) return;
  try {
    const message: unknown = JSON.parse(line);
    if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('invalid_control');
    const item = message as Record<string, unknown>;
    if (!launched && Object.keys(item).sort().join(',') === 'credentials,kind' && item.kind === 'launch') {
      launched = true;
      client.start(item.credentials);
    } else if (launched && Object.keys(item).join(',') === 'kind' && item.kind === 'shutdown') {
      finish(0);
    } else {
      throw new Error('invalid_control');
    }
  } catch {
    finish(1, 'invalid_control');
  }
});
lines.on('close', () => finish(0));
process.on('SIGTERM', () => finish(0));
process.on('SIGINT', () => finish(0));
