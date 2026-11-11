# FILES-16 — choose a recorded checkout

Whole task in progress, Yash with Codex, 11 November. Claimed before code; Yash approved 24 paths and isolated API sections, then requested waiting for GIT-8. Work resumes from merged #414 and #415. No merge by Codex, no hosted CI dispatch.

## Behaviour and boundaries

The existing Files heading is a checkout picker when the session has other file-evidence roots. Available roots come first; removed/unavailable roots remain named and disabled. Current Files, read-only Git review/history/Compare and the repository map use that root's own access. Returning to Session checkout restores the original file/peek tabs, query, expansion and reading location.

A browsing key is **not a recording or a native harness target**. Only recorded roots with file activity qualify; cwd-only roots, arbitrary paths, unknown keys, combined sessions and removed directories cannot acquire a context. Context keys support Files/Git/map reads and derived Compare evidence only; native controller, captured-history, metadata, export and delete routes reject them. The recorded workspace and graph approvals are not overwritten by the view. Map nodes and captured-file attribution keep their exact checkout namespace.

Native prompts and Workspace editing stay on the physical selected session. Peek and captured-file actions explain/disable an editing handoff from another browsing checkout. Entering Workspace returns to the session checkout; a browsing permission never enables another native session. No event-schema, native configuration, credentials, policy or project-write capability changed.

| Before | After | Why |
| --- | --- | --- |
| Other worktrees could be read as captured evidence but not browsed as the current checkout | A selector uses the existing Files heading and existing menu/control tokens | One compact home for the browsing choice, no resident toolbar |
| Same-named search hits in different checkouts looked identical | Other-root results carry a short Captured/root caption and retain their exact absolute tooltip | A sibling is distinguishable before opening it; nothing is guessed |
| Current readers assumed the native root | Peek, captured-to-current reads, imports and Git use the browsing access context | Current bytes cannot silently come from a same-named file in the native checkout |
| Map identity was only the indexed relative path | Selected-root nodes, edges and evidence use the captured namespace | Main-checkout activity cannot be attached to a sibling's matching filename |

## Acceptance evidence

Genuine journals were imported read-only into fresh scratch homes. No journal content is logged; private frames stay `.local/files16/real/`. Two native cases, each at 600 and 1440 px:

| Harness | Recording prefix | Source bytes | Observations | Recorded roots | Available other roots | Selected map files | Current Git files | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Claude Code | `rec_be806b25` | 8,627,732 | 2,747 | 8 | 2 | 1,248 | 0 (clean checkout) | Both widths pass |
| Codex | `rec_aba0ec58` | 201,701 | 27 | 2 | 1 | 3 | 2 | Both widths pass |

The older Codex samples' secondary roots were removed or cwd-only, so a fresh native Codex session read two synthetic throwaway Git worktrees. The native CLI ran with its saved defaults and fixed argv; it owned its journal writes. No fabricated journal or sandbox/approval change. Native stdout remains private.

All four journeys: approve the original root, open a current file, choose a distinct actual recorded worktree, prove access is not inherited, approve that root, read its actual current material, inspect its Git and qualified map, return to the original file/search. All preserve the recorded identity; zero page errors and zero controller prompts. Twelve private choice/current/Git/return frames plus count-only results are retained (four frames per journey).

## Checks and current status

- Backend consent/security units: six pass, including root qualification, cwd-only/unmatched rejection, separate Git/current-file access, protected files, restart/remembered isolation, replacement identity, removed roots and native-route rejection.
- Related checkout/workspace/Git units: 67 pass before the two added security cases; final broader verification follows.
- Initial FILES-15 browser baseline: two pass. New four-case picker journeys plus FILES-15: six pass. Expanded picker/captured-current/read-action checks: 21 pass at both widths, zero retries. The new narrow checks explicitly open the existing Reading options menu and respect the drawer closing when a peek returns.
- Both project typechecks pass. Broad affected/all-unit/package/gate results are still pending; do not call the task or PR ready from these focused results alone.

Implementation and final acceptance are not yet marked complete; the TASKS tick/claim removal belong in the final completion commit. The pre-existing TEST-2 failures reopened by #415 remain recorded and are not waived.
