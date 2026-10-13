# Git developer review tools

13 October 2026. Continuing review 50 items 26–28 on `codex/developer-review-tools`. Use installed `emil-design-eng` for composition/controls; frequent navigation is immediate, retaining existing pointer feedback and keyboard/reduced-motion paths.

| Before | After | Why |
| --- | --- | --- |
| A changed patch hides and overwrites its previous review note | One bounded previous note remains in a disclosure; explicit reuse as an unreviewed draft | Preserve reviewer reasoning without silently approving changed content |
| Browser storage assumes every saved entry is valid | Validate compatible marks, cap 100 entries/2,000-character notes and redact on load/update | Corrupt or manually modified storage cannot leak oversized/private text into reading |
| Current patches are rendered as generic source text | Staged/worktree scope, shared unified/split reader, wrap, whole-loaded-patch find and numbered hunk jump | Read actual patch coordinates and navigate distant changes with bounded 120-line DOM pages |
| Shared patch readers expose a "more lines" stub | Explicit bounded pages, hunk jump and search; raw Git metadata stays separately readable | Every loaded line remains reachable without pretending partial output is complete |

Each implementation increment is committed separately after local checks. Current Git and reviewer notes remain distinct from recorded agent evidence. Previous notes are not automatically included in handoff; only current exact-content reviewed marks are eligible. One previous note per file is retained, not an unbounded note history. Existing per-recording/browser identity is preserved; cross-recording repository identity is a separate follow-up.

Local notes: two units, UI typecheck/build and both Classic/Studio Git browser journeys cover changed-patch note recovery and reset review status. No hosted CI. Follow-up scoped diff/hunk/find and omission controls remain in progress until recorded below.
