# D1-A Checkpoint B — fake-backed VM lifecycle qualification

This isolated Swift module models RECOVERY-001. It contains no operative VM,
process, provider, network, filesystem or agent execution backend. Foundation
and CryptoKit are the only imported frameworks. It does not integrate with the
application, TypeScript controller, workflow journal, input snapshots or Phase A.

Every exported document declares `mode=simulation`, `authorization=none`,
`allowNativeLaunch=false`, and `nativeEnforcement=unverified`. A test PASS is an
assertion about a deterministic model, never native qualification or PO approval.
Phase A continues to deny admission unconditionally; US-037 remains blocked.

## Baseline and scope

Implementation began on `codex/orch-004-phase-a-preparation`, HEAD
`3d184902db7d2a371d9dcc2642061cacf7bb7fec`, tree
`cc4dc6eaee3fbb4f355edf59f295360839f59d1b`, with a clean working tree. This is
the approved parent content of main merge
`6590ae121301a333c8bf5f5e9cd8802998e3d056`; no branch/ref was updated.

Exactly eleven new files constitute this module:

- `Sources/Contracts.swift`
- `Sources/Authority.swift`
- `Sources/Lifecycle.swift`
- `Sources/Ledger.swift`
- `Sources/Quarantine.swift`
- `Sources/Reconciliation.swift`
- `Sources/Evidence.swift`
- `Tests/Fixtures.swift`
- `Tests/main.swift`
- `check.sh`
- `README.md`

Existing source/configuration, dependencies, entitlements, CI, design files and
previous qualification modules are unchanged. Build outputs, caches and logs go
only into already-ignored `tools/orchestrator/dist/`. Mutation source copies are
temporary and removed by the runner, including on ordinary failure.

## Trust and authority

`VMLifecycle` is one serialized logical aggregate for owner, watchdog, VM,
ledger, quarantine and simulated admission. It supports deterministic reentrant
callbacks at external-call boundaries; it is not a multithreaded runtime.
Concurrent invocation from real threads is outside its contract.

The injected clock and effect ports are trusted simulation fixtures. The grant,
creation identity, qualified observation and one-use reconciliation permission
are opaque reference objects with restricted construction and no Codable
conformance. Grant issuance and claiming are one-shot. Exact issuer and creation
object identities are checked in addition to binding. Equal decoded metadata
does not produce custody. The bootstrap represents a trusted *simulated*
creation identity; it does not establish authenticated kernel/VZ ownership.

All attempts for one simulated host must share its trusted `VMHostRegistry`.
The registry pins its first host scope and retains both the one-attempt admission
claim and quarantine hold. A new run, attempt or host label cannot bypass it.
Creating a fresh fake registry/root is creating a different trusted simulated
world, not a supported way to recover an affected host.

Effects occur after recording intent, exposure and consumed budgets. Port calls
run outside aggregate updates. Pending calls reject duplicate operations and
finalization; loss events can revoke authority reentrantly. Returned responses
are recorded before a fallible clock read, and binding/lifecycle/deadline/fence
conditions are checked again before admitting their result. Loss cannot revive
GO, creation or broker authority.

## Versioned contracts

The original eight contracts are `VMExecutionBinding`, `VMOwnerLifecycle`,
`VMWatchdogLifecycle`, `VMResourceObligations`, `VMRecoveryDecision`,
`VMQuarantineRecord`, `VMReconciliationEvidence`, and `VMQualificationReport`.
`VMReceipt` is the bounded publication envelope. R1 adds
`VMPostClearanceDispute` in the existing quarantine source: an append-only link
to the historical cleared case and decision, exact retained fact, revision and
conservative resulting ledger. It creates no execution/recovery authority.

They use schema version 1 and exact kind strings. The canonical format is sorted
UTF-8 JSON without escaped slashes. Optional absent values are omitted by the
single Swift codec. Strict decoding re-encodes and compares exact bytes before
semantic validation: unknown/duplicate fields, unknown versions, noncanonical
encodings, truncation, oversized collections and false authorization flags are
rejected, including nested unknown fields. Metadata decoding never calls a
bootstrap or produces an authority object.

