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
`npm run dev` starts Electron and the renderer development server; saving a renderer file reloads the window through Vite hot reload. `typecheck`, `lint`, `test`, and `build` run across workspaces where the command is defined. The build creates Electron main, preload, and renderer output under `apps/desktop/out`; it does not create a distributable `.app` or `.dmg` package.

The committed `package-lock.json` provides reproducible installs. CI uses `npm ci`.

## Issues import
```bash
bash scripts/import-issues.sh OWNER/REPO          # dry run
bash scripts/import-issues.sh OWNER/REPO --apply  # creates epic, labels and six US issues
```
Requires `gh auth login` and repository issue-write permissions. Import is idempotent by exact US prefix for up to 500 existing issues; use a new repository or inspect existing issues first. `--apply` changes the specified GitHub repository.

## Workflow
Use one branch and pull request per user story. Branches follow `feature/us-XXX-short-description` (for example, `feature/us-001-repository`). Run the documented checks before review and merge. See AGENTS.md and docs/architecture/README.md.

## Versioning and license
The repository starts at version `0.1.0`, defined in the root and desktop package manifests. Until a license is explicitly selected, the project is not offered under an open-source license; do not add license headers or assume permission to redistribute it. Future releases will use Semantic Versioning once the release process is established.
