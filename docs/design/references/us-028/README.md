# US-028 — Approved selection and agent information studies

The Designer proposal was initially **NOT APPROVED**. The Product Owner subsequently said **“I approve”**; all recommendations **1–25** became the approved US-028 design baseline. Historical proposal captions remain unchanged. This package copies the exact approved images, without regenerating replacements. Machine-local working files are not required to use this durable package.

These images are **design references, not production assets or runtime evidence**. Design approval authorizes this story’s design direction, not downstream review PASS or final story acceptance. Original [North Star references](../north-star/) remain higher-level authority. The merged US-025 shell, [US-026 environment](../us-026/README.md) and [US-027 characters](../us-027/README.md) remain upstream authority and are frozen for US-028. US-029 owns broader responsive refinement; US-030 owns final integrated fidelity/polish.

## Approved engineering specification

Reuse native Ari/Mina/Sol selector buttons in fixed order, beneath simulation context. Each has a decorative 32 × 32 canonical Idle portrait, text identity and reserved check space. Warm selected border/inset and check remain separate from cyan 3px external focus with 3px offset. Controls are 44px high, with 8px gaps; focus never selects.

The contextual 304px dock leads with a 48 × 48 matching portrait, selected name heading and plain lifecycle directly below. Freshness precedes verbatim activity: **Current information** or **Last known · Not live**. Map only existing optional trusted reasons; omit absent reasons. Preserve meaningful line breaks, wrap anywhere, grow in document flow without truncation or nested scrolling. Do not invent metrics, provider details or lifecycle states.

No selection leaves the reserved dock unfilled and shows **Select an inhabitant** / **Choose someone in the office or below.** Selected without trusted state shows identity and **No trusted agent state available yet.**, with no inferred fields. Clear remains a stable native button, `aria-disabled` and guarded when empty, so clearing does not deliberately move focus. Compact summary remains text-only; room/context/roster/summary/inspector stay in document order. No new motion.

Portraits use canonical `agent-lifecycle.png` Idle column 0, rows 0/24/48, local crop `(2, 0, 16, 16)`, at integer 2×/3×. No independent portrait assets or alternate identity authority.

Invisible pointer targets use existing clearance metadata: world `(anchor.x − 24, anchor.y − 56, 48, 64)`, equivalent frame-local `(-2, -4, 24, 32)` with bottom-center origin, 20 × 24 frames and 2× scale. Outer 46 × 54 / inner 42 × 50 selection outlines, anchors, furniture and art remain unchanged. React `OfficeSceneHost.selectedAgentId` remains selection authority. Lifecycle/activity/reason/availability updates preserve selection; retained state never becomes Offline. Sol coffee stays contextual under the existing exact predicate; inspector stays Waiting.

## Exact promoted artifacts

SHA-256 below hashes each complete original PNG file, not decoded pixels.

| Reference | Dimensions | PNG SHA-256 |
| --- | --- | --- |
| [a-desktop-no-selection.png](a-desktop-no-selection.png) | 1100 × 760 | `1cc1ccba984d5254c86bc683a66dd0153cc3d5ba80f7c6807e37ce74b034f4da` |
| [b-desktop-ari-world-selected.png](b-desktop-ari-world-selected.png) | 1100 × 760 | `96bde5344e2b9da7ef3c6a3fa15d4ad158da00736bdef0f809d1aa55031deaf8` |
| [c-desktop-mina-roster-selected.png](c-desktop-mina-roster-selected.png) | 1100 × 760 | `784af5b00194006f0ba0c6b56e139912a290108259acc2c6e8c1498640dcb431` |
| [d-desktop-sol-coffee.png](d-desktop-sol-coffee.png) | 1100 × 760 | `e295cc411a04ca61811d94173c8a8ec2f14324c2d12713bd6ece1466eb43107f` |
| [e-compact-selected.png](e-compact-selected.png) | 760 × 540 | `9a98a3b099df5affb5cd8fd8e73ca916c1f00e11ff777388be3b54add94861fe` |
| [f-roster-state-matrix.png](f-roster-state-matrix.png) | 1052 × 252 | `1101da03397bd7783b61818ebf3d67dc5654c073da2d6568ae3e5bfeedfeb88c` |
| [g-information-hierarchy.png](g-information-hierarchy.png) | 1052 × 493 | `a176c80cbc99d7ceeace1364e3fa372e700f73cfb40818bf3d24a9415cedd2c1` |
| [h-identity-crop.png](h-identity-crop.png) | 1052 × 327 | `8575a0f6176e0622efb793ea9fb1fe3691afcf25e8ca56b6f9db1eea89f1e8b1` |
| [i-pointer-target.png](i-pointer-target.png) | 1052 × 563 | `295ee0941d8ad1c2f58aca19e44088f2f64bcd8796c032e69333c54638849800` |
| [j-desktop-retained.png](j-desktop-retained.png) | 1100 × 760 | `f53dfb1ff225974970c4906dda5a8c1a788318c69d1b3009fcdb3332edfa9a81` |
| [j-live-retained-comparison.png](j-live-retained-comparison.png) | 1052 × 621 | `fb445dfa549881a080446c0510106b7b84e0692b874af13d22b532c65a46d136` |
| [k-compact-long-full-flow.png](k-compact-long-full-flow.png) | 760 × 1058 | `d080b6fcf9c9e9a2a17ee481a6a94b8658778c36335ccf53385b18b3f24033c2` |
| [k-compact-long-retained.png](k-compact-long-retained.png) | 760 × 540 | `599aa28a8c7d60c713b7670809b19f40edb66e9f3909de44ca1ba8da6db74df3` |
| [k-desktop-long-full-flow.png](k-desktop-long-full-flow.png) | 1100 × 794 | `3f0a4ea59d16d28b465e85f7ed0c6f0dcb9601c73684615b2c28d794f1d6c7be` |
| [k-desktop-long-retained.png](k-desktop-long-retained.png) | 1100 × 760 | `56eef9cac817139b488bd6ab3f69772a13b9bfa084e4aeca03d93c9dbf61d1a7` |
| [l-selected-no-trusted-state.png](l-selected-no-trusted-state.png) | 1100 × 760 | `e3c0a4a668bbb4571cbce9e347fd65cc66c11ee2120f73c1afdda0f11b0091ad` |
| [sol-generic-waiting.png](sol-generic-waiting.png) | 1100 × 760 | `c48720158f2345d6e364b87cdd50ede1d93aa8a42fa61ca7f53fdb62fc3978de` |
