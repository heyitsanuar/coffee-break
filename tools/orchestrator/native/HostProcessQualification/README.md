# Gate 2B-2A: isolated native adapter model

This experimental Swift module models future host-process-control contracts with
injected deterministic fakes only. It is independent of `cb-flow`, application
startup, B0.2A-1 and Gate 2A. There is no executable helper, real syscall backend,
native clock, live process lookup, transport, registration or production import.

**Model PASS is not native qualification, security readiness, PO approval or
permission to execute HP-01. Phase A remains unconditionally denied.**

## Verified implementation baseline

- Local branch: `codex/orch-004-phase-a-preparation`.
- HEAD: `d2daa9c67fd6a48bc1f6737c3f024fc7d93bb101`.
- Tree: `6f967a6f46cb573ec3f5a8da8776e6e2e0d6f26e`; clean before implementation.
- Remote main was read directly: `33c5bd7f6de5d8bc3fe5d82da93fcc21a67021b0`,
  the same tree, PR #110 MERGED with the approved implementation head.
- Local main/origin-main refs were stale and were not treated as remote truth.
  No fetch, checkout, reset, rebase or branch creation was performed.
- Gate 2B-1 architecture report in this conversation and the explicit Gate 2B-2A
  assignment supply scope. The full historical Gate 1 report is unavailable in
  the versioned materials inspected. This provenance gap is not reconstructed.
  Existing Gate 2A limits are inherited as modeled hypotheses, not enforcement.

## Exact boundaries

Only these ten new files belong to this increment:

| File | Responsibility |
| --- | --- |
| `Sources/Contracts.swift` | Separate closed binding, frame, event and result vocabulary; canonical JSON/hash utility |
| `Sources/SyscallBoundary.swift` | Narrow injected spawn/wait/signal/observation/descriptor ports; unavailable default spawner |
| `Sources/Ownership.swift` | Creation-bound private child reference and designated wait-owner object |
| `Sources/Lifecycle.swift` | Serialized protocol/lifecycle, ownership obligation, teardown and result snapshots |
| `Sources/Deadlines.swift` | Injected clock, immutable deadlines, sticky epoch/wake/rollback failures |
| `Sources/Emergency.swift` | Separate trusted fake capability; unavailable default; no PID/token adoption |
| `Sources/Evidence.swift` | Closed simulation-only reports and memory-only interrupted publication |
| `Tests/main.swift` | In-process fake ports/clocks and deterministic positive/negative/boundary tests |
| `check.sh` | Explicit SDK/target compilation, fake-test execution and artifact metadata checks |
| `README.md` | Scope, contracts, validation evidence and unverified guarantees |

No previous source, helper, policy, entitlement, dependency, root script or CI
configuration is modified. This module duplicates a small canonical JSON/hash
utility to remain self-contained; it neither imports old synthetic profiles nor
extends their schemas. All Swift declarations are module-internal.

## Ownership and lifecycle

`AdapterLifecycle` owns one immutable parsed binding and one private child. Its
single injected spawn attempt returns either typed unavailable/denied or a child
object. Only a successful result can mint ownership. The reference and `spawned`
event are recorded before subsequent fallible clock/identity observations. There
is no PID constructor, adoption operation, report importer or automatic respawn.

The child retains one designated wait-owner object. Matching UUID strings cannot
substitute for that object's identity in the fake boundary. The lifecycle never
exports its child or wait owner. Observed PID/PPID/UID/start/digest corroborate the
fixture; they are not authenticated OS ownership. Invalid identity or unexpected
ECHILD revokes normal authority and retains unresolved cleanup. Observation or
transport failure does not silently clear the ownership obligation.

All public operations and snapshots use one nonblocking lock. Concurrent/reentrant
calls return `busy`. Injected operations must terminate; this lock does not make
blocking native calls safe. Wait retries allow at most four interrupted responses
per child (initial call plus three retries), check deadlines between calls, and
suspend further waits on exhaustion. Pending waits remain explicit polls. Wait
failure suspends waits; ECHILD loses authority. Neither means successful cleanup.

A terminal wait immediately revokes signal authority, even if subsequent clock,
observation or descriptor checks fail. Accepted signal requests are recorded
separately from terminal status. TERM/KILL attempts are bounded to one each.
There is no process-group interface. A settled reaped snapshot stays immutable
under repeated polls and invalid late cancellation; no further port calls occur.

Clock/ownership faults, guard disappearance and partial cleanup preserve explicit
obligations. A known owned child can still be reaped after a prior non-clock
failure; failures cannot be erased by that cleanup. Missing evidence does not
authorize speculative signaling, owner transfer, repair or PID discovery.

## Deadlines and emergency model

Arming fixes 30-second case, 8-second execution and 20-second helper emergency
deadlines. Cancellation fixes a 1-second TERM grace and a further 3-second cleanup
allowance. Arithmetic is checked. GO cannot reset any deadline. Boundaries use
`>=`: completion at the execution deadline is `timedOut`; cleanup at its deadline
retains a cleanup violation; a late valid reap can still record modeled cleanup
without erasing F1/F2 timing failures. Time is sampled after injected operations,
including wait, observation and descriptor closure. Unexpected timeout is FAIL;
an expected timeout can be an experiment PASS only with complete modeled cleanup
and no independent violation. That is never successful workload completion.

