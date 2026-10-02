# US-020 — Character visual vocabulary evidence

Implementation evidence prepared for Designer review; no Designer approval or independent technical review is claimed.

## Baseline and scope

Branch: `feature/us-020-agent-state-visual-vocabulary`; baseline `79431a3f7708a44b096ad80c05ff3b41524a15db`. Evidence describes the uncommitted US-020 implementation on 2026-10-01, not an exact committed-head approval.

The approved renderer store remains authoritative. Its accepted-update observer feeds the bootstrap-owned presentation runtime before ordinary store subscriptions. Eligibility requires an accepted contiguous same-session event between two live snapshots, an existing target lifecycle that changes to completed/error, and reduced motion off. Current/snapshot/repair, same-state and activity/reason updates, selection, remount, restoration, and preference changes cannot create entry eligibility. Acknowledgements are ephemeral notifications, never cached/replayed; unloaded scenes initialize settled. Scene cosmetic timers are cancelled and generation-guarded on supersession, non-live/reduced policy, or disposal.

The original coffee sheet and production labels remain intact. Idle breathing and optional supporting marks are omitted. A new 160 × 72 sheet has eight 20 × 24 frames per identity row, at the existing ×2 scale and anchors. Working completes a two-hand-pose cycle in approximately 1.2 seconds; completion uses a 500 ms pose and error a 400 ms pose, then settles. No workstation, shell, provider, IPC, or transport redesign is included.

## Evidence sources and limits

- **Normal integrated launch:** Developer ran `npm run dev:simulated`. The existing real simulator logged snapshot acceptance and all five unchanged events. These diagnostics establish delivery, not appearance.
- **User-assisted native checkpoint:** Asked to inspect new poses, sprite/keyboard selection, unchanged inspection/labels, reload with one canvas, and readability/scrolling at 1100 × 760 and 760 × 540. The user replied: “Everything looks good so far.” This is the user's observation; it does not establish Designer approval or screen-reader correctness.
- **Synthetic renderer fixtures:** The separate `apps/desktop/verification/us-020.html` Vite development entry uses the real renderer store/reducer, runtime, host, and Phaser scene with synthetic accepted-message fixtures. Its banner explicitly denies provider/authenticated-transport/end-to-end claims. This entry is not a production build input and rejects non-development execution.
- **Offscreen Electron captures:** Actual renderer output from a hidden offscreen Electron BrowserWindow with sandbox/context isolation enabled and Node integration disabled. Environment: Electron 37.10.3, macOS/darwin arm64. Captured viewports were 1100 × 760 and 760 × 540 CSS pixels; measured device pixel ratio was 2. These are renderer captures, not native-window screenshots or OS input/focus observations. They were not reconstructed or edited.
- **Automation:** Fixture selection, retained/restored snapshots, runtime media-query emulation, and remount/reload were exercised. Both viewport checks reported no horizontal document overflow; remount/reload reported one canvas and zero renderer errors. The successful capture run began at `2026-10-01T17:25:47.091Z`. These assertions do not prove screen-reader behavior or visual comprehension.

An earlier capture attempt loaded the verification entry again without Vite's timestamp query, creating a second React root. The capture runner now imports the already-loaded exact module URL and fails on renderer console errors. All listed images were recaptured after that harness correction; no production correction was needed for this error.

Computer Use reported that permissions were unavailable. Developer native UI inspection was therefore not performed. Accessibility announcements remain unverified with an actual screen reader.

## Reproduce the fixture evidence

Start the development server using the existing `npm run dev:simulated` command. Use the actual loopback URL printed by Vite (it may choose another port). In a second terminal:

```bash
node_modules/.bin/electron apps/desktop/verification/capture-us-020.cjs http://localhost:5173
```

The script creates only its own hidden verification window, writes the named evidence PNGs, then destroys that window and exits. It does not alter the normal simulator or manipulate another application's window. For interactive Designer inspection, load `/verification/us-020.html` on that development server. Fixtures are synthetic; controls are verification tooling, not production settings. Use OS/browser reduced-motion emulation when inspecting the harness; no production preference UI was added.

