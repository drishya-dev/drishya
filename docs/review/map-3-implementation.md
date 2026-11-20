# MAP-3 implementation checklist

Base: origin/main 30c83c9f. Issue #551. No additional agents/sessions.

- [x] Inspect current running product, fixed synthetic demo, 1440x900, motion=0, headless Chromium; baseline 3000 ms: TaskDuration 0.963 ms, ScriptDuration 0.090 ms, layouts 0, recalc 0. Screenshot in ignored .local/map-3/before.png. This is a static-scene baseline, not orbit acceptance.
- [x] Reserve exact sections in #551 and #552; #549 remains open, no MapCanvas overlap. STORE-1 owns its Settings mount.
- [x] map-detail.ts: consume scene.heat; active first, descending heat, path tie-break, cap three, threshold 0.04 for inactive entries; resolve only existing indexed nodes. No second history or clock.
- [x] map-labels.ts: reuse measured label rectangles, bounded four placements around true node; reject all protected UI/labels; suppress when cramped.
- [x] MapCanvas.tsx: static semantic point paint through both existing renderers; DOM chips use FileIcon and basename, original indexed coordinates. Hide in Explore (its labels own that mode). Protect history column/rail, dock, header, composer, reader/dialog and Files. Event/resize-driven geometry, no idle polling.
- [x] map tests: selection/order/empty/unresolved, long filename and rectangle non-overlap; browser actual protected-rectangle assertions at 600/1440.
- [x] Genuine Claude/Codex live/replay selection and occupied-layout suppression at both widths; targeted checks and reproducible static/orbit measurement (details below).
- [ ] Independent maintainer review and assessment of full-gate uncertainty; visible genuine-session chip and physical resource/dense-map acceptance remain unproven.

Ruling: retain existing heat rank rather than call it a literal last-three chronological list. Scene heat is step-derived and already drives live/replay; threshold/cap are presentation bounds. Cost if wrong: a frequently touched file can outrank a newer isolated read; chips describe activity, never chronology.

UI-40 follows on its own branch and PR. Final palette selection remains awaiting Yash approval until actually received.

## Evidence, 19 November 2026

- Targeted initial map browser batch: 8 passed, 1 worker. Added non-vacuous visible-chip test subsequently passes; a later batch timed out on existing Home session-open navigation at its first test (6 passed / 1 failed), rerun under investigation.
- `check:affected`: typecheck and related units passed; browser 258 passed / 2 skipped / 1 failed at default 4 workers, Toolbox Escape focus at 600px. This matches the documented known-on-hosted case but is not yet certified a clean-main reproduction for this task.
- Real-case scan cap 12 MB: Claude 39 qualifying sessions / 2059 native hits (5 larger skipped), Codex 16 qualifying sessions / 161 hits (7 larger skipped; active journal counts can grow).
- Scratch-import selection check: `rec_50c3031b`, 7,879,647 bytes, 278 operations, 10 captured files, 99 write/edit operations; 4/4 mapped-file boundaries agree, 3 selected locations across samples. `rec_674a4957`, 4,624,942 bytes at screen check, 657 operations, 20 files, 51 write/edit operations; 4/4 boundaries agree, 5 selected locations across samples. No recording text printed.
- Running genuine-session screen checks: each recording at 600/1440, history and explicit replay; eight frames, zero overlaps. All eight occupied layouts suppress chips. Private screenshots remain ignored in `.local/map-3/`; this is suppression coverage, not proof of visible genuine-session chips. The synthetic free-gutter journey proves one chip mounts with its real file-type icon and is suppressed at 600.
- Same synthetic static idle scene after: 3000 ms, TaskDuration 0.787 ms, ScriptDuration 0.104 ms, layouts 0, style recalculations 0. Baseline 0.963/0.090 ms, layouts/recalc 0. Single samples are noise-limited; no exact zero-overhead claim. Existing orbit behavior is unchanged; separate physical resource/performance acceptance remains open.
- Full batch gate, final reviewer and final acceptance remain open. Author review only; no subagents per request.

### 20 November focused rerun

The first-map-test timeout occurred in Home's dynamically refreshed session entry, before entering the map. The map fixture now retains its imported recording ID and opens that known route after authenticated Home boot. No overlap, geometry or interaction assertion changed. Fresh rebuild plus `map-quiet`, `map-fit`, `workspace-map-limit`: **9 passed, 1 worker**. Six map unit files remain **30 passed**. Diff whitespace was normalized. Full batch validation follows on a separate local verification branch with UI-40; PR #555 stays focused. Independent maintainer review requested from `yashdoke7`.