Report validation reconstructs obligation states from the exact claim/resource
facts referenced by each entry. A retained observation or a digest belonging to
another obligation cannot establish release. Recovery decisions include their
exact prior ledger and are validated by replaying qualified simulation evidence
and comparing the complete resulting ledger, including its digest chain.

Binding pins story/epic/repository, run/attempt, workflow revision and journal
head, accepted bundle, repository baseline, Phase A job reference, simulated
host/boot/clock epoch, distinct actor identities, nine distinct resource IDs,
synthetic image/binary/input references, RECOVERY-001 version/digest, resource
profile and immutable deadlines. Binary source SHA may be null; a repository SHA
is not controller build attestation. Synthetic pins do not prove that an actual
guest image or binary was inspected or executed. `VMBlob.verify` checks supplied
fixture bytes against size and digest without loading host files.

Integer additions are checked; timestamps and revisions are bounded by
2^53-1. Resources are fixed at one attempt/VM, two vCPUs, 2048 MiB memory and
2048 MiB scratch. These are model limits, not macOS resource enforcement.

## State transitions and independent facts

| Machine | Normal progression | Failure behavior |
| --- | --- | --- |
| Owner | bound → starting → running → stopRequested → stopObserved → exitObserved | blocked/lost never resumes execution |
| Watchdog | bound → armed → monitoring → enforcing → exitObserved → reaped | lost cannot invent reap or replacement |
| VM | notCreated → unknown during creation → allocated → running → stopRequested → stoppedObserved | uncertain creation/loss retains unknown footprint |
| Attempt | prepared → active → settling → finalized | blocked before effects; unresolved with uncertain cleanup |
| Quarantine | absent → active → cleared by committed qualified simulation decision; later qualified contradiction → new linked active case | immutable historical clearance; no TTL, manual clear or automatic replacement |
| Reconciliation | request → validate → stage → receipt commit → projection | rejected requests audited; partial decisions retain full reservation |

Stop requested, stop callback, owner exit, owner reap, VM resource release, disk
release, scratch release, descriptor closure, broker fence and upstream settlement
are separate facts. An opaque observation can credit only its exact resource,
claim, trusted source scope and binding. Normal sources are owner for stop,
watchdog for exit/reap, resource observer for resource/disk/scratch/descriptors,
controller gate for fence, and broker observer for upstream. Recovery observations
use a separately qualified simulation reconciler. None is a native observer.

Invalid/replayed/conflicting events are rejected/audited without deleting history.
Exact duplicate observations are idempotent. Contradictions retain both distinct
payloads, mark the obligation contradictory and quarantine the attempt. Post-final
observations cannot rewrite the original report; recovery uses separate artifacts.

## Deadlines, quarantine and reservations

All deadlines are established before GO from t0:

- boot: t0 + 120000 ms;
- total execution including boot: t0 + 900000 ms;
- escalation: execution deadline + 10000 ms;
- cleanup: escalation deadline + 30000 ms.

Expiration is inclusive (`now >= deadline`). Cancellation may shorten grace and
cleanup, never lengthen them; repetition cannot renew them. Controller, owner and
watchdog losses do not renew time, operations or resources. Simulated sleep is an
advance of the fake clock. Rollback, boot/epoch mismatch and integer overflow
fail closed. Returning to a valid clock does not restore consumed authority.

Owner loss, blocked owner, watchdog loss, uncertain dispatched creation,
contradiction, clock faults and incomplete cleanup preserve possible exposure.
The attempt/resource case creates a host admission hold. There is no automatic
replacement or resource reuse, even using another run ID. Missing cleanup at
the cleanup deadline produces `unresolved`, not PASS.

The broker gate closes before its notification port is called. Notification
failure cannot reopen it. No upstream operation is performed: the fake records
requests only. Cancellation is distinct from upstream completion and does not
establish reversal of work/cost. Qualified no-exposure evidence is recorded only
if no simulated broker request was dispatched.

