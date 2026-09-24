# EP-02 virtual office MVP verification

## Purpose and scope

This report records Developer verification of US-012, **Verify the Virtual Office MVP**, against the integrated EP-02 baseline. It covers the fixed pixel-art office, three deterministic simulated agents, animations, selection and read-only inspection, React/Phaser lifecycle behavior, supported window sizes, local-only operation, and repository checks.

The approved boundary excludes live Connector or provider integration, authentication, real agent execution, persistence, multiple rooms, furniture editing, autonomous walking, pathfinding, and production deployment. This verification introduced no runtime, test, dependency, contract, IPC, security, Connector, asset, or visual-design changes.

Independent approval is outside the Developer role. US-012 AC-08 and the independent-review outcome remain **PENDING**.

## Baseline and environment

- Approved and verified baseline: `e7db21c813887e4edba8fb102468ccd44436d54c`
- Baseline source: merge of PR #27, including US-007 through US-011
- Verification branch: `feature/us-012-mvp-verification`
- Operating system: macOS 26.2 (build 25C56)
- Shell Node.js: 22.23.2
- npm: 10.9.8
- Electron verification runtime: Electron 37.10.3, Chromium 138.0.7204.251, embedded Node.js 22.21.1
- Normal viewport: 1100 × 760
- Minimum supported viewport: 760 × 540

`npm run dev` launched the actual Electron application successfully. macOS did not grant Computer Use access to its native window, so repeatable interactions and captures used an offscreen Electron `BrowserWindow` loading the built production renderer through `file://`. That window used `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`, matching the application security settings. The evidence is Electron renderer evidence, not a native macOS-window capture or a packaged application test.

## Automated validation

The following commands ran sequentially against the clean baseline before documentation changes:

| Command | Exit | Result |
| --- | ---: | --- |
| `npm run typecheck` | 0 | Desktop and contracts TypeScript checks passed. |
| `npm run lint` | 0 | No errors. Two warnings came from unused ESLint-disable directives in the generated Phaser bundle under `apps/desktop/out`. |
| `npm test` | 0 | Five files and 23 tests passed: 22 desktop tests and one contracts test. |
| `npm run build` | 0 | Electron main, preload, and renderer production builds passed. |
| `git diff --check` | 0 | Passed. |

The automated suite meaningfully covers:

- React/Phaser load, disposal, late callback, queued selection, and remount coordination;
- fixed 640 × 360 geometry, exact 2× art scale, layer ordering, anchors, bounds, and clearance;
- typed deterministic fixtures, initial states, activities, anchors, and animation configuration;
- fixture-backed inspection details, accessible names, `aria-pressed`, `aria-controls`, clearing state, and prompt restoration;
- the initial provider-neutral shared contract.

These tests do not prove real Electron rendering, pointer hit testing, keyboard focus presentation, visual appearance, window resizing, network isolation, or real Phaser resource destruction. Those boundaries were checked separately where feasible.

## Integrated verification procedure and observations

### Launch and initial rendering

1. Built the application and loaded `apps/desktop/out/renderer/index.html` in the secured Electron verification window at 1100 × 760.
2. Observed one office canvas. Its logical and displayed dimensions were both 640 × 360, with a 16:9 ratio and computed `image-rendering: pixelated`.
3. The canvas host had a 640 × 360 content area inside its border, so no edge was clipped.
4. Visually inspected the background, two work areas, coffee area, foreground depth, and all three sprites. The scene was crisp and undistorted.
5. Observed the disclosure `Simulated agent activity · No live connection`.
6. Observed no application console errors.

Evidence: [normal 1100 × 760 office](assets/office-normal-1100x760.png).

### Agents and animations

Exactly three agents appeared simultaneously at the approved anchors:

| Agent | State | Activity | Anchor |
| --- | --- | --- | --- |
| Ari | idle | Waiting for a task | `(136, 248)` |
| Mina | working | Reviewing mock changes | `(320, 248)` |
| Sol | break | Taking a coffee break | `(520, 248)` |

