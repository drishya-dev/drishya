# FILES-4 — shared drafts and current-file eligibility

25 October 2026, PR #226. Fixes existing Workspace editing and current-file eligibility failures; this is not a new feature or completion of the whole FILES-4 review.

| Before | After | Why |
| --- | --- | --- |
| The same retained draft could be open in both panes, but each CodeMirror view ignored later shared text updates. Typing in the stale pane could replace newer work. | A changed shared draft maps one minimal transaction into the existing editor. An annotation suppresses the return callback and excludes synchronization from local undo history. | Both views must edit the same draft without an update loop or accidental data loss. |
| A capped/stale map could omit an otherwise eligible current file that Files already showed. | Missing-node fallback checks only that file against the existing index ignore, directory, binary and 512 KiB rules. Complete unchanged maps still reject missing nodes. | A visualization cap must not become a false content denial. |
| Recreating or replacing the whole editor would disrupt selection, undo and hidden comparison state. | The real editor stays mounted. Common prefix/suffix boundaries preserve position mapping; unchanged locally emitted text skips synchronization entirely. | Keep reading/input stable and avoid an extra parse on each local keystroke. |

No source is written to disk by the UI. Local drafts remain volatile unless the user explicitly saves through existing recovery. No native prompt is submitted, no permissions/configuration are changed, and no History, PERF-2, motion, capture, schema, dependency or CSS source changes.

## Reproduction and verification

The original browser reproduction opened one file in both panes, changed the first draft and asserted that the second contained the new text. Unchanged main failed: the second view still held the earlier draft. The final regression follows actual file selection, split-view, edit, comparison and download controls.

- Four new browser cases: LF/CRLF/CR source with Unicode, bidirectional shared editing, local undo/redo, retained selection and editor identity, no focus theft, edits while the other view is hidden, exact downloaded bytes and unchanged disk files. Empty current source can be edited and its draft survives tab close/reopen. A 1,200-line source remains bounded, go-to-line/find reach its tail, wrap works and the phone Workspace stays contained.
- Two retained Modern/Legacy source-control cases pass, including keyboard Copy, find/go-to-line/wrap, layout menus and return from comparison.
- Five retained Workspace regressions pass: two-file reading/drafts/native preparation; large comparisons and selection/scroll/undo preservation; exact endings/indent/size refusal; Markdown/source; and new unsent file drafts/attachments. Synthetic native preparation is not signed-in harness acceptance.
- 836 whole unit tests, both project TypeScript checks and production UI build pass. Local checks only; no hosted CI. Twelve focused browser cases pass in total, including the new capped-map Workspace/peek check. Twenty-three new unit guards cover map eligibility parity, consent, redaction/revocation and protected/ignored/linked/oversized paths; three of the Workspace cases failed before the fallback fix.
- Actual Drishya Claude recording (1,138 captured observations): approved current `docs/BLUEPRINT.md` was opened as Markdown and edited as an unsent local draft in both panes. The second view receives the first view's later marker; desktop/390 px bounds and page errors checked. Original file bytes compare equal before/after. The phone frame was inspected. Draft text is synthetic test material, not recorded agent output; closing the private context drops it. Real source and screenshots remain local/uncommitted.

The large actual editor virtualizes its text; the acceptance moves explicitly to the end before inspecting appended markers. No full-DOM assumption or production virtualization change was made.

## Current-file eligibility failure, resolved

The actual Drishya Files tree listed root `README.md`, but its stored repository graph contained exactly 5,000 nodes and omitted that path. `WorkspaceAccess.read` required graph membership and returned `403 file is outside the indexed workspace`.

The claim was expanded on main before backend work. For a **truncated or explicitly stale** graph only, a missing node now receives an asynchronous point check using the same root .gitignore matcher, excluded directory names, binary extensions and default 512 KiB index size. No repository rescan, graph expansion, body scan or graph mutation is needed. Complete unchanged graphs keep the old missing-node refusal. This is index eligibility, not a replacement for content permission: workspace grant/root checks, protected paths, links, UTF-8/body limits, whole-document redaction, opened-handle checks and revocation still run.

The helper's tests compare its results against a complete map and a deliberately one-file bounded map, including root-anchored ignores and nested dependency folders. The browser fixture also uses a one-file cap to expose the same condition cheaply; it is not claimed as a default-scale benchmark.

The original actual root README failure now passes both directly and through the Drishya UI, still absent from its 5,000-node map. Current Markdown reading, same-file draft synchronization and desktop/390 px bounds pass; original disk bytes remain unchanged and no page errors occurred. The earlier Blueprint check remains separate genuine current-file acceptance. Real private frames stay local. The first real README UI retry timed out during a cold root approval; a later complete journey passed. No latency/performance gate is claimed from it.

Broader reader combinations and physical/human acceptance remain open under FILES-4. History/PERF-2 stays paused by explicit builder direction; this PR does not certify the global TEST-2/browser performance gate. Ready for builder review.
