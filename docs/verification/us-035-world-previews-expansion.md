# US-035 — World previews and office expansion verification

## Scope, authority and baseline

Story: [US-035 #79](https://github.com/heyitsanuar/coffee-break/issues/79). Epic: [EP-06 #74](https://github.com/heyitsanuar/coffee-break/issues/74).

Implementation branch: `feature/us-035-world-previews-expansion`. Uncommitted baseline: `2617312e0a307a4d5a8d36e12be27f840d826da2`, the verified merged US-034 main. Local main, origin/main and GitHub main matched at authorization; PR #84 was merged, #78 closed, #79 and #74 open. US-031–US-033 dependencies were closed and present. Issue #79 was cross-checked against [planning](../../planning/ep-06-issues.json) with no acceptance-criteria drift.

Product Owner authorization is the approved implementation handoff artifact `479ca95a-057d-4256-9657-eadb6a2681f0`, approving complete D1–D10 including the sticky toolbar. [EP-06 manifest](../design/references/ep-06/README.md) and [North Star 03](../design/references/north-star/coffee-break-north-star-03.png) remain authoritative references. They are design studies, not runtime evidence. Accepted US-031–US-034 behavior remains protected. Graphify was scoped navigation assistance only; its stale graph was not refreshed or used as implementation authority. Coffee Break guidance and approved scope override Ponytail lite guidance.

## Implementation and ownership

React owns one `expanded` boolean, a stable invoking-button ref and a saved scroll ref. `useLayoutEffect` restores focus with `preventScroll` and scrolls only after the mode layout commits. Restoration is synchronous: there are no delayed callbacks to cancel. A scoped effect registers Escape only while expanded and removes it on exit/unmount. The existing toolbar ResizeObserver maintains navigation scroll clearance as text grows. The office-scoped React focus handler corrects keyboard-visible controls above/below the usable viewport instantly, excluding toolbar controls and pointer focus; it does not intercept Tab or rewrite focus order. A separately cleaned-up layout observer measures the single gallery’s placement/reserved extent inside the independent desktop column composition; it updates synchronously on mode commit and observes intrinsic height changes.

The same OfficeSceneHost, host DOM parent/key, scene effect, canvas, game, scene, selector, inspector, ConnectionStatus, trusted store and presentation runtime remain mounted. CSS changes composition without portals, DOM reparenting, camera zoom, fractional canvas transforms, new windows, fullscreen, IPC or trusted-state changes. Worlds and Sample use native `hidden` wrappers while preserving their mounted disclosure state. The general header navigation is hidden while expanded; availability remains one live status region.

Worlds has exactly Studio Current / Retro 70s Preview / Arcade 80s Preview / Cyber 2000 Preview. Studio is static information. Three independent native details/summary controls expose the exact approved descriptions and unavailable-world explanation. Studio toolbar access focuses Worlds without URL or navigation-state mutation; expanded Studio is disabled. No world switching, persistence or extra runtime subscriptions exist.

Normal desktop composition is 964px with independent 642px office and 304px contextual-rail flows separated by 18px. Worlds is 342px and Agents 288px below the room. The single gallery stays between Inspector and Sample in DOM order, with its desktop position measured from the actual context edge; reserved column extent keeps open gallery/rail content reachable without stretching the office’s internal gaps. Compact and expanded layouts use that same DOM without relocation or duplication. Expanded desktop is 642px at x=229 for a 1100px renderer, with lower panels 288px + 12px + 342px. Compact is 642px at x=59 for a 760px renderer and follows the approved stacked order. The canvas remains 640×360. Toolbar minimum is 52px but grows intrinsically; complete room access uses natural scrolling and dynamic toolbar clearance.

## Derived artwork provenance

[Derivative manifest](../../apps/desktop/src/office/assets/world-preview-provenance.json) records full source/output hashes, dimensions, exact crop, operation and approval artifact for each image.

North Star 03 is 1536×1024, SHA-256 `746acf3b8089eeaed5b28e268467cf3954f3c8fbb7f0867b18a06643b55f5867`. Future crops are exactly 66×53, saved with Pillow `Image.crop((x, y, x + width, y + height))`, without resize, recolor or regeneration. Source bounds/dimensions/hashes were checked before derivation. The integrity audit independently compares every decoded crop row to the source region using Electron nativeImage.

| World | Rectangle x,y,w,h | Output SHA-256 |
| --- | --- | --- |
| Retro 70s | 288,847,66,53 | `d53b2a2f9bd52ee35f4766e6244e175dc731a4fcb562528d814113f05be972c9` |
| Arcade 80s | 356,847,66,53 | `8e9448b272fbbd307732e96be05a4bf6820ddcc3c6e1b007bee1ec26fe006dc8` |
| Cyber 2000 | 492,847,66,53 | `0affb5753bbb9612f2ebf19895ee22c91d4bcbb79bcc96826f9f5c463bf19949` |

Studio uses the unchanged complete 320×180 authored background, displayed at 64×36 in a 68×55 frame. Its SHA-256 is `82bb56af1eb45452ae9f2a2c180b2dd32a61284e5d05a10af4aa4808edca597c`. All thumbnails use empty alt text with adjacent equivalent text. Original design PNGs and historical evidence remain unchanged.

## Original Electron evidence and reproducibility

Start the existing native development app with `npm run dev:simulated`, then run from the repository root:

```sh
node_modules/.bin/electron apps/desktop/verification/capture-us-035.cjs http://localhost:5173
node_modules/.bin/electron apps/desktop/verification/verify-us-035.cjs
```

Capture uses the actual built Electron main and preload, preserving security configuration. Two `*-production` captures use the production root with authenticated local simulation. Remaining captures use the development-only US-035 fixture and unchanged production Application, store, runtime and scene with explicitly synthetic accepted inputs. This is original `webContents.capturePage()` output, not edited/composed screenshots. Fixture inputs and Chromium debugger keyboard/media emulation are supplemental automated renderer evidence, not manual native keyboard/VoiceOver/macOS OS-motion observations. Programmatic focus positions the automation starting point; actual Chromium Tab/Shift+Tab/Space/Enter operate controls thereafter.

[Capture record](assets/us-035/capture-record.json) records timestamp, actual outer sizes, content bounds, viewport, DPR, selected information, scroll, root text, focused-control geometry, source hashes, PNG hashes and decoded image/layout correspondence. Outer sizes are 1100×760 / 760×540; renderer content is 1100×732 / 760×512 at DPR 2 on this machine. Four consecutive stable layout frames are required within 2500ms, at most six capture retries; before/after geometry must match exactly.

The story-specific image checker retains the historical 90% border correspondence threshold, ±2 physical pixels and channel tolerance 10. It checks only visible, unoccluded borders and excludes only the recorded focused control's outline rectangle. Integrity validates that mask against focus geometry and rejects arbitrary replacement masks and mismatched geometry. Original US-031–US-034 scripts/captures were not weakened or rewritten. Earlier capture-tool attempts failed on a non-cloneable instrumentation result and occluded/focused border sampling; these were harness issues corrected before successful capture, not silently accepted product evidence.

### Identity, state, focus and scroll observations

- Real scene/game/canvas/host/store/runtime/status/selector/inspector object references remain identical through two size episodes and 10 cycles each. Continuity uses `fixture.update()` / `fixture.connection()`, never reset/remount. Active counts stay store=1, runtime=2, acknowledgements=1, watch=1. The observer counts the named Application Escape handler, separately from Phaser keyboard input: one while expanded and zero after returning. Synthetic pagehide invokes the fixture’s existing production-component unmount/cleanup and destroys the canvas and leaves zero Escape listeners and zero store/runtime/acknowledgement/watch subscriptions; subsequent reload recreates one canvas.
- All three previews open together; Enter collapses/reopens the final one. Trusted snapshot equality and Mina selection remain intact. Preview/Harbor disclosure state survives both return paths.
- Lifecycle/activity changes update the same selected inspection while expanded. Disconnected and synchronizing retain truthful last-known semantics. Separate unselected and selected-no-state episodes are explicitly supplemental; selected-no-state overrides presentation only and is not claimed as a valid incomplete trusted mirror. A reset occurs outside continuity proof to restore the fixture before coffee checks.
- Installed sprite `play()` and scene acknowledgement methods are observed while delegating unchanged behavior. Mode transitions add no calls. A positive trusted Working→Completed transition delivers one acknowledgement; mode toggles replay none.
- Saved scroll returns unchanged at both sizes; resizing/shortening the document while expanded restores the clamped maximum rather than overwriting saved scroll. Desktop saved/restored scroll is 568px; compact is 1423.5px (`observations.continuity`). In the resize/clamp case saved=1404px, new maximum=68px, restored=68px (`observations.clamping`). Exit/Escape restore visible cyan focus on the same invoking Expand button without changing identity or URL.
- Both sizes at 100%, 125%, 200% root text have no horizontal overflow. Full room reachability is asserted separately after layout settlement; room scroll targets account for sticky clearance and toolbar line-height scales with enlarged text; selected inspection can scroll naturally. Focused selectors remain at least 6px clear of the sticky toolbar, including their outline. Tab/Shift+Tab, Enter, Space and Clear are exercised; focus alone does not select and Clear retains focus. Projects works after Exit. Reload yields one canvas and normal mode.
- Exact Sol coffee and generic-waiting negative case remain distinct. Chromium reduced-motion emulation preserves static meaning. Existing scene/host/motion cleanup and security tests pass unchanged.

### Native user evidence and limitations

The Product Owner was asked to check both sizes, previews, mode continuity, focus/scroll, keys, Clear, Projects and reload. Their actual reply was: “Each click collapses the world selected, but if I click another, apparently the previous stays open”. This corroborates independent preview disclosure behavior only, which is intentional. No broader native PASS is inferred. Computer Use access was unavailable; no native automation was substituted. Full manual native keyboard/focus/scroll, VoiceOver and native OS reduced motion remain unverified. Designer and technical re-review of the corrected tree, and Product Owner implementation acceptance, remain separate pending gates; the prior technical PASS is recorded in the correction chronology below.

## F1–F4 focused design-fidelity correction

Planner authorization: artifact `5db13210-8ae1-4839-a8b4-d2af053b0628`. Starting branch/HEAD, exact 4 tracked / 58 untracked inventory, empty index and no feature commits were reverified. The existing implementation was retained; only F1–F4 were corrected. Prior independent technical review was PASS. Designer review was FAIL with three MEDIUM and one LOW finding. Product Owner implementation acceptance has not occurred. These corrections require re-review and do not inherit approval automatically.

### Root causes and corrections

- **F1:** CSS placed Worlds before Sample visually in compact mode, but DOM placed the full Inspector/Sample rail before Worlds. The single Worlds wrapper now sits after Inspector and before Sample inside the rail. This gives Agents → Inspector → Worlds → Sample in DOM, forward/reverse keyboard order and the exposed Chromium accessibility tree. No positive tabindex, duplicate panels, canvas reparenting or custom keyboard-order handler.
- **F2:** scroll-margin cannot force Chromium to scroll an already-visible control clear of a sticky toolbar. An office-composition `onFocusCapture` handles only native button/summary keyboard-visible focus outside the toolbar. It scrolls instantly only when the top clearance is less than 6px or the bottom focus outline would be clipped. Pointer focus is excluded via `:focus-visible`; a real Chromium pointer click proves no scroll change. Toolbar focus during Exit/Escape is excluded, so saved scroll restoration remains unchanged. No global listener, timer, smooth animation or new key handler was added.
- **F3:** the spanning grid rail contributed height to the shared office rows. Normal desktop now uses independent flex-column wrappers. The rail retains natural Inspector/Sample flow. A bounded local ResizeObserver anchors the one gallery beside Agents and reserves the gallery/rail extent; height is not distributed into gaps between toolbar, room, context or lower content. No inner scrollbars, responsive breakpoint changes or mode-specific canvas parents. Observer cleanup is explicit.
- **F4:** the heading inherited the action-oriented Studio button name. The existing Office destination heading now has the explicit accessible name `Office — Studio`; the separate button keeps its normal action name and expanded disabled name. The existing region still uses that heading via aria-labelledby.

### Before/after measurements and provenance

Before figures below are the independent Designer measurements quoted in the authorized correction brief, not newly reproduced Developer measurements. After figures come from the original Electron record. F1’s corrected forward order is Clear → Retro 70s → Arcade 80s → Cyber 2000 → Harbor; the former Clear → Harbor → Retro order no longer exists. All reverse entries, including the last control, are reached using genuine Shift+Tab after keyboard wrap; no programmatic focus or viewport prepositioning is used for this keyboard matrix. Layout measurements separately use document-top positioning to measure normal flow rather than a sticky toolbar’s scrolled rectangle.

| Finding / case | Designer before | Developer after |
| --- | --- | --- |
| F1 compact reading/Tab order | Inspector → Sample → Worlds | Inspector → Worlds → Sample |
| F2 compact normal 100%, Retro | top 17px; toolbar bottom 60px; −43px clearance | 239.5px top; 60px toolbar bottom; 179.5px clearance |
| F2 desktop expanded 200%, initial no-state/no-selection Clear | top 136px; toolbar bottom 132px; 4px clearance | top 138px; toolbar bottom 132px; 6px clearance, both native entry directions |
| F3 100% canvas start, short → long | 129px → 187.75px | 129px → 129px |
| F3 100% canvas-to-Worlds gap, short → long | 33px → 150.5px | 37px → 37px |
| F3 200% canvas-to-Worlds gap, long | 598px | 53px |
| F4 heading | Studio, current authored world. View Worlds | Office — Studio; separate Studio action unchanged |

The former F3 canvas-to-Worlds gap values are quoted as reported by Designer; the new metric explicitly uses the decoded canvas’s document bottom to Worlds’ document top. The long fixture activity is 495 characters (within the existing 512-character transport limit) plus the existing capacity-exhausted reason.

| Root text | Canvas top short/long | Toolbar→room | Room→context | Context→Worlds / Agents | Canvas→Worlds short/long | Inspector→Sample short/long | Inspector height short→long | Sample top short→long |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |


| 100% | 129 / 129 | 8px | 8px | 12px / 12px | 37 / 37px | 12 / 12px | 221 → 551px | 301 → 631px |
| 125% | 130 / 130 | 8px | 8px | 12px / 12px | 40.9921875 / 40.9921875px | 15 / 15px | 257.5 → 745px | 340.5 → 828px |
| 200% | 226 / 226 | 8px | 8px | 12px / 12px | 53 / 53px | 24 / 24px | 409 → 1669px | 570 → 1830px |

All office-column position/gap deltas between short and long content are zero (0.01px assertion tolerance). Inspector growth moves Sample by exactly the same height delta; its existing 0.75rem gap remains 12/15/24px at 100/125/200%, rather than being incorrectly forced to 12px at every text size.

### Keyboard and accessibility-tree evidence

Twelve fresh-document cases cover both sizes × normal/expanded × 100/125/200%. Normal live/unselected cases traverse all thirteen native controls. Expanded initial no-state/no-selection cases traverse all five enabled controls. The full forward order is recorded, then Tab wraps to the first control and Shift+Tab reaches every control in reverse. There are 216 geometrically checked focus records. All below-toolbar controls have at least 6px top clearance and at least 6px bottom outline clearance; toolbar controls and unrelated header navigation are excluded from that office-specific assertion. Selection and trusted snapshots remain unchanged during traversal.

Normal: Office → Agents → Projects → Studio → Expand → Ari → Mina → Sol → Clear → Retro 70s → Arcade 80s → Cyber 2000 → Harbor. Expanded: Exit → Ari → Mina → Sol → Clear. Reverse is the exact inverse in each case. Twenty-four new focus captures preserve both directions; six new short/long-flow captures preserve the independent-column measurements.

`Accessibility.getFullAXTree` is walked using parent/child IDs, including traversal through ignored wrapper nodes, rather than assuming the returned flat array is reading order. Exposed normal headings are Coffee Break → Office — Studio → Agents → Select an inhabitant → Worlds → Recent Activity → Projects — Harbor. Expanded exposes Office — Studio → Agents → Select an inhabitant; hidden navigation, Worlds and Sample do not appear. Disabled Studio remains exposed with its informational name but is absent from the expanded Tab order. All native button/disclosure names and order are independently validated by the integrity audit. This is Chromium accessibility-tree evidence, not VoiceOver testing.

## Acceptance-criteria traceability

The original 18 criteria are reproduced below; developer evidence is not independent approval.

| AC | Original requirement | Evidence |
| --- | --- | --- |
| 01 | Worlds shows exactly Studio — Current, Retro 70s — Preview, Arcade 80s — Preview and Cyber 2000 — Preview. | WorldPreviews.test.tsx; both gallery captures; exactly four ordered names and one Current status. |
| 02 | Studio remains the only current authored production office; its toolbar identity can reach the homepage world gallery without changing the document URL. | Application.test.tsx; real Studio click focuses Worlds; URL and homepage navigation destination unchanged; expanded Studio disabled. |
| 03 | Each future-world entry uses approved source artwork or source regions with recorded provenance; original North Star files remain unchanged. | world-preview-provenance.json; verify-us-035.cjs verifies full source/output hashes, dimensions and every decoded crop row; strict scope protects original references. |
| 04 | Preview activation reveals useful approved concept information and clearly says the environment is a Preview without functional switching. | WorldPreviews.test.tsx exact descriptions/disclaimer; preview-0/1/2 captures at both sizes. |
| 05 | Preview controls are usable native keyboard controls with visible focus, named content and a clear dismissal/collapse interaction where applicable. | Native details/summary, initially closed; Chromium Space opens all three independently, Enter collapses/reopens; focused original preview captures. User corroborated independent opening/collapse. |
| 06 | Preview interaction does not change the scene, agents, selected identity, trusted store or any persistent theme/world setting. | Real fixture snapshot equality, selected Mina and real game/scene/canvas identity across preview input; no state hooks, persistent setting or subscription in WorldPreviews. |
| 07 | Expand activates an application-owned expanded composition, not OS fullscreen, camera zoom or a new window/IPC capability. | Application expanded state plus CSS only; no Electron/fullscreen/IPC/camera/scale changes in diff. |
| 08 | The expanded composition follows the approved study: general navigation, Worlds and Sample Activity are hidden, while toolbar, full office, selector and precise inspection remain available. | Expanded captures and hidden-region assertions; same mounted status/selector/inspector; native hidden removes navigation/Worlds/Sample from layout and keyboard/accessibility exposure. |
| 09 | The same mounted Phaser game, scene and canvas remain present before, during and after Expand/Exit; no second host or replacement game is created. | Real retained object references compared before/during/after both size episodes and all 20 cycles. Host parent/key/effect ownership unchanged. |
| 10 | The office stays exactly 640×360 at integer scale with no fractional transform or resampling in either composition. | Every capture asserts exactly 640×360 CSS canvas; DPR recorded; no canvas transform/scale edits; complete room reachability asserted at all six text/size cases. |
| 11 | Selected identity and trusted runtime subscriptions continue uninterrupted; lifecycle/activity/availability changes while expanded update the same world/inspection. | fixture.update/connection, retained and synchronizing captures; same store/runtime/selector/inspector; stable active subscription counts throughout cycles. |
| 12 | A visible native Exit control replaces the expansion action in the toolbar. | One stable native button becomes Exit; name/target CSS and expanded captures. |
| 13 | Escape exits only while expanded and returns to the normal composition; the handler is removed or inactive outside expansion and during disposal. | Real Chromium Escape returns normal; second Escape inactive; one expanded listener and zero normal listeners; effect cleanup and synchronous restoration on disposal. |
| 14 | Exiting through Exit or Escape restores visible keyboard focus to the invoking Expand control without changing selection. | Exit and Escape captures/assertions focus the same button with visible cyan outline and preserve Mina selection; no scrollIntoView during return. |
| 15 | Exit restores the prior document scroll position after normal layout is restored, without a competing focus-induced page jump. | Real nonzero saved/restored scroll at both sizes plus resize/update clamping; officeExpansion.test.ts covers reachable/unreachable/negative/short-document cases. |
| 16 | Desktop 1100×760 and compact 760×540 support entry/exit, complete room visibility and reachable selector/inspection through normal vertical scrolling without horizontal overflow. | Both actual outer sizes, normal/expanded, 100/125/200% root text; fixed room reachable and focused selector clears sticky toolbar; no horizontal overflow in all 73 captures. |
| 17 | Repeated expansion, resize, availability changes and no-selection/retained/no-state cases produce no duplicate listeners/canvases, selection reset or acknowledgement/animation replay. | 20 cycles; preserved preview/Harbor state; retained/synchronizing/no-selection/selected-no-state captures; real counters show no mode-triggered play/acknowledgement replay; one accepted acknowledgement positive control. |
| 18 | Expanded and informational-preview interactions preserve reduced-motion static meaning, existing sprite/native selection, Clear, exact coffee and destruction-safe shutdown/reload behavior. | Chromium Tab/Shift+Tab/Space/Enter/Clear, exact coffee/generic waiting/reduced-motion captures and reload; accepted scene/motion/host destruction tests pass unchanged. Manual VoiceOver/macOS motion unverified. |

## Validation

Final correction capture timestamp: `2026-10-12T22:03:33.218Z`. Integrity independently matched 286 source/historical hashes and passed 11 negative scope/manifest/image regressions. The final toolbar heights at 100/125/200% are 76/80/124px; the earlier six selector cases remain valid; the new complete keyboard matrix has a minimum below-toolbar clearance of 6px.

- Focused: `cd apps/desktop && ../../node_modules/.bin/vitest run src/office/WorldPreviews.test.tsx src/office/officeExpansion.test.ts src/Application.test.tsx src/office/OfficeSceneHost.test.ts` — **17/17 PASS** (2 Worlds, 1 clamp, 4 composition, 10 host). Initial focused tests were written before production additions and then made green incrementally.
- `npm test` — **339/339 PASS**: 54 importer, 284 desktop, 1 contracts. The first sandbox run could not bind existing loopback transport tests (EPERM); authorized execution with local network access passed. No test was weakened.
- `npm run typecheck` — **PASS**. The development fixture also passes explicit strict TypeScript checking with DOM/ES2022, Bundler resolution, React JSX and vite/client types because verification files are outside workspace source inclusion.
- `npm run lint` — **PASS**, with the two known generated Phaser-bundle unused eslint-disable warnings; no new production errors.
- `npm run build` — **PASS**; generated output remains ignored/untracked by Git. No dependency/lockfile modification.
- `node --check` for the three new CJS tools and JSON parsing — **PASS**.
- Capture / integrity — **73 original PNGs; PASS** for decoding/dimensions/hashes/correspondence, three exact decoded source crops, source/historical hashes, continuity, text/focus cases, strict file inventory, report links and negative-integrity checks.
- `git diff --check` — **PASS**; staging index empty and HEAD remains the baseline.

Capture-process stderr emitted intermittent Electron GPU `SharedImageManager` / `Invalid mailbox` diagnostics during reloads. They did not fail the final run; renderer-console errors remained zero, and all PNGs still decode and match their measured layout. These diagnostics are distinct from the two known lint warnings and are disclosed without claiming native GPU behavior was independently verified.

## Correction-specific file inventory

Relative to the retained pre-correction implementation, the correction changes only:

- `apps/desktop/src/Application.test.tsx`
- `apps/desktop/src/office/OfficeSceneHost.tsx`
- `apps/desktop/src/style.css`
- `apps/desktop/verification/capture-us-035.cjs`
- `apps/desktop/verification/verify-us-035.cjs`
- `docs/verification/us-035-world-previews-expansion.md`
- `docs/verification/assets/us-035/capture-record.json`
- The US-035 PNG files listed below; no US-031–US-034 evidence changed.

Exactly 30 correction PNG paths were added. All 73 captures were regenerated; 18 previously present PNGs changed bytes and 25 remained byte-identical. Crop assets, crop manifest, original references, Application.tsx, existing fixture and decoded-pixel helper remain unchanged relative to the pre-correction tree. Existing protected-source hashes and the strict allowlist are audited independently.

Exact 18 byte-changed pre-existing US-035 PNG paths:

- `docs/verification/assets/us-035/1100-escape-return.png`
- `docs/verification/assets/us-035/1100-exit-return.png`
- `docs/verification/assets/us-035/1100-gallery.png`
- `docs/verification/assets/us-035/1100-preview-0.png`
- `docs/verification/assets/us-035/1100-preview-1.png`
- `docs/verification/assets/us-035/1100-preview-2.png`
- `docs/verification/assets/us-035/1100-production.png`
- `docs/verification/assets/us-035/1100-synchronizing.png`
- `docs/verification/assets/us-035/1100-text-100-gallery.png`
- `docs/verification/assets/us-035/1100-text-125-gallery.png`
- `docs/verification/assets/us-035/1100-text-200-gallery.png`
- `docs/verification/assets/us-035/760-escape-return.png`
- `docs/verification/assets/us-035/760-exit-return.png`
- `docs/verification/assets/us-035/760-preview-2.png`
- `docs/verification/assets/us-035/760-production.png`
- `docs/verification/assets/us-035/760-text-100-focus.png`
- `docs/verification/assets/us-035/760-text-125-expanded.png`
- `docs/verification/assets/us-035/760-text-200-gallery.png`

Exact 30 added correction PNG paths:

- `docs/verification/assets/us-035/1100-correction-expanded-100-forward.png`
- `docs/verification/assets/us-035/1100-correction-expanded-100-reverse.png`
- `docs/verification/assets/us-035/1100-correction-expanded-125-forward.png`
- `docs/verification/assets/us-035/1100-correction-expanded-125-reverse.png`
- `docs/verification/assets/us-035/1100-correction-expanded-200-forward.png`
- `docs/verification/assets/us-035/1100-correction-expanded-200-reverse.png`
- `docs/verification/assets/us-035/1100-correction-flow-100-long.png`
- `docs/verification/assets/us-035/1100-correction-flow-100-short.png`
- `docs/verification/assets/us-035/1100-correction-flow-125-long.png`
- `docs/verification/assets/us-035/1100-correction-flow-125-short.png`
- `docs/verification/assets/us-035/1100-correction-flow-200-long.png`
- `docs/verification/assets/us-035/1100-correction-flow-200-short.png`
- `docs/verification/assets/us-035/1100-correction-normal-100-forward.png`
- `docs/verification/assets/us-035/1100-correction-normal-100-reverse.png`
- `docs/verification/assets/us-035/1100-correction-normal-125-forward.png`
- `docs/verification/assets/us-035/1100-correction-normal-125-reverse.png`
- `docs/verification/assets/us-035/1100-correction-normal-200-forward.png`
- `docs/verification/assets/us-035/1100-correction-normal-200-reverse.png`
- `docs/verification/assets/us-035/760-correction-expanded-100-forward.png`
- `docs/verification/assets/us-035/760-correction-expanded-100-reverse.png`
- `docs/verification/assets/us-035/760-correction-expanded-125-forward.png`
- `docs/verification/assets/us-035/760-correction-expanded-125-reverse.png`
- `docs/verification/assets/us-035/760-correction-expanded-200-forward.png`
- `docs/verification/assets/us-035/760-correction-expanded-200-reverse.png`
- `docs/verification/assets/us-035/760-correction-normal-100-forward.png`
- `docs/verification/assets/us-035/760-correction-normal-100-reverse.png`
- `docs/verification/assets/us-035/760-correction-normal-125-forward.png`
- `docs/verification/assets/us-035/760-correction-normal-125-reverse.png`
- `docs/verification/assets/us-035/760-correction-normal-200-forward.png`
- `docs/verification/assets/us-035/760-correction-normal-200-reverse.png`

## Exact working-tree inventory

Four modified tracked files:

- `apps/desktop/src/Application.tsx` — application composition, stable focus/scroll and scoped listener ownership.
- `apps/desktop/src/Application.test.tsx` — updated approved controls/composition expectations.
- `apps/desktop/src/office/OfficeSceneHost.tsx` — toolbar controls and mounted gallery/Sample visibility without scene ownership changes.
- `apps/desktop/src/style.css` — approved gallery/normal/expanded/sticky/text/focus geometry.

Fourteen untracked source/tooling/report/manifest files (unchanged inventory from the initial implementation):

- `apps/desktop/src/office/WorldPreviews.tsx`
- `apps/desktop/src/office/WorldPreviews.test.tsx`
- `apps/desktop/src/office/officeExpansion.ts`
- `apps/desktop/src/office/officeExpansion.test.ts`
- `apps/desktop/src/office/assets/world-retro-70s.png`
- `apps/desktop/src/office/assets/world-arcade-80s.png`
- `apps/desktop/src/office/assets/world-cyber-2000.png`
- `apps/desktop/src/office/assets/world-preview-provenance.json`
- `apps/desktop/verification/us-035.html`
- `apps/desktop/verification/us-035.tsx`
- `apps/desktop/verification/capture-us-035.cjs`
- `apps/desktop/verification/us-035-image.cjs`
- `apps/desktop/verification/verify-us-035.cjs`
- `docs/verification/us-035-world-previews-expansion.md`

Seventy-four untracked evidence files: `docs/verification/assets/us-035/capture-record.json` and these 73 original PNGs (full paths use `docs/verification/` plus the links below):

- [1100-production.png](assets/us-035/1100-production.png)
- [760-production.png](assets/us-035/760-production.png)
- [1100-gallery.png](assets/us-035/1100-gallery.png)
- [1100-preview-0.png](assets/us-035/1100-preview-0.png)
- [1100-preview-1.png](assets/us-035/1100-preview-1.png)
- [1100-preview-2.png](assets/us-035/1100-preview-2.png)
- [1100-expanded.png](assets/us-035/1100-expanded.png)
- [1100-retained.png](assets/us-035/1100-retained.png)
- [1100-synchronizing.png](assets/us-035/1100-synchronizing.png)
- [1100-escape-return.png](assets/us-035/1100-escape-return.png)
- [1100-exit-return.png](assets/us-035/1100-exit-return.png)
- [760-gallery.png](assets/us-035/760-gallery.png)
- [760-preview-0.png](assets/us-035/760-preview-0.png)
- [760-preview-1.png](assets/us-035/760-preview-1.png)
- [760-preview-2.png](assets/us-035/760-preview-2.png)
- [760-expanded.png](assets/us-035/760-expanded.png)
- [760-retained.png](assets/us-035/760-retained.png)
- [760-synchronizing.png](assets/us-035/760-synchronizing.png)
- [760-escape-return.png](assets/us-035/760-escape-return.png)
- [760-exit-return.png](assets/us-035/760-exit-return.png)
- [1100-text-100-gallery.png](assets/us-035/1100-text-100-gallery.png)
- [1100-text-100-expanded.png](assets/us-035/1100-text-100-expanded.png)
- [1100-text-100-focus.png](assets/us-035/1100-text-100-focus.png)
- [1100-text-125-gallery.png](assets/us-035/1100-text-125-gallery.png)
- [1100-text-125-expanded.png](assets/us-035/1100-text-125-expanded.png)
- [1100-text-125-focus.png](assets/us-035/1100-text-125-focus.png)
- [1100-text-200-gallery.png](assets/us-035/1100-text-200-gallery.png)
- [1100-text-200-expanded.png](assets/us-035/1100-text-200-expanded.png)
- [1100-text-200-focus.png](assets/us-035/1100-text-200-focus.png)
- [760-text-100-gallery.png](assets/us-035/760-text-100-gallery.png)
- [760-text-100-expanded.png](assets/us-035/760-text-100-expanded.png)
- [760-text-100-focus.png](assets/us-035/760-text-100-focus.png)
- [760-text-125-gallery.png](assets/us-035/760-text-125-gallery.png)
- [760-text-125-expanded.png](assets/us-035/760-text-125-expanded.png)
- [760-text-125-focus.png](assets/us-035/760-text-125-focus.png)
- [760-text-200-gallery.png](assets/us-035/760-text-200-gallery.png)
- [760-text-200-expanded.png](assets/us-035/760-text-200-expanded.png)
- [760-text-200-focus.png](assets/us-035/760-text-200-focus.png)
- [expanded-unselected.png](assets/us-035/expanded-unselected.png)
- [expanded-selected-no-state.png](assets/us-035/expanded-selected-no-state.png)
- [expanded-coffee.png](assets/us-035/expanded-coffee.png)
- [expanded-generic-waiting.png](assets/us-035/expanded-generic-waiting.png)
- [expanded-reduced-motion.png](assets/us-035/expanded-reduced-motion.png)
- [1100-correction-normal-100-forward.png](assets/us-035/1100-correction-normal-100-forward.png)
- [1100-correction-normal-100-reverse.png](assets/us-035/1100-correction-normal-100-reverse.png)
- [1100-correction-expanded-100-forward.png](assets/us-035/1100-correction-expanded-100-forward.png)
- [1100-correction-expanded-100-reverse.png](assets/us-035/1100-correction-expanded-100-reverse.png)
- [1100-correction-normal-125-forward.png](assets/us-035/1100-correction-normal-125-forward.png)
- [1100-correction-normal-125-reverse.png](assets/us-035/1100-correction-normal-125-reverse.png)
- [1100-correction-expanded-125-forward.png](assets/us-035/1100-correction-expanded-125-forward.png)
- [1100-correction-expanded-125-reverse.png](assets/us-035/1100-correction-expanded-125-reverse.png)
- [1100-correction-normal-200-forward.png](assets/us-035/1100-correction-normal-200-forward.png)
- [1100-correction-normal-200-reverse.png](assets/us-035/1100-correction-normal-200-reverse.png)
- [1100-correction-expanded-200-forward.png](assets/us-035/1100-correction-expanded-200-forward.png)
- [1100-correction-expanded-200-reverse.png](assets/us-035/1100-correction-expanded-200-reverse.png)
- [760-correction-normal-100-forward.png](assets/us-035/760-correction-normal-100-forward.png)
- [760-correction-normal-100-reverse.png](assets/us-035/760-correction-normal-100-reverse.png)
- [760-correction-expanded-100-forward.png](assets/us-035/760-correction-expanded-100-forward.png)
- [760-correction-expanded-100-reverse.png](assets/us-035/760-correction-expanded-100-reverse.png)
- [760-correction-normal-125-forward.png](assets/us-035/760-correction-normal-125-forward.png)
- [760-correction-normal-125-reverse.png](assets/us-035/760-correction-normal-125-reverse.png)
- [760-correction-expanded-125-forward.png](assets/us-035/760-correction-expanded-125-forward.png)
- [760-correction-expanded-125-reverse.png](assets/us-035/760-correction-expanded-125-reverse.png)
- [760-correction-normal-200-forward.png](assets/us-035/760-correction-normal-200-forward.png)
- [760-correction-normal-200-reverse.png](assets/us-035/760-correction-normal-200-reverse.png)
- [760-correction-expanded-200-forward.png](assets/us-035/760-correction-expanded-200-forward.png)
- [760-correction-expanded-200-reverse.png](assets/us-035/760-correction-expanded-200-reverse.png)
- [1100-correction-flow-100-short.png](assets/us-035/1100-correction-flow-100-short.png)
- [1100-correction-flow-100-long.png](assets/us-035/1100-correction-flow-100-long.png)
- [1100-correction-flow-125-short.png](assets/us-035/1100-correction-flow-125-short.png)
- [1100-correction-flow-125-long.png](assets/us-035/1100-correction-flow-125-long.png)
- [1100-correction-flow-200-short.png](assets/us-035/1100-correction-flow-200-short.png)
- [1100-correction-flow-200-long.png](assets/us-035/1100-correction-flow-200-long.png)

Total: 4 modified tracked + 88 untracked files (92 files). No staged files. The verifier has fixed allowlists rather than accepting whatever inventory it discovers. No production scene, motion controller, selector, inspection implementation, source artwork, trusted store/runtime, contracts, transport, simulator, main/preload/IPC, planning, dependencies, historical verification or design authority was modified.

## Review gates and handoff

Initial independent technical review: **PASS**, as supplied by the Planner. Initial Designer review: **FAIL** with F1–F3 MEDIUM and F4 LOW. Developer F1–F4 corrections and local verification are complete; Designer and technical **re-review of the corrected uncommitted tree are pending**. Product Owner implementation acceptance: **pending**. The Developer-owned simulated development launch was stopped after evidence capture. Stage/commit/push/PR/merge: **not authorized** and not performed. No GitHub issues changed; no US-036 work started. Native manual checks beyond the specific preview observation remain unclaimed.