Full captures show existing production labels. Pose strips are captured directly from a renderer rectangle spanning the three characters above the labels; this permits silhouette review independently of text. The rectangle is 432 × 56 CSS pixels (864 × 112 decoded image pixels at measured scale 2), with unchanged scene anchors/background and no selection indicator during comparisons.

## Capture index

| Situation | Supporting captures |
| --- | --- |
| Idle, labels and room context | [idle-normal](assets/us-020/idle-normal.png), [idle poses](assets/us-020/idle-poses.png) |
| Working loop | [frame A](assets/us-020/working-poses-a.png), [frame B](assets/us-020/working-poses-b.png), [normal context](assets/us-020/working-normal.png) |
| Neutral waiting | [waiting poses](assets/us-020/waiting-poses.png) |
| Completed | [acknowledgement](assets/us-020/completed-acknowledgement.png), [settled](assets/us-020/completed-settled.png) |
| Error | [acknowledgement](assets/us-020/error-acknowledgement.png), [settled](assets/us-020/error-settled.png), [normal context](assets/us-020/error-normal.png) |
| Working retained | [sample A](assets/us-020/working-retained-a.png), [sample B](assets/us-020/working-retained-b.png), [retained notice](assets/us-020/retained-normal.png) |
| Working reduced motion | [sample A](assets/us-020/working-reduced-a.png), [sample B](assets/us-020/working-reduced-b.png) |
| Reduced Error / motion restoration | [reduced](assets/us-020/error-reduced.png), [motion restored](assets/us-020/error-motion-restored.png) |
| Existing Sol coffee | [live context](assets/us-020/coffee-normal.png), [retained A](assets/us-020/coffee-retained-a.png), [retained B](assets/us-020/coffee-retained-b.png) |
| Minimum fixture viewport, Mina selected | [minimum coffee](assets/us-020/minimum-coffee.png) |

Working samples were separated by approximately 650 ms. Completion acknowledgement was requested about 90 ms after its fixture transition and settled after another 700 ms. Error acknowledgement was requested about 80 ms after its transition and settled after another 650 ms. Retained/reduced pairs were separated by approximately 750 ms. Capture scheduling is approximate; it is not a native stopwatch measurement. Two still images show distinct poses, not complete animation looping by themselves.

## Image and frame validation

All 22 evidence PNGs decode successfully. Direct comparisons of corresponding pose strips, decoded as RGB, found:

| Pair | Changed decoded pixels |
| --- | ---: |
| Working A → B | 768 |
| Completed acknowledgement → settled | 1200 |
| Error acknowledgement → settled | 3264 |
| Working retained A → B | 0 |
| Working reduced A → B | 0 |
| Reduced Error → motion restored | 0 |
| Coffee retained A → B | 0 |

The difference counts reflect the full three-character strip, not one sprite. Selection/background/crop remained unchanged. Static pairs establish stability over the sampled interval, supported by deterministic motion-policy tests.

Reproduce a pair with Pillow (no application dependency required):

```python
from PIL import Image
from pathlib import Path
p = Path('docs/verification/assets/us-020')
a = Image.open(p / 'completed-acknowledgement.png').convert('RGB')
b = Image.open(p / 'completed-settled.png').convert('RGB')
assert a.size == b.size
aa, bb = a.tobytes(), b.tobytes()  # RGB, row-major, three bytes per pixel
print(sum(aa[i:i+3] != bb[i:i+3] for i in range(0, len(aa), 3)))
```

The new asset decodes as 160 × 72 RGBA, all 24 cells are in bounds, the five stable poses in each row differ, and the bottom two pixel rows (feet) are identical across every frame of an identity. Existing head/hair pixels and identity palettes were reused with newly authored shared body/arm poses. The coffee source PNG and all four North Star PNGs remain byte-for-byte unchanged.

