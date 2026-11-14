# FILES-16 — choose a recorded checkout

Whole task complete for Opus review, Yash with Codex, 11 November. Claimed before code; Yash approved 24 paths and isolated API sections, then requested waiting for GIT-8. Built from merged #414 and #415. No merge by Codex, no hosted CI dispatch.

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

All four journeys: approve the original root, open a current file, choose a distinct actual recorded worktree, prove access is not inherited, approve that root, read its actual current material, inspect its Git and qualified map, return to the original file/search. All preserve the recorded identity; zero page errors and zero controller prompts. Sixteen private choice/current/Git/return frames plus count-only results are retained (four frames per journey).

## Final verification

Final runtime `0924fe2a`. Seven checkout security/identity units cover evidenced-root selection, separate consent, remembered restart, replacement identity, protected files, removed/cwd-only/unknown roots and native-route refusal. The paged-map regression sends history queries to the proven physical recording/lineage, never a browsing key.

- Both project typechecks and final package verification pass: isolated offline install, both native imports, authenticated API and persisted restart.
- Full final units with two workers: **1,403 passed, one skipped, zero failures** across 230 files.
- `check:affected` ran both types, related units, fresh UI build and the whole Edge suite. Browsers: **766 parallel + 32 serial passed, 28 skipped, zero failures/retries**, two parallel workers/one serial worker. The command itself was red because two related units exceeded their unchanged 5-second limit (file-roots and Git Compare); both pass in the final low-concurrency full unit run. No clean-main comparison or hosted dispatch.
- A final pinned-tab regression intentionally failed on the prior build: pinning a relative reference retained a second unqualified tab. Paths now normalize before saving tabs. Final focused reader/checkout/Git/Compare browsers: **36 passed**, two workers, no retries, on the final rebuilt runtime. The whole browser pass above precedes this isolated correction; it is not falsely reported as a second whole-suite pass on the later source.
- The genuine four harness/width UI journeys were rerun on that final build: all pass, zero page errors/controller prompts; the 16 private frames were refreshed. This is the acceptance case, not the demo.
- `check:real worktree-roots --max-mb 12 --pick 1`: Codex `rec_73cbf2eb`, 0.2 MB, 10 operations, two qualified files/two prefixes; Claude `rec_5ee6b391`, 8.5 MB, 344 operations, 206 qualified files/seven prefixes. These bounded scans supplement the actual four UI journeys above.

Earlier full units had 1,400 pass/one skip/two failures. Git Compare exceeded 5 seconds under contention; the unchanged test passes isolated and in the final two-worker full run. The unchanged recovery tampering test also passes in both: its mutation replaces the first random cipher character with fixed `A`, which does not guarantee changed input. This is a test-construction defect, not evidence that changed ciphertext decrypts. Neither unrelated test was edited; their initial results remain in `.local/final-units.log`. `check:affected`'s initial related-unit results remain in `.local/final-affected.log`. TEST-2's separate strict clean streak and hosted release checks are not cleared by this task.

## Merge coordination and lifetime

The 24-path reservation covers 20 source/test paths and this report plus TASKS, STATUS and CONTINUITY. GIT-9 is separately claimed after this branch started. Its replacement of Git review must retain `useReadingWorkspace`, selected checkout arguments and qualified captured-file evidence in Compare/Git history; the native session controller must retain its physical recording ID. No GIT-9 styling or menu consolidation is attempted here.

The browsing choice lasts within the open session; opening a session resets to its own checkout. Returning through the picker restores per-checkout in-memory tree/query/peek state. This item does not promise crash recovery of a browsing choice or cross-checkout native editing. Workspace editing returns to the original session checkout, explicitly; its approval and native connection are unchanged.