The corrective F2 policy permits only one simulated upstream dispatch per
attempt, including when that dispatch is unsettled or its acknowledgement is
uncertain. Each obligation records an exposure-intent reference and tick; facts
must match that exact reference and cannot predate exposure. Preminted facts with
no exposure reference are rejected even if the fake clock has not advanced.
These references are metadata bindings, never ownership or execution authority.
R2 additionally requires an opaque per-resource exposure registration in the
trusted bootstrap. The claimed aggregate reserves one generation before calling
the create/broker fake port. Both qualification and consumption check the exact
registration object. A predictable reference and matching/future tick cannot
create registration. Qualification during a reentrant create callback is allowed
because dispatch reservation already exists; uncertain acknowledgement retains
that exposure. There is no second generation or retry within an attempt. Equal
DTOs or a fresh bootstrap have no registered physical/upstream exposure.

Partial reconciliation retains the entire initial reservation. Full qualified
reconciliation publishes a linked decision and releases simulated accounting
only after receipt commit, in a single logical projection. Normal complete
cleanup likewise retains accounting until its final report publication commits.
Neither operation enables another attempt. An unresolved outcome and its
original bytes remain immutable after later reconciliation.

The operational procedure catalog is empty. Only the explicitly named
`cleanup-simulation/1` fixture catalog can issue a one-use permission. It binds
case, execution digest, ledger digest and recovery revision. Evaluation requires
a previously finalized unresolved case, qualified exact-binding proof, no
contradictory obligation, unique claims/IDs and valid observation time. Stale,
cross-attempt, unqualified and consumed-permission inputs are rejected. Manual
notes are audit data only. No defensible proof means indefinite quarantine.

Qualified post-final negative observations are retained separately in bounded
`recoveryObservations`, before checking a clearance permission. They do not
authorize cleanup. A stale permission, reused event ID, rejected foreign fact in
the same batch, in-flight publication or lost acknowledgement cannot hide a valid
exact-binding contradiction. A previously satisfied obligation becomes disputed;
all subsequent clearance is blocked while that dispute exists. Partial credit,
counter-evidence and the original finalized report all remain available. The
negative audit consists of strict `VMReconciliationEvidence` documents; cleanup
decisions continue to accept only positive satisfaction evidence.

An ordinary pending resource observed as retained stays outstanding. It may later
be settled by fresh qualified evidence and a new exact-state permission; this
does not override an earlier contradictory satisfaction credit. Observations
older than the finalized case, from another attempt, without qualified recovery
provenance or with a different exposure reference are rejected and fingerprinted
without being credited. Exact negative duplicates are idempotent. If evidence
quotas prevent further ledger references, the negative audit and disputed state
are preserved and clearance fails closed; quotas never turn uncertainty into
release. No adjudication/override procedure for a genuine dispute is added.

## Publication, interruption and restore

All publication is in memory. It makes no filesystem durability claim.
Bytes are staged and validated, then published, followed by a receipt containing
kind, binding, byte count and digest. Verification requires all of these to
agree. Interruption hooks exist before bytes, after bytes, before receipt and
after receipt/before acknowledgement. A lost acknowledgement after receipt is
recoverable; an incomplete publication never releases accounting.

Finalization freezes the report candidate before publication; callbacks cannot
mutate it. A verified final report is byte-stable and rereads no clock/ports.
Reconciliation retains its candidate and publication after interruption. A
committed decision can be projected/replayed once; replay cannot release twice.
An uncommitted decision remains blocked with its evidence retained. This model
does not implement a discard/retry procedure for an incomplete publication.

Restore imports only verified terminal metadata with matching receipt and exact
binding. Receipt-less, corrupt, truncated or wrong-binding state returns an
explicit incomplete view, a digest of uncertainty and retained accounting.
Even verified terminal metadata cannot resume execution or recreate handles;
host admission remains held. Active-process recovery, durable journals and
re-attachment are not implemented here and do not modify ORCH-002.

