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
