import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const storyIds = ['US-013', 'US-014', 'US-015', 'US-016', 'US-017', 'US-018'];
const storyTitles = [
  'Establish the Local Transport and Trust Boundary',
  'Add the Preload Bridge and In-Memory Agent Store',
  'Add the Deterministic Local Connector Simulator',
  'Drive the Virtual Office from Agent State',
  'Complete Connection Loss and Resynchronization Behavior',
  'Verify the Integrated Local Event MVP',
];
const criterionCounts = [10, 8, 10, 8, 9, 9];
const expectedDependencies = {
  'US-013': ['EP-02'],
  'US-014': ['US-013'],
  'US-015': ['US-013'],
  'US-016': ['US-014', 'US-015'],
  'US-017': ['US-014', 'US-015', 'US-016'],
  'US-018': ['US-013', 'US-014', 'US-015', 'US-016', 'US-017'],
};
const epicLabel = 'epic:local-agent-state';

const fail = (message) => { throw new Error(message); };
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const nonemptyList = (value) => Array.isArray(value) && value.length > 0 && value.every(nonempty);
const sameSet = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length
  && new Set(actual).size === actual.length
  && expected.every((id) => actual.includes(id));

export function validateEp03Plan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) fail('EP-03 plan must be an object.');
  const { epic, stories } = plan;
  if (!epic || epic.id !== 'EP-03' || epic.title !== 'Local Agent State Integration') {
    fail('EP-03 epic ID or title is invalid.');
  }
  if (!nonempty(epic.objective) || !nonemptyList(epic.design)
    || !nonemptyList(epic.exit_criteria) || !nonemptyList(epic.out_of_scope)
    || !sameSet(epic.dependencies, ['EP-02'])) {
    fail('EP-03 epic requires objective, scope, exclusions, exit criteria, and EP-02 dependency.');
  }
  if (epic.design.length !== 7 || epic.exit_criteria.length !== 7
    || epic.out_of_scope.length !== 6) {
    fail('EP-03 scope, exit criteria, or exclusions are incomplete.');
  }
  if (!Array.isArray(stories) || stories.length !== storyIds.length
    || !sameSet(stories.map((story) => story?.id), storyIds)) {
    fail('EP-03 must contain exactly US-013 through US-018, once each.');
  }
  if (stories.some((story, index) => story.id !== storyIds[index])) {
    fail('EP-03 stories must be in dependency order, US-013 through US-018.');
  }
  for (const [index, story] of stories.entries()) {
    if (story.epic !== epic.id || !nonempty(story.title)
      || !nonempty(story.user_story) || !nonempty(story.boundary)
      || !nonemptyList(story.acceptance_criteria)
      || !sameSet(story.dependencies, expectedDependencies[story.id])
      || story.title !== storyTitles[index]
      || story.acceptance_criteria.length !== criterionCounts[index]) {
      fail(`${story.id} has missing fields, wrong epic, or invalid dependencies.`);
    }
  }
  if (new Set(stories.map((story) => story.title)).size !== stories.length) {
    fail('EP-03 story titles must be unique.');
  }
  return plan;
}

export function idMatchesTitle(id, title) {
  return title.startsWith(id) && !/[A-Za-z0-9]/.test(title.charAt(id.length));
}

export function findIssue(issues, id) {
  const matches = issues.filter((issue) => idMatchesTitle(id, issue.title));
  if (matches.length > 1) fail(`Multiple GitHub issues use ${id}; resolve the duplicate before importing.`);
  return matches[0];
}

const issueLink = (issues, id) => {
  const issue = findIssue(issues, id);
  return issue ? `[${issue.title}](${issue.url})` : id;
};
const checklist = (items, prefix) => items.map((item, index) =>
  `- [ ] ${prefix}-${String(index + 1).padStart(2, '0')}: ${item}`).join('\n');

export function renderEpicBody(epic, stories, issues) {
  return `## Objective\n${epic.objective}\n\n## Approved Scope\n${epic.design.map((item) => `- ${item}`).join('\n')}\n\n## Dependencies\n${epic.dependencies.map((id) => `- ${issueLink(issues, id)}`).join('\n')}\n\n## Exit Criteria\n${checklist(epic.exit_criteria, 'EC')}\n\n## Out of Scope\n${epic.out_of_scope.map((item) => `- ${item}`).join('\n')}\n\n## Stories\n${stories.map((story) => `- ${story.id} — ${story.title}`).join('\n')}`;
}

export function renderStoryBody(story, issues) {
  return `## Objective\n${story.user_story}\n\n## Metadata\n- Epic: ${issueLink(issues, story.epic)}\n- Dependencies: ${story.dependencies.map((id) => issueLink(issues, id)).join(', ')}\n\n## Acceptance Criteria\n${checklist(story.acceptance_criteria, 'AC')}\n\n## Boundary\n${story.boundary}\n\n## Definition of Done\n- [ ] Acceptance criteria verified\n- [ ] Relevant tests and checks pass\n- [ ] Reviewer findings resolved\n- [ ] PR approved and merged`;
}

