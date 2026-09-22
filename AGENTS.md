# Coffee Break agent guidelines
- Work on one approved User Story per branch and PR; read its acceptance criteria before editing.
- Prefer the smallest correct change; no speculative abstractions, dependencies, or unrelated refactors.
- Read docs/architecture/README.md for boundaries; never access provider APIs directly from React/Phaser.
- Use TDD for critical domain logic and event contracts; incremental tests and visual checks for UI.
- Run relevant checks locally; report what ran and what did not. Do not claim success without evidence.
- Consult only the relevant skill in .agents/skills/; do not load all skills for every task.
- Never commit secrets or expose Node integration to the renderer.
