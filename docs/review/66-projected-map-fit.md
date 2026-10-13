# Fit the projected repository, keep orientation

13 October 2026. Review 50 item 33; installed `emil-design-eng`, `animate` and `review-animations` used for camera/reading review.

| Before | After | Why |
| --- | --- | --- |
| Fit resets yaw/pitch and pan/zoom regardless of actual node bounds | Fit projected node bounds into the largest measured unobscured rectangle | Fit answers a reading/navigation need while retaining the user's spatial orientation |
| Narrow labels need space beyond their point but camera ignores that | Reserve a fixed DOM-label footprint independently of world scale | Keep visible labels inside the viewport; text stays DOM, never WebGL |
| Keyboard Fit follows the pointer tween | Immediate keyboard Fit; existing pointer camera tween/reduced-motion policy retained | Frequent keyboard navigation should not wait for motion |

Visible header, map controls/legend/import drawer, folder rail, composer and modeless reader rectangles are measured. Free-region candidates are bounded to 64; node fitting is an iterative linear pass, with no spread over huge arrays. Existing camera transform is retargeted, not duplicated. Zoom-out permits the smaller fitted scale so a subsequent minus/wheel action cannot unexpectedly zoom inward. No default orbit/12-second hold, captured relationships, depth semantics, draw technology or source location changes.

**Motion verdict:** the changed Fit behavior preserves one existing spatial camera transform, current-state interruption and pointer/reduced-motion handling. Keyboard Fit is immediate. The existing 300 ms camera transition is retained as an established navigation behavior; no new repeated arrival, fake reading or layout animation. The builder's longer material and orbit exceptions remain untouched. Fit is to the current projected orientation; later resumed rotation may change the projection, and label culling/density grouping remain necessary. Fit does not promise simultaneous legible names for every node in a huge repository.

Two units cover occlusion/label bounds, empty/degenerate input and an iterative 100k-point case. Browser journey retains manual yaw/pitch through Fit and verifies visible DOM labels at 1280/844/390 px. UI typecheck/build pass. Physical/GPU/platform/human acceptance remains separate; no hosted CI.
