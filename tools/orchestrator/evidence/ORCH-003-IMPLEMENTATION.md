# ORCH-003 implementation and validation evidence

Prepared 2026-10-17 for independent technical review and explicit PO acceptance. Implementation was authorized; this report does not approve or close the story or authorize publication.

## Baseline and authorization

- Repository: heyitsanuar/coffee-break; story [ORCH-003 #102](https://github.com/heyitsanuar/coffee-break/issues/102), epic [DEV-ORCH #99](https://github.com/heyitsanuar/coffee-break/issues/99). Both were read live.
- Began clean on main at 1288d0675c4e34993fdfc4fce9bc6893a82a86d6, exactly the approved baseline. Merged ORCH-002 #106 is integrated.
- Created only codex/orch-003-input-snapshots-reports. HEAD remains the baseline, with no staging, implementation commit, push or PR.
- Read AGENTS.md, architecture documentation, orchestrator README, ORCH-001 limitations, ORCH-002 evidence and the completed discovery. Applied the implementer, architecture and testing skills. No agents were delegated or executed.

## Exact file inventory

Eight existing files modified and eighteen added, twenty-six files total. All are under tools/orchestrator/:

- [tools/orchestrator/README.md](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/README.md)
- [tools/orchestrator/evidence/ORCH-003-IMPLEMENTATION.md](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/evidence/ORCH-003-IMPLEMENTATION.md)
- [tools/orchestrator/src/cli.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/cli.ts)
- [tools/orchestrator/src/inputs/artifacts.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/inputs/artifacts.ts)
- [tools/orchestrator/src/inputs/bundle.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/inputs/bundle.ts)
- [tools/orchestrator/src/inputs/capture.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/inputs/capture.ts)
- [tools/orchestrator/src/inputs/cli.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/inputs/cli.ts)
- [tools/orchestrator/src/inputs/contracts.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/inputs/contracts.ts)
- [tools/orchestrator/src/inputs/github.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/inputs/github.ts)
- [tools/orchestrator/src/reports/contracts.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/reports/contracts.ts)
- [tools/orchestrator/src/workflow/paths.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/paths.ts)
- [tools/orchestrator/src/workflow/reducer.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/reducer.ts)
- [tools/orchestrator/src/workflow/store.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/store.ts)
- [tools/orchestrator/test/cli.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/cli.test.ts)
- [tools/orchestrator/test/inputs/artifacts.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/artifacts.test.ts)
- [tools/orchestrator/test/inputs/bundle.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/bundle.test.ts)
- [tools/orchestrator/test/inputs/capture.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/capture.test.ts)
- [tools/orchestrator/test/inputs/cli.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/cli.test.ts)
- [tools/orchestrator/test/inputs/contracts.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/contracts.test.ts)
- [tools/orchestrator/test/inputs/fixtures.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/fixtures.ts)
- [tools/orchestrator/test/inputs/github.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/github.test.ts)
- [tools/orchestrator/test/reports/artifacts.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/reports/artifacts.test.ts)
- [tools/orchestrator/test/reports/contracts.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/reports/contracts.test.ts)
- [tools/orchestrator/test/reports/fixtures.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/reports/fixtures.ts)
- [tools/orchestrator/test/workflow/reducer.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/reducer.test.ts)
- [tools/orchestrator/test/workflow/process-fixtures.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/process-fixtures.ts)

The existing source-running process fixture now transpiles inputs/reports alongside workflow modules, so cold-start/process-crash tests continue to exercise actual current source without ignored dist output. It adds a controlled artifact-publication barrier. The two new test fixture helpers and report-artifact suite are within the authorized test directories. No production module outside the seven approved additions was introduced.

## Implemented boundaries

- inputs/contracts.ts: strict bundle/capture/import/scope/issue contracts, fixed limits, exact AC extraction, path exclusions, explicit basis policy and the unapproved-pilot blocker.
- inputs/bundle.ts: canonical core ordering, SHA-256 identity, byte/reference verification, supported legacy design manifest checks and explicit drift comparison.
- inputs/github.ts: fixed issue/Git read plans, opaque host-session authentication separated from diagnostics, scrubbed command environments, bounded binary output, deadlines and owned-group cleanup.
- inputs/capture.ts: selected committed Git blob capture, canonical-root/cleanliness checks, bounded descriptor reads, source comparisons, exact imports and explicit freshness checks.
- inputs/artifacts.ts: private immutable blobs/bundles/capture/report records, writer-token and journal/checkpoint/intent barriers, quota checks including failed temporaries, historical report verification and duplicate/conflict handling.
- reports/contracts.ts: controller envelope, untrusted payload and derived assessment; genuine attempt/input/source/role bindings; coverage/evidence policy; explicit partial/interrupted output; escaped human view.
- inputs/cli.ts and root routing: capture, attach, offline verify, requested fresh check and validation-only report commands. No execution or approval commands.
- WorkflowStore: typed publish/attach/verify operations inside existing ownership. New namespaced input references and attempt-start metadata require retained integrity. Legacy opaque references remain metadata only and cannot satisfy new consumers.

Workflow contracts, journal v1, lock reclamation, ORCH-001 diagnostic runner/policy and original security JSON evidence are unchanged. There are no application/design, root manifest, dependency, installation or real security-configuration changes. The shared reducer now enforces exact verified replacement identity for F2, as detailed below.

## Identity and durability decisions applied

The canonical scope core includes exact issue fields/ACs, repository/story, full baseline, clean-checkout fact, selected files, byte-exact imports/basis policy, scope/non-goals/validation/unresolved decisions and applicable policy/template digests. File/import/applicable collections are consistently ordered. SHA-256 covers the existing bounded canonical JSON encoding; no RFC 8785 claim is made.

Capture UUID/run UUID/time/local root/physical import locators are outside that portable core. Origins are stable logical identifiers, not machine-specific absolute/file-URI paths. Byte blobs preserve CRLF and original design provenance/banners verbatim. Historical imports retain their basis SHA and require an explicit matching retained policy/rationale rather than silently becoming current-basis authority.

All nine approved limits are enforced: 256 selected files; 8 MiB/object; 1 MiB/issue; 2 MiB per discovery/scope import; 1 MiB manifest; 64 MiB bundle; 1 MiB structured report; 256 MiB retained artifacts including failures. Existing event/journal/checkpoint limits are unchanged.

Publication validates bounds and source-derived data, synchronizes exclusive temporary objects, publishes complete immutable names without replacing accepted objects, verifies the bundle/capture bindings and leaves workflow attachment explicit. Recovery never adopts an orphan, fetches GitHub, recaptures inputs or launches a process. Unresolved intent, torn/corrupt/unsupported history and inconsistent checkpoints remain write barriers.

Initial attachment uses inputs.accepted. Replacement explicitly uses inputs.changed, followed by a separate re-acceptance. Crashing between those events leaves the inputs stage pending. Exact event-ID/timestamp retries retain existing audit/idempotency semantics; the old bundle and journal prefix remain intact.

Durable report publication verifies controller state against the actual current journal/checkpoint, with no unresolved intent. Report observation revision/sequence is separate from idempotency identity. Stored-report verification reconstructs the verified historical prefix, so later recovery cannot erase an earlier report or reinterpret it as settling the current attempt. The logical report identity binds run/repository/story/role/stage/attempt/source/input/producer/payload and excludes receipt time. Pure validation trusts its controller context and does not authenticate a model session.

## AC-01 through AC-13 coverage

These are implementation/test assessments, not independent acceptance.

| AC | Assessment | Evidence |
| --- | --- | --- |
| AC-01 | PASS | Fixed read-only issue operation; repository/number/URL/body/state validation, exact AC IDs/text and separate capture provenance; fake auth/read/parse/identity failures never yield empty valid snapshots |
| AC-02 | PASS | Full baseline/canonical repository root; clean tracked/nonignored-untracked status; committed tree/blob reads; before/after working bytes and HEAD/status; dirty/missing/changed/unsupported-mode tests; private all-entry flag inspection rejects assume-unchanged/skip-worktree on unselected files before status |
| AC-03 | PASS | Relative manifest paths, raw byte SHA-256/length/source SHA/provenance, retained original PNG bytes and selected-manifest verification |
| AC-04 | PASS | Published EP-07 compatibility test reads original README/manifest/desktop/compact PNG bytes; old /Users/asdf paths/banners preserved as data; only exact self-entry omission accepted; static classification enforced |
| AC-05 | PASS for generic imports; actual US-037 pilot BLOCKED | Exact original bytes/origin/basis/limitations/kind/version; explicit historical policy; synthetic imports only; no production discovery/scope fabricated or approved |
| AC-06 | PASS | Strict required payload/envelope/assessment contracts, size/section/completion checks and escaped human output; partial/interrupted output cannot complete an attempt |
| AC-07 | PASS | Run/repository/story/role/stage/attempt/source/input/producer bindings; payload provenance rejected; actual journal-state publication check rejects invented attempts; historical observation prefix retained |
| AC-08 | PASS | Every expected AC once; missing/duplicate/unknown IDs rejected; evidenced/partial/not-evidenced/N/A separated; rationale plus applicable N/A policy required; unsupported/imported runtime claims remain unverified |
| AC-09 | PASS | Stable canonical scope fingerprint across clock/run/root/key/manifest collection ordering; includes issue/baseline/references/imports/scope/non-goals/validation/policy/template inputs |
| AC-10 | PASS | Independent relevant-input mutation tests and explicit drift; immutable bundle/capture identity conflicts preserve old objects; replacement explicit |
| AC-11 | PASS | Offline stored integrity distinct from explicitly requested freshness; changed and unavailable sources produce drift/unverified blockers; flagged indexes return unverified, never FRESH; no automatic replacement or authorization |
| AC-12 | PASS | Bounded fixed-code blockers for missing/unsupported/unsafe/sensitive/changed inputs, invalid manifests, mismatches and exhausted quota; symlink/hard-link/controlled-parent-swap and ambiguous/flagged-index tests; no source/GitHub writes |
| AC-13 | PASS | Deterministic adapters/faults, published binary compatibility, real local Git reads and killed-publisher barrier; original ORCH-001/002 suites including F1/F2 retained; F3 real flagged-index/store and malformed-inspection regressions; no fake runtime/native success |

## Actual validation

| Command | Observed result |
| --- | --- |
| npm run test --workspace tools/orchestrator -- --no-cache | PASS: 212 tests, 21 suites, no skipped cases; original 99 tests preserved plus 113 additions (including 13 F1/F2 and 9 F3 correction regressions) |
| npm run typecheck | PASS across configured workspaces |
| npm run lint | PASS exit 0; two existing unused-disable warnings in generated desktop Phaser output; orchestrator clean |
| npm run build | PASS: desktop and orchestrator |
| npm test | FAIL exit 1: importer 54 pass; desktop 266 pass / 23 fail; contracts 1 pass; orchestrator 212 pass |
| git diff --check | PASS; new/untracked file whitespace checked separately |
| Protected-file comparison | Application/contracts/design/instructions/root manifests/diagnostic/journal/lock/original-JSON files remain byte-identical to baseline; the reducer has only the targeted F2 identity guard |

Tests were written before initial modules. Later negative regressions exposed order-only drift, unsupported validation claims being omitted from assessment, report-identity conflict misclassification, unsupported stored-report/CLI exit classification and acceptance of unjournaled report context; each failed before correction. A combined run exposed ancestor-directory timestamp noise from unrelated fixture creation: directory checks now compare identity/permissions while file checks retain full content metadata. A test-spy typing error was corrected before final typecheck/build. No assertion was weakened. Filtered red runs selected individual regressions; the final full focused execution has no skipped tests.

Current F3 validation logs: /private/tmp/coffee-break-orch003-f3-{focused,typecheck,lint,build,full-test}.log. The F1/F2 correction logs retain the corrections prefix. The earlier implementation logs remain retained separately. Temporary synthetic run stores are removed by test cleanup; no production run/bundle/report was created.

## Artifact/fingerprint and failure evidence

- Contract/bundle suites prove stable hashes across run/time/root/key/collection order, immutable original bytes, relevant-input mutation, wrong content/blob sets, unknown versions, metadata/resource bounds and exact AC identity.
- Capture suite exercises dirty and untracked checkouts, changed/missing baseline/source, byte mismatches, unsupported modes, exact/historical imports, the blocked six-criterion pilot, symlink/hard-link exclusions and a controlled parent swap. Redirected descriptor content is not read.
- A read-only integration case uses installed local Git to compare committed PNG bytes with the published reference. It resolves current HEAD, so it does not depend on an old commit object existing in shallow CI checkouts.
- Artifact suites exercise failed writes before/after write/publication, preserved temporary evidence/quota exhaustion, missing/corrupt blobs, wrong run identity, explicit replacement, audited duplicate attachment and legacy controls.
- A real Node fixture publisher is killed at a synchronized temporary-publication barrier. Controlled boot identity plus actual PID death exercises the existing lock algorithm; recovery preserves the temporary bytes and leaves input absent. This is not native macOS boot-identity/reclamation evidence.
- Report suites exercise controller spoofing, unknown AC/evidence/identity, partial/interrupted output, unsupported claims/N/A policy, immutable duplicate/conflicting content and producer identity, interrupted report publication, future stored schema and genuine journal provenance across later recovery.
- Unresolved journal intent blocks even low-level publication without clearing the marker. Original F1/F2 regressions remain passing. Cold recovery still makes zero subprocess attempts.

## Full-suite baseline comparison

The 23 fresh desktop failing test names match the retained exact-baseline inventory. Twenty-two failures are listen EPERM on 127.0.0.1; one pending-bind assertion sees an undefined port after denial. These failures were previously reproduced on unchanged main. No fresh isolated baseline execution was performed for ORCH-003; the historical comparison plus unchanged application/contracts/root dependencies and identical current failure inventory establish that these are pre-existing environment failures. The root test command is recorded as FAIL, not PASS.

## GitHub adapter boundary

Only fixed gh issue-view and local Git root/head/metadata/tree/blob operations plus private-view index-list/status operations are reachable. No create/update/delete endpoint, arbitrary executable, issue command, filter, renderer or model task is exposed. Calls use argv without a shell, bounded combined output, a 30-second deadline and owned-group TERM/KILL cleanup. Git runs without global/system configuration and with optional locks, fsmonitor, hooks, replacement refs and lazy fetch disabled. All worktree-inspecting operations use the private configuration-isolated view described below; local filter definitions are not loaded. Raw stderr is not logged or returned.

Only gh receives the normal host home location for its existing opaque session. Token/config-override/proxy/injection variables are not forwarded. The controller does not obtain an auth token or claim that the underlying account's token has read-only scopes. Authentication integration is exercised through injected fixtures, not a live end-to-end new-adapter session. Token-only/custom-config sessions may fail closed. The original diagnostic environment/policy is unchanged; this trusted-controller adapter is not proof of native isolation or a permission expansion for agents.

## US-037 and remaining limitations

Actual US-037 readiness remains PILOT_INPUTS_REQUIRED. Authoritative Developer discovery and Planner scope bytes/digests have not been supplied/approved. No override exists; generic synthetic import tests and the copied static references do not create pilot authority. The six AC identities are exercised with synthetic pilot issue data. No production US-037 capture/import was attempted.

- Native Codex/filesystem/credential/network/child-process/plugin/MCP enforcement remains unverified. Diagnostic fail-closed readiness is unchanged; workflow tests do not establish execution security.
- ORCH-002 AC-06 remains PARTIAL: default native macOS dead-writer reclamation is unavailable. No helper, force-unlock, stolen ambiguous lock or relaxed boot requirement was added.
- Private local storage assumes cooperative controllers; portable checks/rename are not a hostile same-user openat/no-replace or TOCTOU/ABA guarantee.
- Hardware power-loss durability is unverified. File/directory synchronization and process-crash boundaries were tested.
- Capture/freshness is point-in-time and covers declared inputs, not an atomic cross-system transaction or undeclared future model reads.
- Sensitive-path exclusions are not universal content-secret detection. Use only explicitly approved input documents; hashes and structurally valid references do not authenticate external truth or human approval.
- Unsupported AC formatting, unknown manifest schemas, torn/uninitialized/legacy-invalid history and exhausted retained storage block; there is no automatic repair, eviction or migration.
- CLI report validation has no controller execution-observation or N/A-policy import flag. It does not establish AC acceptance. Actual Designer execution/report collection remains ORCH-004; real PO approval/handoff remains ORCH-005.

## Independent review corrections: F1 and F2

This section retains the historical 203-test F1/F2 checkpoint; current F3 validation is recorded below.

The independent review returned REQUEST CHANGES. These corrections address only the authorized HIGH F1 and MEDIUM F2. They are implementation evidence, not independent re-review or PO acceptance.

### Exact correction-only inventory

Ten existing implementation files changed relative to the saved pre-correction working-tree inventory:

- `tools/orchestrator/src/inputs/github.ts`
- `tools/orchestrator/src/workflow/reducer.ts`
- `tools/orchestrator/src/workflow/store.ts` (explanatory comment only)
- `tools/orchestrator/test/inputs/github.test.ts`
- `tools/orchestrator/test/inputs/capture.test.ts`
- `tools/orchestrator/test/inputs/artifacts.test.ts`
- `tools/orchestrator/test/inputs/fixtures.ts`
- `tools/orchestrator/test/workflow/reducer.test.ts`
- `tools/orchestrator/README.md`
- `tools/orchestrator/evidence/ORCH-003-IMPLEMENTATION.md`

The reducer and reducer test are the two additional tracked changes versus the prior 24-file inventory. Existing attachment/apply operations already pass through journal decision/reduction; placing the invariant only in store preflight would miss replay and would not produce the existing durable rejection protocol. No new event API or event/schema field was added. Sixteen of the previous twenty-four implementation files remain byte-identical to the saved pre-correction content inventory; the other eight have only these targeted source/test/documentation corrections. No prior file/test was removed.

### F1 HIGH — Git filter execution

Root cause: disabling global/system configuration and overriding hooks/fsmonitor did not disable local `filter.*.clean`/`filter.*.process`. Ordinary repository-configured status could invoke them while comparing working files. An outer `shell:false` was insufficient.

Correction: `inputs/github.ts` now routes status exclusively through `isolatedStatus`. Only metadata/object reads run against the original Git directory. A bounded private directory receives a checked copy of the index, resolved HEAD, optional local `info/exclude` and a minimal generated configuration; objects are read through the original object directory. It receives no original configuration, hooks, attributes, remote/helper configuration or worktree configuration. Original `.gitattributes` can select a filter name, but the corresponding executable definition is unavailable. This does not enumerate/override a potentially changing list of driver names. Raw executable status plans are not exposed by `readPlan`.

The index/exclude copies use bounded `O_NOFOLLOW` descriptors and identity/metadata rechecks. Explicit Git/common-directory locators derive the original metadata filenames; using `--git-path` alone was found to resolve symlink targets before validation, so it is not used for these copies. Original index/configuration are unchanged. Worktree `.gitignore` and local exclusions remain respected, and nonignored untracked and tracked changes remain visible. Selected committed-object/source/HEAD checks remain in place. Global/system attributes, replacement refs and lazy object fetching are disabled. Unknown options/metadata, missing or unsafe indexes, unsupported index entries/submodules and private setup failures block without any fallback to unsafe status. An aggregate 30-second observation deadline and the existing termination limits remain enforced. Normal failure/cancellation/success cleanup removes private metadata; cleanup failure prevents success.

Negative regressions use only disposable trusted fixtures with local clean/process definitions set to an inert sentinel. A spawn guard rejects any original-repository status before Git starts: red runs never executed even that sentinel. Both definitions now permit genuinely clean capture/freshness; tracked modifications and nonignored untracked files block capture and report freshness drift. An unavailable index blocks capture and reports freshness unverified. Tests verify `.gitignore`/local-exclude handling, unchanged original index/configuration, missing/symlink indexes, malformed metadata, unsupported options, submodule refusal, already-aborted signals, and cleanup of private metadata after success/refusal. The initial six focused regression cases failed before production changes and pass after correction. A full run exposed a missing test-fixture info directory and the resolved-symlink locator issue; both were corrected without weakening assertions.

F1 limitations: repository-specific content normalization, file-mode/ignore settings and external excludes are not loaded. Some configured-clean checkouts can conservatively block. Sparse/split indexes requiring unrepresented metadata, submodules and older Git lacking fixed isolation options are unsupported and fail closed. This is fixed-operation configuration isolation, not a native sandbox or hostile same-user scratch-directory/TOCTOU guarantee. A controller crash can leave private inert temporary metadata. GH authentication and ORCH-001 diagnostics are unchanged.

### F2 MEDIUM — Replacement re-acceptance identity

Root cause: `attachInputs` checked pending identity in store preflight, but `WorkflowStore.apply` only verified that the alternative bundle existed. The reducer permitted any `inputs.accepted` payload while in the inputs stage; thus a verified C could replace selected B without a new change event.

Correction: the `inputs.accepted` reducer branch requires exact current reference ID and digest when either side is a verified bundle reference and a selection already exists. Both store entry points use the existing journal decision before verification/commit, so C and opaque-reference substitutions receive durable `INPUT_REPLACEMENT_REQUIRED` rejections. The pending B, inputs stage and revision remain unchanged; journal sequence advances only to audit the rejection. The same reducer is used during replay. Existing initial attachment, explicit replacement/acceptance and opaque-only legacy transitions are retained. Already-invalid historical transitions are not rewritten or migrated into valid history. Locking, intent fencing, journal v1, schemas and ORCH-002 reconciliation protections remain unchanged.

The actual-store regression runs A publication/acceptance, B publication/replacement, C publication, typed C rejection, restart/recovery, apply(C) rejection, journal audit inspection and replay, then successful explicit apply(B) and another restart. Both rejection records are committed; no C transition to designer_review occurs. Reducer regressions also reject same-digest/different-ID, same-ID/different-digest and opaque-reference substitution while preserving legacy-only behavior. Existing typed B acceptance and ORCH-002 F1/F2 suites pass.

### Correction validation and stop

Final focused result: **203 passed, 21 suites, no skipped tests**, including all previous 190 cases plus thirteen new regressions. Root typecheck, lint and build pass; lint retains two existing generated desktop warnings. `git diff --check` and new-file whitespace checks pass. Full `npm test` exits 1: importer 54 pass, desktop 266 pass / 23 fail, contracts 1 pass, orchestrator 203 pass. The fresh twenty-three desktop failure names exactly match the retained baseline inventory (22 loopback EPERM entries and one dependent undefined-port assertion); no new isolated baseline run was performed. Initial test/type errors were corrected; the final commands passed as recorded.

The US-037 `PILOT_INPUTS_REQUIRED` blocker remains in force. Native isolation remains unverified, ORCH-002 AC-06 remains PARTIAL, and no agent/approval/handoff/ORCH-004/005 execution was added. Existing original JSON evidence remains unchanged. Nothing was staged, committed, pushed or submitted as a PR. Stop for independent Reviewer re-review and explicit PO acceptance.

## Targeted F3 correction — Index flags

F1 HIGH and F2 MEDIUM were independently verified corrected. The remaining F3 MEDIUM was authorized for targeted correction only. Branch is codex/orch-003-input-snapshots-reports; HEAD remains 1288d0675c4e34993fdfc4fce9bc6893a82a86d6. No files were staged or published.

### Exact F3 file inventory

Only these six existing ORCH-003 implementation files changed relative to the saved pre-F3 working tree; no files were added or removed:

- [src/inputs/github.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/inputs/github.ts)
- [test/inputs/capture.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/capture.test.ts)
- [test/inputs/github.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/github.test.ts)
- [test/inputs/fixtures.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/inputs/fixtures.ts)
- [README.md](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/README.md)
- [evidence/ORCH-003-IMPLEMENTATION.md](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/evidence/ORCH-003-IMPLEMENTATION.md)

The other twenty pre-existing implementation files are byte-identical to the pre-F3 content inventory, including the F2 reducer/store correction and its tests. The full working tree still contains only the prior twenty-six ORCH-003 files. The real repository index SHA-256 matches the pre-F3 index hash.

### Root cause and rejection mechanism

The F1 private Git view copied index flags but inspected only mode/object/stage with ls-files --stage. Git status still trusted copied assume-unchanged and skip-worktree bits. A modified tracked file outside the selected input list could therefore remain invisible to status, capture and freshness.

The same isolated Git view now runs **ls-files --stage -v -z** over every index entry, before any status invocation. Local installed Git documentation confirms that -v emits lowercase tags for assume-unchanged and S/s for skip-worktree. The strict parser requires a recognized tag, supported mode, full object-ID length matching the repository format, stage zero and NUL framing. h, S and s return the stable blocked code **READ_GIT_INDEX_FLAGS_UNSUPPORTED**. The catch boundary preserves this code. Unknown/missing tags, invalid modes/IDs, unmerged stages, malformed/truncated output and unsupported metadata fail closed as READ_GIT_ISOLATION_UNVERIFIED.

The selected input list does not restrict inspection. No flag is cleared. No index is rewritten. Capture fails before it can return checkout.clean=true; freshness converts this rejection into unverified with the same code, never FRESH. Existing workflow state and bundles are not mutated. This changes no journal/workflow schema or original security policy.

### Regression evidence

Three disposable-repository/store cases cover assume-unchanged, skip-worktree and both flags together on a modified **unselected.md**, which is explicitly absent from selected inputs. Each starts with a clean successful capture, publishes/accepts a real retained bundle, sets the fixture flag(s), changes working bytes, and collects isolated observation/capture/freshness outcomes. Each verifies:

- Observation and capture reject with READ_GIT_INDEX_FLAGS_UNSUPPORTED.
- Freshness is unverified with that code and cannot return FRESH.
- No status process starts after the flagged inspection.
- The original flagged fixture index remains byte-identical across all three operations.
- Every retained run file remains byte-identical; offline bundle verification and its fingerprint still match the original.
- Local clean/process sentinel definitions remain isolated; no filter program executes.

Six additional cases reject missing/unknown tags, unmerged stage, missing NUL, truncated output and unsupported mode; they preserve the original index and verify private metadata cleanup. Existing ordinary-clean, dirty tracked, nonignored untracked, pinned binary object, F1 clean/process filter, F2 A-to-B-to-C/replay and ORCH-002 reconciliation tests all remain passing.

The pre-fix run reproduced fulfilled false-clean observation in all three flagged cases and accepted untagged inspection output (four failing cases; five other malformed cases already rejected). All three capture/freshness calls were collected before the red assertions, so the reproduced paths were exercised independently. An initial fixture setup attempt revealed that update-index can refresh other files and try the known non-existent sentinel; it failed to start any filter program. Fixture setup now overrides only that known sentinel's clean/process/required settings for the flag-setting command, without modifying stored configuration or production isolation. No untrusted executable was run.

### Actual F3 validation

| Command | Result |
| --- | --- |
| npm run test --workspace tools/orchestrator -- --no-cache | PASS: **212 tests, 21 suites, no skips**; all previous 203 plus nine new cases |
| npm run typecheck | PASS, root configured workspaces |
| npm run lint | PASS; two existing generated desktop unused-disable warnings |
| npm run build | PASS, desktop and orchestrator |
| git diff --check | PASS; all changed/untracked implementation files also checked for trailing whitespace |
| npm test | FAIL exit 1: importer 54 pass; desktop 266 pass / 23 fail; contracts 1 pass; orchestrator 212 pass |

The fresh desktop failing names exactly match the retained baseline inventory: 22 loopback EPERM entries and one dependent undefined-port assertion. No fresh isolated baseline run was performed. Root full-test failure is not reported as a pass. Filtered red/green runs selected the nine new cases; the final complete focused run has no skipped cases.

### Limits and stop

Only recognized ordinary stage-zero index entries without suppression flags are supported. Sparse/split arrangements needing missing metadata, submodules, unmerged entries and ambiguous/unsupported inspection output block. This rejects unsupported states rather than repairing or clearing them. The unchanged F1 minimal Git configuration can conservatively reject configured-clean checkouts. Existing private-directory/cooperative-filesystem, point-in-time TOCTOU/ABA and hardware power-loss limitations remain; this is not native sandbox enforcement. Native/plugin/MCP isolation remains unverified and ORCH-002 AC-06 remains PARTIAL.

US-037 remains PILOT_INPUTS_REQUIRED pending authoritative inputs. No application/design/root-dependency changes, installs, agent execution, approvals/handoff, ORCH-004/005 work or GitHub mutations occurred. No original real index modification, staging, commit, push, PR or merge occurred. Stop for independent Reviewer re-review and explicit PO acceptance.

## Stop and scope confirmation

No feature or execution-capability expansion from the approved hybrid implementation. The targeted F2 correction additionally touches the existing shared reducer and its tests, because durable rejections and journal replay must enforce the same rule; schemas and journal v1 remain unchanged. Test helpers and additional regression cases remain within authorized test scope. No dependency installation, root dependency edit, application/design/security-policy change, workflow schema/journal-format change, lock-reclamation change, real credential read, Codex inference or autonomous agent execution occurred. No files were staged, committed, pushed or submitted in a PR; no GitHub issue was changed. ORCH-004/005 were not started.

Stop for independent Reviewer assessment and explicit PO acceptance. Publication remains unauthorized.
