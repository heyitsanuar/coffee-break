# US-022 — Contextual coffee implementation evidence

Prepared for Designer implementation review, followed by independent technical review. This record does not approve the story or claim those reviews have occurred.

## Baseline and scope

- Branch: `feature/us-022-contextual-office-interactions`.
- Merged-main implementation baseline: `0e8f60208ef88e73e5401d992973069d220666ce` (US-021 PR #54).
- This evidence describes the unstaged, uncommitted working implementation on that baseline.
- Approved scope: one tiny steam curl above Sol's existing table mug, using the existing `visual: 'coffee'` discriminant. No additional raw activity/lifecycle matcher exists in Phaser.
- The original adapter still requires Sol + Waiting + exact activity `Taking a coffee break in the simulated office`. Inspection still reports Waiting and that exact activity; existing character coffee behavior and lifecycle labels are unchanged.

## Implementation and geometry

One scene-owned transparent Graphics object is reused in artwork mode only. It is positioned at scene `(574,192)`, scaled ×2, depth 1, above background and below character/foreground. Its source envelope is `(287,96,5,6)` immediately above the existing mug body `(287,102,5,6)`. Neither mug nor machine artwork changed.

The four filled integer rectangles in Frame A are local `(2,4,1,2)`, `(1,3,2,1)`, `(1,2,1,1)`, `(2,1,2,1)`. Frame B shifts only the last rectangle to `(3,1,2,1)`. Colour is the existing mug-opening cream `#f7f0df`; all other pixels remain transparent. No background plate, particles, glow, pulse, or new PNG asset exists.

Coffee draws A immediately. One Phaser looping TimerEvent alternates every 1600 ms while live and motion-permitted. Retained/non-live or reduced coffee cancels motion and settles to A. Retained-to-live and initialization start from A. Identical already-live updates preserve phase. Any non-coffee presentation synchronously clears/hides steam. Generation invalidation prevents obsolete callbacks from drawing. Disposal is idempotent, cancels the timer, and neither draws nor changes visibility after DisplayList destruction. Scene shutdown clears controller ownership.

Fallback has no supporting mug, therefore no steam object/controller is created. Its existing Sol character presentation still works.

## Evidence provenance and reproduction

**Synthetic fixture / direct offscreen renderer:** all images below are direct `BrowserWindow.webContents.capturePage` PNGs of the actual React/Phaser renderer. They were not edited, reconstructed, upscaled after capture, or composed. The crop is selected at capture time. The isolated fixture feeds synthetic accepted input through the actual store → adapter/runtime → Host → game/scene; it does not prove authenticated transport or provider integration.

Environment: macOS arm64, Electron 37.10.3, device pixel ratio 2. Viewports are CSS 1100 × 760 and 760 × 540; resulting page PNGs are 2200 × 1520 and 1520 × 1080. Office captures are 1280 × 720. Mug crops are 22 × 30 CSS pixels / 44 × 60 decoded pixels. Inspect context at its logical display scale rather than enlarging the crop into a proposed UI element.

[Capture record](assets/us-022/capture-record.json) records capture time, exact crop rectangles/dimensions, elapsed sample times, and full **PNG-file-byte** SHA-256 values (not raw bitmap hashes).

```bash
# Start an unchanged simulated desktop and note its Vite loopback URL:
npm run dev:simulated
# Substitute the actual URL printed by that launch:
node_modules/.bin/electron apps/desktop/verification/capture-us-022.cjs http://localhost:5173
```

The fixture is accessible at `/verification/us-022.html` on the development server. It is guarded by `import.meta.env.DEV` and excluded from the production build's sole `index.html` input. The capture runner imports the exact loaded Vite entry URL, avoiding a second React root from HMR timestamps. Fallback is induced solely in the capture window by cancelling PNG image-data requests for the two room files, while allowing Vite `?import` modules through. Phaser retries produced six blocked requests for two distinct paths; no source or fixture scene hook changes the fallback implementation.

## Direct renderer captures

| Situation | Supporting artifacts | Observed result |
| --- | --- | --- |
| Generic Sol Waiting | [Mug](assets/us-022/generic-waiting.png), [office](assets/us-022/generic-waiting-office.png) | No steam; ordinary Waiting character. |
| Exact coffee, A | [A](assets/us-022/coffee-a.png) | Stable initial curl, directly above table mug. |
| Exact coffee, B | [B](assets/us-022/coffee-b.png) | Only upper curl segment shifts. |
| Full-cycle return | [Return A](assets/us-022/coffee-return-a.png), [later A](assets/us-022/coffee-later-a.png) | Same decoded A pixels after >3.2 seconds. |
| Coffee composition | [Office](assets/us-022/coffee-office.png), [1100 × 760 selected](assets/us-022/coffee-normal.png), [inspection after scroll](assets/us-022/coffee-normal-inspection.png) | Existing character, static machine, exact Waiting/activity inspection. |
| Coffee → generic Waiting | [Exit Waiting](assets/us-022/exit-waiting.png) | Steam-free mug region. |
| Coffee → Working | [Exit Working](assets/us-022/exit-working.png) | Steam-free mug region. |
| Retained coffee | [A](assets/us-022/retained-a.png), [later A](assets/us-022/retained-later-a.png), [context](assets/us-022/retained-normal.png) | A persists unchanged across >3.2 seconds; last-known notice remains. |
| Retained → live | [Restored A](assets/us-022/restored-a.png) | Starts A without entry acknowledgement. |
| Reduced motion | [A](assets/us-022/reduced-a.png), [later A](assets/us-022/reduced-later-a.png) | Same A pixels across >3.2 seconds. Preference set through actual browser media emulation. |
| Ari exact-activity negative | [Ari negative](assets/us-022/ari-negative.png) | Sol's mug stays steam-free. |
| Mina exact-activity negative | [Mina negative](assets/us-022/mina-negative.png) | Sol's mug stays steam-free. |
| Scene initialized with cached coffee | [Initialized A](assets/us-022/initialized-a.png) | A starts on remount, one canvas. |
| Minimum composition | [760 × 540 selected](assets/us-022/coffee-minimum.png), [inspection after scroll](assets/us-022/coffee-minimum-inspection.png) | No horizontal overflow; document scroll reaches unchanged inspector. |
| Missing room assets | [Fallback office](assets/us-022/fallback-coffee-office.png), [fallback selected](assets/us-022/fallback-coffee-normal.png) | Coffee character remains; no mug or floating steam. |

A/B/return sampling occurred approximately 122 / 1774 / 3423 ms after delivering coffee; a further sample was taken beyond 4000 ms. The capture record preserves exact elapsed values. Still images establish distinct frames and sampled A/B/A behavior; they do **not** alone establish continuous cadence. The 1600 ms timer configuration and deterministic timed regression tests support the cadence claim.

## Reproducible pixel comparison

Decode PNGs to RGB (8 bits per channel), compare corresponding coordinates, and count pixels with any differing channel. These comparisons cover the entire unchanged 44 × 60 mug crop, not only handpicked pixels. Frame A/B differ in exactly **32 decoded pixels**. Their half-open change bounds are `(16,12,28,16)`, wholly inside the approved steam envelope `(8,8,28,32)` in crop pixels. No selection indicator, character, machine, or changed crop contributes to this difference.

A equals return-A, later-A, retained-A, later-retained-A, restored-A, reduced-A, later-reduced-A, and initialized-A. Generic Waiting equals exit-Waiting, exit-Working, Ari-negative and Mina-negative. Thus the first group demonstrates stable coffee form; the second demonstrates complete removal/negative context.

Using an existing Python environment with Pillow (no repository dependency added):

```python
from pathlib import Path
from PIL import Image
p = Path('docs/verification/assets/us-022')
def pixels(name):
    return Image.open(p / f'{name}.png').convert('RGB')
a, b = pixels('coffee-a'), pixels('coffee-b')
assert a.size == b.size == (44, 60)
changed = [(x, y) for y in range(a.height) for x in range(a.width)
           if a.getpixel((x, y)) != b.getpixel((x, y))]
assert len(changed) == 32
assert all(8 <= x < 28 and 8 <= y < 32 for x, y in changed)
for name in ['coffee-return-a', 'coffee-later-a', 'retained-a',
             'retained-later-a', 'restored-a', 'reduced-a',
             'reduced-later-a', 'initialized-a']:
    assert a.tobytes() == pixels(name).tobytes()
neutral = pixels('generic-waiting').tobytes()
for name in ['exit-waiting', 'exit-working', 'ari-negative', 'mina-negative']:
    assert neutral == pixels(name).tobytes()
```

The script additionally confirms one canvas after remount/reload, exact activity text/selected Sol in inspection, zero renderer console errors, and no horizontal document overflow at either viewport. These scripted DOM observations are not native keyboard or screen-reader checks.

## Automated validation

- Focused: `npm run test --workspace @coffee-break/desktop -- src/office/coffeeSteamPresentation.test.ts src/office/officePresentation.test.ts src/office/OfficeScene.test.ts`: **50/50 PASS** (17 controller + 20 adapter + 13 scene).
- Controller coverage: bounded integer geometry and both frames; immediate A; real fake-clock 1599/1600/3200/4800 ms checks; one timer; all non-coffee exits; stale generations; retained/reduced policy changes; identical traffic; unrelated identities; initialization; live/destroyed idempotent disposal.
- Adapter coverage: original positive exact conjunction and other-agent negatives; all non-Waiting lifecycles, different/substring/prefix/suffix/case/missing activities, absent state. No new semantic matcher.
- Scene coverage: artwork position/layer/reuse; fallback absence; shared character/steam update; selection/acknowledgement independence; rapid supersession; installed Phaser GameObject destruction before controller/ownership cleanup; real complete store/runtime/Host updates, retained restoration, phase preservation and remount.
- `npm test`: **251/251 PASS** (22 importer + 228 desktop + 1 contracts). First sandboxed attempt could not bind loopback (`EPERM`); rerun with loopback permission passed. No test or production workaround was added.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with only two known unused-disable warnings in ignored generated Phaser bundle. A concurrent build/lint attempt encountered a disappearing Vite temporary config file; sequential lint rerun passed without a source change.
- `npm run build`: PASS. Production renderer input remains unchanged; no verification entry is a build input.
- `node --check apps/desktop/verification/capture-us-022.cjs`: PASS.
- Strict fixture TypeScript: PASS with `node_modules/.bin/tsc --noEmit --strict --jsx react-jsx --moduleResolution Bundler --module ESNext --target ES2022 --lib ES2022,DOM,DOM.Iterable --skipLibCheck --types vite/client apps/desktop/verification/us-022.tsx`.
- Evidence PNG decoding/dimensions/file hashes and pixel comparisons: PASS, 24 PNGs.
- Local report links, untracked text whitespace, `git diff --check`, existing PNG-byte integrity and scope audit: PASS.

## Native observations and review limits

Developer launched the unchanged `npm run dev:simulated` command successfully, with `simulator:snapshot_accepted`. Native Computer Use access returned **Computer Use permissions are not granted**. The user was asked to inspect mug attachment/static machine, selection/inspection, reload, both window sizes, scrolling, and reduced motion where practical. The user's actual response was **“It looks good”**. Record this as a qualitative user-assisted native observation only: it does not individually confirm each requested check or establish that reduced motion, keyboard/focus, or screen-reader behavior was actually tested.

Developer visually inspected the direct renderer crops, artwork office, normal/minimum composition and scrolled inspection, and actual fallback capture. The accent is attached to the measured mug and remains sparse; palette/legibility and final environmental quality still require Designer implementation review at actual display scale. Existing keyboard/accessibility regression tests remain green; native keyboard/focus, native reduced-motion behavior and screen-reader announcements remain unverified in this pass.

Designer implementation review and independent technical review are pending. No Product Owner acceptance or completion is inferred from this report.

## Scope audit

Only the approved scene/helper/tests, isolated US-022 fixture/capture script and US-022 report/evidence are changed. No trusted contract, IPC, preload, Electron main, Connector, simulator, dependency, office presentation schema, Host/runtime, character/workstation controller, room/sprite asset, North Star image, or prior evidence changed. No generalized interaction framework, acknowledgement, movement, metrics, machine animation, new cup, or US-023/US-024 feature was added. Everything remains unstaged and uncommitted; no push or GitHub mutation occurred.
