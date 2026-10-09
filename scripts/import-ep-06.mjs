import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateItem, findIssue, listIssues } from './import-ep-03.mjs';

const titles = [
  'Establish the North Star Homepage Shell',
  'Evolve the Living Office Environment',
  'Refine Agent Identity and Selection',
  'Integrate the Contextual Right Rail',
  'Add World Previews and Office Expansion',
  'Verify and Polish the Homepage',
];
const counts = [14, 15, 15, 14, 18, 20];
const dependencies = [
  ['US-030'], ['US-031'], ['US-031', 'US-032'], ['US-031', 'US-033'],
  ['US-031', 'US-032', 'US-033'], ['US-031', 'US-032', 'US-033', 'US-034', 'US-035'],
];
const context = [
  { id: 'EP-05', number: 58, title: 'North Star UI Evolution' },
  { id: 'US-030', number: 64, title: 'Verify and Polish North Star Fidelity' },
];
const epicLists = ['scope', 'out_of_scope', 'design_authority',
  'architectural_constraints', 'visual_principles', 'design_workflow',
  'dependencies', 'exit_criteria', 'implementation_order'];
const storyLists = ['scope', 'dependency_notes', 'acceptance_criteria', 'design_references',
  'accessibility_expectations', 'regression_requirements', 'definition_of_done'];
const labels = ['type:user-story', 'epic:north-star-homepage'];
const fail = (message) => { throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const list = (value) => Array.isArray(value) && value.length > 0 && value.every(text);

export function validateEp06Plan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) fail('Invalid EP-06 plan.');
  const { epic, historical_context: history, stories } = plan;
  if (epic?.id !== 'EP-06' || epic.title !== 'North Star Homepage Experience'
    || !text(epic.objective) || epicLists.some((field) => !list(epic[field]))
    || JSON.stringify(epic.dependencies) !== JSON.stringify(['US-030'])
    || JSON.stringify(epic.implementation_order) !== JSON.stringify(titles.map((_, i) => `US-0${31 + i}`))
    || !Array.isArray(history) || history.length !== context.length
    || history.some((item, i) => item?.id !== context[i].id
      || item.number !== context[i].number || item.title !== context[i].title)) {
    fail('Invalid EP-06 epic or EP-05 / US-030 historical context.');
  }
  if (!Array.isArray(stories) || stories.length !== titles.length
    || stories.some((story, i) => story?.id !== `US-0${31 + i}`)) {
    fail('EP-06 must contain exactly US-031 through US-036 once each, in dependency order.');
  }
  stories.forEach((story, i) => {
    if (story.title !== titles[i] || story.epic !== epic.id
      || !text(story.user_story) || !text(story.objective) || !text(story.boundary)
      || !list(story.acceptance_criteria) || story.acceptance_criteria.length !== counts[i]
      || JSON.stringify(story.dependencies) !== JSON.stringify(dependencies[i])
      || storyLists.some((field) => !list(story[field]))) {
      fail(`Invalid approved fields or dependencies for ${story.id}.`);
    }
  });
  return plan;
}
const bullets = (items) => items.map((item) => `- ${item}`).join('\n');
const checklist = (items) => items.map((item, i) =>
  `- [ ] AC-${String(i + 1).padStart(2, '0')}: ${item}`).join('\n');
