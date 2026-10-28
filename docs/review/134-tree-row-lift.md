# MOTION-2 — Lift from the visible Files row

Read, Edit and Write material now starts at the exact file row in the visible Files tree when that row is genuinely visible. It takes priority over the aesthetic repository map. If the tree is closed, its folder collapsed, the virtual row absent, or the row hidden, clipped, offscreen or occluded, the existing map/instrument fallback remains in control. No folder is opened and no tree is scrolled merely to create an animation origin.

The helper compares the exact captured path against `data-spine-path`, measures in the arrival frame, checks viewport and all overflow-clipping ancestors, rejects hidden/zero-opacity ancestors, and hit-tests the row's leading icon and filename area. It keeps no row cache, so virtualization and fast tree scrolling cannot reuse a stale origin.

## Motion review

Applied installed `emil-design-eng`, `animate` and `review-animations` skills. The existing live request/result browser journey was inspected and passed before changing the source.

| Before | After | Why |
| --- | --- | --- |
| A visible map node takes precedence over an open file row | The visible exact Files row takes precedence for Read/Edit/Write | Material comes from the developer's visible file, rather than an aesthetic node behind the work |
| Tree fallback checks only part of its clipping geometry | Viewport, actual clipping ancestors, computed visibility and row hit tests | Overscan, resized scrollers and covered readers are not visible origins |
| Tree-origin tethers identify themselves as a generic file reference | Tethers identify `File tree row` / `tree` renderer | Tests and diagnostics can verify the true origin without inferring it from coordinates |

**Approve for this bounded origin change.** The purpose is spatial consistency on meaningful material arrivals. The implementation changes origin resolution only: the existing WAAPI whole-material transform, curve, duration, single real selectable DOM, finite origin marks, late-read availability cue, cancellation, replay/follow behavior and reduced-motion/resource behavior remain intact. Existing slower material-arrival timing is a recorded builder decision; this task does not retune it or introduce UI delay. No extra captured text or new looping effect is rendered.

## Verification

- Three pure bounds tests pass: visible/boundary rows, clipping on all four sides, zero-sized rows and current scroller bounds.
- Eight dedicated Edge browser checks pass: exact paths (including quotes), hidden/transparent ancestors, overlay occlusion, repeated tree scrolling, detached rows; Read/Edit/Write each prefers the tree even with an eligible map anchor; hidden, covered, clipped and user-closed Files each fall back to the map. The origin path starts at the measured row center; no duplicate material/transfer nodes are created.
- The new Read-priority browser check was deliberately run against the old `Origins.tsx`: it failed because it observed `Repository node` / `world`, proving that the new check detects the old priority. The source was restored and rebuilt afterward.
- The existing measured-renderer fallback test passes with only its two old `File reference` selectors intentionally renamed to `File tree row`; geometry, timing and thresholds are unchanged. Existing request-before-result, delayed-read and reduced-motion browser checks pass.
- Both TypeScript projects and the production UI build pass. No hosted CI was run.
- Real Codex `4b5ca5b1`: 1,530 observations and 542 operations; actual Edit and Write arrivals each emitted one tree Lift. This older sample contains no eligible typed relative-path Read; a Codex Read is not claimed verified on that sample.
- Real Claude Code `c8e5c9c8`: 10,466 observations and 2,215 operations; actual Read, Edit and Write arrivals each emitted one tree Lift. The smaller Claude `024517cd` sample was also inspected but did not provide an exercisable relative-path row, so it was replaced with the larger relevant session rather than counted as acceptance.
- Actual replay was stepped through existing captured operations, without new harness/model calls, modifying native journals or writing project files. The material was already present in the stored redacted recording. Real screenshots and working captures remain ignored under `.local/`; no captured paths, titles or content are committed.

The broader ten-minute motion evaluation and History wheel/anchor work remain their own owners. This change does not claim to complete those tasks or physical lower-resource acceptance.
