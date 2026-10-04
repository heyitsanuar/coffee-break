import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { runEp05Import, validateEp05Plan } from './import-ep-05.mjs';

const plan = JSON.parse(readFileSync(new URL('../planning/ep-05-issues.json', import.meta.url)));
const repo = 'example/coffee-break';
const labels = ['type:user-story', 'epic:north-star-ui-evolution'];
const history = plan.historical_context.map((item) => ({
  number: item.number, title: `${item.id} — ${item.title}`,
  body: 'Historical body must remain untouched', state: 'closed', labels: ['historical'],
  html_url: `https://github.com/${repo}/issues/${item.number}`,
}));
const titles = [plan.epic, ...plan.stories].map((item) => `${item.id} — ${item.title}`);
const epicLists = ['scope', 'out_of_scope', 'design_authority',
  'architectural_constraints', 'visual_principles', 'design_workflow'];

function fake({ failTitle, availableLabels = labels, failAccess, initial = history,
  onList = () => {}, listingLag = false, creationURL } = {}) {
  const issues = structuredClone(initial), calls = [], lines = [];
  const originalCount = issues.length;
  let failure = failTitle, nextNumber = 80;
  const gh = (args) => {
    calls.push(args);
    if (['auth', 'repo'].includes(args[0])) {
      if (args[0] === failAccess) throw new Error(`${failAccess} denied`);
      return '';
    }
    if (args[0] === 'api') {
      assert.ok(args.slice(1, -1).every(arg => ['--paginate', '--slurp'].includes(arg)),
        'Only read-only GitHub API pagination flags are allowed');
    }
    if (args[0] === 'api' && args.at(-1).includes('/issues?')) {
      assert.ok(args.includes('--paginate')); assert.ok(args.includes('--slurp'));
      assert.equal(args.at(-1), `repos/${repo}/issues?state=all&per_page=100`);
      onList({ issues });
      const visible = listingLag ? issues.slice(0, originalCount) : issues;
      return JSON.stringify([visible.slice(0, 1), visible.slice(1), [{ title: titles[1], pull_request: {} }]]);
    }
    if (args[0] === 'api' && args.at(-1).includes('/labels?')) {
      assert.ok(args.includes('--paginate')); assert.ok(args.includes('--slurp'));
      return JSON.stringify([availableLabels.slice(0, 1).map(name => ({ name })),
        availableLabels.slice(1).map(name => ({ name }))]);
    }
    if (args[0] === 'issue' && args[1] === 'create') {
      const title = args[args.indexOf('--title') + 1];
      if (title === failure) { failure = undefined; throw new Error('creation failed'); }
      const number = nextNumber++;
      const item = { number, title, body: args[args.indexOf('--body') + 1], state: 'open',
        labels: args.flatMap((arg, i) => arg === '--label' ? [args[i + 1]] : []),
        html_url: `https://github.com/${repo}/issues/${number}` };
      issues.push(item);
      return creationURL ?? item.html_url;
    }
    throw new Error(`Forbidden mutation or unexpected call: ${args.join(' ')}`);
  };
  return { issues, calls, lines, run: (apply = true, data = plan) => runEp05Import({
    repo, apply, plan: data, gh, log: line => lines.push(line),
  }) };
}
const createCalls = (api) => api.calls.filter(args => args[0] === 'issue' && args[1] === 'create');
const creates = (api) => createCalls(api).map(args => args[args.indexOf('--title') + 1]);
const assertReadOnly = (api) => assert.ok(api.calls.every(args => ['auth', 'repo', 'api'].includes(args[0])));

