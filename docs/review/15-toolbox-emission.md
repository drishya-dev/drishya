# Toolbox emission — integrated refinement, 6 October 2026

This is a bounded refinement of the builder's toolbox idea, not a new harness or a declaration that the premium presentation is complete. Native instruments and actual observed MCP tools have a small resting mark. On a newly captured invocation, a duplicate of that mark travels from its measured visible instrument to the action's header, while the original instrument and every character stay in place.

## Implemented

- Native instruments and MCP tool rows retain their visible names, recorded uses, filtering and narrow-screen drawer. The small 24 px mark gives each invocation a recognizable resting location without enclosing the whole workspace in a panel grid. No installed-tool inventory is inferred from observed use.
- `Origins.toolTransfer` copies only the application's SVG silhouette, never a tool label, source code or result. Its 26 px backing and 16 px glyph travel over a measured curve in nine keyframes for 620 ms, then disappear. They land at the real action-header glyph. The existing material backing/tether and captured input remain immediately available. A read can have both a Read-tool emission and its separate evidence-backed repository lift; these describe tool identity and file reference, not cause.
- Both glyph locations must be visible within their actual dock/history bounds, and centre hit-testing must resolve to the intended instrument/action. Clipped/occluded sources do not produce a travelling mark. A server fallback can still supply the existing qualified relationship cue, but does not fabricate a tool silhouette if no visible tool glyph exists.
- The existing motion owner handles cancellation: scrolling, deliberate navigation, pointer/key input, settings and reading changes cancel cues. Held history, initial loads, rewinds, motion-off and browser reduced-motion never replay this transfer. Burst arrivals retain the existing three-action cue budget. No extra frame loop, wall-clock read, source request, dependency or projection is introduced.

## Validation

The new browser case records geometry in the actual arrival frame, compares it with independently sampled source/header bounds, verifies the source silhouette and absence of SVG text, and interrupts an active animation through the viewer's pointer handler. It then covers the instrument with a synthetic overlay and confirms another request appears without another travelling mark. Sampling after an asynchronous follow adjustment would compare different frames; tests must not mistake legitimate viewport following for incorrect origin measurement.

Typechecks/245 units and the ordinary browser suite (32 passes, two opt-in skips) pass, followed by targeted final visibility/dock regressions and three repeated occlusion/interruption runs. The finite request/result test also checks natural cue completion. Dark/light integrated frames and the narrow tool drawer are reviewed. A fresh ten-minute reader on the final visibility-guard build is running; actual result belongs in STATUS before merge. CI is checked on the exact final revision independently.

This supports the first stage of [DEVELOPER_WORKSPACE](../DEVELOPER_WORKSPACE.md). Next bounded baseline work is captured-range clarity and deliberate deeper reading, preserving historical provenance, camera position and the real origin. A folder/current-file/symbol explorer remains later staged work; do not combine an IDE rebuild with this motion increment.
