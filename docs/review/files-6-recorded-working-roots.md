# FILES-6 — recorded working directories below the workspace

29 October 2026. Whole FILES-6 implementation and available local acceptance. PR #283 is stacked on GIT-2's `fee1888` for the shared, exact local-file-URL decoder; no event-schema change.

The Files tree now starts with the captured workspace's own folders. Other evidenced working roots have one initially closed bottom group, **Other working directories**. This name deliberately does not claim that every recorded command directory is a Git worktree. Each root uses its recorded basename and exposes its full location; leaves retain the original projection path, including its root prefix. Search includes both areas without opening the group. Unknown prefixes and folders merely named `.codex/worktrees` remain unchanged; no filesystem location is inferred from a folder name.

The metadata endpoint reads already sealed observations under the existing local API authentication and recording-membership checks. It uses precisely the reducer's original normalization/hash for each prefix. Explicit supported local file URLs are separately decoded using capture-core's shared helper; their original recorded value and distinct prefix remain available. Two aliases of the same main root stay in the main area without merging their files. No native journal/configuration, observer control, event schema, store migration or workspace authorization changed.

## Acceptance

| TASKS requirement | Evidence |
|---|---|
| Main conversation opens on its own folders | Real main Drishya Codex `32f628ee`, 506,918,177 bytes / 30,562 observations / 21 agents / 20 spawns. Both 600 and 1440 px show own folders first and the other-root group closed. This is the main conversation candidate; the historical report screenshot's exact recording identity was not supplied, so an exact screenshot binding is not claimed. |
| Another multi-agent Codex recording | `7d8b3224`, 12,542,301 bytes / 449 observations / two agents / two spawns, and `08d31045`, 27,919,575 bytes / 1,870 observations / two agents. Group opening, exact file reading, search and visible-row origins pass at both widths. These captures contain only other-root captured files, so an empty captured main area is preserved honestly. |
| Claude sub-agent worktrees if available | Scanned 92 top-level Claude journals and their two available companion journals: zero companions reported a working root outside their parent. Of 94 journals including companions, 18 contain a primary worktree cwd; these are not falsely called sub-agent worktrees. Genuine primary-worktree sessions `63d6b3a5` (1,081,158 bytes / 154 observations / 53 files) and `3f724826` (1,569,783 bytes / 361 observations / 16 files) pass at both widths; ordinary nested cwd changes remain in the main tree. Existing Claude `c8e5c9c8` (82,859,509 bytes / 10,466 observations / 225 files) and `cc002c1f` (24,039,894 bytes / 3,311 observations / 65 files) also retain their ordinary tree. A genuine Claude sub-agent-worktree positive is not claimed. |
| Counts and paths unchanged | Fully expanding the pure display model returns exactly the original distinct input leaves. Real main 184 files, `08d31045` six, `7d8b3224` one, independent Codex `4b5ca5b1` 76 and `4d842553` 59; all exact identities preserved. Main has seven non-main prefixes with files after canonical main aliases are excluded; metadata has 23 recorded roots in total. No reducer/indexer/projected count changed. |
| Search includes both | At 600 and 1440 px, main's `ts` search returns 161 own-root matches and 18 other-root matches. Fixture same-basename files remain two distinct results with exact locations. Independent Codex searches also pass. |
| Opening a worktree file says where it lives | Exact captured history opens from grouped/search leaves, with the recorded full location in the reader title, at both widths. Existing current-workspace authorization remains limited to its indexed root. Plain indexed main-file reading is regression checked separately. |
| MOTION-2 visible-row origin | Real `fileTreeOrigin` returns the actual grouped leaf at both widths for main and both multi-agent Codex recordings; fixtures also check the function. Every `data-spine-path` stays unchanged. Existing disclosure/motion/fallback styles are reused. |

Real screenshots and private drivers remain in ignored `.local/`; no journal content or screenshots are committed. Browser errors from real-session drivers were redirected to ignored local files. Native source observation was disabled for the final fixed-snapshot browser checks; earlier opening had passively refreshed the scratch copies, which explains the main candidate's larger final count than its original 488 MB copy.

## Verification

- Eight focused units: grouping, exact identities/locations, search, unknown roots, main-root mapping, no future/empty roots, local-URL aliases, authenticated API membership and appended-root cache invalidation.
- Both TypeScript projects pass. UI build passes. Two new browser journeys pass at 600 and 1440 px; the existing Files/peek/Workspace/current-file journey passes at 1440 px. No phone acceptance was run.
- `pnpm check:real -- worktree-roots` scans 24 Codex matches / 1,418 hits and 17 Claude matches / 4,695 hits within its default 90 MB bound. Scratch imports: `08d31045` 547 operations / six namespaced files / four prefixes; Claude `024517cd` 426 operations / zero namespaced files, honestly ungrouped. The larger main was checked separately from its copied redacted store.
- `pnpm check:affected --dry` identifies `server.ts` and `api.ts` as wide files. The once-per-batch full gate is owned by the coordinating root agent; it is not redundantly run here. No ingest/store/packaging code changed in FILES-6.
- On the 30,562-observation main capture, metadata's first scan took 233.69 ms total while yielding every 256 rows; maximum observed timer gap was 3.51 ms. Repeated calls took 0.08 and 0.04 ms. Cache retention is capped at 16 recordings and 256 distinct raw roots per recording/response; excess metadata is explicitly marked truncated, and unmatched file identities remain visible in their original form.

## Existing boundary

For multi-root recordings the existing daemon graph is captured/namespaced rather than a current repository index. Therefore the existing current-source API rejects even an exactly mapped main alias as outside its indexed workspace. FILES-6 opens those aliases as captured evidence and suppresses the misleading current-read action unless the exact relative path is actually indexed. It does not grant access to another worktree or broaden the source API. A future task may add explicitly approved current reading for evidenced multi-root main locations; this is separate from FILES-6's captured-file opening acceptance.

Offline bundles have no recorded-root endpoint; they keep the original path display rather than reconstructing or guessing masked roots.