test('approved EP-05 validates exact IDs, titles, history, criterion counts and ordered dependencies', () => {
  assert.equal(validateEp05Plan(plan), plan);
  const mutations = [
    p => { p.epic.id = 'EP-06'; }, p => { p.epic.title = 'Other'; },
    p => { p.stories.pop(); }, p => { p.stories.push(structuredClone(p.stories[0])); },
    p => { p.stories[1].id = 'US-025'; }, p => { p.stories.reverse(); },
    p => { p.historical_context.pop(); }, p => { p.historical_context.reverse(); },
    p => { p.historical_context[0].number = 47; }, p => { p.historical_context[1].id = 'US-019'; },
    p => { p.historical_context[1].title = 'Other'; },
  ];
  for (let i = 0; i < 6; i++) {
    mutations.push(p => { p.stories[i].title = 'Other'; },
      p => { p.stories[i].epic = 'EP-04'; },
      p => { p.stories[i].dependencies = ['US-019']; },
      p => { p.stories[i].dependencies.push(p.stories[i].dependencies[0]); },
      p => { p.stories[i].acceptance_criteria.pop(); });
  }
  for (const mutate of mutations) {
    const data = structuredClone(plan); mutate(data);
    const api = fake(); assert.throws(() => api.run(true, data), /Invalid|exactly/);
    assert.deepEqual(api.calls, []);
  }
});

test('every required epic and story field rejects missing, blank or wrongly typed content before access', () => {
  for (const field of ['objective', ...epicLists]) {
    for (const value of [undefined, '', [], ['valid', ' '], 42]) {
      const data = structuredClone(plan); data.epic[field] = value;
      const api = fake(); assert.throws(() => api.run(true, data), /Invalid/);
      assert.deepEqual(api.calls, []);
    }
  }
  for (const field of ['user_story', 'objective', 'boundary', 'dependency_notes', 'definition_of_done']) {
    for (const value of [undefined, '', [], ['valid', ' '], 42]) {
      const data = structuredClone(plan); data.stories[0][field] = value;
      const api = fake(); assert.throws(() => api.run(true, data), /Invalid/);
      assert.deepEqual(api.calls, []);
    }
  }
  for (const data of [null, [], 'plan', { ...plan, epic: null }, { ...plan, stories: null }]) {
    const api = fake(); assert.throws(() => api.run(true, data), /Invalid|exactly/);
    assert.deepEqual(api.calls, []);
  }
  for (const [badRepo, apply] of [['invalid', false], [repo, '--apply']]) {
    let called = false;
    assert.throws(() => runEp05Import({ repo: badRepo, apply, plan,
      gh: () => { called = true; } }), /Repository|boolean/);
    assert.equal(called, false);
  }
});

test('preview reads all open/closed issues and prints seven full bodies/mappings without touching labels', () => {
  const api = fake(); const entries = api.run(false);
  assert.deepEqual(entries.map(entry => entry.status), Array(7).fill('CREATE'));
  assertReadOnly(api); assert.deepEqual(api.issues, history);
  assert.equal(api.calls.some(args => args.at(-1).includes('/labels?')), false);
  assert.equal(api.lines.filter(line => line.includes('→ not assigned')).length, 7);
  assert.equal(api.lines.filter(line => line.includes('[CREATE]')).length, 7);
  for (const entry of entries) {
    assert.ok(api.lines.some(line => line.includes(entry.title) && line.includes(entry.body)));
  }
  for (const field of ['objective', ...epicLists]) {
    for (const content of [plan.epic[field]].flat()) assert.ok(entries[0].body.includes(content), field);
  }
  for (const item of history) assert.ok(entries[0].body.includes(`[${item.title}](${item.html_url})`));
  assert.match(entries[1].body, /issues\/51/);
  assert.match(entries[2].body, /- Epic: EP-05\n- Dependencies: US-025/);
  plan.stories.forEach((story, i) => {
    for (const field of ['user_story', 'objective', 'boundary', 'dependency_notes', 'acceptance_criteria', 'definition_of_done']) {
      for (const content of [story[field]].flat()) assert.ok(entries[i + 1].body.includes(content), `${story.id}.${field}`);
    }
  });
});

