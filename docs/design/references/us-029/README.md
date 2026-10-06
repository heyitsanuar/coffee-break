# US-029 — Approved responsive North Star references

**Status: PRODUCT OWNER-APPROVED RECOMMENDATIONS 1–15, with the Planner’s explicit zoom clarification.** The Product Owner approval and implementation authorization were supplied in the US-029 engineering brief. Original Designer studies/proposal were initially **PROPOSAL — NOT APPROVED**; their historical captions and original document/manifest are preserved. This index records subsequent approval, not runtime correctness or final story acceptance.

Authority: original North Star → approved corrected EP-05 direction → approved story-specific references → compatible implementation. The current room, characters and US-028 interaction/information hierarchy remain upstream constraints.

## Approved direction and clarification

Preserve the 640×360 canvas, 642×362 host and 2× office/characters. At content width ≥1012 use the existing 642/18/304 side composition; at ≤1011 anchor inline composition at the 24px left gutter. At content height ≤560 use the 40px minimum header, 7px vertical padding, 24px brand mark, 4px panel top inset, 6px world gaps and 20px default summary line. Content may grow naturally; keep one document flow and stable native controls. Do not clip truthful text.

DOM text enlargement through 200% is supported with natural growth/wrapping. Full-page/browser zoom at the minimum native window is not an additional US-029 layout contract; preserve the 2× world and Electron minimum. The original proposal/manifest contains a then-unresolved zoom question; this subsequent clarification resolves it. No page-zoom counterexample authorizes scaling or window changes.

## Provenance and evidence boundaries

These 18 PNGs were promoted byte-for-byte from the external Designer package after verifying correspondence with the approved recommendations. The original centered alternative and page-zoom pressure counterexample were not promoted as implementation targets; both remain described in the preserved historical manifest. No study was regenerated or re-encoded. Hashes below cover complete PNG files.

**Design studies and derived design boards are not runtime evidence.** Native-assumption images model a measured 28px macOS frame with an annotation band. This is a historical calibration, not a platform constant or production implementation observation. Their input/state metadata is illustrative; actual trusted no-state behavior is verified separately in the runtime package. Final evidence must record real native bounds and actual content dimensions.

[Original proposal](original-design-proposal.md) · [Original 20-study manifest](original-study-manifest.json)

| Promoted artifact | Classification | Geometry assumption | PNG SHA-256 |
| --- | --- | --- | --- |
| [a-desktop-native-1100x760.png](a-desktop-native-1100x760.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `00464ea5166cac88162ea79a0d827c3ae04ef61547ed81ab782612167db4be4d` |
| [a-desktop-content-1100x760.png](a-desktop-content-1100x760.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | CSS content viewport bounds | `a434c691ff192999690653bf45045e5f81aa8dd9d0af35d8bc1eca2e98a0d244` |
| [b-minimum-native-760x540.png](b-minimum-native-760x540.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `3c451233502da5f9b76b763df687d86e90e4ddfe4803048d0d0a1fc66005de52` |
| [b-minimum-content-760x540.png](b-minimum-content-760x540.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | CSS content viewport bounds | `85c5e697a6a2bc6d4f0bed1e906e03bf6000fa9f7d6256ff68fce24cfd787933` |
| [b-minimum-full-flow.png](b-minimum-full-flow.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | CSS content viewport bounds | `5ba69d8a514e500000fee720296acb4e8f1d3251c02d139775c6959baea88e4a` |
| [c-transition-side-1012.png](c-transition-side-1012.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `f336e2ee2fe2fe9268cee31244feebff92d50174b82144ce6c307e6f0625ee9f` |
| [c-transition-inline-1011.png](c-transition-inline-1011.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `640b9d8ca602be04b8ef7383d1f60a2a19f3a043052cf6789adfcb1520b347b0` |
| [c-intermediate-native-900x700.png](c-intermediate-native-900x700.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `8675ef106b5e6539f1cc72273834f4d8e75a9a96fff1fc6f05c5e929b0e69d09` |
| [d-long-desktop-retained.png](d-long-desktop-retained.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `6321f8222be1cb638bc3d631fbad4551b5653e3b90e0fd07bfb6805436cdfe7a` |
| [d-long-desktop-full-flow.png](d-long-desktop-full-flow.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | CSS content viewport bounds | `a57ea8e5c7b4327ae0cf4ca5712c69f38d239aeb1dea6a9d6a9086eeaf887210` |
| [d-long-minimum-inspector.png](d-long-minimum-inspector.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `061a448b9a91d8ba1ab0235aa17a9362102de40a8d68147511b9a2cf9ddb54c4` |
| [e-focus-sol-selected-mina.png](e-focus-sol-selected-mina.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `986eb4bd2f19b50cd69dfd35d15bb668e17335a70600c30c7d71b0815b51c8e0` |
| [f-minimum-retained.png](f-minimum-retained.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `ca06a8ea592718335837881d55e27b74ce0726ae34b4e602db52cfb3ae7b5d8f` |
| [f-minimum-synchronizing.png](f-minimum-synchronizing.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `53bbdcd423a59e294adf02fb5b2544d6777992debf0c6d2bb8adc3bace176441` |
| [h-enlarged-text-minimum.png](h-enlarged-text-minimum.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `d1748484b41c5bb672a474fe1b09bb15e49e915f0d50b59683ca4053be5390fa` |
| [h-enlarged-text-full-flow.png](h-enlarged-text-full-flow.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | CSS content viewport bounds | `fdda17e532c8248106fc58408f8961e2273a19d802f98497b6d86ed13a698c72` |
| [i-minimum-no-state.png](i-minimum-no-state.png) | DESIGN STUDY — NOT RUNTIME EVIDENCE | Native outer-window bounds; measured 28px frame represented by annotation band | `a1ff520a27c38727c6ed88649f61db5c688b60231d7c2bfa8bf97cea61e1c4b1` |
| [g-reduced-motion-static-vocabulary.png](g-reduced-motion-static-vocabulary.png) | DERIVED DESIGN BOARD — NOT RUNTIME EVIDENCE | 642×1110 comparison board, world crops at actual 2× | `0b1ea8fd2bcfdd2c9ec2048613d96bcf92b0b9446914a79e2cebf7a7dc208f02` |

Designer implementation review, independent technical review and Product Owner final implementation acceptance remain separate pending gates. US-030 retains final integrated fidelity comparison and bounded polish.