Epoch changes, wake-generation changes and clock rollback are sticky faults.
There is no real monotonic clock, timer, scheduler, watchdog or sleep observer.
Deadlines are assessed only when the test advances time and calls the model.
These tests do not demonstrate an eight-second native response or independent
helper emergency termination. launchd deadline enforcement is not assumed.

The separate emergency port accepts only the bound digest, never a PID, helper
token or JSON claim. Defaults return unavailable. GO requires a trusted injected
`qualifiedSimulation` response and a fresh clock check. It does not qualify a real
host capability. Guard loss revokes normal ownership operations, records a
separate emergency request/result and keeps cleanup UNRESOLVED even if accepted.
No real-host emergency implementation or signaling-by-audit-token path exists.

## Protocol and evidence contracts

- Binding: `native-adapter-model-binding/1`, schema 1, HP-01 only, exact lowercase
  UUID session/request/owner, source SHA, guard/helper digests and expected outcome.
- Frame: `native-adapter-model-frame/1`, schema 1, exact session/binding/deadline
  digests, sequential number, finite `ready`/`observation` kinds, bounded text.
- Report: `native-adapter-model-report/1`, schema 1; separate verdict, workload,
  cleanup, obligations, exit/observation/descriptor results, ordered events and
  sticky issues. Every report requires `mode=deterministic-fakes`,
  `authorization=none`, `allowNativeLaunch=false`, `nativeEnforcement=unverified`,
  injected-clock labeling and the complete unverified-guarantee list.

Canonical sorted JSON decoding requires byte-identical re-encoding. Unknown or
duplicate fields, alternate encodings, unsupported versions and oversized input
are rejected. Frames are limited to 4096 bytes, text to 2048 UTF-8 bytes, total
accepted helper input and event bytes to 65536 each, events to 128 and reports to
65536 bytes. Event overflow remains an explicit failure; if critical reap evidence
cannot be logged, cleanup is not promoted to verifiedModel. Reports remain bounded.

The modeled sequence is BIND → ARMED → READY → GO → EXIT/REAP → CLEANUP → REPORT.
READY needs an observed created child. GO is a non-Codable in-process capability
bound to deadlines, digest and 32-byte injected nonce. It is single-use. Neither
payloads nor reports can create it. Observation frames are accepted only after
GO and contribute untrusted digests; they cannot reap, signal, extend a deadline,
claim cleanup or grant approval. Accepted READY is a host-model protocol event,
not an independent attestation from the helper. Snapshots may be inspected early
for diagnostics; inspection does not advance lifecycle or imply completion.

Cleanup `verifiedModel` requires matching owned identity/exit, a recorded reap,
zero modeled descendants, released modeled resources and closed modeled
descriptors. It is never verified native cleanup. Verdicts are PASS / FAIL /
UNVERIFIED / BLOCKED; workload is independent. Missing cleanup remains UNRESOLVED
or partial and prevents PASS. PID disappearance and helper text are insufficient.

Publication validates a complete report, stages bytes and installs a digest last.
The positive control and both interruption cases use the same valid evidence.
Interrupted/truncated or uncommitted bytes cannot verify. This is memory-only
fault simulation, not filesystem persistence, durable atomicity or authentication.

## Explicit validation

```sh
sh tools/orchestrator/native/HostProcessQualification/check.sh test
sh tools/orchestrator/native/HostProcessQualification/check.sh build
```

The script uses the installed compiler, SDK `MacOSX26.5.sdk`, ARM64 target macOS
26.0 and explicit linker platform versions 26.0/26.5. It emits a static archive
and fake-test executable only, with local linker ad-hoc signing; no entitlements,
private signing key, dependency resolution or helper binary. Tests compile the
same sources directly, not the emitted archive as an external consumer. Root
TypeScript checks do not validate Swift. A source tripwire is not OS enforcement.

Artifacts, caches and mutation logs are ignored below
`tools/orchestrator/dist/native-gate-2b2a/`. Validation command logs also use
`/tmp/coffee-break-gate-2b2a-*.txt`. Mutation tests operate only in disposable
copies; actual source is never mutated. No real process experiment is permitted.

The implementation's first focused execution produced 16 PASS / 8 FAIL: expired
normal-completion workloads were correctly timedOut but classified UNVERIFIED
instead of FAIL. The result derivation was corrected without weakening tests.
Later tests exposed post-reap cancellation sampling an already-failed clock;
terminal validation now precedes that sample. Local inspection also added
regressions preserving ECHILD and signal outcomes before a failing clock read.

Final local validation (2026-10-19):

