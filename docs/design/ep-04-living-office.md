# EP-04 Living Office — US-019

**DESIGN STATUS: FINAL SPECIFICATION READY FOR PRODUCT OWNER APPROVAL**

This specification for [US-019 — Establish the Living Office Design Direction (#44)](https://github.com/heyitsanuar/coffee-break/issues/44) incorporates the Product Owner + Planner's finalization decisions. Product/design direction is resolved at the level required for engineering planning. Exact artwork and execution remain subject to implementation refinement and Designer review; generated artwork is not mandatory. Explicit Product Owner approval of this final specification and required review remain pending. Preparing this document does not approve US-019 or authorize US-020, production implementation, commits, pushes, or GitHub changes.

## References and baseline

The [Design North Star](README.md) identifies the authoritative original Product Owner references and their provenance. All four committed reference images are existing Product Owner artifacts, supplied before this documentation work. This document and the North Star documentation are new US-019 design artifacts; the original images are not.

Documentation preparation began from clean `main` at `243c6c162214759d11d932b3cb3071bdbc51e275`, containing the Product Owner's reference-image commit. The application baseline is the completed EP-03 implementation, not a design authority. The [architecture](../architecture/README.md) and [EP-03 verification](../verification/ep-03-mvp.md) establish technical boundaries and evidence limits.

Generated studies reviewed in the conversation explored two window compositions, label alternatives A/B/C, and live/static/retained agent-workstation expression. They are exploratory studies, not approved implementation assets, original North Star replacements, or evidence of exact window geometry or usability. Their exact rectangular name strips, glyphs, furniture, and inspector artwork are not final requirements.

## Current-state inventory — AC-01

| Area | Current implementation |
| --- | --- |
| Composition | React heading, connection notice, fixed Phaser office, persistent inspection panel, and local-simulation note. |
| Room | 640 × 360 scene; 320 × 180 background/foreground art at 2× scale; two workstations and a coffee anchor. Environment artwork is static. |
| Agents | Ari, Mina, and Sol; six 20 × 24 sprite frames at 2× scale, fixed anchors, no autonomous movement. |
| Expression | Ari idle breathing, Mina working gesture, and Sol's explicit coffee animation. Other lifecycle visuals use a still frame plus a label. |
| Labels | Persistent lifecycle/coffee labels beneath agents once trusted state exists. Missing runtime state uses placeholder presentation. |
| Selection | Sprite clicks and named React buttons select one agent; a world outline and pressed-button state match the inspector. Clear selection restores the prompt. |
| Inspection | Name, trusted lifecycle, exact activity, and optional reason. Sol's coffee visual still reports lifecycle waiting. |
| Availability | Connecting/connected/synchronizing/disconnected copy above the office; last-known agents survive loss and synchronization. |
| Window behavior | Default 1100 × 760; minimum 760 × 540; details stack below 48rem and remain reachable by vertical scrolling. |
| Accessibility | Named native buttons, pressed state, focus-visible styling, descriptive office semantics, and polite live regions. Prior native keyboard/focus observations are user-assisted; actual screen-reader announcements remain unverified. |

Source anchors: [host](../../apps/desktop/src/office/OfficeSceneHost.tsx), [scene](../../apps/desktop/src/office/OfficeScene.ts), [presentation](../../apps/desktop/src/office/officePresentation.ts), [inspection](../../apps/desktop/src/office/AgentInspectionPanel.tsx), [availability](../../apps/desktop/src/office/ConnectionStatus.tsx), and [CSS](../../apps/desktop/src/style.css). This draft changes none of them.

## Original vision comparison and intentional departures — AC-02

| North Star concept | Baseline relationship | EP-04 treatment / decision |
| --- | --- | --- |
| Inhabited pixel-art workplace | Partially realized: room and inhabitants exist; state expression is limited. | Office-first expression is accepted; refine character/workstation behavior. |
| Recognizable identities and direct selection | Already realized in basic form. | Treatment C hierarchy resolved: persistent compact identity + contextual expression + precise inspection. Exact artwork is refined during implementation/Designer review. |
| Contextual side inspection | Partially realized through a panel below the office. | Side inspector at normal size; inline inspection below at minimum size. |
| Reactive workstations | Missing; current artwork is static. | Abstract lifecycle reinforcement accepted; no fabricated output. |
| Coffee/contextual character expression | Partially realized through the explicit Sol fixture. | Refine that fixture; never generalize coffee to waiting/idle. |
| Dark chrome and dense dashboard framing | Different from the warm baseline. | Explicit departure: retain cream/ink/coffee/sage and restrained chrome. |
| Multiple rooms, themes, expanded teams | Missing. | Defer; fixed-room scope and three current identities remain. |
| GitHub/project boards, chat/voice, provider and token controls, statistics | Missing and outside this design scope. | Defer to separately approved capabilities; unavailable data must not appear. |
| Slogans, plants, pets, weather, clocks, neon details | Decorative or broader concepts; some room decoration exists. | Not automatic requirements. No additions are required to establish this direction. |

The references communicate recognizable inhabitants, meaningful physical work areas, direct selection, and contextual information. Persistent names are a useful identity concept; large activity callouts and surrounding statistics need not survive. Still-image interaction suggestions do not establish actual trusted capabilities.

## Target composition and visual cohesion

Target feeling: **a small office inhabited by AI agents**.

Keep one fixed room with the two workstations and explicit coffee area. Preserve coherent pixel scale and readable silhouettes. Keep Coffee Break and the current Ari/Mina/Sol identities; reference branding and character names do not authorize renaming.

Application surfaces use the existing warm foundation and system typography. Use restrained borders, spacing, and accents that echo the room without turning every control into pixel art. The office remains the largest continuous product surface. A compact selector supports it; portrait cards, navigation rails, and dashboard grids must not compete with it.

Treatment C is the resolved identity model: each agent has compact persistent identity near or clearly associated with the character. Its treatment must visually belong to the office rather than resemble a generic floating application widget, without covering the character, workstation, or meaningful expression. This does not mandate the rectangular nameplate from the generated study. Exact pixel artwork and placement can be refined during implementation and Designer review.

## Behavior-led lifecycle vocabulary — AC-03 / AC-04

Broad meaning follows this priority: **character behavior → workstation/environment behavior → contextual/comic accents → supporting symbols**. Precise lifecycle, activity, and reason remain in inspection. Do not display exact activity paragraphs throughout the room.

| Trusted lifecycle | Primary character behavior | Workstation reinforcement | Static/reduced-motion equivalent |
| --- | --- | --- | --- |
| `idle` | Neutral ready posture; optional subtle breathing. | Quiet, stable treatment. | Ready pose; restrained supporting cue if needed. No sleeping or coffee inference. |
| `working` | Small body/hand work gesture; restrained loop. | Abstract screen activity synchronized with broad state. | Distinct work pose and stable abstract workstation treatment. No progress claim. |
| `waiting` | Work gesture visibly stops; attentive paused posture. | Active loop stops; stable paused treatment. | Paused pose and static reinforcement. Cause is shown only from trusted reason/activity. |
| `completed` | Brief acknowledgement on entering the state, then settle. | Brief acknowledgement followed by stable completed treatment. | Settled acknowledgement pose/treatment. No productivity or output count. |
| `error` | Brief attention reaction, then stopped work posture. | Stable attention treatment. | Stable attention pose/treatment. No invented hardware failure, damage, or known cause. |

The open circle, diagonal marks, pause, check, and warning glyphs in the studies are candidates, not approved final vocabulary. Behavior and static treatment must remain distinguishable without relying only on color, motion, or glyph familiarity. Do not add agent-specific personalities.

Use restrained repeating motion only where it meaningfully communicates live operational state. Waiting visibly stops working behavior. Avoid continuous celebratory/error loops, flashing, and competing effects. A completion/error acknowledgement occurs once on a meaningful trusted lifecycle transition and settles; selection, rerendering, synchronization restoration, and retained-state display must not replay it. Reduced-motion and retained-state equivalents remain static and meaningful. Exact frame art, cadence, and transition timing belong to implementation refinement and Designer review, not an unresolved product-design decision.

## Contextual micro-interactions — AC-05

Small scripted gestures may express explicit context at an existing anchor. This direction requires no walking, autonomous navigation, general pathfinding, meetings, or commands to agents.

Sol's coffee expression applies only to the existing conjunction:

- Agent: `mock-agent-sol`.
- Lifecycle: `waiting`.
- Activity: `Taking a coffee break in the simulated office`.

The mug gesture, coffee environment, and optional steam/cup accent express this fixture. Inspection still says Waiting and preserves the exact activity. Generic waiting or idle never produces coffee. "Sip" or other onomatopoeia is optional polish only for this fixture: brief, never permanent, not required vocabulary, and never necessary for comprehension. Including or omitting it within these limits is implementation/Designer-review refinement rather than a blocking Product Owner decision. Selection acknowledgement is presentation feedback, not evidence that an agent received an instruction.

## Reactive environment — AC-06

Character expression represents the inhabitant; workstation expression reinforces the same trusted broad situation. Prioritize the existing monitors/desks and immediate coffee context. Keep general furniture, plants, and room lighting mostly static.

Use abstract screen forms or subtle brightness changes, without readable code, logs, messages, progress percentages, model/token information, or productivity measurements. Decorations cannot establish operational facts. Workstation feedback must agree with the character and inspection; a waiting agent must not retain an active work loop. Sol's context is expressed at the coffee anchor rather than inventing a third workstation.

## Selection and precise inspection — AC-07

Sprite selection and equivalent named keyboard controls select the same identity. Use a restrained in-world selected-agent treatment and matching compact selector state. Selection, keyboard focus, and lifecycle remain distinguishable; selection cannot rely solely on color. Exact bracket/outline artwork can be refined during implementation and Designer review.

Use compact named accessible controls; the large portrait-card row is not the default EP-04 direction. Small identity artwork may be used only if it does not compete visually with the office. Preserve accessible names, pressed state, and visible keyboard focus. Do not introduce unapproved shortcut keys or a Show state labels preference. Hover may supplement selection, never provide essential information unavailable through keyboard interaction.

Normal desktop uses contextual side inspection. Minimum layout uses inline/full inspection below the office. The inspector belongs visually to Coffee Break's warm application language without pretending to be part of the Phaser world; exact decorative styling can be refined during implementation and Designer review.

The contextual inspector contains identity, trusted lifecycle, exact activity, optional reason, and freshness where applicable. Omit absent reasons rather than inventing one. Missing trusted state uses an explicit unavailable-state message. Keep Local simulation context truthful without making MVP/debugging labels the dominant hierarchy. Do not add operational controls, tabs, statistics, or activity history.

At the minimum window, selection must immediately expose a compact **name + trusted lifecycle** summary near the visible office/selection surface, even when full inspection is below the fold. Include last-known qualification when applicable. This is selected-agent feedback, not persistent lifecycle labels for every agent or activity paragraphs in the scene. Provide an equivalent polite textual announcement. Its placement must not obscure the selected character or require hover. Exact placement/style can be refined during implementation and Designer review while preserving this immediate feedback requirement.

Clear selection removes selected feedback and restores the unselected inspection state. Selecting or updating an agent does not unexpectedly move keyboard focus or pan the document. Focus remains visible while details update.

## Availability and retained state — AC-08

Place concise availability text near the office heading. Connected availability is quiet; unavailable/retained notices receive appropriate emphasis through text and shape. The existing truthful distinctions remain:

| Situation | Required meaning |
| --- | --- |
| Connecting without trusted state | Connecting to local simulation; do not invent lifecycle/activity. |
| Connected and synchronized | Connected; local simulation is live. |
| Synchronizing with retained data | Synchronizing; showing last-known state. |
| Disconnected with retained data | Disconnected; showing last-known state. |
| Disconnected without data | Local simulation unavailable. |

Retained characters and stable cues may remain visible, but operational character/workstation loops pause whenever presentation is not live. Inspection and immediate selected feedback qualify retained information as last known. Do not replace lifecycle with offline, waiting, idle, or error merely because availability changes. Resume live expression only when current-session synchronization is established; restoration does not invent a new completion/error event.

**Planner decision:** this product requirement is accepted. The Planner will determine the narrowest presentation-level mechanism during engineering planning. No architecture, IPC, transport, shared provider-contract, lifecycle, or security change is authorized here. No new ARCHITECTURAL INPUT REQUIRED item is raised by this draft; assess any later requirement for unavailable trusted information with the Planner.

## Responsive and accessible behavior — AC-09

| Window | Target behavior |
| --- | --- |
| Normal 1100 × 760 | Compact heading/availability, dominant office, contextual side inspector, and compact selector. Preserve room readability rather than surrounding it with dashboard cards. |
| Minimum 760 × 540 | Single column; readable fixed office, compact selector, immediate selected identity/state feedback, and full inspector reachable below through vertical document scrolling. No horizontal scrolling or independently scrollable/cropped room. |

The current 640 × 360 scene is the geometry baseline, not proof that the new surrounding composition fits. Do not miniaturize characters or essential text to force all details into one viewport. Long activity, reason, and availability text wrap; content may increase document height. Selection remains identified in the inspector while scrolling moves the office offscreen.

Native named buttons support keyboard selection and clearing. Preserve visible focus independently of selection. Important state/context requires textual equivalents; color, motion, hover, and comic effects cannot be the sole information channel. Reduced motion removes repeating movement and transient motion-dependent effects, while retaining meaningful static character/workstation treatment and precise text. Freshness remains explicit even in reduced motion: a static live presentation and a static retained presentation must not be confused.

Verify readable text, contrast, selection visibility, pixel rendering, focus reachability, long-content wrapping, no horizontal overflow, and all five states at both window sizes. Check real keyboard behavior and screen-reader announcements rather than inferring them from markup. Prior EP-03 user-assisted keyboard/focus observations are baseline evidence only. Generated studies do not verify dimensions, symbol comprehension, contrast, animation, or assistive technology.

## Scope, resolved direction, and implementation validation

Deferred: real provider integration and controls, token/model/cost/productivity/uptime statistics, GitHub/project boards, task assignment, chat/voice, personalities, multiple rooms/themes, expanded teams, autonomous navigation, and general pathfinding. Their appearance in original references does not authorize them in EP-04's living-office design.

### Design direction now resolved

The Product Owner + Planner decisions define the engineering design direction:

- Office-first hierarchy, one fixed room, and the current warm foundation.
- Treatment C: persistent compact identity associated with the character and visually integrated with the office.
- Character-led five-state expression, reinforced by abstract workstation behavior; comic accents and symbols are secondary. Study glyphs are not mandatory, and static expression cannot rely solely on color or glyph familiarity.
- Restrained in-world selection plus matching compact named accessible controls; selection, focus, and lifecycle remain distinct. Large portrait cards are not the default.
- Contextual side inspection at normal size; inline/full inspection below the office at minimum size with immediate selected name + trusted lifecycle feedback near the visible selection surface.
- Restrained live operational loops; visibly stopped work while waiting; one-time completion/error acknowledgements that settle and never replay for selection, rerendering, synchronization restoration, or retained display.
- Explicit Sol mug/environment/context presentation only for the approved fixture; onomatopoeia is optional polish and not necessary for comprehension.
- Meaningful static reduced-motion and retained-state equivalents, with availability/freshness separate from lifecycle.

No genuine Product Owner product/design decision remains unresolved in this specification. The Planner can define US-020–US-024 from these requirements once the final specification receives explicit approval. Exact pixel artwork, placement, decorative styling, and frame/cadence choices are implementation refinements within this direction, reviewed by the Designer; they do not require another product-design cycle unless a meaningful departure becomes necessary.

### Implementation / design-review validation still required

Validate exact geometry and minimum-window fit; contrast and readable text; static state/symbol comprehension; animation cadence; coherent pixel-art execution; keyboard behavior and focus visibility; long-content wrapping; reduced-motion behavior; retained-state truthfulness; and actual assistive-technology behavior. Validation of these execution details does not prevent this specification from becoming the approved engineering design source. It also does not establish that the later implementation already satisfies them.

## Acceptance traceability and approval gate — AC-10

| Criterion | Evidence / current status |
| --- | --- |
| AC-01 | Current-state inventory and source links above; discovery complete. |
| AC-02 | Original references and comparison/departure table above; North Star documentation prepared from existing Product Owner artifacts. |
| AC-03 | Five-state behavior-led direction resolved, including meaningful static equivalents; exact artwork/glyph execution is implementation/Designer-review refinement. |
| AC-04 | Broad world meaning and precise trusted inspection hierarchy documented. |
| AC-05 | Explicit Sol fixture and bounded contextual expression documented. |
| AC-06 | Agent/environment distinction and abstract workstation rules documented. |
| AC-07 | Treatment C, restrained selection, compact accessible controls, side/inline inspection, and immediate minimum-window feedback resolved; exact styling is implementation/Designer-review refinement. |
| AC-08 | Truthful availability and retained-state behavior documented; mechanism belongs to the Planner. |
| AC-09 | Design requirements for both sizes, scrolling, focus, textual equivalents, and reduced motion resolved; later geometry and accessibility verification remain required. |
| AC-10 | Final specification ready for explicit Product Owner approval; no blocking product/design decision remains. Approval, authorized artifact commit, and required review remain pending. US-019 is not complete. |

Do not begin subsequent design-dependent EP-04 implementation before explicit Product Owner approval of this final specification. The Planner then translates the approved direction into engineering scope. Independent technical review remains separate from design approval.
