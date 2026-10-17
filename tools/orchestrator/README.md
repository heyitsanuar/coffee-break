# Local development tooling

Standalone development tooling for [ORCH-001 #100](https://github.com/heyitsanuar/coffee-break/issues/100) and [ORCH-002 #101](https://github.com/heyitsanuar/coffee-break/issues/101), under DEV-ORCH #99. It has no application-runtime imports or runtime dependencies. ORCH-001 provides diagnostics; ORCH-002 adds explicit local workflow-state controls. Neither executes agents, performs inference, grants approval, changes GitHub or implements US-037.

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
