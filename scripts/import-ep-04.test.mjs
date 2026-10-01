import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { runEp04Import, validateEp04Plan } from './import-ep-04.mjs';
const plan = JSON.parse(readFileSync(new URL('../planning/ep-04-issues.json', import.meta.url)));
const history = { number: 44, title: 'US-019 — Establish the Living Office Design Direction',
  body: 'Historical body must remain untouched', state: 'open', html_url: 'https://github.com/example/coffee-break/issues/44' };
const titles = [plan.epic, ...plan.stories].map((item) => `${item.id} — ${item.title}`);
function fake({ failTitle, missingLabels = false, failAccess, initial = [history] } = {}) {
  const issues = structuredClone(initial), calls = [], lines = [];
  let failure = failTitle;
  const gh = (args) => {
    calls.push(args);
    if (['auth', 'repo'].includes(args[0])) {
      if (args[0] === failAccess) throw new Error(`${failAccess} denied`);
      return '';
    }
    if (args[0] === 'api' && args.at(-1).includes('/issues?')) {
      assert.ok(args.includes('--paginate')); assert.match(args.at(-1), /state=all/);
      return JSON.stringify([issues.slice(0, 2), issues.slice(2), [{ title: 'US-020 — PR', pull_request: {} }]]);
    }
    if (args[0] === 'api' && args.at(-1).includes('/labels?')) {
      return JSON.stringify([[{ name: 'type:user-story' }], missingLabels ? [] : [{ name: 'epic:living-office' }]]);
    }
    if (args[0] === 'issue' && args[1] === 'create') {
      const title = args[args.indexOf('--title') + 1];
      if (title === failure) { failure = undefined; throw new Error('creation failed'); }
      const number = 70 + issues.length;
      const item = { number, title, body: args[args.indexOf('--body') + 1], state: 'open',
        html_url: `https://github.com/example/coffee-break/issues/${number}` };
      issues.push(item); return item.html_url;
    }
    throw new Error(`Forbidden mutation or unexpected call: ${args.join(' ')}`);
  };
  return { issues, calls, lines, run: (apply = true, data = plan) => runEp04Import({
    repo: 'example/coffee-break', apply, plan: data, gh, log: (line) => lines.push(line),
  }) };
}
const creates = (api) => api.calls.filter((args) => args[0] === 'issue').map((args) => args[args.indexOf('--title') + 1]);
test('approved plan validates exact IDs, titles, criterion counts and dependencies', () => {
  assert.equal(validateEp04Plan(plan), plan);
  for (const mutate of [p => { p.stories[1].id = 'US-020'; }, p => { p.stories[0].title = 'Other'; },
    p => { p.stories[0].dependencies = ['US-018']; }, p => { p.stories[0].acceptance_criteria.pop(); },
    p => { p.historical_story.number = 45; }]) {
    const data = structuredClone(plan); mutate(data); assert.throws(() => fake().run(true, data), /Invalid|exactly/);
  }
});
test('preview is read-only, paginates, excludes PRs and prints deterministic unassigned mappings', () => {
  const api = fake(); const entries = api.run(false);
  assert.deepEqual(entries.map(e => e.status), Array(6).fill('CREATE'));
  assert.deepEqual(creates(api), []); assert.deepEqual(api.issues, [history]);
  assert.equal(api.lines.filter(l => l.includes('→ not assigned')).length, 6);
  assert.match(entries[1].body, /issues\/44/);
});
test('apply creates exactly epic and five stories, resolves assigned links and preserves #44', () => {
  const api = fake(); api.run();
  assert.deepEqual(creates(api), titles); assert.deepEqual(api.issues[0], history);
  assert.match(api.issues[2].body, /issues\/71/); // Epic assigned number, not planning ID.
  assert.match(api.issues[3].body, /issues\/72/); // US-020 dependency.
  assert.match(api.issues[4].body, /US-021 where existing environment primitives are reused/);
  assert.equal(api.lines.filter(l => /→ #\d+ https:/.test(l)).length, 6);
  assert.doesNotMatch(api.issues[1].body, /issues\/7[1-6]/); // Never inject story numbers into epic.
});
for (const state of ['open', 'closed']) test(`apply skips matching ${state} stories and epic without mutation`, () => {
  const api = fake(); api.run(); api.issues[2].state = state;
  const before = structuredClone(api.issues); const calls = api.calls.length;
  api.run(); assert.deepEqual(api.issues, before);
  assert.equal(api.calls.slice(calls).some(a => a[0] === 'issue'), false);
  assert.match(api.lines.at(-1), /US-024 → #76/);
});
test('known body/title conflicts and duplicate GitHub IDs prevent every write', () => {
  for (const initial of [
    [history, { number: 60, title: titles[2], body: 'conflict' }],
    [history, { number: 60, title: 'US-020: wrong title' }],
    [history, { number: 60, title: titles[1] }, { number: 61, title: titles[1] }],
  ]) {
    const api = fake({ initial }); assert.throws(() => api.run(), /conflict|Multiple/);
    assert.deepEqual(creates(api), []); assert.deepEqual(api.issues, initial);
  }
});
test('partial failure then rerun preserves earlier issues and creates remaining stories once', () => {
  const api = fake({ failTitle: titles[2] });
  assert.throws(() => api.run(), /creation failed/);
  assert.deepEqual(creates(api), titles.slice(0, 3));
  const first = structuredClone(api.issues); assert.equal(first.length, 3);
  const offset = api.calls.length; api.run();
  const rerun = { calls: api.calls.slice(offset) };
  assert.deepEqual(creates(rerun), titles.slice(2));
  assert.deepEqual(api.issues.slice(0, 3), first);
  assert.deepEqual(api.issues.slice(1).map(i => i.title), titles);
  assert.match(api.issues[3].body, /issues\/72/);
});
test('missing labels and historical context fail without writes', () => {
  for (const options of [{ missingLabels: true }, { initial: [] },
    { initial: [{ ...history, number: 45 }] }]) {
    const api = fake(options); assert.throws(() => api.run(), /labels missing|US-019 #44/);
    assert.deepEqual(creates(api), []);
  }
});
for (const failAccess of ['auth', 'repo']) test(`${failAccess} failure prevents writes`, () => {
  const api = fake({ failAccess }); assert.throws(() => api.run(), /denied/); assert.deepEqual(creates(api), []);
});
test('issue appearing between preview and create is rechecked and never overwritten', () => {
  const api = fake(); // Exercise the real apply loop using a competing issue after initial listing.
  let listings = 0;
  assert.throws(() => runEp04Import({ repo: 'example/coffee-break', apply: true, plan, log: () => {},
    gh: args => {
      if (args[0] === 'auth' || args[0] === 'repo') return '';
      if (args.at(-1).includes('/labels?')) return JSON.stringify([[{ name: 'type:user-story' }, { name: 'epic:living-office' }]]);
      if (args.at(-1).includes('/issues?')) return JSON.stringify([[history, ...(++listings > 1 ? [{ title: titles[0], body: 'competing scope', number: 99 }] : [])]]);
      assert.fail('No write allowed');
    } }), /conflicts/);
  assert.deepEqual(api.issues, [history]);
});
test('shell routes EP-04 and fails on auth/repository errors; legacy and EP-03 routing retained', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ep04-shell-'));
  const executable = join(dir, 'gh');
  writeFileSync(executable, '#!/bin/sh\ncase "$1" in\n auth|repo) [ "$1" != "$CB_FAIL_ACCESS" ] ;;\n api) printf "%s" "$CB_TEST_ISSUES_JSON" ;;\n *) exit 99 ;;\nesac\n'); chmodSync(executable, 0o755);
  try {
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, CB_TEST_ISSUES_JSON: JSON.stringify([[history]]) };
    const run = (epic, extra = {}) => spawnSync('bash', ['scripts/import-issues.sh', 'example/coffee-break', ...(epic ? ['--epic', epic] : [])],
      { cwd: join(import.meta.dirname, '..'), env: { ...env, ...extra }, encoding: 'utf8' });
    const result = run('EP-04'); assert.equal(result.status, 0, result.stderr); assert.equal((result.stdout.match(/\[CREATE\]/g) ?? []).length, 6);
    const ep03 = run('EP-03'); assert.equal(ep03.status, 0, ep03.stderr); assert.equal((ep03.stdout.match(/\[CREATE\]/g) ?? []).length, 7);
    const legacy = run(); assert.equal(legacy.status, 0); assert.match(legacy.stdout, /Would create: EP-01/); assert.match(legacy.stdout, /Would create: EP-02/);
    for (const failure of ['auth', 'repo']) { const failed = run('EP-04', { CB_FAIL_ACCESS: failure }); assert.notEqual(failed.status, 0); assert.equal(failed.stdout, ''); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
