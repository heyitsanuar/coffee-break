# US-036 — Integrated Homepage Fidelity verification

Developer implementation/evidence report, 2026-10-13. **Implementation and Developer validation complete; ready for Planner scope review.** Designer fidelity, independent technical review and Product Owner implementation acceptance remain PENDING. Finalization is NOT AUTHORIZED. Approved design/implementation scope is distinct from story acceptance.

## Authority and baseline

[US-036 #80](https://github.com/heyitsanuar/coffee-break/issues/80), [EP-06 #74](https://github.com/heyitsanuar/coffee-break/issues/74), and [planning](../../planning/ep-06-issues.json) agree on all 20 acceptance criteria. Verified main/origin/main/GitHub main baseline: `83d91ea64dd2259c6316f8c67b384d055cda0352`, tree `fe0ee0e787176548e7e42ed2af899d08cc9f70da`; initial tree/index clean. US-031–035 issues #75–79 CLOSED; PRs #81–85 MERGED. Branch: `feature/us-036-homepage-fidelity`; HEAD remains the baseline, with no feature commits or staging.

The Product Owner-approved implementation handoff is artifact `b45d6fd5-9b30-419e-a06d-01a2ea895c2c`. The complete Designer specification was read from **Agent | Designer**, conversation `01a0ee18-a070-7e11-8253-6f27ff9a134e`, turn `01a1324c-b4c0-7533-bcd8-c0756b63d45d`, final message `msg_022d86c7bdb2e1ae016acd6655cd8887d19eeb6f9c00b02ea2`. No separate repository specification path is invented. The user also directly confirmed implementation authorization after automatic approval review rejected one command because it treated the attachment as untrusted. That rejected command did not execute; approval was obtained before continuing.

[AGENTS](../../AGENTS.md), [architecture](../architecture/README.md), [design authority](../design/README.md), [approved EP-06 references](../design/references/ep-06/README.md) and the [original North Star](../design/references/north-star/) remain authoritative. Historical NOT APPROVED study banners are superseded by the manifest's Product Owner approval. No reference or historical approval chronology changed.

## F1 fresh-build reproduction and correction

The baseline was freshly built with `npm run build`, then observed in the actual Electron application using the unchanged US-035 development fixture, production Application/store/runtime/scene and Chromium Tab/Space input. [Baseline record](assets/us-036/f1-baseline-record.json) identifies the exact source/build/tool hashes, runtime versions, original before/after PNGs, measured outer/content bounds, DPR, zoom, root font, selected/focused identity, raw geometry and focus-event counts. It embeds the exact original capture-tool source matching its hash; this is historical reproduction tooling, not the current collector.

Nine of twelve Clear-focus resize cases lost complete focus clearance. The same focused DOM node, selected Mina, game/scene/canvas/store/runtime remained; no new focus event occurred. The required measurement is raw `control.top - toolbar.bottom >= 6` and `viewport.height - control.bottom >= 6`, covering the 3px outline plus 3px offset. Both directions, normal/expanded and 100/125/200% root text were exercised. Failure images are named `f1-baseline-M-T-resize-R-before/after.png` and remain unchanged.

Root cause: the old focus-entry handler did not execute after resize on an already-focused node. The smallest correction remains in [OfficeSceneHost](../../apps/desktop/src/office/OfficeSceneHost.tsx): one shared clearance calculation, reused by focus entry and a coalesced one-animation-frame layout recheck. The existing local ResizeObserver observes actual panels/header as well as existing layout regions; one scoped window resize listener schedules the same check. Cleanup disconnects the observer, removes the resize listener and cancels the pending frame. There are no new focus calls, keyboard traps, global keyboard/focus listeners, timers, retry loops, smooth scrolling or trusted-state changes.

Pointer focus and toolbar controls are excluded, preserving invoking-button focus and saved-scroll restoration. Disconnected hosts cannot scroll. A renderer regression caught fractional scroll quantization: a raw 5.7578125px clearance remained after a fractional request. The request now rounds **outward to a device-pixel boundary**; measured coordinates and the >=6 assertion are never rounded or relaxed. The corrected twelve-case matrix passed raw clearance with the same node and no new focus event.

## Trusted-content reflow

The integrated test additionally reproduced the same mechanism gap in expanded mode: `display: contents` gives the contextual rail no measurable height. Growing Mina's selected activity/Reason moved focused Clear to y970–1014 in a 732px viewport, with zero new focus events. [Original diagnostic](assets/us-036/diagnostic-trusted-reflow-1100-expanded-100.png) and [failure record](assets/us-036/reflow-failure-record.json) preserve original renderer pixels, old host source, tool source/hashes and raw measurements.

The approved F1 mechanism also resolves this case by observing the existing inspector and selector panels themselves. No separate content/layout redesign was introduced. The final matrix covers both sizes/modes and all three text sizes; short → literal multiline → 480-character unbroken activity, both supported reasons, reason removal, disconnect/synchronization/ready transitions, persistent node/focus-event identity, selection and raw final outline clearance. Additional Ari/Mina/Sol, Clear and normal preview/Harbor resize cases use native traversal without per-control focus or viewport prepositioning.

## Approved historical numeric correction

Only [US-035 report line 56](us-035-world-previews-expansion.md) changes: desktop 564→568px, compact 1497.5→1423.5px, clamp maximum/restoration 64→68px, retaining saved=1404px. The text identifies `observations.continuity` / `observations.clamping` in its unchanged [capture record](assets/us-035/capture-record.json). No US-035 PNG, record, verifier or review chronology changed.

## Evidence procedure and provenance

Use installed dependencies; no installation:

```sh
npm run dev:simulated
# In a separate terminal:
node_modules/.bin/electron apps/desktop/verification/capture-us-036.cjs http://localhost:5173 fixture
node_modules/.bin/electron apps/desktop/verification/capture-us-036.cjs http://localhost:5173 simulator
node_modules/.bin/electron apps/desktop/verification/capture-us-036.cjs http://localhost:5173 unavailable
node_modules/.bin/electron apps/desktop/verification/capture-us-036.cjs http://localhost:5173 recovery
# Use a Python runtime with the already-installed Pillow library:
node_modules/.bin/electron apps/desktop/verification/observe-us-036-motion.cjs http://localhost:5173
python3 -B apps/desktop/verification/create-us-036-comparisons.py
COFFEE_BREAK_EVIDENCE_PYTHON=python3 node_modules/.bin/electron apps/desktop/verification/verify-us-036.cjs
```

The collector imports the built production Electron main/preload/security configuration. Production sessions use actual authenticated simulator/recovery inputs or ordinary dormant-ingress startup. Fixture sessions use the existing development-only US-035 fixture and unchanged production components, with explicitly synthetic accepted inputs. No presentation-only missing-agent override is needed. Synthetic reset/remount episodes are separate from uninterrupted continuity proof. Chromium key/pointer/media automation is not manual macOS or VoiceOver evidence.

Original PNGs come directly from Electron `capturePage`; no frame is forced, no image is edited, no alternate UI is drawn. Four consecutive stable layout frames, a 2500ms deadline, at most six image retries, before/after equality and the unchanged US-035 decoded-border correspondence helper guard capture settlement. Numbered compact flow uses measured intrinsic document height and overlapping usable viewport steps; long inspector continuations separately cover their document bottom. No fixed slice count is assumed. Actual outer/content bounds, viewport, DPR and zoom are recorded rather than subtracting an assumed title bar.

Source/build/tool hashes describe the capture tree and executed build. The baseline tree is not represented as a commit containing these uncommitted changes. The final report/inventory and source digests identify the implementation. Historical evidence remains historical; matching unchanged source/asset hashes support reuse but are not relabeled fresh native observations.

## Integrated fidelity and accepted translations

Seven derived boards compare approved desktop, compact, compact-flow, expanded, retained, keyboard and environment references with original renderer images. Each identifies DESIGN REFERENCE, ORIGINAL RUNTIME CAPTURE and DERIVED COMPARISON; its manifest records source paths/full hashes, native dimensions, no crop, display dimensions/scaling, nearest-neighbor display operation and board hash. Original files remain untouched. Compact-flow boards show ordered overlapping viewport images, not a fabricated stitched runtime screenshot.

Accepted translations: lightweight navigation without sidebar; exactly Ari/Mina/Sol; authored 320×180 environment at integer 2×; reconciled monitor fields, anchors, mug/steam and seat foreground; native targets and natural text growth; compact selectors/full inspection below the initial viewport; expanded availability/instructions; freshness rather than Online; fictional Sample context and unavailable Preview worlds. No conceptual artwork detail, icon, metric or control creates additional scope. Designer assessment of the final boards remains PENDING.

## AC-01–AC-20 traceability

The final capture manifest supplies exact filenames and assertion references. Implementation evidence never substitutes for independent approval.

| AC | Evidence/required result |
|---|---|
| 01 | Seven labeled derived comparisons; desktop/compact/full-flow/expanded/retained/keyboard originals. |
| 02 | Environment/North Star board; unchanged authored grid/anchors/monitor/foreground/coffee assets and existing tests. |
| 03 | Baseline/tree plus exact source/build/tool/file hashes, input sequence, selected identity and observations. |
| 04 | Per-capture actual outer/content/viewport/DPR/zoom; historical 28px difference is not an assumed constant. |
| 05 | One fixed 640×360 canvas; complete-room visibility assertions across all twelve size/mode/text cases. |
| 06 | Independent columns and natural compact flow; all intrinsic content reachable, no horizontal overflow. |
| 07 | Both resize directions, 1040/1039/900px, 100/125/200%, exact multiline/unbroken activity and both reasons. |
| 08 | Office/Agents/Projects/Studio heading navigation; URL and selected identity retained. |
| 09 | All five exact lifecycle/inspection cases; existing character/workstation/runtime entry tests. |
| 10 | Exact Sol coffee, ordinary Waiting/Idle negatives, existing wrong-state/other-agent predicate tests. |
| 11 | Current/Last known/No state across surfaces; current Error; genuine unavailable and recovery sessions. |
| 12 | Chromium reduced-motion static sprite/Graphics/reaction observations across 1700ms, all four motion cases. |
| 13 | Real Chromium world pointer events, selector Space/Enter, guarded Clear, same selection/inspection. |
| 14 | Full native-control Chromium forward/reverse/AX hierarchy, persistent focus during resize/content/availability; user-assisted native checklist. |
| 15 | Four Worlds, independent previews, exactly three fixed Sample rows and fictional Harbor, no runtime coupling. |
| 16 | Same game/scene/canvas/store/runtime, ten expansion cycles per size, Exit/Escape saved/clamped scroll, no acknowledgement replay. |
| 17 | Real remount, explicit scene.stop after DisplayList destruction, pagehide cleanup and reload; existing trust/recovery/security tests. |
| 18 | Final-tree test/typecheck/lint/build/diff-check plus evidence integrity, exact warnings/failures recorded below. |
| 19 | Designer PENDING; independent technical review PENDING; Product Owner implementation acceptance PENDING. |
| 20 | Production/synthetic/Chromium/derived/manual distinctions; unavailable native assistive checks remain unclaimed. |

## Native observations and limitations

After launching the Developer-owned native simulated app, the user was asked to check both targets, Tab/Shift+Tab/Space/Enter, distinct focus/selection, Clear, persistent Clear focus when resizing expanded desktop→compact, Exit/Escape focus/scroll and full vertical access without horizontal overflow. Their exact reply: **“I checked everything and seems to be correct.”** This is aggregate user-assisted confirmation of that checklist, not an independently timed per-control transcript. It does not establish VoiceOver or native OS reduced motion. The later inspector-observer refinement is covered by automated renderer evidence; the user checklist did not separately exercise trusted-content reflow.

VoiceOver and native OS reduced motion remain unverified. Chromium AX hierarchy and media emulation are labeled supplemental. Source/markup tests alone cannot verify real focus, scrolling or motion. Intermittent Electron GPU SharedImageManager/Invalid mailbox stderr is disclosed separately from lint warnings; failed capture attempts are not passed evidence.

## Validation and review gates

- Fresh baseline `npm run build`: PASS.
- Test-first host regression: five new tests failed before implementation; corrected host suite 15/15 PASS.
- Focused host/runtime/character-motion suites: 54/54 PASS.
- `npm test`: 344/344 PASS — 54 importer, 289 desktop, 1 contract; authorized loopback access, no bypasses.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS; zero errors, two existing generated-Phaser unused eslint-disable warnings.
- Final `npm run build`: PASS. Independent evidence audit: PASS — 204 original PNGs, seven deterministically reconstructed comparison boards, strict scope/source/hash/dimension/geometry checks and 14 negative-integrity fixtures. Final `git diff --check`: PASS; index empty. All three CJS tools pass `node --check`; board generator parses without writing bytecode.

Verification-only corrections include non-cloneable instrumentation results, explicit webContents input focus, and full-room/long-inspection capture assertions. Their failed runs are not claimed successful. Production changes remain confined to the approved F1 mechanism.

## Exact validation commands and comparison links

Successful validation commands (exit 0):

```sh
npm test -w @coffee-break/desktop -- src/office/OfficeSceneHost.test.ts src/office/officePresentationRuntime.test.ts src/office/applyOfficeVisual.test.ts
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
node --check apps/desktop/verification/capture-us-036.cjs
node --check apps/desktop/verification/verify-us-036.cjs
node --check apps/desktop/verification/observe-us-036-motion.cjs
```

The evidence command and Python --check reconstruction are documented above. A supplied installed Python/Pillow runtime may be required; no dependencies were installed. Script syntax, source/image integrity, board reconstruction and negative checks supplement the workspace tests because development verification tools are outside the workspace TypeScript source inclusion.

| Comparison | Derived board |
|---|---|
| Desktop | [comparison-desktop.png](assets/us-036/comparison-desktop.png) |
| Compact initial | [comparison-compact.png](assets/us-036/comparison-compact.png) |
| Full compact flow | [comparison-compact-flow.png](assets/us-036/comparison-compact-flow.png) |
| Expanded | [comparison-expanded.png](assets/us-036/comparison-expanded.png) |
| Retained | [comparison-retained.png](assets/us-036/comparison-retained.png) |
| Keyboard | [comparison-keyboard.png](assets/us-036/comparison-keyboard.png) |
| Environment/North Star | [comparison-environment.png](assets/us-036/comparison-environment.png) |

Comparison states intentionally differ: authentic simulation ends in Completed/coffee with no selection; studies illustrate selected Waiting. Supplemental selected-long-inspection images and freshness cases cover the other contexts. The boards compare hierarchy/relationships/provenance rather than pretending these are identical runtime states or aligned native title bars.

## Scope and safety

Production: OfficeSceneHost.tsx only; focused regressions in OfficeSceneHost.test.ts. Documentation: approved one-line US-035 correction and this new report. New tools: collector, independent verifier, reproducible comparison-board generator and a small timed-motion observer. The observer is necessary to retain the first actual differing sprite/monitor/steam samples independently of still captures; it reuses the existing production fixture and forces no frames/timers. Evidence: strictly declared original PNGs, seven derived boards and provenance records. Complete reviewed inventory: 3 modified tracked files and 225 new files, 228 total; no generated output tracked. Exact paths are listed below.

No artwork, Phaser configuration, timing, selection authority, trusted store/runtime, contracts, Connector, transport, simulator, main/preload/IPC, security, dependencies, planning, architecture or approved references changed. No EP-07 work. Index empty; no staging/commit/push/PR/merge/issue mutation authorized or performed. Review gates and finalization remain as stated above.


## Final evidence counts, geometry and findings

- Original captures: **204** — 24 baseline resize diagnostics, one trusted-reflow diagnostic, 169 corrected fixture captures, two genuine simulator, two genuine unavailable, six genuine recovery.
- Derived comparison boards: **7**, all visually inspected and reconstructed in memory from untouched source PNGs.
- Corrected Clear resize: **12/12**; persistent control resize: **36 cases**, each direction checked; trusted reflow: **12/12**; full keyboard matrix: **12 cases** with forward/reverse and exposed AX hierarchy.
- Complete compact flow: **33 measured overlapping slices**, across normal/expanded and all three text sizes. Twelve complete long-inspection cases include numbered continuations where needed.
- Actual native outer/content: **1100×760 / 1100×732** and **760×540 / 760×512**, DPR **2**, zoom **1** on this machine. All twelve room cases show the complete fixed **640×360** canvas below the toolbar. These frame differences are measurements, not constants.
- Fresh live-motion observations: both targets show actual Mina Working-frame, monitor-field, Sol coffee-frame and steam changes. [Timed record](assets/us-036/motion-record.json) retains the first differing samples with elapsed times and source/tool hashes. Reduced-motion evidence separately checks all four operational/acknowledgement cases for 1700ms.
- Continuity: ten cycles per size, same game/scene/canvas/store/runtime, one resize listener and no normal Escape listener, no animation/acknowledgement replay; one eligible acknowledgement positive control. Pending resize followed by pagehide causes no explicit correction and leaves no owned listeners/canvas/subscriptions.
- Fresh real recovery captures identify retained `session-1`, synchronizing `session-2`, then connected/synchronized `session-2`. Genuine ordinary startup has no agents/session and reaches disconnected unavailability after the actual deadline.
- F1 and its same-mechanism expanded trusted-reflow reproduction are corrected. Historical numeric discrepancy is corrected. No additional production correction was made.

The independent checker rejects extra/missing/staged scope, invalid capture names/hashes/dimensions, wrong canvas width, raw focus under-clearance, incomplete compact-flow coverage, missing AC/source coverage, displaced image geometry and altered image/reference digests. Python additionally rebuilds all seven boards in memory and compares decoded pixels and the complete provenance manifest. It writes nothing in `--check` mode.

[Capture manifest](assets/us-036/capture-record.json) maps every AC to exact originals and/or runtime observation groups. [Comparison manifest](assets/us-036/comparison-record.json) records source classes, hashes, dimensions and display operations. AC-19 remains **PENDING REVIEW**, even though Developer evidence for other criteria is recorded.

The collector's exact executed revision is embedded and hash-verified in each session record. After collection, its unsupported `reproduce` entry is blocked to prevent overwriting baseline-failure evidence from the corrected tree. Original PNGs were not regenerated for that guard. Final compiled build results are separate from the capture-time main/preload/simulator digests; renderer captures use the production components served by Vite, not a claim that the final packaged `.app` was exercised.

Additional diagnostics/limits: production-session shutdown prints `No handler registered for coffee-break:agent-state:close` after main removes its handlers. Main, preload and IPC source are byte-identical to the accepted baseline; these capture processes exited 0. The message is disclosed without an unauthorized upstream fix. Pointer checks wait for Phaser's own bounds refresh after composition/scroll changes, without invoking refresh or changing its existing 500ms check interval; immediate clicking before that refresh is not established by these calibrated checks. VoiceOver, native OS reduced motion and other DPR/OS targets remain unverified. No new Designer/technical/PO implementation PASS is claimed.

## Exact implementation inventory

Tracked diff: **3 files, 84 insertions, 9 deletions**. This excludes new tooling/report/evidence. Original approved references and US-031–035 PNGs/records remain byte-identical; only the authorized US-035 numeric report line changed.

```text
apps/desktop/src/office/OfficeSceneHost.test.ts
apps/desktop/src/office/OfficeSceneHost.tsx
apps/desktop/verification/capture-us-036.cjs
apps/desktop/verification/create-us-036-comparisons.py
apps/desktop/verification/observe-us-036-motion.cjs
apps/desktop/verification/verify-us-036.cjs
docs/verification/assets/us-036/1100-expanded-100-inspection.png
docs/verification/assets/us-036/1100-expanded-100-keyboard-forward.png
docs/verification/assets/us-036/1100-expanded-100-keyboard-reverse.png
docs/verification/assets/us-036/1100-expanded-100-room.png
docs/verification/assets/us-036/1100-expanded-125-inspection-02.png
docs/verification/assets/us-036/1100-expanded-125-inspection.png
docs/verification/assets/us-036/1100-expanded-125-keyboard-forward.png
docs/verification/assets/us-036/1100-expanded-125-keyboard-reverse.png
docs/verification/assets/us-036/1100-expanded-125-room.png
docs/verification/assets/us-036/1100-expanded-200-inspection-02.png
docs/verification/assets/us-036/1100-expanded-200-inspection-03.png
docs/verification/assets/us-036/1100-expanded-200-inspection.png
docs/verification/assets/us-036/1100-expanded-200-keyboard-forward.png
docs/verification/assets/us-036/1100-expanded-200-keyboard-reverse.png
docs/verification/assets/us-036/1100-expanded-200-room.png
docs/verification/assets/us-036/1100-expanded-freshness-current.png
docs/verification/assets/us-036/1100-expanded-freshness-last-known.png
docs/verification/assets/us-036/1100-expanded-freshness-no-state.png
docs/verification/assets/us-036/1100-harbor-open.png
docs/verification/assets/us-036/1100-normal-100-inspection.png
docs/verification/assets/us-036/1100-normal-100-keyboard-forward.png
docs/verification/assets/us-036/1100-normal-100-keyboard-reverse.png
docs/verification/assets/us-036/1100-normal-100-room.png
docs/verification/assets/us-036/1100-normal-125-inspection-02.png
docs/verification/assets/us-036/1100-normal-125-inspection.png
docs/verification/assets/us-036/1100-normal-125-keyboard-forward.png
docs/verification/assets/us-036/1100-normal-125-keyboard-reverse.png
docs/verification/assets/us-036/1100-normal-125-room.png
docs/verification/assets/us-036/1100-normal-200-inspection-02.png
docs/verification/assets/us-036/1100-normal-200-inspection-03.png
docs/verification/assets/us-036/1100-normal-200-inspection.png
docs/verification/assets/us-036/1100-normal-200-keyboard-forward.png
docs/verification/assets/us-036/1100-normal-200-keyboard-reverse.png
docs/verification/assets/us-036/1100-normal-200-room.png
docs/verification/assets/us-036/1100-normal-freshness-current.png
docs/verification/assets/us-036/1100-normal-freshness-last-known.png
docs/verification/assets/us-036/1100-normal-freshness-no-state.png
docs/verification/assets/us-036/1100-preview-all-open.png
docs/verification/assets/us-036/1100-preview-arcade.png
docs/verification/assets/us-036/1100-preview-cyber.png
docs/verification/assets/us-036/1100-preview-retro.png
docs/verification/assets/us-036/1100-production-100.png
docs/verification/assets/us-036/1100-production-unavailable-100.png
docs/verification/assets/us-036/1100-recovery-recovered-100.png
docs/verification/assets/us-036/1100-recovery-retained-100.png
docs/verification/assets/us-036/1100-recovery-synchronizing-100.png
docs/verification/assets/us-036/1100-reduced-coffee.png
docs/verification/assets/us-036/1100-reduced-completed.png
docs/verification/assets/us-036/1100-reduced-error.png
docs/verification/assets/us-036/1100-reduced-working.png
docs/verification/assets/us-036/1100-reload.png
docs/verification/assets/us-036/1100-return-escape.png
docs/verification/assets/us-036/1100-return-exit.png
docs/verification/assets/us-036/1100-sol-coffee.png
docs/verification/assets/us-036/1100-sol-generic-waiting.png
docs/verification/assets/us-036/1100-sol-idle.png
docs/verification/assets/us-036/1100-state-completed.png
docs/verification/assets/us-036/1100-state-error.png
docs/verification/assets/us-036/1100-state-idle.png
docs/verification/assets/us-036/1100-state-waiting.png
docs/verification/assets/us-036/1100-state-working.png
docs/verification/assets/us-036/760-expanded-100-flow-01.png
docs/verification/assets/us-036/760-expanded-100-flow-02.png
docs/verification/assets/us-036/760-expanded-100-flow-03.png
docs/verification/assets/us-036/760-expanded-100-inspection.png
docs/verification/assets/us-036/760-expanded-100-keyboard-forward.png
docs/verification/assets/us-036/760-expanded-100-keyboard-reverse.png
docs/verification/assets/us-036/760-expanded-100-room.png
docs/verification/assets/us-036/760-expanded-125-flow-01.png
docs/verification/assets/us-036/760-expanded-125-flow-02.png
docs/verification/assets/us-036/760-expanded-125-flow-03.png
docs/verification/assets/us-036/760-expanded-125-flow-04.png
docs/verification/assets/us-036/760-expanded-125-inspection-02.png
docs/verification/assets/us-036/760-expanded-125-inspection.png
docs/verification/assets/us-036/760-expanded-125-keyboard-forward.png
docs/verification/assets/us-036/760-expanded-125-keyboard-reverse.png
docs/verification/assets/us-036/760-expanded-125-room.png
docs/verification/assets/us-036/760-expanded-200-flow-01.png
docs/verification/assets/us-036/760-expanded-200-flow-02.png
docs/verification/assets/us-036/760-expanded-200-flow-03.png
docs/verification/assets/us-036/760-expanded-200-flow-04.png
docs/verification/assets/us-036/760-expanded-200-flow-05.png
docs/verification/assets/us-036/760-expanded-200-flow-06.png
docs/verification/assets/us-036/760-expanded-200-inspection-02.png
docs/verification/assets/us-036/760-expanded-200-inspection-03.png
docs/verification/assets/us-036/760-expanded-200-inspection.png
docs/verification/assets/us-036/760-expanded-200-keyboard-forward.png
docs/verification/assets/us-036/760-expanded-200-keyboard-reverse.png
docs/verification/assets/us-036/760-expanded-200-room.png
docs/verification/assets/us-036/760-expanded-freshness-current.png
docs/verification/assets/us-036/760-expanded-freshness-last-known.png
docs/verification/assets/us-036/760-expanded-freshness-no-state.png
docs/verification/assets/us-036/760-harbor-open.png
docs/verification/assets/us-036/760-normal-100-flow-01.png
docs/verification/assets/us-036/760-normal-100-flow-02.png
docs/verification/assets/us-036/760-normal-100-flow-03.png
docs/verification/assets/us-036/760-normal-100-flow-04.png
docs/verification/assets/us-036/760-normal-100-flow-05.png
docs/verification/assets/us-036/760-normal-100-inspection.png
docs/verification/assets/us-036/760-normal-100-keyboard-forward.png
docs/verification/assets/us-036/760-normal-100-keyboard-reverse.png
docs/verification/assets/us-036/760-normal-100-room.png
docs/verification/assets/us-036/760-normal-125-flow-01.png
docs/verification/assets/us-036/760-normal-125-flow-02.png
docs/verification/assets/us-036/760-normal-125-flow-03.png
docs/verification/assets/us-036/760-normal-125-flow-04.png
docs/verification/assets/us-036/760-normal-125-flow-05.png
docs/verification/assets/us-036/760-normal-125-flow-06.png
docs/verification/assets/us-036/760-normal-125-inspection-02.png
docs/verification/assets/us-036/760-normal-125-inspection.png
docs/verification/assets/us-036/760-normal-125-keyboard-forward.png
docs/verification/assets/us-036/760-normal-125-keyboard-reverse.png
docs/verification/assets/us-036/760-normal-125-room.png
docs/verification/assets/us-036/760-normal-200-flow-01.png
docs/verification/assets/us-036/760-normal-200-flow-02.png
docs/verification/assets/us-036/760-normal-200-flow-03.png
docs/verification/assets/us-036/760-normal-200-flow-04.png
docs/verification/assets/us-036/760-normal-200-flow-05.png
docs/verification/assets/us-036/760-normal-200-flow-06.png
docs/verification/assets/us-036/760-normal-200-flow-07.png
docs/verification/assets/us-036/760-normal-200-flow-08.png
docs/verification/assets/us-036/760-normal-200-flow-09.png
docs/verification/assets/us-036/760-normal-200-inspection-02.png
docs/verification/assets/us-036/760-normal-200-inspection-03.png
docs/verification/assets/us-036/760-normal-200-inspection.png
docs/verification/assets/us-036/760-normal-200-keyboard-forward.png
docs/verification/assets/us-036/760-normal-200-keyboard-reverse.png
docs/verification/assets/us-036/760-normal-200-room.png
docs/verification/assets/us-036/760-normal-freshness-current.png
docs/verification/assets/us-036/760-normal-freshness-last-known.png
docs/verification/assets/us-036/760-normal-freshness-no-state.png
docs/verification/assets/us-036/760-preview-all-open.png
docs/verification/assets/us-036/760-preview-arcade.png
docs/verification/assets/us-036/760-preview-cyber.png
docs/verification/assets/us-036/760-preview-retro.png
docs/verification/assets/us-036/760-production-100.png
docs/verification/assets/us-036/760-production-unavailable-100.png
docs/verification/assets/us-036/760-recovery-recovered-100.png
docs/verification/assets/us-036/760-recovery-retained-100.png
docs/verification/assets/us-036/760-recovery-synchronizing-100.png
docs/verification/assets/us-036/760-reduced-coffee.png
docs/verification/assets/us-036/760-reduced-completed.png
docs/verification/assets/us-036/760-reduced-error.png
docs/verification/assets/us-036/760-reduced-working.png
docs/verification/assets/us-036/760-reload.png
docs/verification/assets/us-036/760-return-escape.png
docs/verification/assets/us-036/760-return-exit.png
docs/verification/assets/us-036/760-sol-coffee.png
docs/verification/assets/us-036/760-sol-generic-waiting.png
docs/verification/assets/us-036/760-sol-idle.png
docs/verification/assets/us-036/760-state-completed.png
docs/verification/assets/us-036/760-state-error.png
docs/verification/assets/us-036/760-state-idle.png
docs/verification/assets/us-036/760-state-waiting.png
docs/verification/assets/us-036/760-state-working.png
docs/verification/assets/us-036/capture-record.json
docs/verification/assets/us-036/comparison-compact-flow.png
docs/verification/assets/us-036/comparison-compact.png
docs/verification/assets/us-036/comparison-desktop.png
docs/verification/assets/us-036/comparison-environment.png
docs/verification/assets/us-036/comparison-expanded.png
docs/verification/assets/us-036/comparison-keyboard.png
docs/verification/assets/us-036/comparison-record.json
docs/verification/assets/us-036/comparison-retained.png
docs/verification/assets/us-036/diagnostic-trusted-reflow-1100-expanded-100.png
docs/verification/assets/us-036/expanded-100-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/expanded-100-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/expanded-100-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/expanded-100-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/expanded-125-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/expanded-125-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/expanded-125-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/expanded-125-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/expanded-200-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/expanded-200-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/expanded-200-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/expanded-200-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/f1-baseline-expanded-100-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/f1-baseline-expanded-100-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/f1-baseline-expanded-100-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/f1-baseline-expanded-100-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/f1-baseline-expanded-125-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/f1-baseline-expanded-125-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/f1-baseline-expanded-125-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/f1-baseline-expanded-125-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/f1-baseline-expanded-200-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/f1-baseline-expanded-200-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/f1-baseline-expanded-200-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/f1-baseline-expanded-200-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/f1-baseline-normal-100-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/f1-baseline-normal-100-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/f1-baseline-normal-100-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/f1-baseline-normal-100-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/f1-baseline-normal-125-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/f1-baseline-normal-125-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/f1-baseline-normal-125-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/f1-baseline-normal-125-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/f1-baseline-normal-200-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/f1-baseline-normal-200-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/f1-baseline-normal-200-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/f1-baseline-normal-200-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/f1-baseline-record.json
docs/verification/assets/us-036/fixture-record.json
docs/verification/assets/us-036/motion-record.json
docs/verification/assets/us-036/normal-100-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/normal-100-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/normal-100-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/normal-100-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/normal-125-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/normal-125-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/normal-125-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/normal-125-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/normal-200-resize-compact-to-desktop-after.png
docs/verification/assets/us-036/normal-200-resize-compact-to-desktop-before.png
docs/verification/assets/us-036/normal-200-resize-desktop-to-compact-after.png
docs/verification/assets/us-036/normal-200-resize-desktop-to-compact-before.png
docs/verification/assets/us-036/recovery-record.json
docs/verification/assets/us-036/reflow-failure-record.json
docs/verification/assets/us-036/simulator-record.json
docs/verification/assets/us-036/unavailable-record.json
docs/verification/us-035-world-previews-expansion.md
docs/verification/us-036-homepage-fidelity.md
```
