# Smooth following and visible map navigation — 8 October 2026

The builder reports that the live demo still feels laggy, expects the screen to scroll with live/replay work, cannot see the navbar's translucency or the reference interactions, and explicitly asks to execute the possible next steps from [32](32-reference-ux-local-pass.md). This correction supersedes earlier automatic burst/late-result camera holds and slower motion timing. Changes stay local for visual review.

## Implemented behavior

- **Follow by default:** live and replay keep following across bursts, long prose and late artifacts. The camera eases to the latest edge, retargets as content grows and batches virtualization updates. Deliberate scrolling, selection or navigation still holds the reading position; capture and an active replay continue. The visible Follow switch restores following directly.
- **Compositor motion:** material arrivals take 620–740 ms; hover opens/returns in 360/320 ms; material reflow takes 300 ms. Result growth changes layout once after arrival, then transforms the same real DOM material for 340 ms. Material geometry is remeasured on allocation changes, rather than in a separate loop for every active animation. Captured characters are mounted whole and remain selectable.
- **Connections without React frame churn:** visible recorded-order routes update SVG attributes at a bounded 30 Hz during finite motion; their geometry no longer schedules React renders every frame. The map paints on actual graph/camera/theme/focus changes, preserves its idle state, caches node counts and retains existing spatial detail/edge budgets.
- **Visible translucency:** the previous header had a dark wrapper plus a second dark crown gradient. Removing the inner background leaves one translucent tint (78% at rest, 82% when scrolled). Blur stays confined to the lower 18 px edge and is removed in low-resource mode.
- **Visible reference interactions:** segmented workspace controls, a labelled Follow switch, coloured bars for recent captured action states with a native disclosure menu, static live-demo status, and icon/focus/clear treatments on file search. Search and captured evidence retain their existing semantics. The activity strip is a bounded record-order preview, not a throughput chart.
- **Observed file scope:** All files / Observed filters only actual captured IDs and the static imports between them. Files retain their original graph coordinates. Unresolved IDs do not gain invented nodes.
- **On-demand import paths:** a selected file or a file from the current reading passage exposes direct imports and reverse imports. The overlay and retained list are capped at 64 resolved relations; the list uses pages of 12. Static relationships are explicitly labelled; no causal or execution-path claim is made. Selecting a neighbor navigates its real coordinates, and recorded evidence opens separately.

No capture, store, event schema or native controller protocol changes. No second graph engine, external UI code or new runtime dependency.

## Validation

### Final PR gate — 8 October

After visual review, the builder explicitly requested raising a PR and asking Yash to review, with all CI checks run locally first. The final complete code candidate passed on Windows, Node 24.11.1 / pnpm 10.34.5:

- `pnpm install --frozen-lockfile`: lockfile unchanged.
- `pnpm check`: both typechecks and 289 unit tests across 39 files.
- `pnpm test:browser`: 54 passed, two expected opt-in skips.
- `pnpm package:verify`: isolated offline installation, Claude/Codex imports, demo bundle, authenticated API and persisted restart.
- `pnpm demo:bundle` and its diff check: committed bundle unchanged.
- Fresh final-code ten-minute synthetic reader: **605,196 ms, 103 rounds, 895 peak DOM nodes**. Source references, deliberate reading anchors and explicit return-to-latest held.
- `git diff --check`: passed. Local stores/screenshots/probe output are excluded from the PR. No hosted CI dispatched; Windows evidence does not certify Linux/macOS or physical low-resource release acceptance.

The earlier measurements below remain the development record; the fresh gate above supersedes their partial candidate coverage.

- Local typechecks, production UI build and all **289 unit tests** passed. The first complete browser pass found two issues: a selector needed the new SVG path group, and the long-history journey issued its first wheel while initial follow allocation was still settling. The selector and journey readiness are corrected; document-start reading also explicitly stays at the start across late allocation changes. All ordinary browser journeys passed across the complete pass and focused reruns; real-session and ten-minute probes remain opt-in in the ordinary suite.
- Focused browser coverage includes live bursts/late results, automatic growing-demo follow, independent replay clock while reading, local result scrolling, whole-material arrival/reflow, paged history anchors, map scopes/import navigation, and toolbar controls at 1920, 1440, 1024, 768 and 390 px. The final motion/toolbar/map set passed 34 journeys plus one opt-in skip; B2's four journeys passed after the initial-follow readiness correction.
- **Ten-minute synthetic reading passed:** 604,858 ms, 103 rounds, peak 895 DOM nodes. Captured source remained pinned, detached reading anchors held during new batches, origin motion stayed finite and return-to-latest reached the growing edge. The run started before the final document-start anchor, SSR guard and diff-line CSS cleanup; those changes then passed scoped browser/unit/build checks. The final nine-label reservation shares the existing map budget and was built after the run.

### Short frame and memory probe

One 24-second synthetic growing-demo run per condition at 1440 × 900 on this Windows reference machine. Chrome CPU throttling simulates reduced CPU availability; it does not represent a physical low-resource device. Browser checks were not running during the final frame probes.

| Measurement | Earlier local candidate, 4× CPU | Updated candidate, normal CPU | Updated candidate, 4× CPU |
|---|---:|---:|---:|
| 95th-percentile frame interval | 16.8 ms | 16.7 ms | 16.8 ms |
| 99th-percentile frame interval | 50 ms | 16.8 ms | 16.8 ms |
| Worst frame interval | 183.3 ms | 33.4 ms | 149.9 ms |
| Long tasks / cumulative duration | 11 / 1,307 ms | 1 / 74 ms | 12 / 1,294 ms |
| Frames with following detached automatically | 673 | 0 | 0 |
| Final JavaScript heap (Chrome DevTools counter) | Not measured reliably | 6.37 MB | 6.20 MB |
| Final DOM nodes | Not recorded | 542 | 542 |

The tail of frame intervals improved; occasional main-thread stalls remain under CPU throttling, and cumulative long-task time did not improve in that run. Heap figures describe JavaScript memory, **not total process, canvas/GPU or app RAM**. The sample does not measure a large repository or long-session resident memory. The final document-start anchor/SSR guard and legacy diff-line animation removal followed these measurements and have browser/build coverage. Synthetic evidence does not establish human preference or physical/platform release acceptance.

Map scope retains references to the existing coordinates; direct imports retain at most 64 resolved neighbors, list 12 at a time and share the existing 48-label budget. The backing canvas remains capped at 1.5 DPR (1 in low-resource mode). No animation loop runs just to decorate an idle workspace.
