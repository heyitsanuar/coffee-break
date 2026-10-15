# EP-07 North Star Visual Experience — visual studies

**Status: visual exploration for Product Owner review. No design or implementation approval.**
Baseline: `planning/ep-07-north-star-visual-experience` at `a02f94bf5d65c6854bed58822530798536ef2275`.

These are static concept compositions. Agent activity, time, availability and Sample entries on the boards are explicitly illustrative. The rendered PNGs are **not runtime or native accessibility evidence**. Original North Star, EP-06 references, runtime images and contracts were read only.

| Study | Image | Purpose |
| --- | --- | --- |
| 01 | [Normal desktop, 1100×760](renders/01-desktop-overview.png) | Slim rail; dominant fixed Studio; unselected office inspector; Agents, Worlds and Sample activity. |
| 02 | [Ari selected, 1100×760](renders/02-desktop-ari-model-usage.png) | Portrait, lifecycle, freshness, exact illustrative activity and first-class Model & Usage unavailable state. |
| 03 | [Labels and selection](renders/03-label-selection-comparison.png) | Ari, Mina and Sol: fallback lifecycle, literal activity excerpt and selected treatment; Current, Last known and No state; warm selection versus cyan focus. |
| 04 | [20×24 versus 24×32 sprite cells](renders/04-sprite-cell-comparison.png) | Independently drawn alternatives at exact 2× display size, three identities and poses, portraits and workstation fit. |
| 05 | [Fixed overview versus manual detail](renders/05-fixed-hybrid-comparison.png) | Same rich room in whole-room and deliberately entered detail views; visible Return control and benefit/cost. |
| 06 | [Compact initial 760×540](renders/06a-compact-760x540.png), [complete compact flow](renders/06c-compact-full-flow.png), [expanded desktop 1100×760](renders/06b-expanded-1100x760.png), [retained state](renders/06r-retained-selected-desktop.png) | Office-first compact document order and selected inspection; local expansion without the rail; distinct disconnected availability and last-known agent state. |
| 07 | [Controls and microinteractions](renders/07-controls-state-sheet.png) | Default, hover, pressed, keyboard focus and meaningful unavailable states for rail, selector, time/count, Expand, tabs, selection, disclosure and tooltip. |
| 08 | [Bounded movement storyboard](renders/08-bounded-movement-storyboard.png) | Seated, standing, short own-cluster walks, return, Sol's exact coffee predicate, interruption and reduced-motion static meaning. |

## Visual authority and classification

1. **Original Product Owner North Star** in `docs/design/references/north-star/` supplies the dominant pixel-art office, expressive agents, dark application chrome and integrated inspection ambition. It does not authorize its model, token, productivity, GitHub or multi-room functions.
2. **Approved EP-06 references** in `docs/design/references/ep-06/` establish the navy shell, Studio composition, desktop and compact hierarchy, responsive behavior and Runtime / Sample / Preview distinctions.
3. **Existing EP-05/06 implementation** supplies current Studio, Ari/Mina/Sol identities, 640×360 room, selection, trusted lifecycle/inspection and the three real informational World previews. Study 01–06 compositions, rich room art, new sprite variants, manual detail, rail and Model & Usage surface are **proposed**, not implemented. Functional world switching, live provider telemetry and general navigation are **future-dependent and absent**.

The proposal uses the real `Retro 70s`, `Arcade 80s` and `Cyber 2000` preview artwork as read-only references from the current application. Studio is the only runtime world. Meeting and Focus zones are decorative. The Sample activity card is expressly fictional. A clock concept shows illustrative local time; the count is three known inhabitants, never an online metric.

## Recommendation and tradeoffs

- **Desktop:** 64px rail; 642px office column; 320px contextual inspector. Preserve the whole room as the dependable entry and keep Agents/Worlds aligned below it. At 760px use a 56px rail and inline order **Office → Agents → Inspector → Worlds → Sample**. The initial compact viewport shows the full office and an explicit Inspect route.
- **Characters:** carry the **24×32** study alternative into a later art/geometry validation because the hair, posture and clothing read more clearly at 48×64. It costs desk, chair and plaque clearance; existing 20×24 remains the runtime baseline. These generated cells need hand cleanup, tested anchors and foreground masks before any production decision.
- **Room:** prefer a rich fixed overview. Offer manual detail only if a compact usability study confirms the crop, return path and pixel clarity. No automatic camera movement follows selection and no free panning is assumed.
- **Labels:** default to name plus a literal activity excerpt where available, lifecycle fallback otherwise. Show exact activity/reason through the inspector. A warm plaque and floor marker show selection; cyan shows keyboard focus. Present availability separately from lifecycle and pause repeating character/workstation motion while disconnected or synchronizing.
- **Model & Usage:** keep the section visible in inspection. Show **Unavailable** independently for model identity, input tokens, output tokens, context utilization, remaining allowance/quota and estimated cost. Do not render zeros, empty progress bars, provider controls or invented statistics.
- **Motion:** author short clusters only. Sol's mug and route require the exact trusted coffee activity with Waiting; generic waiting never creates coffee. Retained or reduced-motion presentation remains static and textual.

## Product Owner decisions still needed

1. Is the 64/56px rail and 642/320px desktop balance the preferred shell direction?
2. Should the 24×32 character option proceed to production-grid and occlusion validation, or remain at 20×24?
3. Is manually invoked room detail worth a later compact interaction study, or should EP-07 use the fixed overview alone?
4. Are the two-line literal labels, alternate placement and warm/cyan separation approved as the default vocabulary?
5. Is a visible but wholly unavailable Model & Usage section the right interim presentation?
6. Which bounded routes and interruption/reduced-motion rules should engineering plan once story scope is approved?

## Evidence and limits

[Image generation provenance](art-provenance.json), [derived pixel-cell recipe](art-derivations.json), [render measurements and hashes](render-record.json) and [generation instructions](generation-prompts.md) accompany the boards. Five original generated bitmaps were copied into `art/` unchanged, then separately sampled into exact-size study cells; no original project reference was altered. The static renderer checked each image load, output dimensions and page-level horizontal overflow. It did not test the actual app, 200% OS text, VoiceOver, keyboard traversal, final hand-authored sprites or compact manual-detail usability. The proposed 3× expanded room is a study, not a statement about current application behavior.
