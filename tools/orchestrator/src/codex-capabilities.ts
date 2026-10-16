import type { Check } from './contracts.js';
import { POLICY, sha256 } from './policy.js';

export const supportedVersion = (text: string): boolean => text.trim() === `codex-cli ${POLICY.codexVersion}`;
interface DeclaredOption { argument: string | null; description: string }

function declaredOptions(help: string): Map<string, DeclaredOption> | null {
  const lines = help.split(/\r?\n/);
  const start = lines.indexOf('Options:');
  if (start < 0 || lines.lastIndexOf('Options:') !== start) return null;
  const options = new Map<string, DeclaredOption>();
  let previous: DeclaredOption | undefined;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    // Known Clap declaration columns are two spaces (aliases/compact help)
    // and six spaces (long-only). Ten-space description lines are prose.
    const declaration = /^(?: {2}| {6})(?:-[A-Za-z0-9], +)?(--[a-z][a-z0-9-]*)(?:[ =](<[A-Z][A-Z0-9_]*>)(?:\.\.\.)?)?(?: {2,}(\S.*))? *$/.exec(line);
    if (declaration) {
      const [, flag, argument, description] = declaration;
      if (options.has(flag)) return null;
      previous = { argument: argument ?? null, description: description ?? '' };
      options.set(flag, previous);
    } else if (/^ {8,}\S/.test(line) && previous) previous.description += ' ' + line.trim();
    else if (line.trim()) previous = undefined;
  }
  return options.size ? options : null;
}

export function detectCapabilities(execHelp: string, sandboxHelp: string): Check[] {
  const execOptions = declaredOptions(execHelp);
  const sandboxOptions = declaredOptions(sandboxHelp);
  const exec = /^Usage: codex exec(?: |$)/m.test(execHelp) && execOptions !== null;
  const has = (options: Map<string, DeclaredOption> | null, flag: string, argument: string | null = null): boolean => options?.get(flag)?.argument === argument;
  const requirements: Array<[string, boolean]> = [
    ['noninteractive', exec && /non-interactively/.test(execHelp) && /stdin/.test(execHelp)],
    ['jsonl', exec && has(execOptions, '--json') && /\bJSONL\b/.test(execOptions?.get('--json')?.description ?? '')],
    ['structured-final', exec && has(execOptions, '--output-schema', '<FILE>') && has(execOptions, '--output-last-message', '<FILE>')],
    ['working-directory', exec && has(execOptions, '--cd', '<DIR>')],
    ['read-only-interface', exec && has(execOptions, '--sandbox', '<SANDBOX_MODE>') && /\bread-only\b/.test(execOptions?.get('--sandbox')?.description ?? '')],
    ['images', exec && has(execOptions, '--image', '<FILE>')],
    ['config-restriction-interface', exec && has(execOptions, '--ignore-user-config') && has(execOptions, '--disable', '<FEATURE>')],
    ['native-sandbox-interface', /^Usage: codex sandbox(?: |$)/m.test(sandboxHelp) && has(sandboxOptions, '--permission-profile', '<NAME>') && has(sandboxOptions, '--include-managed-config') && has(sandboxOptions, '--cd', '<DIR>')],
  ];
  return requirements.map(([id, found]) => ({ id: `codex.${id}`, required: true, status: found ? 'pass' : 'unsupported', evidenceType: 'metadata', reason: found ? 'Installed help advertises this interface; enforcement is checked separately.' : 'Required interface absent or unrecognized in installed help.', evidence: { helpDigest: sha256(id === 'native-sandbox-interface' ? sandboxHelp : execHelp) } }));
}
