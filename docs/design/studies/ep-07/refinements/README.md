# EP-07 targeted visual refinements

**PROPOSED — AWAITING PRODUCT OWNER REVIEW.** Continued design exploration is authorized; final design authority and the US-037–046 implementation backlog remain unapproved.

Baseline: `planning/ep-07-north-star-visual-experience` at `a02f94bf5d65c6854bed58822530798536ef2275`. All new artifacts live in `docs/design/studies/ep-07/refinements/`. The 54 original EP-07 study files are preserved byte-for-byte; existing Finder metadata is left in place. Application source, runtime assets, contracts, tests, original North Star and EP-06 references are unchanged.

These PNGs are **static design compositions**, not application captures or native accessibility evidence. Activity, clock and availability values are illustrative fixtures. No new bitmap art was generated: the compositions read the original study art and current preview crops through relative links. The foreground adjustment uses narrow visible slices of the same room in the study page; it does not alter its image file.

## Visual index

| File | Pixels | Purpose |
| --- | --- | --- |
| [r1-a-compact-plaques-desktop.png](renders/r1-a-compact-plaques-desktop.png) | 1100×760 | A: 92px under-foot identity / literal excerpt; full selected desktop. |
| [r1-b-richer-selection-desktop.png](renders/r1-b-richer-selection-desktop.png) | 1100×760 | B: compact name chip / visible excerpt; richer selected plaque; full desktop. |
| [r1-c-adaptive-labels-desktop.png](renders/r1-c-adaptive-labels-desktop.png) | 1100×760 | C: adaptive quiet-area plaque with leader; full selected desktop and independent focus. |
| [r1-full-office-comparison.png](renders/r1-full-office-comparison.png) | 1100×1372 | Complete native-size office comparison of all three alternatives. |
| [r1-actual-size-label-details.png](renders/r1-actual-size-label-details.png) | 1400×1936 | 18 actual-size close-ups: three alternatives × two cell sizes × Current / Last known / No state. |
| [r2-inspectors-320px-comparison.png](renders/r2-inspectors-320px-comparison.png) | 728×1012 | Grouped and progressive inspectors, each exactly 320px wide. |
| [r2-inspector-content-states.png](renders/r2-inspector-content-states.png) | 1450×1936 | Both alternatives with default, long exact activity/reason, retained and absent trusted state. |
| [r2-grouped-inspector-desktop.png](renders/r2-grouped-inspector-desktop.png) | 1100×760 | Preferred grouped inspector in a full selected desktop composition. |
| [r3-environment-proportions-2x.png](renders/r3-environment-proportions-2x.png) | 1400×1641 | Native 2× environment: original proportions, modest anchor/foreground adjustment, short own-cluster walk. |
| [r3-foot-seat-pose-alignment.png](renders/r3-foot-seat-pose-alignment.png) | 1400×900 | Actual-size Ari/Mina/Sol standing, seated/working and walking comparison; production constraints. |
| [r4-a-reduced-sample-desktop.png](renders/r4-a-reduced-sample-desktop.png) | 1100×760 | Reduced prominence: small Sample portraits and compact existing fictional rows. |
| [r4-b-collapsed-sample-desktop.png](renders/r4-b-collapsed-sample-desktop.png) | 1100×760 | Collapsed Sample card with explicit provenance and access to entries. |
| [r4-b-sample-disclosed-full-flow.png](renders/r4-b-sample-disclosed-full-flow.png) | 1100×900 | Opened Sample disclosure; all three existing fictional entries and project context remain accessible. |
| [integrated-overview-1100x760.png](renders/integrated-overview-1100x760.png) | 1100×760 | Recommended normal unselected desktop using one consistent set of decisions. |
| [integrated-selected-1100x760.png](renders/integrated-selected-1100x760.png) | 1100×760 | Recommended normal selected desktop using the same decisions. |
| [integrated-compact-760x540.png](renders/integrated-compact-760x540.png) | 760×540 | Complete office and explicit inspection route in the minimum initial viewport. |
| [integrated-compact-full-flow.png](renders/integrated-compact-full-flow.png) | 760×1544 | Full compact order: Office → Agents → Inspector → Worlds → Sample. |

## Changes and recommendations

