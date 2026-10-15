# ORCH-001 implementation and validation record

Prepared 2026-10-15 for Planner scope review, independent Reviewer assessment and Product Owner implementation acceptance. This record does not grant approval or mark the story accepted.

## Repository and scope

- Story: [ORCH-001 #100](https://github.com/heyitsanuar/coffee-break/issues/100); epic: [DEV-ORCH #99](https://github.com/heyitsanuar/coffee-break/issues/99).
- Branch: `codex/orch-001-cli-foundation-security`.
- Verified full HEAD: `8237a03fde7f4b3684fced01f79e9ded67f90bf0`, unchanged from the approved baseline.
- Started clean; current tracked changes are only root `package.json` and `package-lock.json`. New source, tests, documentation and evidence are confined to `tools/orchestrator/`.
- No application/design implementation, later orchestrator stories, model inference, autonomous agents, staging, commits, pushes, GitHub mutations or PR publication occurred.
- No runtime dependencies were added. Existing installed TypeScript, ESLint, Vitest and Node types were reused. The workspace lockfile was refreshed offline with `npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund`; no packages were downloaded or lifecycle scripts run.

The implementation adds a standalone diagnostic CLI, versioned typed report, fixed metadata-command catalog, exact-alpha capability checks, fail-closed classification, bounded process groups, an independent macOS safety guard and opt-in synthetic security probes. It has no imports from Electron, React, Phaser or shared application contracts. No workflow engine, approval storage, issue snapshotting, Designer execution or handoff generation was implemented.

## Exact file changes

Modified:

- [package.json](/Users/anuar/Documents/Projects/coffee-break/package.json) — explicit tooling workspace.
- [package-lock.json](/Users/anuar/Documents/Projects/coffee-break/package-lock.json) — matching workspace/link metadata; existing dependency resolutions preserved.

Added package/documentation files:

- [package.json](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/package.json)
- [tsconfig.json](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/tsconfig.json)
- [eslint.config.js](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/eslint.config.js)
- [README.md](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/README.md)

Added implementation files:

- [cli.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/cli.ts) — strict argument surface, help/version, text/JSON output and exit codes.
- [contracts.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/contracts.ts) — checks, reports, readiness and identity comparison.
- [policy.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/policy.ts) — versions, restrictions, limits and digest.
- [process.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/process.ts) — environment scrubbing, bounded argv-only processes, cancellation and group cleanup.
- [guard.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/guard.ts) — independent Seatbelt safety envelope.
- [codex-capabilities.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/codex-capabilities.ts) — exact version/help-interface classification.
- [doctor.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/doctor.ts) — diagnostic coordination, baseline/integrity checks and evidence.
- [fixtures.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/probes/fixtures.ts) — private synthetic inputs and integrity hashing.
- [helper.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/probes/helper.ts) — fixed non-inference operations; no secret contents printed.
- [security.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/probes/security.ts) — guard/native probes, loopback positive control, classification and cleanup.

Added tests:

- [cli.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/cli.test.ts)
- [contracts.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/contracts.test.ts)
- [capabilities.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/capabilities.test.ts)
- [doctor.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/doctor.test.ts)
- [process.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/process.test.ts)
- [security.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/security.test.ts)

Added evidence:

- [cli-examples.json](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/evidence/cli-examples.json)
- [doctor.json](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/evidence/doctor.json)
- [doctor-probe-security.json](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/evidence/doctor-probe-security.json)
- [protected-inputs.json](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/evidence/protected-inputs.json)
- [IMPLEMENTATION.md](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/evidence/IMPLEMENTATION.md)

There are 25 added files and two modified tracked files. Required builds also generated ignored `dist/` and desktop `out/` artifacts; application source remains unchanged.

## Acceptance-criteria coverage

The issue is authoritative. “Implemented/tested” below describes code and automated evidence, not independent acceptance. Native enforcement remains unverified on this host.

| Criterion | Implementation and evidence | Current limitation |
| --- | --- | --- |
| AC-01 | Six requested command variants, strict parsing, documented exit codes, schema-v1 JSON/failure envelope; CLI tests and actual output | Doctor exits 3 because required checks are unverified |
| AC-02 | Discovered paths, bounded command outcomes, actual-version parsers, separate missing/incompatible classifications; mocked tool tests | Guarded version commands cannot start here; their version fields are honestly null |
| AC-03 | Installed `exec`/`sandbox` help catalog and independent checks for noninteractive input, JSONL, structured final, cwd, images, read-only and config interfaces; help-drift tests | Guarded help is withheld when exact version cannot be established; current preflight is unverified |
| AC-04 | Four statuses, required flags, fixed reasons, bounded evidence/digests, fail precedence and explicit unexecuted checks; contract/classifier tests | No unexecuted boundary is promoted to pass |
| AC-05 | Disposable allowed-read and create/modify/rename/delete/Git write probes; fixture-integrity tests and actual guard attempt | Codex native operations were not reached because Seatbelt initialization failed |
| AC-06 | Synthetic credential/controller/symlink denials; controlled loopback positive control; non-disclosure and ineffective-restriction tests | Native denials remain unverified; loopback listener itself is denied by this host |
| AC-07 | Scrubbed environment; guarded account paths; child-process probe; required plugin/MCP blocker; TOML/instructions explicitly insufficient | Effective external tool/plugin/MCP isolation cannot be established without additional evidence and remains unverified |
| AC-08 | `spawn`, argv arrays, no shell, 30s/60s deadlines, 1MiB combined cap, TERM/KILL, cancellation and group-disappearance verification; actual owned-process tests | Cleanup covers owned POSIX groups, not arbitrary hostile detached processes |
| AC-09 | Derived fail-closed readiness, no bypass/escalation/install/auth/config mutation path; missing/failed/unverified tests | `ready=false` in every actual doctor run |
| AC-10 | Read-only metadata guard, synthetic-only mutation targets, fixed commands, before/after protected-input checks | In-tool baseline unavailable under the guard; independent implementation verification confirms 319 protected files unchanged |
| AC-11 | Full SHA/status/content digest, Codex binary SHA-256, diagnostic/policy/profile identity and stale-comparison helpers; identity tests | Current blocked preflight has null repository/fingerprint fields and cannot be reused as valid preflight evidence |
| AC-12 | 24 tests across six suites cover missing/incompatible tools, drift, misleading success, disclosure/mutation detection, deadline/cleanup, overflow, interruption and fail-closed outcomes | Unit/mock results do not replace native enforcement validation |

## Actual CLI commands and outputs

All six variants were executed through the compiled CLI entry point. Complete output is preserved in the evidence JSON files above. Commands use `node tools/orchestrator/dist/src/cli.js` (the documented npm workspace command calls the same entry point).

| Arguments | Actual result | Exit |
| --- | --- | --- |
| `--help` | `cb-flow 0.1.0 — local, non-inference diagnostics`, usage and exit-code documentation | 0 |
| `--version` | `0.1.0` | 0 |
| `doctor` | `ready=false`, `exitCode=3`, explicit blocker IDs | 3 |
| `doctor --json` | Schema-v1 report, `ready: false`, bounded outcomes and unverified checks | 3 |
| `doctor --probe-security` | `ready=false`, `exitCode=3`, guard/positive-control and security blockers | 3 |
| `doctor --probe-security --json` | Schema-v1 native-attempt report, `ready: false` | 3 |

## Security probe outcomes

The opt-in native attempt was executed, with real tool-owned fixtures and process cleanup. The independent guard exited **71** with the recognized condition `sandbox_apply: Operation not permitted`. Its outcome is recorded as `guardUnavailable: true`, not successful denial evidence. The parent-controlled loopback listener also received **EPERM**. No permission expansion, unguarded fallback or configuration change was attempted.

| Check | Actual result |
| --- | --- |
| Outer OS guard synthetic read/write test | Attempted; unverified because Seatbelt could not initialize |
| Controlled endpoint bind | Attempted; EPERM, so no successful positive control |
| Codex native allowed-input read | Not reached; unverified |
| Codex native create/modify/rename/delete denial | Not reached; unverified |
| Codex native credential/controller/symlink denial | Not reached; unverified |
| Codex native Git metadata denial | Not reached; unverified |
| Codex native child-process restrictions | Not reached; unverified |
| Codex native network denial | Not reached; unverified; connection failure is not counted as policy denial |
| Probe fixture integrity | Passed after the attempted guard command |
| Probe fixture removal | Passed after confirmed process-group termination |
| Effective plugin/MCP isolation | Unverified; required readiness blocker |

Separate unit tests actually execute the fixed helper **without isolation only against disposable test fixtures**, proving that unexpected writes and credential allowances are detected and synthetic credential contents never enter returned output/evidence. They also exercise real Node process-group timeout, cancellation, output overflow and descendant cleanup. These are controlled test results, not successful Codex sandbox enforcement.

The previously observed PATH-alias warning is documented and tested as a retained warning flag. In these final guarded runs Codex never started, so the warning flag is false; it is not fabricated as newly observed evidence.

## Original implementation validation results (before F1–F4 corrections)

| Command | Result |
| --- | --- |
| `npm run test --workspace tools/orchestrator` | PASS: 24 tests, six suites |
| `npm run typecheck` | PASS: desktop, contracts and orchestrator included |
| `npm run lint` | PASS, exit 0; two unused-disable warnings in ignored generated desktop `out/renderer/assets/createOfficeGame-ujkITRew.js`; orchestrator lint clean |
| `npm test` | FAIL, exit 1: importer 54 pass; desktop 266 pass/23 fail; contracts 1 pass; orchestrator 24 pass |
| `npm run build` | PASS: desktop and orchestrator built |
| `git diff --check` | PASS |
| Final focused typecheck/lint/test/build after final tooling refinements | PASS |
| Explicit native CLI probe run | Executed; exit 3/unverified, as detailed above |
| Protected-input SHA-256 comparison | PASS: all 319 files match the captured pre-implementation baseline |

The 23 full-suite failures are confined to unchanged desktop loopback suites: `localIngress` (10), `simulatorController` (2), `simulatorRecovery` (6), simulator integration (1), and `localEventIntegration` (4). Twenty-two show `listen EPERM: operation not permitted 127.0.0.1`; the remaining pending-listen test receives an undefined bound port after the denied listen. No desktop source was edited. This report does not claim a clean-baseline test run or a fully passing repository suite.

Root command output explicitly includes the new workspace. The final tooling-only checks were repeated after the last tooling source changes; unrelated application checks were not repaired or weakened.

## Risks, limitations and next review

- No native Codex enforcement was successfully demonstrated here. The nested Seatbelt/profile configuration must be exercised on a supported host where the independent guard can initialize, using the same restrictions. This is outstanding validation, not permission to bypass the guard.
- Effective plugin/MCP/external-tool isolation remains unverified even if shell probes later pass. ORCH-001 deliberately cannot return ready while this required check is unresolved. No Designer execution may be inferred from these reports.
- The fingerprint supports baseline/executable/policy drift detection; it is not a complete manifest of dirty/untracked inputs, authorization record, execution history or future workflow-engine contract.
- Cleanup verifies owned POSIX process groups. It cannot prove containment of a hostile process that deliberately creates a separate group; this CLI starts only fixed trusted metadata/fixture commands, and never agents.
- A matching Codex version/help interface is insufficient runtime proof. Unknown versions stay unsupported; PATH-alias warnings do not trigger permission changes.
- No application visual/accessibility session or successful native sandbox/network integration is claimed.

There are no file-boundary or feature-scope deviations. There are material validation limits: native enforcement is unverified, and the repository test command is not fully green in this restricted environment. Implementation remains uncommitted. Stop here for Planner scope review, independent Reviewer assessment, and explicit PO implementation acceptance before any commit, push or PR.

## Independent review corrections F1–F4

The results above describe the original implementation. This correction pass changes exactly these seven existing files:

- [doctor.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/doctor.ts:44)
- [codex-capabilities.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/codex-capabilities.ts:7)
- [security.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/probes/security.ts:46)
- [doctor.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/doctor.test.ts:95)
- [capabilities.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/capabilities.test.ts:32)
- [security.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/security.test.ts:97)
- [IMPLEMENTATION.md](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/evidence/IMPLEMENTATION.md)

| Finding | Correction | Added regression cases |
| --- | --- | ---: |
| F1 | Validate repository-relative paths before filtering; use path-relative containment and canonical parents; inspect every ancestor with `lstat`; reject ancestor symlinks and non-directories. Open regular files with `O_NOFOLLOW`, verify descriptor identity before reading, and recheck the entire chain and file metadata afterward. Unsafe/changing paths produce required `repository.path-safety: fail`. Final symlinks remain text-only inputs. | 5 |
| F2 | Parse exact option declarations inside the known `Options:` section, including aliases, two/six-space declaration columns, argument placeholders/equals syntax, ellipses and wrapped descriptions. Required flags use exact map lookups. Prose, renamed/prefixed/suffixed flags and unknown required formats cannot establish a capability. JSONL and final-schema evidence remain separate. | 10 |
| F3 | Check cancellation before listen; attach error/listening handlers before startup and retain late-event guards for the one-use server's lifetime. Pending cancellation requests closure, skips subprocess execution, handles queued EPERM and late successful binds, and still removes owned fixtures. The two-second bind deadline and existing process limits remain unchanged. | 4 |
| F4 | Correct the narrative to `sandbox_apply`. Test the exact 53-byte failure and its original output digest `97e23c13336291c8a51cc1da026d43627fa6cbe70a39d676001d38bd66d9a113`; classification remains unverified with readiness exit 3. | 1 |

Tests reproduced F1–F3 before the fixes. The filesystem tests operate only on synthetic data inside owned disposable fixtures, including the target outside the synthetic repository. They cover an ancestor symlink, a directory swap between inspection and opening (no descriptor content read), final-symlink text handling, and absolute/traversal path rejection. Listener tests cover pre-start cancellation, pending-bind cancellation with late error/success events, and the unchanged timeout with a late bind. No tests were disabled or weakened.

### Correction validation

| Command/check | Actual result |
| --- | --- |
| `npm run test --workspace tools/orchestrator -- --no-cache test/doctor.test.ts test/capabilities.test.ts test/security.test.ts` | PASS: 31 cases in the three affected suites |
| `npm run test --workspace tools/orchestrator -- --no-cache` | PASS: 44 cases in six suites, including 20 added cases |
| `npm run typecheck` | PASS across configured workspaces |
| `npm run lint` | PASS, exit 0; the same two generated desktop Phaser warnings remain; orchestrator lint clean |
| `npm run build --workspace tools/orchestrator` | PASS; compiled CLI and tests |
| `git diff --check` | PASS |
| Fresh compiled `doctor --json` and `doctor --probe-security --json` | Both exit 3 with `ready=false`; all native enforcement checks unverified; no native Codex command started; owned process/fixture cleanup confirmed |

The original four JSON evidence files and their digests are preserved byte-for-byte. They remain historical records, not results attributed to the corrected source. No application code, desktop lint configuration, design references, root manifests/dependencies, security policy or process limits changed in this correction pass. The previous desktop baseline comparison was not repeated: these changes do not affect desktop dependencies or execution behavior. No inference or probing of real credentials occurred. No permissions were expanded, no sandbox was bypassed, and no GitHub mutation, staging, commit, push or PR occurred.

### Remaining limitations and review

Portable Node filesystem APIs do not provide an atomic directory-descriptor (`openat`) walk. Ancestor/canonical-path checks, descriptor identity checks and before/after metadata comparisons detect the tested swaps and fail closed on detected changes; they are not a proof against hostile concurrent ABA namespace races. A future adversarial executor still requires an independently enforced filesystem boundary. This limitation is explicit in source and does not authorize execution.

Native Seatbelt/Codex enforcement and plugin/MCP isolation remain unverified. No native enforcement pass is claimed. Unsupported or unverified readiness remains exit 3; observed unsafe repository paths are failures, with exit 1 taking precedence. Approval semantics are unchanged. Implementation remains uncommitted, pending independent Reviewer re-review and Product Owner implementation acceptance.