Quotas: frame 4 KiB; report 64 KiB; log 64 KiB/128 events; obligations at most 12;
references at most 32; one current case and at most one immutable cleared
predecessor; eight positive reconciliation requests per attempt. One linked
post-clearance dispute has a reserved audit slot; rejected post-clearance inputs
have a separate eight-digest audit, without altering the cleared predecessor.
Ordinary logging is capped at 96 events/48 KiB, reserving 32 events/16 KiB for
failure, fence, quarantine and finalization. Overflow blocks new operations and
never evicts obligations. Repeated faults are deduplicated. If critical evidence
cannot be published, the model refuses successful publication and retains holds.

## Deterministic coverage

Run from the repository root:

```sh
sh tools/orchestrator/native/VMLifecycleQualification/check.sh test
sh tools/orchestrator/native/VMLifecycleQualification/check.sh build
sh tools/orchestrator/native/VMLifecycleQualification/check.sh mutations
```

The script explicitly uses SDK 26.5 and ARM64 deployment target macOS 26.0.
It builds a static model library and an in-process fake test executable. It never
builds a VM backend or workload helper. Its source tripwire is an architecture
regression check, not a security boundary. Root npm commands do not run this
Swift suite; it requires the explicit check above.

Scenario IDs S01–S22 in `Tests/main.swift` cover normal complete cleanup, ignored
shutdown, owner crash/block, watchdog/controller/combined loss, simulated sleep,
owner exit without cleanup, retained scratch, unknown upstream completion, late
evidence, replay, cross-attempt proof, contradiction, partial reconciliation,
replacement/reuse denial, uncertain creation, incomplete restore, manual notes
and fully qualified simulated reconciliation. Assertions include independent
facts, reservations, blocked operations and simulated effect counts.

Additional families: C contracts, A authority, T deadlines, R deterministic
reentrancy, Q quotas and I interrupted publication/recovery. Tests use no real
threads, child fixtures, signals, wait/reap or VMs.

| AC | Positive | Negative | Boundary | Reentrancy/race | Interruption | Mutation |
| --- | --- | --- | --- | --- | --- | --- |
| 01 isolated | architecture test | backend policy reject | file/import audit | N/A static boundary | I06 no runtime restore | M12 |
| 02 fakes only | S01 effects | backend tripwire | R01 one creation | R01–R06 | I05 no fallback | M12 |
| 03 exact binding | C01 | C02/C03/C09/S14 | C02/C04/Q04 | R02/R10 | I06 | M4/M8 |
| 04 deadlines | T01/T02 | T03/T05 | S08/T01/T06 | R03/R05 | S08/I04 | M5/M11 |
| 05 separate owner/VM | S01 | S09 | T06 | R02/R12/R16/R21 | S19 | M1 |
| 06 separate stop/release | S01 | S10/S11 | T06 | R02/R06 | I03/I05 | M9 |
| 07 crash unresolved | S03 | S09 | T04 | R02 | S19/I06 | M1 |
| 08 blocked timeout | S04 | T04 | S08/T06 | R03 | S08 | M2/M11 |
| 09 watchdog loss | S05/S07 | R14 | T04 | R02 | S19/I06 | M3/M8 |
| 10 retained reservations | S16/S22 | S10/S18 | Q01–Q04 | R08 | I03/I05 | M2/M10 |
| 11 qualified reconciliation | S22/R18 | S21/R07/R11/C08 | A02/Q03 | R08/R10/R20 | I03 | M8 |
| 12 no replacement/reuse | S17/S18 | R15 | Q03 | R01/R14 | I06 | M3 |
| 13 no evidence upgrades | S13 | S12/S14/S15/C06/C07 | T06 | R07/R10/R21 | I03/I04 | M4 |
| 14 bounded reports | C01/I02 | C02/C05/C07/C08 | Q02/Q04 | R01/R09 | I01/I03/I05 | M7/M10 |
| 15 adversarial suite | S01–S22 | C/A/T/R/Q/I | T/Q | R01–R21 | I01–I06 | M1–M12 |
| 16 previous modules intact | tracked-diff audit | backend tripwire | eleven-file audit | N/A static boundary | I06 no integration | M12 + unchanged Phase A tests |

