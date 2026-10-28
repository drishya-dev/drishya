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


## 28 October — whole-task real-session acceptance audit

The original five real-arrival checks above were at 1440 px. They did **not** prove the 600 px case. This follow-up audits the merged implementation against the new AGENTS definition of done, including the actual narrow-window interaction rather than treating the fixture as acceptance.

### Real-case matrix

Each successful row below was checked separately at both widths. A passing Lift requires the target operation's **own real DOM material** to have a `surface-Lift` animation while its new tree-origin path starts within one pixel of the currently measured exact file row's center. The file row is visible before the target arrival. No captured text is copied and no synthetic tool use is appended to these recordings.

| Genuine capture | Material case | 600 px | 1440 px |
| --- | --- | --- | --- |
| Codex `4b5ca5b1` | Edit | Pass | Pass |
| Codex `4b5ca5b1` | Write | Pass | Pass |
| Claude Code `c8e5c9c8` | Native `Read` tool | Pass | Pass |
| Claude Code `c8e5c9c8` | Edit | Pass | Pass |
| Claude Code `c8e5c9c8` | Write | Pass | Pass |
| Codex local inventory | Native `Read` / `read_file` tool | No genuine local case; not claimed | No genuine local case; not claimed |

The Claude capture contains 325 read-class operations: 203 from the native Read tool and 122 classified from shell reads. The matrix's Read row was rerun with **native `Read` only**, not satisfied by relabelling a shell command. The older Codex capture contains no read-class operations. The separate current native inventory found no native Read/read_file case; absence is retained as a harness-availability qualification, not replaced with a synthetic native tool call.

At 600 px, Files is intentionally a dismissible narrow-window pane: focusing or pointer-clicking an outside replay control closes it. The successful tree-origin checks use the normal user path: start ongoing replay, then reopen Files before the selected captured operation arrives. The replay clock advances normally while Files stays visible. No DOM-activated replay button, changed dwell/speed, fabricated journal or modified native configuration was used. Cases with long captured prose were allowed their real playback dwell; an initial short-wait driver was insufficient and was corrected rather than changing product pacing.

### Actual hidden-tree behavior

| Genuine capture | Width | Existing fallback observed |
| --- | --- | --- |
| Codex `4b5ca5b1` | 600 px | Repository node |
| Codex `4b5ca5b1` | 1440 px | Repository node |
| Claude Code `c8e5c9c8` | 1440 px | Tool instrument |
| Claude Code `c8e5c9c8` | 600 px | No eligible visible origin: target material remains visible, with no fabricated tree Lift |

The last case is deliberate truth preservation: Files is closed, the tool station provides no visible instrument and the matching map node is covered by existing material. A geometry-only map-node check initially counted that covered node; applying the production hit-test/occlusion rule excludes it. The target appears normally and there are zero tree-origin cues. The audit does not count a hidden or covered anchor as a successful visible fallback.

### Capture and verification boundary

- Codex capture: 1,530 observations, 542 operations, **44,016,822 imported source-cursor bytes**. The original native journal is no longer present. Actual rendering uses the retained genuine, previously redacted observations in a new ignored scratch home and the current reducer; this is explicitly cached-capture UI acceptance, not a fresh Codex ingest claim.
- Claude capture: 10,466 observations, 2,215 operations, **82,859,509 source-cursor bytes**. The native journal still exists and was freshly imported into a separate scratch Drishya home. Its current operations, timeline and file metadata match the already-redacted browser capture exactly; the comparison emitted only a boolean and counts.
- Ten applicable visible-tree checks plus four hidden-tree checks completed on actual captured operations. The two unavailable Codex native-Read cells are expressly excluded from the pass count.
- Actual screenshots at each width and private bounded drivers stay in ignored `.local/`. No journal contents, paths, titles, screenshots or private drivers are committed or attached to a PR.
- `check:real --list` was inspected; its current cases do not include visible file-origin motion, so this UI-only audit uses private scratch capture/browser checks. There is no production test-runner change in this follow-up.
- This is an acceptance report only: no product source, animation timing, History measurement, hover, schema or harness policy changed. No fresh model turn was needed. No full gate is repeated for this docs-only follow-up; the root's once-per-batch gate remains separate. Existing fixture regression results above remain guards, not substitutes for these real checks.
