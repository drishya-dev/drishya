# READ-8 — whole-session captured-file timeline

28 October 2026 · `codex/read-8-file-timeline` · PR #268

The captured-file reader now shows the selected read/edit’s ordinal across the entire matching session history, rather than counting only the 24 actions currently loaded. Previous/Next retain recorded order across pages; pages containing only searches can be skipped with thin worker-provided destinations. The action list and material remain bounded.

| Before | After | Why |
| --- | --- | --- |
| `24 of 24 · page 1 of 2`, then `1 of 7` | `24 of 31`, then `25 of 31` | The number describes the file’s evidence sequence, independently of action pagination. |
| Retained selection takes the first step on whichever action page is open | Retained selection has its own ordinal and exact previous/next destinations | Browsing the action list must not change the meaning of stepping the source being read. |
| Neighbouring search-only pages require repeated requests | Thin metadata points directly to the neighbouring read/edit’s action page | Keep capture evidence in order without downloading all actions to the browser. |
| Filter changes silently alter the sequence | `filtered` appears in the count; tooltip explains replay/filter and missing-material limits | Counts cannot imply whole-path evidence while a user filter is active. |

## Boundaries

- The worker applies the same exact path, text query and replay as-of projection before counting. The optional selected operation is looked up only inside that scope.
- One step requires actual captured read excerpt, edit patch or before/after artifact reference. Actions lacking material remain in the action list; the tooltip states this. There is no reconstructed whole-file version or invented diff.
- The existing file-operation API returns at most 200 operations (the reader asks for 24), page-local ordinal metadata, and bounded first/last/selected neighbour references. It never sends an all-session operation list to obtain counts.
- The bundle fallback uses the same helper against its already-loaded, already-as-of projection. It does not call the local API.
- Off-page selections wait for metadata for that exact selection before stepping; content is not unmounted while that small lookup is pending. Cross-page keyboard focus preserves the requested direction.
- No History.tsx, scroll-anchor, reducer, event schema, native harness settings or project-file write changes.

## Validation

The existing two browser checks were run before editing and passed on Microsoft Edge. Seven focused unit tests cover search-only pages, missing material, exact-path and query exclusions, retained selection and late captured read material. Eight focused browser checks cover whole-session ordinals, cross-page stepping, keyboard end focus, comparison mode, action-page browsing with retained evidence, filter labeling, bounded daemon payload and replay visibility. Both TypeScript projects and UI build pass.

Actual stored Codex and Claude sessions were checked in the running built application at 1440 × 1050:

| Session prefix | Harness | Observations | Operations | Relevant-path actions | Captured-material steps | Steps visited |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `4b5ca5b1` | Codex | 1,530 | 542 | 6 | 6 | 6 |
| `024517cd` | Claude Code | 2,112 | 426 | 95 | 92 | 26 |

These checks had zero page errors and zero remote requests. Claude crossed the action-page boundary while retaining a global ordinal; Codex supplied genuine read/edit material but its tested path had only six steps, so a real multi-page Codex path is not certified. Screenshots stay in ignored `.local/`.

The source journals referenced by the older acceptance store have since moved. Acceptance therefore uses an isolated SQLite backup and copied already-redacted content blobs from that store, leaving the shared store untouched. The captured-file reader opens through restored navigation metadata because the relevant real paths are absolute; this verifies reader material and timeline behavior, not current-disk explorer routing or fresh ingest. A missing-source session-segments request is unrelated to file timeline material. Native model calls were not made.
