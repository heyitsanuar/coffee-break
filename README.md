# Coffee Break ☕
Your AI office, alive. Local-first desktop office for observing AI agents and development activity. MVP 0.1 targets macOS; Windows is later.

## Stack
Electron + React + strict TypeScript; Phaser 3 planned for the 2D office; independent Node.js + TypeScript Connector planned for EP-04. This EP-01 scaffold renders a welcome screen only; it does **not** connect to Codex or GitHub.

## Prerequisites
Node.js 22+, npm 10+, macOS for the first development target. For GitHub import, install and authenticate `gh`.

## Start
```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```
Commit the generated `package-lock.json` before enabling CI: CI intentionally uses `npm ci`.

## Issues import
```bash
bash scripts/import-issues.sh OWNER/REPO          # dry run
bash scripts/import-issues.sh OWNER/REPO --apply  # creates epic, labels and six US issues
```
Requires `gh auth login` and repository issue-write permissions. Import is idempotent by exact US prefix for up to 500 existing issues; use a new repository or inspect existing issues first. `--apply` changes the specified GitHub repository.

## Workflow
One branch and PR per US: `feature/us-001-repository`. Run checks before review and merge. See AGENTS.md and docs/architecture/README.md. License decision is pending; do not assume open-source licensing.
