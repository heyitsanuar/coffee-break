# US-027 — Approved North Star Agent References

**Status: APPROVED DESIGN REFERENCE.** This is the durable Product Owner-approved character implementation/review target for [US-027 #61 — Redesign Ari, Mina, and Sol as North Star Agents](https://github.com/heyitsanuar/coffee-break/issues/61). Design approval does not establish implementation, runtime correctness or Product Owner story acceptance.

## Product Owner approval and provenance

The Designer produced these studies during the US-027 proposal as **PROPOSAL — NOT APPROVED** material. The Product Owner subsequently reviewed the visual proposal and explicitly stated **“I approve”**. The Product Owner's promotion brief records approval of the proposed character direction and all 15 requested decisions:

1. Overall sprite simplicity.
2. 20×24 frame size.
3. Shared proportions.
4. Ari identity.
5. Mina identity.
6. Sol identity.
7. Idle pose language.
8. Working A/B language.
9. Waiting pose language.
10. Completed acknowledgement and settled language.
11. Error acknowledgement and settled language.
12. Ari/Mina workstation inhabitation.
13. Generic Sol Waiting.
14. Canonical Sol coffee pair.
15. Selection/readability compatibility.

The selected studies were then copied byte-for-byte into this package under descriptive filenames. Their original **NOT APPROVED** captions truthfully record proposal creation/submission status and are intentionally preserved; this README records the subsequent approval and current reference authority. Historical proposal files were not rewritten. No image was regenerated, resized or re-encoded during promotion.

Promotion baseline: branch `feature/us-027-north-star-agents`, HEAD `d155d4099a4efa45e24564d4f74a8cc389de7d75`, with merged US-026 and a clean working tree before promotion. The durable files below are sufficient for implementation and later review; future readers do not need the temporary Designer workspace, preview code or metadata.

The [original North Star images](../north-star/) are existing Product Owner-provided and committed source artifacts. US-027 did not create, redraw or change them.

## Reference authority and index

Visual authority follows:

1. Original approved North Star references.
2. Approved US-027 character references in this package.
3. [Approved US-026 environment references](../us-026/README.md).
4. Current implementation where compatible.

US-027 specializes the character direction without overriding the broader North Star product language or redesigning the approved environment. Existing trusted lifecycle, coffee eligibility, acknowledgement, retained-state and accessibility behavior remain constraints; this visual hierarchy does not authorize architecture, shared-contract, transport or security changes.

| Durable reference | Authority / review purpose | Dimensions | Original study |
| --- | --- | --- | --- |
| [agent-identity-lineup.png](agent-identity-lineup.png) | **PRIMARY IDENTITY REFERENCE** — unlabelled identities at native 1×, intended 2×, enlarged 6× and silhouette-only 2× | 1000×500 | B |
| [lifecycle-matrix.png](lifecycle-matrix.png) | **PRIMARY LIFECYCLE REFERENCE** — all three identities × eight forms at 1×, 2× and 6× | 1120×980 | C |
| [lifecycle-in-office-matrix.png](lifecycle-in-office-matrix.png) | **PRIMARY WORLD-FIT REFERENCE** — every lifecycle pose selected in its existing office location at intended 2× | 1200×650 | K |
| [north-star-character-comparison.png](north-star-character-comparison.png) | **PRIMARY NORTH STAR COMPARISON** — read-only original character crops versus the approved compact translation | 1100×695 | J |
| [sol-coffee-semantics.png](sol-coffee-semantics.png) | **PRIMARY COFFEE REFERENCE** — generic Waiting, Coffee A/static and Coffee B inside the existing coffee zone | 1100×455 | E |
| [character-visual-dna.png](character-visual-dna.png) | Supporting proportions, outline, face vocabulary, limited shading and identity palettes | 1100×500 | A |
| [workstation-inhabitation.png](workstation-inhabitation.png) | Supporting Ari/Mina Working, Waiting and settled Completed/Error occupancy and foreground relationships | 1100×700 | D |
| [selection-readability.png](selection-readability.png) | Supporting selected Ari/Mina/Sol, persistent labels and separate keyboard focus | 1100×670 | F |
| [motion-semantics.png](motion-semantics.png) | Supporting live frame relationships, bounded acknowledgements and static equivalents | 1100×665 | G |
| [desktop-1100x760.png](desktop-1100x760.png) | Supporting full office at actual 2× in the existing desktop shell | 1100×760 | H |
| [compact-760x540.png](compact-760x540.png) | Supporting complete office, roster and selected summary at minimum window size | 760×540 | I |

Review at natural image size. Some sheets include enlarged inspection or an explicitly labeled smaller overview; those views do not change the intended 2× runtime scale. The lifecycle boards use a semantic comparison order; the native sheet order below remains authoritative for frame indexing.

## Approved shared character system and identities

- **20×24 logical frames → integer 2× → 40×48 display pixels**, with bottom-center origin `(0.5, 1)`.
- Compact game-like proportions: relatively large heads, compact torsos, short limbs, simple faces and strong silhouettes. Heads are approximately 12×11 logical pixels and torsos approximately 8×8; hair silhouettes vary within the same cell.
- Broad clothing color blocks, limited stepped shading and strong ink edges. A few face marks and restrained material tones carry expression; no decorative state icons or realistic/illustrative treatment.
- Characters remain small inhabitants of the larger office. Identity comes from hair/head silhouette and clothing blocks, not labels alone.

| Identity | Approved appearance |
| --- | --- |
| Ari | Short dark hair; sage clothing; compact readable silhouette |
| Mina | Asymmetric brown bob/hair silhouette; terracotta clothing; silhouette clearly distinct from Ari |
| Sol | Short blond crop/tuft; navy clothing; recognizable identity across ordinary and coffee poses |

These are visual identities only. No personalities, biographies, roles, providers or unsupported operational meaning are assigned. Character behavior communicates broad lifecycle meaning; existing workstation reinforcement and textual inspection supply supporting and precise information.

## Approved lifecycle matrix and motion compatibility

Preserve the existing **8-column × 3-row lifecycle structure**, with Ari/Mina/Sol rows and 20×24 cells: **160×72 total**. The column indices below are zero-based.

| Column | Form | Approved pose meaning |
| --- | --- | --- |
| 0 | Idle | Calm, arms down, available; stable pose without a breathing requirement |
| 1 | Working A | Engaged workstation pose; meaningful without alternating frames |
| 2 | Waiting | Hands inward, work visibly stopped, attentive; no coffee by default |
| 3 | Completed settled | Low open hand and small positive expression; stable, no continuous celebration |
| 4 | Error settled | Attentive stopped pose with hand near chin; stable attention, no looping distress |
| 5 | Working B | Subtle one-pixel hand/forearm change; fixed head and body |
| 6 | Completed acknowledgement | Brief raised-hand reaction |
| 7 | Error acknowledgement | Brief restrained attention gesture, distinct from Completed; no flash or theatrical panic |

The design is compatible with existing runtime timing: Working A/B approximately **600ms each / 1200ms cycle**, Completed acknowledgement approximately **500ms** then settled, and Error acknowledgement approximately **400ms** then settled. Sol's ordinary lifecycle forms communicate broad state without inventing a workstation or task-specific prop.

Acknowledgements occur only for eligible live transitions. They must not replay on snapshot, repair, remount, selection, retained state, resynchronization or activity-only updates. Eligibility remains the existing runtime's responsibility; no new event semantics are authorized.

Retained and reduced-motion equivalents are **Working A, Completed settled, Error settled and Coffee A**. Essential meaning must survive without transient animation. Repeating operational character/workstation motion pauses when presentation is not live; stable cues may remain. Availability and last-known qualification stay separate from lifecycle, with precise trusted text available through inspection.

## Workstation inhabitation, selection and labels

Ari and Mina retain the existing US-026 bottom-center anchors `(292,174)` and `(480,174)` in scene/display coordinates. Sol retains `(220,282)` at the coffee/break zone and has no workstation. The existing 40×48 frame rectangles and 48×64 clearance remain the design fit; no enlargement or anchor movement is required.

Ari/Mina visibly occupy the authored chairs/desks through compact seated lower bodies. Existing foreground seat strips may overlap their lower bodies, while heads and meaningful gestures remain clear. **Room artwork, environment anchors and current coffee geometry remain unchanged.** Character redesign improves inhabitation within that environment.

Selection remains external to character artwork and separate from lifecycle; keyboard focus remains separate from selection. Persistent names and quiet lifecycle text remain available. Existing selection geometry is compatible with 20×24. Exact trusted activity/reason stays in contextual inspection. No US-028 information redesign is authorized by this package.

## Generic Sol Waiting versus canonical coffee

Generic Sol Waiting uses the normal attentive Waiting pose: **no cup gesture, no coffee implication and no steam-specific character treatment**. Permanent coffee furniture/cups remain decoration and cannot establish current activity.

Canonical coffee applies only to the existing conjunction:

- Agent: `mock-agent-sol`.
- Lifecycle: `waiting`.
- Activity exactly: `Taking a coffee break in the simulated office`.

Do not alter this predicate. Coffee is a contextual override, not a new lifecycle; inspection still reports Waiting and the exact trusted activity.

The separate approved Coffee A/B pair preserves Sol's identity and aligns its cup gesture with the existing coffee environment/steam. A holds the cup by the return ledge; B shifts it one logical pixel inward without moving the head, body or anchor. **Coffee A** supplies the static retained/reduced-motion presentation. The existing pair cadence (approximately 500ms per frame) and independent steam cadence remain compatible; no forced synchronization requirement is introduced.

**Approved coffee-sheet recommendation: Strategy A.** Retain the existing **120×24 / six-column** sheet structure and Sol pair at zero-based columns **4/5**. A dedicated new coffee sheet is not required. Blank/unused proposal cells are design-layout placeholders, not instructions to delete unrelated production content.

## Design-study and validation boundary

These images are **DESIGN REFERENCES**, not production assets or runtime screenshots, and not proof that US-027 has been implemented. Production artwork must be authored independently at the intended pixel grid; do not install the study boards as character sheets. Runtime evidence must be captured after implementation.

The proposal's character drawings used explicit integer canvas pixels. Office composites display unchanged US-026 production room artwork with reconstructed state/selection/label presentation. Desktop/compact studies use existing shell captures as context; the focus/roster example is existing US-026 evidence. The North Star comparison contains read-only original crops and does not infer the originals' native sprite resolution. These compositions establish design intent and fit, not actual US-027 application behavior.

The Designer inspected all identities, lifecycle forms and coffee frames at intended scale during the proposal. This does not replace post-implementation Designer review, independent technical review or Product Owner story acceptance. Validate all states and identities in the actual runtime at both supported sizes, exact coffee positive/negative cases, live/retained presentation, bounded/non-replaying acknowledgements, reduced motion, selection/hit behavior, labels, keyboard/focus and textual/non-visual equivalents. AC09 replay prevention and AC17 regression success remain engineering/runtime gates.

No architecture, contracts, transport, security boundaries, provider integration or subsequent story scope is changed or authorized by this reference promotion. Temporary HTML, preview JavaScript, motion-demo code, native proposal sheet exports and temporary metadata are not part of this durable package.
