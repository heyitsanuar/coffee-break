import { randomUUID } from 'node:crypto';
import { symlink, link, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { harness, requestId } from './fixtures.js';

it('allows only exact typed artifact names and rejects traversal', async () => {
  const f = await harness();
  try {
    for (const name of ['job-a.json', '../job-' + 'a'.repeat(64) + '.json', `preparation-${requestId}.json.bak`, 'launch.json']) await expect(f.dir.create(name, Buffer.from('{}'))).rejects.toThrow('UNSAFE_PATH');
    for (const name of [`job-${'a'.repeat(64)}.json`, `projection-${'b'.repeat(64)}.json`, `preparation-${randomUUID()}.json`, `admission-${randomUUID()}.json`]) { await f.dir.create(name, Buffer.from('{}')); expect(await f.dir.read(name, 64)).toEqual(Buffer.from('{}')); }
  } finally { await f.clean(); }
});
it.each(['symlink', 'hardlink'] as const)('rejects a %s substituted preparation receipt without reading its target', async kind => {
  const f = await harness();
  try {
    await f.prepare(); const receipt = join(f.dir.path, `preparation-${requestId}.json`); const target = join(f.storage, 'synthetic-target.txt'); await writeFile(target, 'fixture only'); await unlink(receipt);
    if (kind === 'symlink') await symlink(target, receipt); else await link(target, receipt);
    await expect(f.store.inspectDesigner(f.runId, requestId)).rejects.toThrow(); expect(await readFile(target, 'utf8')).toBe('fixture only');
  } finally { await f.clean(); }
});
