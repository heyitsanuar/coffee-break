# US-029 #63 — Responsive North Star proposal

**PROPOSAL — NOT APPROVED.** Prepared for Product Owner + Planner review, 2026-10-06. Design studies are reconstructed presentation fixtures, not production runtime evidence. All files in this package are outside the repository.

## 1. Discovery and authority

Repository: `/Users/asdf/Documents/projects/coffee-break`.

- Branch: `feature/us-029-responsive-north-star`.
- HEAD: `6f54c86c1d9a1b0677c21ac77d37dfb73b5b407e`.
- Tree: `1ab28035b1d3e62190e58ccb6c1e8d1f04f2153e`.
- Clean working tree and index at discovery and final integrity verification.
- GitHub issue #63 read in full. US-028 PR #69 confirmed merged at this HEAD. Stale local main references were not used as design authority.

Sources inspected: the supplied US-029 brief and complete issue; AGENTS.md and Designer assignment; project README; architecture README; design README and EP-04 specification; original read-only North Star references; corrected approved US-026 environment, US-027 agent and US-028 selection/inspection packages; compatible current Application, stylesheet, scene host, selection/inspection/summary/availability components; scene geometry, canonical room/lifecycle/coffee sheets, lifecycle frames and workstation forms; Electron BrowserWindow geometry. The previous US-028 Designer review provides the merged visual implementation baseline, not acceptance evidence for a future US-029 implementation.

Authority remains original North Star → PO-approved corrected direction → approved story references → compatible implementation. Original reference images are existing Product Owner artifacts. This task created no original North Star images and changed none.

## 2. Current problems and product interpretation

The desktop already expresses a tiny inhabited office successfully. Keep its high-angle room, broad visible floor, furniture tops, small canonical agents, authored stations, foreground occlusion and contextual information. Preserve the merged dark shell and warm ink/cream/coffee/sage accents. Do not fill whitespace with dashboard features.

Three geometry problems need attention:

1. At 1012 CSS px the office starts at x24; at 1011 it becomes centered, moving about 160px while inspection also changes placement. This moves the user's visual anchor unnecessarily.
2. The existing compact summary ends around y540 in a **540px content viewport**. A 760×540 **native window** has less content height on the measured machine.
3. Fixed-height text controls and scarce first-screen slack are vulnerable to enlarged text or wrapping. Long inspector content already has the right semantics; preserve its natural growth.

### Native geometry calibration

A temporary hidden Electron BrowserWindow used the production width/height/minimum/frame geometry flags. It loaded only a geometry page, not the application. Electron 37.10.3, macOS, devicePixelRatio 2:

| Native outer bounds | Measured content viewport |
| --- | --- |
| 1100×760 | 1100×732 |
| 760×540 | 760×512 |

The measured frame takes 28px vertically here. This is not a cross-platform constant. Final engineering evidence must record actual outer bounds, content bounds, renderer inner dimensions, DPR and zoom. Native-assumption study PNGs model this 28px difference with a clearly labeled annotation band; they are not native production screenshots. All study PNGs were rendered at DPR 1. The calibration ran at DPR 2.

## 3. Independently approvable recommendations

### R1 — Preserve the successful desktop

At available CSS content width **≥1012px**, retain the left-aligned office column642, gap18, inspector304 and horizontal gutters24. At 1100px this leaves 88px unused panel width. Inspector top aligns with room top; it has minimum height362 and grows with content. Summary remains hidden. Keep the office as the dominant region. No centering, stretching or new navigation.

### R2 — Keep one width threshold and one stable office anchor

At available CSS content width **760–1011px**, use a left-aligned642px column starting at x24. Inspector becomes inline642px wide after the summary; remove its362px minimum height. Use row gap16 between world column and inspector. The office remains at x24 across1012→1011; the transition changes inspection placement without relocating the room. Extra space to the right is intentional. The centered900px comparison is a real alternative, but is not recommended because it preserves the resize jump.

Do not animate the transition or add a third width range merely to occupy whitespace. Apply this behavior to the same mounted world and controls. R2 answers Q3–Q7.

### R3 — Protect low-height first-screen comprehension