### R1 — choose C: adaptive labels in quiet areas

The original 148px plaques covered desktops, furniture and character space. The alternatives compare fixed 92px under-foot plaques (A), separate default chips with a richer selected treatment (B), and 118–126px plaques with authored safe-placement candidates and short leaders (C). A clips activity early; B changes footprint when selected and needs extra fallback space. C makes the character-to-label relationship clearer while preserving more literal text.

Recommended rules:

- Keep persistent identity and a short **literal** activity on two lines. Use smooth 12px name / 11px activity type; apply an explicit ellipsis. Lifecycle is only the fallback when no activity exists. No state uses an explicit absence message, never an invented lifecycle.
- Prefer a nearby lower-right position when it is clear. Test right/upper-right and lower-left alternatives against faces, desktop/monitor regions, coffee counter, entry, other plaques and the viewport. Ari currently uses clear floor to the right of the desk; Mina uses space below her chair; Sol uses lower-left space.
- Keep a minimum 6px viewport inset. A leader reconnects a displaced plaque to the character; do not pin the labels to a distant legend. Shorten the excerpt before dropping any meaningful line. If no authored candidate fits, revise the art/layout; this package does not authorize hiding all activity behind hover.
- Warm plaque/foot marker/check mean selection. Cyan means keyboard focus, shown independently on Mina's selector in the R1 desktop alternatives. Current / Last known / No state use distinct dot shapes and equivalent text in inspection/selection. Motion and operational loops pause with retained information.
- Full exact activity and optional reason remain in the inspector. Sol's coffee art requires **Sol + Waiting + exact activity “Taking a coffee break in the simulated office”**. R3 uses a separate illustrative neutral Sol fixture; No state contains no coffee prop.

These are authored placements and visual constraints, not an implemented collision solver. R1 close-ups verify every alternative at both 20×24 and 24×32 cells.

### R2 — choose A: grouped telemetry without disclosure

Identity, lifecycle/freshness, exact activity, section navigation and telemetry are visually separated. Model identity, Tokens (input/output), Capacity (context/allowance) and estimated cost form four compact groups. All six values say **Unavailable**. No numbers, provider names, progress bars or unsupported provider actions appear.

Grouped A keeps absence visible without requiring interaction. Progressive B adds explanatory detail but is taller in the rendered comparison and adds four disclosure targets. It may become useful with real content later; it is not the recommended default for absent telemetry.

The inspector remains exactly 320px wide on desktop. Long exact activity/reason wraps and grows the document without truncation or internal scrolling. Last known is explicitly Not live; absent trusted state retains identity but supplies no lifecycle or activity. The four section controls and Clear selection use 44px targets. At compact width inspection becomes inline at 642px and the four sections fit one row.

Proposed keyboard behavior: Tab follows visual/reading order through section buttons and Clear; Enter activates the focused section without an unexpected focus jump. A proper ARIA tab implementation, if chosen, requires its corresponding arrow-key behavior. The study uses static native buttons rather than claiming this final behavior is implemented. Native B disclosures must expose their summary and remove hidden contents from the tab sequence. Focus remains cyan and does not select another agent merely by focusing it.

### R3 — phased sprite recommendation

**Use adjusted 24×32 as the refined visual target, conditionally; retain 20×24 as the runtime baseline until art/geometry validation passes.** At actual 2× size the larger option gives Mina's asymmetric hair and all three postures more room. The smaller option is quieter and preserves more furniture clearance. This is a tradeoff, not automatic approval of larger assets.

The adjustment shifts Ari's study anchor −2px horizontally and Ari/Mina −4px vertically, retaining integer pixels. Narrow foreground slices illustrate desktop layering. The room and furniture dimensions stay unchanged. A separate walking row shifts Ari/Mina only 8px within their clusters; Sol stays at the coffee-area comparison. These study positions differ from current runtime anchors and are not authorized replacements.

Production art must define consistent standing/walking foot baselines and seated seat baselines, keep selection markers below feet, and assign chair pixels to one layer. Generated seated sprites and painted chairs still need cleanup to avoid duplicate chairs. Foreground masks must cover intended torso/leg regions while preserving faces, hand cues and plaques. Keep the fixed 320×180 logical room / 640×360 display; use integer pixels and nearest-neighbour display. Do not enlarge all furniture to accommodate the candidate.