Four time-separated canvas captures were taken. Hashes of each agent's 48 × 64 clearance region produced at least two distinct values for Ari, Mina, and Sol, directly demonstrating that every rendered sprite changed over time. Ari and Sol alternated across the 250 ms samples; Mina's 4 fps change was captured by the additional 125 ms offset. The observed frames returned to earlier hashes, consistent with the configured two-frame loops. Configuration tests separately verify each agent's frames, rate, repeat value, and non-color animation cue.

Evidence: [frame 1](assets/animation-frame-1.png), [frame 2](assets/animation-frame-2.png), [frame 3](assets/animation-frame-3.png), and [frame 4](assets/animation-frame-4.png).

### Pointer selection and inspection

1. Clicked Ari, Mina, and Sol directly at their rendered Phaser positions.
2. Each click moved the single visible selection outline to the corresponding sprite.
3. The React panel updated the name, state, and activity together from the typed fixture.
4. Switched Sol → Ari after the initial sequence; no stale details or duplicate indicator appeared.
5. Activated Clear selection; the outline disappeared, no selector remained pressed, the initial prompt returned, and Clear selection became disabled.
6. Repeated direct selection for all three agents at 760 × 540 after the resize cycles; every pointer target remained aligned.

Evidence: [Ari selected](assets/ari-selected.png), [Mina selected](assets/mina-selected.png), and [Sol selected](assets/sol-selected.png).

### Keyboard and accessibility

1. Used synthetic Electron key input to Tab through the native buttons in document order: Ari, Mina, Sol, then Clear selection.
2. Enter selected Ari, Space selected Mina, Enter selected Sol, and Enter on Clear selection restored the unselected prompt.
3. Verified accessible labels `Select Ari`, `Select Mina`, and `Select Sol`.
4. Verified exactly one selector exposed `aria-pressed="true"` after each selection.
5. Verified all selectors referenced `agent-inspection-details` through `aria-controls`.
6. Verified the details region exposed `aria-live="polite"` and `aria-atomic="true"`.
7. Verified the office host exposed `role="img"` and described the three simulated states.

Limitations:

- The offscreen Electron input reached the correct controls and activated them, but did not cause Chromium to match `:focus-visible`; computed focus outline therefore remained absent in this synthetic environment. The repository defines a 3 px focus-visible outline, but visible keyboard focus was not directly confirmed in the native window.
- macOS did not grant Computer Use accessibility access, so VoiceOver and native-window keyboard focus could not be tested. DOM attributes are not presented as proof of screen-reader announcements.
- The visual captures are offscreen Electron renderer captures at the Electron viewport dimensions.

### Resizing

1. Selected Mina at 1100 × 760.
2. Performed five complete cycles in the same running Electron window: 1100 × 760 → 760 × 540 → 1100 × 760.
3. At all ten measured endpoints, the same canvas DOM object remained mounted; canvas count stayed at one; displayed and intrinsic size remained 640 × 360; ratio remained 16:9; and Mina's selected ID and details persisted.
4. At 760 × 540 the document height expanded to 1004 px. Vertical scrolling placed the details region at y=227–374 and Clear selection at y=386–426 inside the 540 px viewport.
5. Direct post-resize clicks selected Ari, Mina, and Sol with the matching panel details.
6. No duplicate canvas, duplicate indicator, stale selection, distortion, or application error was observed.

One Phaser game instance and three sprite/listener pairs are inferred from the unchanged canvas identity, the absence of duplicate scene elements, code inspection, and the lifecycle tests. Phaser internals are intentionally not exposed through a production diagnostic API.

Evidence: [minimum-size inspection](assets/minimum-inspection-760x540.png) and [restored view after five cycles](assets/restored-after-five-cycles.png).

### Reload, cleanup, and shutdown

