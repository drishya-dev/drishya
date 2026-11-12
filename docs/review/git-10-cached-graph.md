# GIT-10 · Git graph opens at once and is kept

Builder request (Yash, 12 Nov): opening the Git graph recomputed `git log`, re-fetched commit details, and rebuilt the graph layout on every close/reopen.

## Root causes fixed

1. **Daemon (`apps/daemon/src/git-history.ts`, `apps/daemon/src/git-review.ts`, `apps/daemon/src/server.ts`, `apps/daemon/src/git-session-context.ts`):**
   - Added a bounded LRU `GitHistoryCache` (64 entries across repository roots) keyed by `(root, generation, reference, referenceStart, query, start)`. Any generation change on a root drops only that root's stale entries before caching the updated page.
   - Added `GET /v1/recordings/:id/git/generation` (`gitRefGeneration`) behind auth and read-only Git consent to check refs + `HEAD` cheaply without running `git log`.
   - Shared `GitReview.historyCache` across recordings pointing at the same repository root while computing session-specific `sessionLinks` and `workingTree` without mutating cached history pages.
   - Added bounded LRU caching in `git-session-context.ts` for immutable commit path maps and parallelized git status reads.
2. **Page (`apps/ui/src/lib/git-history-cache.ts`, `apps/ui/src/components/GitHistory.tsx`, `apps/ui/src/components/GitNetworkGraph.tsx`, `apps/ui/src/components/CommitRows.tsx`, `apps/ui/src/components/git-history.css`):**
   - Added `GitHistoryCacheStore` (scoped per daemon source, keyed by `${recordingId}:${checkoutId ?? 'main'}`, LRU 16 snapshots) storing loaded pages, selected commit/parent/file pagination, per-commit detail cache (LRU 24), branch filter, zoom scale, graph horizontal scroll, and commit-list scroll position outside component mount state.
   - Added `GitNetworkLayoutCache` (LRU 32 bundles) keyed by structural commit hashes/parents/labels, primary branch tip, seeds, offset, and scale so unchanged commits reuse the computed `gitNetworkLayout` + `networkBranches` bundle without recomputing lanes.
   - Reopening renders the cached snapshot immediately (zero `/git/history` or `/git/commit` fetches on match), checks `/git/generation` quietly in the background, reloads loaded page offsets in place on change without flashing a loading spinner, preserves the selected commit if still present, and falls back to `all` when a previously selected branch was deleted.
   - Switched `GitHistoryReader`'s `ReadingDialog` to `modeless floating` with a local `.atlas-scrim` portal and scoped `aria-modal` / `#root[aria-hidden="true"]` / `Tab` focus trapping so reopening avoids Chromium `showModal()` top-layer layout thrashing without modifying any `MOTION-4` shared dialog owner (`ProductShell.tsx`, `product.css`, `ReadingWindow.tsx`).

## Before / After measurements

Measured in Edge headless (`--motion=0`, Modern Jet Black, `1440×900`, `drishya` at 873 local refs and clean shallow-free `vite` clone at 1,156 refs / 10,907 commits, 50-commit window):

| Metric | `drishya` BEFORE | `drishya` AFTER | `vite` BEFORE | `vite` AFTER |
| --- | ---: | ---: | ---: | ---: |
| Generation check (`gitRefGeneration`) | — | 196.5 ms | — | 61.2 ms |
| Daemon `gitHistory` (cold) | 1,027.8 ms | 811.3 ms | 443.1 ms | 352.1 ms |
| Daemon `gitHistory` (2nd, cache hit) | 727.7 ms | 179.6 ms | 374.1 ms | 53.7 ms |
| `GitReview.history` (cold) | 1,417.3 ms | 1,094.8 ms | 788.7 ms | 588.8 ms |
| `GitReview.history` (2nd, cache hit) | 1,209.6 ms | 507.5 ms | 808.7 ms | 387.8 ms |
| Graph layout compute | 0.44 ms | 1.651 ms -> **0.008 ms** cached | — | 0.500 ms -> **0.0091 ms** cached |
| Browser click -> first paint (cold) | 1,485.1 ms | 1,029.2 ms | 1,037.7 ms | 696.1 ms |
| Browser click -> first paint (warm 2nd / 3rd) | 2,230.9 ms | **87.3 ms** / **58.3 ms** | 859.3 ms | **60.3 ms** / **33.6 ms** |
| Warm reopen requests (`/git/history` / `/git/commit` / `/git/generation`) | 1 / 1 / 0 | **0 / 0 / 1** | 1 / 1 / 0 | **0 / 0 / 1** |

- **Exact graph equivalence:** deep-equal comparison of commits (`hash`, `parents`, `labels`) and computed `gitNetworkLayout` (`nodes`, `edges`, `width`, `height`, `lanes`) against the pre-change baseline passed (`exactGraphMatch: true` on `drishya` and `vite`).

## Real local sessions (600 px & 1440 px, all 3 palettes)

Imported into a temporary scratch home (`0` journal content printed; private screenshots in `.local/git-10-*.png`), tested at `1440×900` and `600×900` across `jet`, `midnight`, and `paper` palettes (`0` horizontal overflow in any palette/width):

| Harness | Prefix | Source bytes | Ops | Refs | Width | Cold paint | Warm paint | Warm requests (`/history` / `/generation`) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Claude Code | `rec_cc002c1f` | 24,040,305 | 732 | 8 | 1440 px | 7,250.1 ms | **56.8 ms** | 0 / 1 |
| Claude Code | `rec_cc002c1f` | 24,040,305 | 732 | 8 | 600 px | 9,182.5 ms | **36.7 ms** | 0 / 1 |
| Codex | `rec_45333698` | 5,418,932 | 75 | 10 | 1440 px | 1,639.3 ms | **66.9 ms** | 0 / 1 |
| Codex | `rec_45333698` | 5,418,932 | 75 | 10 | 600 px | 1,010.4 ms | **52.6 ms** | 0 / 1 |

## Verification

- `corepack pnpm typecheck` & `corepack pnpm ui:build`: passed.
- `vitest related` (daemon + UI, 40 files / 251 tests including new `GitHistoryCache`, `/git/generation`, `GitNetworkLayoutCache`, and `GitHistoryCacheStore` tests): passed.
- Targeted Edge browser specs (`DRISHYA_BROWSER_CHANNEL=msedge DRISHYA_WORKERS=2`, `--retries=0`, 11 Git/dialog specs including `tests/browser/git-history-cache.spec.ts` at 1440 & 600 px): **30 passed / 16 skipped (opt-in `DRISHYA_REVIEW_STORE`) / 0 failed / 0 retries**.
- `tests/browser/fresh-workspace.spec.ts` in Edge (`-g Git` and `-g "Modern reading windows"`): **3 passed** + **31 passed** / **0 failed**.
- `corepack pnpm check:real -- local-branches`: passed (`claude-code`: 193 sessions, sample `rec_c8e5c9c8` 83.7 MB / 2695 ops / 13538 obs; `codex`: 25 sessions, sample `rec_60715088` 0.2 MB / 0 ops / 11 obs).
- Not run: full browser gate (house rule), hosted CI (reserved), `package:verify` (ingest, store, and packaging unchanged).
