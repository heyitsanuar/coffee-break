# Gate 2B-2C — Emergency capability lifecycle model

Local, isolated, fake-backed ORCH-004 research component. Implementation awaits independent review and Planner/PO acceptance. It is not linked into the CLI, application, previous native models or Phase A admission.

Every report declares `mode=simulation`, `authorization=none`, `allowNativeLaunch=false`, `nativeEnforcement=unverified`. A simulation PASS confers no execution authorization. HP-01, Q2 and native qualification remain blocked.

## Baseline and scope

Verified before editing:

- Local branch `codex/orch-004-phase-a-preparation`, HEAD `58867bdf53144f4d947f62b87f28cd39028f97b2`, tree `ceb4e506316acf294daa0fc066c49ddabdb93030`; initially clean.
- GitHub main `400ec60b072556c6ffa819f81e390c1c57af2909` has the same tree; PR #111 is merged and includes the approved local HEAD. No checkout, reset or rebase was needed.
- Phase A's `denyAdmission` still emits `deny`, `allowLaunch=false`, `authorization=none`.
- Gate 2B-2B research identifies the SDK-private-interface warning, the broader authority of a real task-control right, and separate R emergency custody / G wait ownership. These are research constraints, not native qualifications.

Exactly eight new files in this directory; no existing files changed:

| File | Responsibility |
| --- | --- |
| `Contracts.swift` | Closed versioned metadata, bounded canonical codec, identities, clock and result types |
| `Authority.swift` | Opaque grant, designated holder and creation objects, qualified simulation bootstrap, one issuance and use budget |
| `Lifecycle.swift` | Serialized control state, injectable operation/observation ports, independent participant loss, frozen terminal report |
| `Reconciliation.swift` | Exit and rightful reap accreditation, contradictory facts, descriptors and cause correlation |
| `Evidence.swift` | Separate derived outcomes, strict report validation and interrupted in-memory publication |
| `Tests/main.swift` | Deterministic in-process fakes, positive/negative, boundary, race and interruption cases |
| `check.sh` | Explicit SDK/target compilation and fake tests only |
| `README.md` | Design, validation evidence and unresolved guarantees |

## Threat model and trust boundary

Untrusted inputs include serialized reports, helper claims, numeric identifiers, stale scope metadata and contradictory observations. None can issue authority. No raw helper bytes are retained. Reports contain only bounded metadata, fixed enums and references to input digests; never credentials or native handles.

The trusted simulation root consists of the injected clock, qualified bootstrap, designated holder/creation objects, operation port and observation port. These are ordinary Swift objects controlled by the test harness. They do not authenticate a real kernel emitter or process. A hostile host caller replacing these trusted objects is outside this model's boundary. There is no OS-enforced isolation here.

There is no network, filesystem, native process-control or IPC adapter. Source tripwires supplement review; they are not security enforcement. The build shell writes ignored artifacts and invokes the compiler and fake-test executable. It does not execute an experimental helper.

## Binding, provenance and custody

`emergency-capability/1` binds experiment/session/request/boot, plan SHA-256, source revision, issuer/holder/wait-owner binary identities, S incarnation/object/binary, operation, deadline, budget and evidence references. Issuer, R, G and S have distinct instance identities. Metadata is canonical JSON with strict version/shape/size checks; unknown, duplicate and noncanonical fields are rejected on decode.

The injected `SimulatedCapabilityBootstrap` is explicitly simulation-only. Its grant has a file-private constructor and no serialization conformance. Issuance requires qualification and completeness, exact provenance origin, issuer, R, scope digest, and agreement among simulated kernel emitter, task object and creation target. The exact holder and creation object references must also match. An attempt is one-shot, including failed issuance. Both the opaque grant and designated creation object reject repeated issuance across lifecycles/bootstraps sharing that trusted creation.

Custody uses exact object identity, not equality of serialized UUIDs. There is one designated holder, no transfer or duplication operation, and no reconstruction API. Creating a new qualified fake world is a new trusted harness operation; persisted metadata cannot create that world. A simulated port number is an unused observation field and never a lookup key. A PID or Mach port integer identifies neither authenticated ownership nor a reusable authority. Stale numbers cannot revive a revoked grant or retarget it.

