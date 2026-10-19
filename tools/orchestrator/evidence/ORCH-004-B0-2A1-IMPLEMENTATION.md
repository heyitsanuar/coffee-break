# ORCH-004 B0.2A-1 implementation evidence

Date: 2026-10-18. Developer handoff for independent review, not acceptance or
authorization to execute Phase B.

**B0.2A-1 does not qualify VM execution, native teardown, credential isolation,
Codex execution or Designer execution.**

## Baseline and scope

- Branch: `codex/orch-004-phase-a-preparation`.
- HEAD: `68a1ca6b984c908235a197343505ac58ff3da923`.
- HEAD tree: `e6305ab02d3c98b901d703123365732ef699272a`.
- Approved integrated baseline: `f993d69ae53bb0cd98335fc0a37fe8e9099e9480`.
- The local approved-equivalent feature tree is explicitly permitted by the
  assignment and matches the previously verified integrated tree. The merge
  commit object is not available locally. Fresh remote state was not established;
  stale `origin/main` at `9c4d18c1a92b526a8f948da86cb029b5471bce8f` was not treated
  as current. No fetch, reset, checkout or branch creation was performed.
- Working tree was clean before implementation. All changes are new files below;
  existing tracked application/orchestrator source, contracts and scripts remain
  unchanged. There were no pre-existing changes to overwrite.

Exactly ten added files, paths relative to repository root:

1. `tools/orchestrator/native/Sources/Contracts.swift`
2. `tools/orchestrator/native/Sources/Evidence.swift`
3. `tools/orchestrator/native/Sources/Guard.swift`
4. `tools/orchestrator/native/Sources/Supervisor.swift`
5. `tools/orchestrator/native/Qualification/FrameworkDeclarations.swift`
6. `tools/orchestrator/native/Tests/main.swift`
7. `tools/orchestrator/native/TestEntitlements.plist`
8. `tools/orchestrator/native/check.sh`
9. `tools/orchestrator/native/README.md`
10. `tools/orchestrator/evidence/ORCH-004-B0-2A1-IMPLEMENTATION.md`

All ten remain untracked for review, with nothing staged. Disposable build
artifacts, compiler caches and temporary files use the existing ignored
`tools/orchestrator/dist/native-b0-2a1/` location.

## Implementation architecture

Four Foundation/CryptoKit model files implement a closed canonical v1 synthetic
profile, bounded guest observations, an injected-clock guard and an independent
supervisor lifecycle. No third-party dependency or package configuration was
added. There is no executable VM, filesystem or real process-control backend.
The fake child interface only records `go`, `cancel` and `escalate` actions.

The profile fixes one job/one future VM, device allowlists, resource ceilings,
ownership and SHA-256 identity. Unknown/duplicate fields, unsupported versions,
contradictions, changed digests, automatic retry and fallback are rejected.
Canonical re-encoding equality deliberately rejects alternate JSON encodings;
this is an internal synthetic wire contract, not a general JSON importer.

Guard behavior requires arming before an exact GO token, preserves fixed boot
and execution deadlines and models cancellation/escalation/unresolved resources.
Controller loss requests cancellation; supervisor loss and guard failure cannot
establish success. Polling is explicit, with no live timer. Supervisor host calls
advance preparation, observation and collection; guest frames only contribute
untrusted data. Final evidence must bind actual final bytes; supervisor completion
also binds the exact observed frames. Only the trusted in-process host fixture can
supply the fake cleanup assertion. Authorization must remain `none`.

Evidence staging/publication is memory-only and tests incomplete publication,
not disk atomicity or authenticated cleanup. These independent models neither
control nor prove the lifetime of an external resource. See the native README
for the state behavior and exact limits.

Virtualization aliases are checked in a separate compilation unit, excluded from
the archive and test executable. No framework objects are constructed. A narrow
source audit rejects known execution primitives but does not establish isolation.
There is no startup registration, `cb-flow` command, Phase B admission or override.

## Native build and artifact qualification

Executed:

```sh
sh tools/orchestrator/native/check.sh test > tools/orchestrator/dist/native-b0-2a1/validation.txt 2>&1
/usr/bin/codesign --verify --strict tools/orchestrator/dist/native-b0-2a1/model-tests
```

Both passed. The script typechecks framework declarations, emits a static model
archive/module, compiles the fake-test executable from the same model sources,
ad-hoc signs that executable, executes the fake tests and inspects identities.
Tests do not import the separately emitted archive as a client. No signing key,
Developer ID, notarization or distributable package was used.

- Host: macOS 26.6.2, build `25G83`, Apple Silicon.
- SDK: `/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk`, build `25F70`.
- Compiler: `/Library/Developer/CommandLineTools/usr/bin/swiftc`;
  Apple Swift 6.4 (`swiftlang-6.4.0.34.1 clang-2100.3.34.1`), driver `1.168.6`.
- Swift frontend SHA-256:
  `cf81104bf554eef05e28a8bb5285c763f1323b4511b944d755d8bdd6cb8db717`.
- Installed Clang: Apple 21.0.0 (`clang-2100.3.34.2`), SHA-256
  `1590ac950a3d627817d09ade5cb60b2115f17a72182a3141e010b4bcc482a0c9`.
- Linker: `/Library/Developer/CommandLineTools/usr/bin/ld`, `27037.1`,
  LLVM/TAPI 21.0.0, SHA-256
  `374d9f0713bce2c8a9e1e82bde51615d5433516a10d99b63107eb6ee70542e4c`.