Use an independent **content-height ≤560px** density treatment, at either width range. Keep gutters24 and the entire640×360 canvas. Header minimum height40; panel top inset4; gaps between room/context/roster/summary6; summary16px text with20px line height. Inline inspector still follows with16px gap. Normal height >560 retains header56, panel top20, world gaps12 in side composition and6 inline, summary24px line height. Panel bottom inset24 in both modes.

At measured760×512 content, default text and representative existing status copy, study coordinates are:

| Region | Content coordinates, excluding the modeled frame band |
| --- | --- |
| Header | y0–40 |
| Bordered room | x24, y44–406, 642×362 |
| Canvas | x25, y45–405, 640×360 |
| Simulation context | y412–428 |
| Roster | y434–478 |
| Selected summary | y484–504 |
| Precise inspector | starts y520, document flow |

This leaves8px after the summary within512px. In a760×540 content viewport the same summary has36px spare. The full inspector deliberately requires scrolling at the native minimum; exposing a sliver of it must not displace the room or roster. First-screen priority is brand/availability → complete room → simulation context → roster → selected identity/lifecycle/freshness → precise inspection through scrolling.

These coordinates are study targets, not guaranteed production font metrics. Future actual native-window review must check the margin without hiding overflow. Extra status lines and accessibility enlargement increase document height naturally.

### R4 — Keep the approved office scale

Across the default supported content widths, retain320×180 authored art at2×,640×360 game/canvas and642×362 bordered host. Characters remain40×48 from20×24 frames. No1× reduction,3× enlargement, cropped room, fluid fractional fit or scene-coordinate rewrite. Preserve nearest-neighbor rendering, layers and agent/station relationships.

At default page zoom, world targets stay48×64 CSS display pixels, outlines46×54 outer and42×50 inner, labels and monitor insets unchanged. In macOS logical content units these dimensions remain48×64; raster backing pixels depend on DPR, e.g.96×128 at DPR2. Pointer mapping and the approved non-overlap envelopes remain unchanged. World selection and roster selection continue to share existing selection ownership.

### R5 — Compact header through spacing, not semantic loss

Normal height: minimum56, padding10px vertical/24px horizontal, row gap8/column gap24,32px brand mark,18px title. Low height: minimum40, padding7px vertical/24px horizontal, row gap6/column gap24,24px mark,18px title. Availability retains14px/20px default text and exact truthful copy. Header may grow when content wraps; no ellipsis, removal of freshness context or rigid40px clipping. Keep the Coffee Break brand and warm palette; no larger navigation surface.

### R6 — Keep roster compact and let text grow

Preserve Ari/Mina/Sol order, canonical32×32 Idle portraits, visible names, reserved12px check area, minimum116px width, minimum44px height,8px inter-button gap and current5px/8px padding at default text. Do not expand three controls to fill642px. For enlarged text use natural height above44px and wrapping when needed. No lifecycle, availability, activity, provider or metric telemetry in the roster.

### R7 — Preserve contextual inspection and long content

Side dock304px; inline642px; padding20, canonical48px portrait, identity gap12. Keep identity → plain lifecycle → freshness → exact activity → optional trusted reason. Preserve the existing20px information inset with16px divider spacing,8px label-to-content spacing and12px separation between information groups. Inspector height is content-driven; only the side dock retains its362px minimum. Clear remains after the information with12px top separation and its existing minimum36px height.

Text keeps explicit line breaks and wraps anywhere for long unbroken strings; no ellipsis, clamp, altered trusted wording or nested scrollbar. Long side-dock text may extend below the room and require document scrolling. Inline text uses the wider column but may also extend indefinitely. Existing normal text uses16px/24px for activity and reason. Only supplied optional reason appears. Missing trusted state is explicitly reported; never infer lifecycle from portrait or placement.

### R8 — Keep the compact summary at every inline width

When selected at width≤1011, show the existing text-only summary after the roster: name · lifecycle · optional Last known. For unavailable trusted state, report that condition instead. When unselected it is absent. At ≥1012 it is hidden because contextual dock information is directly beside the room. Do not add precise activity, portraits, badges or a second inspection surface. No new labels preference or summary threshold.

### R9 — One document, stable selection and focus

One vertical document flow; no sticky inspector, independently scrolling office/inspector, overlay inspector, automatic scrolling or automatic focus movement on selection. Natural browser scrolling when keyboard focus reaches a below-fold control is permitted. Preserve the same DOM controls across the breakpoint and height treatment; no responsive remount or second selection authority.

