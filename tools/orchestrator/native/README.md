# B0.2A-1: host-only native development scaffold

This isolated Swift scaffold models a synthetic supervisor and lifetime guard.
It is not a VM runner, process supervisor, security boundary or production CLI.
Neither application startup nor `cb-flow` imports or invokes it. No existing
orchestrator contracts, admission decisions or workflow semantics are changed.

**B0.2A-1 does not qualify VM execution, native teardown, credential isolation,
Codex execution or Designer execution.**

## Explicit local commands

From the repository root, using the already installed Apple toolchain:

```sh
sh tools/orchestrator/native/check.sh build
sh tools/orchestrator/native/check.sh test
sh tools/orchestrator/native/check.sh inspect
```

`build` compiles and ad-hoc signs the test artifact without executing it. `test`
also runs deterministic in-process model tests. `inspect` only inspects existing
artifacts. These commands are deliberately absent from root workspace scripts.
Root TypeScript checks and tests do not validate Swift; run this dedicated check
explicitly. There is no package resolution, download or production installation.

The script pins the compiler under `/Library/Developer/CommandLineTools/usr/bin/`,
SDK `/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk` and target
`arm64-apple-macosx26.0`. Explicit linker platform metadata also specifies minimum
macOS 26.0 and SDK 26.5. Artifacts, temporary files and compiler caches remain in
the ignored `tools/orchestrator/dist/native-b0-2a1/` directory. No global developer
directory or SDK selection is changed.

## Boundaries

| File | Responsibility |
| --- | --- |
| `Sources/Contracts.swift` | Synthetic-only v1 profile, identity/digest validation, fixed policy, fake interfaces |
| `Sources/Guard.swift` | Single-threaded state model with injected clock and action recorder |
| `Sources/Supervisor.swift` | Simulated lifecycle and bounded guest-data ingestion |
| `Sources/Evidence.swift` | Typed observations and in-memory publication simulation |
| `Qualification/FrameworkDeclarations.swift` | Separate typecheck-only Virtualization framework aliases |
| `Tests/main.swift` | In-process fake clock, action recorder and deterministic assertions |
| `TestEntitlements.plist` | Virtualization entitlement embedded only in the local test executable |

The declaration qualification file is excluded from both the model archive and
the executable tests. It constructs no VM, loader, disk, socket or network device.
The source audit in `check.sh` is a narrow regression tripwire, not a sandbox or
proof that arbitrary future code cannot exercise a capability. Current model
sources contain no executable VM, process-control or filesystem backend.

The static library is compiled separately. Tests compile the same model sources
together with the test main; they do not import the emitted library as an external
consumer. Signing qualifies only the combined fake-test executable. An embedded
entitlement and a valid ad-hoc signature do not demonstrate entitlement execution.

## Synthetic contracts

Canonical JSON uses sorted keys and no escaped slashes. Decoding requires exact
re-encoding equality, so unknown or duplicate fields and alternate encodings are
rejected. Consumers must use `Wire.encode`; arbitrary pretty-printed JSON is not
accepted. UUID identities must be lowercase; configuration identities use SHA-256
over the exact canonical bytes. This byte identity is not authentication.

Only schema version 1 and purpose `b0.2a-1-synthetic-only` are accepted. The exact
device allowlist is `base-read-only`, `console-bounded`, `input-read-only`,
`scratch-bounded`. Policy requires host-only management and read-only base/input;
it rejects IP networking, directory sharing, credentials, clipboard, USB, SSH
agent forwarding, nested virtualization, retry and runtime fallback.

Fixed limits are one job, one future VM, two CPUs, 2048 MiB memory, 2048 MiB
scratch, 65536 console bytes, 4096 bytes per frame, 65536 aggregate observation
bytes and 64 observations. Frame text is additionally limited to 2048 UTF-8 bytes.
Boot, execution, stop-grace and teardown budgets are respectively 120000,
900000, 10000 and 30000 milliseconds. These are modeled values, not OS-enforced
resource limits. Changing them requires a separately reviewed contract change.

## State behavior

The guard progresses from `reserved` to `armed`, then accepts an exactly bound GO
token into `awaitingReady`, followed by host-controlled `running`. Arming fixes
both the boot deadline and total execution deadline; readiness cannot extend
them. Identical bound submissions and supported GO replays are idempotent;
conflicting identities, digests, tokens or transitions throw typed errors.

Cancellation enters `cancelling`, then fake-clock polling records escalation
after the grace period and leaves `unresolved` after the teardown budget. The
teardown budget starts at cancellation. No OS timer runs in the background.
Controller loss requests cancellation; supervisor loss or guard failure becomes
unresolved. Backward clocks and deadline arithmetic overflow also fail closed.
These transitions record observations of fake actions; they send no signals.

The supervisor models `prepared → observing → collecting → completed`. Guest
frames can only add ordered untrusted data during observation. They cannot issue
GO, modify configuration, establish cleanup, grant approval or change workflow
state. Invalid lifecycle calls are rejected. Invalid completion evidence changes
the model to `unresolved`.

Completion requires a committed fake publication with exact job/owner/profile
binding, bounded final bytes matching their digest and an affirmative host-fake
cleanup assertion. The supervisor additionally binds the exact observation-log
digest. Cancellation may finish as `failed`, never `completed`. Missing or invalid
evidence is non-success. Evidence authorization is always `none`.

`FakeEvidencePublication` is deliberately memory-only: interruption before or
after staged-byte publication leaves no commit marker. This exercises protocol
behavior, not disk durability, atomic filesystem publication, trusted external
cleanup or authenticated IPC. A host fixture can assert cleanup; no guest frame
is accepted as that assertion. The supervisor and guard remain independent
models, not a coordinated live runner.

## Unverified work

Real VM lifecycle, guest communication, disk construction, process ownership,
enforced deadlines, native teardown, orphan recovery, filesystem race protection,
credential isolation, network isolation and plugin/MCP restrictions remain
unqualified. No launchd, credentials, Codex invocation, workflow approval or
Phase B execution path exists here. Phase A continues to deny execution
unconditionally; US-037 remains blocked. Further work requires independent
review and separate Planner/Product Owner acceptance and authorization.
