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

Focused checks: 257 tests/19 files (store/ingest/daemon), three unit workers; cache/storage 13 tests; six Storage/Antigravity browser checks, two browser workers, zero retries. Both typechecks pass. Final batch/package results are recorded below. Maintainer review is required before merge; no subagents were launched under the explicit task restriction.

## Final batch and review, resumed 20 November

Frozen implementation `6a358c24`; the later delta updates only the existing Modern Settings tab assertion and this evidence. No second full batch was run.

- Full units: **1,905 passed, one skipped**, 283 files, **three workers**. Both typechecks and UI/site builds pass.
- `check:affected`: related-unit run at its default concurrency had four test timeout/cleanup failures (checkout-selection, git-branches, git-compare-service and the import-discovery server case). All **50 tests in those four files pass** on both this branch and unchanged main with one worker. This is not a claim that the original related run was green or that the exact default-concurrency failures were reproduced on main.
- Complete parallel browser pass: **962 passed, 27 skipped, two failed**, **three workers**, no retries. Both failures were the old six-tab expectation in modern-only; it now includes the required Storage category. The corrected Modern/Storage selection passes **seven tests**, one worker.
- The interrupted first serial pass is not counted as complete. Its resumed complete pass: **63 passed, one skipped, three failed**, one worker. Failures: Work/Conversation reading-place retention at 50% and 80% at 600 px, and exposed-reasoning menu-clock motion. Clean-main controls: 80% reproduces; 50% and reasoning pass. A focused rerun of all three on this branch passes. The 80% result is baseline TEST-2 evidence; the other initial timing failures are recorded without claiming clean-main reproduction. No assertions were relaxed or retries hidden.
- `package:verify` passes: isolated offline packed CLI installation, both fixture harness imports, bundle, authenticated API and persisted restart; security **700 passed, five skipped** (20 files passed, one skipped).
- Final genuine `check:real -- storage-clear` rerun passes all four harness/width combinations with the exact sizes/counts and pre/post figures in the table above; originals hash unchanged, the other recording/history stays readable and reimport restores counts.

The complete batch is **not reported as green**. All task-specific reruns pass; the initial failures, baseline control and resource/concurrency limits remain visible for review. Author self-review checked ownership, stale asynchronous work, byte claims, containment and private-material exclusion. No new event schema/runtime dependency or native writes. Fresh independent/maintainer review is still pending; no subagents were used and no merge is authorized.

## Pre-merge review, 22 November

Harsh subsequently authorized review and merge of ready PRs except #555 and drafts. Independent code review found a dismissal race: closing the confirmation during a pending DELETE started exit motion before the busy callback rejected dismissal. If DELETE failed, the error remained inside an invisible, inert dialog. A browser reproduction confirmed that state before the fix. ReadingDialog now accepts an optional dismissal guard, checked before exit motion, and Storage disables dismissal while clearing. Other callers retain the default behaviour.

The new regression failed before the guard and passes at 600 and 1440 px afterward. It holds DELETE, exercises Escape/cancel, releases a failure, and checks that the error remains visible, interactive and cancellable without deleting either recording. Independent re-review found no remaining blocker in this modal path.

Fresh checks on the integration candidate with main `a7890026`:

- Both TypeScript checks and production UI build pass.
- Store/ingest/daemon/cache selection: **79 unit tests**, five files, two workers, pass.
- Storage/Modern Settings: **nine browser tests**, one worker, pass. The local focused configuration omits the unrelated native CLI global setup; these tests do not launch native turns. This is not a full browser-suite result.
- `package:verify` passes, including **700 security tests, five skipped**.
- Genuine scratch-home clear/reimport passes again for Claude `rec_a6dae2e3` (1,296,549 bytes, 226 observations) and Codex `rec_b8565767` (1,958,276 bytes, 681 observations), at both widths. Counts, preserved history and original-source hashes pass; usage figures match the table above. Private screenshots remain ignored locally.

The original full-batch limitations above remain recorded; this focused repair does not relabel that batch green. The earlier pending-review/no-authorization statement describes the 20 November state and is superseded by this dated review and Harsh's merge instruction.