Selected = warm border/inset plus check; focus = cyan3px external outline with3px offset. Keep at least6px clearance around focused roster controls; the8px button gaps prevent adjacent outline overlap. Study E has Mina selected while Sol is focused. Focus does not select; selection does not move focus. Clear remains a stable focusable action, including its existing aria-disabled behavior when empty.

### R10 — Preserve retained-state truth

Disconnected/synchronizing are global availability states, not agent lifecycle. Keep the same last trusted identity/lifecycle/activity/reason, qualify the header and inspector as last known/not live, and add Last known to the compact summary. Do not fade information into illegibility or fabricate Offline lifecycle. Operational character/workstation/coffee loops remain paused while presentation is not live. Stable cues stay visible. No retained-state architecture is proposed.

### R11 — Static reduced-motion meaning across compositions

Retain existing Idle, Working A, Waiting, settled Completed, settled Error and eligible Sol Coffee A presentations. Canonical silhouettes, stable monitor forms, persistent names and concise world state labels remain available without animation. Inspection remains the textual equivalent. Only the exact mock-agent-sol + waiting + existing exact coffee activity predicate permits coffee presentation; generic Waiting/Idle never implies a break. Static board G shows each lifecycle for all three identities, plus the exact Sol coffee context. Its crops preserve the2× world scale. It illustrates visual meaning, not timer/runtime behavior.

US-029 must verify actual reduced-motion preference and retained loops in the implemented layout. It does not redefine lifecycle vocabulary or acknowledge/replay behavior.

### R12 — Accessibility enlargement and the page-zoom decision

Recommend allowing meaningful React text to enlarge to200% while the room retains2×: natural header/control height, roster wrapping if required, summary wrapping and complete inspector text through the same vertical document. Do not promise that all priority regions remain above the fold at enlarged text. Study H demonstrates the room remaining complete, with lower information naturally below the first screen. Keep precise DOM text readable; canvas glyphs are supplementary, not the sole accessible information.

**Full-page zoom is a distinct unresolved design constraint.** At125%, a760 logical-content-pixel width corresponds to roughly608 CSS px. A fixed642px room plus gutters cannot fit. Derived study J demonstrates the resulting clipping/horizontal overflow and enlarged character language; it is a rejected outcome, not an approved mode. At200% the effective width would be380px. Neither case is proven by the200% text-only study. System/DPR scaling is also distinct from page zoom.

PO decision needed before final engineering specification: confirm the supported enlargement envelope. Recommended primary direction is the authored2× room with enlarged DOM text and natural vertical flow, without adding a zoom control or casually scaling the canvas. If whole-page zoom at the native minimum is a required supported mode, require a focused follow-up display/input study within US-029 before approving that mode; it must specify effective character size, physical target size, mapping, outlines, label legibility and pixel coherence. Do not defer this scope decision to US-030 or silently change Electron bounds. This proposal does not claim arbitrary page-zoom acceptance.

### R13 — Preserve the existing accessible relationships

DOM order stays room → simulation context → roster → compact summary → inspector. Preserve native keyboard controls, Ari/Mina/Sol order, accessible names, aria-pressed, aria-controls, inspector heading association, selected-feedback live region and global availability live region. Decorative portraits/checks stay outside naming. Do not make essential content hover-only, color-only or animation-only. Preserve Clear and the screen-reader information supplied by the existing selection/inspection model. No duplicate live announcement authority from responsive copies.

### R14 — Require implementation evidence after design approval

Future AC14–16 gates must use the implemented application: actual native1100×760 and760×540, measured content dimensions, all chosen compositions, exact threshold checks, normal/long/no-state/retained/synchronizing fixtures, different focus and selection, keyboard navigation to below-fold Clear, reduced-motion five states + exact coffee, practical world inputs and agreed enlargement envelope. Include native dimensions, CSS viewport, DPR and zoom in evidence. This package cannot satisfy those gates. No production regression suite was run in this design-only task.

### R15 — Bound US-029

US-029 owns responsive composition, alignment/height pressure, readable content flow, practical inputs, selection/focus continuity, availability visibility and static meaning across its supported geometry and agreed accessibility modes. Preserve existing environment/character art and semantics. US-030 retains final integrated fidelity and bounded epic polish.

## 4. Exact composition matrix