1. Reloaded the same production renderer after selecting Mina.
2. The new view settled with one canvas, three visible agents, no selected selector, the initial inspection prompt, and Clear selection disabled.
3. No stale selection indicator or details remained.
4. Destroyed the verification window; `BrowserWindow.getAllWindows()` returned zero.
5. Stopped the separately launched development application.

Runtime observation proves the visible reload and window cleanup outcomes. It does not directly count every Phaser listener after destruction. The existing focused tests verify destroy calls, canvas removal, async-load cancellation, ignored post-disposal callbacks, and current-game ownership after remount.

### Local-only and security boundary

The production renderer requested only these local resources:

- the `file://` renderer HTML;
- the bundled renderer JavaScript;
- the bundled stylesheet;
- the bundled Phaser/office JavaScript chunk.

No HTTP, HTTPS, WebSocket, provider, or agent-command request occurred. The only console warnings were two instances of Electron's expected CSP warning for the unpackaged renderer, one before and one after reload. No application errors occurred.

Electron main still uses `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`; preload remains empty. Shared contracts, IPC boundaries, and Connector behavior were unchanged.

## US-012 traceability

| Criterion | Evidence | Developer status |
| --- | --- | --- |
| AC-01 | Actual development launch; secured production-renderer launch; one completed 640 × 360 office; normal screenshot; no application errors | PASS |
| AC-02 | Three visible agents; fixture/state/activity checks; anchor inspection; per-agent time-separated region hashes | PASS |
| AC-03 | Direct clicks and keyboard activation for all agents; switching; clear; matching outline, pressed state, and details | PASS |
| AC-04 | Five resize cycles, stable canvas identity/count and selection; reload to clean state; destroy to zero windows; lifecycle tests | PASS, with cleanup limits documented |
| AC-05 | Existing 23 tests cover deterministic logic and interaction boundaries; no redundant tests added | PASS |
| AC-06 | Committed normal, selection, minimum, restored, and animation evidence; accessibility inspection and limitations documented | PASS, with native focus and VoiceOver limitations |
| AC-07 | Typecheck, lint, tests, build, and diff check passed; known generated warnings classified | PASS |
| AC-08 | Requires an independent Reviewer on the exact PR HEAD | **PENDING INDEPENDENT REVIEW** |

## EP-02 exit criteria

The exact approved exit criteria and Developer evidence are:

| Exit criterion | Evidence | Developer assessment |
| --- | --- | --- |
| EC-01: The desktop application renders the office room and all three mock agents. | Normal-size visual evidence and direct canvas/agent inspection | SATISFIED |
| EC-02: Idle, working, and break states are visually distinguishable. | Three distinct sprites/positions, state-specific changing frames, selection captures, and text labels | SATISFIED |
| EC-03: Agent selection and inspection work. | Pointer and keyboard selection, switching, clearing, outline, and fixture-backed details | SATISFIED |
| EC-04: The office remains usable at supported desktop window sizes. | Five resize cycles, minimum-size scroll reach, stable canvas and post-resize pointer alignment | SATISFIED |
| EC-05: Relevant automated, visual, and interaction checks pass. | 23 automated tests, command suite, committed screenshots, and integrated interaction journey | SATISFIED by Developer evidence; independent confirmation pending |

The epic must not be declared complete until the independent Reviewer assesses the exact PR HEAD and AC-08.

## Defects and disposition

No runtime defect was reproduced. No application code or tests were changed.

Two documentation defects were confirmed and corrected: README and architecture documentation still described Phaser as planned and the renderer as an EP-01 welcome screen. Their status text now reflects the implemented EP-02 office while preserving the approved dependency direction, trust boundaries, security settings, and deferred Connector/state-store work.

## Independent Reviewer outcome

**PENDING.** The Reviewer should inspect the exact PR HEAD, rerun or sample the documented procedure, evaluate AC-01 through AC-07 evidence, and determine whether all five EP-02 exit criteria are met. Reviewer findings and their disposition must be recorded before AC-08 can pass.