export function evaluateItem(item, issues, renderBody) {
  const title = `${item.id} — ${item.title}`;
  const body = renderBody(item, issues);
  const existing = findIssue(issues, item.id);
  let status = 'CREATE';
  if (existing) {
    status = existing.title === title && existing.body?.trimEnd() === body.trimEnd()
      ? 'SKIP' : 'CONFLICT';
  }
  return { id: item.id, title, body, status, existing };
}

export function previewEp03(plan, issues) {
  validateEp03Plan(plan);
  return [
    evaluateItem(plan.epic, issues, (epic, known) => renderEpicBody(epic, plan.stories, known)),
    ...plan.stories.map((story) => evaluateItem(story, issues, renderStoryBody)),
  ];
}

const parsePages = (output, description) => {
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed) || !parsed.every(Array.isArray)) {
    fail(`Unexpected GitHub ${description} response.`);
  }
  return parsed.flat();
};

export function listIssues(repo, gh) {
  const pages = parsePages(gh(['api', '--paginate', '--slurp',
    `repos/${repo}/issues?state=all&per_page=100`]), 'issue list');
  return pages.filter((issue) => !issue.pull_request).map((issue) => ({
    number: issue.number,
    title: issue.title,
    body: issue.body ?? '',
    url: issue.html_url,
    state: issue.state,
  }));
}

function listLabels(repo, gh) {
  return parsePages(gh(['api', '--paginate', '--slurp',
    `repos/${repo}/labels?per_page=100`]), 'label list');
}

function printPreview(entries, log) {
  log('EP-03 read-only preview (all open and closed GitHub issues checked):');
  for (const entry of entries) {
    log(`\n[${entry.status}] ${entry.title}`);
    if (entry.existing) log(`Existing: ${entry.existing.url}`);
    log(entry.body);
  }
}

export function runEp03Import({ repo, apply, plan, gh, log = console.log }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')) {
    fail('Repository must be OWNER/REPO.');
  }
  validateEp03Plan(plan);
  let issues = listIssues(repo, gh);
  const entries = previewEp03(plan, issues);
  if (!apply) {
    printPreview(entries, log);
    return entries;
  }
  const conflicts = entries.filter((entry) => entry.status === 'CONFLICT');
  if (conflicts.length) fail(`Existing issue title or body conflicts: ${conflicts.map((entry) => entry.id).join(', ')}. No issues were created.`);
  if (!findIssue(issues, 'EP-02')) fail('EP-02 dependency issue is missing; no issues were created.');
  const labels = listLabels(repo, gh);
  if (!labels.some((label) => label.name === 'type:user-story')) {
    fail('Existing type:user-story label is missing; no issues were created.');
  }
  if (!labels.some((label) => label.name === epicLabel)) {
    gh(['label', 'create', epicLabel, '--repo', repo,
      '--description', 'Local agent state integration', '--color', '1D76DB']);
    log(`Created label: ${epicLabel}`);
  }
  const created = [];
  for (const item of [plan.epic, ...plan.stories]) {
    // GitHub issue creation is not transactional. Re-query immediately before each create.
    const current = listIssues(repo, gh);
    issues = [...current, ...created.filter((known) => !current.some((issue) => issue.number === known.number))];
    const entry = evaluateItem(item, issues, item.id === 'EP-03'
      ? (epic, known) => renderEpicBody(epic, plan.stories, known)
      : renderStoryBody);
    if (entry.status === 'CONFLICT') fail(`Existing ${item.id} title or body conflicts; stopped without editing it.`);
    if (entry.status === 'SKIP') {
      log(`Skipping existing: ${entry.title} (${entry.existing.url})`);
      continue;
    }
    const labelsForItem = item.id === 'EP-03'
      ? [epicLabel] : ['type:user-story', epicLabel];
    const args = ['issue', 'create', '--repo', repo, '--title', entry.title, '--body', entry.body];
    for (const label of labelsForItem) args.push('--label', label);
    const url = gh(args).trim();
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(url)) {
      fail(`GitHub returned an unexpected URL for ${item.id}; inspect GitHub before rerunning.`);
    }
    created.push({ title: entry.title, body: entry.body, url, number: Number(url.split('/').at(-1)) });
    log(`Created: ${entry.title} (${url})`);
  }
  return entries;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = process.env.CB_ROOT;
    const plan = JSON.parse(readFileSync(join(root, 'planning/ep-03-issues.json'), 'utf8'));
    const gh = (args) => execFileSync('gh', args, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
    }).trim();
    runEp03Import({ repo: process.env.CB_REPO, apply: process.env.CB_APPLY === '--apply', plan, gh });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
