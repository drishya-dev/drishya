# STORE-1 · imported storage and clearing

19 November 2026 · issue #554 · base `30c83c9f`.

Settings gains one Storage section without changing appearance/theme ownership. It uses the existing authenticated storage route and recording DELETE lifecycle. Offline bundles remain read-only.

## Accounting contract

- `GET /v1/storage` retains filesystem totals: captured files, history cache, database (including WAL/SHM), and other files. These are file lengths, not allocated-block sizes or secure-erasure claims. Symlinks are excluded. Measurements are advisory samples, not atomic snapshots during ingestion.
- `GET /v1/storage?details=1` adds `rowBytes`, `capturedBytes`, and `sharedCapturedBytes` per imported session. Row bytes are UTF-8 observation/projection JSON; captured bytes count distinct referenced files once per owner. Shared files appear in every owner's evidence size. Session values do not sum to physical usage. Source/cursor metadata, FTS indexes, SQLite capacity and derived history remain shared/unassigned overhead.
- Detail reads yield between 64-row keyset pages, cap at 100,000 rows and distinct hashes, and mark incomplete/changing samples. Concurrent requests coalesce; successful samples expire after two seconds. Home does not request detailed scans. Invalidation waits for an existing walk before refreshing.
- Refresh never runs `VACUUM` or a checkpoint. SQLite's normal autocheckpoint remains. Writer connections retain at most 16 MiB of checkpointed WAL when next reused (`journal_size_limit`), for both databases. Active readers/transactions may temporarily require more; this is not a hard active-WAL bound.

## Clearing and verified gaps

Confirmation identifies the session and explains reimport, sharing and controller/live disposal. Clearing uses controller disposal, workspace/Git-review revocation, `App.forget`, history-cache removal and ingest/store deletion. It invalidates usage/discovery and publishes the existing sources notification. Search and observations disappear; only unshared captured/derived blobs are reclaimed. SQLite retains reusable pages.

Three gaps were reproduced and fixed:

1. The browser `forget` request omitted the JSON content type required by the daemon. It now sends `{}`; request protections are unchanged.
2. Source validation could finish after clearing and recreate the recording. In-flight imports are cancelled by exact recording ID; a new explicit import afterward remains valid. Harness files are untouched.
3. WAL retention was unlimited. A synthetic 24 MiB transaction retained 25,568,752 bytes after passive checkpoint/reuse. A reader-held regression proves bounded reuse without terminating the reader or losing rows.

Selected/combined-session browser material and navigation caches are forgotten. A stale failed fetch cannot evict newer reimported material. Clearing the viewed/live session returns to Home and stops following. The panel treats an already-missing recording as already cleared; other failures retain confirmation and do not claim success.

## Genuine acceptance

Claude Code and Codex journals were imported into a temporary home. Native sources were hashed before/after. Screenshots remain ignored in `.local/storage-real/`.

| Case | Evidence |
| --- | --- |
| Claude Code | `rec_a6dae2e3`, source 1,296,549 bytes, 226 observations. Clear/reimport at 600/1440; the other's 681 observations and history remain readable. |
| Codex | `rec_b8565767`, source 1,958,276 bytes, 681 observations. Clear/reimport at both widths; the other's 226 observations/history remain. Captured files fall from 181,196 bytes to zero. |
| Physical totals | Claude clears: 4,852,908 → 5,359,668 bytes (WAL writes) and 8,905,516 → 8,905,516; captured unchanged at 181,196. Codex clears: 8,905,516 → 9,226,960 and 9,729,012 → 9,547,816; each removes 181,196 captured bytes. No immediate physical-shrink promise is made. |

Run `corepack pnpm ui:build` then `corepack pnpm check:real -- storage-clear`. The helper prints prefixes/sizes/counts only, keeps screenshots local and removes its scratch home. It requires desktop Chromium/Edge and both journal inventories.

Synthetic guards cover shared files until last owner, preserved recording/search/history, reimport/missing deletion, late-import race, failure UI, confirmation/cancel focus, viewed/live navigation, symlink exclusion, invalidation, active-reader WAL reuse and scoped browser-cache cleanup.

Focused checks: 257 tests/19 files (store/ingest/daemon), three unit workers; cache/storage 13 tests; six Storage/Antigravity browser checks, two browser workers, zero retries. Both typechecks pass. Final batch/package gate is pending. Maintainer review is required before merge; no subagents were launched under the explicit task restriction.
