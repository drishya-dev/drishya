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

Real Claude Code/Codex acceptance is **NOT VERIFIED** until P6. The full gate remains scheduled once after Tasks 0–3. FILES-8 stays open and its PR stays draft pending those steps.