const link = (issues, id) => {
  const issue = findIssue(issues, id);
  return issue ? `[${issue.title}](${issue.url})` : id;
};
export function renderEp06Epic(plan, issues) {
  const { epic, historical_context: history, stories } = plan;
  return `## Objective\n${epic.objective}\n\n## Approved Scope\n${bullets(epic.scope)}\n\n## Out of Scope\n${bullets(epic.out_of_scope)}\n\n## Design Authority\n${bullets(epic.design_authority)}\n\n## Architectural Constraints\n${bullets(epic.architectural_constraints)}\n\n## Visual Principles\n${bullets(epic.visual_principles)}\n\n## Design Workflow\n${bullets(epic.design_workflow)}\n\n## Dependencies\n${bullets(epic.dependencies.map((id) => link(issues, id)))}\n\n## Exit Criteria\n${epic.exit_criteria.map((item) => `- [ ] ${item}`).join('\n')}\n\n## Implementation Order\n${bullets(epic.implementation_order)}\n\n## Existing Foundation\n${bullets(history.map((item) => link(issues, item.id)))}\n\nThese historical issues are not managed by this importer.\n\n## Stories\n${bullets(stories.map((story) => `${story.id} — ${story.title}`))}\n\nRecommended integration order follows the list; technical prerequisites are specified on each story. Parallel preparation does not authorize concurrent implementation.`;
}
export function renderEp06Story(story, issues) {
  return `## User Story\n${story.user_story}\n\n## Objective\n${story.objective}\n\n## Scope\n${bullets(story.scope)}\n\n## Metadata\n- Epic: ${link(issues, story.epic)}\n- Dependencies: ${story.dependencies.map((id) => link(issues, id)).join(', ')}\n\n## Dependency Notes\n${bullets(story.dependency_notes)}\n\n## Acceptance Criteria\n${checklist(story.acceptance_criteria)}\n\n## Boundary\n${story.boundary}\n\n## Design References\n${bullets(story.design_references)}\n\n## Accessibility Expectations\n${bullets(story.accessibility_expectations)}\n\n## Regression Requirements\n${bullets(story.regression_requirements)}\n\n## Definition of Done\n${story.definition_of_done.map((item) => `- [ ] ${item}`).join('\n')}`;
}
export function runEp06Import({ repo, apply = false, plan, gh, log = console.log }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')) fail('Repository must be OWNER/REPO.');
  if (typeof apply !== 'boolean') fail('Apply must be an explicit boolean.');
  validateEp06Plan(plan);
  gh(['auth', 'status']);
  gh(['repo', 'view', repo]);
  const checkHistory = (issues) => {
    for (const item of context) {
      const existing = findIssue(issues, item.id);
      if (existing?.number !== item.number || existing.title !== `${item.id} — ${item.title}`) {
        fail(`Expected existing ${item.id} #${item.number} is missing or conflicting; no historical issue will be created or changed.`);
      }
    }
  };
  let issues = listIssues(repo, gh);
  checkHistory(issues);
  const items = [plan.epic, ...plan.stories];
  const evaluate = (item, known) => evaluateItem(item, known,
    item.id === 'EP-06' ? () => renderEp06Epic(plan, known) : renderEp06Story);
  const entries = items.map((item) => evaluate(item, issues));
  const mapping = (entry) => log(`${entry.id} → ${entry.existing ? `#${entry.existing.number} ${entry.existing.url}` : 'not assigned (CREATE)'}`);
  if (!apply) {
    log('EP-06 read-only preview (all open and closed issues checked):');
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
      '--label', 'epic:north-star-homepage'];
    if (item.id !== 'EP-06') args.push('--label', 'type:user-story');
    const url = gh(args).trim();
    const prefix = `https://github.com/${repo}/issues/`;
    const number = Number(url.slice(prefix.length));
    if (!url.startsWith(prefix) || !/^\d+$/.test(url.slice(prefix.length))
      || !Number.isSafeInteger(number) || number <= 0) {
      fail(`Unexpected creation URL for ${item.id}; inspect GitHub before rerunning.`);
    }
    const existing = { title: entry.title, body: entry.body, url, number };
    created.push(existing);
    mapping({ ...entry, existing });
  }
  return entries;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const plan = JSON.parse(readFileSync(join(process.env.CB_ROOT, 'planning/ep-06-issues.json'), 'utf8'));
    const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
    runEp06Import({ repo: process.env.CB_REPO, apply: process.env.CB_APPLY === '--apply', plan, gh });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
