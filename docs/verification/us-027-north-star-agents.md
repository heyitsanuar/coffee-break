# US-027 — North Star agents implementation evidence

Status: **ACCEPTED — READY FOR FINALIZATION / PR**. Designer final: **PASS**; AC11: **PASS**; **AC16: PASS — DESIGNER IMPLEMENTATION REVIEW COMPLETE**. Independent Reviewer final: **PASS**, with **0 HIGH / 0 MEDIUM / 0 LOW** and **AC01–AC17 PASS**. Product Owner: **ACCEPTED**, explicitly **“I approve”**. Finalization is authorized; this report does not claim a PR, successful CI or merge before those actions actually occur.

## Baseline and authority

- Story: [US-027 #61 — Redesign Ari, Mina, and Sol as North Star Agents](https://github.com/heyitsanuar/coffee-break/issues/61).
- Branch: `feature/us-027-north-star-agents`.
- Committed baseline: `d155d4099a4efa45e24564d4f74a8cc389de7d75`, merged US-026. Evidence covers the uncommitted implementation on that baseline, not an exact future commit or CI run.
- Approved references: [original North Star](../design/references/north-star/), [US-027 character package and approval provenance](../design/references/us-027/README.md), and [US-026 environment package](../design/references/us-026/README.md). Story acceptance criteria and established trusted runtime behavior constrain implementation.
- The pre-existing promotion consists of `docs/design/README.md`, the US-027 reference README and its eleven PNGs. All thirteen files were preserved byte-for-byte against the pre-implementation SHA-256 inventory. Historical proposal captions remain unchanged; the reference README records subsequent approval.

## Initial Designer finding and focused AC11 correction

The initial Designer implementation verdict was **CHANGES REQUIRED: 0 HIGH / 1 MEDIUM / 0 LOW**. The MEDIUM AC11 finding: Ari and Mina's upright, separated-leg silhouettes read as standing in front of the desks instead of sitting in / occupying the authored chairs. The Designer passed the other reviewed visual areas, including identities, upper-body lifecycle vocabulary, static forms, Sol/coffee, selection, compositions and asset quality. This was not a Designer PASS verdict for the story.

The correction changes only Ari/Mina lower-body logical rows **20–23**, consistently across all eight lifecycle forms. Their two separated legs/feet are replaced with a connected **10×2 lap at `(5,20)`**, with an **8×1 clothing-color inset at `(6,20)`**. Logical rows **22/23 are now transparent**, so separate legs no longer project beneath the chair. The existing foreground strips cover rows 20/21 and wrap the compact lower body; the chair pedestal/casters remain visible. No upper-body gesture was redrawn. The focused Designer re-review subsequently confirmed the corrected seated readability and passed both workstations.

Decoded comparison against the pre-correction implementation found **205 changed pixels per identity / 410 total**. Ari/Mina rows 0–19 are identical across all eight forms. Sol's complete lifecycle row is pixel-identical; the complete `mock-agents.png` is byte-identical. Room layers, anchors, display scale, runtime TypeScript, lifecycle mapping/timing, selection and labels are unchanged.

Reproducible freeze metadata: SHA-256 over row-major RGBA bytes of lifecycle rows 48–71 (Sol) remains `333bda4cf39fa26a98d228d0a989a9720cbdf1bef7a5735ab0b4a2230e45e342`. The complete coffee PNG hash remains `b5b4f27771fbd70c1c0df691435821a6c1ed43a0d37a91d47cfa3c1d3f82a876`. Both match the saved pre-correction implementation, not the older committed pre-US-027 artwork.

Correction files: the lifecycle PNG, its authoring script, one additional asset test, focused comparison additions in the capture script, refreshed evidence and this report. The fixture files and approved reference package are unchanged. The 27 previous evidence PNGs containing Ari/Mina or the lifecycle sheet were refreshed. `compact-inspector-scroll.png`, whose view does not expose the corrected pixels, remains byte-identical. One original unedited Working capture is retained **only as explicitly labeled historical BEFORE evidence**, never as current implementation. Fresh Ari/Mina comparison boards show that historical capture beside corrected runtime at intended 2×, with an additional nearest-neighbor 6× inspection.

## Completed Designer re-review and independent review history

After the AC11 correction, the focused Designer re-review reported **ARI WORKSTATION: PASS; MINA WORKSTATION: PASS; AC11: PASS; AC16: PASS — DESIGNER IMPLEMENTATION REVIEW COMPLETE**. It passed the seat-strip relationship, all-eight-form consistency, upper-body/identity regression, Working/Waiting/Completed/Error workstation treatment, desktop/compact context, approved-versus-runtime fidelity, Sol/coffee regression and selection/labels. All identities, lifecycle forms, acknowledgements/settled states, coffee, actual intended 2× scale and workstation context were reviewed. Findings: **0 HIGH / 0 MEDIUM / 0 LOW**. Final Designer verdict: **US-027 DESIGNER REVIEW PASS — READY FOR INDEPENDENT REVIEW**. This completed review does not erase the initial one-MEDIUM CHANGES REQUIRED verdict above.

The independent Reviewer then substantively passed all implementation/runtime acceptance criteria and independently obtained **292/292 tests PASS**, typecheck PASS, lint PASS with two known generated-bundle warnings, build PASS, authoring reproducibility PASS, PNG validation PASS and diff-check PASS. Its sole finding was **LOW — stale Designer-review status in durable documentation/evidence**; findings were **0 HIGH / 0 MEDIUM / 1 LOW**. Its formal verdict before this correction remains **US-027 REVIEW CHANGES REQUIRED**, not PASS.

The documentation/evidence correction recorded the completed Designer result, replaced only the stale status caption in the Ari/Mina comparison boards and their generator literal, and updated only those two PNG SHA-256 fields in the capture record. Underlying before/after runtime screenshots and all production, test and design-reference files remained byte-identical to the independently reviewed tree. At that point the next gate was the focused independent Reviewer recheck; acceptance was not yet claimed.

That focused independent Reviewer recheck subsequently completed with **0 HIGH / 0 MEDIUM / 0 LOW**, confirmed the LOW finding resolved and **AC01–AC17 remain PASS**, and returned **US-027 REVIEW PASS — READY FOR PRODUCT OWNER ACCEPTANCE**. It recorded the stable fingerprint `d0d44d8577e5c6fd2efa8fc72d3902cae75c4e211567afdd302b3422bb6c630a` over 396 tracked/untracked files. Finalization independently reproduced that fingerprint before this authorized report-only status update. The Reviewer disclosed that it could not independently reproduce the earlier uncommitted before/after snapshots; it verified the current evidence/hash record and preserved prior full-suite conclusions. The initial Designer and independent Reviewer CHANGES REQUIRED verdicts remain historical facts.

The Product Owner then explicitly stated **“I approve”**, accepting US-027 and authorizing finalization. Designer PASS, independent Reviewer PASS and Product Owner ACCEPTED are now complete. Production, tests, design references and runtime evidence remain frozen; only this report's final status/history changed after Reviewer PASS. Detailed native keyboard traversal, screen-reader behavior and native OS reduced-motion preference behavior remain unverified.

Status-correction validation: both boards decode at the unchanged **1600×1640** size. The original board HTML first reproduced the pre-correction decoded bitmap exactly; changing the caption to **“Designer re-review: PASS”** changed exactly **1,658 decoded pixels per board**, all inside the status paragraph, with no change elsewhere. Only the two corresponding PNG hash fields changed in `capture-record.json`; original runtime captures, sample timestamps and other records are unchanged. Scope/freeze checks, stale-current-status search, caption-generator syntax and `git diff --check` passed. The full application suite/typecheck/lint/build were **not rerun** for this status-only correction; the Developer and independent Reviewer validation records below remain intact.

## Production change and authoring

Only two production files changed:

| Asset | Dimensions / contract | Change |
| --- | --- | --- |
| [agent-lifecycle.png](../../apps/desktop/src/office/assets/agent-lifecycle.png) | 160×72; eight columns × three rows; 20×24 RGBA cells | Independently authored Ari/Mina/Sol lifecycle poses |
| [mock-agents.png](../../apps/desktop/src/office/assets/mock-agents.png) | 120×24; six 20×24 cells | Independently authored Sol coffee cells 4/5; legacy cells 0–3 retain exactly their baseline decoded pixels |

[author-us-027-agents.py](../../apps/desktop/verification/author-us-027-agents.py) uses only Python's standard library, explicit integer rectangles, a limited palette and a deterministic PNG encoder. It reads no reference raster, external artwork or temporary Designer workspace. It reads the existing mock sheet solely to retain its four legacy cells. The hash non-equality test guards against installing a composite as a texture; it does not by itself prove independent authorship or visual fidelity.

From the repository root:

```sh
python3 apps/desktop/verification/author-us-027-agents.py --check
```

`--check` regenerates in memory and compares both outputs byte-for-byte without writing. Running without `--check` intentionally writes the two production sheets. No dependency was added.

| Identity | Authored visual language |
| --- | --- |
| Ari | Short dark crop, broad sage clothing block, compact seated lower body |
| Mina | Asymmetric brown bob, terracotta clothing block, compact seated lower body |
| Sol | Short blond tuft/crop, navy clothing block, short legs; consistent head/body across lifecycle and coffee |

Shared proportions use broad heads, compact torsos, short limbs, simple faces and strong ink edges. No decorative lifecycle icon or identity/role prop was added. Subjective visual/readability and fidelity judgment was completed by the Designer and passed; automated pixel checks establish structural/runtime confidence, not that subjective judgment.

## Geometry and preserved behavior

The existing [layout](../../apps/desktop/src/office/officeLayout.ts), [frame mapping](../../apps/desktop/src/office/agentLifecycleFrames.ts), [motion controller](../../apps/desktop/src/office/applyOfficeVisual.ts), [presentation adapter](../../apps/desktop/src/office/officePresentation.ts), [eligibility runtime](../../apps/desktop/src/office/officePresentationRuntime.ts) and [scene](../../apps/desktop/src/office/OfficeScene.ts) are unchanged.

- Logical frame: **20×24**, integer **2× → 40×48** scene/display pixels; bottom-center origin `(0.5, 1)`.
- Anchors: Ari `(292,174)`, Mina `(480,174)`, Sol `(220,282)`; existing 48×64 clearance remains.
- Ari/Mina sit within the existing desk/chair relationship. Foreground seat strips intentionally overlap lower-body pixels. Actual foreground-mask tests confirm heads remain unobscured and Idle/Working, Working/Waiting, Working A/B and acknowledgement/settled differences remain visible. No environment adjustment was needed. Sol remains at the coffee/break zone without a third workstation.

Rows remain Ari, Mina, Sol; absolute frame index is `row × 8 + column`:

| Column | Presentation | Existing motion behavior |
| --- | --- | --- |
| 0 | Idle: arms relaxed/down | Static; no revived breathing loop |
| 1 | Working A: forearms engaged | Static retained/reduced equivalent |
| 2 | Waiting: hands inward, attentive | Static; no coffee implication |
| 3 | Completed settled: low open hand, restrained positive expression | Static |
| 4 | Error settled: stopped/attentive, hand near chin | Static |
| 5 | Working B: subtle hand change, stable head/body | Live A/B loop, 600ms per frame / 1200ms cycle |
| 6 | Completed acknowledgement: brief raised hand | Eligible live transition only; 500ms then settled |
| 7 | Error acknowledgement: brief palms-up attention | Eligible live transition only; 400ms then settled |

The existing eligibility rules and generation/timer cancellation remain authoritative. Existing tests cover initial/current state, snapshots/repair gaps, stale sessions, rejected input, same-state and activity/reason-only updates, retained/restored state, reduced motion, selection/remount and stale callbacks. No acknowledgement eligibility or event semantics changed.

Retained/reduced presentation uses Working A, Completed settled, Error settled and Coffee A. Live restoration or disabling reduced motion does not replay an old acknowledgement. Captured retained and reduced-motion room pairs stayed decoded-pixel identical over samples separated by more than 1700ms. Reduced Error and motion-restored Error also stayed identical. These still-frame comparisons support the sampled behavior; prior runtime tests cover eligibility, cancellation and looping contracts.

### Coffee, selection and text

The unchanged exact predicate is `mock-agent-sol` + lifecycle `waiting` + activity **exactly** `Taking a coffee break in the simulated office`. Generic Sol Waiting uses column 2 of his lifecycle row, without a character cup/drinking gesture. Permanent environment mugs remain decoration. Existing negative-case tests reject noncanonical text, other agents and other lifecycle states.

Strategy A remains: mock-sheet columns 4/5, **500ms per frame**, subtle inward cup/hand shift with stable head/body. Coffee A is meaningful without motion. Steam retains its separate existing cadence and eligibility. Inspector state stays **Waiting** with the exact activity, while the quiet world label stays **Coffee break**.

Selection remains an external outline with unchanged bounds/hit behavior. Names and quiet lifecycle text remain available. React selectors, pressed state, focus style, summary and inspector are unchanged. Direct renderer pointer events selected all three sprites and agreed with the roster/inspector. Chromium Tab/Space emulation demonstrated focus on unselected Mina while Ari stayed selected, then activation of Mina and focus preservation during a state update. Clear selection used a DOM click; this is not a native keyboard test.

## Actual renderer evidence and reproducibility

[us-027.tsx](../../apps/desktop/verification/us-027.tsx) and [us-027.html](../../apps/desktop/verification/us-027.html) are development-only fixtures using the production Application, store, presentation runtime, React host and Phaser scene. Synthetic accepted inputs exercise presentation; they do not claim Connector/provider/transport verification.

[capture-us-027.cjs](../../apps/desktop/verification/capture-us-027.cjs) opens an offscreen Electron renderer with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; captures use `capturePage`. No runtime frame is forced or reconstructed. Timing uses waits after accepted fixture updates; capture timestamps are recorded rather than claimed as exact scheduling guarantees. Start the existing development server, then run:

```sh
npm run dev:simulated
# In another terminal, using the installed Electron binary:
./node_modules/.bin/electron apps/desktop/verification/capture-us-027.cjs http://localhost:5173
```

The command writes this story's evidence directory. Normal regenerated live samples may differ in timestamps, workstation/steam phase and PNG hashes; the asset authoring check is byte-reproducible, while the runtime capture sequence and assertions are repeatable behavior checks.

[capture-record.json](assets/us-027/capture-record.json) records Electron 37.10.3 on macOS, DPR 2, viewport sizes, PNG dimensions, full PNG SHA-256 values, sample timestamps, asset hashes and observations. The 40×48 CSS sprite rectangle is therefore 80×96 decoded screenshot pixels. Direct office crops are 1280×720 PNGs representing a 640×360 CSS room. Full desktop/compact images represent 1100×760 / 760×540 CSS viewports. View at the corresponding CSS size for intended scale; do not interpret Retina pixel dimensions as a character-scale increase.

### Evidence inventory

All files below are under `docs/verification/assets/us-027/`. There are **25 current direct captures, five explicitly labeled derivative boards, one historical BEFORE direct capture and one JSON record**. Runtime evidence was recaptured after the AC11 art correction. This later status-only correction regenerated only the Ari/Mina board captions; their current PNG hashes are updated in the record. Runtime sample timestamps and all other evidence hashes remain unchanged.

| Purpose | Evidence |
| --- | --- |
| All identities in office / calm lineup | [idle.png](assets/us-027/idle.png) |
| All identities and eight lifecycle forms at intended scale | [lifecycle-matrix.png](assets/us-027/lifecycle-matrix.png): labeled crops from preserved direct runtime captures |
| Actual source grid at 1× / 2× / nearest-neighbor 6× | [source-grid-inspection.png](assets/us-027/source-grid-inspection.png): labeled asset inspection, not a runtime screenshot |
| Focused Ari chair-fit comparison | [ari-workstation-comparison.png](assets/us-027/ari-workstation-comparison.png): historical BEFORE / corrected AFTER at 2×; corrected 6× inspection |
| Focused Mina chair-fit comparison | [mina-workstation-comparison.png](assets/us-027/mina-workstation-comparison.png): historical BEFORE / corrected AFTER at 2×; corrected 6× inspection |
| Historical pre-correction source, not current implementation | [historical-before-ac11-working.png](assets/us-027/historical-before-ac11-working.png): preserved unedited initial Working capture used only in labeled comparisons |
| Working A/B and desk occupancy | [working-a.png](assets/us-027/working-a.png), [working-b.png](assets/us-027/working-b.png) |
| Waiting and desk occupancy | [waiting.png](assets/us-027/waiting.png) |
| Completed acknowledgement → settled | [completed-acknowledgement.png](assets/us-027/completed-acknowledgement.png), [completed-settled.png](assets/us-027/completed-settled.png) |
| Error acknowledgement → settled | [error-acknowledgement.png](assets/us-027/error-acknowledgement.png), [error-settled.png](assets/us-027/error-settled.png) |
| Generic Sol Waiting | [sol-generic-waiting.png](assets/us-027/sol-generic-waiting.png) |
| Canonical Sol coffee A/B | [coffee-a.png](assets/us-027/coffee-a.png), [coffee-b.png](assets/us-027/coffee-b.png) |
| Retained static Working / coffee | [retained-a.png](assets/us-027/retained-a.png), [retained-b.png](assets/us-027/retained-b.png) |
| Emulated reduced-motion static Working / coffee | [reduced-working-coffee-a.png](assets/us-027/reduced-working-coffee-a.png), [reduced-working-coffee-b.png](assets/us-027/reduced-working-coffee-b.png) |
| Reduced settled Completed / Error; preference restoration without replay | [reduced-completed.png](assets/us-027/reduced-completed.png), [reduced-error.png](assets/us-027/reduced-error.png), [motion-restored-error.png](assets/us-027/motion-restored-error.png) |
| Selected identities with matching inspection | [selected-ari.png](assets/us-027/selected-ari.png), [selected-mina.png](assets/us-027/selected-mina.png), [selected-sol.png](assets/us-027/selected-sol.png) |
| Supported sizes and compact vertical inspector access | [desktop-1100x760.png](assets/us-027/desktop-1100x760.png), [compact-760x540.png](assets/us-027/compact-760x540.png), [compact-inspector-scroll.png](assets/us-027/compact-inspector-scroll.png) |
| Focus distinct from selection | [focus-mina-selected-ari.png](assets/us-027/focus-mina-selected-ari.png) |
| Approved reference versus implementation | [approved-vs-runtime.png](assets/us-027/approved-vs-runtime.png): labeled derivative, reference on left / direct runtime on right |

Working A was sampled after a 70ms wait; B after an additional 620ms. Completed/Error reactions were sampled after 70ms, then after an additional 650ms/600ms respectively. Coffee A was sampled after 70ms, B after an additional 520ms. Compare corresponding unselected 80×96 sprite crops decoded from the direct images, not PNG compressed bytes:

| Identity | Working A/B changed pixels | Completed acknowledgement/settled | Error acknowledgement/settled |
| --- | --- | --- | --- |
| Ari | 160 | 672 | 832 |
| Mina | 160 | 528 | 656 |
| Sol | 160 | 736 | 864 |

Coffee A/B have **208 changed decoded pixels**, confined to the character hand/cup region. An independent RGB PNG decoding comparison confirmed the count and region; selection, labels, background and steam do not explain the difference. Asset tests separately confirm only the hand/cup region changes in the underlying coffee pair. Two stills alone do not establish continuous looping; the actual capture sequence and preserved animation/runtime tests supply the additional behavior evidence.

Desktop and compact captures each had one canvas and no document horizontal overflow. The compact inspector was reachable by vertical scrolling. Reload restored one canvas. The capture run reported no renderer console errors. These are offscreen renderer observations, not native-window accessibility verification.

## Tests and validation

[agentAssets.test.ts](../../apps/desktop/src/office/agentAssets.test.ts) contains six checks against decoded production pixels: exact dimensions/nonempty cells/binary alpha/safe horizontal bounds; distinct identities/poses/stable head; coffee distinction and localized A/B change; actual foreground-mask visibility; connected lap at the seat-strip rows with no legs below; and production/composite non-equality. The correction adds only the lap/bounds check; all prior assertions remain intact. That new check failed against the initial reviewed artwork and passed after correction. Automated geometry tests do not prove subjective seated readability. During initial implementation, two earlier new asset checks also failed against the baseline artwork before authoring.

| Check | Result |
| --- | --- |
| Focused assets/frames/mock/layout/motion/adapter/runtime/steam/workstations/scene/host/selector/integrated tests | **151/151 PASS**, 13 files |
| `npm test` | **292/292 PASS**: 37 importer + 254 desktop + 1 contracts |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; zero errors; two pre-existing unused eslint-disable warnings in ignored generated Phaser output |
| `npm run build` | PASS |
| `node --check apps/desktop/verification/capture-us-027.cjs` | PASS |
| Python authoring-script AST syntax and `--check` | PASS; both generated sheets byte-reproducible |
| PNG integrity | 31 evidence PNGs + two production PNGs decode into complete Electron `nativeImage.toBitmap()` buffers; CRCs/dimensions/decompressed scanlines valid; macOS `sips` reads all 33; all 31 evidence SHA-256 values match the record |
| Legacy mock compatibility | Cells 0–3 decoded-pixel identical to baseline |
| Reference/environment integrity | Thirteen pre-existing promoted files and both room sheets unchanged |
| Correction freeze | All sixteen Ari/Mina upper bodies, Sol lifecycle row, entire coffee PNG, fixture and production runtime TypeScript unchanged from pre-correction implementation |
| `git diff --check` | PASS |

The asset decoder initially assumed RGBA for screenshot integrity checking; Electron's opaque screenshots are RGB. The corrected integrity check accepts decoded RGB screenshots and RGBA assets. This was a validation-script assumption, not an image or application defect.

## Acceptance criteria and review gates

“Developer evidence PASS” below means the applicable engineering checks passed; it does not approve the story or substitute for subjective visual review.

| AC | Requirement | Status / evidence |
| --- | --- | --- |
| AC01 | Compact North-Star proportions | **Initial Designer review PASS**; frame/scale and upper-body proportions preserved |
| AC02 | Small-inhabitant world scale | **Initial Designer review PASS**; unchanged 20×24 / 2× / anchors |
| AC03 | Distinct identities without labels alone | **Initial Designer review PASS**; identity pixels preserved |
| AC04 | Calm readable Idle | **Initial Designer review PASS**; upper-body pose preserved |
| AC05 | Working workstation engagement | **Initial Designer review PASS** for Working gesture; upper body preserved, chair-fit correction tracked separately under AC11 |
| AC06 | Stopped attentive Waiting | **Initial Designer review PASS**; upper-body pose preserved |
| AC07 | Bounded Completed acknowledgement + stable settled form | **Initial Designer review PASS** for pose meaning; unchanged 500ms runtime, distinct captures/tests PASS |
| AC08 | Bounded Error acknowledgement + stable settled form | **Initial Designer review PASS** for pose meaning; unchanged 400ms runtime, distinct captures/tests PASS |
| AC09 | No replay on snapshot/repair/remount/selection | **Developer evidence PASS**; unchanged eligibility and regression coverage |
| AC10 | Reduced motion preserves meaning | **Initial Designer review PASS** for static meaning; renderer-emulated suppression/tests PASS; native OS unverified |
| AC11 | Ari/Mina inhabit authored workstations | **PASS — focused Designer re-review**; initial finding corrected; Ari and Mina workstations, seat-strip relationship and all-eight-form consistency passed |
| AC12 | Generic Sol Waiting is non-coffee | **Developer evidence and initial Designer review PASS**; Sol pixels / negative predicate tests unchanged |
| AC13 | Exact canonical coffee presentation | **Developer evidence and initial Designer review PASS**; predicate and complete coffee PNG unchanged |
| AC14 | Names + quiet lifecycle text available | **Developer evidence PASS**; unchanged source, captures / scene tests |
| AC15 | Selection distinct from lifecycle/focus | **Developer evidence PASS**; unchanged external outline, selector tests, separate focus capture; detailed native traversal unverified |
| AC16 | Designer reviews all identities/states at actual scale | **PASS — DESIGNER IMPLEMENTATION REVIEW COMPLETE**; all identities/forms, acknowledgements/settled states, coffee, intended 2×, workstations, selection, desktop/compact and focused AC11 correction reviewed |
| AC17 | Regression suite passes | **Developer evidence PASS**; 292/292 |

## Native limitations, scope audit and handoff

During initial implementation, the existing `npm run dev:simulated` native Electron app was launched for user-assisted checks. The user replied **“Looks good”** to the requested checklist. Record this as general positive native-window feedback for that initial implementation only: it does not establish which individual mouse/keyboard/resize/reload checks were performed and is not a new observation of the AC11 correction. The application was relaunched to recapture corrected offscreen evidence; no new user-assisted native result is claimed. Detailed native keyboard traversal, native OS reduced-motion behavior and screen-reader behavior remain **UNVERIFIED**. Chromium media emulation and keyboard-event emulation above are explicitly separate.

No production TypeScript/CSS, scene configuration, timing, eligibility, anchors, room art, selection/labels, contracts, IPC, preload, main mirror, transport, simulator, package manifest or lockfile changed. No US-028 functionality was introduced. Original North Star references remain unchanged. During the earlier AC11 art correction, 33 existing paths changed (five art/tool/test/report files, 27 evidence PNGs and the JSON record) and three evidence PNGs were added. The later stale-status correction changed only five existing paths: this report, the generator's caption literal, both workstation comparison boards and the two affected hash fields in the capture record. The accepted pre-finalization US-027 tree contained 53 authorized paths, including the thirteen preserved promotion files, with nothing staged, committed or pushed at review time. Build output remains ignored; no generated output belongs to the story commit.

Historical Designer handoff: the workstation comparison boards, lifecycle matrix, direct captures, source-grid inspection and approved-versus-runtime comparison supplied intended-scale and enlarged evidence for the focused AC11 re-review. That review is now complete with PASS; AC11/AC16 status comes from the Designer's result, not Developer self-approval.

Historical independent Reviewer recheck handoff: the Reviewer checked the report's chronology/current AC11/AC16 status, both corrected comparison captions and their capture-record hashes, then returned PASS. The earlier CHANGES REQUIRED verdict is preserved above. Current handoff is repository finalization/PR after Product Owner acceptance; any PR/CI/merge result must be established separately from the completed design/engineering acceptance gates.
