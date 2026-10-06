# Coffee Break Design North Star

Coffee Break should feel like **a small office inhabited by AI agents**. The virtual office is the primary product surface: character behavior and the environment communicate broad operational meaning, while contextual inspection provides precise trusted information.

## Authority and provenance

Design authority follows this hierarchy:

1. Original approved Product Owner North Star references.
2. Product Owner-approved epic/story design specifications and explicit decisions.
3. Current implementation, which records implementation state rather than defining design authority.

The original images in [`references/north-star/`](references/north-star/) are existing Product Owner source artifacts. The Product Owner provided, committed, and pushed them before US-019 documentation preparation. They entered this baseline in commit `243c6c162214759d11d932b3cb3071bdbc51e275` (`docs: add Coffee Break north star references`). US-019 did not create these images. Treat them as read-only: do not edit, redraw, replace, rename, delete, or revert them as part of design work.

| Original reference | Product guidance |
| --- | --- |
| [01 — Office overview](references/north-star/coffee-break-north-star-01.png) | A populated workplace as the central surface; recognizable inhabitants; workstations, coffee area, and environmental warmth. |
| [02 — Contextual coffee/capacity concept](references/north-star/coffee-break-north-star-02.png) | Contextual character expression paired with detailed inspection; personality around a meaningful situation. Its token/refill UI is not a current capability or a generic waiting rule. |
| [03 — Selected-agent inspection](references/north-star/coffee-break-north-star-03.png) | Direct world selection, consistent identity across character and inspector, and two levels of information. |
| [04 — Project-office concept](references/north-star/coffee-break-north-star-04.png) | A longer-term relationship between a team, an office, and project work. GitHub, boards, analytics, and controls shown here require separately approved scope and trusted capabilities. |

These are product North Star references, not automatic pixel-perfect specifications. A visible button, statistic, room, name, or decoration does not authorize a feature. Still images suggest interactions; they do not prove their behavior, data availability, or accessibility.

Meaningful departures must be intentional and recorded in the relevant story specification. Trusted-data constraints, accessibility, architecture/security boundaries, platform constraints, approved scope, and explicit Product Owner decisions can justify departures. Designers describe desired experience; the Planner determines architecture. Design references cannot authorize a contract, transport, or security change.

## Lasting product principles

- Keep the office dominant and application chrome restrained.
- Communicate broad state through character behavior, then workstation/environment behavior, then contextual/comic accents and supporting symbols.
- Keep persistent compact identity discoverable. Put exact trusted lifecycle, activity, and reason in inspection.
- Give the office personality without inventing operational facts. Generic waiting or idle never implies coffee, and idle never implies sleeping.
- Maintain coherent pixel scale, palette, silhouettes, layering, nearest-neighbor rendering, and restrained animation. Application surfaces need visual cohesion with the office; they need not all be pixel art.
- Support desktop-window reflow, keyboard selection, visible focus, textual equivalents, and reduced motion.
- Distinguish availability/freshness from lifecycle. Retained information must be recognizable as last known, with operational loops paused.

## Current story direction

[EP-04 Living Office — US-019](ep-04-living-office.md) records the resolved design direction, implementation baseline, intentional departures, and later implementation/design-review validation. **The Product Owner has approved the final US-019 specification; it is the approved design source for subsequent EP-04 engineering planning.** Design approval does not itself authorize production implementation; each engineering story requires authorization and the normal implementation/review workflow.

For this increment, the Product Owner + Planner accepted the fixed-room scope and warm cream/ink/coffee/sage foundation rather than reproducing the references' large multi-room dashboard and dark chrome. Exact name artwork, supporting symbols, inspector styling, and selection artwork can be refined during implementation and Designer review within the resolved direction. No label preference is approved.

### EP-05 — US-026 approved environment reference

[US-026 — Approved North Star office environment reference](references/us-026/README.md) records the Product Owner-approved corrected environment direction, durable visual targets, study coordinates and source-discovery constraints. The clean corrected office is the primary environment implementation composition; the North Star comparison is the primary fidelity/provenance reference. These generated studies are design references, not production assets or runtime evidence. The original North Star remains the permanent higher-level authority; US-027 owns character redesign and the merged US-025 shell remains unchanged.

### EP-05 — US-027 approved agent references

[US-027 — Approved North Star Agent References](references/us-027/README.md) records the Product Owner-approved character direction, identity/lifecycle/world-fit targets, exact coffee distinction and approval provenance. The package preserves 20×24 frames, existing US-026 environment geometry and trusted presentation semantics. These are design references, not production character assets, implemented runtime evidence or story acceptance.

### EP-05 — US-028 approved selection and inspection references

[US-028 — Approved selection and agent information studies](references/us-028/README.md) preserves the exact Designer proposal images. The proposal was initially unapproved; the Product Owner subsequently said “I approve”, approving recommendations 1–25. The canonical Idle portraits, identity-led contextual inspection and invisible pointer envelopes integrate the unchanged US-025/026/027 foundation. These studies are design references, not runtime evidence or final story acceptance. US-029 retains broader responsive refinement; US-030 retains final integrated fidelity/polish.

## Application tokens

Exact hex colors, spacing values, typography sizing, and radius values in this section document the **current EP-04/application direction**, not immutable Coffee Break North Star requirements. The permanent North Star is the product/experience hierarchy and visual principles above. Future approved design-system evolution may change exact token values without constituting a North Star departure; the authority and provenance rules still apply.

Tokens use role-based names so components express intent rather than a particular shade. The current application palette is:

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#F5F1E9` | Desktop canvas |
| `--color-surface` | `#FFFCF7` | Panels and application surfaces |
| `--color-ink` | `#302B29` | Primary text |
| `--color-ink-muted` | `#625A56` | Secondary text |
| `--color-coffee` | `#A56B46` | Warm decorative emphasis |
| `--color-sage` | `#77917A` | Calm decorative emphasis |

Typography uses the native system sans-serif stack. Body text starts at `1rem`; display text uses a fluid title token so it scales down with the window. Spacing tokens follow a small `0.5rem`, `0.75rem`, `1.5rem`, and `2rem` scale. Radius tokens cover panels and fully round marks.

## Layout and components

The React application shell owns desktop layout and application surfaces. Content should reflow within the supported `760 × 540` minimum window, use a readable maximum width, and keep essential content reachable without horizontal scrolling. Detailed inspection may continue below the office through vertical document scrolling. See the story specification for selection feedback and information priority.

Components must use shared tokens for colors and repeated, semantic spacing. Isolated component-specific dimensions and decorative geometry may use local literal values when a reusable token would add no value. Add a primitive only when a current screen needs it. Interactive controls must have visible keyboard focus, clear hover and pressed feedback, and accessible names.

## Agent expression and accessible information

Character and workstation behavior carry the primary state meaning. Symbols reinforce that behavior; the exact glyphs from generated studies are not approved vocabulary. Color alone must never carry lifecycle, availability, selection, or focus. Precise trusted text remains available through inspection and equivalent keyboard selection. Error/warning accents and contrast must be checked in context; decorative sage or coffee colors do not establish an accessible status scheme by themselves.

## Phaser boundary

These CSS tokens belong to React application UI. Phaser scenes and art assets keep their own palette and rendering rules; do not import application CSS into Phaser or treat these tokens as game-state contracts. Existing architecture and trusted-state constraints remain authoritative technical boundaries.
