# B0.2A-2 Gate 2A: fake-only host-process qualification

This development module implements R (one-run harness), G (ownership/lifetime
model), S (synthetic helper specification) and C (controller-loss model). It is
separate from application startup, `cb-flow` and the B0.2A-1 model. No production
CLI, adapter registration or workflow event is added.

**Gate 2A does not qualify real process ownership, independent native deadlines,
signal delivery, termination, cleanup, VM execution, credential isolation, Codex
execution or Designer execution.** No HP-01 through HP-15 host experiment is
authorized by these tests or their reports.

## Explicit developer checks

```sh
sh tools/orchestrator/native/HostQualification/check.sh build
sh tools/orchestrator/native/HostQualification/check.sh test
sh tools/orchestrator/native/HostQualification/check.sh inspect
```

The build pins SDK `/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk`,
ARM64 target macOS 26.0 and explicit linker metadata for SDK 26.5. No package
resolution, download, global configuration change or private signing identity is
used. The linker supplies local ad-hoc signatures with no embedded entitlements;
the script verifies and displays their metadata without running the helper.

Outputs, logs, temporary files and caches belong in the existing ignored
`tools/orchestrator/dist/native-b0-2a2/` location. `test` executes only `fake-tests`.
`compile-only-helper` is compiled and inspected, **never invoked** by any mode.
Root TypeScript checks do not cover Swift; the explicit native check is required.

## Module boundaries

| Component | Responsibility |
| --- | --- |
| `QualificationContracts.swift` | Closed v1 binding, finite protocol vocabulary, fake clock and limits |
| `ProcessBoundary.swift` | Injected spawn/signal/wait/observation ports; disabled default boundary |
| `Guard.swift` | Private creation-bound handle, serialized operations, fixed deadlines and non-success handling |
| `Harness.swift` | One immutable run and publication coordination; separate authority-free C model |
| `Helper.swift` | No-fork behavior catalog and independently modeled emergency deadline |
| `Evidence.swift` | Strict non-authoritative report and memory-only publication protocol |
| `HelperMain/main.swift` | Compile-only fail-closed entrypoint, exit code 3 |
| `Tests/main.swift` | In-process fake clock, spawner, child, delivery/wait/observation failures |

The dedicated build includes unchanged B0.2A-1 `Sources/Contracts.swift` solely to
reuse canonical `Wire` JSON/hash functions. Its old types remain unchanged; the
new qualification schema does not extend their v1 policy. Tests compile the same
model sources directly, rather than importing the emitted archive as a client.

## Ownership and lifecycle

R owns one guard and one immutable binding. The binding records experiment/plan,
run/request/owner, nominal source revision, three artifact digests and expected
workload outcome. Contract parsing requires canonical bounded JSON and rejects
unknown/duplicate fields, unsupported versions and invalid identities.

`arm()` fixes the absolute deadline before modeled spawn or GO. `prepareChild()`
obtains a creation-bound object only from the trusted injected spawn port. G then
mints its private `OwnedChild`. There is no PID-based initializer, lookup,
deserialization, exported handle or historical adoption operation. PID, PPID,
PGID, UID and start metadata are observations, not authority. The port object is
part of the trusted fake boundary; no authenticated OS process handle is claimed.

GO is a non-Codable private value binding all run identity, arm time, deadline and
a 32-byte capability. Only its SHA-256 enters reports. No code logs the raw value
or reads it from argv/environment. Duplicate/replayed GO, rearming and mismatched
control bindings are rejected. Capabilities are injected by trusted test fixtures;
native secure capability delivery is deferred.

G uses a nonblocking operation lock: overlapping or reentrant operations return
`busy`. Spawn, signal, wait, observation and report snapshots are synchronous and
serialized. Reap invalidates the private signal authority before observation
verification, including when later observations contradict the wait result.

The normal path is `idle → armed → prepared → running → reaped`. Cancellation
uses `terminating → killing`, then requires reap and cleanup observations. TERM
and KILL requests and accepted/denied delivery are recorded separately from reap.
Controller loss has no access to the clock or deadline; late cancellation cannot
conceal an already-expired deadline. C itself has no process-control interface.