The application-facing simulation exposes only a bounded termination request and right release. It does not demonstrate attenuation of a real Mach task-control right, which grants substantially broader authority. Releasing a simulated right does not revoke leaked native copies or establish global native revocation.

## Lifecycle and races

- Establish, validate, then admit simulated GO; missing, incomplete, expired or invalid provenance cannot admit GO.
- One immutable 8,000 ms capability window, one request. The clock is injected; rollback, boot mismatch and wake-generation changes fail closed. This is a conservative model, not a qualified native monotonic clock or sleep/wake guarantee.
- Scope/custody/freshness checks and budget reservation precede the operation. No retry, target switch, authority renewal or fallback exists.
- Revocation prevents new use immediately. An already-issued injected operation cannot be retroactively withdrawn. Revocation/holder loss or expiry during it preserves the actual API response and a persistent failure finding.
- State is protected by one lock. External termination, release and observation calls run outside it, allowing deterministic reentrant crossing tests. The trusted bootstrap and clock getters must not reenter. The model has no asynchronous worker, scheduler or automatic loop; injected calls must return, so it does not prove hang cancellation or native wall-clock enforcement.
- C loss cannot renew the deadline. G loss leaves R's capability independent but cannot invent a reap owner. A reap already accredited before G loss remains supported historical evidence.
- R loss disables R's capability; G retains its separate creation/wait responsibility. S disappearance disables use without inventing exit, cause or reap. Simultaneous R/G loss cannot recover authority from a report.
- Exit, forced/normal classification, accredited reap, cause correlation, right release and descriptor closure remain separate facts. Reap accreditation requires the exact trusted G creation object and live G at accreditation. A lookalike object with equal metadata fails. A normal reap racing a response remains ambiguous. Contradictions preserve prior facts and fail the experiment.

An accepted API response alone never proves exit. Exit alone never proves reap. Simulated cause corroboration requires an accepted response, forced exit and exact request reference from the trusted observation port. It is fake correlation, not native causality proof. Complete cleanup requires matching independent exit/reap plus explicit right release and descriptor closure. Missing exit or reap yields UNRESOLVED; known exit/reap with incomplete release yields partial cleanup. No global PASS is possible with either. Missing cause can leave a fully cleaned simulation UNVERIFIED.

## Evidence contract and bounds

`emergency-capability-report/1` publishes historical establishment/validation/GO, scope/provenance, revocation status, consumed budget, request/API response, C/R/G/S loss, separate observations, findings and events. `cleanup`, `emergency` and `verdict` are encoded but always re-derived and compared on decode. Reports are evidence only; there is no report-to-authority path.

Limits: binding 4,096 bytes; helper claim 4,096 bytes; canonical frame/report 65,536 bytes; 1–8 unique sorted evidence digests; 96 fixed-enum events; a deduplicated finite findings set; one issuance attempt and one emergency operation. Bound exhaustion is retained as FAIL and blocks new operation use. There is no internal retry or unbounded retention. Caller-driven cleanup observations remain possible after a failure; they cannot erase it.

`CapabilityPublication` models publication in memory. Valid final bytes are staged first; their digest marker is installed last. Interruptions before bytes or after bytes throw `interrupted`; verification requires the marker and matching bytes and throws `incompleteEvidence` for incomplete publication. A valid uninterrupted positive control uses identical evidence. This is not durable filesystem publication, transactional persistence or native crash qualification.

`finish` refuses pending calls, then freezes the entire terminal report. Later mutations fail; reading/finalizing again does not consult changed ports or clocks. PASS/FAIL/UNVERIFIED/BLOCKED describe this simulation only.

## Validation performed

Toolchain: macOS ARM64, Swift 6.4, explicit SDK `MacOSX26.5.sdk`, target `arm64-apple-macosx26.0`. The generated fake-test Mach-O reports SDK 26.5 / minimum macOS 26.0; strict signature verification passed. No dependencies added.

