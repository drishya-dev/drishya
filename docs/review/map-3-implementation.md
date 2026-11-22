# MAP-3 implementation checklist

Base: origin/main 30c83c9f. Issue #551. Original implementation used no additional agents; the user explicitly authorized one fixer agent for the 21 November resource investigation.

Current status after the resumed acceptance pass: visible genuine-session chips, keyboard/screen-reader exposure and resource preference guards are verified. A 5,000-file bulk-update probe produced one 525.2 MiB daemon RSS peak against the documented 512 MiB normal-workload ceiling. Resource acceptance is therefore **not certified**; this and the original full-gate uncertainty remain open before merge. The passing probes below do not override that outlier.

21 November follow-up: confirmed restoration/focus races and discovery allocation/fixture-isolation defects are repaired; typecheck and 314 affected units pass. **Host-discovery aggregate RSS still exceeds 512 MiB in two of three final runs (497.9 / 532.0 / 536.5 MiB), at app shutdown.** The isolated synthetic runs are not substituted for this acceptance. See [the factor register, red/green evidence and matched comparisons](map-3-performance-investigation.md).

- [x] Inspect current running product, fixed synthetic demo, 1440x900, motion=0, headless Chromium; baseline 3000 ms: TaskDuration 0.963 ms, ScriptDuration 0.090 ms, layouts 0, recalc 0. Screenshot in ignored .local/map-3/before.png. This is a static-scene baseline, not orbit acceptance.
- [x] Reserve exact sections in #551 and #552; #549 remains open, no MapCanvas overlap. STORE-1 owns its Settings mount.
- [x] map-detail.ts: consume scene.heat; active first, descending heat, path tie-break, cap three, threshold 0.04 for inactive entries; resolve only existing indexed nodes. No second history or clock.
- [x] map-labels.ts: reuse measured label rectangles, bounded four placements around true node; reject all protected UI/labels; suppress when cramped.
- [x] MapCanvas.tsx: static semantic point paint through both existing renderers; DOM chips use FileIcon and basename, original indexed coordinates. Hide in Explore (its labels own that mode). Protect history column/rail, dock, header, composer, reader/dialog and Files. Event/resize-driven geometry, no idle polling.
- [x] map tests: selection/order/empty/unresolved, long filename and rectangle non-overlap; browser actual protected-rectangle assertions at 600/1440.
- [x] Genuine Claude/Codex live/replay selection and occupied-layout suppression at both widths; targeted checks and reproducible static/orbit measurement (details below).
- [x] Visible genuine-session chips, icon/accessibility checks and supported narrow-window suppression; reduced-motion, visibility-event, explicit-static and low-resource guards.
- [ ] Independent maintainer review and assessment of full-gate uncertainty; dense resource acceptance remains unproven after a measured RSS ceiling exceedance. Physical 8 GiB/integrated-GPU certification is a separate standing project release check, not a new MAP-3 requirement.

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

### Resumed technical acceptance, 20 November

The previous handoff stopped too early on checks that could be performed here. A new role-based regression reproduced a real accessibility defect: the map's inherited `aria-hidden` hid visible activity buttons. Commit `7ee9d00f` exposes the map when activity chips exist, and verifies keyboard focus, Enter opening captured file work and Escape returning to the map. UI typecheck and 31 map units passed; the nine map browser journeys passed at one worker. A separate resource-guard regression (`8e7c8d87`) passed at one worker: real reduced-motion emulation, a simulated document-visibility event boundary, the explicit static preference, low-resource map removal and explicitly re-enabled flat fallback. The initial guard verifier omitted navigation to the Reading tab; correcting that navigation required no product change or weaker assertion.

**Visible genuine-session evidence:** scratch imports selected for actual current heat, rather than only total read/edit count. Claude `rec_4cb0f629`, 6,284,629 bytes / 291 operations / 119 captured files, with two locations resolved into its primary map; Codex `rec_366115a4`, 6,155,595 bytes / 177 operations / seven files and seven map nodes. No graph response, coordinate, heat or journal was modified. With ordinary Files-pane hiding and the supported flat-map preference, both show an accessible filename/type chip in live history and sampled replay at 1440 px. Across 16 private frames (live plus three replay samples, both widths, both harnesses), seven wide frames have a visible chip, each with its icon/accessibility exposure; all 16 have zero protected-UI overlaps. All eight 600 px frames suppress chips. One Codex wide replay sample also correctly suppresses them. Default spatial-mode suppression was checked separately in the earlier survey; these new visible frames are specifically flat-mode acceptance. Images and detailed counts remain ignored under `.local/map-3/`.

**Additional clean-main controls:** on exact `30c83c9f`, the six original failing daemon suites passed 94/94 with six workers; MAP-3 passed the same 94/94 with six workers. This does not reproduce or establish the cause of the original full-run unit failures. At three browser workers, the selected original five failure cases produced seven passes / one failure on clean main: the exact 600x720 nested-checkout Explore control failure reproduced. It passed alone with one worker. This is a second demonstrated baseline flake, alongside the previously recorded Toolbox focus flake. MAP-3 passed all eight selected journeys at three workers. The remaining original command/timeline/minimize failures did not reproduce; their causes remain unconfirmed. No full gate was repeated and no assertion, timeout or tolerance was loosened.

