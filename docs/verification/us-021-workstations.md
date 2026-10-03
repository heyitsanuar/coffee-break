# US-021 — Reactive workstation implementation evidence

Prepared for Designer implementation review. No Designer PASS, independent review, or Product Owner final acceptance is claimed.

## Baseline and implementation

Branch: `feature/us-021-reactive-workstations`. Baseline/unchanged HEAD: `010122d23fde7a3a991c7a623a1e56c102a8d85f`, synchronized from `origin/main` after merged US-020 PR #53. The branch began clean. This record describes uncommitted work on 2026-10-03, not an exact committed-head approval.

Only Ari's left and Mina's right monitor interiors react. Each has one Phaser Graphics object, created once per scene, positioned using existing identity/anchor meaning and reused on updates. Sol has no monitor/controller. Scene depth is background 0, monitor 1, characters 10, foreground 20. Draw commands use integer source geometry at the existing ×2 artwork scale.

Artwork insets in scene coordinates: Ari `(88,80,40,16)`, Mina `(272,80,40,16)`. Each contains a 20 × 8 source-pixel blue-gray field with small dark marks. Fallback geometry uses `(88,100,40,16)` and `(272,100,40,16)`, inside the existing fallback monitor rectangles; the room is not redesigned. Source art, bezel/stand, furniture and foreground are unchanged.

| State | Stable form | Cosmetic motion |
| --- | --- | --- |
| Idle / no trusted lifecycle yet | Quiet existing blue-gray field, no marks | None |
| Working | Two unequal filled forms arranged diagonally | Live, motion-permitted: alternate widths every 1200 ms, 2400 ms full cycle; start on the intentional stable frame |
| Waiting | Two equal separated level squares | None; cancel Working immediately |
| Completed | Open-top outline | Existing eligible Completed token widens each side one source pixel for 500 ms, then settles |
| Error | Intact closed stepped-diamond outline | None; existing character Error acknowledgement is unchanged |

Both character and monitor receive the same `OfficeAgentPresentation` and eligible `OfficeAcknowledgement`. The existing renderer store/runtime remains the only lifecycle, freshness, reduced-motion and eligibility authority. The monitor checks current cosmetic policy and consumes a sequence once; it does not infer eligibility from state changes. Activity/reason-only updates do not redraw or restart motion. Selection and hover do not call the monitor controller. There is no text, progress, brightness cycle, provider information, new trusted state, or environment engine.

Retention cancels motion and draws the stable last trusted lifecycle. Reduced motion does the same using the existing runtime policy, without another media-query observer. Returning live/motion-permitted resumes only Working; Completed never replays. New lifecycle/policy/disposal cancels the owned Phaser timer and advances a generation guard, so late callbacks cannot overwrite newer presentation. Disposal is idempotent, never draws, and cancels timers even after Graphics destruction. Scene cleanup clears monitor and existing character ownership maps.

## Evidence provenance and limits

- **Normal integrated application:** Developer launched `npm run dev:simulated`. Existing real simulator logged `snapshot_accepted` and `event_sim-001` through `event_sim-005`. This verifies launch/delivery, not native appearance or timing.
- **Native window:** Computer Use returned “Computer Use permissions are not granted.” Native user-assisted checks were requested for monitor reinforcement, selection/inspection, reload, and the two window sizes. No US-021 native response had been received when this report was prepared; native appearance, OS focus/input and screen-reader announcements remain unverified. Prior US-020 observations are not reused as US-021 evidence.
- **Synthetic development fixture:** New `apps/desktop/verification/us-021.html` / `us-021.tsx` use the actual renderer store/reducer, runtime, React host and Phaser scene with synthetic accepted-message fixtures. The banner explicitly denies provider, authenticated-transport and end-to-end claims. This entry rejects non-development execution and is not a production build input.
- **Offscreen Electron:** All 44 PNGs are direct `webContents.capturePage` output from the actual fixture renderer, with sandbox/context isolation enabled and Node integration disabled. They were not edited, reconstructed, resized or composited. Environment: Electron 37.10.3, darwin arm64; run began `2026-10-03T15:58:18.405Z`. CSS viewports: 1100 × 760 and 760 × 540; measured device pixel ratio 2. Full PNGs are therefore 2200 × 1520 or 1520 × 1080 decoded pixels.
- **Automation/source:** Selection, retained/restored snapshots, reduced-motion media emulation, remount/reload and scrolling were exercised in the fixture. Both viewport checks returned one canvas and no horizontal document overflow. Remount/reload returned one canvas and zero renderer console errors. Scrolled inspection captures show the existing selected Mina content. These are DOM/renderer checks, not native keyboard, screen-reader or Designer acceptance.
- **Fallback:** Deterministic geometry/scene tests and source inspection establish correct inset placement. An actual fallback-room capture was not produced.

## Reproduce

Start `npm run dev:simulated`. Use the actual loopback URL printed by Vite; then run:

```bash
node_modules/.bin/electron apps/desktop/verification/capture-us-021.cjs http://localhost:5173
```