- Compiler flags explicitly select SDK 26.5 and `arm64-apple-macosx26.0`.
  The executable also passes explicit linker `-platform_version macos 26.0 26.5`.
  Selecting only `-sdk`/`-target` initially left executable SDK metadata at 26.0;
  explicit linker flags corrected this before final qualification.
- `vtool -show-build` confirms ARM64/macOS, minimum 26.0, SDK 26.5, LD 27037.1.
  Archive object metadata was also inspected: minimum 26.0 and SDK 26.5.
- Signature: `adhoc`; TeamIdentifier not set; no private identity involved.
- Effective entitlements: only `com.apple.security.virtualization = true`,
  embedded in the fake-test executable. No production guard/supervisor is signed.

Final inspected artifacts from the 54-test build:

| Artifact | Identity |
| --- | --- |
| `model-tests` SHA-256 | `b43fafde711dba315eda5e1c3eb0dd31f15b3e8b78bf8b2dec9582d4f72b94fb` |
| `model-tests` CDHash | `e52e35e572a03aed4a1bafa9d335e8782e2c8621` |
| `libCoffeeBreakB0Scaffold.a` SHA-256 | `a8368bd44e55475be9f3da7c1b4a7d002e557b44c8c39a468efca11b3dc6893d` |

Raw native test/signature/build metadata is retained in the ignored local
`validation.txt` named above. These identities describe these local artifacts,
not a guarantee of reproducible binary builds. Successful signing and embedding
an entitlement do not prove that virtualization entitlement execution works.

## Tests and validation

The initial test-only typecheck failed on missing model declarations before
implementation. The final deterministic native suite passed **54 tests, 0 failed**:

- Closed-profile acceptance; unknown/nested/duplicate fields; missing/invalid
  owner; unsupported version; digest changes; resource/device contradictions;
  each forwarding prohibition; retry/fallback denial.
- Arm-before-GO; exact idempotency; conflicting requests; mismatched job, owner,
  request, profile, arm time and deadline; stale GO; boot/execution budgets;
  cancellation/escalation; controller/supervisor/guard loss; backward clock and
  overflow; deadlines immune to guest messages.
- Valid and invalid supervisor lifecycles; guest commands and forged
  cleanup/success/approval; missing final or cleanup evidence; cancellation cannot
  become success; cross-job evidence and altered observation digests.
- Malformed/oversized/version/binding/sequence frames; frame-count and aggregate
  byte budgets; rejected frames do not consume sequence; matching nonempty logs.
- Wrong publication digest; interruption before/after staged bytes; missing or
  substituted final bytes; authorization and unknown approval fields rejected.

| Check | Result |
| --- | --- |
| Framework declaration typecheck, native compile/link | PASS |
| Native fake tests | PASS: 54 |
| Ad-hoc signing, signature verification and entitlement inspection | PASS, test artifact only |
| Focused permitted orchestrator subset | PASS: 166 tests across 20 files |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS: exit 0, two existing generated warnings |
| `npm run build` | PASS: configured desktop and orchestrator workspaces |
| `git diff --check` and individual new-file whitespace checks | PASS |
| Full orchestrator and root `npm test` | NOT RUN: prohibited fixture workloads |

Focused subset command executed:

```sh
npm test --workspace @coffee-break/orchestrator -- \
  test/capabilities.test.ts test/contracts.test.ts test/cli.test.ts test/doctor.test.ts \
  test/designer test/reports \
  test/inputs/contracts.test.ts test/inputs/bundle.test.ts test/inputs/cli.test.ts \
  test/workflow/contracts.test.ts test/workflow/reducer.test.ts \
  test/workflow/journal.test.ts test/workflow/cli.test.ts test/workflow/paths.test.ts
```

Lint warnings concern unused `no-unused-vars` eslint-disable directives in the
existing generated desktop output
`apps/desktop/out/renderer/assets/createOfficeGame-ujkITRew.js` (115516, 115533).
No source or configuration was changed to suppress them.

The full suite includes real process timeout/kill tests, detached or persistent
fixtures and native security probes. `process.test.ts`, `security.test.ts`,
workflow lock/store tests and input artifact tests were excluded. Mixed process
fixture paths in input capture/GitHub tests were conservatively excluded too.
No tests were weakened or disabled. No fresh desktop baseline comparison was
needed or performed. Root checks do not cover Swift; the dedicated native check
provides that validation. Build compiled existing application artifacts but did
not start the application, agents or runtime simulator.

## Preserved limitations and review handoff

- Phase A's unconditional execution denial and all existing source remain intact.
- No ORCH-001 CLI policy, ORCH-002 persistence/recovery, ORCH-003 contracts or
  GitHub workflow changes; no new dependencies or root script changes.
- ORCH-001 native enforcement/plugin/MCP blockers and ORCH-002 AC-06 limitation
  remain; this scaffold does not establish readiness or qualify any of them.
- No production resource enforcement, process identity, live deadlines, teardown,
  orphan recovery, durable evidence, filesystem race defense, authenticated IPC,
  network boundary or credential boundary was exercised or demonstrated.
- No VM operation, guest image preparation, Codex/agent execution, persistent or
  detached process fixture, actual signal/kill/timeout recovery experiment,
  launchd operation, credential probe, authentication probe or network isolation
  probe was performed. No install, elevated privilege or private signing key.
- US-037 stays blocked. No B0.2A-2, B0.2B/C, B1–B3 or ORCH-005 implementation.
- No commit, push, PR, merge or GitHub mutation. Local changes await independent
  Reviewer assessment and Planner/Product Owner acceptance.

No deviation from the approved implementation boundary. Runtime guarantees are
explicitly unverified; model and build results must not be presented as their
verification.
