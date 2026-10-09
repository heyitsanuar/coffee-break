# EP-06 — North Star Homepage Experience

**Status: PRODUCT OWNER-APPROVED DESIGN REFERENCES — preservation package prepared for Designer review.** This package preserves the final revised homepage and environment direction. It does not authorize production implementation or certify a completed story.

Objective: implement the approved North Star-inspired homepage skeleton around the dominant Living Office, with truthful trusted information, explicitly fictional Sample context, and informational future-world previews.

## Approval and provenance

The Product Owner-approved revised direction is recorded in the **EP-06 Engineering Backlog Discovery** brief supplied to the Developer (`1ce8678f-463f-4ad8-a26e-355229b29966/Texto pegado.txt`). That brief explicitly accepts the minimum-window trade-off of the richer selector below the initial viewport. The subsequent **EP-06 Design Reference Preservation** authorization (`556eee53-618e-4ca4-98d0-265bd682718a/Texto pegado.txt`) requests preservation of the approved final homepage, updated environment, and final Designer report. These user instructions establish current approval; approval is not inferred from filenames or prototype output.

The original fidelity revision predates that approval. Its “NOT APPROVED” image banners and pending-decision language are preserved as historical provenance, not current status. No image was regenerated, cropped, resized, color-corrected, or re-encoded during preservation.

Source baseline: `main`, `2edcc10fd45e2153f44d8ce8752879907b6a14cd`, merged US-030 PR #71. Preservation branch: `planning/ep-06-design-references`.

### Image sources

The six `ep06-fidelity-*.png` files were copied byte-for-byte from the final fidelity revision produced in **Agent | Designer**:
`ep06-fidelity-*.png` source artifacts from Designer conversation `01a0ee18-a070-7e11-8253-6f27ff9a134e` (final revision identified below).
Each retains its original filename. These are captured design-prototype compositions, not production Electron captures. Older `homepage-final-*.png` refinements were not substituted.

`ep06-environment-study.png` is a byte-for-byte copy of:
`exec-7e28975b-458e-4f01-9e9e-eb11b65d884f.png`, the generated environment source artifact from the same Designer conversation.
The Designer generated this preview-only environment study using the existing clean office and original North Star references as composition/style inputs. It introduces empty Meeting/Focus visual zones in one fixed office. The source basename is changed only for durable reference naming.

### Designer specification/report

[Final Designer fidelity specification/report](designer-fidelity-report.md) preserves the original Spanish report from Codex thread `01a0ee18-a070-7e11-8253-6f27ff9a134e`, turn `01a11887-ee93-7d63-a082-f78e465f4683`, final message `msg_022d86c7bdb2e1ae016ac6d26335fc87d199aa200c8148f84f`.

This is an export of the accessible final message, not a pre-existing Markdown file. An archival provenance preface was added, its six study-image links were localized, and one two-space Markdown hard break was represented by a backslash to pass whitespace checks. No substantive report text, historical decision status, or validation conclusion was rewritten.

Preserved report-file SHA-256: `a42c489aec985bc836ab4ace1a8b8d7d20a737fb2f2aa8d9214fd7c146af470b`.

## Reference manifest

Hashes cover complete preserved PNG file bytes, not decoded RGB buffers. All seven files decode as RGB PNGs.

| File | Reference purpose | Native image dimensions | File SHA-256 |
| --- | --- | --- | --- |
| [ep06-fidelity-desktop.png](ep06-fidelity-desktop.png) | Final homepage composition, desktop | 1100 × 760 | `67ae9e10c8ad11cb82b3756e37b93055e369ab886e9cc60517f781f395498ae3` |
| [ep06-fidelity-compact.png](ep06-fidelity-compact.png) | Final homepage composition, compact | 760 × 540 | `fced448c96c33b4c26c6eaa27550808fe1039a2590e078b7d92d3c8662603770` |
| [ep06-fidelity-compact-flow.png](ep06-fidelity-compact-flow.png) | Complete compact document flow | 760 × 1633 | `bcf64de9e2ffbb220d02ed2e42edcf6475483d87db648d1259bdf18a04b37ee2` |
| [ep06-fidelity-expanded.png](ep06-fidelity-expanded.png) | Expanded office composition | 1100 × 760 | `eaad8a766bf47f07ac66b3394e3634b5df0752538454489a5d9710e87b102d31` |
| [ep06-fidelity-retained.png](ep06-fidelity-retained.png) | Retained / Last known presentation | 1100 × 760 | `67ed0a4073162b839df759afaf7361cc0b8dee56ed7f820219ceace05587ca2e` |
| [ep06-fidelity-keyboard.png](ep06-fidelity-keyboard.png) | Keyboard-focus treatment | 1100 × 760 | `358ec4d0e3d2c15a9bec91fc4d32c10105460d145a9a36a032f65eaf763e5a9b` |
| [ep06-environment-study.png](ep06-environment-study.png) | Approved updated Living Office environment study | 1672 × 941 | `646bebe2fdb999746d11f05bc2be2c43e8514e5073002a2ca9bf9b18343b0f03` |