The runner creates its own hidden offscreen window, writes only `docs/verification/assets/us-021/`, destroys that window and exits. It imports the exact already-loaded Vite entry URL, including any HMR timestamp, to avoid creating another React root. It fails on renderer console errors. For interactive Designer review use `/verification/us-021.html`. Fixture dropdowns are input controls, not authoritative state readouts; automated changes are reflected in the office and inspection.

Monitor strips are direct renderer rectangles at canvas-relative `(80,74,240,34)` CSS pixels. They preserve surrounding bezel/stand/background and contain both monitor safe insets; at measured DPR 2 they decode as 480 × 68. Review at the corresponding CSS/scene scale, not as a magnified dashboard. Insets in decoded strips: Ari `(16,12,80,32)`, Mina `(384,12,80,32)`.

## Capture index

Both Ari and Mina are present in every monitor strip.

| Situation | Captures |
| --- | --- |
| Quiet Idle and room context | [monitors](assets/us-021/idle-monitors.png), [normal](assets/us-021/idle-normal.png) |
| Working stable / alternate / return | [00](assets/us-021/working-series-00.png), [07](assets/us-021/working-series-07.png), [12](assets/us-021/working-series-12.png), [normal](assets/us-021/working-normal.png); full 15-sample sequence `working-series-00.png` through `working-series-14.png` |
| Waiting | [equal squares](assets/us-021/waiting-monitors.png) |
| Completed | [widened](assets/us-021/completed-widened.png), [settled](assets/us-021/completed-settled.png) |
| Error | [closed outlines](assets/us-021/error-monitors.png), [normal](assets/us-021/error-normal.png) |
| Retained Working | [A](assets/us-021/working-retained-a.png), [B](assets/us-021/working-retained-b.png), [retained notice](assets/us-021/retained-normal.png) |
| Reduced Working | [A](assets/us-021/working-reduced-a.png), [B](assets/us-021/working-reduced-b.png) |
| Reduced Completed / disable preference | [reduced](assets/us-021/completed-reduced.png), [restored motion](assets/us-021/completed-motion-restored.png) |
| Retain during Completed / snapshot restore | [retained](assets/us-021/completed-retained.png), [snapshot](assets/us-021/completed-snapshot-restored.png) |
| Independent ownership | [mixed Waiting/Error](assets/us-021/mixed-waiting-error.png), [Ari-only update](assets/us-021/ari-only-change.png), [Mina-only update](assets/us-021/mina-only-change.png), [Sol-only update](assets/us-021/sol-only-change.png) |
| Rapid Working supersession | [Waiting](assets/us-021/rapid-working-waiting.png), [Completed](assets/us-021/rapid-working-completed.png), [Error](assets/us-021/rapid-working-error.png), [Error after old deadlines](assets/us-021/rapid-error-after-stale-deadlines.png) |
| Existing selection and scrolling | [normal selected](assets/us-021/selected-normal.png), [normal inspection](assets/us-021/normal-inspection.png), [minimum office](assets/us-021/minimum-selected.png), [minimum inspection](assets/us-021/minimum-inspection.png) |

The [capture record](assets/us-021/capture-record.json) contains each rectangle, decoded dimensions, Node-process monotonic `performance.now()` milliseconds and SHA-256 of the exact **PNG file bytes**, not decoded RGB/NativeImage bitmap bytes. Reproduce each file hash with `sha256sum`/`shasum -a 256` or `hashlib.sha256(path.read_bytes()).hexdigest()`.

Working samples were requested every 200 ms for 2.8 seconds. Relative to sample 00, samples 00–05 (0–1000 ms) show the stable frame, 06–11 (1200–2201 ms) show alternate, and 12–14 (2400–2800 ms) show stable again. This repeated renderer sampling demonstrates an observed alternation and return within one sampled cycle, with 200 ms sampling uncertainty; it is not continuous video or proof of exact native cadence. Deterministic tests verify the configured 1200 ms loop. Stills alone only establish distinct frames.

Completed widened capture was requested approximately 80 ms after the transition; settled capture followed 650 ms later. Tests verify the 500 ms scheduled duration. Retained/reduced pairs were separated by approximately 1350 ms. These are approximate capture schedules, not exact native stopwatch measurements.

## Image integrity and direct comparisons

All 44 PNGs decode successfully; every recorded PNG file hash matches. Comparisons used decoded RGB, row-major, three bytes per pixel, at matching crop positions. No selection, character or background pixels occur inside the monitor inset comparison regions.

| Pair | Ari changed pixels | Mina changed pixels |
| --- | ---: | ---: |
| Working 00 → 07 | 64 | 64 |
| Completed widened → settled | 288 | 288 |
| Retained Working A → B | 0 | 0 |
| Reduced Working A → B | 0 | 0 |
| Reduced Completed → motion restored | 0 | 0 |
| Retained Completed → snapshot restored | 0 | 0 |
| Mixed → Ari-only update | 288 | 0 |
| Ari-only → Mina-only update | 0 | 288 |
| Mina-only → Sol-only update | 0 | 0 |
| Rapid Error → after stale deadlines | 0 | 0 |

