# GIT-9 · Changes absorbs Git review; the Git icon opens Git graph

Yash, 11 Nov: "remove git review and just keep git graph with the same symbol ... cause changes now does the work." Build record.
Continues [GIT-8](git-8-compare.md).

## What changed

- **Compare is named Changes** wherever a person reads it: the header button, the window title, the palette, tooltips and empty states.
  The module keeps the name `CompareWindow` (it compares), as do the daemon files and routes.
- **The old whole-session view is the Session review.** Two things called Changes would confuse people, so the dialog the palette's
  "Review changes and checks" opens (failures, recorded checks, gaps, each file's edits) is titled *Session review*.
- **Git icon → Git graph.** The header's Git control (same branch glyph) opens Git graph in one click; the popover is gone.
  Opening one of Changes and Git graph puts the other away. The other headers (Classic/Studio/Workbench, archived) get a plain
  "Git graph" button.
- **Git review is removed:** `GitReview.tsx`, its popover (`.git-entry-choices`), `git-review-controls.css`, `collection-surfaces.css`
  and the rules in `stage.css`, `classic.css`, `recovered-surfaces.css`, `hud.css`, `motion.css`, `git-access.css`, `git-history.css`,
  `interaction-polish.css`, `reading-windows.css`, `large-screens.css`, plus the right-docked "Git drawer" placement in
  `ReadingWindow.tsx` that nothing used any more. The daemon class `GitReview` stays: it is the consent and snapshot service Changes uses.
  Palette "Review current Git changes" opens Changes on Uncommitted; "Compare branches or a pull request" opens it on Branch; LinkCard's
  note names Changes; the file peek's "← Git" is "← Changes" (set when a file is read from Changes).

## What moved into Changes

- **Reviewed marks and notes**, on every view. A mark belongs to one exact patch and counts only while its fingerprint equals the
  shown patch's. The window shows a *Reviewed* checkbox and a *Note* in the file header, and `reviewed` / `re-review` beside the file
  in the list (for a file changed on both sides, reviewed means both sides' patches). A changed patch drops its mark and keeps the
  earlier note as "Previous note · changed patch" (reusing it never marks the new patch reviewed). Notes are redacted and stay in this
  browser, never in the session.
- **Fingerprints.** A Git file's own fingerprint is used as before. A comparison file's fingerprint is the pair of blobs its change
  goes from and to (`git diff --raw --no-abbrev`), the same in the list and in the patch, so a mark is checked without reading the patch.
  A GitHub (`gh`) file is fingerprinted by its patch text.
- **Carry-over.** Marks live under the key Git review used (`drishya-git-review-v1:<recording>`), the bare path for the working tree
  and `<base>..<compare>:<side>` / `pr<N>:<side>` for a comparison. A mark Git review stored counts on Uncommitted while its
  fingerprint matches. At most 100 marks are kept per recording, as before.
- **Preview handoff** (options menu): the reviewed patches and their notes as one Markdown packet, read from the repository again
  first (a changed repository blocks it and refreshes), redacted, saved only after a second recheck. The format is Git review's; the first line
  reads "Local Git changes handoff" (it had said "Git review"), and a comparison names its two sides and the merge-base. Patches
  are capped at 1 MiB together; more are named as left out.
- **Also carried over** because Git review had them: 50-path pages, omissions with "Open current file instead", the protected and
  omitted counts, the Staged / Working tree switch (Uncommitted only), the file-reading actions menu in the file header, a failed
  refresh keeps what is shown and says why.

## Moved specs, and what has no counterpart

Moved to Changes: `git-changes` (was `git-review`), `git-changes-controls`, `git-access`, `git-hunk-recorded-work`, `ui-1b-header-git`,
`collection-surfaces`, `dialog-typography`, `file-reading-actions`, `investigation-finishing`, `palette-contrast`, `patch-controls`,
`ship-6a-reading`, `workspace-real-review`, `fresh-workspace`; a new `git-changes-marks` covers marks on a branch comparison,
carry-over, a changed patch and the redacted handoff.

Assertions about Git review's own shell have no counterpart and were dropped or reshaped, not softened: the right-hand drawer's
fold-away file list and its resizable width, the suspended-and-return choreography (Changes covers the stage like the Workspace;
reading a file from it leaves "← Changes"), and the file list's separate height cap (the list fills the window). The generic
reading-window mechanics test (move, resize, remember, reset) now runs on Git graph, which carries the same controls. Phone widths
(390, 320) became 600, the narrowest supported window.
