# 89 — Bottom-anchored prompt timeline and separate page scrolling

17 October. Latest builder correction supersedes87's top anchoring. One focused commit/PR on `codex/prompt-timeline-scroll`, after PR69 merged/pushed as574973a.

| Before | After | Why |
|---|---|---|
| Moving the whole timeline down from the top left an inherited center translation and could clip it | Restore bottom anchoring with no translation; lists grow upward | Preserve the presentation the builder preferred. |
| Topmost marker nearly touched Workspace | Measure only intersecting header/Workspace controls and cap available rail height with14px clearance | Add a small gap without repositioning the whole list from the top. |
| Prompt rail could become clipped or appear unscrollable | Independent native overflow, wheel containment, virtual rows, Home/End/Page navigation and complete rank list | Every prompt remains reachable without moving the main history. |
| The main scrollbar sat beside prompt ticks at the center/right reading boundary | Modern history's scroll box extends to the viewport edge; right padding preserves its prior content allocation | Keep native page scrolling separate from the prompt/time navigator. Inspectors retain their explicit reading boundary; prompt rail is hidden there and in Workspace. |
| Prompt previews lacked captured time in global outlines | Carry the original turn timestamp through the local scene view and show it in the preview | No estimated position/timestamp mapping or invented wall-clock time. Missing time remains absent. |

The timeline remains independent of pixel distance through variable-size cards. Current/near/normal ticks retain24/16/8px emphasis, full captured prompt destinations and existing preview behavior. The bottom clearance responds to intersecting composer, Tools/Follow controls on phones; short lists stay near the bottom and tall ones scroll above them. Resize and direct viewer-child changes remeasure the bounded overlay, without observing every history subtree mutation. Existing live capture/replay independence remains.

`ScenePassage.turnTime` is a local presentation field copied from the captured turn, not an observation schema change. Composer remains pure; formatting dates happens in the DOM layer. Four scene goldens change only by adding captured turn times. A new test verifies missing times are not invented.

Local checks: both typechecks/build and full431units/72files pass. Scene goldens13passing; five focused browser journeys cover160prompts, native wheel independence, full first/last reachability, captured timestamps, keyboard navigation, bottom/Workspace/Tools clearance and390/900/1440px geometry. The paged-outline timestamp check passes its focused rerun; the actual Drishya continuation also passes history/manual-scroll/multi-file Workspace in the ignored review store. No hosted CI/native turn. The broad84/85/87 product queue remains active.