### Foreground and filename regression fixes

A visible-chip test reproduced an open-menu protection gap, then reproduced a two-pixel short-filename clip after the menu fix. Both are fixed: menus/popovers join occlusion handling, foreground menus suppress chips, borders are included in measurement. Position changes use compositor transforms rather than left/top movement. Fresh typecheck, 30 map units and 9 map browser checks passed (one worker). These changes follow the frozen full-gate head and are covered by their targeted rerun, not claimed as part of its earlier results.

### Reproducible idle and intentional-orbit measurement (20 November)

Host: i7-13650HX, 14 cores / 20 logical processors; Node 24.11.1; headless Chromium 153.0.8010.12; 1440x900; synthetic demo with 14 base vertices; spatial-3d confirmed. Same scene/palette and browser flags before/after; three two-second windows after settling for each mode. Baseline is the palette-only branch (4ecafd2a), after is MAP-3 (10db1f29). This is a small occupied scene with zero visible chips; the free-gutter browser case verifies visible-chip geometry separately. No dense-map or physical-GPU release claim.

| Mode / metric | Baseline median | MAP-3 median |
|---|---:|---:|
| Static: RAF / renders / layouts / style recalculations | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Static: browser task / script ms per 2s | 0.707 / 0.029 | 1.267 / 0.033 |
| Intentional orbit: browser task / script ms per 2s | 816.473 / 30.909 | 802.507 / 34.048 |
| Orbit: renders per 2s | 27 | 27 |
| Orbit: point draws per render | 1 | 4 |

Static idle adds no callbacks or rendering work in these samples. Orbit script time increases about 0.12 ms per rendered frame; highlights add three bounded point draws in the existing render, without a new loop. Task-time samples overlap; do not call this exact zero overhead. Hidden-tab/reduced-motion/static/low-resource guards remain the existing owners. Physical resource/dense-map acceptance and independent review remain open.

### Frozen gate and final controls

The frozen combined verification tree was local `65543544` (UI-40 through `4ecafd2a`, plus MAP-3 `d1c8e52e`/`8e3f6d71`). Typecheck and build passed. Package/offline CLI verification passed; security 700 passed / 5 skipped. Browser: 959 passed / 27 skipped / 8 failed with 3 workers; serial: 66 passed / 1 skipped with 1 worker. Units: 1894 passed / 1 skipped / 7 failed, with five-second Git/checkout/server timeouts and temporary cleanup EPERM reports.

Three browser failures pinned colours intentionally changed by UI-40 and were corrected in its PR. Of the other five, the Toolbox focus assertion reproduced on clean `30c83c9f` and passed when rerun alone; this is a recorded baseline flake. The other selected browser controls passed on clean main. All six affected daemon suites passed 94/94 on clean main and 94/94 on the final combined branch with one worker; all 10 selected browser control journeys passed on the final combined branch with one worker. The full-run unit failure causes and other non-reproducing browser failures are not established. Do not call the full gate green or quietly discard these results.

Final combined typecheck and 35 focused map/palette units passed. The later menu/measurement/transform corrections passed 30 map units and 9 map browser journeys separately. No second full gate was run to obtain green. Maintainer review must assess the remaining gate uncertainty before merge; independent review is still pending.

### Test-outcome truth guard

The composer's heat tone `pass` is a default for non-error test activity, including unreported outcomes; it is not sufficient evidence of a confirmed pass. The map now paints that tone as generic **test activity** using existing focus ink, while retaining explicit failure styling. This is presentation-only: no composer, capture, schema or working-set change. The new regression was watched fail before implementation. Fresh map typecheck, **31 units and 9 browser journeys passed** with one browser worker. Earlier recorded counts apply to their stated revisions.

### Final measurement and handoff

The same three-window probe completed on `3d1d6dfd` after the truth guard. Static medians: task 1.130 ms, script 0.033 ms per two seconds; zero RAF callbacks, renders, layouts and style recalculations in every static window. Intentional orbit: task 375.938 ms, script 19.748 ms; 26–27 renders and four point draws per render. The desktop update separated this run from the earlier paired measurements, so the lower task/script times are not attributed to the change. The repeat corroborates bounded rendering and idle counters only. Raw probes remain ignored in `.local/map-3/`.

Draft #555 contains the implementation and evidence. Next action: independent maintainer review of placement, the heat-rank ruling and measured cost, plus assessment of the recorded full-gate failures. The task remains open for that review and the explicitly unproven acceptance above; no merge or publication is authorized by this handoff.
