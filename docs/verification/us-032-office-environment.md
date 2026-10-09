# US-032 — Evolve the Living Office Environment verification

## Baseline and authority

- Story: [US-032 #76](https://github.com/heyitsanuar/coffee-break/issues/76), [EP-06 #74](https://github.com/heyitsanuar/coffee-break/issues/74).
- Baseline: `2b3e1d36e7a5a968e7991ef61c9148d6fce0b8d0`; local main and fetched origin/main matched. US-031 PR #81 was merged, #75 closed and #76 open before implementation.
- Branch: `feature/us-032-living-office-environment`. Evidence describes the implementation tree captured before finalization; its hashes identify the captured sources. It is not an exact-head CI result or a merge record.
- Story requirements: [approved planning](../../planning/ep-06-issues.json). Art authority: [EP-06 manifest](../design/references/ep-06/README.md), [environment study](../design/references/ep-06/ep06-environment-study.png).
- The Product Owner's approved US-032 implementation handoff authorizes the final Designer production grid. Exact furniture details were read from Designer conversation `01a0ee18-a070-7e11-8253-6f27ff9a134e`, final specification turn `01a122ac-0c17-7612-b1cc-bdb4741fb631`, message `msg_022d86c7bdb2e1ae016ac9664b486487d1835dbeafaaa46e96`. These coordinates supersede earlier engineering proposals. The study is a comparison reference; its pixels are never read by the generator.

## Implemented scope and geometry

The existing fixed scene gains original five-zone background art, two static spatial labels and Mina's approved relocation. React changes only the existing host description: “Meeting Room and Focus Room are empty decorative zones.” The accepted homepage shell, selection authority, identity plaques and lifecycle labels remain intact. No room model, occupancy, navigation, new inhabitants or US-033 selector treatment is introduced.

All following rectangles are logical half-open bounds. The room remains 320×180 RGBA, displayed at exactly 640×360; the existing game configuration keeps pixel art and disables antialiasing.

| Region | X | Y |
| --- | --- | --- |
| Lounge | [8,108) | [34,97) |
| Ari workstation | [126,188) | [44,102) |
| Mina workstation | [160,222) | [81,134) |
| Coffee | [8,136) | [99,166) |
| Meeting | [232,312) | [10,90) |
| Focus | [232,312) | [98,166) |
| Upper cross-space | [108,228) | [38,44) |
| Lounge separation | [108,126) | [44,102) |
| Right aisle | [222,228) | [38,144) |
| Lower cross-space | [136,207) | [134,144) |
| Glass separator | [228,232) | [10,166) |
| Divider | [232,312) | [90,98) |
| Meeting threshold | [228,232) | [74,86) |
| Focus threshold | [228,232) | [140,152) |
| Central entry | [145,203) | [144,170) |

| Geometry | Ari | Mina | Sol |
| --- | --- | --- | --- |
| Logical anchor | (146,87) | (180,120) | (110,141) |
| Displayed anchor | (292,174) | (360,240) | (220,282) |
| Displayed pointer rectangle | (268,118), 48×64 | (336,184), 48×64 | (196,226), 48×64 |
| Displayed selection rectangle | (269,119), 46×54 | (337,185), 46×54 | (197,227), 46×54 |
| Logical monitor frame | (156,49), 24×14 | (190,82), 24×14 | None |
| Logical monitor state field | (158,51), 20×8 | (192,84), 20×8 | None |
| Logical name center / lifecycle origin | (146,54) / (146,91) | (180,87) / (180,124) | Unchanged |
| Logical foreground strip | [141,151)×[83,85) | [175,185)×[116,118) | None |

Mina moves (-60,+33) logical pixels. Her sprite, target, outline, name and lifecycle labels derive from the migrated anchor; desk/chair, monitor field, fallback furniture and foreground strip are reconciled separately. Ari/Sol anchors stay unchanged. Desks use [130,184)×[58,80) and [164,218)×[91,113). Original rear window remains; former right shelf occupies [198,226)×[12,36).

Meeting/Focus labels are noninteractive Phaser text at logical (272,20)/(272,106), with specified backings, 12px displayed text and depth 12. Focus's decorative monitor is unlit and has no runtime overlay. Depths remain background 0, monitor/steam 1, agents 10, selection 11, labels 12 and foreground 20.

## Acceptance-criteria evidence

These are Developer verification results. Completed review gates are recorded below.

| AC | Evidence and observed result |
| --- | --- |
| AC-01 | Existing stdlib-only [room generator](../../apps/desktop/verification/author-us-026-room.py) authors both native 320×180 sheets without reading reference images. Exact buffer reproducibility test passes. |
| AC-02 | Production game configuration is unchanged. Every recorded canvas measures 640×360 CSS pixels; actual DPR/image output is recorded separately. Both-size captures show the full room. |
| AC-03 | Warm floor/wood, magenta lounge, cool walls/glass and grouped original furniture follow the approved palette/grid. Developer inspected actual captures; Designer fidelity review returned PASS with zero findings, as recorded in the Product Owner finalization handoff. |
| AC-04 | [Complete office](assets/us-032/complete-office.png) and [right-zone crop](assets/us-032/right-zones.png) show all five zones and staggered workstations. |
| AC-05 | Actual scene inventory confirms spatial text has no input handlers; exactly three sprites. Meeting's four chairs and Focus's desk/chair are empty art. Host text provides the approved decorative-zone equivalent. No trusted or room entities added. |
| AC-06 | Renderer sprite inventory confirms only canonical Ari/Mina/Sol. All character sheets are byte-identical to the baseline; existing lifecycle/identity tests pass. |
| AC-07 | Anchor/monitor/fallback tests and actual scene coordinates verify the documented Mina migration and unchanged Ari/Sol. Selection, labels and foreground align in the relationship crops. |
| AC-08 | [Ari](assets/us-032/ari-relationship.png), [Mina](assets/us-032/mina-relationship.png) and [Sol](assets/us-032/sol-relationship.png) crops show seated desk/chair and coffee relationships; no workstation is assigned to Sol. Designer fidelity review passed with zero findings and the Product Owner accepted the implementation. |
| AC-09 | PNG decoding verifies both uniform 20×8 monitor fields. Renderer compares Ari/Mina Graphics commands for each of five states; five full-room state captures expose actual marks. Independent decoded-pixel comparison also finds the two actual field regions identical for each state. Fallback uses the same fields. |
| AC-10 | Canonical Sol Waiting/exact coffee activity shows one existing steam controller at logical (115,124), over the permanent mug (117,130). Generic Waiting and Idle hide steam. Negative-predicate and retained/reduced tests pass; three Sol crops record these cases. |
| AC-11 | Background fully opaque; foreground exactly 40 opaque pixels in the two permitted strips. Existing pose/face/lifecycle visibility test uses migrated coordinates across all eight Ari/Mina lifecycle cells. Scene inventories and selected crops confirm depths/outline visibility; Sol has no foreground overlap. |
| AC-12 | Tests exercise installed Phaser Rectangle semantics and unchanged outline dimensions. Actual Chromium pointer input checks all four inside corners and four outside sides for every agent at both sizes: 24 successful inside clicks and 24 correctly unselected outside clicks. |
| AC-13 | Existing runtime/character/monitor/steam timing, generation and acknowledgement tests remain passing. Capture observes live Working monitor alternation without forcing frames/timers. Retained room decoded bitmap is identical across 1700ms while trusted meaning remains present. |
| AC-14 | Existing reduced-motion regressions pass. Chromium media-emulated Working/coffee keeps static meaning and an identical decoded room across 1700ms; no native OS preference verification is claimed. |
| AC-15 | Both-size real-renderer pointer/keyboard and request-failure fallback checks pass. Explicit scene.stop after DisplayList destruction clears maps/controllers. Remount preserves Mina selection with one canvas; reload yields one canvas. Native checklist received aggregate PO response “Looks good”; details/assistive-technology observations are not inferred. |

## Coffee and fallback

The exact coffee predicate, existing steam/motion implementation and animation timings are unchanged. The single Sol controller now also operates in simplified fallback. The fallback contains correctly translated desks/chairs, uniform monitor fields, a simple permanent mug/return ledge, two decorative zones and the same static labels. It deliberately does not reproduce detailed authored furniture.

The capture harness reuses the prior US-022 request-failure seam: the selected room PNG's byte request is cancelled, while Vite's `?import` JavaScript module passes. Background and foreground fail separately, at both window sizes; source assets are never renamed or damaged. Each fallback retains three sprites, two monitors and one canonical steam controller. Blocking is removed before shutdown/remount/reload checks.

## Capture procedure and provenance

Run from the repository root after building Electron:

```sh
npm run dev:simulated
# In a second terminal with the existing development server running:
node_modules/.bin/electron apps/desktop/verification/capture-us-032.cjs http://localhost:5173
```

[Capture record](assets/us-032/capture-record.json) identifies the baseline, timestamp, Electron version, actual outer/content/viewport bounds, DPR, canvas rectangle, selection, capture rectangle, PNG SHA-256, source hashes, tooling hash and asserted observations. Sources include the unchanged [US-031 fixture](../../apps/desktop/verification/us-031.tsx), production components and approved references. No new fixture or replacement UI is added.

All images are direct, unedited Electron capturePage outputs. Production-root images use authenticated local simulation. Other captures use production Application/store/runtime/host/scene through the existing development fixture with synthetic accepted renderer inputs. Chromium keyboard/pointer and media emulation are supplementary automated evidence, not manual keyboard, VoiceOver or OS preference observations.

The harness disables background throttling only on its capture window, keeping Phaser active when Codex occludes it. Production window options are unchanged. Initial attempts correctly encountered Phaser's hidden-window pause; those failed checks are not reported as successful evidence. Controlled asset-failure requests preserve Vite import modules. No source timing, frames or renderer image pixels are forced or edited.

Designer crops are canvas-local displayed DIP: Ari (252,88,124,116), Mina (320,162,124,106), Sol (192,200,80,112), Ari monitor (308,94,56,40), Mina monitor (376,160,56,40), right zones (456,20,168,312). Electron capturePage accepts content DIP rectangles; canvas offset is measured for every crop and native output dimensions/DPR are recorded rather than assuming a title-bar height. Five monitor-state captures show complete room context; the two separate Working monitor crops use the exact specified rectangles.

### Native observations

Computer Use permission was unavailable. The Developer-owned native `npm run dev:simulated` app was launched, and the Product Owner was asked to check both sizes: five zones/labels, seated identities, Sol mug/steam, sprite/selector/inspector agreement, Tab focus distinct from selection, activation/Clear, scrolling and reload. The actual response was **“Looks good”**. This is aggregate checklist confirmation, not a per-control transcript or an independent fidelity review. VoiceOver and native OS reduced motion remain unverified.

### Measured production-root geometry

| Outer window | Actual viewport | DPR | Canvas rectangle in content DIP | PNG dimensions |
| --- | --- | --- | --- | --- |
| 1100×760 | 1100×732 | 2 | (69,117), 640×360 | 2200×1464 |
| 760×540 | 760×512 | 2 | (60,137), 640×360 | 1520×1024 |

Both have one canvas and no horizontal overflow. These are measurements from this macOS run, not a fixed title-bar assumption. Compact content below the full room remains reachable by vertical scrolling.

### Exact capture inventory

All paths below are new files under `docs/verification/assets/us-032/`. Full hashes and per-image geometry are in the capture record. No comparison board or manually edited image is used.

| PNG | Provenance |
| --- | --- |
| [1100-production.png](assets/us-032/1100-production.png) | Production root; authenticated development simulation |
| [760-production.png](assets/us-032/760-production.png) | Production root; authenticated development simulation |
| [complete-office.png](assets/us-032/complete-office.png) | Production components; synthetic accepted renderer inputs |
| [right-zones.png](assets/us-032/right-zones.png) | Production components; synthetic accepted renderer inputs |
| [ari-relationship.png](assets/us-032/ari-relationship.png) | Production components; synthetic accepted renderer inputs |
| [mina-relationship.png](assets/us-032/mina-relationship.png) | Production components; synthetic accepted renderer inputs |
| [sol-relationship.png](assets/us-032/sol-relationship.png) | Production components; synthetic accepted renderer inputs |
| [monitors-idle.png](assets/us-032/monitors-idle.png) | Production components; synthetic accepted renderer inputs |
| [monitors-working.png](assets/us-032/monitors-working.png) | Production components; synthetic accepted renderer inputs |
| [ari-monitor.png](assets/us-032/ari-monitor.png) | Production components; synthetic accepted renderer inputs |
| [mina-monitor.png](assets/us-032/mina-monitor.png) | Production components; synthetic accepted renderer inputs |
| [monitors-waiting.png](assets/us-032/monitors-waiting.png) | Production components; synthetic accepted renderer inputs |
| [monitors-completed.png](assets/us-032/monitors-completed.png) | Production components; synthetic accepted renderer inputs |
| [monitors-error.png](assets/us-032/monitors-error.png) | Production components; synthetic accepted renderer inputs |
| [sol-canonical.png](assets/us-032/sol-canonical.png) | Production components; synthetic accepted renderer inputs |
| [sol-generic-waiting.png](assets/us-032/sol-generic-waiting.png) | Production components; synthetic accepted renderer inputs |
| [sol-idle.png](assets/us-032/sol-idle.png) | Production components; synthetic accepted renderer inputs |
| [retained.png](assets/us-032/retained.png) | Production components; synthetic accepted renderer inputs |
| [1100-keyboard-selection.png](assets/us-032/1100-keyboard-selection.png) | Production components; synthetic accepted renderer inputs; Chromium keyboard input |
| [760-keyboard-selection.png](assets/us-032/760-keyboard-selection.png) | Production components; synthetic accepted renderer inputs; Chromium keyboard input |
| [no-state.png](assets/us-032/no-state.png) | Production components; synthetic accepted renderer inputs |
| [reduced-motion.png](assets/us-032/reduced-motion.png) | Production components; synthetic accepted renderer inputs; Chromium media emulation |
| [1100-fallback-background.png](assets/us-032/1100-fallback-background.png) | Production components; synthetic accepted renderer inputs; controlled Chromium room-PNG request failure |
| [760-fallback-background.png](assets/us-032/760-fallback-background.png) | Production components; synthetic accepted renderer inputs; controlled Chromium room-PNG request failure |
| [1100-fallback-foreground.png](assets/us-032/1100-fallback-foreground.png) | Production components; synthetic accepted renderer inputs; controlled Chromium room-PNG request failure |
| [760-fallback-foreground.png](assets/us-032/760-fallback-foreground.png) | Production components; synthetic accepted renderer inputs; controlled Chromium room-PNG request failure |

## Asset integrity and reproducibility

Run `python3 apps/desktop/verification/author-us-026-room.py` twice and compare complete SHA-256 values using `shasum -a 256` on both output PNGs. The automated asset test additionally executes the script twice via Python runpy and compares both generated buffers to the actual production files without writing them.

| Output | Full PNG-file SHA-256 |
| --- | --- |
| Background | `82bb56af1eb45452ae9f2a2c180b2dd32a61284e5d05a10af4aa4808edca597c` |
| Foreground | `14bc2328a18daae8de1c96f222f7561cc5dd327aeb0819c6db1460128863465a` |

Both decode as 320×180 RGBA. Background alpha is 255 everywhere; foreground alpha is binary, with exactly 40 opaque pixels and none outside the permitted strips. Character atlases, approved design references, historical evidence, dependencies, shell/navigation/styles, runtime/contract and Electron boundaries are byte-identical to baseline.

## Validation

| Check | Result |
| --- | --- |
| Focused office suites | PASS — 145/145 tests across 9 files |
| `npm test` | PASS — 323/323: 54 importer, 268 desktop, 1 contracts |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — zero errors; two existing unused-eslint-disable warnings in ignored generated Phaser bundle |
| `npm run build` | PASS — main, preload and renderer |
| `git diff --check` | PASS |
| Capture script `node --check` / generator Python compile | PASS; no bytecode written |
| Generator execution twice | PASS — both complete PNG hashes identical |
| Asset/capture decoding and recorded dimensions/hashes | PASS — both room PNGs and all 26 captures readable |
| Capture source/tooling hashes | PASS — 154 source files and the capture tool match the recorded tree |
| Direct monitor-field decoded-pixel comparison | PASS — both monitor fields identical in each of five state images |
| Character atlases / approved references / protected boundaries | PASS — unchanged against baseline |
| Renderer assertions | PASS — 26 captures, zero renderer console errors |
| Documentation links / scope audit | PASS — all 51 relative links resolve; exact authorized 12 modified and 29 new files |
| Index / generated output audit | No staged changes; no tracked `apps/desktop/out` files |

The first sandboxed workspace test attempt failed 23 ingress cases because loopback listen was denied (`EPERM`), including one resulting unavailable-port assertion. The required rerun with authorized local loopback access passed all 323 tests. No application change was made to compensate for sandbox restrictions.

The focused command was:

```sh
npm test -w @coffee-break/desktop -- --reporter=dot src/office/officeLayout.test.ts src/office/OfficeScene.test.ts src/office/workstationPresentation.test.ts src/office/agentAssets.test.ts src/office/OfficeSceneHost.test.ts src/office/officePresentation.test.ts src/office/coffeeSteamPresentation.test.ts src/office/applyOfficeVisual.test.ts src/office/officePresentationRuntime.test.ts
```

The Developer-owned native/dev and capture processes were stopped after verification. Reproduction uses the commands above.

## Changed-file inventory

Reviewed pre-commit inventory: 12 modified tracked files:

- [apps/desktop/src/office/OfficeScene.test.ts](../../apps/desktop/src/office/OfficeScene.test.ts)
- [apps/desktop/src/office/OfficeScene.ts](../../apps/desktop/src/office/OfficeScene.ts)
- [apps/desktop/src/office/OfficeSceneHost.test.ts](../../apps/desktop/src/office/OfficeSceneHost.test.ts)
- [apps/desktop/src/office/OfficeSceneHost.tsx](../../apps/desktop/src/office/OfficeSceneHost.tsx)
- [apps/desktop/src/office/agentAssets.test.ts](../../apps/desktop/src/office/agentAssets.test.ts)
- [apps/desktop/src/office/assets/office-room-background.png](../../apps/desktop/src/office/assets/office-room-background.png)
- [apps/desktop/src/office/assets/office-room-foreground.png](../../apps/desktop/src/office/assets/office-room-foreground.png)
- [apps/desktop/src/office/officeLayout.test.ts](../../apps/desktop/src/office/officeLayout.test.ts)
- [apps/desktop/src/office/officeLayout.ts](../../apps/desktop/src/office/officeLayout.ts)
- [apps/desktop/src/office/workstationPresentation.test.ts](../../apps/desktop/src/office/workstationPresentation.test.ts)
- [apps/desktop/src/office/workstationPresentation.ts](../../apps/desktop/src/office/workstationPresentation.ts)
- [apps/desktop/verification/author-us-026-room.py](../../apps/desktop/verification/author-us-026-room.py)

29 untracked files:

- [Capture harness](../../apps/desktop/verification/capture-us-032.cjs).
- This verification report (`docs/verification/us-032-office-environment.md`).
- [Capture record](assets/us-032/capture-record.json).
- The 26 PNGs listed individually in the capture inventory above.

Tracked diff: 12 files, 279 insertions and 94 deletions plus the two binary PNG updates. New evidence/tooling/report are not included in plain `git diff --stat` because they remain untracked. These counts describe the reviewed pre-commit tree, whose index was empty and HEAD remained at the baseline; they do not identify a finalization commit or exact-head CI result.

## Limits and next gate

No new trusted state, lifecycle semantics, timing, credentials, contracts, Connector, transport, mirror, preload/IPC or dependencies. No US-033+ implementation. No approved-reference or historical-evidence change. No generated build output is tracked. At the Developer verification handoff, all changes were unstaged/uncommitted and no push, PR or GitHub mutation had been performed. Artwork, captures and capture metadata are preserved during finalization.

No approved design deviation is proposed. The Product Owner's 2026-10-09 finalization handoff records Planner scope review PASS, Designer fidelity review PASS with zero findings, independent technical review PASS with zero findings and explicit Product Owner implementation acceptance. Commit, push, PR creation and exact-head CI verification are authorized; merge remains a Product Owner action. US-033 has not begun.

The independent Reviewer reported 69 focused tests passing, but could not complete the full suite because sandbox loopback listen was denied (`EPERM`). The Developer's complete 323/323 run is recorded above. Native VoiceOver and native macOS reduced motion remain unverified; completed review gates do not change these evidence limitations.
