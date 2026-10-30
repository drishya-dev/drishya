# FILES-8 Workspace routing

The scope and acceptance live in [TASKS, FILES-8](../TASKS.md#files--explorer-peek-and-workspace). This report records evidence for that item; it is not another work queue.

While Workspace is open, choosing a file in Files must open it in the selected Workspace pane, otherwise the first empty pane, otherwise a new tab. The eight-tab limit and existing draft behavior must hold. With Workspace closed, Files must continue opening the adjacent reader. The unexpected pane-selection instruction must disappear without adding a resident control.

Acceptance covers Files click and keyboard Enter at 600 and 1440 px, the selected destination with two panes, return to the adjacent reader after closing Workspace, and unchanged live/replay behavior. It requires a browser regression plus fixture and genuine Claude Code/Codex acceptance, with private evidence kept local and only session prefixes, sizes and counts reported.

## Cause and bounded change — 29 October

The ordinary current-file route already chooses Workspace before peek (`apps/ui/src/components/SessionWorkspace.tsx:278–279`). Its event listener adds a tab, enforces the eight-file limit and assigns the selected pane (`apps/ui/src/components/DeveloperWorkspace.tsx:49–66`). The initial selection is pane 0 (`:39`), so the first file does not require a separate pane-selection action. Closing a tab preserves its draft (`:81`). The recorded main-root alias branch at `SessionWorkspace.tsx:277` is separate FILES-7 scope.

The remaining confusing instruction was the empty-pane sentence at `DeveloperWorkspace.tsx:125`. It now says “Choose a file from Files to open it here.” Pane selection, file routing, tab limits and draft ownership are unchanged. The required Emil skill was unavailable; Harsh explicitly approved the installed `redesign-existing-projects` substitute. Its focused audit/fix workflow is applied within the repository's creative doctrine and this task's scope; there is no new control, styling or animation.

## Fixture regression and working checks

`tests/browser/files-workspace-routing.spec.ts` exercises the actual daemon, current-file API and rebuilt Modern UI at 600 and 1440 px:

- Line 52: Files click opens the initially empty Workspace without selecting a pane; Enter opens the selected second pane; closing Workspace restores peek. Every open-Workspace step asserts zero peek readers.
- Line 90: a closed-tab local draft reopens intact; eight files open, the ninth is refused, and the fixture source on disk remains unchanged.
- Line 114: a synthetic native append is captured while Workspace reads a file; returning to history shows it, explicit replay remains available, and exiting replay restores live history.

`pnpm check:affected` passed both typechecks, found no related unit files and rebuilt the UI. Its browser plan mapped this new spec and `fresh-workspace.spec.ts`: the initial run had 77 passes and one failure in the new 600 px setup. That setup tried to locate the deliberately hidden inactive pane by its accessible region before switching back to it. The setup now uses the existing pane switch before the unchanged preservation assertion. All 74 existing cases passed; none of their assertions or setup was edited.

After that setup correction and adding live/replay coverage, `pnpm exec playwright test tests/browser/files-workspace-routing.spec.ts --project=parallel --workers=1` passed all six cases in 11.7 seconds with the installed Edge browser. The initial affected command remains a recorded nonzero run; it is not described as fully green. `TEMP` and `TMP` were set to the required local temporary directory before checks. An initial restricted-network Corepack attempt did not run checks; the authorized elevated commands ran the recorded results.

## Genuine-session acceptance — 30 October

`pnpm check:real -- workspace-files --max-mb 10` passes the new file-reference case in `scripts/real-cases/workspace-files.ts`. The final scan found 34 Claude sessions with 1,590 matching native calls and 13 Codex sessions with 60 matching calls; seven Claude and four Codex journals over the explicit 10 MB cap were skipped. Its selected imports have 119 and six captured file references respectively. The case requires imported references and explicitly leaves current availability to separate approved reading; a shell call alone is not proof of a usable file.

The ignored `.local/files-8-native-acceptance.ts` probe then copied stable genuine sources unchanged into a scratch home. It used the existing graph approval and current-reader consent, with no root remapping or relaxed protected-path checks. Physical existence alone was insufficient: the selected Claude source has two recorded paths accepted by the current reader, and the Codex source has four. Each also supplies at least nine ordinary readable files in its already approved graph for tab-limit acceptance. Those additional current files are not claimed as historically captured content.

| Scratch recording prefix | Harness | Native bytes | Observations | Captured file references | Desktop widths |
|---|---|---:|---:|---:|---|
| `rec_164fc025` | Claude Code | 4,103,693 | 1,415 | 101 | 600, 1440 px |
| `rec_8c413cdd` | Codex | 2,314,474 | 903 | 6 | 600, 1440 px |

All four actual API-backed frames pass Files click into initially empty Workspace, Enter into the selected second pane, retained first-pane content, closed-tab draft recovery, the eight-tab limit and refusal of a ninth tab, and Files-to-peek after closing Workspace. Every open-Workspace step has zero peek readers. Resyncing each unchanged scratch journal preserves its observation count. There are zero page errors, and the SHA-256 digest of every native source copied for the probe is unchanged afterward. Private diagnostics and screenshots remain ignored in `.local/`; no journal content, titles, prompts or source paths are included here.

Workspace is deliberately history-only (`DeveloperWorkspace.tsx:77`), so this does not claim Workspace selection during replay. In each genuine frame, explicit replay instead continues advancing while Files opens the adjacent current-file reader, and keyboard Exit replay restores history. The pointer Exit replay control was covered by the open reader at 1440 px in an earlier diagnostic run; the final check uses its normal keyboard Enter action. This confirms continued playback and keyboard exit, not unobscured pointer transport. The fixture separately proves a native-format append is captured while Workspace is open; genuine-source acceptance uses unchanged copies and stable resync, not fabricated native appends.

The interrupted diagnostic setup also assumed each viewport began with no retained tabs. The final probe closes retained tabs and resets the existing layout through normal UI actions before each frame. Replay is explicitly paused and sought before the active-playback assertion because entry may already be playing. These are ignored diagnostic setup corrections; no existing test assertion or product behavior changed.

After the new case and registry changes, `pnpm check:affected --base b19f3fc` passes both typechecks; it selects no related units or browser specs for that script-only diff. `git diff --check` and the task-table check pass. No ingest, store or packaging change was made for FILES-8, so additional package verification is not applicable. The full gate remains scheduled once after Tasks 0–3. FILES-8 stays open and PR #296 stays draft until P7 completes its task/claim/PR bookkeeping.
