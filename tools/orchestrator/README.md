# ORCH-001: local preflight

Standalone development tooling for [ORCH-001 #100](https://github.com/heyitsanuar/coffee-break/issues/100), under DEV-ORCH #99. It has no application-runtime imports or runtime dependencies. It does not execute agents, perform inference, manage workflow state, approve work, change GitHub, or implement US-037.

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

The identity helpers bind repository root, full SHA, status/content digest, Codex binary digest and effective policy digest. Later stages must recompute/compare these fields and inspect every required result; an old report is not durable authorization. The protected-input digest covers tracked `apps/`, `packages/`, `docs/design/`, `.agents/`, `.codex/agents/`, `AGENTS.md` and root package manifests. It hashes symlink text without following it. It is not a complete dirty/untracked working-tree content manifest; ORCH-003 owns reproducible input bundles. This story implements no report cache, approval persistence or workflow engine.

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

Unit tests use mocked command adapters and disposable fixtures; one intentionally unisolated fixed helper proves ineffective restrictions are detected without secret disclosure. This is not native sandbox evidence. See `evidence/` for actual CLI output, the native attempt and validation results. Root validation includes this explicit workspace. No inference, package download, application integration, workflow execution, approval or repository publication is part of this package.