All range decisions use **available renderer CSS content geometry**, not outer window height. All widths/heights are CSS px at default page zoom unless explicitly qualified.

| Content geometry | Office | Inspector | Roster / summary | Spacing and header |
| --- | --- | --- | --- | --- |
| Width≥1012, height>560 | leftx24;640×360 canvas | x684;304 wide; min362; aligned room top | intrinsic buttons; summary hidden | gutters24; paneltop20; worldgap12; sidegap18; header min56 |
| Width760–1011, height>560 | leftx24; same room | inline642; natural height after world | intrinsic/wrapping; selected summary visible | gutters24; paneltop20; worldgap6; inspectorgap16; header min56 |
| Either width range, height≤560 | unchanged horizontal geometry and room | same placement for width; natural document flow | same controls; selected inline summary20px line | gutters24; paneltop4; worldgap6; inspectorgap16 inline/18 side; header min40 |

At 560px the low-height treatment applies; at561 normal height applies. Geometry below760 CSS width caused by page zoom is not silently covered by the fixed-room default; see R12. No new layout behavior is specified for smaller native windows than the current contract.

## 5. Visual study inventory and provenance

`study-manifest.json` records every study's assumption, selection, lifecycle, freshness, activity fixture type, reason presence, focus target, motion illustration and classification. No entry is production runtime evidence. `artifact-provenance.json` records source/image hashes and image dimensions. Full-flow PNGs show complete documents; their image height is not their viewport height.

| Study | What it makes reviewable |
| --- | --- |
| A desktop native1100×760 / content1100×732 | successful desktop unchanged; Mina Waiting, live, normal activity + reason |
| A desktop content1100×760 | comparison with older content-viewport assumption |
| B minimum native760×540 / content760×512 | complete room, roster and Mina Waiting summary before fold |
| B minimum content760×540 | separate CSS-size comparison |
| B full flow at760×512 | full inline inspector beginning y520, natural document flow |
| C native1012×700 / content1012×672 | exact last side-dock composition |
| C native1011×700 / content1011×672 | first inline composition, same roomx24 |
| C native900×700 / content900×672 | intermediate anchored proposal |
| C native900×700 centered alternative | meaningful alignment alternative, not recommended |
| D long native1100×760 and full1100×732 document | narrow304px dock wrapping pressure, retained496-character activity with unbroken reference + reason |
| D long minimum inspector at760×512 | wider inline readability after a manual study capture scroll; no proposed selection autoscroll |
| E native760×540 | Mina selected, Sol focused, warm check versus cyan external outline |
| F native760×540 retained | Waiting stays Waiting; last-known qualification visible |
| F native760×540 synchronizing | synchronization remains availability, same retained lifecycle |
| G642×1110 static board | five states × three agents + exact Sol coffee; world crops at2×; derived design board |
| H native760×540 text-only200% and full760×512 document | natural growth; room scale unchanged; not full-page zoom evidence |
| I native760×540 no trusted state | truthful compact summary and connecting availability |
| J125% page-zoom pressure | derived608×410 CSS geometry in modeled760×512 content; rejected clipping outcome; not actual native zoom evidence |

PNG names are descriptive; A–J correspond to the inventory and required A–G studies. Render scripts are external design tooling, not implementation tests. The inspectable prototype retains canonical art and representative existing-field fixtures; it approximates React/Phaser presentation rather than executing the production implementation. Its pointer/focus checks demonstrate the proposal only.

## 6. Validation performed and limits

- Native geometry calibration completed at both outer sizes with the matching frame contract; production renderer was not loaded.
- All19 primary prototype/board studies rendered; every ordinary supported study had no horizontal overflow. Expected overflow was separately demonstrated by rejected zoom-pressure study J.
- Default minimum prototype showed summary bottom504 in512px content, full room642×362 and roster bottom478.
- Prototype1012→1011 preserved selected Mina, the same focused Sol control and roomx24; keyboard activation and stable focused Clear checks passed; no JavaScript errors in the study renderer.
- Canonical embedded room/foreground/lifecycle/coffee sheets were compared byte-for-byte with current repository assets; source hashes recorded. No reference image contents were edited.
- Representative outputs A–J, full flow, state board, transition alternatives, retained, long content and enlarged text were visually inspected. PNGs are static: they cannot establish runtime timer, screen-reader or physical input acceptance.
- Production typecheck/lint/tests/build, actual production native-window screenshots, platform-wide geometry, real screen-reader output and native page-zoom input testing were **not run** in this design-only assignment.