### R4 — choose B: Sample collapsed by default

The unselected Office Overview now supplies direct identity-led inspection routes for the three canonical inhabitants, with truthful freshness and a short room explanation. No operational metrics are added. The default Sample card is a small disclosure with **Sample / Not operational history** visible while closed. Its opened study retains the exact current Harbor entries, references and fixed example times.

Selecting an agent replaces the Office Overview with inspection. Sample remains independent below it; long inspection pushes Sample down naturally. In compact flow, Sample follows Worlds. Proposed Projects navigation should reveal the Sample disclosure and focus the Harbor destination; choosing Office or an agent must not discard disclosure state. These are desired interaction rules for later planning, not behavior verified in the application.

## Integrated direction

All four integrated boards use C labels, grouped A inspection, adjusted 24×32 study sprites, the original rich fixed room, the navy shell and the collapsed Sample default. They do not mix alternatives. Desktop retains the 64px rail, 642px office and 320px inspector; compact uses a 56px rail and a complete fixed office followed by Agents → Inspector → Worlds → Sample. The minimum initial study shows the full room and Inspect Ari route. Supporting content grows vertically.

Increased text should wrap/grow the document rather than shrink type or add internal scrollbars. Labels need an explicit bounded placement/size strategy at enlarged text; that remains a runtime feasibility gate. Reduced motion keeps stable poses, literal labels, freshness and exact inspection; it removes repeated movement/operational animation. The earlier hybrid manual-detail and expanded concepts remain unchanged explorations; this refinement does not approve them.

## Planner questions and remaining uncertainty

1. Can authored safe-position candidates follow bounded motion without text jitter, furniture collisions or leaving the viewport, while preserving smooth text and equivalent keyboard inspection?
2. How should the new art map to the current runtime anchors (292,174), (360,240), (220,282)? The study coordinates must be reconciled with hand-authored room/foreground layers.
3. The current sprite origin is bottom-centre and its clearance begins 56px above the foot anchor. A 24×32 cell at 2× extends 64px upward: its top 8px exceed that current clearance. Validate pointer envelopes, foreground masks and focus/selection geometry before adopting it. No runtime bounds were changed here.
4. Confirm the narrowest presentation mechanism for section activation and Projects revealing Sample, with preserved focus, disclosure state and scroll behavior. No shared provider contract change is needed for honest unavailable values.
5. Verify enlarged text, sticky-toolbar focus clearance, retained/no-state content and reduced motion in the running app when an implementation story is authorized.

No new contract, transport, trusted-state or security design is proposed. Real provider telemetry stays future-dependent. The foregoing are presentation/art feasibility questions for the Planner, not engineering approval.

## Product Owner decisions

Approve or revise: C adaptive labels and its leader treatment; A grouped unavailable inspector; conditional 24×32 target with the production-art gate; collapsed Sample default and useful Office Overview routes; and this consistent desktop/compact composition. Final design specification and backlog approval remain separate.

## Validation and files

The isolated renderer verified all 17 PNG dimensions, source image loading, page-level horizontal fit, desktop/compact inspector widths, plaque viewport insets and non-intersection with measured faces/desktops/counter/entry/other plaques. All 17 renders were visually inspected for legibility, rhythm, hierarchy, furniture fit, Sample provenance and unavailable telemetry. The protected-region check is bounded to the authored rectangles and is complemented by visual inspection; it is not a general collision-system proof.

[preservation-manifest.json](preservation-manifest.json) records original file hashes. [render-record.json](render-record.json) records output hashes, CSS/physical capture dimensions and measured geometry. Retina study captures are exported to the stated CSS target pixel dimensions. [artifact-manifest.json](artifact-manifest.json) inventories every new file with its absolute path. [study.html](study.html), [base-study.js](base-study.js), [refinements.js](refinements.js), [refinements.css](refinements.css) and [render-refinements.cjs](render-refinements.cjs) form the isolated rendering source; they import no application runtime.

Not run: application implementation tasks, repository tests, native keyboard/VoiceOver checks, OS text scaling, or real Phaser animation/occlusion validation. These are design studies; no implementation or acceptance claim is made.
