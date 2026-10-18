# Local development tooling

Standalone development tooling for [ORCH-001 #100](https://github.com/heyitsanuar/coffee-break/issues/100), [ORCH-002 #101](https://github.com/heyitsanuar/coffee-break/issues/101) and [ORCH-003 #102](https://github.com/heyitsanuar/coffee-break/issues/102), under DEV-ORCH #99. It has no application-runtime imports or runtime dependencies. ORCH-001 provides diagnostics; ORCH-002 adds explicit local workflow-state controls. ORCH-003 provides input/report contracts and explicit artifact controls. No subsystem executes agents, performs inference, grants approval, changes GitHub or implements US-037.

The supported baseline is macOS arm64, Node.js 22+, npm 10+, Git 2+, GitHub CLI 2+, and **exactly Codex CLI `0.162.0-alpha.17.2`**. Other Codex versions are unsupported until validated explicitly. A matching version/help interface is metadata evidence, never proof of sandbox enforcement.

Build from the repository root using the existing workspace tooling:

```sh
npm run build --workspace tools/orchestrator
npm run cb-flow --workspace tools/orchestrator -- --help
npm run cb-flow --workspace tools/orchestrator -- --version
npm run cb-flow --workspace tools/orchestrator -- doctor
npm run cb-flow --workspace tools/orchestrator -- doctor --json
npm run cb-flow --workspace tools/orchestrator -- doctor --probe-security
npm run cb-flow --workspace tools/orchestrator -- doctor --probe-security --json
```

For clean machine stdout without npm lifecycle messages, use `node tools/orchestrator/dist/src/cli.js doctor --json`. The package also declares a `cb-flow` bin for normal npm workspace linking; no global installation is required. Build output is ignored under `dist/`.

| Exit | Meaning |
| --- | --- |
| 0 | Help/version, or every required diagnostic check passed |
| 1 | Required failure or internal error; takes precedence over unsupported/unverified |
| 2 | Invalid arguments, duplicate flags, or unsupported command |
| 3 | At least one required capability is unsupported/unverified, with no required failures |
| 130 | Operator interruption, after all started process groups are confirmed terminated; otherwise 1 |

Ordinary `doctor` runs only fixed metadata commands in an independent OS guard and observes repository/account-configuration presence. It creates/removes its own scratch working directory. It does not read authentication files or account configuration contents, connect to GitHub, run security-operation tests, or invoke `codex exec` without `--help`. Security-operation tests require `--probe-security`. Help/version import no doctor code and start no subprocess.

## Diagnostic contract

`src/contracts.ts` defines schema version 1. A successful diagnostic operation emits one JSON object containing:

- Schema/diagnostic versions and observation time; host OS/architecture.
- Tool paths, constrained parsed versions and Codex binary SHA-256.
- Repository root/full HEAD, clean/dirty status and an aggregate status/protected-input digest.
- Policy version/digest, declared restrictions, guard/native-profile digests and a preflight fingerprint.
- Required/optional checks with `pass`, `fail`, `unsupported` or `unverified`, evidence category and a fixed reason.
- Command outcome, elapsed time, byte count, termination/cleanup flags, bounded-output digest and recognized warning flags.
- Derived `ready`, blocker IDs and exit code.

Unknown metadata remains `null`; unavailable or unexecuted enforcement remains `unverified`. A failed version command cannot become a pass from its stdout. JSONL events and final response/schema output are checked separately. No raw stdout/stderr, environment, synthetic secret contents, arbitrary errors or full help/configuration text are serialized. An unexpected failure before a complete report produces a smaller versioned failure envelope (`schemaVersion`, `diagnosticVersion`, `ready: false`, `blockers`, `exitCode: 1`).

Policy restrictions describe what was requested; check results describe what was established. In particular, `guardUnavailable: true` records a recognized Seatbelt initialization denial. `aliasSetupWarning: true` preserves the observed Codex PATH-alias warning without granting additional access or changing configuration. During discovery the installed CLI emitted: `WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)`.

The identity helpers bind repository root, full SHA, status/content digest, Codex binary digest and effective policy digest. Later stages must recompute/compare these fields and inspect every required result; an old report is not durable authorization. The protected-input digest covers tracked `apps/`, `packages/`, `docs/design/`, `.agents/`, `.codex/agents/`, `AGENTS.md` and root package manifests. It hashes symlink text without following it. It is not a complete dirty/untracked working-tree content manifest; ORCH-003 owns reproducible input bundles. The ORCH-001 diagnostic subsystem implements no report cache, approval persistence or workflow engine.

## Controlled native probes

Every probe path is generated beneath one private disposable `cb-flow-*` directory. There are synthetic repository files, `.git/HEAD`, input data, a random synthetic credential, controller state and a credential symlink. No attempted mutation targets the actual repository or account. The trusted helper returns operation enums/hashes and never prints file contents.

1. An independent `/usr/bin/sandbox-exec` guard denies writes outside the fixture root, denies known account/credential directories and blocks network except one controlled loopback endpoint. A separate synthetic read/write sentinel must prove that guard works before Codex starts.
2. A positive control must connect to a parent-owned `127.0.0.1` endpoint under that guard. An unavailable endpoint, `ECONNREFUSED`, timeout or generic subprocess failure cannot prove network policy denial.
3. The only native Codex command is `codex --no-daemon -c ... sandbox --permission-profile cb_flow_probe --include-managed-config --cd <fixture> -- <node> -e <fixed helper> ...`. The named profile requests filesystem read access, denies synthetic credential/controller paths and disables network. Inline settings are process-local; no config file is written. Configuration options follow the installed alpha's help and [Codex permissions documentation](https://learn.chatgpt.com/docs/permissions); changed/unrecognized behavior remains unverified.
4. The helper checks an input hash; denied create/modify/rename/delete; credential/controller/symlink reads; Git metadata writes; child-process write/credential access; and network denial. Only `EPERM`/`EACCES` count as explicit policy denials. A network allowance is a failure even if the positive control was unavailable.
5. Complete fixture-tree integrity is compared afterward. Unexpected operations/mutations fail. Fixtures are removed only after all subprocess groups terminate. If cleanup cannot be confirmed, the tool retains its own fixture and reports its path for operator recovery.

The outer guard intentionally permits fixture mutations and the positive-control endpoint. Its denials cannot stand in for Codex's corresponding denials. Even successful native shell probes do **not** establish model-tool, MCP, plugin, connector, daemon or external-service isolation. `security.plugins-mcp` remains required and unverified in ORCH-001. Therefore this version cannot authorize later autonomous execution or report ready until that independent boundary can actually be established. Role TOML and model instructions are never enforcement evidence.

If Seatbelt initialization is denied inside another sandbox, the tool records that limitation and stops before native Codex. It has no automatic fallback to an unguarded command, permission escalation, installation, login or configuration change. The native profile and nested-guard behavior still require validation on a host where Seatbelt is available; no successful enforcement is claimed from unit mocks.

## Process/security boundary

All subprocesses use absolute discovered executables, argv arrays, `shell: false`, private process groups and an explicit environment allowlist. Ambient tokens, `HOME`/`CODEX_HOME`, proxy credentials, Node injection variables and SSH sockets are not forwarded. npm's user/global config paths are `/dev/null`; Git metadata calls disable optional locks, filesystem-monitor hooks and untracked-cache updates. The OS guard also prevents incidental Codex PATH-alias/account writes.

Limits are 30 seconds per metadata command, 60 seconds per native command, 1 MiB combined stdout/stderr and 3 seconds termination grace. SIGTERM escalates to SIGKILL and group disappearance is checked within a second grace interval. A zero-exiting parent with a surviving child is terminated and classified unsuccessful. Overflow, interruption, spawn errors, nonzero exit or unconfirmed cleanup never establish success. Cleanup verifies owned POSIX groups; it is not proof against arbitrary hostile processes that deliberately detach into new groups, another reason not to treat this as agent-execution authorization.

## Validation

```sh
npm run test --workspace tools/orchestrator
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
node tools/orchestrator/dist/src/cli.js doctor --probe-security --json
```

Unit tests use mocked command adapters and disposable fixtures; one intentionally unisolated fixed helper proves ineffective restrictions are detected without secret disclosure. This is not native sandbox evidence. See `evidence/` for historical ORCH-001 output, the native attempt and validation results. Root validation includes this explicit workspace. No inference, package download, application integration, external workflow action, approval grant or repository publication is part of this package.

## ORCH-002 workflow controls

These commands persist local state only. They neither call doctor nor start a model/process attempt. A successful workflow operation says nothing about diagnostic security readiness. ORCH-001's diagnostic policy, native-enforcement limitations and exit contract are unchanged. Production approval/handoff event admission is disabled, including for internal controller callers. No public command injects arbitrary events or claims a PO identity.

Use the compiled entry point after the normal build (or the existing npm workspace wrapper). Workflow commands always return versioned JSON; `--json` is an optional explicit spelling of that default:

```sh
node tools/orchestrator/dist/src/cli.js run create \
  --repository-id heyitsanuar/coffee-break \
  --repository-root /absolute/path/to/coffee-break \
  --story ORCH-002 --issue 101 \
  --baseline af353f3bd3c6bc7b612ee5cec82612f5a615fa5f
node tools/orchestrator/dist/src/cli.js run status RUN_UUID
node tools/orchestrator/dist/src/cli.js run pause RUN_UUID --revision 1
node tools/orchestrator/dist/src/cli.js run resume RUN_UUID --revision 2
node tools/orchestrator/dist/src/cli.js run cancel RUN_UUID --revision 3 --reason OPERATOR_CANCELLED
node tools/orchestrator/dist/src/cli.js run recover RUN_UUID --inspect
node tools/orchestrator/dist/src/cli.js run recover RUN_UUID --revision CURRENT_REVISION
```

Creation generates a UUID and records the explicitly supplied identity/full SHA; it does not validate repository provenance, snapshot GitHub, import inputs or claim reproducibility. Input/attempt references remain absent until admitted typed controller events exist. Actual bundle verification belongs to ORCH-003; execution belongs to ORCH-004; real approvals/handoff belong to ORCH-005.

Mutations require the expected state revision. Event IDs/timestamps are generated at the command boundary and returned in `request`. To retry an uncertain request, first inspect/recover the **same run** and reuse the original `--event-id UUID --at ISO_TIMESTAMP`, revision and arguments. Those two replay flags must appear together. Do not substitute a new event ID to conceal an uncertain result. Creation uncertainty is inspected using the returned run ID; creation is never silently reissued as a replacement run.

| Workflow exit | Meaning |
| --- | --- |
| 0 | Operation completed; an accepted disposition or duplicate of an accepted event, or a successful status/recovery operation |
| 1 | Rejected/illegal event, stale revision, conflicting ID, busy/ambiguous lock, unsafe path, corruption, resource limit, uncertain durability, stale snapshot or I/O failure |
| 2 | Invalid command/arguments, malformed identifiers/revisions or oversized CLI input |
| 3 | Unsupported persistent schema or unsupported storage platform |

`committed` means the **disposition record** crossed the journal synchronization boundary, including durable rejection/stale records. Only `disposition: accepted` advances state revision. `storage.health` is separate from workflow `state.status`; inspect both even when an exit is nonzero. A failed storage operation never reports rollback or native enforcement success. Returned state on uncertain/corrupt storage is only the last verified state, not permission to continue.

### State and transition contract

Workflow format version 1 is independent of diagnostic schema v1. Runtime validation rejects unknown fields/versions/events and inconsistent identities/state combinations. The pure reducer has no I/O, clock or randomness and clones its inputs. Stages are `inputs`, `designer_review`, `po_approval`, `handoff`. Statuses are `ready`, `in_flight`, `awaiting_approval`, `paused`, `blocked`, `failed`, `interrupted`, `approved`, `handoff_ready`, `cancelled`.

| Event | Permitted behavior, with identity/revision guards |
| --- | --- |
| run.created | Absent → inputs/ready; initial revision and sequence 1 |
| inputs.accepted | inputs/ready → designer_review/ready |
| inputs.changed | Settled nonterminal state → inputs/ready; retain old approvals as stale |
| attempt.started | designer_review/ready → in_flight; unique attempt reference |
| attempt.succeeded | Matching in-flight attempt → po_approval/awaiting_approval; retain report reference |
| attempt.failed | Matching running attempt in an in-flight/blocked run → failed, settled; retain reason/evidence |
| attempt.interrupted | Matching running attempt in an in-flight/blocked run → interrupted, **unsettled** |
| attempt.reconciled | Matching interrupted attempt in an interrupted/blocked run → explicitly settled with evidence; no inferred external success |
| run.blocked | Nonterminal, unpaused state → blocked with reason/evidence |
| run.paused | Settled nonterminal, unpaused state → paused with exact prior status retained |
| run.resumed | Paused → its previous status; settled blocked/failed/interrupted → appropriate non-running stage status |
| run.cancelled | Settled nonterminal state → terminal cancelled; retain reason/evidence |
| approval.validated | Synthetic pure-model contract only: matching approval wait → handoff/approved |
| handoff.recorded | Synthetic pure-model contract only: matching active approval → terminal handoff_ready |

Every unspecified pair is rejected. `cancelled` and `handoff_ready` cannot resume. Pause/cancel/resume cannot settle an outstanding attempt. An interrupted attempt retains its reconciliation obligation through blocking and restart; failure/interruption events cannot erase it. Only an explicit matching `attempt.reconciled` event with a valid evidence reference settles it. Rejected settlement and cancellation events are journaled without advancing the state revision. Recovery can record interruption but never stop/relaunch/replay a process. Restart, elapsed time, exit zero and agent recommendations never approve anything. Pause/resume preserves an approval wait. Historical attempts and journal evidence remain available.

Approval references bind run/repository/story, reviewed stage/revision, full SHA and input/artifact digests. Reviewed revision is separate from later bookkeeping revisions. Missing/mismatched identities block use; hashes do not authenticate a human. Pure reducer fixtures are explicitly synthetic. The journal/store rejects production approval and handoff events even if syntactically valid; such events cannot be promoted through snapshot recovery.

### Journal, acknowledgements and snapshots

Each fixed-name `journal.jsonl` record contains schema/sequence, canonical event or invalid-input digest, trusted-boundary origin, disposition/code, original disposition/sequence for duplicates, prior/result revisions, resulting-state digest and previous/current record hashes. JSON key order is canonical; replay verifies sequence, schema, hash chaining **and recomputed transitions**. No prior journal bytes are rewritten.

Journal sequence increments for **every persisted disposition**, including rejection, stale, conflict and duplicate records. State revision increments only for accepted state changes. An identical event ID/content appends a `duplicate` audit record and returns `originalDisposition`/`originalSequence`; it never reapplies the transition. Changed content under an existing event ID is a conflict. Structural invalid inputs are represented by their digest rather than raw arbitrary content; CLI syntax/size errors are rejected before storage admission.

Mutation ordering is lock → replay/check snapshot → validate → durable exclusive `intent.json` → append complete record → journal `sync()` → exclusive same-directory snapshot temporary write/sync → atomic rename → directory sync → remove intent/sync → release lock. A successful journal sync is the acknowledgement boundary. New-file directory entries are synchronized as part of initialization. No universal hardware/power-loss guarantee is claimed beyond the filesystem/OS synchronization contract.

Append or journal-sync errors leave the intent and report `DURABILITY_UNCERTAIN`; subsequent mutations are fenced across restarts. A complete valid record may survive without acknowledgement. Explicit recovery revalidates/synchronizes that prefix before clearing uncertainty; it does not replay an external action. If a later event did not survive in an initialized run, recovery archives the intent without claiming external rollback. A synchronized record followed by snapshot failure returns `committed: true`, `COMMITTED_SNAPSHOT_STALE`, exit 1; the journal remains authoritative.

Creation requires a committed, replay-validated `run.created` record. An empty journal without that identity remains uninitialized: status, recovery and subsequent mutations return blocked `RUN_UNINITIALIZED`, exit 1. Recovery preserves uncertainty evidence and does not write a healthy null-state checkpoint, archive the creation intent or recreate the run. A partial creation record remains blocked as `TORN_JOURNAL_TAIL` with its original bytes intact. A complete creation record whose acknowledgement failed can be explicitly recovered and synchronized using its existing identity/revision. Repeated recovery preserves that identity and evidence.

Snapshots contain their journal sequence/head hash and derived state. They never outrank the journal. Ordinary mutation requires a current checkpoint/no unresolved intent. `run status` and `run recover --inspect` are read-only inspections (busy controllers may return a concurrency result); they do not create directories, repair files or reconcile locks. Plain `run recover --revision N` acquires ownership, may sync the journal, rebuild missing/stale/corrupt snapshots, preserve a corrupt snapshot under a generated archive name, archive a reconciled intent and append an explicit interruption event for a previously running attempt. It does not fabricate approval or claim process settlement. Repeated healthy recovery changes no state revision.

A torn final record remains byte-identical, never counts as committed, exposes the last verified prefix and blocks mutation/recovery writes. Malformed interior records, sequence/hash failures, ahead/mismatched snapshots and unsupported versions block use. Temporary snapshot files are not selected as authority. No automatic tail repair, truncation, migration, segmentation, compaction or history deletion exists. Interrupted creation can leave an uninitialized owned run; inspect it rather than assuming creation completed.

### Ownership, paths and resource limits

Production storage defaults to `~/Library/Application Support/coffee-break-dev-orchestrator/v1/runs` on macOS and `~/.local/state/coffee-break-dev-orchestrator/v1/runs` on Linux. Windows is unsupported in this stage. There is no caller-supplied run path or CLI storage-root override. Tests inject owned private scratch roots through the library constructor. Only generated/validated UUIDs and fixed/generated filenames are admitted. Directory/file modes are owner-private, with UID/type/link checks, ancestor/canonical containment checks, `O_NOFOLLOW`, descriptor identity checks and directory identity rechecks. Hard links, special files, symlinks and detected replacements are rejected.

Threat model: private local storage and cooperative controllers, not network/shared/synchronized storage or a malicious same-user process concurrently replacing namespace components. Portable checks are not an atomic openat boundary; hashes are not authentication. Stronger isolation requires separate design/authorization. Durable controller writes do not widen the diagnostic/native sandbox policy.

`writer.lock` is exclusively created per run and contains schema, random token, PID, UID, hostname, process start and boot-session identity where available, plus creation time. Active/reused PIDs and ambiguous/malformed records are never stolen. A dead lock requires explicit `run recover RUN_UUID --revision N --lock-token OBSERVED_TOKEN`, corroborated same host/UID/boot session, PID absence, matching metadata/token/inode and serialized `recovery.lock` ownership. Replacement locks are not removed. There is no TTL or force-unlock. A stale/ambiguous recovery guard itself blocks reconciliation rather than being automatically removed.

Workflow controls and recovery launch no subprocess, including metadata helpers. Linux reads the public kernel boot ID directly. Node has no portable macOS boot-session API, so this version records it as unavailable instead of launching sysctl or trusting an approximate wall-clock/uptime projection. Normal exclusive ownership and clean-restart recovery work on macOS, but reclaiming a dead writer lock through the default macOS adapter remains blocked. The positive reconciliation algorithm is tested with controlled boot identity and real process liveness; Linux native boot-ID availability has not been demonstrated on this macOS host. PID absence alone is insufficient. This limitation is not permission to weaken ownership checks or install a native dependency.

Missing or different boot-session identity, malformed lock files and an interrupted reconciliation guard remain conservative blockers. This version does not force-reclaim a lock from a previous boot or silently remove a stale recovery guard. Such cases require a separate recovery decision; ordinary controller restarts with a demonstrably dead owner in the same known boot can use the explicit reconciliation path.

| Resource | Bound |
| --- | ---: |
| Canonical event/typed payload envelope | 16 KiB |
| Journal record (excluding newline) | 32 KiB |
| Snapshot | 1 MiB |
| Total journal scan | 16 MiB |
| Replayed/persisted journal records | 10,000 |
| Lock or intent metadata | 4 KiB |
| CLI argument bytes | 16 KiB |
| Attempt/approval/evidence collections | 1,024 entries; reason evidence 32 |
| Canonical nesting / visited nodes | 16 levels / 20,000 nodes |

Limits fail explicitly without dropping history. Recovery archives and failed snapshot temporaries remain in the private run directory for inspection; no automatic retention/cleanup policy is introduced.

Workflow tests use real disposable files, deterministic injected I/O failures and IPC barriers. Real competing/killed controllers execute the current storage source transpiled by the already installed TypeScript compiler into owned scratch storage, independent of `dist/`. They do not execute Codex or access real credentials. Run the complete validation commands above; native security enforcement remains separately unverified.

## ORCH-003 input bundles and report contracts

ORCH-003 adds explicit input capture, immutable retained artifacts, offline integrity verification, requested freshness checks and validation-only report contracts. It does not execute agents, grant PO approval, admit production handoff or change diagnostic security policy. Workflow `ready`, artifact integrity, source freshness and native execution readiness are separate facts.

### Commands

After building, use `node tools/orchestrator/dist/src/cli.js` followed by:

```sh
inputs capture RUN_UUID --config /absolute/path/selection.json --revision N
inputs attach RUN_UUID --digest SHA256 --mode accept --revision N
inputs verify RUN_UUID
inputs verify RUN_UUID --digest CANDIDATE_SHA256
inputs fresh RUN_UUID --config /absolute/path/selection.json
report validate RUN_UUID --attempt ATTEMPT_ID --report-id REPORT_UUID --payload /absolute/path/payload.json
report validate RUN_UUID --attempt ATTEMPT_ID --report-id REPORT_UUID --payload /absolute/path/payload.json --human
```

`capture` publishes a complete bundle and its separate capture record under the run's writer lease. It returns the reference without advancing workflow revision or attaching inputs. `attach --mode accept` attaches verified inputs at the inputs stage. To replace an existing input, explicitly use `attach --mode replace --digest NEW_SHA256 --revision N`, then `attach --mode accept --digest NEW_SHA256 --revision N+1`. These are separate journal transitions; interruption between them leaves the inputs stage pending acceptance. Old bundles/history remain intact. Attachment supports paired `--event-id UUID --at ISO_TIMESTAMP` flags for exact idempotent retries.

`verify` performs no network call or source recapture. With a candidate digest it reports whether that verified bundle is active. Without one it verifies the current workflow input. `fresh` additionally checks current issue/repository/import/policy/template inputs; it neither stores the recapture nor changes workflow state. A successful stored-integrity check is not evidence of freshness. `run status` retains its existing workflow/storage semantics.

`report validate` is pure validation: it stores no report, completes no attempt and grants no approval. It requires an actual unsettled running/interrupted attempt from the run and the active verified bundle. The CLI has no trusted execution-observation or N/A-policy input flag; its coverage assessment cannot establish that ACs passed. The library contract accepts explicit controller-owned observation/coverage policy inputs for future integration. Producer provenance identifies validation-only, unverified external output, not a demonstrated Codex session. `--human` renders escaped text from the validated record.

Commands return bounded JSON, except the escaped human report. Exit 0 means the requested operation/validation succeeded; a partial/interrupted report may be structurally valid while `successfulCompletion` is false. Exit 1 means rejected/blocked/drift/I/O/ownership/integrity/quota failure; 2 means invalid command/arguments; 3 means unsupported schema or unavailable freshness. No exit authorizes execution, implementation, approval or handoff.

### Selection contract

The selection file is strict JSON, version 1. This example describes synthetic generic inputs, not authorized US-037 inputs:

```json
{
  "schemaVersion": 1,
  "repository": "owner/repo",
  "story": { "id": "STORY-1", "issue": 7 },
  "baselineSha": "FULL_PINNED_COMMIT_SHA",
  "selected": [
    {
      "path": "AGENTS.md",
      "kind": "policy",
      "provenance": { "origin": "repository-governance", "limitations": [] }
    }
  ],
  "imports": [
    {
      "kind": "developer_discovery",
      "path": "/absolute/path/discovery.md",
      "origin": "handoff:developer-discovery-version",
      "basisSha": "FULL_PINNED_COMMIT_SHA",
      "limitations": ["Native checks not performed"],
      "compatibility": { "mode": "exact", "policyDigest": null, "rationale": "" }
    },
    {
      "kind": "planner_scope",
      "path": "/absolute/path/scope.md",
      "origin": "handoff:planner-scope-version",
      "basisSha": "FULL_PINNED_COMMIT_SHA",
      "limitations": [],
      "compatibility": { "mode": "exact", "policyDigest": null, "rationale": "" }
    }
  ],
  "scope": {
    "allowedChanges": ["src/example.ts"],
    "nonGoals": ["No autonomous execution"],
    "validationPlan": ["typecheck", "tests"],
    "unresolvedDecisions": []
  }
}
```

Supply real full 40/64-hex commit identities. Selected kinds are `source`, `static_design`, `manifest`, `policy`, `template`; at least one selected policy is required. Policy/template identities are derived from selected bytes. Scope paths are relative, with optional trailing `/**`; they are data, never executed instructions. Issue AC parsing supports one `- [ ] AC-NN: text` declaration per line under `## Acceptance Criteria` (case-insensitive heading); unsupported continuations/formats block rather than silently losing text.

Imports preserve original bytes, including line endings, and require distinct Developer discovery and Planner scope kinds. Origins are stable logical identifiers/URLs, not local absolute/file-URI paths; physical import locators remain outside the portable core. Exact basis policy requires the pinned baseline. Historical mode requires an explicit rationale and `policyDigest` matching a retained selected policy; it preserves the older basis and does not assert current-basis authority or PO authenticity.

US-037 remains blocked with `PILOT_INPUTS_REQUIRED`: authoritative discovery/scope inputs have not been supplied or approved. No override flag, fabricated pilot document or production pilot bundle is provided. Enabling actual pilot readiness requires a separate reviewed, PO-authorized authoritative-input decision.

### Identity, source capture and reference preservation

The scope core contains version/kind, repository/story, baseline, clean-checkout fact, exact issue fields/ACs, file/import manifest, allowed scope, non-goals, validation plan, unresolved decisions and applicable policy/template identities. Its SHA-256 uses the existing bounded canonical JSON encoding; no RFC 8785 claim is made. File/import/applicable collections have stable ordering. Original blob bytes are never normalized. Run/capture UUID, capture/receipt time, local repository root and storage paths live outside this fingerprint.

Capture requires a full pinned SHA, canonical repository root and clean tracked/untracked status. It reads selected Git blobs through fixed tree/blob operations without filters, compares working files before/after, and rechecks HEAD/status. Unsupported modes, symlinks, hard links, traversal, credential/configuration paths and missing/changed inputs block. This is a point-in-time cooperative capture, not an atomic cross-GitHub/filesystem transaction or hostile same-user isolation.

Working-tree observation uses a private temporary Git directory containing only a bounded, descriptor-checked copy of the index, the resolved HEAD, a minimal controller configuration and optional local `info/exclude` bytes. It points at the original object directory for reads. Repository configuration, hooks and `info/attributes` are never copied. Local `filter.*.clean`/`filter.*.process` definitions therefore cannot execute during status, even when `.gitattributes` selects them; no filter-name enumeration/race or outer-shell assumption is used. Tracked changes and nonignored untracked files remain checked; worktree `.gitignore` and local `info/exclude` exclusions are preserved. Capture and explicitly requested freshness use the same observation path, without modifying the original index/configuration.

Before status, the private view inspects **every** index entry using `git ls-files --stage -v -z`. Only recognized uppercase `H`, stage-zero entries with supported modes and the expected object-ID length are admitted. Lowercase `h` identifies assume-unchanged, uppercase `S` identifies skip-worktree, and lowercase `s` identifies both; any of these returns `READ_GIT_INDEX_FLAGS_UNSUPPORTED` before status runs, including on unselected files. Capture is blocked and freshness is `unverified`; no existing bundle is replaced. Review these flags in the source checkout before explicitly retrying. The controller never clears flags or rewrites the original index. Missing/unknown tags, ambiguous framing, unmerged stages or unsupported index layouts fail closed with `READ_GIT_ISOLATION_UNVERIFIED`.

Global/system configuration and attributes are disabled; missing objects cannot trigger lazy fetch and replacement refs are disabled. Git must support the fixed metadata and isolation options, including `--no-lazy-fetch`; unsupported options fail closed. Missing/unsafe/oversized indexes or excludes, submodules, sparse/split indexes needing unrepresented metadata, and failed private setup return `READ_GIT_ISOLATION_UNVERIFIED`, never a fallback to repository-configured status. Cleanup failure blocks success. The complete observation shares a 30-second deadline with existing process termination limits. Private temporary metadata is removed on normal success/error/cancellation; a controller crash can leave inert private temporary metadata.

Repository-specific normalization, file-mode/ignore settings and external exclude files are intentionally not loaded. This can conservatively block a checkout that ordinary configured Git calls clean; it does not waive a cleanliness check. This is configuration isolation for fixed Git observations, not native sandbox enforcement or protection against a hostile same-user process altering the private scratch directory. Existing filesystem TOCTOU/ABA and point-in-time limitations remain.

PNG references must be classified as static design, retain a matching selected manifest declaration and have bounded PNG headers. Four published EP-07 manifest formats are supported: artifact inventory, preservation inventory and the study/refinement render records. Unknown formats block. Only the exact documented artifact-inventory self-entry may omit its own digest; an outer digest still covers the unchanged manifest. Other missing digests fail. Old absolute provenance paths and proposal banners remain original data and are never used as filesystem locators. Design references and imported claims cannot establish runtime/native observations.

### Storage, bounds and recovery

Per-run private storage retains `blob-SHA256.bin`, `bundle-SHA256.json`, `capture-UUID.json`, optional validated `report-UUID.json`, and preserved `artifact.tmp-UUID.json` files. No database/global object store is introduced. Workflow events/checkpoints contain only small references; journal v1 and its limits are unchanged.

Publication requires the existing writer token, validates inputs, synchronizes exclusive temporaries, publishes complete objects without replacing accepted objects, verifies content and capture bindings, then permits a separate journal attachment. Existing same-name/different-content objects conflict. Partial/unreferenced artifacts survive failures and count toward quota; no automatic eviction, adoption, repair or migration occurs. A matching portable hash is not authenticated human authorization.

After `inputs.changed` selects a verified replacement, acceptance must bind that exact reference ID and digest. The shared reducer enforces this for both typed attachment and `WorkflowStore.apply`, and journal replay recomputes the same rule. A different bundle or an opaque-reference substitution is durably rejected and audited without changing the selected input/stage/revision. Explicit acceptance of the selected bundle remains available after restart. Journal v1 and event schemas are unchanged; legacy opaque-only transitions retain their existing behavior.

| Input/artifact resource | Maximum |
| --- | ---: |
| Selected files | 256 |
| Individual selected object | 8 MiB |
| Issue snapshot | 1 MiB |
| Each discovery/scope import | 2 MiB |
| Canonical manifest | 1 MiB |
| Complete bundle | 64 MiB |
| Structured report | 1 MiB |
| Retained artifacts per run, including failures | 256 MiB |

Limits fail with bounded codes and preserve prior evidence. `INPUT_FILE_MISSING`, `SOURCE_CHANGED`, `DIRTY_CHECKOUT`, `MANIFEST_INVALID`, `CONTENT_MISMATCH`, `ARTIFACT_QUOTA`, `IMPORT_BASIS_MISMATCH` and `PILOT_INPUTS_REQUIRED` require correction of the selected inputs or a separate recovery decision before explicit retry. Missing/legacy input references block new consumers while existing legacy workflow controls remain subject to ORCH-002's guards.

Recovery never runs Git/GitHub, recaptures sources, adopts an orphan, launches an agent or settles an interrupted attempt. Native macOS dead-writer reclamation remains unavailable without verified boot identity. Hardware power-loss durability and hostile same-user TOCTOU/ABA containment remain unverified; cooperative file/directory checks and process-crash tests do not prove them.

### GitHub and report trust boundaries

The controller's fixed GitHub operation is `gh issue view NUMBER --repo OWNER/REPO --json number,url,title,body,state`. It validates identity and complete response/AC fields and fails closed on auth/read/parse errors. The host's normal home-backed gh session is opaque to the controller; no token is read or logged by this code. Token-only environment sessions and custom gh config directories are not forwarded. Git and GitHub subprocesses use fixed argv, no shell, bounded binary output, a 30-second deadline and owned-group TERM/KILL cleanup. Raw stderr is never returned. This separate trusted-controller boundary does not widen ORCH-001's diagnostic runner or establish native network/credential/plugin isolation.

Strict report records separate controller identity from payload and assessment. Every expected AC appears once; N/A requires rationale and an applicable controller policy. Evidence resolves only to retained inputs or explicitly controller-verified observations bound to the run/input/SHA. Unsupported claims remain unverified, and validation claims without verified execution observations are assessed unverified. Historical settled attempts cannot be rebound to new inputs. Partial/interrupted output never counts as successful completion.

The artifact primitive supports immutable validated-report storage under an existing writer lease for fault/identity tests and later integration; the CLI performs validation only. Same report identity/bindings/payload is a duplicate even with a later receipt time; changed content/bindings conflict. No report collection loop, execution adapter, production approval or handoff is enabled.

Durable report publication additionally checks that the controller state exactly matches the verified current journal/checkpoint and that no unresolved intent exists. Report observation provenance records revision/sequence separately from the idempotency identity. Offline report verification reconstructs that verified historical prefix, so later interruption cannot erase the original report or reinterpret it as settling the current attempt. Pure validation still requires a trusted controller context; it does not authenticate a producer session.

## ORCH-004 Phase A — prepared jobs, no execution

Phase A adds process-free preparation and immutable admission evidence. It is an
intermediate increment of ORCH-004, not completion of the execution story. There
is no launch adapter, agent session, report generation, approval or handoff.

```text
cb-flow designer prepare RUN_UUID --revision N --recipe RECIPE_ID --request-id UUID
cb-flow designer inspect RUN_UUID --preparation UUID
cb-flow designer admission RUN_UUID --preparation UUID --revision N --request-id UUID
```

The production recipe catalog is deliberately empty. Only controlled tests inject
an explicitly test-only synthetic recipe with an enumerated compact/desktop PNG
set. The CLI has no recipe-file, environment override, force, approval, model or
shell option. A production preparation request cannot use the synthetic recipe.
US-037 remains blocked by the unchanged `PILOT_INPUTS_REQUIRED` guard; no real
pilot recipe or authoritative input exception was added.

A prepared job is a portable SHA-256 identity over canonical manifest bytes. It
binds bundle, projection, recipe, template, resolved prompt, report schema and
policies. Run UUID, capture paths/times, preparation time and journal position do
not enter this identity. Separate controller receipts bind each preparation to
its actual run, revision, journal sequence/head and accepted bundle. Reusing a
request ID with changed content or binding fails. A historical receipt remains
inspectable after workflow advancement, but inspection returns stale (exit 3).
An audited rejection changes the journal binding even if revision is unchanged.

Retained bundle/input bytes are rehashed. Required original PNG bytes and their
manifest hashes are retained without resizing or re-encoding; the recipe names
exact source paths, expected digests and safe logical destinations. Header and
dimension checks do not establish full PNG decoding or model vision support.
Projection is logical-only: no execution mount is created. Source, issue, scope
and imports remain data, and embedded paths/instructions/templates are not run.
The fully resolved prompt contains a data index; original documents remain
separate immutable blobs. No Git filters, hooks, GitHub or metadata subprocesses
run in these commands.

Preparation records retained integrity as verified, selected working files as
not checked, and full repository/GitHub freshness as unverified. Existing
`inputs fresh` remains a separate explicit controller command; historical output
is not current admission evidence. No diagnostic report or user JSON can supply
native proof. Exact CLI identity, diagnostics, image support and all native
restrictions remain unverified; the ORCH-001 exact version pin is unchanged.
The previously observed newer Codex version is not admitted by this increment.

Admission always records `decision: "deny"`, `allowLaunch: false`,
`authorization: "none"`, and `PHASE_A_EXECUTION_DISABLED`. Exit 3 is a successfully
recorded denial, not permission or successful execution. Prepare exit 0 means
preparation only. Operational/integrity/conflict failures exit 1; malformed CLI
arguments exit 2; unsupported schemas retain exit 3. Unknown commands cannot
reach an execution path. Existing workflow metadata controls do not launch agents
and are not expanded by Phase A.

Storage reuses the writer lease, healthy journal/snapshot checks, private file
checks and immutable temporary-write/rename/sync publication. Source blobs,
projection and job are published first; their closure is reverified before the
receipt is published last and checked before acknowledgement. New fixed names are
`job-SHA.json`, `projection-SHA.json`, `preparation-UUID.json` and
`admission-UUID.json`. Journal v1 and workflow schemas are unchanged. Admission
publishes only a separate denied-decision artifact and never a workflow event.

Incomplete objects and temporary files remain evidence; neither inspection nor
workflow recovery adopts or deletes them. Explicit retry revalidates inputs and
may deduplicate byte-identical objects before publishing a complete receipt.
After an unacknowledged publication, explicit inspection can verify retained
bytes; retry syncs before acknowledging success. I/O failure never reports a
successful preparation. No power-loss durability guarantee is inferred from
fault injection or filesystem sync calls.

Limits: 1 MiB per manifest/projection/recipe/schema/prompt, 64 KiB per receipt or
decision, 260 projected entries, 16 required PNGs, 8 MiB per retained object,
64 MiB total projection, shared 256 MiB retained-artifact quota and 4,096 directory
entries including locks/temporary files. Every new artifact, orphan and failed
temporary consumes the shared quota. There is no automatic cleanup or eviction.

Controller provenance records component/version/policy. Its source SHA is null:
no authenticated build-source attestation exists, and a job baseline must not be
misrepresented as the controller's build identity. Recipe/template/schema bytes
and their versions are retained and verified. Current-policy comparison is
conservative: incompatible future policies block verification rather than
silently migrating historical artifacts.

Native filesystem/credential/network/plugin/MCP/hook/delegation/process isolation
remains unverified. ORCH-002 AC-06 remains PARTIAL: ambiguous macOS dead-writer
locks cannot be reclaimed without the required boot identity. Cooperative private
storage is not a hostile same-user sandbox; TOCTOU/ABA and hardware power-loss
limitations remain. Abrupt controller termination can leave a lock requiring
existing conservative recovery; no new force-unlock or helper process is added.
Phase B execution, native qualification, ORCH-005 and real US-037 inputs require
separate review and explicit authorization.
