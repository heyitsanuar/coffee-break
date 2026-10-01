# Coffee Break ☕
Your AI office, alive. Local-first desktop office for observing AI agents and development activity. MVP 0.1 targets macOS; Windows is later.

## Stack
Electron + React + strict TypeScript with Phaser 3 rendering the implemented 2D virtual office; an independent Node.js + TypeScript Connector is planned for EP-04. The current desktop application uses local simulated agent data and does **not** connect to Codex or GitHub.

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

`npm run dev` leaves the local ingress dormant. To exercise the EP-03 pipeline with one development-only simulator child, use `npm run dev:simulated`. Its fixed Ari/Mina/Sol scenario runs once, then the child and authenticated socket remain connected until the desktop exits. Electron main owns the child; no provider or provider credentials are used. The renderer store drives React inspection and Phaser presentation through a derived office view. See [the simulator architecture](docs/architecture/local-simulator.md) for the exact scenario.

`npm run dev:simulated:recovery` runs an explicit development-only two-session validation scenario: the unchanged simulator sequence, a controlled disconnect, exactly one replacement child, and a delayed complete snapshot followed by the same sequence. It is not production auto-reconnect. Connection status appears above the office; last-known agent state remains visible during loss and synchronization. Ordinary startup displays unavailable after a five-second renderer availability deadline while keeping its watch open. See the simulator architecture for timing and ownership.

The committed `package-lock.json` provides reproducible installs. CI uses `npm ci`.

## Continuous integration
GitHub Actions runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for pull requests targeting `main`. Run the same validation locally with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Contributors can inspect results and open step logs from the pull request's checks; all CI checks must pass before approval and merge.

## Issues import
```bash
bash scripts/import-issues.sh OWNER/REPO          # dry run
bash scripts/import-issues.sh OWNER/REPO --apply  # creates missing planned epics, labels and stories
bash scripts/import-issues.sh OWNER/REPO --epic EP-03          # read-only EP-03 preview
bash scripts/import-issues.sh OWNER/REPO --epic EP-03 --apply  # create only missing EP-03 issues
```
Requires `gh auth login`; apply also requires repository issue-write permissions. The original commands retain their existing EP-01/EP-02 behavior: their dry run does not query GitHub, and apply checks up to 500 existing issues. The EP-03 preview is read-only and queries all open and closed GitHub issues. It prints each proposed title and full body, resolved links where the referenced issue exists, and CREATE, SKIP, or CONFLICT status. Previewed links to issues that do not exist yet remain plain IDs; apply resolves them as it creates issues. EP-03 apply validates the planning file, re-checks existing issues before each creation, creates only the missing EP-03 epic and US-013 through US-018, and never edits existing issue bodies or EP-01/EP-02 issues. It reports title or body conflicts instead of overwriting them. GitHub issue creation is not transactional: after a partial failure, inspect GitHub and rerun the same EP-03 command safely. Story IDs such as US-013 are planning IDs, not GitHub issue numbers. Run the importer tests with `node --test scripts/import-ep-03.test.mjs` (also included in `npm test`).

### EP-04 Living Office backlog

The approved specifications live in `planning/ep-04-issues.json`. This path manages only EP-04 — Bring the Office to Life and US-020 through US-024. US-019 #44 is pre-existing design history: it must exist with the expected title, but its body, labels, state, and closure are never managed by this importer. The approved Living Office design controls over older EP-04 provider-planning references.

Requires Node.js, Bash, GitHub CLI, authenticated repository read access (`gh auth login`), and issue-write permission for apply. Before apply, the maintainer must separately provision the existing-convention labels `type:user-story` and `epic:living-office` if missing. The importer never creates or redefines labels.

Preview and inspect every proposed title/body before separately authorizing apply:

```bash
bash scripts/import-issues.sh heyitsanuar/coffee-break --epic EP-04
# Only after authorization:
bash scripts/import-issues.sh heyitsanuar/coffee-break --epic EP-04 --apply
```

Preview queries all open/closed issues without writing and prints CREATE / SKIP / CONFLICT plus planning-ID → assigned issue number/URL mappings (or “not assigned”). Exact title/body matches are skipped even when closed. Duplicate IDs and content conflicts stop apply rather than overwrite existing issues. Missing required labels stop apply before creation. Epic and dependency links resolve to existing/newly assigned issue URLs; the conditional US-021 dependency note for US-022 is preserved. The epic lists planning IDs and is never rewritten afterward to insert assigned story numbers. Planning IDs are not GitHub issue numbers.

Run only one operator/import at a time: the immediate pre-create recheck is not a distributed lock. Creation is non-transactional. After a failure, inspect GitHub and the printed mappings, resolve access/conflict problems without blindly deleting issues, preview again, and rerun the same apply command when authorized. Successful earlier creations are discovered and skipped; only missing items are created. If a creation returns an unexpected URL, inspect GitHub before retrying because the issue may already exist.

Focused validation: `node --test scripts/import-ep-04.test.mjs` (also included in `npm test`).

## Workflow
Use one branch and pull request per user story. Branches follow `feature/us-XXX-short-description` (for example, `feature/us-001-repository`). Run the documented checks before review and merge. See AGENTS.md and docs/architecture/README.md.

## Versioning and license
The repository starts at version `0.1.0`, defined in the root and desktop package manifests. Until a license is explicitly selected, the project is not offered under an open-source license; do not add license headers or assume permission to redistribute it. Future releases will use Semantic Versioning once the release process is established.
