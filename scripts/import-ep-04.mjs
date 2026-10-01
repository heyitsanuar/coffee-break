import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateItem, findIssue, listIssues } from './import-ep-03.mjs';

const titles = [
  'Express Agent State Through Visual Vocabulary',
  'Make Agent Workstations Reactive',
  'Add Contextual Office Interactions',
  'Integrate Agent Information Into the Office Experience',
  'Verify and Polish the Living Office Experience',
];
const dependencies = [['US-019'], ['US-020'], ['US-020', 'US-021'],
  ['US-020', 'US-021', 'US-022'], ['US-020', 'US-021', 'US-022', 'US-023']];
const counts = [12, 11, 11, 14, 15];
const labels = ['type:user-story', 'epic:living-office'];
const fail = (message) => { throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const list = (value) => Array.isArray(value) && value.length > 0 && value.every(text);

export function validateEp04Plan(plan) {
  const { epic, historical_story: history, stories } = plan ?? {};
  if (epic?.id !== 'EP-04' || epic.title !== 'Bring the Office to Life'
    || !text(epic.objective) || !list(epic.scope) || !list(epic.out_of_scope)
    || !list(epic.design_authority) || history?.id !== 'US-019'
    || history.number !== 44 || history.title !== 'Establish the Living Office Design Direction') {
    fail('Invalid EP-04 epic or US-019 #44 historical context.');
  }
  if (!Array.isArray(stories) || stories.length !== 5
    || stories.some((story, i) => story?.id !== `US-0${20 + i}`)) {
    fail('EP-04 must contain exactly US-020 through US-024 once each, in dependency order.');
  }
  stories.forEach((story, i) => {
    if (story.title !== titles[i] || story.epic !== epic.id
      || !text(story.user_story) || !text(story.objective) || !text(story.boundary)
      || !list(story.acceptance_criteria) || story.acceptance_criteria.length !== counts[i]
      || JSON.stringify(story.dependencies) !== JSON.stringify(dependencies[i])
      || !list(story.dependency_notes) || !list(story.definition_of_done)) {
      fail(`Invalid approved fields or dependencies for ${story.id}.`);
    }
  });
  return plan;
}
const checklist = (items, prefix) => items.map((item, i) =>
  `- [ ] ${prefix}-${String(i + 1).padStart(2, '0')}: ${item}`).join('\n');
const bullets = (items) => items.map((item) => `- ${item}`).join('\n');
const link = (issues, id) => {
  const issue = findIssue(issues, id);
  return issue ? `[${issue.title}](${issue.url})` : id;
};
export function renderEp04Epic(plan, issues) {
  const { epic, historical_story: history, stories } = plan;
  return `## Objective\n${epic.objective}\n\n## Approved Scope\n${bullets(epic.scope)}\n\n## Out of Scope\n${bullets(epic.out_of_scope)}\n\n## Design Authority\n${bullets(epic.design_authority)}\n\nThe approved design specification controls over older planning references that associated unrelated provider work with EP-04.\n\n## Existing Design Story\n${link(issues, history.id)} is completed/merged history; issue closure is a separate maintainer action. This importer does not manage it.\n\n## Stories\n${bullets(stories.map((story) => `${story.id} — ${story.title}`))}`;
}
export function renderEp04Story(story, issues) {
  return `## User Story\n${story.user_story}\n\n## Objective\n${story.objective}\n\n## Metadata\n- Epic: ${link(issues, story.epic)}\n- Dependencies: ${story.dependencies.map((id) => link(issues, id)).join(', ')}\n\n## Dependency Notes\n${bullets(story.dependency_notes)}\n\n## Acceptance Criteria\n${checklist(story.acceptance_criteria, 'AC')}\n\n## Boundary\n${story.boundary}\n\n## Definition of Done\n${bullets(story.definition_of_done).replaceAll('- ', '- [ ] ')}`;
}
export function runEp04Import({ repo, apply = false, plan, gh, log = console.log }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')) fail('Repository must be OWNER/REPO.');
  if (typeof apply !== 'boolean') fail('Apply must be an explicit boolean.');
  validateEp04Plan(plan);
  gh(['auth', 'status']);
  gh(['repo', 'view', repo]);
  const checkHistory = (issues) => {
    const history = findIssue(issues, 'US-019');
    if (history?.number !== 44 || history.title !== `US-019 — ${plan.historical_story.title}`) {
      fail('Expected existing US-019 #44 is missing or conflicting; no historical issue will be created or changed.');
    }
  };
  let issues = listIssues(repo, gh);
  checkHistory(issues);
  const items = [plan.epic, ...plan.stories];
  const evaluate = (item, known) => evaluateItem(item, known,
    item.id === 'EP-04' ? () => renderEp04Epic(plan, known) : renderEp04Story);
  const entries = items.map((item) => evaluate(item, issues));
  const mapping = (entry) => log(`${entry.id} → ${entry.existing ? `#${entry.existing.number} ${entry.existing.url}` : 'not assigned (CREATE)'}`);
  if (!apply) {
    log('EP-04 read-only preview (all open and closed issues checked):');
    for (const entry of entries) {
      log(`\n[${entry.status}] ${entry.title}\n${entry.body}`);
      mapping(entry);
    }
    return entries;
  }
  const conflicts = entries.filter((entry) => entry.status === 'CONFLICT');
  if (conflicts.length) fail(`Existing title/body conflicts: ${conflicts.map((entry) => entry.id).join(', ')}; no issues created.`);
  const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/labels?per_page=100`]));
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) fail('Unexpected GitHub label response.');
  const missing = labels.filter((name) => !pages.flat().some((label) => label.name === name));
  if (missing.length) fail(`Required labels missing: ${missing.join(', ')}. Ask the maintainer to provision them separately; no issues created.`);
  const created = [];
  for (const item of items) {
    const current = listIssues(repo, gh);
    issues = [...current, ...created.filter((known) => !current.some((issue) => issue.number === known.number))];
    checkHistory(issues);
    const entry = evaluate(item, issues);
    if (entry.status === 'CONFLICT') fail(`Existing ${item.id} conflicts; stopped without editing it.`);
    if (entry.status === 'SKIP') { mapping(entry); continue; }
    const args = ['issue', 'create', '--repo', repo, '--title', entry.title, '--body', entry.body,
      '--label', 'epic:living-office'];
    if (item.id !== 'EP-04') args.push('--label', 'type:user-story');
    const url = gh(args).trim();
    const prefix = `https://github.com/${repo}/issues/`;
    if (!url.startsWith(prefix) || !/^\d+$/.test(url.slice(prefix.length))) {
      fail(`Unexpected creation URL for ${item.id}; inspect GitHub before rerunning.`);
    }
    const existing = { title: entry.title, body: entry.body, url, number: Number(url.slice(prefix.length)) };
    created.push(existing);
    mapping({ ...entry, existing });
  }
  return entries;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const plan = JSON.parse(readFileSync(join(process.env.CB_ROOT, 'planning/ep-04-issues.json'), 'utf8'));
    const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
    runEp04Import({ repo: process.env.CB_REPO, apply: process.env.CB_APPLY === '--apply', plan, gh });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