| Executed check | Result |
| --- | --- |
| New adapter-model native compile and fake tests | PASS: 97 tests, zero failed |
| Existing Gate 2A fake regression | PASS: 76 tests, zero failed |
| Existing B0.2A-1 fake regression | PASS: 54 tests, zero failed |
| Safe orchestrator subset below | PASS: 18 tests across four files |
| Root typecheck | PASS |
| Root lint | PASS; two existing generated desktop unused-disable warnings |
| Root build | PASS; no application startup |
| ARM64 executable, linker metadata, signature | PASS: SDK 26.5, minimum macOS 26.0, ad-hoc |
| Shell syntax and tracked/new-file whitespace checks | PASS |
| Full root/orchestrator test suites | NOT RUN: include prohibited real process/security fixtures |
| Native process experiments, helpers, HP-01 | NOT RUN: not authorized |

Safe repository commands executed:

```sh
sh tools/orchestrator/native/HostQualification/check.sh test
sh tools/orchestrator/native/check.sh test
npm test --workspace @coffee-break/orchestrator -- test/capabilities.test.ts test/contracts.test.ts test/designer/admission.test.ts test/designer/cli.test.ts
npm run typecheck
npm run lint
npm run build
git diff --check
```

The two lint warnings remain in generated
`apps/desktop/out/renderer/assets/createOfficeGame-ujkITRew.js`, lines 115516 and
115533. No source/configuration was changed to suppress them. The prior Gate 2A
script compiles its existing helper but never executes it. All executed native
test programs are in-process fake suites, without experimental children/signals.

Mutation sensitivity on the final 97-test suite:

| Disposable mutation | Observed result |
| --- | --- |
| Omit final trusted-clock sampling after wait/observe/close | 84 PASS / 13 expected FAIL; exact-deadline completion regression fails |
| Remove signal-authority revocation after reap | 87 PASS / 10 expected FAIL; post-reap cancellation regression fails |
| Install publication digest before the after-bytes interruption | 96 PASS / 1 expected FAIL; expected incompleteEvidence is not thrown |
| Unmodified implementation control after mutations | 97 PASS / zero failed |

All mutants compiled successfully before testing; failures were assertions, not
compiler failures. Mutated source/executables were removed. Source hashes were
compared before/after mutation testing and were unchanged. Ignored files
`mutation-results.json`, `*-mutation.txt`, `*-build.txt` and
`unmodified-control.txt` retain bounded local results under the artifact root.

## Acceptance-criteria traceability

These are the 16 incremental assignment criteria, not completion of ORCH-004's
15 story criteria. Results are model-only and await independent review.

| AC | Evidence |
| --- | --- |
| 01 | This isolated ten-file module; no production import or registration |
| 02 | Only injected fakes/unavailable ports; script runs fake tests, never a helper |
| 03 | Successful-spawn reference recorded before observation; failure-after-spawn tests |
| 04 | Wait-owner object identity; serialized operations; immediate reap revocation and stability tests |
| 05 | Bounded EINTR, crossing-deadline retry stop, ECHILD and clock-fault regression |
| 06 | Immutable case/execution/helper/grace/cleanup deadlines; exact and crossing F1/F2 tests |
| 07 | Unavailable/unqualified emergency blocks GO; separate guard-loss request/outcome tests |
| 08 | Exact binding, nonce/deadline mismatch, stale and repeated GO rejection |
| 09 | Closed bounded frame parsing, sequence and READY/GO ordering tests |
| 10 | Separate simulation report, explicit obligations and UNRESOLVED/partial cleanup |
| 11 | Negative, boundary, overflow, contradiction, publication and mutation tests |
| 12 | Dedicated SDK 26.5 / ARM64 / macOS 26.0 build and metadata inspection |
| 13 | Existing Designer admission/CLI tests retain unconditional Phase A denial |
| 14 | Existing tracked source/infrastructure unchanged; prior native regression suites |
| 15 | Read-only GitHub baseline inspection only; no publication or issue mutation |
| 16 | Native limitations and future HP-01 prerequisites documented below |

## Remaining blockers and stop

No real ownership, PID-reuse/ABA protection, signal delivery, reap, descendant
containment, descriptor closure, independent deadline, sleep/wake response, orphan
recovery, emergency termination, resource ceiling, filesystem race defense,
credential/network/plugin/MCP/hook/delegation isolation or durable publication has
been qualified. Source digests are identity data, not executable-byte attestation.
An injected port is trusted application code and must not be replaced by a real
implementation without separate authorization/review; the interface is no sandbox.

HP-01 still requires the historical plan/provenance decision, approved exact
objective/budgets/host/artifacts, separately implemented and reviewed native
backend and transport, a qualified safety lifeline, resolution of network and
credential enforcement requirements, bounded evidence/cleanup procedures and
explicit PO execution authorization. No report or manifest supplies that approval.

ORCH-001 native/plugin/MCP blockers and ORCH-002 AC-06 remain unchanged. Phase A
denies launch, production recipes remain unavailable and US-037 remains blocked.
No HP experiment, Gate 2B real-process execution, B0.2B/C, B1–B3, agent/inference,
VM, launchd service, credential probe or ORCH-005 is enabled. No commit, push, PR,
merge or issue mutation is authorized. Stop for independent Reviewer assessment
and Planner/PO acceptance.
