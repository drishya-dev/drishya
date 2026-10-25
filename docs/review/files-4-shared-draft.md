# FILES-4 — shared draft editor correctness

25 October 2026, PR #226. Fixes existing Workspace editing behavior; this is not a new editor feature or completion of the whole FILES-4 review.

| Before | After | Why |
| --- | --- | --- |
| The same retained draft could be open in both panes, but each CodeMirror view ignored later shared text updates. Typing in the stale pane could replace newer work. | A changed shared draft maps one minimal transaction into the existing editor. An annotation suppresses the return callback and excludes synchronization from local undo history. | Both views must edit the same draft without an update loop or accidental data loss. |
| Recreating or replacing the whole editor would disrupt selection, undo and hidden comparison state. | The real editor stays mounted. Common prefix/suffix boundaries preserve position mapping; unchanged locally emitted text skips synchronization entirely. | Keep reading/input stable and avoid an extra parse on each local keystroke. |

No source is written to disk by the UI. Local drafts remain volatile unless the user explicitly saves through existing recovery. No native prompt is submitted, no permissions/configuration are changed, and no History, PERF-2, motion, capture, schema, dependency or CSS source changes.

## Reproduction and verification

The original browser reproduction opened one file in both panes, changed the first draft and asserted that the second contained the new text. Unchanged main failed: the second view still held the earlier draft. The final regression follows actual file selection, split-view, edit, comparison and download controls.

- Four new browser cases: LF/CRLF/CR source with Unicode, bidirectional shared editing, local undo/redo, retained selection and editor identity, no focus theft, edits while the other view is hidden, exact downloaded bytes and unchanged disk files. Empty current source can be edited and its draft survives tab close/reopen. A 1,200-line source remains bounded, go-to-line/find reach its tail, wrap works and the phone Workspace stays contained.
- Two retained Modern/Legacy source-control cases pass, including keyboard Copy, find/go-to-line/wrap, layout menus and return from comparison.
- Five retained Workspace regressions pass: two-file reading/drafts/native preparation; large comparisons and selection/scroll/undo preservation; exact endings/indent/size refusal; Markdown/source; and new unsent file drafts/attachments. Synthetic native preparation is not signed-in harness acceptance.
- 813 whole unit tests, both project TypeScript checks and production UI build pass. Local checks only; no hosted CI. Eleven focused browser cases pass in total.
- Actual Drishya Claude recording (1,138 captured observations): approved current `docs/BLUEPRINT.md` was opened as Markdown and edited as an unsent local draft in both panes. The second view receives the first view's later marker; desktop/390 px bounds and page errors checked. Original file bytes compare equal before/after. The phone frame was inspected. Draft text is synthetic test material, not recorded agent output; closing the private context drops it. Real source and screenshots remain local/uncommitted.

The large actual editor virtualizes its text; the acceptance moves explicitly to the end before inspecting appended markers. No full-DOM assumption or production virtualization change was made.

## Separate issue found, left open in TASKS

The actual Drishya Files tree lists root `README.md`, but its stored repository graph contains exactly 5,000 nodes and omits that path. `WorkspaceAccess.read` requires graph membership and returns `403 file is outside the indexed workspace`. The document reader then retains the explicit error. This is a separate current-tree/index-membership defect, not fixed by changing an editor or weakening the workspace capability. It is recorded under FILES-4 for a scoped backend/index-policy follow-up; no project file was read through a bypass.

Broader reader combinations, that graph-boundary issue and physical/human acceptance remain open. History/PERF-2 stays paused by explicit builder direction; this PR does not certify the global TEST-2/browser performance gate. Ready for builder review.