## 7. AC status — proposal coverage, not acceptance

| AC | Proposal coverage / remaining gate |
| --- | --- |
|01|R1, study A; preserve approved hierarchy; actual implementation review pending.|
|02|R3/R4, B; complete room visible in modeled native minimum; actual native production review pending.|
|03|R2/R3, B; no horizontal overflow in default-size prototype; agreed zoom scope and runtime gate pending.|
|04|R4; unchanged40×48 agents at2×; J explicitly rejects blind page-zoom enlargement.|
|05|R8, B/F/I; selected identity/lifecycle or truthful no-state text visible at default minimum.|
|06|R7/R9, B full flow; inline inspection at y520 through document scrolling.|
|07|R7, D; normal/reason/unbroken496-character fixture; production multiline/long content verification pending.|
|08|R4;48×64 targets and mapping unchanged at default zoom; physical production input checks pending.|
|09|R6/R9/R13; native roster order and controls retained; prototype keyboard continuity checked.|
|10|R9, E; selected Mina/focused Sol clearly separate; actual keyboard focus review pending.|
|11|R10, F/D; availability separated from last trusted lifecycle/content.|
|12|R11, G; all five static states and exact coffee illustrated; actual preference/timer verification pending.|
|13|R9–R13; shapes/checks/text plus precise DOM equivalent; screen-reader/runtime review pending.|
|14|Pending future implementation: design studies and geometry calibration are not actual supported-size application evidence.|
|15|Pending future implementation: this is Designer proposal review, not review of implemented US-029 targets.|
|16|Pending future implementation: production regression suite not run.|

## 8. Decisions for Product Owner + Planner

Approve/reject R1–R15 independently. The consequential visual decisions are anchored inline alignment instead of centering; the560px content-height treatment and40px header;8px summary margin at measured native minimum with precise inspection below; unchanged2× world scale; and enlarged-text vertical flow. R12's supported full-page-zoom envelope requires an explicit decision before the engineering specification is considered complete. If it is required, further zoom-specific design/input evidence belongs to US-029.

No optional label setting, additional navigation, new state vocabulary or statistical content is proposed. The Planner owns the narrow implementation mechanism after approved visual decisions.

## DEFER TO US-030

- Final integrated comparison with original/corrected North Star and whole-epic visual acceptance.
- Full lifecycle/workstation/coffee journey and acknowledgement non-replay verification.
- Final selection/retention integration review and bounded final art polish.

US-029 must still pass its own responsive, retention, reduced-motion and input gates. These deferrals do not excuse a responsive defect or defer the zoom-scope decision.

## OUT OF EP-05

Provider/model/token/cost/productivity controls or statistics; GitHub/project boards; multiple functional rooms; chat/voice; personality systems; autonomous movement/pathfinding; new lifecycle states; invented operational data; window persistence; speculative responsive abstractions or contract/transport/security changes.

## 9. Design-only integrity

Production source modified:0. Tests modified:0. Production assets modified:0. Repository design/reference files modified or created:0. Original Product Owner North Star images modified:0. Staged files:0. Commits:0. Pushes:0. PRs:0. GitHub writes:0.

New files are solely in this task's external `us029-design-proposal` directory: the proposal, index, prototype, render/zoom/gallery-check tooling, twenty PNG studies, manifests/provenance and inline gallery. `gallery-review.png` is an auxiliary preview check, not a twenty-first study or runtime capture. Thirty gallery image/layout checks passed across320/736/1024px preview widths; Codex supplies carousel navigation and that host navigation was not reproduced by the check. Temporary native calibration tooling was outside the repository. Existing Product Owner source images and previously approved story reference packages remain separate from these new unapproved US-029 studies.

The recommended native/default-text and text-enlargement direction remains renderer/CSS/host presentation within current geometry and ownership. No Electron window, Phaser game coordinate, shared provider contract, lifecycle, trusted-state, IPC/preload or security boundary change is requested. The page-zoom support decision is unresolved product/design scope, not evidence that such a boundary change is required.

ARCHITECTURAL INPUT REQUIRED: NONE

US-029 DESIGNER PROPOSAL COMPLETE — READY FOR PRODUCT OWNER REVIEW
