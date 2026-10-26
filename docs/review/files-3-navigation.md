# FILES-3 — clear destinations and a reversible file-reading route

26 October 2026, PR #233. Completes FILES-3 navigation scope; broader reader presentation, native writes and joined native correction remain FILES-4 / REVIEW-4 / NATIVE-*.

| Before | After | Why |
| --- | --- | --- |
| Opening a beside-agent current file in Workspace erased its selected reader path. Back to agent lost the reader. | Workspace temporarily owns the screen while the selected path/tab remains; Back restores the same current file. | Moving into full reading should not discard the location the developer came from. |
| General Workspace entry discarded an open current-file selection too. | Modern entry carries that selected file into the existing Workspace file route. No reader renders underneath Workspace. | The same destination should preserve the same file regardless of entry button. |
| Navigation names needed knowledge of the product's modes. | Existing Files, Repository, Workspace, reader-to-Workspace and Back controls have one-line purpose hints; offline/replay/combined-session limitations are explicit. | Clarify destinations without extra resident controls or another panel. |

## Verification

- Desktop browser regression fails before the source fix specifically when returning from Workspace: the file reader is absent. The new desktop/390 px journeys now pass through approval → Files → current reader → Workspace → Back → Repository → Files → captured work → current disk reading. They preserve the selected tab and literal current/captured distinction, leave disk bytes unchanged, and verify that explicitly closing a reader does not resurrect it on later Workspace exit.
- Ten focused browser checks pass, covering those two journeys plus existing keyboard navigation, capped-map reading, compact source controls, Legacy source behavior, Follow/scroll, map navigation and responsive toolbar behavior. After main #229 integration, five final navigation/recovery cases pass. No assertions in the paused History area changed.
- Four actual Drishya journeys pass: Codex recording with 2,490 observations and Claude with 798, each at 1440/390 px. Current captured-listed files open in Workspace and return to the same reader; desktop general Workspace entry also keeps the selected file. Disk bytes unchanged, zero page errors; Claude phone frame inspected. No native prompt submitted; raw sources/screenshots remain local.
- Actual diagnostics first used a root README omitted by the known bounded map, then an old AgentGuard recording whose captured worktree paths are no longer eligible current paths. Those are not evidence of a working navigation route. Final checks use current files actually present in the Drishya recordings' Files list. Fresh approval is awaited before opening current data; pending approval correctly exposes captured work instead. The separate current-tree/map-cap acceptance is not closed here.
- The old retained Codex journal is missing on disk, so optional native-segment lookup logs ENOENT; captured/current-file navigation still works. This remains the existing NATIVE-1 missing-journal follow-up; native continuation is not claimed.
- On current main including #229 and #231: **855 whole units /151 files**, both TypeScript projects and production build pass. Targeted local checks only; no hosted CI or full browser gate.

## Boundaries

The selected path uses existing session state and the existing bounded tab/reading memory; no new persistence or content copy. No new buttons, CSS, motion, native-control, schema, daemon or permission changes. Installed emil-design-eng guidance informs clear destinations, reversible interaction and restrained chrome; existing modal/reader transitions remain shared. No FileHistory/file-timeline changes (READ-8 belongs to Claude), and no History/common/history libraries/worker/PERF-2/3 changes. Physical/human acceptance remains REL-2/3. FILES-3 is complete for its navigation scope, not a claim that the entire product or all native workflows are complete.
