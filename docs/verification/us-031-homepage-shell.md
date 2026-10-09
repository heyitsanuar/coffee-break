# US-031 — North Star Homepage Shell verification

Developer implementation evidence, 2026-10-09. **Ready for Planner scope review and Designer fidelity review; independent review and Product Owner acceptance of the implementation remain subsequent gates.** This report does not approve or complete the story.

## Baseline and authority

- Branch: `feature/us-031-homepage-shell`, created directly from fetched `origin/main`, `5526d819792d42acf8ae0bf52e1daedb8388b557` (merged EP-06 planning PR #73). The tree and index were clean before implementation.
- [US-031 #75](https://github.com/heyitsanuar/coffee-break/issues/75) was OPEN; its dependency [US-030 #64](https://github.com/heyitsanuar/coffee-break/issues/64) was CLOSED. The issue agrees with [planning data](../../planning/ep-06-issues.json).
- Design authority: [original North Star](../design/references/north-star/), [approved EP-06 package](../design/references/ep-06/README.md), and the accepted bounded US-031 Designer specification from **Agent | Designer**, conversation `01a0ee18-a070-7e11-8253-6f27ff9a134e`, turn `01a1218e-db28-7220-96f5-88ac20e6641d`, final message `msg_022d86c7bdb2e1ae016ac91ccc383087d186014082707153d3`. The Product Owner's US-031 implementation authorization explicitly approves that specification and supplies matching measurements/copy. It was retrieved read-only; no message was sent to another agent.

## Implemented scope

Three production files change: [Application](../../apps/desktop/src/Application.tsx), [OfficeSceneHost](../../apps/desktop/src/office/OfficeSceneHost.tsx), and [CSS](../../apps/desktop/src/style.css). Existing components, selection ownership, mount effects, direct presentation subscriptions and cleanup remain in place.

The navy shell adds Office / Agents / Projects native buttons, one local last-activated indicator, a static Studio toolbar, canonical inhabitant count, disabled Expand and an honest Sample reservation. The inspector and existing selector retain their content/behavior. Only three destination headings have `tabIndex=-1`; there is no positive tabindex. Navigation focuses the heading with `preventScroll`, then uses immediate `scrollIntoView` with 12px scroll margin. Natural document scroll limits apply; desktop content can already fit without any scroll. No URL/history API is used.

The toolbar uses a 1px inset decorative edge, preserving its 40px outer height with a 32px button and 4px vertical padding. Interactive boundaries retain the specified separate `#637D99` token. Compact layout stacks at renderer width 1039px or below and places the existing selected summary before Agents.

No office art, character art, Phaser scene/game/layout, selector, inspector, trusted state/runtime, contracts, Electron, preload/IPC, transport, simulator, dependencies, planning or historical verification files change. No later-story content is introduced.

## Acceptance-criteria evidence

| AC | Evidence and observed result |
| --- | --- |
| AC-01 | Approved navy/blue tokens and type hierarchy; coffee selection and cyan focus remain distinct. Actual computed contrast results below. Desktop/compact images visually inspected. Designer implementation fidelity verdict remains pending. |
| AC-02 | Application test confirms exactly three native navigation buttons in `Homepage sections`, one h1 and one global status. No sidebar. |
| AC-03 | Actual Electron keyboard activation focuses the Office — Studio, Agents and Projects headings. Compact Agents/Projects are reached by document scroll. |
| AC-04 | Full fixture URL, including `?evidence=us031#preserve-this-hash`, is identical before/after all six navigation cases. No router/history/IPC edits. |
| AC-05 | Read-only identity comparisons show the same scene, game, canvas and store snapshot through every navigation case; Mina remains selected. Accepted state changes continue afterward. |
| AC-06 | `MOCK_AGENTS.length` supplies `3 inhabitants`; fixture checks preserve it in connected, disconnected retained, synchronizing and unavailable/no-state conditions. Initial connecting markup also contains it. No Online count. |
| AC-07 | Native disabled Expand has no handler, is described by the visible exact future-update explanation and remains at the toolbar's right. Unit markup and actual capture evidence. |
| AC-08 | Canvas remains 640×360 CSS pixels, art remains 320×180 at integer 2×. Protected source/assets are byte-identical to baseline. |
| AC-09 | One existing truthful global status; five connection-copy unit cases pass. Fixture confirms retained/synchronizing/current/no-state presentation and canonical count. |
| AC-10 | Measured 1100×760 outer window: 964px centered composition, 642px office column, 18px gap and 304px rail; inspector aligns with toolbar. |
| AC-11 | Measured 760×540 outer window: complete office fits inside actual 760×512 viewport; later content uses vertical document scroll. No horizontal overflow. |
| AC-12 | Agents heading immediately precedes the existing selector. Agents navigation reaches the region below the compact initial viewport. No portrait-first redesign or new roster content. |
| AC-13 | Chromium Tab/Shift+Tab, Enter/Space, ≥44px navigation targets, correct heading focus and 3px cyan outlines pass. Focus alone does not change agent selection. User-assisted native confirmation below; no screen-reader claim. |
| AC-14 | Existing selection/inspection/Clear, pointer hit testing for all three sprites, lifecycle/availability while focused, reduced-motion static room, reload and remount one-canvas checks pass. Existing race/trust/lifecycle regressions remain passing. |

## Actual Electron geometry

The harness calls native `setSize`, measures `getBounds`, `getContentBounds`, `innerWidth/innerHeight` and DOM rectangles. It uses neither a fixed title-bar subtraction nor a content-size override. Electron 37.10.3 on macOS, DPR 2; renderer zoom unchanged.

| Measurement (CSS pixels) | Desktop | Compact |
| --- | --- | --- |
| Native outer window | 1100×760 | 760×540 |
| Actual content viewport | 1100×732 | 760×512 |
| Header height | 56 | 80 |
| Composition width / x | 964 / 68 | 642 / 59 |
| Toolbar x, y, width, height | 68, 68, 642, 40 | 59, 88, 642, 40 |
| Bordered room width, height | 642, 362 | 642, 362 |
| Canvas x, y, width, height | 69, 117, 640, 360 | 60, 137, 640, 360 |
| Canvas bottom | 477 | 497, within 512px viewport |
| Horizontal overflow | None | None |
| PNG dimensions at DPR 2 | 2200×1464 | 1520×1024 |

Widths 1040, 1039, 900 and 760 were checked at outer height 540: composition widths are respectively 964, 642, 642 and 642; no horizontal overflow, canvas resizing or navigation remount. Full long Activity/Reason content at 125% root text remains exact and reachable by vertical scrolling, with no nested inspector scroll or horizontal overflow. Enlarged text may grow the header/document; no clipping or fractional canvas scaling is used to force everything above the fold.

## Captures and provenance

[Capture record](assets/us-031/capture-record.json) contains timestamps, native/content bounds, viewport/DPR, geometry, URL, focus/selection, continuity assertions, contrast and SHA-256 hashes of sources and PNG file bytes. PNGs are unedited `webContents.capturePage().toPNG()` output, not reconstructed images. The first two use the production root and authenticated local simulator. The others use production components/store/runtime/Phaser with explicitly synthetic accepted renderer inputs; they do not prove transport behavior.

| Capture | Purpose |
| --- | --- |
| [01 — Desktop](assets/us-031/01-desktop-production.png) | Production-root shell, current information and unchanged office |
| [02 — Compact](assets/us-031/02-compact-production.png) | Production-root full room inside measured viewport |
| [03 — Agents destination](assets/us-031/03-compact-agents-focus.png) | Focused heading and reachable unchanged selector |
| [04 — Projects destination](assets/us-031/04-compact-projects-focus.png) | Focused honest Sample reservation |
| [05 — Retained](assets/us-031/05-desktop-retained.png) | Global disconnected copy and retained exact inspection |
| [06 — Focus versus selection](assets/us-031/06-compact-agent-focus.png) | Cyan Sol keyboard focus while Mina remains coffee-selected |
| [07 — Enlarged inspection](assets/us-031/07-compact-enlarged-inspection.png) | Long exact Activity/Reason at 125% root text |
| [08 — No state](assets/us-031/08-compact-no-state.png) | Unavailable global status, canonical inhabitants and unchanged office |

The development-only [fixture](../../apps/desktop/verification/us-031.tsx) delegates to the existing production scene creation and observes its instance without forcing frames, timers or selection. It follows the US-030 accepted-message fixture pattern; verification HTML is excluded from the production renderer entry. [Capture runner](../../apps/desktop/verification/capture-us-031.cjs) uses the built production main/window/security configuration and the local development server.

Reproduce from repository root using installed dependencies, without installation:

```sh
npm run dev:simulated
# In a second terminal, while the local server is running:
node_modules/.bin/electron apps/desktop/verification/capture-us-031.cjs http://localhost:5173
```

The runner launches a separate verification window and exits it when finished. Its Chromium input anchor is programmatic; the actual traversal/activation uses Tab/Shift+Tab/Enter/Space. That is automation evidence, not a substitute for manual native observations. Reload/remount deliberately creates a replacement game after the navigation continuity checks; these are separate cleanup scenarios.

## Accessibility and contrast

Computed RGB backgrounds are opaque actual rendered surfaces; transparent inactive navigation inherits Header. Measured WCAG luminance ratios:

| Pair | Ratio |
| --- | --- |
| Brand/inactive navigation on Header | 15.36:1 |
| Active navigation on Control | 12.78:1 |
| Toolbar muted/Projects copy on Panel | 8.15:1 |
| Sample label on Panel | 5.08:1 |
| Interactive boundary on Control | 3.52:1 |
| Current text on Header | 10.21:1 |
| Cyan focus on Canvas | 12.29:1 |

Navigation and destination outlines are 3px with 3px offset. Agent coffee selection/pressed state and cyan focus remain independent. Semantic inspection and polite status/selection feedback are preserved. Disabled Expand is outside the normal Tab sequence and its explanation is visible/associated. No new animated scroll or reduced-motion exception exists.

**User-assisted native observation:** after the Developer launched `npm run dev:simulated`, the Product Owner was asked to check both target sizes, full crisp room/no horizontal scrolling, vertical access to Agents/Projects, navigation heading focus, cyan focus distinct from selection, Tab/Enter/Space, selection, Clear and reload. The reply was: **“Everything you mentioned works”**. This records aggregate confirmation of that checklist, not an independently timed native session or a detailed per-control transcript. Automated evidence above supplies explicit case results.

**Unverified:** VoiceOver/screen-reader announcements and native OS reduced-motion preference behavior. The request explicitly excluded those claims unless tested; the aggregate response does not establish them. Reduced-motion evidence here uses Chromium media emulation and compares identical decoded room pixels over 1600ms.

## Validation

| Command/check | Result |
| --- | --- |
| Focused desktop suite: Application, OfficeSceneHost, ConnectionStatus, AgentSelector, AgentInspectionPanel, officePresentationRuntime | 39/39 PASS |
| `npm test` | 318/318 PASS: importer 54, desktop 263, contracts 1 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; two pre-existing unused eslint-disable warnings in generated Phaser bundle; zero errors |
| `npm run build` | PASS |
| Strict standalone TypeScript check of `verification/us-031.tsx` | PASS |
| `node --check apps/desktop/verification/capture-us-031.cjs` | PASS |
| Actual Electron runner | PASS: eight captures, navigation/URL/game continuity, runtime, pointer/keyboard, availability, breakpoint, text enlargement, reduced motion, cleanup; no renderer errors |
| PNG decoding/file hashes and source-hash audit against final capture record | PASS |
| Protected source/assets comparison against baseline | PASS; only the three authorized production files differ |
| Relative report links and `git diff --check` | PASS |

The new markup checks were observed failing before implementation, then passing. Initial capture-harness issues (desktop already at its natural scroll limit, programmatic versus keyboard focus mode, asynchronous fixture invocation) were corrected in verification code; final runner assertions pass. No production defect was exposed by those harness corrections.

## Limits, intentional differences and handoff

This is the bounded US-031 shell, not the complete illustrated EP-06 homepage: accepted EP-05 artwork, agent plaques, selector and inspector remain; five-zone environment, portrait-first roster, Recent Activity/Harbor, Worlds and functional Expand remain deferred. The approved bounded spec intentionally uses an 80px compact header and 40px toolbar rather than the full-epic prototype's denser chrome. Enlarged-text verification is 125% root text, not browser page zoom or exhaustive accessibility certification.

No files are staged. No commit, push, PR, GitHub issue mutation, dependency installation or next-story implementation was performed. Generated build output remains ignored/untracked by Git. The development app remains available for review.

Next gate: Planner scope review → Designer fidelity review → independent technical review → Product Owner implementation acceptance. Finalization needs separate authorization.
