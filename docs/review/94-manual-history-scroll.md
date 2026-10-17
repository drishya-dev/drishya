# 94 — Preserve reading while older history mounts

17 October 2026. Responds to the builder's repeated upward-scroll skip report. This is a focused reliability increment, not completion of the UI or feature backlog. Installed Emil design-engineering and motion-review guidance applies: native navigation should remain immediate, with no animation disguising layout corrections.

## Reproduction and repair

A local, opt-in check of the long Drishya continuation recording reproduced multi-card displacement during small upward wheel inputs. Instrumenting the history element's scroll writes identified a delayed `restoreReading` call from the scroll handler's two-animation-frame callback. Separately, mounting a newly visible run replaced estimated heights with real content, but the anchor correction only ran after the asynchronous measurement revision. The intermediate allocation could reach a displayed frame before being corrected.

| Before | After | Why |
|---|---|---|
| Newly mounted runs wait for ResizeObserver to replace estimates | Read the bounded mounted slots in the layout effect, update their measured allocations and restore the anchor in that commit | Keep the same captured material in place before paint, including when virtualization changes without a new scene |
| Scroll-settlement callbacks restore an earlier anchor later | Settlement records the current reading position only | Do not overwrite newer native wheel movement with an old correction |
| Paged-out passages shrink to a fresh 240-pixel placeholder | Preserve their last measured height; do not measure placeholders as captured content | Loading another page must not discard known geometry |
| A late artifact resize waits for the next React measurement revision | Restore reading in ResizeObserver's pre-paint delivery too | Do not expose an intermediate frame when content arrives between commits |
| Regression examines only a few settled frames and the first visible item | Variable-height delayed pages, continuous wheel inputs, post-render samples of all mounted material | A jump can replace the first visible item and escape that earlier check |

No smooth-scroll mask, wheel interception, new animation, capture/projection/schema change or persistent diagnostic instrumentation. Existing passage identity and pixel anchors remain the source of reading-position recovery. ResizeObserver still handles late artifact/size changes. Synchronous measurement is restricted to the mounted virtual runs and their existing bounded pins; the whole recording is not mounted or measured.

## Validation and limits

- The retained synthetic regression exercises 180 variable-height source/command/result groups through the production paged reader, alternating delayed responses, 95 small upward wheel inputs and pauses longer than two frames. It also verifies return to latest.
- The corrected regression samples from a task after the rendering step. RAF alone runs before ResizeObserver and can report transient pre-paint geometry as a displayed jump. The test is also checked against the original source to ensure it still rejects the real delayed correction.
- Opt-in actual Drishya, Skeletongraph Codex and Skeletongraph Claude journeys exercise long history and current multi-file Workspace without importing more journals or submitting a native turn. Actual journeys run with motion enabled, rather than suppressing it in the URL.
- Final local results: both type checks, production build and all 441 unit tests across 75 files pass. All 13 selected Edge journeys pass together: delayed-page regression, 6,000-command history/capture-anchor/search/replay, arrival/hover/reduced motion, burst follow, replay clock/camera/paged replay, imported-library search and the three actual-session history/Workspace journeys. The Claude journey also passes twice separately after the late-artifact observer repair.

These are bounded reference-machine checks, not proof of every platform, input device, physical low-resource configuration or ten-minute human reading session. Keep release acceptance open. No hosted CI, private recording content or user-owned package/artwork changes are included.

Next: continue 84's whole-component/skills/Uiverse and palette review, source/base/draft comparison and the selected quiet developer tools in 92. T3 evidence search is delivered by 93; optional Commands and related findings/turn overviews remain planned under Review/navigation, not new permanent canvas panels.