AC01/AC16 concern static dependency/file boundaries: they do not have a meaningful
runtime race of their own. The indirect restore checks do not prove an additional
concurrency guarantee. The AC15 row summarizes suite coverage, not an independent
native/security guarantee.

## Mutation protocol

`check.sh mutations` first runs the unmodified suite, then reruns each focused
unmodified control. It creates a temporary source copy, applies exactly one
mutation, compiles it, and requires exit 1 plus a relevant test assertion failure.
A compile failure, trap, timeout or unrelated error is not credited. Source copies
are deleted. Original module and production bytes are never mutated.

| Mutation | Fault | Relevant assertion |
| --- | --- | --- |
| M1 | owner exit credits VM resources | S09 |
| M2 | timeout clears quarantine/reservation | T04 |
| M3 | unresolved permits replacement | S17 |
| M4 | ignore qualified-observation binding/issuer checks | S14 |
| M5 | controller loss extends cleanup | T02 |
| M6 | failed notification reopens gate | R04 |
| M7 | receipt installed before completed publication | I01 |
| M8 | consumed permission accepted again | A02 |
| M9 | stop callback credits scratch release | S10 |
| M10 | quota treats outstanding obligations as satisfied | Q01 |
| M11 | deadline uses > rather than >= | S08 |
| M12 | production-integration policy declared enabled | architecture test |
| M13 | discard qualified negative recovery evidence | F1-A |
| M14 | allow upstream re-exposure | F2-C |
| M15 | ignore exposure-bound credit validation | F2-E |

M12 deliberately simulates the prohibited capability configuration; it never
connects or imports an operative backend and never edits Phase A. The source
tripwire and unchanged tracked-file audit complement this policy assertion.

## Original Checkpoint B validation evidence

The fake test suite includes 94 tests, including every S01–S22 scenario. Local
test-first cycles included four lifecycle regressions and four contract/order
regressions failing before their corresponding corrections. The first typecheck
attempt used the compiler's denied default cache; selecting the writable ignored
cache allowed the explicitly selected SDK/toolchain build to proceed.

Safe prior suites passed: B0.2A-1 54, Gate 2A 76, Gate 2B-2A 97 and Gate 2B-2C
80 tests. The existing Gate 2A script compiled its compile-only helper but never
executed it. All executions were ordinary in-process fake tests, not host-process
qualification experiments. Existing entitlements/configuration were not edited.

The safe TypeScript subset passed 37 tests:

```sh
npm run test -w @coffee-break/orchestrator -- test/designer/contracts.test.ts test/designer/artifacts.test.ts test/designer/admission.test.ts
npm run typecheck
npm run lint
npm run build
```

Root typecheck and build passed. Lint passed with two unused eslint-disable
warnings in the existing generated desktop renderer bundle, no errors. Full
`npm test`, native security probes, HP/Q2, VM boots and live provider/agent tests
were not run. Passing root npm checks does not qualify this Swift runtime.

During mutation-run development, an initial M10 variant trapped after removing
ledger rows. It was explicitly not credited. The definitive mutation retains
the structural rows but erases pending obligations by treating them as satisfied;
Q01 detects this with an immediate relevant assertion. No assertion was disabled.
The definitive runner requires a passing control and assertion-based failure for
every mutation; compile errors or traps cannot count as detections.

## F1/F2 corrective-pass evidence

The corrective pass changes only `Sources/Lifecycle.swift`, `Sources/Ledger.swift`,
`Sources/Reconciliation.swift`, `Tests/Fixtures.swift`, `Tests/main.swift`,
`check.sh` and this README. Authority, Contracts, Evidence and Quarantine Swift
files remain byte-identical to the reviewed inventory. No tracked/staged file or
other module changed. The fixture change supplies the exposure reference from
the actual simulated ledger instead of inventing one; this also lets tests
capture and reject pre-exposure facts at the same clock tick.