Reproduce file hashes from the repository root:

```sh
shasum -a 256 docs/design/references/ep-06/*.png docs/design/references/ep-06/designer-fidelity-report.md
```

## Approved homepage direction

- Deep navy application chrome and lightweight Office / Agents / Projects top navigation; no permanent sidebar. These are homepage-region destinations, not authorization for separate product pages.
- Dominant complete 640×360 Living Office, framed by a toolbar with Studio identity and Expand.
- Richer fixed authored environment, with empty decorative Meeting Room and Focus Room zones.
- Existing canonical Ari/Mina/Sol identities and lifecycle behavior, with compact dark in-world plaques.
- Portrait-first selection: portrait → freshness dot → name → lifecycle. Green means **Current**, never Online; Last known and No state remain distinct.
- Compact exact contextual inspector; right-side Recent Activity beneath it, growing naturally for long activity/reason text.
- Harbor context within **Sample** Activity and three deterministic example rows, with fixed sample times and explicit “Not runtime history” provenance.
- **Studio — Current**, **Retro 70s — Preview**, **Arcade 80s — Preview**, **Cyber 2000 — Preview**. Preview interactions are informational and do not switch the office.
- Expanded application composition retains the 640×360 office, selection and precise information, with Exit/Escape, focus return and scroll restoration.
- Responsive targets: 1100×760 desktop and 760×540 compact, full room, normal vertical document scrolling and no horizontal page overflow. The richer selector below the initial compact viewport is an explicitly approved trade-off.

## Runtime / Sample / Preview

| Category | Meaning and boundary |
| --- | --- |
| **Runtime** | Existing authenticated local agent lifecycle/activity/reason and availability, consumed from trusted renderer state. This remains local simulation; it does not imply real provider integration. |
| **Sample** | Deterministic fictional Harbor/project/activity context, independently labeled and kept out of trusted state. Fixed example hours are not live recent history. |
| **Preview** | Future-world concepts with no functional switching. The environment study itself is also preview/design material, including when it depicts the intended Studio appearance. |

Illustrated lifecycle and availability values in the study are not production runtime evidence.

## Reference authority

1. [Original North Star](../north-star/) — permanent product visual foundation.
2. Approved final EP-06 homepage study — desktop/compact and supporting compositions in this package.
3. Approved EP-06 environment study — `ep06-environment-study.png`.
4. Accepted EP-05 implementation and [US-026](../us-026/README.md), [US-027](../us-027/README.md), [US-028](../us-028/README.md), and [US-029](../us-029/README.md) references.

The Designer report explains fidelity, visual intent and remaining implementation gaps; this manifest records superseding approval. EP-06 supersedes EP-05 only for the specifically approved visual/composition changes. Existing trusted behavior, architecture/security, accessibility, and reduced-motion requirements remain authoritative. See [design authority](../../README.md) and [architecture](../../../architecture/README.md).

## Implementation boundaries and known gaps

React owns application chrome, navigation, controls, accessibility, inspection, Sample/Preview surfaces and expanded composition. Phaser owns authored environment, inhabitants, workstations, coffee presentation and world selection.

No contract, Connector, transport, IPC/preload, trusted-state or provider integration change is authorized by this package. Preserve lifecycle semantics, canonical identities, retained/no-state truthfulness, exact Sol coffee behavior, selection, keyboard access, and reduced motion. Implementation requires a separately authorized engineering story and the normal design/implementation/review/acceptance workflow.

The environment source is **1672×941**, not a production 320×180 pixel-grid texture or an exact 16:9 logical asset. Its display in the prototype illustrates composition; resampling it into Phaser would not establish coherent production pixel art. Future authored 320×180 background/foreground assets must reconcile agent anchors, monitor state fields, mug/steam placement, hit targets and occlusion explicitly.

The prototype does not integrate the production monitor overlays, prove scene layering, or demonstrate operational animation. Future-world thumbnails use presented regions of original references; that does not make them production theme assets or authorize editing the originals. Study geometry and its 28px annotation/frame allowance are not measurements of future native Electron content bounds.

The archived Designer checks apply to the prototype only. Electron execution, production tests/build, VoiceOver and native accessibility were not verified by those studies. This preservation task validates files and documentation, not application behavior.

## Superseding epic planning decision

The current Product Owner direction is:

- **EP-06 — North Star Homepage Experience.**
- **EP-07 — Real Provider Integration**, reserved for separately approved planning and implementation.

[Historical EP-05 planning](../../../../planning/ep-05-issues.json) and the [repository README](../../../../README.md) still identify EP-06 as provider integration. Those accepted records are left unchanged to preserve their original meaning. This section records the superseding numbering/direction instead. It does not create EP-07 scope, acceptance criteria, issues or implementation authorization, and does not rewrite old acceptance evidence.
