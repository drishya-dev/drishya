# CONTENT-1 — image-reader acceptance and unavailable bytes

25 October 2026. PR214. This increment verifies existing image reading and fixes a demonstrated failure state. It does not complete every CONTENT-1 source or alter history layout, typography, capture or the paused PERF-2 area.

## Cause and change

The existing thumbnail and modal render an img without an error handler. A404, network failure or invalid image body therefore leaves a blank/broken image with no explanation. Both now explain that the image could not be loaded. The thumbnail keeps its existing reserved size; the reader offers an explicit Retry image action. There is no polling or automatic remote fetch. Retry adds a cache-busting query to the same recording/hash URL only after a click; server membership, authentication and image identity remain unchanged.

The modal gains an accessible name and exposes actual-size toggle state. Existing fit/actual scrolling, modal focus, keyboard closing, reserved thumbnail dimensions and all styles/motion remain shared and unchanged. Retry uses the existing button treatment.

| Before | After | Why |
|---|---|---|
| Blank thumbnail on failed bytes | Fixed-size explanatory thumbnail; opens the reader | Makes unavailable material explicit without changing card allocation |
| Blank reader on failed bytes | Status message and explicit retry | Recovery is deliberate; no repeated network work or invented expiry reason |
| Modal had no accessible name | Captured image reader name; actual-size pressed state | Gives keyboard/screen-reader users context without extra visible chrome |
| Phone acceptance unverified | Fit/actual, two-axis scrolling, keyboard focus and touch controls checked | Verifies existing behavior rather than changing the visualization |

## Verification

- The baseline fails the new unavailable-byte checks for both harnesses; six fit/actual cases already pass. The assertion is not loosened.
- Twelve new browser cases exercise Codex and Claude captured prompt images at320×640,390×844 and844×390; touch controls, actual-size scroll to the image edges, Escape/Close focus restoration, and failure/retry for404, aborted requests and corrupt200 image bodies. The Codex fixture also contains a remote image URL: zero requests to it.
- Two existing checks cover captured/refused tool-result images and path-only current-image reading with workspace approval. All14 focused browser checks pass.
- Actual Drishya Claude recording: fresh isolated redacted import,1138 observations and11 operations with kept image bytes. Opens/fits/toggles/closes at1440×900,390×844,320×640 and844×390; focus returns to the invoking thumbnail. The390px frame was visually inspected. The native journal is read-only. Real frames/store remain ignored local artifacts; no captured text, image or journal is committed.
-785 integrated unit tests, both project TypeScript checks and production UI build pass. No hosted CI, native prompt, harness setting or dependency change.

## Remaining acceptance and merge gate

CONTENT-1 remains open. A genuine typed Codex ImageView sample has not been established; the supported Codex data-image path is covered synthetically here and its prior real acceptance remains in TASKS. Do not relabel this as ImageView acceptance. Broader source/limit/protected/missing/current-file permutations and physical-phone acceptance remain distinct from viewport/touch emulation. Browser-strip grouping belongs to CONTENT-2.

The existing TEST-2 reading-position regression was reproduced on main before this work (b2-live:186). The builder explicitly asked to leave that History/PERF-2 area paused. No History, scroll-anchor, shared typography CSS, test assertion for that bug or performance decision was changed. This PR is ready for focused review; a clean whole-browser merge gate cannot be claimed while the independent regression remains. Do not auto-merge through it.