F1 root cause: negative recovery evidence was rejected by the positive-only
clearance path before its effect on earlier credit was recorded. Remaining
positive proofs could therefore clear a ledger that still treated scratch as
released. Safety observation ingestion is now distinct from clearance approval;
qualified contradictions update the recovery audit, obligation, case digest and
revision before a clearance request can proceed. The final attempt report is
never edited. Publication candidates with an obsolete revision cannot apply.

F2 root cause: dispatch changed exposure to possible without consuming a one-shot
exposure slot or binding the old credit to the operation. Credit also lacked an
exposure prerequisite. Dispatch now requires an unused slot; credit validates
the recorded exposure reference and tick both on ingestion and during report
validation. Rejected dispatches have no simulated effect and do not erase prior
evidence. Complete cleanup for one genuinely dispatched request is still valid;
a nonexistent second request is not silently accepted.

The updated suite passes **114 tests**, including all original S01–S22 scenarios
and twenty F1/F2 regression cases. All M1–M12 plus M13–M15 are detected with passing
unmodified controls and compiled, assertion-failing mutants. Temporary mutant
sources are deleted; original Swift bytes are checked before/after the run.

| Regression | Coverage |
| --- | --- |
| F1-A | Exact reviewer sequence: no clearance/release after partial-credit contradiction |
| F1-B | Contradiction against an existing credit before partial recovery |
| F1-C | Stale permission cannot suppress a current qualified fact |
| F1-D | Duplicate and reused-ID facts retain distinct history idempotently |
| F1-E | Stale observation rejected without cleanup credit |
| F1-F | Cross-attempt negative cannot dispute this attempt |
| F1-G | Contradiction before receipt invalidates candidate clearance |
| F1-H | Lost-acknowledgement replay cannot release after contradiction |
| F1-I | Full ledger-reference quota cannot leave disputed credit usable |
| F1-J | Unqualified negative is rejected and audited |
| F1-K | Foreign evidence in a batch cannot mask valid counter-evidence |
| F1-L | Pending retained resource can later settle without overriding a dispute |
| F2-A | Broker settlement cannot cover a rejected second exposure |
| F2-B | Precreation scratch credit cannot produce completed/PASS |
| F2-C | Pending duplicate and unsettled re-dispatch rejected |
| F2-D | Uncertain acknowledgement and stale settlement retain obligations |
| F2-E | Premature/same-tick preminted scratch facts rejected |
| F2-F | Same-tick preminted upstream settlement rejected |
| F2-G | Duplicate and uncertain VM creation cannot recycle credit |
| F2-H | Correct reference with pre-exposure timestamp rejected |

AC-10 retains complete reservations under dispute (F1-A/B/I, F2-B/D); AC-11
separates factual counter-evidence from clearance authority (F1-C/F/J/L);
AC-13 retains/rejects duplicate, stale, foreign and contradictory evidence
without upgrading final outcomes (F1-D/E/G/H/K, F2-E/F/H); AC-15 adds the twenty
regressions and three targeted mutants without dropping existing tests.
All of these assessments concern the simulation only.

Rerun results: prior native fake suites 54/76/97/80 PASS, safe Designer contracts/
artifacts/admission 37 PASS, root typecheck/build PASS, root lint PASS with the
same two generated desktop warnings. The first lint invocation overlapped build
and failed with ENOENT on a transient `electron.vite.config.*.mjs`; its log is
retained, and lint passed after build finished without configuration changes.
The corrective pass's logs are already-ignored `dist/native-d1a/corrections-*`.
The original Checkpoint B logs and historical limitations are retained.

## R1/R2 second corrective pass — differential evidence