| Check | Result |
| --- | --- |
| `sh .../EmergencyCapability/check.sh test` | 80 passed, 0 failed; static module/library and fake executable built |
| `sh .../HostProcessQualification/check.sh test` | 97 passed, 0 failed |
| `sh .../HostQualification/check.sh test` | 76 passed, 0 failed; existing helper compiled only, never executed |
| `sh tools/orchestrator/native/check.sh test` | 54 passed, 0 failed |
| Safe orchestrator contracts/capabilities/Designer admission/CLI tests | 18 passed across 4 files |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm run lint` after build completed | Passed, two generated-bundle unused-disable warnings |

The first lint invocation ran concurrently with build and exited 2 on ENOENT for a transient Vite configuration `.mjs`. A sequential rerun after build passed. No code/configuration change was made to suppress it. The warnings are at generated `createOfficeGame-ujkITRew.js:115516` and `:115533`.

Full process/security fixtures and full root `npm test` were not run: those would exceed this assignment's fake-only execution scope. Root build/typecheck/lint do not qualify Swift runtime security.

Five mutations compiled and ran only in disposable copies. Each was detected by failing assertions (exit 1, not a compile failure); the unmodified disposable control passed all 80 tests (exit 0):

| Mutation | Detecting cases |
| --- | --- |
| Permit revoked authority use | Reused port / revoked capability; revocation before GO |
| Credit reap after G loss | G loss; simultaneous R/G loss |
| Treat accepted API as complete cleanup | Missing reap, reap alone, partial right/descriptor cleanup, unavailable observations |
| Publish marker before interruption completes | Exact `incompleteEvidence` assertion after bytes interruption |
| Ignore exact invocation scope | Wrong session/request/boot/incarnation/binary/plan |

All disposable copies were removed; repository source hashes were unchanged by mutation testing. Initial test-first validation failed at compilation before model sources existed; the full implemented suite now passes. Logs are local temporary validation artifacts, not native qualification evidence.

## AC mapping (implementation evidence, pending independent acceptance)

| AC | Scoped result and evidence |
| --- | --- |
| 01 | Implemented: eight isolated additions; no production imports or integration |
| 02 | Implemented: only fake ports; source tripwire and review; no native backend |
| 03 | Implemented: versioned exact binding; closed-contract and scope negatives |
| 04 | Implemented: qualified bootstrap, mismatched provenance and incomplete-bootstrap tests |
| 05 | Implemented: non-Codable opaque custody, same-metadata holder and helper/report forgery tests |
| 06 | Implemented: one-use reservation, revocation, exact expiry, clock and in-operation crossing tests |
| 07 | Implemented: issuer/holder/target/scope mismatches, grant and creation replay, reused-port tests |
| 08 | Implemented: default unavailable bootstrap/operation, no fallback or retry after API denial |
| 09 | Implemented: independent C/R/G/S and simultaneous R/G loss tests |
| 10 | Implemented: separate request/response/exit/reap/cause/release facts and owner accreditation |
| 11 | Implemented: unresolved/partial cleanup blocks PASS; mutation sensitivity confirmed |
| 12 | Implemented: 80 deterministic cases, five detected mutations, publication positive control |
| 13 | Verified build: ARM64 / SDK 26.5 / deployment macOS 26.0 |
| 14 | Verified: prior regression suites pass; tracked files and Phase A unchanged |
| 15 | Respected: no commit/push/PR/merge or GitHub mutation |
| 16 | Documented below; native guarantees explicitly UNVERIFIED |

## Unverified native guarantees and blockers

No native capability acquisition, kernel provenance, task identity binding, custody transfer, restricted operation, revocation, deadline enforcement, termination, wait/reap, descriptor closure or leak/orphan cleanup has been qualified. There is no supported native API decision. SDK declaration of the audit-token signal candidate is insufficient because its header warns about private interfaces. The real task-control right remains a research candidate with excessive authority.

G disappearance still leaves reap unresolved unless supported evidence already exists; R's potential emergency authority alone cannot reap S. The historical full Gate 1 report/provenance gap remains unresolved: no missing historical artifact or result is invented here. VM containment, credentials, plugin/MCP restrictions and Designer execution remain unqualified. ORCH-001 diagnostic limitations and ORCH-002 AC-06 lock limitation remain unchanged.

Phase A remains unconditionally denied. HP-01/Q2, real helpers, real signals/wait/reap, launchd, VMs, Codex/agents/inference, later increments and ORCH-005 were not executed or started. Independent Reviewer assessment and Planner/PO acceptance are required before any next assignment; this module grants none of them.