Missing wait status, unexpected ECHILD, delivery failure, changed ownership,
unexpected descendants, backward clock, overflow or incomplete cleanup cannot
produce PASS. Unresolved states preserve the ownership/evidence obligation and
do not adopt, retry or signal discovered PIDs. There is no automatic recovery
from an unresolved state. A future native emergency-stop mechanism is not
implemented by this model.

Deadlines advance only when the injected clock advances and the host calls
`poll()`. No real clock, scheduler, background loop or external watchdog is
installed. The model therefore cannot enforce an independent native deadline.

## Helper and controller restrictions

S's finite catalog is cooperative exit, wait for cancellation, and ignore modeled
TERM. It performs no modeled workload before exact GO. Its separate 20-second
emergency deadline can end waiting/running behavior without extending G's
deadline. Terminal states do not restart. The model opens no files/descriptors,
allocates no workload buffer, starts no descendants and uses no network,
credentials, arbitrary commands or production data. Input and output structures
are bounded by the wire/event limits below.

The executable entrypoint intentionally supplies **no live transport, real clock
or capability bootstrap** and exits 3. Behavioral tests call S in-process with
fakes. Gate 2B needs separately reviewed native wiring before this executable can
participate in an experiment; there is no environment/argument override today.

Helper-originated frames can contribute only a bounded digest-tagged observation
with `untrustedHelper` provenance. They cannot signal, choose a target, establish
cleanup, finish the host lifecycle, extend a deadline or authorize a workflow.
Malformed/replayed observations retain fixed diagnostic codes, never executable
text or raw capabilities.

## Safety limits and evidence

The Gate 1 hypotheses are represented separately from B0.2A-1's limits: 30-second
case, 8-second guard budget, 1-second TERM grace, 3-second cleanup allowance after
grace and 20-second helper emergency budget. Maximum proposed topology is four
processes; one guard admits at most one modeled child. No actual process-count,
memory, CPU, descriptor, file-size or networking enforcement is demonstrated.

Helper frames are limited to 4096 bytes and 2048 UTF-8 text bytes. Events are
limited to 128 records and 65536 canonical bytes, with a separate 65536-byte input
budget. Reports are limited to 65536 bytes. Overflow is non-success; it never
silently discards evidence while reporting PASS. Invalid-clock/ownership and
terminal-unresolved states deliberately do not attempt speculative cleanup.

Reports use `host-process-qualification/1` and keep three dimensions:

- Experiment: PASS / FAIL / UNVERIFIED / BLOCKED.
- Workload: completed / cancelled / timedOut / failed / notStarted.
- Cleanup: verifiedFixture / partial / UNRESOLVED.

PASS means only that the expected fake scenario and its fixture cleanup evidence
agree. It requires an exact wait/observation match, no descendants, descriptor and
resource-release observations, and the expected workload outcome. Exit zero,
signal acceptance, PID disappearance or helper text alone cannot establish it.
All reports require `mode: fake-only`, `authorization: none`,
`nativeEnforcement: unverified` and an injected-fake clock label. Nominal identities
in unit-test reports are synthetic values, not real build/source attestations.

Publication stages a validated report and installs a commit digest last. The
positive control and before/after-byte interruptions use the same valid report;
interrupted publication cannot verify. This is memory-only protocol simulation,
not durable storage, authenticated reporting or power-loss qualification.

## Gate 2B blockers

Separate PO authorization and independent review are required for any live
adapter, helper transport/clock, real spawn, signal, wait, watchdog, resource
limit, authenticated ownership, emergency-stop path or host experiment. Guard
death, sleep/wake, descendants and PID reuse remain unverified. The current
operation lock and source audit are not a native sandbox.

Phase A remains unconditionally denied; production recipes remain unavailable;
US-037 remains blocked; ORCH-001/002/003 behavior and ORCH-002 AC-06 remain intact.
No VM, Codex/Designer execution, B0.2B/C, B1–B3 or ORCH-005 is enabled.
