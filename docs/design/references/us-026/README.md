# US-026 — Approved North Star office environment reference

**Status: PRODUCT OWNER-APPROVED DESIGN TARGET.** This is the durable visual reference for [US-026 #60](https://github.com/heyitsanuar/coffee-break/issues/60), Rebuild the Office Environment in the North Star Style. It is not an implemented runtime result or story acceptance record.

## Authority and approval provenance

The [original North Star references](../north-star/) are existing Product Owner-provided and committed source artifacts. They remain read-only and the permanent higher-level visual authority. US-026 translates that direction into the current single office with Ari, Mina and Sol; it did not create the original references.

Authority follows: original approved North Star → Product Owner-approved corrected EP-05 direction → this approved US-026 environment target → compatible existing implementation. The merged US-025 shell remains the shell baseline; US-026 changes the office environment.

The corrected studies were originally generated and submitted as **unapproved design studies**. The Product Owner subsequently reviewed the corrected proposal and explicitly stated **“I approve”**. The Product Owner's promotion brief supplied to the Designer records that approval and authorizes this documentation checkpoint. Approval applies to the corrected environment direction; it does not claim implemented behavior, technical approval or completed acceptance criteria.

These promoted references now record the current approved status. The historical study README/manifest still saying “NOT APPROVED” correctly describes their generation/submission status and has not been rewritten.

Promotion baseline: branch `feature/us-026-north-star-office-environment`, HEAD `42b26a61b3d22a919e809e1ef9bda35440b420f2`. The selected corrected studies originated in the Designer's US-026 North Star fidelity-correction exploration and were promoted byte-for-byte after Product Owner approval, preserving dimensions and encoded contents.

The durable PNGs in this repository package are the implementation/review inputs. Future use does not require the ephemeral Designer workspace. Rejected-proposal comparisons, generation intermediates, scripts, caches and historical status metadata are not promoted.

## Reference roles

**One primary environment implementation composition: [corrected-clean-office.png](corrected-clean-office.png).** Use it for the room program, camera, proportions, furniture distribution and environmental palette. Final production pixel cleanup/authorship is required; do not install this study as the production background.

| Reference | Governs | Dimensions |
| --- | --- | --- |
| [corrected-clean-office.png](corrected-clean-office.png) | **Primary environment implementation composition**; unobstructed room/furniture target | 640×360 |
| [north-star-vs-corrected.png](north-star-vs-corrected.png) | **Primary fidelity/provenance reference**; compare the approved translation with the original family at equal room width | 1364×811 |
| [corrected-current-agents.png](corrected-current-agents.png) | Current-agent placement, workstation occupancy, label/selection clearance | 640×360 |
| [corrected-layering-study.png](corrected-layering-study.png) | Rear/agent/foreground visual intent and lower-body occlusion; subject to source constraints below | 1080×650 |
| [corrected-zoning-study.png](corrected-zoning-study.png) | Work, coffee/break, lounge/support and continuous open floor | 1050×493 |
| [north-star-visual-dna.png](north-star-visual-dna.png) | Original reference crops: palette, silhouettes, simple prop clustering and proportion guidance | 1280×812 |
| [corrected-desktop-1100x760.png](corrected-desktop-1100x760.png) | Environment fit within the actual merged US-025 desktop shell | 1100×760 |
| [corrected-compact-760x540.png](corrected-compact-760x540.png) | Full office/roster/selected summary at the minimum size; existing detail inspection continues below by scrolling | 760×540 |
| [corrected-sol-semantics.png](corrected-sol-semantics.png) | Canonical coffee versus generic Waiting; permanent coffee furniture is not an activity claim | 1364×516 |

The comparison establishes visual fidelity; the clean office supplies the direct composition target. Supporting sheets clarify particular concerns rather than supplying competing directions. Reconcile monitor framing/occupancy with the current-agent and layering sheets: the clean generated study has blank monitors, while the occupied study demonstrates existing 20×8 logical state fields with a small grid-sized rim/stand adapter. Final production art must accommodate those fields intentionally.

## Approved environment properties

### Perspective and geometry

- High-angle/top-down game-world overview with broad visible floor and furniture tops, short front faces and restrained depth. Avoid upper-corner, isometric or cozy interior illustration.
- One complete 16:9 office, **320×180 logical environment → integer 2× → 640×360 display**, with crisp nearest-neighbour presentation.
- Keep the current **20×24 agent frames** during US-026. US-027 owns character redesign; current standing silhouettes are a known compatibility limit.

### Composition and visual DNA

- Upper-left lounge/support area with localized magenta/slate furniture and rug; rear storage/window; two compact upper workstations; lower-left coffee area; continuous middle/lower amber floor and open circulation.
- Amber plank floor, blue-violet/slate boundaries, compact honey desks, navy workstation/chair silhouettes, pointed green foliage, compact tiered storage/shelving, gray coffee furniture and bounded rug/tile patches.
- Richness comes from clustered simple props, quiet texture, limited highlights/shading and short furniture fronts. Retain negative space; do not restore the rejected shared sage work mat or sparse rear-right coffee composition.
- Fixed authored placement and layering; no autonomous navigation/pathfinding, additional functional rooms or shell redesign. No fake code, task/model/token/productivity statistics, project boards or provider controls.

### Agents and trusted semantics

- Ari and Mina each occupy a workstation with a chair/desk/monitor relationship. Sol has a believable coffee/break location and **no workstation**.
- Permanent coffee furniture/cups are environmental decoration. Only **Sol (`mock-agent-sol`) + `waiting` + exact activity `Taking a coffee break in the simulated office`** receives the canonical coffee presentation. Generic Waiting or Idle does not imply coffee.
- The existing runtime coffee predicate and trusted presentation remain authoritative. Preserve the five lifecycle states, workstation forms, exact activity/reason, retained-state behavior and reduced-motion behavior. Availability stays separate from lifecycle; operational loops pause when presentation is not live.
- Preserve selection, keyboard/focus visibility and textual equivalents through the existing shell/inspection experience. Static studies do not establish accessibility or interactive runtime behavior.

## Study coordinates — design inputs

Coordinates are room-local: logical art positions and their integer 2× scene/display equivalents, **not application-window positions or mandatory runtime constants**.

| Design input | Logical (x, y) | Scene/display (x, y) | Convention |
| --- | --- | --- | --- |
| Ari | (146, 87) | (292, 174) | Agent bottom-center |
| Mina | (240, 87) | (480, 174) | Agent bottom-center |
| Sol | (110, 141) | (220, 282) | Agent bottom-center |
| Ari monitor state field | (158, 51) | (316, 102) | Inset top-left; 20×8 logical field |
| Mina monitor state field | (252, 51) | (504, 102) | Inset top-left; 20×8 logical field |

The Developer must translate these through actual Phaser anchor/origin/scaling conventions and may make minimal compatibility adjustments that preserve the approved composition, workstation relationships, crisp rendering and visibility. They are not instructions to blindly replace constants. Material visual departures require Designer/Product Owner review; architecture remains the Planner's responsibility.

## Source-discovery implementation constraints

These notes describe baseline source and Developer discovery, not architecture changes authorized by this reference:

- [officeLayout.ts](../../../../apps/desktop/src/office/officeLayout.ts) defines background depth 0, agent depth 10 and foreground depth 20. In [OfficeScene.ts](../../../../apps/desktop/src/office/OfficeScene.ts), selection is depth 11 and name/state layers are depth 12. **Foreground currently sits above selection/name/state layers**: preserve their visibility through intentional transparent/clear foreground regions. The layered study is not proof of the runtime draw order.
- Sprites use origin `(0.5, 1)`, the current render scale and normal Phaser `setInteractive` bounds. Clearance rectangles in layout metadata are **not explicit hit areas**; do not assume those rectangles enlarge pointer targets. Preserve interaction while translating occupancy/anchors.
- Fallback furniture and [monitor geometry](../../../../apps/desktop/src/office/workstationPresentation.ts) must move consistently with the new composition. Both textured and fallback presentations must retain truthful workstation relationships; Sol must not receive a monitor.
- Coffee steam currently uses fixed production room coordinates `(574, 192)` and needs explicit translation to the new coffee/mug relationship. Do not derive its new position by blindly applying an agent-anchor offset.
- The [canonical coffee predicate](../../../../apps/desktop/src/office/officePresentation.ts) already exists and must not change. Geometry/asset changes do not authorize a lifecycle, contract, transport, Connector or security change.
- Coordinated rear/foreground art may express the approved fixed occlusion intent. Preserve face/hand/label/selection visibility; decorative foreground must not obstruct selection. Planner determines the narrow implementation mechanism and required validation.

## Generated-study disclosure and validation boundary

The corrected environment used **reference-guided built-in image generation**, targeted composition adjustments and nearest-neighbour normalization to 320×180. Current sprite frames were embedded unchanged; shell studies are static composites using the existing merged US-025 captures. The DNA/comparison sheets contain read-only original reference crops. This is new Designer study material, distinct from the original Product Owner North Star artifacts.

These promoted PNGs are approved composition/style/fidelity **design references**, not production-ready pixel assets, implemented runtime screenshots or evidence that tests/accessibility/animation passed. The Developer must intentionally author and clean up Coffee Break production pixel art, including palette/noise reduction, coordinated foreground transparency and room/state-overlay alignment. Do not treat generated study pixels as final authored production art.

Implementation still requires runtime fidelity review at 1100×760 and 760×540, all five states, coffee positive/negative cases, live/retained presentation, selection/hit behavior, keyboard/focus and reduced motion, plus the story's normal automated checks and independent review. Product Owner visual-direction approval does not mark US-026 complete.
