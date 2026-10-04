# US-025 — North Star Application Shell: Developer Evidence

Designer implementation review and independent engineering review have completed successfully, and the Product Owner has accepted US-025. Acceptance authorizes repository finalization; maintainer merge remains a separate workflow action. This record preserves the validation limitations below. [US-025 #59](https://github.com/heyitsanuar/coffee-break/issues/59) matches `planning/ep-05-issues.json`. The Product Owner-approved engineering brief authorizes this shell implementation, including the ink palette, compact header, reserved dock and compact room-first ordering. EP-04's cream tokens are the historical baseline; the approved US-025 shell direction supersedes them without changing the office artwork.

## Baseline and ownership

- Branch: `feature/us-025-north-star-application-shell`.
- Reviewed base/HEAD before finalization: `697654144d1630d72d4a1011f0ed8b001b2c50be`, matching fetched `origin/main` when the branch was created.
- [Planning PR #65](https://github.com/heyitsanuar/coffee-break/pull/65) was verified MERGED with that merge SHA. US-024 is present in this merged baseline.
- The reviewed implementation/evidence was prepared without commit, push, PR or issue modification. Finalization is now authorized; no dependency installation or new persistent state was introduced.

Discovery verified that bootstrap owns the store/watch and presentation runtime outside React, `OfficeSceneHost` owns selection/game lifecycle, the selector and inspector are React controls, and Phaser receives only derived presentation. Existing tests cover store/session/retained behavior, connection copy, semantic selector activation, exact inspection, host cleanup/remount, motion and acknowledgement policy.

[`Application.tsx`](../../apps/desktop/src/Application.tsx) extracts the production shell so both bootstrap and the development fixture render the same component. It subscribes to the existing store for global availability in the header. [`OfficeSceneHost.tsx`](../../apps/desktop/src/office/OfficeSceneHost.tsx) retains selection, live feedback, inspection and game ownership; only availability placement and child order change. The existing availability copy function is unchanged. No contract, Connector, main/preload/IPC, authentication, security, reducer/store, runtime, scene, artwork, anchor, logical resolution, animation timing or coffee-rule changes were needed.

## Composition and behavior

[`style.css`](../../apps/desktop/src/style.css) integrates approved role-based shell tokens: ink canvas/header/surfaces, cream text, quiet supporting text, coffee selection, sage live status and cyan focus. Native typography remains; the title is 18px semibold. There are no new navigation controls, statistics, provider UI, decorative animation or dashboard cards.

At 1100×760 the header is 56px high. The fixed canvas occupies 640×360 CSS pixels at x25/y77, surrounded by its existing 1px host boundary. The reserved dock starts at x684/y76, is 304px wide and has a 362px minimum height. Selected and unselected captures have identical canvas and dock geometry. Long content can increase dock/document height, without nested scrolling.

The breakpoint follows the fixed-room fit: 642px bordered room + 304px dock + 18px gap + 48px gutters = 1012px. Below that width supporting content stacks; the office remains full size. Checks at 800, 960, 1011, 1012, 1024 and 1200px found no horizontal overflow or canvas resizing. At the tested Retina DPR 2, half-CSS-pixel centering at odd widths still lands on physical pixels; no fractional world scaling is applied.

At 760×540 the room is centered at x60/y77, full and crisp. DOM/visual order is header → office → quiet simulation context → roster → selected summary → inspector. The selected summary fits in the initial viewport. Full inspection is reached through normal vertical document scrolling. Compact no-selection and selected states retain the same room geometry; the inspector naturally follows the optional summary.

Ari/Mina/Sol native buttons, accessible names, pressed state, checks and clear behavior are preserved. The inspector's Name, Current state, exact Activity, optional Reason and conditional Last known fields are unchanged. Missing data remains explicit; selection never invents lifecycle. Sprite input and the equivalent selector agree on Sol in the renderer test. Clear restores the existing unselected prompt and disabled Clear button.

Focus uses a separated 3px cyan outline; selection keeps its warm border, inset reinforcement, weight and check. No positive tabindex or focus-select handler was added. The offscreen harness initially focuses Ari programmatically, then sends Chromium keyboard events: Tab reaches unselected Mina with `:focus-visible` true while Ari remains selected; Space selects Mina; lifecycle and disconnect updates preserve that focused control. This is renderer input emulation, not native macOS keyboard evidence.

Availability remains one polite atomic status region in the header:

- Connected · Local simulation active
- Connecting to local simulation…
- Synchronizing · Showing last known agent state
- Disconnected · Showing last known agent state
- Disconnected · Local simulation unavailable

Live status gains the approved sage treatment; truthful text remains the semantic distinction. Availability never replaces agent lifecycle. The unchanged simulation/provider disclaimer now sits quietly beside the office content.

Long activity (including 128 unbroken characters) wraps without ellipsis or horizontal overflow at both target sizes. Capacity-exhausted and approval-required reason copy remain exact. The inspector uses visible overflow and document scrolling; Clear remains reachable. Header/status/summary text can wrap.

The shell adds no motion. Under Chromium reduced-motion media emulation, the production office crop remained identical over 1700ms with working Ari and canonical Sol coffee. Existing tests protect retained/reduced policies and acknowledgement cancellation/non-replay. Native macOS preference behavior is not claimed.

## Actual renderer captures

The development-only [`us-025.tsx`](../../apps/desktop/verification/us-025.tsx) supplies synthetic accepted state through the production store/runtime and renders the production `Application`, host and Phaser scene. It contains no replacement UI or keyboard implementation. Inputs do not establish provider or authenticated-transport verification.

Run with the development server active:

```bash
node_modules/.bin/electron apps/desktop/verification/capture-us-025.cjs
```

[`capture-us-025.cjs`](../../apps/desktop/verification/capture-us-025.cjs) saves direct, unedited `webContents.capturePage()` output. [`capture-record.json`](assets/us-025/capture-record.json) records timestamps, Electron/platform, CSS viewport, DPR, actual geometry, scroll positions, image dimensions and full PNG-byte SHA-256 values. These are PNG-file hashes, not decoded-RGB hashes. Retina DPR 2 yields 2200×1520 PNGs for the 1100×760 viewport and 1520×1080 for 760×540.

| Evidence | Captures |
| --- | --- |
| Desktop selected / no selection | [Selected](assets/us-025/1100-selected.png), [Unselected](assets/us-025/1100-unselected.png) |
| Compact selected / no selection | [Selected](assets/us-025/760-selected.png), [Unselected](assets/us-025/760-unselected.png) |
| Precise compact inspection below the room | [Scrolled inspector](assets/us-025/760-inspector-scroll.png) |
| Focused Mina while Ari remains selected | [Renderer keyboard emulation](assets/us-025/1100-focus-mina-selected-ari.png) |
| Long activity and reason | [Desktop](assets/us-025/1100-long-activity-reason.png), [Compact](assets/us-025/760-long-activity-reason.png) |
| Retained / no data | [Disconnected retained](assets/us-025/1100-retained.png), [Unavailable](assets/us-025/760-unavailable.png) |
| Reduced motion | [Renderer media emulation](assets/us-025/760-reduced-motion.png) |

Developer visually inspected the target-layout, focus, long-content and unavailable captures. The capture runner asserted viewport geometry, absence of horizontal overflow, preserved inspector wording, stable room placement, sprite/selector agreement, renderer focus/activation, retained and synchronization copy, unavailable/connecting copy, static reduced-motion samples and one canvas after reload. No renderer console errors were recorded.

Native `npm run dev:simulated` launched successfully. Computer Use denied native inspection. In response to the request to check both sizes, geometry, scrolling, focus/selection/clear and reload, the Product Owner reported exactly: **“Looks good”**. This is limited user-assisted native evidence; individual actions, precise key behavior and transitions were not separately reported. The final compact spacing refinement was validated in the renderer after that response. Screen-reader announcements and native OS reduced motion remain **NOT VERIFIED**.

During harness development, Electron `sendInputEvent` moved focus without reliably entering focus-visible modality. Chromium debugger keyboard dispatch produced actual `:focus-visible` without forcing pseudo-classes. A later rerun also exposed a duplicate fixture import after Vite cache-busting; the harness now imports the actual loaded script URL. These were evidence-harness limitations, not production changes or hidden PASS claims.

## Acceptance evidence

| Criterion | Developer status and supporting evidence |
| --- | --- |
| AC-01 Office dominant desktop | Implemented; full room is the principal surface in the desktop captures. Designer implementation review PASS. |
| AC-02 Page chrome recomposed | Implemented; compact shared header and room-first composition. |
| AC-03 Truthful global availability | Verified; unchanged five-copy unit cases and actual renderer phase checks; one header live region. |
| AC-04 Approved ink framing | Implemented through shell tokens; unchanged warm world. Designer implementation review PASS. |
| AC-05 Selection / inspection | Verified in existing tests and renderer selector, sprite, clear and exact inspector checks. |
| AC-06 Trusted semantics unchanged | Source/diff audit and exact state/activity/reason/freshness assertions; state derivation untouched. |
| AC-07 Distinct focus | LIMITED / USER-ASSISTED VALIDATION REQUIRED — CSS/Chromium keyboard-focus evidence exists; detailed native macOS keyboard traversal was not independently verified. The user-assisted visual observation remains limited to “Looks good”. |
| AC-08 No horizontal scrolling | Verified at 760×540, both selection states and long content; intermediate widths also checked. |
| AC-09 Compact office first | Verified DOM order, complete canvas, visible selected summary and document-scroll inspection. |
| AC-10 No fake capabilities/data | Source/scope audit; only existing truthful controls and fields. |
| AC-11 Reduced motion preserved | LIMITED / USER-ASSISTED VALIDATION REQUIRED — existing policy tests and Chromium reduced-motion emulation/static crop comparison passed; native OS preference behavior was not independently verified. |
| AC-12 Designer implementation review | PASS — completed Designer review; HIGH: none, MEDIUM: none, LOW requiring correction: none. Exact verdict recorded below. |
| AC-13 Regression suite | PASS — independently rerun regression suite passed; Developer finalization validation is recorded below. |

## Validation and scope

- Focused Application/Host/Selector/Inspector/ConnectionStatus/Summary/PresentationRuntime: **41/41** across 7 files, including 2 new application-composition tests. The new tests first failed for duplicate global status and pre-room roster order, then passed after recomposition.
- `npm test`: **282/282** — 37 importer + 244 desktop + 1 contracts. Existing loopback tests ran with the required local-network permission.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, zero errors; two known generated Phaser bundle unused-disable warnings.
- `npm run build`: PASS.
- `node --check apps/desktop/verification/capture-us-025.cjs`: PASS.
- Final offscreen capture runner: PASS; 11 unedited PNGs, zero renderer errors.
- PNG signatures/full recorded file SHA-256: 11/11 match; macOS `sips` decoded all 11 PNGs and reported expected dimensions.
- `git diff --check`: PASS.
- World/source asset and original North Star reference audit: unchanged from base. No generated output tracked, no upstream/security/contract/architecture changes.

Changed production files: `src/Application.tsx` (new shared shell), `src/main.tsx` (render it), `src/office/OfficeSceneHost.tsx` (room-first order/context and global status moved), `src/office/ConnectionStatus.tsx` (derived live styling attribute), `src/style.css` (approved shell and reflow). Tests: new `src/Application.test.tsx`. Evidence: new `verification/us-025.html`, `verification/us-025.tsx`, `verification/capture-us-025.cjs`, this report and `assets/us-025/` (11 PNGs plus capture record).

Designer and independent review are complete; Product Owner acceptance authorizes finalization. No substantive design deviation or implementation blocker identified. Detailed native keyboard checks, screen-reader verification and native OS preference remain evidence limitations; they are not inferred from tests. No US-026/027/028 scope was introduced.

## Review, acceptance and finalization status

- Designer verdict: **US-025 DESIGNER REVIEW PASS — READY FOR INDEPENDENT REVIEW**. HIGH findings: none; MEDIUM findings: none; LOW findings requiring correction: none.
- Independent Reviewer verdict: **US-025 INDEPENDENT REVIEW PASS — READY FOR PRODUCT OWNER ACCEPTANCE**. HIGH findings: none; MEDIUM findings: none; one LOW documentation/evidence inconsistency: this report still described Designer review as pending. No production/runtime correction was required. This status correction addresses that finding without changing implementation or captures.
- Product Owner final acceptance: **“I approve”**. The earlier **“Looks good”** remains a user-assisted visual observation. Final acceptance does not retroactively certify detailed native keyboard traversal, screen-reader behavior or native OS reduced-motion preference behavior.
- Independent review reported an initial sandbox loopback EPERM and an initial lint/build temporary-config race; reruns with loopback access and serial validation passed. These are historical review observations, not current finalization failures. The finalization validation reruns the focused tests, typecheck, lint, full suite, build and diff check on the accepted tree; the two known generated-bundle lint warnings remain separately identified.
- Maintainer merge and automatic story closure remain repository workflow actions. No US-026+ work is authorized by this acceptance.
