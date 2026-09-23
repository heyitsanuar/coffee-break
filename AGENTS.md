# Coffee Break agent guidelines
- Work on one approved User Story per branch and PR; read its acceptance criteria before editing.
- Prefer the smallest correct change; no speculative abstractions, dependencies, or unrelated refactors.
- Read docs/architecture/README.md for boundaries; never access provider APIs directly from React/Phaser.
- Use TDD for critical domain logic and event contracts; incremental tests and visual checks for UI.
- Run relevant checks locally; report what ran and what did not. Do not claim success without evidence.
- Consult only the relevant skill in .agents/skills/; do not load all skills for every task.
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