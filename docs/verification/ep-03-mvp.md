# EP-03 — Integrated Local Event MVP verification

## Purpose and revision

US-018 ([issue #36](https://github.com/heyitsanuar/coffee-break/issues/36)) produces evidence for the approved [EP-03 plan](../../planning/ep-03-issues.json). It introduces no application features. Independent review of the verification additions passed with no HIGH, MEDIUM, or LOW findings. Maintainer approval is pending; this report does not declare EP-03 complete.

- Authoritative implementation baseline / branch HEAD: `a232059ed218464ab1907efb54df2e5485b24857`.
- Branch: `feature/us-018-integrated-local-event-verification`.
- Automated/runtime verification date: 2026-09-28, America/Mexico_City. Native evidence follow-up recorded 2026-09-29 from the user/Architect implementation follow-up.
- Tested working-tree addition: `apps/desktop/src/office/localEventIntegration.test.ts`, SHA-256 `f26b26357a22a248af3c60840688ed4a500145600065d2cd1b416634540dbcdf`.
- Runtime source, contracts, dependencies, security settings, and simulator timing are byte-for-byte the baseline. The other addition is this report. The reviewed additions were uncommitted at report preparation; commit and PR provenance are recorded externally during finalization.
- Environment: macOS 26.2, arm64; host Node.js 22.23.2, npm 10.9.8; Electron 37.10.3; Vitest 3.2.7. This is development verification, not a packaged release test.

Final PR-head CI must identify the eventual commit externally. The independent Reviewer passed the reviewed working-tree additions; this report does not attempt to record the SHA of a commit containing itself.

## Evidence provenance

| Category | Evidence and limits |
| --- | --- |
| Automated unit/regression | Existing contract, protocol, ingress, IPC, preload, store, presentation, scene-mount, and controller suites, rerun below. Their controlled clocks, children, and game doubles do not prove native visual behavior. |
| Joined Node integration with Electron-boundary fakes | Four new cases exercise real sockets, LocalIngress, SimulatorClient, main IPC handlers/projection, preload API, renderer store/reducer, and presentation derivation. Only Electron IPC/WebContents wiring is faked; the existing scenario clock injection advances scripted events deterministically. This is not native Electron E2E. |
| Actual integrated Electron runtime | Developer launched all three repository commands. The simulation/recovery diagnostics below came from those real launches and real simulator children. Logs prove accepted delivery, not the appearance of pixels or inspection text. |
| Native pointer/keyboard observation | Codex could not obtain native Computer Use access: the tool reported `Computer Use permissions are not granted`. No Developer native interaction is claimed. |
| User-assisted native observation | In response to the exact checklist below, the maintainer answered **“I can confirm all of these.”** This confirms selection during Mina's updates, keyboard/focus, reload, and the minimum-window observations. The 2026-09-29 user/Architect follow-up additionally confirms PASS for the five startup/final-state/recovery/native-Quit checkpoints recorded below. All native confirmations are attributed to the user, not to Developer automation. |
| Process-level cleanup | Developer recorded main/child PID relationships and TCP ownership before and after stopping verification-owned terminal runs. These SIGINT observations are distinguished from graceful native Quit. |
| Source inspection | Architecture, security, timing, accessibility semantics, and ownership are traced to existing source below. Source does not establish a screen reader announcement. |
| Offscreen renderer | Not used for this verification. No offscreen or native screenshots were created. |
| Unverified limitation | Screen-reader announcements, native React remount instrumentation, and exact runtime scheduler timings were not measured. Actual screen-reader announcements remain UNVERIFIED; this is an accepted limitation that does not by itself block EP-03. |

The user-assisted checklist confirmed:

1. Run `npm run dev:simulated`, select Mina immediately with the mouse, and observe selection persisting while inspection changes to Working / Reviewing the change, then Completed / Review complete.
2. Observe visible Tab focus and supported keyboard selection.
3. Reload and observe current trusted state/status with one office canvas.
4. At a 760 × 540 window, observe readable inspection/status, usable scrolling, and no horizontal overflow.

No user screenshot, stopwatch record, screen-reader result, listener instrumentation, or hidden-state observation was supplied. Confirmation is limited to the requested observations.

## Event flow and boundaries

The separate development simulator sends authenticated JSON Lines over loopback TCP. Electron main validates framing/envelopes/payloads, deduplicates by Connector identity and event ID, and owns the current-state mirror, revision, and session. Main projects accepted state into fixed IPC channels; sandboxed preload exposes only `coffeeBreak.agentState.watch`. One renderer store/reducer owns agent and connection data. A pure presentation adapter feeds React inspection and the existing Phaser game.

Source references:

- [Architecture responsibilities and state ownership](../architecture/README.md), especially state ownership, ordering, deduplication, and security sections.
- [Transport rules](../architecture/local-transport.md) and [development simulator/recovery](../architecture/local-simulator.md).
- [Ingress](../../apps/desktop/electron/ingress/localIngress.ts), [protocol](../../apps/desktop/electron/ingress/protocol.ts), [IPC](../../apps/desktop/electron/agentStateIpc.ts), [preload API](../../apps/desktop/electron/agentStatePreload.ts).
- [Renderer store](../../apps/desktop/src/agentState/store.ts), [reducer](../../apps/desktop/src/agentState/reducer.ts), [presentation](../../apps/desktop/src/office/officePresentation.ts), [React host](../../apps/desktop/src/office/OfficeSceneHost.tsx).

Security settings remain `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false` in `electron/main.ts:18`. Authentication credentials remain main/child-owned; no token, private endpoint, raw IPC primitive, filesystem, shell, or socket capability is added to renderer access. The report contains no live credentials or endpoint values. Localhost Vite development serving is separate from the authenticated Connector ingress.

## Joined positive and negative evidence

The new [joined integration test](../../apps/desktop/src/office/localEventIntegration.test.ts) is in the renderer TypeScript test context. Importing the presentation adapter from an Electron-side test applied NodeNext rules to existing renderer imports; using the existing renderer/Bundler context avoids any production source or configuration change. The original `electron/simulator/integration.test.ts` remains unchanged.

The positive case (`localEventIntegration.test.ts:81`) starts the real watch before ingress startup, authenticates the real simulator, synchronizes the complete three-agent snapshot, and asserts connected/current-session synchronized renderer state at revision 1. All three initial lifecycle/activity pairs are compared with the real simulator fixture. Mina's generic waiting presentation remains waiting. Scripted Ari and Mina transitions reach the store and derive working presentation/activity.

The same case sends a valid duplicate of Ari's accepted event ID with a different error/activity payload. Mina's next scripted event is a same-socket ordering barrier. Renderer and main remain at revision 3, Ari retains the accepted working activity, and Mina receives the legitimate update. Thus the duplicate cannot silently add a revision or replace Ari's data. The existing real simulator/ingress case separately covers all five transitions; the joined test does not repeat that entire matrix.

The three negative cases (`localEventIntegration.test.ts:122`) start from genuinely synchronized agents:

| Input | Observed rejection | Trusted renderer consequence |
| --- | --- | --- |
| Unauthenticated hello with a wrong token | `authentication_failed`; stranger socket closes | Existing session stays connected; agent data and revision unchanged. |
| Authenticated event with invalid fields | `invalid_fields`; active socket closes | Disconnected and unsynchronized, with previous agents and revision retained. |
| Authenticated 16 KiB + 1 byte frame | `frame_too_large`; active socket closes | Disconnected and unsynchronized, with previous agents and revision retained. |

Socket close is awaited before checking consequences. Legitimate protocol-rejection connection changes are allowed; no accepted agent-state update is allowed. Preload listeners are removed during test cleanup. This is representative AC-05 coverage, supplemented by the existing protocol/ingress rejection matrix, IPC caller/projection tests, and reducer stale-session tests.

## Runtime modes and sequence

Developer exercised `npm run dev`, `npm run dev:simulated`, and `npm run dev:simulated:recovery`. A pre-existing user development session occupied Vite's default port, so the Developer-owned launches selected another available development port. Existing user processes were not terminated or repurposed.

### Ordinary startup

`npm run dev` built main/preload and started Electron successfully. Process inspection of the owned main showed Electron helper processes and no separate simulator child. The Developer could not read its native status text. Source and the startup-deadline tests establish an initially empty store, Connecting, then disconnected availability after five seconds without closing the watch; a later complete trusted snapshot can restore availability.

**User-assisted native checkpoint 1 — PASS.** Using `npm run dev`, the user confirmed the initial “Connecting to local simulation…” status, then approximately five seconds later “Disconnected · Local simulation unavailable,” no fabricated agent lifecycle/activity values, and a usable application. These observations were supplied in the 2026-09-29 follow-up; they were not inferred by Codex from a successful process launch.

### Stable simulation

The actual launch emitted `snapshot_accepted`, then `event_sim-001` through `event_sim-005` in order. Its separate child remained connected after the sequence; TCP inspection found a main-owned listener, a main accepted connection, and the child connection, all with empty queues at inspection. No further event was logged before stopping the run.

| Scenario point | Authoritative unchanged agent state/activity | Evidence |
| --- | --- | --- |
| Complete initial snapshot | Ari idle / Ready for a task; Mina waiting / Waiting for changes; Sol working / Finishing a task | Existing real socket integration and new joined snapshot assertions; actual runtime snapshot diagnostic. |
| +1 s | Ari working / Implementing the change | Existing deterministic/real transport tests and joined presentation assertion; actual runtime event diagnostic. |
| +2 s | Mina working / Reviewing the change | Joined presentation assertion, actual runtime event diagnostic, user-assisted native inspection/selection confirmation. |
| +3 s | Sol waiting / Taking a coffee break in the simulated office | Existing scenario/transport and presentation tests; actual runtime event diagnostic. User confirmed final Waiting/activity text and persistent coffee-break presentation (not a stopwatch observation of the +3 s transition). |
| +4 s | Ari completed / Change implemented | Existing scenario/transport/presentation tests; actual runtime event diagnostic. User confirmed final Completed / Change implemented (not a stopwatch observation of the +4 s transition). |
| +5 s | Mina completed / Review complete | Existing scenario/transport/presentation tests; actual runtime event diagnostic; user-assisted native inspection confirmation. |

**User-assisted native checkpoint 2 — PASS.** Using `npm run dev:simulated`, the user confirmed the final Ari Completed / “Change implemented,” Mina Completed / “Review complete,” and Sol Waiting / “Taking a coffee break in the simulated office.” Sol remained in the coffee-break presentation and the connection remained Connected after scripted events ended. This is user-supplied native observation, separate from the Developer delivery diagnostics.

Offsets are the unchanged scripted schedule, not stopwatch measurements of native rendering. Only Sol's exact waiting/activity fixture maps to coffee; generic waiting does not. This rule is established by `officePresentation.ts` and its nine tests, not by inventing a new lifecycle state.

### Recovery

The actual recovery launch logged: first snapshot; five events; `child_exited`; replacement snapshot; five events again. Process inspection recorded one main, first simulator child, then a distinct replacement child. An additional 18-second monitor of that main's simulator children saw only the replacement and no third child. Its connection remained established, while the old child no longer owned TCP resources.

Source `simulatorController.ts:120` and the six recovery tests establish the bounded sequence: two-second delay, confirmed child termination and disconnect, two-second delay, then one replacement with a one-second snapshot delay. Exact runtime transition timings were not measured. **User-assisted native checkpoint 3 — PASS.** Using `npm run dev:simulated:recovery`, the user confirmed visible connection loss/synchronization rather than continuous connected status, retained last-known state, and replacement synchronization restoring Ari Idle / “Ready for a task,” Mina Waiting / “Waiting for changes,” and Sol Working / “Finishing a task.” The deterministic sequence resumed, and no stale previous-session values visibly overwrote the replacement session. This is native visual evidence supplied by the user; old-session enforcement additionally has ingress/reducer regression coverage. No native old-session injection or hidden-state instrumentation is claimed.

## Selection, reload, remount, visual, and accessibility evidence

The user's native confirmation establishes persistent Mina selection and updating inspection during arrivals, visible keyboard focus and keyboard selection, reload to current state/status with one canvas, and usability at the 760 × 540 window.

The unchanged eight `OfficeSceneHost.test.ts` cases cover late asynchronous loading, destruction, cleanup/remount, latest presentation, repeated/disconnected presentation, stable selection, and actual-store loss/new-session data passed through one controlled game. The controller/store/preload/IPC tests cover startup/loss, deadline cancellation, generations, bounded replacement, buffer/read races, stale sessions, and navigation/watch cleanup. This automated evidence supports listener/remount integrity; one visible native canvas alone does not establish listener counts or every race.

Normal-size usability is covered by the user's simulation interaction. The configured default window is 1100 × 760 (`electron/main.ts:18`), but its exact native dimensions were not instrumented. The minimum-size check was user-assisted at 760 × 540; no geometry measurement or screenshot was supplied.

Connection status has visible text, `role="status"`, `aria-live="polite"`, and `aria-atomic="true"` (`ConnectionStatus.tsx:16`). Inspection has a polite atomic live region, labeled selector controls with `aria-pressed`/`aria-controls`, and keyboard-operable buttons (`AgentInspectionPanel.tsx`). `style.css` defines the focus-visible outline. Component tests support these semantics; the user confirmed visible focus. Neither DOM/source semantics nor that confirmation proves actual VoiceOver announcements. Screen-reader behavior remains unverified.

No screenshots were added: native interaction evidence is the explicit user confirmation, and no authenticated Developer native capture was available. The historical EP-02 offscreen screenshots are not reused as EP-03 evidence.

## Shutdown and process cleanup

For stable simulation, Developer recorded main PID 18018 and separate simulator PID 18030, their listener/connection ownership, then stopped the owned terminal session with SIGINT. `ps` subsequently contained neither PID and `lsof` contained no TCP resources owned by them.

For recovery, main PID 18115, first child 18126, and replacement 18148 were recorded. After stopping the owned run with SIGINT, `ps` contained none of those PIDs and `lsof` reported no owned TCP resources. The ordinary owned main also disappeared after stopping its terminal run. Existing user application processes were left alone.

These measurements prove cleanup for the terminal-stopped runs, not execution of the native Quit event path or native cancellation at every recovery phase. Main's `before-quit` disposal/awaited shutdown is source-inspected at `electron/main.ts:33`. Existing tests cover stop during recovery delays and first-child termination, deadline/watch cancellation, child termination, socket/listener disposal, and concurrent ingress start/stop. **User-assisted native checkpoint 4 — PASS.** Native macOS/Electron Quit from stable simulation closed the app normally without reopening, a visible hang, or a shutdown error. **User-assisted native checkpoint 5 — PASS.** Native Quit during the recovery interval closed normally; the app did not reopen, including when the scheduled replacement would otherwise occur. These are user-supplied visible behavior observations, not PID/socket cleanup measurements. Process cleanup remains supported separately by the Developer SIGINT measurements and automated shutdown tests above.

## Final automated validation

All commands below ran after the final test edit; executable code is unchanged.

| Command | Result |
| --- | --- |
| `npm test --workspace @coffee-break/desktop -- src/office/localEventIntegration.test.ts electron/simulator/integration.test.ts` | PASS, 5/5 across 2 files: 4 new joined cases + 1 existing real transport case. |
| `npm test --workspace @coffee-break/desktop -- electron/ingress electron/simulator electron/agentStateIpc.test.ts electron/agentStatePreload.test.ts src/agentState src/office/officePresentation.test.ts src/office/OfficeSceneHost.test.ts src/office/localEventIntegration.test.ts` | PASS, 98/98 across 15 files. |
| `npm run typecheck` | PASS, desktop renderer/main and contracts. |
| `npm run lint` | PASS, 0 errors; two pre-existing unused ESLint-disable warnings in ignored `out/renderer/assets/createOfficeGame-Dy8LKjUh.js`, lines 115516 and 115533. |
| `npm test` | PASS, 142/142: importer 10, desktop 131 across 22 files, contracts 1. |
| `npm run build` | PASS, main, simulator, preload, and renderer bundles. |
| `git diff --check` plus `git diff --no-index --check /dev/null` for each new file | PASS; new files are untracked pending review, so checked separately. |
| Scope/output audit | Only the new joined test and this report. No tracked generated `apps/desktop/out` files. No dependency, runtime, contract, or security changes. |

The first Electron-side placement failed typecheck because of module-resolution context; moving the new test into the existing renderer context resolved it. No production defect was exposed or corrected. No new dependency, E2E framework, diagnostic API, configuration, or shared harness was introduced.

## Acceptance and exit-criterion traceability

"Developer evidence ready" means the evidence was prepared by the Developer; the independent Reviewer subsequently passed the verification additions. Native observations below retain their user-assisted provenance.

| US-018 criterion | Status and evidence |
| --- | --- |
| AC-01: simulation command and Connector delivery | Developer evidence ready: actual command, separate child/TCP ownership, accepted snapshot/events, joined real transport. |
| AC-02: all initial/scripted states and presentation/activity | Evidence ready: automated/joined/runtime delivery, native Mina updates, and user-assisted final Ari/Mina/Sol activity/presentation confirmation plus the complete replacement snapshot. |
| AC-03: selection and updating inspection | User-assisted native confirmation; existing store/host/inspection tests. |
| AC-04: startup, loss/recovery, reload/remount, shutdown | Evidence ready: automated/source/process coverage; user-assisted startup, loss/retention/resynchronization, reload, and both native Quit checkpoints. Remount/listener evidence remains automated, not native instrumentation. |
| AC-05: representative rejected inputs | Developer evidence ready: wrong token, invalid fields, oversized frame, changed-payload duplicate cannot mutate renderer agents/revision. |
| AC-06: proportionate deterministic/integration tests | Developer evidence ready: four joined cases complement existing matrices. |
| AC-07: committed report | Report prepared with provenance and limitations; inclusion in the US-018 commit/PR is tracked externally, without embedding a circular self-SHA. |
| AC-08: final revision checks | Working-tree validation PASS above; future exact PR-head CI remains to run. |
| AC-09: independent review | PASS — no HIGH, MEDIUM, or LOW findings; maintainer approval and epic closure remain separate. |

| EP-03 exit criterion | Status and evidence |
| --- | --- |
| EC-01: separate simulator/authenticated delivery | Developer evidence ready: command/process/socket observations and real transport tests. |
| EC-02: rejected input/identity/arrival rules | Developer evidence ready: joined renderer consequences plus existing protocol, deduplication, ingress, and projection tests. |
| EC-03: synchronization/single renderer owner | Developer evidence ready: joined complete snapshot and real store, plus source and race/generation/session tests. |
| EC-04: existing presentation/inspection/no lost selection | User-assisted native interaction and reload, joined presentation, and existing one-game lifecycle tests. |
| EC-05: startup/loss/recovery/reload/shutdown/no leaks | Evidence ready: automated/source/process coverage plus all five user-assisted native checkpoints. Visible native Quit and measured SIGINT process/socket cleanup remain distinct. |
| EC-06: automated and integrated visual/interaction evidence | Evidence ready: automated checks, actual runtime delivery, user-assisted interaction/minimum-window/startup/recovery/Quit observations. Actual screen-reader announcements remain an accepted unverified limitation. |
| EC-07: final checks/independent review | Working-tree checks and independent review PASS; later exact-head CI and maintainer approval PENDING. |

## Review readiness and remaining limitations

All five requested native checkpoints are now recorded as user-assisted PASS, alongside the earlier selection, keyboard/focus, reload, and minimum-window confirmation. No further user-assisted checkpoint from those checklists remains pending. Native listener/remount instrumentation, exact scheduler/geometry measurements, and actual screen-reader announcements remain unverified as explicitly described above; VoiceOver behavior was not tested and is an accepted limitation.

No production defect or scope expansion was found. No Graphify modification/refresh occurred. The separately authorized on-demand Ponytail minimalism review does not establish correctness, security, acceptance, or independent approval. Independent review passed with no findings. Eventual exact-PR-head CI/final validation and maintainer approval remain pending before epic closure; Git history and PR metadata supply commit provenance without a circular report edit.