## Automated validation

- Focused renderer suite: 7 files, 61 tests initially passed; later runtime/host/store additions passed their 4-file, 58-test focused run.
- Full repository: 22 importer tests, 163 desktop tests, and 1 contract test passed.
- Workspace typecheck, lint, build, and `git diff --check` passed. Lint retained two generated-bundle unused-disable warnings.
- The development-only TSX harness was separately typechecked with strict TypeScript/Bundler settings. It is outside the production entry.

Tests cover shared stable/working frames, exact coffee positives/negatives, accepted-update provenance, initial/snapshot/repair/session exclusions, activity/reason-only changes, restored state, reduced motion, non-replayable notifications, rapid updates, delayed-load/remount, cleanup, cancellation and stale cosmetic timer callbacks. Existing upstream synchronization/security tests remain intact.

Commands executed: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and `node --check apps/desktop/verification/capture-us-020.cjs`. Separate harness typecheck:

```bash
npx tsc --noEmit --strict --jsx react-jsx --moduleResolution Bundler --module ESNext --target ES2022 --lib ES2022,DOM,DOM.Iterable --skipLibCheck --types vite/client apps/desktop/verification/us-020.tsx
```

## File inventory

Modified files (all paths repository-relative):

- `apps/desktop/src/agentState/store.ts` and `store.test.ts`: accepted-update observation and regression coverage.
- `apps/desktop/src/agentState/runtime.ts` and `apps/desktop/src/main.tsx`: bootstrap ownership and shutdown cleanup.
- `apps/desktop/src/office/officePresentation.ts` and `officePresentation.test.ts`: live/reduced policy alongside trusted presentation fields.
- `apps/desktop/src/office/OfficeSceneHost.tsx` and `OfficeSceneHost.test.ts`: direct scene binding, ephemeral delivery, load/remount cleanup.
- `apps/desktop/src/office/createOfficeGame.ts`: narrow acknowledgement forwarding.
- `apps/desktop/src/office/OfficeScene.ts` and `OfficeScene.test.ts`: new texture/working animation and per-sprite motion lifetime.
- `apps/desktop/src/office/applyOfficeVisual.ts` and `applyOfficeVisual.test.ts`: stable poses, loop policy, cancellation and guarded settlement.
- `apps/desktop/src/office/AgentInspectionPanel.test.tsx`: fixture policy fields only; the production panel is unchanged.

Added files:

- `apps/desktop/src/office/officePresentationRuntime.ts` and `officePresentationRuntime.test.ts`: accepted provenance, media observation, eligibility and cleanup.
- `apps/desktop/src/office/agentLifecycleFrames.ts` and `agentLifecycleFrames.test.ts`: bounded frame layout and approved durations/cadence.
- `apps/desktop/src/office/assets/agent-lifecycle.png`: original shared-vocabulary sheet.
- `apps/desktop/verification/us-020.html`, `us-020.tsx`, and `capture-us-020.cjs`: bounded development fixtures and repeatable renderer capture.
- `docs/verification/us-020-visual-vocabulary.md`: this evidence record.
- The 22 PNGs in `docs/verification/assets/us-020/`, individually linked in the capture index above.

No production contracts, Electron/preload/IPC/transport/simulator source, package/dependency files, room/coffee assets, design authority, or architecture documentation changed. Generated build output remains ignored and untracked. Nothing is staged, committed, pushed, or submitted as a PR by this implementation work.

## Designer review gate

Review actual-scale five-state silhouettes across Ari/Mina/Sol without the label strip; shared vocabulary versus identity; restrained hand motion; completion/error acknowledgement and settled meaning; neutral waiting versus explicit coffee; retained/reduced static meaning. Supporting symbols were omitted deliberately so they cannot mask weak pose semantics.

Remaining: Designer implementation review, subsequent independent technical review, actual screen-reader testing if claimed. No approval, commit, push, or PR is implied by this record.
