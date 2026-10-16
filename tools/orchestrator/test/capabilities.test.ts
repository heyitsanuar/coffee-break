import { expect, it } from 'vitest';
import { detectCapabilities, supportedVersion } from '../src/codex-capabilities.js';

const execHelp = `Run Codex non-interactively
Usage: codex exec [OPTIONS] [PROMPT]
instructions are read from stdin
Options:
  --json  Print events to stdout as JSONL
  --output-schema <FILE>  model's final response shape
  --output-last-message <FILE>  last message
  -C, --cd <DIR>  working root
  -s, --sandbox <SANDBOX_MODE>  read-only, workspace-write
  -i, --image <FILE>  image(s)
  --ignore-user-config  Do not load config
  --disable <FEATURE>  Disable feature`;
const sandboxHelp = `Usage: codex sandbox [OPTIONS] [COMMAND]
Options:
  -P, --permission-profile <NAME>  Named permissions
  --include-managed-config  Include managed requirements
  -C, --cd <DIR>  Working directory`;

it('detects each required interface separately, never treating JSONL as final-schema output', () => {
  const all = detectCapabilities(execHelp, sandboxHelp);
  expect(all.every(c => c.status === 'pass')).toBe(true);
  for (const flag of ['--json', '--output-schema', '--output-last-message', '--cd', '--sandbox', '--image']) {
    const changed = execHelp.split('\n').filter(line => !line.includes(flag)).join('\n');
    expect(detectCapabilities(changed, sandboxHelp).some(c => c.status !== 'pass')).toBe(true);
  }
  expect(detectCapabilities('success', 'success').every(c => c.status !== 'pass')).toBe(true);
  expect(detectCapabilities(execHelp, 'unknown').some(c => c.status !== 'pass')).toBe(true);
});
it.each([
  ['--image', '--image-removed', 'images'],
  ['--json', '--json-disabled', 'jsonl'],
  ['--output-schema', '--output-schema-old', 'structured-final'],
  ['--image', '--old-image', 'images'],
  ['--json', '--prefix-json', 'jsonl'],
])('rejects a renamed declaration %s -> %s', (flag, renamed, capability) => {
  const checks = detectCapabilities(execHelp.replace(flag, renamed), sandboxHelp);
  expect(checks.find(check => check.id === `codex.${capability}`)?.status).toBe('unsupported');
});
it.each([
  ['--image', 'images'], ['--json', 'jsonl'], ['--output-schema', 'structured-final'],
])('does not accept %s mentioned only in explanatory prose', (flag, capability) => {
  const changed = execHelp.split('\n').map(line => line.includes(flag) ? `          Previously supported ${line.trim()}` : line).join('\n');
  expect(detectCapabilities(changed, sandboxHelp).find(check => check.id === `codex.${capability}`)?.status).toBe('unsupported');
});
it('accepts declared aliases, equals arguments, ellipses and wrapped descriptions', () => {
  const formatted = execHelp
    .replace('  --json  Print events to stdout as JSONL', '      --json\n          Print events to stdout as JSONL')
    .replace('  --output-schema <FILE>', '      --output-schema=<FILE>')
    .replace('  -i, --image <FILE>', '  -i, --image <FILE>...');
  expect(detectCapabilities(formatted, sandboxHelp).every(check => check.status === 'pass')).toBe(true);
});
it('rejects unknown help sections, argument shapes and JSONL/final-output confusion', () => {
  for (const changed of [execHelp.replace('Options:', 'Available switches:'), execHelp.replaceAll('  --', '\t--'), execHelp.replace('--image <FILE>', '--image [FILE]')]) {
    expect(detectCapabilities(changed, sandboxHelp).some(check => check.status !== 'pass')).toBe(true);
  }
  const changed = execHelp.replace('Print events to stdout as JSONL', 'Print ordinary text');
  const checks = detectCapabilities(changed, sandboxHelp);
  expect(checks.find(check => check.id === 'codex.jsonl')?.status).toBe('unsupported');
  expect(checks.find(check => check.id === 'codex.structured-final')?.status).toBe('pass');
});
it('requires an exact tested Codex version, including the prerelease suffix', () => {
  expect(supportedVersion('codex-cli 0.162.0-alpha.17.2\n')).toBe(true);
  for (const text of ['codex-cli 0.162.0', 'codex-cli 0.162.0-alpha.17.3', 'success', 'codex-cli 0.162.0-alpha.17.2 extra']) expect(supportedVersion(text)).toBe(false);
});