For every listed pair, the full strip difference equals the sum of the two inset differences: **zero changed pixels outside the safe insets**, including captured bezel/stand/background. Stability counts establish only the sampled interval, supported by cancellation tests.

Reproduce a comparison using Pillow (used as an existing tooling runtime, no project dependency added):

```python
from PIL import Image
from pathlib import Path
p = Path('docs/verification/assets/us-021')
box = (16, 12, 96, 44)  # Ari; Mina: (384, 12, 464, 44)
a = Image.open(p / 'working-series-00.png').convert('RGB').crop(box)
b = Image.open(p / 'working-series-07.png').convert('RGB').crop(box)
assert a.size == b.size
aa, bb = a.tobytes(), b.tobytes()
print(sum(aa[i:i+3] != bb[i:i+3] for i in range(0, len(aa), 3)))
```

All 42 previously tracked PNGs were compared byte-for-byte against baseline HEAD and are unchanged, including room layers, agent/coffee source assets, four North Stars, and existing US-020 evidence.

## Automated coverage and validation

Test-first focused run reproduced missing monitor integration; after implementation, **31/31 focused tests passed**: 24 workstation tests and 7 scene tests (including 2 existing character tests). The 29 added cases group the 40 requested checks rather than duplicating the entire US-020 provenance/session/security matrices.

| Required checks | Coverage |
| --- | --- |
| 1–8: vocabulary and geometry | All stable/alternate/widened marks within the 20 × 8 source inset; both artwork and fallback positions, bounded fallback containment |
| 9–13, 35: identity/isolation/reuse | Scene creates exactly two controllers/Graphics; independent Ari/Mina redraws; Sol and selection affect neither; existing anchors determine ownership |
| 14–20, 34: Working | Stable entry, 1200 ms loop, all lifecycle cancellations, retained/reduced settlement, live-only resumption, activity/reason non-restart |
| 21–30: Completed | Same token forwarded to character and monitor; 500 ms one-shot; real store/runtime/host current, same-state, activity, reason, snapshot, selection and remount exclusions; newer lifecycle/stale callback protection |
| 31–33: policy cancellation | Retain/reduce during widening, stable settlement, no historical replay when motion returns |
| 36–40: lifetime | Owned timer removal, repeated disposal, late work harmless; installed Phaser GameObject destruction with faithful Graphics/Sprite pre-destruction semantics precedes scene cleanup and all maps clear |

Results on the implementation tree:

- `npm run test -w @coffee-break/desktop -- src/office/workstationPresentation.test.ts src/office/OfficeScene.test.ts`: 2 files, **31 tests PASS**.
- `npm test`: **217 tests PASS** — 22 importer, 194 desktop across 25 files, 1 contract; no skips or failures.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, zero errors; two pre-existing generated-bundle unused `eslint-disable` warnings. No new source warnings.
- `npm run build`: PASS. Only the existing production entry is built; the US-021 fixture is excluded.
- `node --check apps/desktop/verification/capture-us-021.cjs`: PASS.
- Separate strict harness check: PASS, using `npx tsc --noEmit --strict --jsx react-jsx --moduleResolution Bundler --module ESNext --target ES2022 --lib ES2022,DOM,DOM.Iterable --skipLibCheck --types vite/client apps/desktop/verification/us-021.tsx`.
- `git diff --check`: PASS; scope/image audit PASS. Generated `apps/desktop/out` output remains ignored; no generated output is tracked.

The initial sandboxed development launch could not bind `::1:5173` (`EPERM`); the approved local launch succeeded outside that sandbox. This was an environment permission limitation, not an application defect.

## File inventory, scope and review gates

Modified:

- `apps/desktop/src/office/OfficeScene.ts`: two controllers/Graphics, shared presentation/token forwarding, fallback choice, shutdown map cleanup.
- `apps/desktop/src/office/OfficeScene.test.ts`: focused scene regression coverage and real pipeline delivery seam.

Added:

- `apps/desktop/src/office/workstationPresentation.ts` and `.test.ts`: bounded geometry/forms and cosmetic lifetime with deterministic coverage.
- `apps/desktop/verification/us-021.html`, `us-021.tsx`, `capture-us-021.cjs`: isolated development fixture and repeatable offscreen capture.
- `docs/verification/us-021-workstations.md`: this report.
- `docs/verification/assets/us-021/`: 44 directly captured PNGs and `capture-record.json`.

No renderer store/runtime/Host, contracts, IPC, preload, main mirror, transport, Connector, simulator, security, dependencies, room/coffee art, original US-020 evidence, architecture or approved design source changed. No US-022+ behavior was introduced. Character timing, exact Sol coffee behavior, selection, labels and inspection remain intact.

Remaining gates: Designer implementation review of actual-scale shape legibility and secondary visual hierarchy; independent technical review; Product Owner final acceptance. Native checks and screen-reader verification remain unclaimed as described above. The implementation remains unstaged/uncommitted; no push, PR, merge or GitHub issue modification was performed.
