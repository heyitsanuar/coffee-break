import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  evaluateItem,
  findIssue,
  listIssues,
  previewEp03,
  renderEpicBody,
  renderStoryBody,
  runEp03Import,
  validateEp03Plan,
} from './import-ep-03.mjs';

const plan = JSON.parse(readFileSync(join(import.meta.dirname, '../planning/ep-03-issues.json'), 'utf8'));
const clone = (value) => structuredClone(value);
const issue = (id, title, body = '') => ({
  title: `${id} — ${title}`,
  body,
  url: `https://github.com/example/coffee-break/issues/${id === 'EP-02' ? 15 : 16}`,
  number: id === 'EP-02' ? 15 : 16,
});
const ep02 = issue('EP-02', 'Virtual Office Foundation');

function fakeGitHub(initialIssues = [ep02], { failCreateTitleOnce } = {}) {
  const issues = clone(initialIssues);
  const labels = [{ name: 'type:user-story' }];
  const calls = [];
  let pendingFailure = failCreateTitleOnce;
  const gh = (args) => {
    calls.push(args);
    if (args[0] === 'api' && args.at(-1).includes('/issues?')) {
      return JSON.stringify([issues.map((item) => ({
        number: item.number,
        title: item.title,
        body: item.body,
        html_url: item.url,
        state: item.state ?? 'open',
      }))]);
    }
    if (args[0] === 'api' && args.at(-1).includes('/labels?')) {
      return JSON.stringify([labels]);
    }
    if (args[0] === 'label' && args[1] === 'create') {
      labels.push({ name: args[2] });
      return '';
    }
    if (args[0] === 'issue' && args[1] === 'create') {
      const title = args[args.indexOf('--title') + 1];
      if (title === pendingFailure) {
        pendingFailure = undefined;
        throw new Error(`Simulated creation failure: ${title}`);
      }
      const number = 23 + issues.length;
      const created = {
        number,
        title,
        body: args[args.indexOf('--body') + 1],
        url: `https://github.com/example/coffee-break/issues/${number}`,
        state: 'open',
      };
      issues.push(created);
      return created.url;
    }
    throw new Error(`Unexpected gh command: ${args.join(' ')}`);
  };
  return { gh, calls, issues };
}

test('EP-03 plan contains the exact story set, dependencies, and required fields', () => {
  assert.equal(validateEp03Plan(plan), plan);
  const missing = clone(plan);
  missing.stories.pop();
  assert.throws(() => validateEp03Plan(missing), /exactly US-013 through US-018/);
  const duplicated = clone(plan);
  duplicated.stories[5].id = 'US-013';
  assert.throws(() => validateEp03Plan(duplicated), /exactly US-013 through US-018/);
  const badDependency = clone(plan);
  badDependency.stories[3].dependencies = ['US-014', 'US-099'];
  assert.throws(() => validateEp03Plan(badDependency), /invalid dependencies/);
  const emptyCriterion = clone(plan);
  emptyCriterion.stories[0].acceptance_criteria[0] = '';
  assert.throws(() => validateEp03Plan(emptyCriterion), /missing fields/);
});

test('preview is read-only and renders exact titles, bodies, and available links', () => {
  const api = fakeGitHub();
  const lines = [];
  const entries = runEp03Import({
    repo: 'example/coffee-break', apply: false, plan, gh: api.gh,
    log: (line) => lines.push(line),
  });
  assert.deepEqual(entries.map(({ status }) => status), Array(7).fill('CREATE'));
  assert.equal(entries[0].title, 'EP-03 — Local Agent State Integration');
  assert.match(entries[0].body, /\[EP-02 — Virtual Office Foundation\]\(https:\/\/github.com\/example\/coffee-break\/issues\/15\)/);
  assert.match(entries[1].body, /- Epic: EP-03/);
  assert.match(entries[2].body, /- Dependencies: US-013/);
  assert.match(lines.join('\n'), /\[CREATE\] US-018 — Verify the Integrated Local Event MVP/);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0][0], 'api');
});

test('existing issues are skipped only when title and body match', () => {
  const known = [ep02];
  const epicBody = renderEpicBody(plan.epic, plan.stories, known);
  const existingEpic = issue('EP-03', plan.epic.title, epicBody);
  const entries = previewEp03(plan, [...known, existingEpic]);
  assert.equal(entries[0].status, 'SKIP');
  assert.equal(entries[1].status, 'CREATE');
  const conflict = previewEp03(plan, [...known, { ...existingEpic, body: 'Different scope' }]);
  assert.equal(conflict[0].status, 'CONFLICT');
  assert.equal(previewEp03(plan, [...known, { ...existingEpic, title: 'EP-03: Other title' }])[0].status, 'CONFLICT');
  assert.throws(() => findIssue([existingEpic, { ...existingEpic, number: 99 }], 'EP-03'), /Multiple/);
  assert.equal(evaluateItem(plan.epic, known, (epic, issues) => renderEpicBody(epic, plan.stories, issues)).status, 'CREATE');
});