Baseline reverified before editing: the same branch/HEAD/tree above, eleven
untracked module files, no tracked/staged changes. All eleven hashes matched the
previous F1/F2 handoff. A two-test red run reproduced both review findings with
114 existing tests PASS and R1-A/R2-A FAIL (`r1r2-before.log`). A second disposable
original-byte replay reproduced R1 as cleared/released/satisfied with zero
retained facts, and R2 as `completed/PASS` without fresh scratch observation
(`r1r2-original-reproduction.log`). No original/working Swift source was mutated.

**R1 root cause:** `reconcile` required an active quarantine before ingesting
qualified negative observations, discarding them after applied clearance.
Safety ingestion now precedes that guard. A valid post-clearance retained fact
creates one `VMPostClearanceDispute`, containing the immutable cleared case and
clearance decision, the original report digest, the exact qualified fact,
clearance tick, new case identity/revision and disputed ledger. Validation
replays the ledger transition and checks attempt/host/resource/exposure binding.
Stale facts predating clearance and foreign/unqualified facts cannot reopen it.

The new case registers its own host-scope hold and restores the entire resource
reservation before fallible publication. The earlier host hold was already
conservative and is never lifted; this change adds explicit new-case attribution.
Historical `accountingReleases` remains one; `accountingReinstatements` increments
once. The original report, cleared-case snapshot, recovery decision and receipt
are byte-stable. Identical negative duplicates do not change revision, holdings,
publication or accounting. No new clearance procedure for contradictory facts
is introduced. Quota exhaustion preserves the full negative audit and disputed
resource, even when the ledger has no room for another reference.

The linked document uses the existing receipt-last simulated publisher. All four
publication interruptions retain the live case, qualified fact and reservation;
only a committed receipt permits verified export. Incomplete publication cannot
be reinterpreted as success or retried to clear the case. Simulated restore may
validate the linked document alongside the original terminal report, retaining
holds even when the link is missing/corrupt. It returns passive metadata only.
R1-F first imports that passive view, then uses the still-existing trusted root
to submit a new observation and verifies the new exported dispute in another
passive view. It does **not** demonstrate restart of an active aggregate, durable
filesystem recovery or reconstruction of observation/reconciliation authority.

**R2 root cause:** qualification previously checked only fact metadata; a caller
could predict the deterministic creation reference and mint a proof at the same
tick before exposure. `VMGrant.register` now reserves opaque exposure identities
from the pinned binding before external fake calls. `qualify`/`qualifyRecovery`
require a matching existing registration; consumption checks its reference
identity again. Timestamps, digests, decoded ledgers and newly issued grants
cannot register physical exposure. There is one registration per claim/attempt,
no native custody claim and no retry or later generation in the same attempt.

| New regression ID | Coverage |
| --- | --- |
| R1-A | Exact post-clearance counterexample restores active quarantine/full reservation |
| R1-B | Duplicate idempotence, new host-case hold, immutable report/decision/receipt |
| R1-C | Stale after clearance, foreign, unqualified and mismatched exposure inputs |
| R1-D (four points) | Dispute publication interruption and lost acknowledgement retain holds |
| R1-E | Lost clearance acknowledgement, apply once, then qualified contradiction |
| R1-F | Passive restore, linked evidence, corrupt/missing receipt, foreign link; no authority |
| R1-G | All 32 ledger refs used at clearance; reopening still retains negative evidence |
| R1-H | Strict dispute contract, host/revision/exposure tampering, no new clearance |
| R2-A | Predicted exact-reference/same-tick qualification rejected before exposure |
| R2-B | Exact future tick/reference rejected for ordinary and recovery proof; fresh control |
| R2-C | Cross-attempt/resource registration and legitimate immediate qualification |
| R2-D (two responses) | Reentrant qualification sees reserved exposure; uncertain creation remains held |
| R2-E | Old proof cannot cross opaque generation/root; no redispatch or terminal reuse |
| R2-F | Decoded binding/ledger and new grant cannot create exposure registration |