**5,000-file resource diagnostics:** the existing invented 10,101-observation workload, five 200-record appends, 1440x900, reduced motion and map enabled. A private copy of `bench-browser.ts` opens the known imported recording route to avoid the previously diagnosed Home-row race; all bounded file-spine/action-list and no-loss assertions are retained. Single runs with five bursts are not five independent repetitions.

| Probe | Append-to-counter p95 ms | Peak daemon RSS MiB |
|---|---:|---:|
| Clean main, first isolated run | 265.0 | 447.4 |
| MAP-3, first isolated run | 913.8 | 509.3 |
| MAP-3, isolated repeat | 873.2 | **525.2** |
| Clean main, isolated repeat | 1,021.2 | 452.6 |
| Clean main, API-count diagnostic | 1,204.3 | 494.1 |
| MAP-3, API-count diagnostic | 836.1 | 482.6 |

An earlier MAP-3 run overlapped a guard test and is excluded from this comparison. Broad latency variation reproduces on clean main. The API-count diagnostics each made four graph and 36 file-roots requests, with nine vs eight history requests (main vs MAP-3); artifact requests varied 451 vs 510 and mounted DOM varied, so the counter latch does not prove all material was identically settled. The backend/package sources are unchanged. This does **not** establish the cause of the RSS outlier or rule out an indirect UI contribution. The 525.2 MiB sample is not discarded because a later run passed. Next technical action is a controlled memory/profile trace across the bulk-render/append boundary before certifying this workload; independent review remains required. Do not report the dense resource gate or full gate green.

The final small-scene static/orbit repeat on `8e7c8d87` again recorded zero static RAF/render/layout/style-recalculation work in all three two-second windows (median task/script 1.009/0.037 ms). Orbit remained 26–27 renders per window and four point draws per render (median task/script 863.999/35.438 ms). This closes the final-revision idle counter check; it does not certify the separate dense-memory workload.

### 21 November repair validation

The complete cause register and matched samples are in [the performance investigation](map-3-performance-investigation.md). Confirmed repairs cover deliberately changed state surviving a late session open, tool-trail arrival yielding focus to newer input, synthetic discovery isolation, independent bounded discovery-title storage, file-sized discovery buffers, and clearing content-layout fixtures' saved expansion. Each demonstrated defect had a failing controlled regression or allocation probe before its fix. No production checkpoint, observer, schema or privacy-policy change was made.

Final monorepo typecheck passed; affected capture/adapter/ingest/restore/server/checkpoint/lineage/ownership units: **314 passed / 31 files, four workers**. Focus/Toolbox/tool-trail/keyboard browser batch: **19 passed / one existing opt-in real-session skip, three workers**. Original-case/map batch: **16 passed / one command-card failure, three workers**; the recovery-isolation regression then reproduced that failure path and the full card-content suite passed **13/13**, configured three workers (one file worker). The original failure is preserved in the investigation. Package/offline import/export/auth/restart verification passed; security **700 passed / five existing skips**. The full gate and host-discovery resource ceiling remain **not certified**. No later pass replaces a failing sample, and independent review remains required.

### 22 November: memory acceptance and review readiness

The normal host-discovery ceiling is now verified on five complete independent runs: **485.090 / 464.105 / 495.707 / 430.020 / 468.078 MiB**, all below the unchanged 512 MiB ceiling, including driver, workers and teardown. Exact burst/final observation counts and bounded file/action lists hold. The confirmed allocation-lifetime repair isolates stock discovery's transient JSON/strings and reduces checkpoint SQLite copies with lossless compression; **12,640,074 → 1,193,499 bytes**, exact round-trip, legacy resume and compressed restart/append parity. Antigravity ownership and captured/event/store schemas remain intact. [Full attribution, intermediate failures and qualifications](map-3-performance-investigation.md#22-november-allocation-ownership-and-repair).

Final genuine visible-chip recheck: the same Claude `rec_4cb0f629` and Codex `rec_366115a4` cases above, 16 live/replay frames at 600/1440; seven wide visible-chip frames, eight narrow suppressed frames, zero overlaps, icon/name/accessibility counts equal. Fresh `map-activity` scratch imports also passed both harnesses' four live/replay selection samples: Claude `rec_50c3031b` (7,879,647 bytes, 278 operations, ten files), Codex `rec_085177af` (5,851,822 bytes, 630 operations, 18 files). Private images stay local. UI implementation is unchanged from the recorded idle/resource-guard verification.

Final typecheck/build/package and security **700 passed / five existing skips**. The full browser run recorded **962 passed / four failed / 27 skipped at three workers**, then **63 passed / three failed / one skipped at one worker**. Two geometry-measurement defects had controlled failures then strict same-frame/click-time fixes; three original desktop cases and both controlled cases pass. Remaining search/reading failures reproduce on clean main; the repair's three reading cases pass alone. Full units after test-home isolation: **1,925 passed / four Git deadlines / one skipped, default 19 workers**; clean-main controls reproduce the same Git suites/classes and three exact cases, with the fourth exact load trigger unestablished. Eight affected suites pass 87/87 alone on each branch; final Git/helper checks 18/18. Complete results and limitations remain in the linked investigation. No whole-gate-green claim, loosened assertion/deadline or hidden retry.

MAP-3's issue acceptance and measured normal-memory requirement are ready for maintainer review. Independent code review covered lifecycle, fidelity and test corrections; maintainer product review remains the next action before any merge. UI-40 remains separate and still awaits Yash's palette decision.