test('story bodies resolve epic and dependency links from existing issues', () => {
  const known = [ep02, issue('EP-03', plan.epic.title), issue('US-013', plan.stories[0].title)];
  const body = renderStoryBody(plan.stories[1], known);
  assert.match(body, /- Epic: \[EP-03 — Local Agent State Integration\]\(/);
  assert.match(body, /- Dependencies: \[US-013 — Establish the Local Transport and Trust Boundary\]\(/);
  assert.match(body, /## Acceptance Criteria\n- \[ \] AC-01:/);
});

test('all-state issue retrieval excludes pull requests and keeps closed issues', () => {
  const gh = () => JSON.stringify([[{
    title: 'US-013 — Existing', body: 'body', number: 30,
    html_url: 'https://github.com/example/coffee-break/issues/30', state: 'closed',
  }, {
    title: 'US-014 — Pull request', number: 31, pull_request: {},
  }]]);
  const issues = listIssues('example/coffee-break', gh);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].state, 'closed');
});

test('apply creates only EP-03 and US-013 through US-018, then safely skips on rerun', () => {
  const api = fakeGitHub();
  const log = () => {};
  runEp03Import({ repo: 'example/coffee-break', apply: true, plan, gh: api.gh, log });
  const creates = api.calls.filter((args) => args[0] === 'issue' && args[1] === 'create');
  assert.deepEqual(creates.map((args) => args[args.indexOf('--title') + 1]),
    [plan.epic, ...plan.stories].map((item) => `${item.id} — ${item.title}`));
  assert.equal(api.calls.filter((args) => args[0] === 'label' && args[1] === 'create').length, 1);
  assert.equal(api.calls.some((args) => args[0] === 'issue' && args[1] !== 'create'), false);
  assert.equal(api.issues[0].title, ep02.title);
  assert.equal(api.issues[0].body, ep02.body);
  assert.match(creates[2][creates[2].indexOf('--body') + 1], /\[US-013 — Establish the Local Transport and Trust Boundary\]\(/);
  runEp03Import({ repo: 'example/coffee-break', apply: true, plan, gh: api.gh, log });
  assert.equal(api.calls.filter((args) => args[0] === 'issue' && args[1] === 'create').length, 7);
});

test('apply skips a matching closed EP-03 story without mutating it', () => {
  const existingEpic = {
    ...issue('EP-03', plan.epic.title, renderEpicBody(plan.epic, plan.stories, [ep02])),
    number: 30,
    url: 'https://github.com/example/coffee-break/issues/30',
    state: 'closed',
  };
  const closedStory = {
    ...issue('US-013', plan.stories[0].title, renderStoryBody(plan.stories[0], [ep02, existingEpic])),
    number: 31,
    url: 'https://github.com/example/coffee-break/issues/31',
    state: 'closed',
  };
  const api = fakeGitHub([ep02, existingEpic, closedStory]);
  const before = clone(api.issues);

  runEp03Import({ repo: 'example/coffee-break', apply: true, plan, gh: api.gh, log: () => {} });

  const createdTitles = api.calls
    .filter((args) => args[0] === 'issue' && args[1] === 'create')
    .map((args) => args[args.indexOf('--title') + 1]);
  assert.deepEqual(createdTitles, plan.stories.slice(1).map((story) => `${story.id} — ${story.title}`));
  assert.deepEqual(api.issues.slice(0, before.length), before);
  assert.equal(api.issues.find((item) => item.number === 31)?.state, 'closed');
  assert.equal(api.issues.filter((item) => item.title === closedStory.title).length, 1);
  assert.equal(api.calls.some((args) => args[0] === 'issue' && args[1] !== 'create'), false);
  assert.equal(api.calls.some((args) => args[0] === 'label' && args[1] !== 'create'), false);
});

test('apply resumes after US-014 creation fails without duplicating earlier issues', () => {
  const failedTitle = `US-014 — ${plan.stories[1].title}`;
  const api = fakeGitHub([ep02], { failCreateTitleOnce: failedTitle });
  const apply = () => runEp03Import({
    repo: 'example/coffee-break', apply: true, plan, gh: api.gh, log: () => {},
  });

  assert.throws(apply, /Simulated creation failure: US-014/);
  const firstAttemptTitles = api.calls
    .filter((args) => args[0] === 'issue' && args[1] === 'create')
    .map((args) => args[args.indexOf('--title') + 1]);
  assert.deepEqual(firstAttemptTitles, [
    `EP-03 — ${plan.epic.title}`,
    `US-013 — ${plan.stories[0].title}`,
    failedTitle,
  ]);
  const firstCreated = clone(api.issues.slice(1));
  assert.deepEqual(firstCreated.map((item) => item.title), firstAttemptTitles.slice(0, 2));
  assert.equal(api.issues.length, 3);

  const rerunStart = api.calls.length;
  apply();
  const rerunCalls = api.calls.slice(rerunStart);
  const rerunCreates = rerunCalls.filter((args) => args[0] === 'issue' && args[1] === 'create');
  assert.deepEqual(rerunCreates.map((args) => args[args.indexOf('--title') + 1]),
    plan.stories.slice(1).map((story) => `${story.id} — ${story.title}`));
  assert.deepEqual(api.issues.slice(1, 3), firstCreated);
  assert.deepEqual(api.issues.slice(1).map((item) => item.title),
    [plan.epic, ...plan.stories].map((item) => `${item.id} — ${item.title}`));
  assert.equal(rerunCalls.some((args) => args[0] === 'issue' && args[1] !== 'create'), false);
  assert.equal(rerunCalls.some((args) => args[0] === 'label' && args[1] === 'create'), false);
  const us014Body = rerunCreates[0][rerunCreates[0].indexOf('--body') + 1];
  assert.match(us014Body, new RegExp(`\\[EP-03 — ${plan.epic.title}\\]\\(${firstCreated[0].url}\\)`));
  assert.match(us014Body, new RegExp(`\\[US-013 — ${plan.stories[0].title}\\]\\(${firstCreated[1].url}\\)`));
  const us016Body = rerunCreates[2][rerunCreates[2].indexOf('--body') + 1];
  assert.match(us016Body, /- Dependencies: \[US-014 — .*\]\(https:\/\/github\.com\/example\/coffee-break\/issues\/\d+\), \[US-015 — .*\]\(https:\/\/github\.com\/example\/coffee-break\/issues\/\d+\)/);
});

test('conflicting existing issue prevents every mutation', () => {
  const api = fakeGitHub([ep02, issue('US-013', 'Conflicting title', 'Conflicting body')]);
  assert.throws(() => runEp03Import({
    repo: 'example/coffee-break', apply: true, plan, gh: api.gh, log: () => {},
  }), /conflicts/);
  assert.equal(api.calls.length, 1);
  assert.equal(api.issues.length, 2);
});

test('shell selector routes only EP-03 and preserves the legacy command', () => {
  const directory = mkdtempSync(join(tmpdir(), 'coffee-break-import-test-'));
  const ghPath = join(directory, 'gh');
  writeFileSync(ghPath, '#!/bin/sh\ncase "$1" in\n  auth|repo) exit 0 ;;\n  api) printf "%s" "$CB_TEST_ISSUES_JSON" ;;\nesac\n');
  chmodSync(ghPath, 0o755);
  const env = {
    ...process.env,
    PATH: `${directory}:${process.env.PATH}`,
    CB_TEST_ISSUES_JSON: JSON.stringify([[{
      title: ep02.title, body: ep02.body, number: ep02.number,
      html_url: ep02.url, state: 'closed',
    }]]),
  };
  try {
    const selected = spawnSync('bash', [
      'scripts/import-issues.sh', 'example/coffee-break', '--epic', 'EP-03',
    ], { cwd: join(import.meta.dirname, '..'), env, encoding: 'utf8' });
    assert.equal(selected.status, 0, selected.stderr);
    assert.equal((selected.stdout.match(/\[CREATE\]/g) ?? []).length, 7);
    assert.doesNotMatch(selected.stdout, /\[CREATE\] EP-01|\[CREATE\] EP-02/);
    const legacy = spawnSync('bash', [
      'scripts/import-issues.sh', 'example/coffee-break',
    ], { cwd: join(import.meta.dirname, '..'), env, encoding: 'utf8' });
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.match(legacy.stdout, /Would create: EP-01 — Project Foundation/);
    assert.match(legacy.stdout, /Would create: EP-02 — Virtual Office Foundation/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
