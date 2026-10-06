# US-028 — Integrated agent selection and information

Implementation evidence for [US-028 #62](https://github.com/heyitsanuar/coffee-break/issues/62). The implementation is **accepted by the Product Owner and ready for final commit / PR**. It is not yet merged or complete on `main`; merge remains a Product Owner action after green CI.

## Baseline and authority

Branch: `feature/us-028-integrated-agent-information`. Starting HEAD, local `main` and `origin/main`: `951574dfd7a668e31a31ee55c6451e9ea0c9ff6e`, the merged US-027 / PR #68 baseline. The starting working tree was clean. Implementation changes remained unstaged/uncommitted throughout review; Product Owner acceptance now authorizes finalization.

The [durable US-028 approved design package](../design/references/us-028/README.md) preserves **17 exact original Designer PNG studies**, with file hashes and dimensions. The proposal was initially NOT APPROVED. The Product Owner subsequently said “I approve”, approving recommendations 1–25. Historical image captions are preserved; these references are not runtime captures. Original North Star and US-025/026/027 remain upstream authority. US-029 responsive refinement and US-030 final fidelity/polish are deferred.

## Engineering implementation

- `AgentPortrait.tsx` reuses the canonical lifecycle sheet and `stableLifecycleFrame(id, 'idle')`. The local `(2,0,16,16)` window starts at sheet rows 0/24/48. CSS backgrounds scale the full 160×72 sheet by integer 2×/3× and offset the window to render 32×32 roster / 48×48 inspector portraits. `image-rendering: pixelated`, no repeats, no canvas or independent portrait assets. The span is decorative `aria-hidden`; text identifies the agent.
- `AgentSelector.tsx` keeps the fixed Ari/Mina/Sol native button group, accessible names, pressed states and inspection association. Portrait/name/check remain stable children. Hidden checks retain their 12px reservation. Controls are 44px high with 8px gaps and consistent font weight, preventing selection-induced content movement. Existing warm selection and external cyan focus coexist.
- `AgentInspectionPanel.tsx` replaces generic heading/Name/Current state fields with portrait/name heading and plain lifecycle underneath. Freshness precedes verbatim activity: **Current information** / **Last known · Not live**. Existing optional trusted reason mapping is preserved; absent reason is omitted. No lifecycle or fields are inferred without trusted state.
- No selection reserves the desktop dock but leaves its surface/border transparent, with **Select an inhabitant** / **Choose someone in the office or below.** Selected without state shows identity plus **No trusted agent state available yet.** Clear is a stable native button with guarded `aria-disabled` when empty. It remains focusable so clearing does not drop keyboard focus.
- `SelectedAgentSummary.tsx` and `OfficeSceneHost.tsx` are unchanged: compact summary remains text-only, concise polite feedback stays separate from global availability, and `OfficeSceneHost.selectedAgentId` remains the sole selection authority. No programmatic focus or scroll management was added.
- `OfficeScene.ts` adds only custom invisible pointer geometry from existing clearances. Frame-local `(-2,-4,24,32)` minus bottom-center display origin `(10,24)`, times scale 2, plus anchor gives world `(anchor.x−24,anchor.y−56,48,64)`. Ari: `(268,118,48,64)`; Mina: `(456,118,48,64)`; Sol: `(196,226,48,64)`. Actual Phaser Rectangle/Contains geometry and installed sizing behavior are tested. Regions do not overlap. World outline remains outer 46×54 / inner 42×50; furniture and foreground remain noninteractive.
- CSS preserves room 640×360, desktop dock 304px and gap 18px. Compact context line height is 16px to accommodate the approved 44px controls and immediate summary in the existing flow; no shell, breakpoint, zoom or room redesign. Activity uses `white-space: pre-wrap`, `overflow-wrap: anywhere`, no clamp/ellipsis or internal scroller.

## Acceptance evidence

| Criterion | Evidence and status |
| --- | --- |
| AC01 — World/roster same identity | PASS: native selector callback test for all three; scene identity forwarding tests; actual integrated renderer selects all three through roster and outside-visible-art world margin, matching selected roster/name/lifecycle/details. |
| AC02 — Selection survives updates | PASS: existing deterministic store/bridge and mount tests; runtime journey through Idle/Working/Waiting/Completed/Error, activity/reason changes, disconnect, synchronization/restoration, Working and coffee frame intervals, acknowledgement settlement and fixture remount retains selection. |
| AC03 — Selection does not move focus | PASS for implementation/Chromium: no new focus management; runtime focus-call spy shows no extra explicit focus calls across state/availability/clear. Selector focus stays Mina and scroll position stays stable during updates. Native detailed traversal remains unverified. |
| AC04 — Distinct focus/selection | PASS for structure/runtime: cyan 3px outline with 3px offset, warm inset/check, direct focus-only/selected-only/combined captures; focus-only Mina leaves Ari selected. Native detailed checklist unverified. |
| AC05 — Practical pointer regions | PASS: deterministic geometry/installed Phaser sizing test and all-three margin input integration. Targets stable across lifecycle and Sol texture changes, non-overlapping, unchanged outlines/layers. Just outside Ari target does not select Ari. |
| AC06 — Contextual side dock | Implemented and runtime verified at 304px, 18px gap; identity matches world/roster. Designer implementation review PASS. |
| AC07 — Identity/lifecycle hierarchy | PASS structural/runtime: 48px portrait/name heading, lifecycle immediately below; generic heading and redundant identity fields removed. Designer implementation review PASS. |
| AC08 — Exact trusted activity | PASS: verbatim escaped text and multiline completeness tests; runtime exact `textContent` comparison. Synthetic fixture is renderer evidence, not transport authenticity evidence. |
| AC09 — Optional reason | PASS: both existing mapped reasons tested; absent section omitted; reason-update selection preservation checked. |
| AC10 — Explicit freshness | PASS: live and retained copy precede activity; runtime retained/restored journey. |
| AC11 — Disconnect preserves lifecycle | PASS: retained Waiting/activity/reason/identity/selection; no Offline lifecycle introduced; existing renderer tests retained. |
| AC12 — Intentional empty dock | Implemented; semantic invitation and non-operative Clear tests, direct runtime empty capture. Designer implementation review PASS. |
| AC13 — Complete wrapping | PASS unit/runtime: full unbroken text, newline preservation, `pre-wrap`, no horizontal overflow, vertical document growth, 304px desktop dock and compact scrolling. See fixture limitations below. |
| AC14 — No fabricated capabilities | PASS scope/source audit: only existing identity/lifecycle/activity/reason/freshness fields; no model/token/cost/productivity/history/provider data added. |
| AC15 — Semantic keyboard controls | PASS structural/Chromium Tab/Space activation: native buttons/group/names/pressed/controls preserved, decorative portraits, guarded empty Clear, keyboard clearing keeps focus. Detailed native/assistive-tech verification unclaimed. |
| AC16 — Designer interaction/hierarchy review | **PASS**. Completed Designer implementation review accepted the interaction and information hierarchy, with HIGH 0 / MEDIUM 0 / LOW 0 findings. |
| AC17 — Regression suite | PASS: full repository suite 300/300; typecheck/lint/build and integrity checks below. |

## Runtime evidence and reproducibility

[Capture record](assets/us-028/capture-record.json) contains baseline, exact source SHA-256 values, Electron version, viewport/DPR/dimensions, production PNG hashes, individual PNG hashes and integrated assertions. All **20 PNGs** are direct, unedited Electron `capturePage` results; no composites or reconstructed application artwork. Retina captures use DPR 2 (2200×1520 / 1520×1080 image pixels), while window/layout measurements use CSS pixels.

The development-only `verification/us-028.tsx`/`.html` fixture reuses production Application, store, presentation runtime, host and Phaser scene. It supplies synthetic accepted renderer messages; it does not exercise authentication/preload/IPC/Connector and creates no alternate selection UI. The ordinary native `npm run dev:simulated` launch uses the existing simulator/transport path.

Reproduce with the existing installed dependencies:

```sh
npm run dev:simulated
# In another terminal at the repository root:
node_modules/.bin/electron apps/desktop/verification/capture-us-028.cjs
```

The harness is read-only with respect to production assets/source and writes its evidence directory. It temporarily spies on focus calls inside the development fixture, uses Chromium input emulation and synthetic updates, and explicitly does not establish native keyboard/OS preference/screen-reader behavior. It never supplies a replacement product UI.

| Evidence | Direct runtime artifact |
| --- | --- |
| A — No selection / default dock | [Desktop empty](assets/us-028/a-desktop-no-selection.png) |
| B/G/H — Ari identity, hierarchy and canonical portrait agreement | [Ari selected](assets/us-028/b-desktop-ari-selected.png) |
| C/G/H — Mina identity | [Mina selected](assets/us-028/c-desktop-mina-selected.png) |
| D — Sol exact canonical coffee with Waiting inspector | [Sol selected](assets/us-028/d-desktop-sol-selected.png) |
| E — Compact immediate summary and scrollable details | [Top](assets/us-028/e-compact-selected.png), [scrolled inspector](assets/us-028/e-compact-inspector-scroll.png) |
| F/N — Default, hover, selected-only, focus-only and combined | [Default](assets/us-028/f-default-roster.png), [hover](assets/us-028/f-hover-mina.png), [selected-only](assets/us-028/f-selected-only-mina.png), [focus-only Mina / Ari selected](assets/us-028/f-focus-only-mina-selected-ari.png), [focus + selected Mina](assets/us-028/f-focus-and-selected-mina.png), [Clear focus after clearing](assets/us-028/f-clear-focus-after-clearing.png) |
| G/J — Live vs retained | [Live](assets/us-028/g-inspector-live.png), [retained](assets/us-028/j-inspector-retained.png) |
| I — Pointer geometry | `OfficeScene.test.ts`: installed Rectangle/Contains and Size component; capture record `selectionRoutes` records all-three actual margin clicks. No visible debug target added to production. |
| K — Long activity and bounded reason | [Desktop](assets/us-028/k-desktop-long.png), [compact top](assets/us-028/k-compact-long-top.png), [compact details](assets/us-028/k-compact-long-inspector.png) |
| L — Selected without trusted state | [Mina without state](assets/us-028/l-selected-no-trusted-state.png) |
| M — Generic Waiting without coffee | [Sol generic Waiting](assets/us-028/m-generic-sol-waiting.png) |
| Motion remains existing behavior | [Chromium-emulated reduced motion](assets/us-028/n-emulated-reduced-motion-coffee.png) |

### Supported sizes

At **1100×760**, measured room `(25,77,640,360)`, dock width 304px, existing grid gap 18px, 44px controls, and no horizontal overflow. Ordinary dock height 362px; long-content dock grows to 671.5px in document flow. Full activity and mapped reason remain visible/reachable; no internal scroller.

At **760×540**, full room is `(60,77,640,360)`. Roster bottom 510px; selected summary bottom 540px. Inspector begins at 556px and remains reachable by vertical scrolling. Ordinary document height 891px; long-content document height 1059px. No horizontal overflow, canvas duplication or destructive truncation. Broader responsive/zoom refinements remain US-029.

Developer visually inspected direct desktop/compact/long-content captures: portraits/names agree, hierarchy is readable, full room is intact, and activity wraps. These are developer implementation observations, not Designer approval.

### Native and trust limitations

The Product Owner responded **“Looks good to me”** to the native 1100×760 / 760×540 check request. Record this as general positive feedback only: the reply did not identify individual checks, so it does not establish a detailed native keyboard checklist, assistive-technology behavior, native OS reduced-motion preference or final story acceptance.

Detailed native macOS keyboard traversal: **UNVERIFIED**. Screen reader: **UNVERIFIED**. Native OS reduced-motion preference: **UNVERIFIED**. Chromium Tab/Space, visible-focus state, stable DOM Clear, update/focus assertions and emulated media preference are separate evidence.

The multiline long-content fixture is below the 512-byte activity ceiling but contains a newline specifically to test presentation preservation. Current ingress validation rejects control characters, including newlines; that contract is unchanged. This synthetic renderer case is UI robustness evidence, not a claim that the transport accepts multiline activity. The unit test also checks complete long unbroken text. No trusted data or authenticity is invented by this report.

Coffee is still only the existing exact Sol / Waiting / `Taking a coffee break in the simulated office` presentation predicate. Inspector says Waiting and renders the exact activity; generic Sol Waiting has no coffee inference. Disconnection preserves lifecycle/activity/reason and only changes freshness qualification.

## Implementation validation history

- Focused portrait/selector/inspection/summary/scene/host/Application: **53/53**, seven files.
- `npm test`: **300/300** = 37 importer + 262 desktop + 1 contracts. Initial sandboxed run failed existing loopback tests with EPERM; rerun with local socket permission passed. No test or boundary was weakened.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, **zero errors, two known generated Phaser bundle unused-disable warnings**.
- `npm run build`: PASS.
- `node --check apps/desktop/verification/capture-us-028.cjs`: PASS. Standalone strict TypeScript check of `verification/us-028.tsx` also PASS (the normal workspace config covers production `src`).
- Final offscreen capture/integration assertions: PASS, zero renderer console errors. A harness serialization issue, premature remount capture and incomplete raw Enter emulation were corrected before final evidence; final native button activation uses Chromium Tab/Space. No product workaround or keyboard override was introduced.
- PNG integrity: all 17 exact promoted design studies and 20 direct runtime captures decode; dimensions and full PNG-file hashes match. Canonical source crop geometry and integer nearest-neighbor round trips checked. Production PNGs are byte-for-byte unchanged from starting baseline.
- Local design-reference/report links: PASS. `git diff --check`: PASS. Nothing staged; HEAD unchanged. Generated `apps/desktop/out` stays ignored/untracked by Git.

Image integrity used the existing bundled Python/Pillow runtime (no install). For any capture, decode with `PIL.Image.open(path).load()`, compare `.size` to `capture-record.json`, and calculate `hashlib.sha256(path.read_bytes()).hexdigest()` against its `pngSha256`. These hashes cover PNG files, not decoded pixel buffers. Source Idle crop bounds are `(2,0,18,16)`, `(2,24,18,40)`, `(2,48,18,64)` in Pillow left/top/right/bottom order. Convert RGBA, resize to 32/48 using `Image.Resampling.NEAREST`, resize back to 16×16 and compare `.tobytes()`.

## Finalization validation — 2026-10-06

Canonical final checks were rerun on the reviewed implementation before commit: focused tests **53/53 PASS**; `npm test` **300/300 PASS** (37 importer + 262 desktop + 1 contracts) with authorized loopback access; typecheck **PASS**; lint **PASS**, zero errors and the same two known generated-Phaser warnings; build **PASS**; `git diff --check` **PASS**. Capture-script syntax and the untracked report's whitespace check also passed. Runtime evidence was not regenerated.

Final evidence audit confirmed capture-record source/PNG hashes, all 20 runtime PNG decodes/dimensions, all 17 approved design PNGs, unchanged production art, local documentation links and no tracked generated output or machine-local runtime dependency. Fingerprints confirmed all 440 non-report repository files unchanged from the reviewed tree. Only the authorized report-status/evidence bookkeeping changed during finalization. Accessibility limitations and initial validation/review history are preserved.

## Scope and review handoff

Exact production changes: `apps/desktop/src/office/AgentPortrait.tsx` (new), `AgentSelector.tsx`, `AgentInspectionPanel.tsx`, `OfficeScene.ts`, and `apps/desktop/src/style.css`. Tests: new `AgentPortrait.test.tsx`; modified `AgentSelector.test.tsx`, `AgentInspectionPanel.test.tsx`, `OfficeScene.test.ts`, `SelectedAgentSummary.test.tsx`, `Application.test.tsx`. Evidence: three new development verification files, this report, 20 runtime PNGs and capture JSON. Design: `docs/design/README.md`, promoted reference README and 17 exact design PNGs.

No room/character production asset, anchor, pose, animation/acknowledgement timing, coffee/workstation predicate, trusted state/runtime, lifecycle contract, Electron main, preload, IPC, transport, Connector, dependency, navigation, persistence or selection authority changed. No fake metrics/provider data, new motion, US-029 responsive redesign or US-030 polish. No commit, push, PR or GitHub modification occurred during implementation/review. The reviewed tree remained **unstaged/uncommitted** until Product Owner authorization to finalize; finalization adds only report-status bookkeeping.

Design proposal approval: **COMPLETE**; Product Owner approval of recommendations 1–25 is recorded above.

Designer implementation review: **PASS / COMPLETE**, including AC16. Findings: **HIGH 0 / MEDIUM 0 / LOW 0**. The Designer accepted the implemented interaction and information hierarchy. Recorded verdict: **US-028 DESIGNER REVIEW PASS — READY FOR INDEPENDENT REVIEW**.

Independent technical review: **PASS / COMPLETE**. Initial review found HIGH 0 / MEDIUM 0 / LOW 1; the sole LOW finding concerned stale Designer status in this report. A documentation-only correction addressed it. **Focused independent Reviewer recheck: PASS**, with HIGH 0 / MEDIUM 0 / LOW 0. Final verdict: **US-028 REVIEW PASS — READY FOR PRODUCT OWNER ACCEPTANCE**. Independent validation confirmed 53/53 focused tests, 300/300 full-suite tests after loopback permission, typecheck/build/diff-check PASS and lint PASS with the two known generated-Phaser warnings. The initial sandbox EPERM history remains recorded above.

Product Owner final implementation acceptance: **PASS / COMPLETE**. After the completed Designer and independent reviews, the Product Owner explicitly said **“I approve”** and authorized commit, push, PR and CI handoff. This final acceptance is separate from the earlier general native feedback and does not verify detailed native macOS keyboard traversal, screen-reader behavior or native OS reduced motion. No additional Designer review is required for status-only finalization. Product Owner merge remains separate from implementation acceptance.