The original 114 tests are preserved, including S01–S22, F1-A–L and F2-A–H.
A01 and F2-D/E/F now assert earlier rejection at qualification and still exercise
foreign-root, stale/missing-reference and uncertain-dispatch behavior. F2-C/E
also verify the independent ledger validators used by DTO decision replay, so
additional qualification defenses cannot mask M14/M15.

| New mutation | Fault | Relevant assertion |
| --- | --- | --- |
| M16 | Skip post-clearance dispute path | R1-A |
| M17 | Omit new case's host admission hold | R1-B |
| M18 | Mint observation without checking registered exposure | R2-A |
| M19 | Fabricate registration from predicted reference/tick | R2-B |

AC01–09 preserve the original matrix above. AC10 adds R1-A/B/D/G and R2-D for
retention/reinstatement; AC11 adds R1-C/E/F/H and R2-A/B/F for qualified evidence
without new authority; AC12 adds R1-B and R2-E for denied replacement/reuse;
AC13 adds R1-B/C/D/E and R2-A–F for identity, timing and immutable history;
AC14 adds R1-B/D/F/G/H for the bounded strict linked document; AC15 adds the
18 regression cases and M16–M19, retaining all previous mutants. AC16 still
requires the unchanged tracked/staged audit and Phase A deny tests. Every PASS
in this matrix concerns simulation/static scope only; no native guarantee is
upgraded. Final command results and all eleven hashes are supplied in the handoff.

Final validation: 132/132 D1-A tests PASS (114 preserved + 18 new), M1–M19
19/19 compiled mutants detected by relevant assertions, SDK 26.5 / deployment
macOS 26.0 / ARM64 build PASS. Prior fake suites passed 54/76/97/80 tests;
safe Designer contracts/artifacts/admission passed 37 tests. Root typecheck,
lint and build PASS. Lint retained two generated-bundle unused eslint-disable
warnings, zero errors. The first new-suite compile failed on one missing `try`,
and intermediate test runs exposed incorrect fixture sequence/terminal-error
expectations; these were corrected without changing production behavior to
accommodate tests. The final unmodified suite and every mutation control pass.

Validation artifacts use the ignored `dist/native-d1a/r1r2-*` prefix. Mutation
copies are disposable and the runner checks actual Swift bytes before/after each
mutation. Lint and root build are run sequentially. No full `npm test` or native
security probes are run, because this assignment authorizes only safe subsets.

**Differential reviewer handoff:** inspect safety ingestion before the active-case
guard, immutable predecessor linking and exact revision/tick checks, conservative
projection before receipt publication, the separately attributed host hold and
once-only accounting, qualification-time registry checks and opaque generation
consumption. Confirm old F1/F2 coverage and M1–M19 remain effective. Serialized
fake callbacks and memory-only receipts do not qualify real concurrency, durable
journaling, host ownership, disk release, VM containment or any native process.

## Remaining qualification blockers

- Apple DTS describes expected cleanup after owner termination, not a guaranteed
  deadline or public external completion handle. Simulation reconciliation does
  not demonstrate that equivalent native proof exists.
- The historical macOS 26.6 stop/attachment limitation remains: a stop callback
  alone does not establish complete disk release.
- `mach_continuous_time` remains a clock candidate; no native watchdog scheduling,
  sleep/wake enforcement or deadline guarantees were qualified.
- Authenticated native ownership, process termination, wait/reap, orphan cleanup,
  VM isolation and provider-broker enforcement remain unqualified.
- Plugin/MCP isolation, ORCH-001 readiness limitations, ORCH-002 AC-06 PARTIAL
  and historical Gate 1 provenance gaps remain unchanged.
- No successor cleanup API, reboot assumption, operator override or automatic
  retry/replacement is invented. Indefinite host blocking is an accepted model
  consequence when qualified evidence is unavailable.
- Independent review and Planner/PO acceptance remain required. This checkpoint
  grants no publication, merge, Designer, D1-B/D1-C, Q2/HP or ORCH-005 authority.
