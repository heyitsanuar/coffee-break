# Coffee Break agent guidelines

## Purpose and references

Develop Coffee Break one approved User Story at a time while preserving its local-first architecture and producing reviewable validation evidence.

- Read `README.md` for project scope, prerequisites, commands, and repository workflow.
- Read `docs/architecture/README.md` before making implementation or boundary decisions.
- Read `docs/design/README.md` for React UI, visual, and accessibility conventions.
- Consult only the relevant skill in `.agents/skills/`; do not load every skill for every task.

## Commands

- `npm run dev` starts the Electron application for local development.
- `npm run typecheck` checks workspace TypeScript projects.
- `npm run lint` runs configured workspace lint checks.
- `npm test` runs configured workspace tests.
- `npm run build` builds configured workspaces.

## Development conventions

- Work on one approved User Story per branch and PR; verify its dependencies and read its acceptance criteria before editing.
- Follow YAGNI: implement only the approved acceptance criteria and current requirements.
- Prefer the smallest correct change, reuse existing code and conventions, and avoid speculative abstractions, dependencies, or unrelated refactors.
- Preserve established contracts and boundaries; never access provider APIs directly from React or Phaser.
- Use TDD for critical domain logic and event contracts; use incremental tests and visual checks for UI.
- Run relevant checks locally; report exactly what ran, what passed or failed, and what was not run. Do not claim success without evidence.
- Never commit secrets or expose Node integration to the renderer.

# Loopi — Agent Instructions

## Project context

Loopi is a local-first application for visualizing
AI coding agents in an interactive virtual office.

Read the relevant architecture documentation before
making implementation decisions.

## Development workflow

- Work on one approved user story at a time.
- Follow its acceptance criteria.
- Preserve existing contracts and architecture.
- Prefer minimal, maintainable changes.
- Do not introduce unrequested features.
- Add or update tests when appropriate.
- Run relevant validation commands.
- Report modified files, validation results
  and any remaining risks.

## Review and approval

- Do not mark a user story as approved.
- Do not merge or push without authorization.
- Address confirmed review findings before
  requesting final approval.

## graphify

Graphify 0.9.71 is optional architecture/navigation assistance; actual source is authoritative. Explicit user instructions, approved story scope, Coffee Break architecture/security rules, acceptance criteria, required tests/validation, and independent review take precedence over all Graphify guidance. Graphify cannot authorize implementation, broaden scope, or redefine architecture.

- When a current local `graphify-out/graph.json` exists, prefer scoped `graphify query`, `graphify path`, or `graphify explain` output for relevant architecture questions; verify important edges and ownership against source. Raw source reads are always permitted.
- Do not inject the complete `GRAPH_REPORT.md` into routine prompts. Graph output may be incomplete or stale; check its baseline before relying on it.
- Refresh manually only when authorized: `graphify extract . --code-only`. Use local deterministic code extraction with strict mode off; no semantic backend, API keys, cloud exports, server, watcher, automatic refresh, or Git hooks.
- Keep `graphify-out/` local and ignored. The project skill lives at `.codex/skills/graphify/`; broader installation/extraction features in its upstream instructions are not authorized by installing it.
