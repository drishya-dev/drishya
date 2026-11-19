# MAP-3 implementation checklist

Base: origin/main 30c83c9f. Issue #551. No additional agents/sessions.

- [x] Inspect current running product, fixed synthetic demo, 1440x900, motion=0, headless Chromium; baseline 3000 ms: TaskDuration 0.963 ms, ScriptDuration 0.090 ms, layouts 0, recalc 0. Screenshot in ignored .local/map-3/before.png. This is a static-scene baseline, not orbit acceptance.
- [x] Reserve exact sections in #551 and #552; #549 remains open, no MapCanvas overlap. STORE-1 owns its Settings mount.
- [ ] map-detail.ts: consume scene.heat; active first, descending heat, path tie-break, cap three, threshold 0.04 for inactive entries; resolve only existing indexed nodes. No second history or clock.
- [ ] map-labels.ts: reuse measured label rectangles, bounded four placements around true node; reject all protected UI/labels; suppress when cramped.
- [ ] MapCanvas.tsx: static semantic point paint through both existing renderers; DOM chips use FileIcon and basename, original indexed coordinates. Hide in Explore (its labels own that mode). Protect history column/rail, dock, header, composer, reader/dialog and Files. Event/resize-driven geometry, no idle polling.
- [ ] map tests: selection/order/empty/unresolved, long filename and rectangle non-overlap; browser actual protected-rectangle assertions at 600/1440.
- [ ] Real harness acceptance live/replay, resource settings, before/after measured idle cost, targeted checks, task review.

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
