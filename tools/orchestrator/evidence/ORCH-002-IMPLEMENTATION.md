# ORCH-002 implementation and validation record

Prepared 2026-10-16 for Planner scope review, independent technical review and explicit PO acceptance. This record does not approve or close the story.

## 1. Branch and baseline

- Story: [ORCH-002 #101](https://github.com/heyitsanuar/coffee-break/issues/101); epic [DEV-ORCH #99](https://github.com/heyitsanuar/coffee-break/issues/99). Both were read live; no issue-read fallback was needed.
- Started clean on main, with HEAD/local main/cached origin/main/live GitHub main all af353f3bd3c6bc7b612ee5cec82612f5a615fa5f, the merged ORCH-001 baseline.
- Created only local feature branch codex/orch-002-workflow-state-persistence. HEAD remains the approved baseline; no commit, staging, push, PR or GitHub mutation occurred.
- Seven approved architecture decisions, torn-tail constraints and cooperative private-storage threat model were followed. No agent was delegated or executed.

## 2. Exact file changes

Three existing files modified; seventeen files added; twenty files total:

- [tools/orchestrator/README.md](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/README.md)
- [tools/orchestrator/evidence/ORCH-002-IMPLEMENTATION.md](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/evidence/ORCH-002-IMPLEMENTATION.md)
- [tools/orchestrator/src/cli.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/cli.ts)
- [tools/orchestrator/src/workflow/cli.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/cli.ts)
- [tools/orchestrator/src/workflow/contracts.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/contracts.ts)
- [tools/orchestrator/src/workflow/journal.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/journal.ts)
- [tools/orchestrator/src/workflow/lock.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/lock.ts)
- [tools/orchestrator/src/workflow/paths.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/paths.ts)
- [tools/orchestrator/src/workflow/reducer.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/reducer.ts)
- [tools/orchestrator/src/workflow/store.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/src/workflow/store.ts)
- [tools/orchestrator/test/cli.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/cli.test.ts)
- [tools/orchestrator/test/workflow/cli.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/cli.test.ts)
- [tools/orchestrator/test/workflow/contracts.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/contracts.test.ts)
- [tools/orchestrator/test/workflow/fixtures.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/fixtures.ts)
- [tools/orchestrator/test/workflow/journal.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/journal.test.ts)
- [tools/orchestrator/test/workflow/lock.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/lock.test.ts)
- [tools/orchestrator/test/workflow/paths.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/paths.test.ts)
- [tools/orchestrator/test/workflow/process-fixtures.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/process-fixtures.ts)
- [tools/orchestrator/test/workflow/reducer.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/reducer.test.ts)
- [tools/orchestrator/test/workflow/store.test.ts](/Users/anuar/Documents/Projects/coffee-break/tools/orchestrator/test/workflow/store.test.ts)

The two extra test helpers separate reusable synthetic events and source-running child-process fixtures. This additional evidence record keeps ORCH-002 validation separate from the untouched ORCH-001 record. No additional production module beyond the seven proposed modules was needed.

## 3. Architecture and scope

The TypeScript workflow layer is outside Electron/React/Phaser, product contracts and provider integration. contracts.ts validates versioned JSON; reducer.ts is pure; paths.ts validates private storage; lock.ts coordinates owners; journal.ts appends/replays dispositions; store.ts coordinates durability/checkpoints/recovery; cli.ts constructs narrow operator events. Only deterministic SHA-256 is reused from ORCH-001 policy utilities. The workflow layer does not use its process runner or change diagnostic policy/readiness.

No new dependency, installation, root manifest/lockfile change or application/design change occurred. All four original JSON evidence files remain byte-identical. Generated dist/, desktop out/, node_modules and caches remain ignored.

## 4. State machine

Stages: inputs, designer_review, po_approval, handoff.
Statuses: ready, in_flight, awaiting_approval, paused, blocked, failed, interrupted, approved, handoff_ready, cancelled.
Terminal statuses: handoff_ready, cancelled. Storage health is independent.

| Event | Defined behavior |
| --- | --- |
| run.created | Absent to inputs/ready; generated run identity, full supplied baseline, absent input/approval references |
| inputs.accepted | inputs/ready to designer_review/ready |
| inputs.changed | Settled nonterminal state to inputs/ready; retain previous approvals as stale |
| attempt.started | designer_review/ready to in_flight with unique attempt metadata |
| attempt.succeeded | Matching in-flight attempt to po_approval/awaiting_approval, never approved |
| attempt.failed | Matching in-flight/blocked attempt to failed/settled with evidence |
| attempt.interrupted | Matching in-flight/blocked attempt to interrupted/unsettled |
| attempt.reconciled | Matching interrupted attempt explicitly settled with evidence |
| run.blocked | Unpaused nonterminal state to blocked; preserve reason/evidence |
| run.paused | Settled unpaused nonterminal state to paused, retaining exact prior status and reference data |
| run.resumed | Restore paused target, or move settled failed/blocked/interrupted metadata to its non-running stage state |
| run.cancelled | Settled nonterminal state to terminal cancelled |
| approval.validated | Pure synthetic model only: exact matching subject to handoff/approved |
| handoff.recorded | Pure synthetic model only: exact active approval to terminal handoff_ready |

Unspecified pairs are rejected. Unsettled attempts cannot be paused, resumed or finally cancelled. Production journal admission always rejects approval/handoff events; there is no override flag or actor-name bypass. The pure reducer has no I/O, process launch, clock or randomness, and clones input state/events.

## 5. Journal and snapshot boundaries

Every canonical JSONL record contains schema, sequence, event/reference identity, disposition, prior/result revision, original disposition/sequence for duplicate replay, resulting-state digest and previous/current integrity hashes. Replay validates syntax, sequence and hashes and recomputes transitions.

Journal sequence advances on every persisted disposition. Revision advances only on accepted state changes. Exact duplicate content appends a duplicate audit record returning originalDisposition/originalSequence without reapplying the transition. Changed content under an existing ID conflicts. Rejected/stale events remain in history. Structurally invalid events use a canonical-input digest rather than retaining arbitrary raw payloads; syntax/size errors may be rejected before storage admission.

Ordering: ownership, replay/checkpoint reconciliation, validation/preflight serialization bounds, durable exclusive intent marker, complete append, journal sync, same-directory exclusive snapshot temporary write/sync, atomic rename, directory sync, intent removal and ownership release. New namespace/run directory entries are synchronized.

A record is acknowledged committed only after journal sync succeeds. The committed field concerns disposition durability, including rejection records; it is not approval or a claim that state advanced. If the subsequent snapshot operation fails, committed remains true and storage reports COMMITTED_SNAPSHOT_STALE with exit 1.

Append/sync failure reports uncertainty and preserves intent. New mutations are fenced across restarts until explicit reconciliation. A complete-but-unacknowledged record is replayed only as local state after validation/synchronization, never as an external action. For an initialized run, if no complete later record survived, the intent is archived without claiming external rollback. Initial creation instead requires the explicit uninitialized-run fence described in section 16. Retry must retain event ID, timestamp, expected revision and content.

Actual hardware power-loss durability is unverified; file/directory sync and process-crash behavior were exercised, not a power-cut test.

## 6. Ownership and recovery

Exclusive owner-private writer.lock records token, PID, UID, hostname, process start, creation time, schema and boot identity where safely available. Active/reused/ambiguous PIDs and malformed lock data are not stolen. Explicit recovery requires the observed token, matching host/UID/boot evidence, absent owner, repeated metadata/inode/liveness checks and exclusive recovery.lock serialization. Replacement locks are preserved. There is no TTL or force-unlock.

Real-process tests exercise competing writers, competing reconcilers, process death before journal acknowledgement and controlled replacement locks. Child controllers execute actual current source transpiled into owned scratch storage using existing TypeScript, independent of dist output.

**Platform availability limitation:** workflow controls/recovery launch no subprocess, including OS metadata helpers. Linux can read its public kernel boot ID directly; this has not been natively verified on this macOS host. Node does not expose a portable macOS boot-session ID. The default macOS adapter therefore supports normal ownership and clean-restart recovery but refuses dead-writer lock reclamation. Positive reclamation tests use explicit controlled boot identity plus real PID liveness/death. This is not a demonstrated native macOS reclamation capability. Missing/different boot identity or an interrupted reconciliation guard remains blocked pending a separate recovery decision. A standalone exploratory sysctl read was denied; the final implementation does not invoke sysctl or depend on that result.

Cold-process regression tests intercept subprocess creation before importing the actual store, proving recovery makes no spawn/execFile attempt. No process is relaunched or presumed settled.

## 7. Torn tails, corruption and checkpoint recovery

A torn final record is preserved byte-for-byte, excluded from committed prefix, available for inspection and an absolute mutation barrier. Secondary malformed intent/checkpoint data does not conceal the verified journal prefix. Snapshot health is not_checked when the broken journal already blocks use.

Interior corruption, hash/sequence failures, ahead/mismatched snapshots and unsupported schema versions block use. There is no journal truncation, repair, segmentation, migration or compaction. A valid journal can rebuild a missing/stale/corrupt snapshot only through explicit recovery; corrupt snapshot bytes are preserved in a generated private archive. Temporary files never become authoritative through mtime selection.

Recovered running attempts become interrupted and remain unsettled until a typed reconciliation event supplies evidence. Awaiting approval survives restart and pause/resume. Failed attempts/reasons and historical approvals are retained.

## 8. Approval and inherited security conditions

Approval subjects bind run/repository/story, reviewed stage/revision, full SHA and input/artifact identities. Reviewed revision is separate from later bookkeeping. Production approval and handoff admission is disabled until ORCH-005. Synthetic pure-model fixtures are not real PO decisions. Hashes detect corruption, not human authenticity or same-user tampering.

All six inherited conditions remain in force:

- C1: diagnostic-only ORCH-001 foundation; no autonomous-execution authorization.
- C2: native sandbox/filesystem/credential/network/child-process/plugin/MCP enforcement remains unverified.
- C3: required missing security evidence continues to require ready=false.
- C4: portable path checks do not constitute an atomic openat boundary against hostile concurrent TOCTOU/ABA swaps.
- C5: effective isolation must be demonstrated before autonomous execution.
- C6: disclose the historical local desktop failures and unchanged-main reproduction.

Controller storage is owner-private/local/cooperative, outside application/design paths. Generated UUIDs, fixed names, ancestor/canonical checks, O_NOFOLLOW, descriptor/inode checks, private permissions, hard-link and special-file rejection are tested. No adversarial same-user filesystem guarantee or native agent isolation is claimed.

## 9. CLI and exits

Existing --help, --version and doctor variants retain their diagnostic exit behavior. The only workflow commands are run create/status/pause/resume/cancel/recover. No public command approves, records handoff, injects arbitrary events or accepts a PO role identity.

Workflow JSON exposes state, disposition durability and separate storage health, never security-ready authorization.

| Exit | Workflow meaning |
| --- | --- |
| 0 | Successful inspection/recovery, accepted event or duplicate of an originally accepted event |
| 1 | Illegal/rejected/stale/conflicting event, contention/ambiguous ownership, corrupt storage, unsafe path, resource/I/O failure, uncertain durability or stale snapshot |
| 2 | Invalid/oversized arguments, IDs or revisions |
| 3 | Unsupported persistent schema or storage platform |

run status and run recover --inspect are read-only. Mutating recover requires an expected revision; an observed lock token is required for explicit stale-owner reconciliation. Unknown schema versions are preserved and classified distinctly, including lock and intent versions. Full usage and exact replay options are in README.

## 10. Resource bounds

| Resource | Bound |
| --- | ---: |
| Event including typed payload | 16 KiB |
| Journal record excluding newline | 32 KiB |
| Snapshot including envelope | 1 MiB |
| Journal scan | 16 MiB |
| Journal records | 10,000 |
| Lock/intent metadata | 4 KiB |
| CLI arguments | 16 KiB |
| Reference/attempt/approval collections | 1,024; reason evidence 32 |
| Canonical depth / visited nodes | 16 / 20,000 |

Limits reject explicitly without discarding history. Candidate snapshot serialization is checked before committing an unrepresentable transition. Recovery archives and failed temporaries remain for inspection; no automatic retention cleanup is introduced.

## 11. AC-01–AC-14 coverage

| AC | Implemented/tested evidence and limits |
| --- | --- |
| 01 | Strict versioned state/event/identity/reference schemas; unknown schema tests for state, events, journal, snapshot, lock and intent |
| 02 | Exhaustive event/source-status table, narrowing guards, deterministic immutable reduction |
| 03 | Accepted/rejected/stale/conflict/duplicate records, ID-content comparison, expected revisions, independent sequence/revision counters |
| 04 | Append-only canonical JSONL, bounded records, chained hashes, append/partial-write/sync fault injection and audit dispositions |
| 05 | Atomic checkpoint replacement, journal-before-snapshot boundary, actual sync rejection, committed/stale outcomes and complete-unacknowledged recovery; hardware power loss unverified |
| 06 | Real process exclusion/reconciler competition/replacement protection; positive dead-owner algorithm tested with controlled boot evidence. Default macOS dead-lock reclamation is unavailable, so this criterion is conditional/partial on that adapter |
| 07 | Replay/checkpoint reconciliation; torn-tail preservation and readable prefix; interior corruption and unsupported-format refusal |
| 08 | Explicit interrupted/unsettled recovery, retained attempt evidence and cold-process zero-subprocess regression |
| 09 | Failure/block/cancellation reasons/evidence retained; explicit reconciliation/resume and terminal cancellation |
| 10 | Approval wait survives restart/pause/resume; successful attempt only reaches approval wait |
| 11 | Exact synthetic approval subject guards in pure model; unconditional production approval/handoff rejection |
| 12 | Separate private controller namespace, generated paths, links/descriptor/type/permission checks, FIFO and controlled parent replacement tests; approved non-adversarial threat limitation |
| 13 | Documented status/pause/resume/cancel/recover, identity preservation, replay metadata and immutable attempt history |
| 14 | Seven new workflow suites plus existing CLI regression; deterministic faults, real competing/killed controllers, bounds and schema/corruption/restart cases |

No story acceptance is inferred from this coverage. Platform recovery availability and independent review remain material gates.

## 12. Actual validation

| Command/check | Observed result |
| --- | --- |
| npm run test --workspace tools/orchestrator -- --no-cache | PASS: 92 tests, 13 suites; original 44 cases remain passing, 48 cases added |
| npm run typecheck | PASS across configured workspaces |
| npm run lint | PASS exit 0; two pre-existing unused-disable warnings in generated desktop Phaser output; orchestrator clean |
| npm test | FAIL exit 1: importer 54 pass; desktop 266 pass / 23 fail; contracts 1 pass; orchestrator 92 pass |
| npm run build | PASS: desktop and orchestrator |
| git diff --check | PASS; extra untracked-file whitespace/scope checks also performed |
| Compiled CLI smoke | --help 0, --version 0, forbidden run approve 2 |
| Original four JSON evidence files | Byte-identical to baseline |
| Dependencies/application/design/diagnostic policy | Unchanged; no installation |

Initial tests were written before the corresponding modules. Additional failing regressions independently exposed unsupported metadata-version misclassification, obscured torn-prefix inspection and a cold-start metadata subprocess; those were corrected without disabling or weakening tests. Final complete focused execution has no skipped tests.

## 13. Desktop baseline comparison

An isolated git archive of exact af353f3bd3c6bc7b612ee5cec82612f5a615fa5f was executed with existing dependency symlinks and --no-cache, without installs, branch switching or changes to this implementation. Both desktop executions returned 289 total, 266 pass, 23 fail, with identical failing test names and error categories. All 148 compared application/contracts/root-manifest files matched byte-for-byte. The owned archive was removed after comparison.

Twenty-two failures report listen EPERM: operation not permitted 127.0.0.1; one pending-listen assertion sees undefined boundPort after bind denial. These reproduce on unchanged main and are environmental; the repository test command remains a recorded FAILURE, not a PASS. Full local logs and machine-readable inventories are retained in /private/tmp/coffee-break-orch002-full-test.log, /private/tmp/coffee-break-orch002-current-desktop.json and /private/tmp/coffee-break-orch002-baseline-desktop.json.

## 14. Remaining limits and deferred work

Implemented/tested: pure state model, ledger persistence, bounds, cooperative path/ownership checks, recovery, restricted CLI and production approval denial.

Unavailable or unverified: default native macOS dead-lock reclamation; Linux native boot identity on this host; hardware power-cut durability; adversarial namespace containment; native Codex and plugin/MCP isolation. Uninitialized creation, malformed lock/recovery guard and torn journals remain explicit blockers without a force/repair mechanism.

Deferred to ORCH-003: real snapshots, bundle/report provenance and drift detection. Deferred to ORCH-004: actual attempts/process lifecycle and security-gated execution. Deferred to ORCH-005: real PO authentication/approval validation/revocation, handoff generation and pilot. No later-story implementation occurred.

The macOS reclamation availability limitation requires Planner/Reviewer disposition before PO acceptance. It is not authorization to weaken corroboration or add a native dependency.

## 15. Stop and scope confirmation

No feature-scope or file-boundary expansion. The test helpers and this report are the only additions beyond the proposed file list, for cohesive test/evidence responsibilities. Root dependencies, source/design/product contracts and original diagnostic policy/evidence are unchanged. No credentials read, sandbox/configuration expansion, autonomous agent execution, commits, pushes, PRs, merges or issue mutation occurred.

Stop for Planner scope review, independent technical review and explicit PO acceptance. Do not begin ORCH-003.


## 16. Independent review corrections — 2026-10-17

These targeted corrections address the independently confirmed F1/F2 findings under the existing PO authorization. Sections 12–13 retain the initial validation and historical baseline comparison; the fresh results below supersede their test count. This record does not grant independent review or PO acceptance.

### F1 — attempt reconciliation persists independently of run status

Root cause: the transition table admitted attempt.failed from a blocked run, while the attempt guard checked only the matching unsettled ID. After recovery interrupted an attempt, run.blocked changed the outer status and attempt.failed could replace the persisted interrupted attempt with a settled failure. Cancellation then became possible without reconciliation.

Correction: attempt completion/interruption events require the matching attempt itself to remain running. An interrupted attempt returns RECONCILIATION_REQUIRED without changing its revision, reason, end time or reconciliation metadata. The existing attempt.reconciled interface now also admits a blocked run, while still requiring the matching interrupted/unsettled attempt and a schema-valid evidence reference. Blocking and restart preserve this obligation; cancellation remains ATTEMPT_UNSETTLED until explicit reconciliation. Normal failure of a running attempt in a blocked run remains permitted. The store journals rejected events, and replay enforces the same reducer guards. No process or external action is launched by this correction.

Regression evidence: reducer.test.ts:58 covers blocking, failure rejection, cancellation rejection, repeat-interruption rejection, mismatched/malformed reconciliation, valid evidence, resume and cancellation. store.test.ts:167 reproduces running → recover → interrupted/unsettled → blocked → failure rejection → cancellation rejection with actual persistence and restarts. It checks rejection records, unchanged attempt history, explicit reconciliation, further recovery/resume/cancellation and append-only preservation of prior journal bytes.

### F2 — creation requires a committed identity

Root cause: an empty journal replayed as structurally healthy with null state. Recovery could snapshot that null state and archive the initial creation intent, then report healthy success. Status also accepted an otherwise valid null-state checkpoint. This removed the uncertainty fence despite having no committed creation record.

Correction: status and mutation admission classify a replay without committed run state as blocked RUN_UNINITIALIZED, exit 1. Recovery returns this classification before journal synchronization, checkpoint creation or intent archival. Existing unsupported/corrupt storage classifications remain fail-closed. A partial first record stays TORN_JOURNAL_TAIL. Creation intent/journal bytes remain untouched across repeated restart/recovery and failed subsequent mutations; no replacement run is created. A complete, replay-valid creation record whose acknowledgement failed can still be synchronized and recovered with its original identity, revision and evidence.

Regression evidence: store.test.ts:203 exercises initial failure before append and partial append; each repeats status/recovery/mutation and attempted recreation across restarts, checking unchanged journal/intent bytes and no snapshot. store.test.ts:226 exercises complete unacknowledged creation before and after journal sync, repeated recovery, original identity/revision, preserved archived intent and duplicate creation admission without reapplying creation. store.test.ts:247 rejects a legacy healthy null checkpoint even without an intent, preserving its bytes.

Seven new executed test cases were added (one reducer and six store cases). Test-first reproduction returned four failures and 28 passes before production corrections; the negative tests showed accepted settlement and healthy null-state inspection. All 32 affected reducer/store tests then passed. One malformed runtime-input test initially used the typed event builder incorrectly, causing TS2739 in typecheck/build; its construction was corrected without weakening the runtime assertion. Final executions below pass those checks.

### Updated AC assessment

These are implementation/test coverage assessments, not PO acceptance.

| AC | Assessment | Evidence / qualification |
| --- | --- | --- |
| AC-01 | PASS | Existing strict versioned identity/state/event contracts and unsupported-version tests remain passing |
| AC-02 | PASS | Deterministic source-status table plus persistent attempt-status guards; explicit reconciliation while blocked |
| AC-03 | PASS | Rejected/stale/duplicate/conflict audit records; F1 invalid settlement/cancellation retain revision and attempt history |
| AC-04 | PASS | Sequenced append-only ledger; initial and later append faults preserve uncertainty evidence |
| AC-05 | PASS | Atomic checkpoints and committed creation recovery after lost acknowledgement; uncommitted creation never gets a healthy null checkpoint |
| AC-06 | PARTIAL | Cooperative single-writer exclusion tested with real controllers; dead-owner algorithm tested with controlled boot identity. Native macOS dead-writer reclamation remains unavailable |
| AC-07 | PASS | Journal/checkpoint validation and torn/corrupt refusal; repeated uninitialized recovery remains blocked |
| AC-08 | PASS | Recovery interrupts running metadata; reconciliation obligations survive blocking/restart; existing cold-start zero-subprocess test passes |
| AC-09 | PASS | Reasons/history retained; audited invalid settlement/cancellation and explicit reconciliation before resume/cancellation |
| AC-10 | PASS | Approval wait survives restart/pause/resume; no inferred approval |
| AC-11 | PASS | Exact synthetic approval reference interface; production approval/handoff admission still disabled pending ORCH-005 |
| AC-12 | PASS | Private validated storage and existing cooperative path checks unchanged; hostile same-user namespace races remain outside the approved threat model |
| AC-13 | PASS | README specifies persistent attempt obligations and blocked uninitialized creation; identity/history retained |
| AC-14 | PASS | 99 focused cases across 13 suites, including seven added regressions; existing concurrency/corruption/version/approval tests remain enabled |

### Fresh validation

| Command | Final observed result |
| --- | --- |
| npm run test --workspace tools/orchestrator -- test/workflow/reducer.test.ts test/workflow/store.test.ts --no-cache | PASS: 32 tests across 2 suites after the production fixes |
| npm run test --workspace tools/orchestrator -- --no-cache | PASS: 99 tests across 13 suites, no skipped cases |
| npm run typecheck | PASS, exit 0, all configured workspaces |
| npm run lint | PASS, exit 0; the same two generated desktop unused-disable warnings at createOfficeGame-ujkITRew.js:115516 and :115533; no orchestrator warnings |
| npm run build | PASS, exit 0, desktop and orchestrator |
| npm test | FAIL, exit 1: importer 54 pass; desktop 266 pass / 23 fail; contracts 1 pass; orchestrator 99 pass |
| git diff --check | PASS; untracked-file whitespace checked separately |

The fresh desktop failing test titles match all 23 titles in the retained exact-baseline inventory. Twenty-two errors are denied listen EPERM binds to 127.0.0.1; one pending-listen assertion has no boundPort after denial. No second baseline execution was needed: all 153 compared tracked application/contracts/root-manifest/diagnostic-policy/original-JSON files remain byte-identical to HEAD. The earlier isolated baseline comparison remains the evidence that these failures reproduce without ORCH-002. No tests were disabled or relaxed. Fresh logs are /private/tmp/coffee-break-orch002-corrections-{focused,typecheck,lint,build,full-test}.log.

### Scope, security and remaining limitations

Only six files were changed by this correction, measured against fingerprints of all twenty pre-existing uncommitted files: src/workflow/reducer.ts, src/workflow/store.ts, test/workflow/reducer.test.ts, test/workflow/store.test.ts, README.md and this evidence narrative, all under tools/orchestrator/. The README changes describe corrected externally observable behavior. The other fourteen uncommitted files were preserved byte-for-byte. No additional file or dependency changes were needed.

AC-06 remains PARTIAL. lock.ts, its boot-identity requirements and its tests were not changed. No helper subprocess, ambiguous-lock stealing, force-unlock or relaxed threat model was added. The original ORCH-001 evidence and diagnostic policy are unchanged; no new native probe was executed. Native isolation and plugin/MCP restrictions remain unverified and required blockers; this work does not establish security readiness or authorize agents.

Power-loss durability and adversarial same-user TOCTOU/ABA containment remain unverified/outside scope as previously documented. Journals containing transitions accepted through the old F1 bug fail semantic replay under the corrected reducer; they are preserved and blocked, with no migration or automatic repair. Uninitialized or torn creation requires a separate recovery decision; no repair/recreation mechanism was added. Reconciliation references are structurally validated evidence, not authenticated external truth or PO approval; real report/approval validation remains in later stories.

Branch and HEAD remain codex/orch-002-workflow-state-persistence at af353f3bd3c6bc7b612ee5cec82612f5a615fa5f. No application/design changes, installation, autonomous agent execution, security-configuration changes, GitHub mutations, staging, commits, pushes or PRs occurred. ORCH-003 was not started. Stop for independent re-review and PO acceptance.