test('apply creates exactly seven allowlisted issues with assigned epic/history/chain links and no historical edits', () => {
  const api = fake(); api.run();
  assert.deepEqual(creates(api), titles);
  assert.deepEqual(api.issues.slice(0, 2), history);
  assert.equal(api.calls.some(args => args[0] === 'label'), false);
  const added = api.issues.slice(2);
  assert.deepEqual(added.map(item => item.number), [80, 81, 82, 83, 84, 85, 86]);
  assert.deepEqual(added[0].labels, ['epic:north-star-ui-evolution']);
  added.slice(1).forEach((item, i) => {
    assert.deepEqual(item.labels, ['epic:north-star-ui-evolution', 'type:user-story']);
    assert.match(item.body, /- Epic: \[EP-05 — North Star UI Evolution\]\(https:\/\/github.com\/example\/coffee-break\/issues\/80\)/);
    const dependency = i === 0 ? 51 : 80 + i;
    assert.ok(item.body.includes(`https://github.com/${repo}/issues/${dependency}`));
  });
  assert.doesNotMatch(added[0].body, /issues\/8[0-6]/);
  assert.deepEqual(added[0].body.match(/^- US-0\d+ — .+$/gm), titles.slice(1).map(title => `- ${title}`));
  assert.equal(api.lines.filter(line => /→ #\d+ https:/.test(line)).length, 7);
});

test('newly created issues remain available for links when GitHub listings lag', () => {
  const api = fake({ listingLag: true }); api.run();
  assert.deepEqual(creates(api), titles);
  const last = api.issues.at(-1);
  assert.match(last.body, /issues\/80/); assert.match(last.body, /issues\/85/);
});

for (const state of ['open', 'closed']) test(`matching ${state} epic and stories skip without mutation and preview shows assigned mappings`, () => {
  const api = fake(); api.run(); api.issues.slice(2).forEach(item => { item.state = state; });
  const before = structuredClone(api.issues), offset = api.calls.length;
  const entries = api.run(false); assert.deepEqual(entries.map(entry => entry.status), Array(7).fill('SKIP'));
  api.run(); assert.deepEqual(api.issues, before);
  assertReadOnly({ calls: api.calls.slice(offset) });
  assert.match(api.lines.at(-1), /US-030 → #86 https:/);
});

test('known title/body conflicts and duplicate GitHub IDs stop apply without writes', () => {
  for (const initial of [
    [...history, { number: 60, title: titles[2], body: 'conflicting body' }],
    [...history, { number: 60, title: 'US-025: wrong title' }],
    [...history, { number: 60, title: titles[1] }, { number: 61, title: titles[1] }],
    [...history, { ...history[0], number: 62 }],
  ]) {
    const api = fake({ initial }); assert.throws(() => api.run(), /conflict|Multiple/);
    assertReadOnly(api); assert.deepEqual(api.issues, initial);
  }
  const api = fake({ initial: [...history, { number: 60, title: titles[2], body: 'conflict',
    html_url: `https://github.com/${repo}/issues/60` }] });
  assert.equal(api.run(false)[2].status, 'CONFLICT'); assertReadOnly(api);
  assert.ok(api.lines.some(line => line.includes('US-026 → #60')));
});

test('real failed apply at US-026 followed by rerun preserves earlier creations and creates only the remainder', () => {
  const api = fake({ failTitle: titles[2] });
  assert.throws(() => api.run(), /creation failed/);
  assert.deepEqual(creates(api), titles.slice(0, 3));
  const before = structuredClone(api.issues); assert.equal(before.length, 4);
  assert.ok(api.lines.some(line => line.includes('EP-05 → #80')));
  assert.ok(api.lines.some(line => line.includes('US-025 → #81')));
  const offset = api.calls.length; api.run();
  assert.deepEqual(creates({ calls: api.calls.slice(offset) }), titles.slice(2));
  assert.deepEqual(api.issues.slice(0, 4), before);
  assert.deepEqual(api.issues.slice(2).map(item => item.title), titles);
  assert.match(api.issues[4].body, /issues\/81/);
});

test('missing existing labels or missing/conflicting historical context prevents all writes', () => {
  for (const availableLabels of [[], ['type:user-story'], ['epic:north-star-ui-evolution']]) {
    const api = fake({ availableLabels }); assert.throws(() => api.run(), /Required labels missing/);
    assertReadOnly(api); assert.deepEqual(api.issues, history);
  }
  for (const initial of [[], [history[0]], [history[1]],
    [{ ...history[0], number: 47 }, history[1]],
    [history[0], { ...history[1], title: 'US-024 — Other' }]]) {
    for (const apply of [false, true]) {
      const api = fake({ initial }); assert.throws(() => api.run(apply), /Expected existing/);
      assertReadOnly(api); assert.deepEqual(api.issues, initial);
    }
  }
});

for (const failAccess of ['auth', 'repo']) test(`${failAccess} failure prevents preview and apply writes`, () => {
  for (const apply of [false, true]) {
    const api = fake({ failAccess }); assert.throws(() => api.run(apply), /denied/);
    assertReadOnly(api); assert.deepEqual(api.issues, history);
  }
});

test('late competing US-028 conflicts stop the real apply loop without editing it', () => {
  const competing = { number: 99, title: titles[4], body: 'competing scope', state: 'closed',
    html_url: `https://github.com/${repo}/issues/99` };
  const api = fake({ onList: ({ issues }) => {
    if (issues.some(item => item.title === titles[3]) && !issues.some(item => item.title === competing.title)) {
      issues.push(competing);
    }
  } });
  assert.throws(() => api.run(), /US-028 conflicts/);
  assert.deepEqual(creates(api), titles.slice(0, 4));
  assert.deepEqual(api.issues.at(-1), competing); assert.deepEqual(api.issues.slice(0, 2), history);
  assert.equal(api.calls.some(args => args[0] === 'issue' && args[1] !== 'create'), false);
});

test('unexpected creation URL stops further creates and directs inspection before a rerun', () => {
  for (const creationURL of ['https://github.com/other/repo/issues/80', 'created',
    `https://github.com/${repo}/issues/0`, `https://github.com/${repo}/issues/9007199254740992`]) {
    const api = fake({ creationURL }); assert.throws(() => api.run(), /Unexpected creation URL.*inspect GitHub/);
    assert.deepEqual(creates(api), titles.slice(0, 1));
    assert.deepEqual(api.issues.slice(0, 2), history);
    assert.equal(api.lines.some(line => line.includes('EP-05 → #')), false);
  }
});

test('shell routes EP-05, retains legacy/EP-03/EP-04 paths, and rejects every unknown selector or failed access', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ep05-shell-'));
  const executable = join(dir, 'gh');
  writeFileSync(executable, '#!/bin/sh\ncase "$1" in\n auth|repo) [ "$1" != "$CB_FAIL_ACCESS" ] ;;\n api) printf "%s" "$CB_TEST_ISSUES_JSON" ;;\n *) exit 99 ;;\nesac\n');
  chmodSync(executable, 0o755);
  try {
    const oldHistory = { number: 44, title: 'US-019 — Establish the Living Office Design Direction',
      body: 'History', html_url: `https://github.com/${repo}/issues/44` };
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`,
      CB_TEST_ISSUES_JSON: JSON.stringify([[oldHistory, ...history]]) };
    const run = (args = [], extra = {}) => spawnSync('bash', ['scripts/import-issues.sh', repo, ...args],
      { cwd: join(import.meta.dirname, '..'), env: { ...env, ...extra }, encoding: 'utf8' });
    for (const [epic, count, initial] of [['EP-05', 7, history], ['EP-04', 6, [oldHistory]], ['EP-03', 7, []]]) {
      const result = run(['--epic', epic], { CB_TEST_ISSUES_JSON: JSON.stringify([initial]) });
      assert.equal(result.status, 0, result.stderr);
      assert.equal((result.stdout.match(/\[CREATE\]/g) ?? []).length, count);
    }
    const legacy = run(); assert.equal(legacy.status, 0, legacy.stderr);
    assert.match(legacy.stdout, /Would create: EP-01/); assert.match(legacy.stdout, /Would create: EP-02/);
    for (const args of [['--epic', 'EP-06'], ['--epic', 'EP-01'], ['--epic', 'EP-05-extra'],
      ['--epic'], ['--epic', 'EP-05', '--epic', 'EP-05'], ['--apply', '--apply'], ['--unknown']]) {
      const result = run(args); assert.equal(result.status, 2); assert.equal(result.stdout, '');
    }
    for (const failure of ['auth', 'repo']) {
      const result = run(['--epic', 'EP-05'], { CB_FAIL_ACCESS: failure });
      assert.notEqual(result.status, 0); assert.equal(result.stdout, '');
    }
    const usage = spawnSync('bash', ['scripts/import-issues.sh'], { encoding: 'utf8' });
    assert.equal(usage.status, 2); assert.match(usage.stderr, /EP-03\|EP-04\|EP-05/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
