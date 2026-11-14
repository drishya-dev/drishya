# GIT-11 — Squash-merged branches join main in the Git graph

Yash with Gemini 3.8 Flash, 12 November 2026 (`gemini/git-11`). Whole item complete for Opus review; no merge by agent.

## Changes

- **Daemon squash-merge evidence (`apps/daemon/src/git-types.ts`, `git-history.ts`, `github-links.ts`, `git-review.ts`, `server.ts`, `git-compare.ts`, `git-compare-service.ts`):**
  - Expanded candidate branch head discovery in `gitHistory` to include first-parent branch heads (`!firstParentChildren.has(...)`) and skip main-parented merge wrappers, resolving `diffTip` against `origin/<primary>` when `primary` is an ancestor.
  - Computed bounded per-commit and per-branch-head `git patch-id --stable` (`changePatchIds`, `branchPatchIds`, using `gitDiffFlags` including `--no-ext-diff` so `-c diff.external=` never errors) plus changed file maps (`changeFiles`, `branchOwnFiles` restricted to non-merge commits on the branch) cached by immutable object ID.
  - Added opt-in `gh`-backed pull request resolution (`GithubLinks.mergedPulls` with 60 s TTL and `GithubLinks.pull` for `(#N)` subjects, plus ancestry guards rejecting reused branch names). Never calls `gh` when disabled.
- **UI resolution and graph display (`apps/ui/src/lib/git-squash.ts`, `git-network-layout.ts`, `git-history-cache.ts`, `git-light.ts`, `GitHistory.tsx`, `GitNetworkGraph.tsx`, `git-network-graph.css`, `GitThreadGraph.tsx`, `GithubLinksSetting.tsx`):**
  - Implemented strict priority resolution in `resolveSquashJoins`: exact content signature (`content-signature`), stable net patch-id (`patch-id`), non-merge changed-path superset (`path-superset`), opt-in merged GitHub PR (`github-pr`), and opt-in `(#N)` subject PR (`github-subject-pr`). Merge-wrapper strands and primary commits older than the fork point are excluded; evidence accumulates across loaded pages via `collectSquashEvidence` and keys the layout cache via `squashEvidenceSignature`.
  - Rendered dashed `.network-edge.squash` joins in `GitNetworkGraph`, included squash endpoints in focus lighting, displayed honest per-basis `squashNote` + `PR #N` / `(#N)` in `BranchPeek`, and cleared `gitHistoryStore` when toggling the GitHub links opt-in.

## Real-repository & real-session verification (scratch store, no journal content printed)

- Verified on `drishya` across pages `0..3` (`start = 0, 50, 100, 150`) that all 9 PR branches **#419–#427** (`codex/ship-2e`, `gemini/ui-32`, `claude/site-1`, `gemini/git-10`, `gemini/files-16b`, `gemini/ui-32b`, `gemini/ui-30`, `gemini/ui-31`, `gemini/files-17`) join `main` at their respective squash commits (`25a30d1`, `05a2d76`, `2bfee32`, `0608b54`, `e648975`, `a72297c`, `76a6358`, `2e06831`, `6e56332`) with GitHub lookups OFF (18 total squash joins) and carry `#N` badges with lookups ON, while unmerged branches (`gemini/ui-35`, `gemini/sec-2`, `gemini/files-18`, `gemini/ui-33`) stay unjoined.
- Verified in headless Edge against real local sessions (`claude-code` `rec_5ee6b391` 8.46 MB / 2,400 obs, `codex` `rec_8415940e` 0.78 MB / 263 obs) at `1440×900` and `600×900` across Jet Black, Midnight, and Paper (`overflow: 0`, dashed squash edge and `BranchPeek` copy rendered cleanly, private frames in `.local/git-11/`).

## Checks

- `corepack pnpm typecheck` & `corepack pnpm ui:build`: passed.
- Related unit tests (`vitest related` across 36 test files including `git-history.test.ts` 12/12, `git-squash.test.ts` 6/6, `git-network-layout.test.ts` 2/2, `git-history-cache.test.ts` 3/3, `git-light.test.ts` 10/10): 256/256 passed.
- Targeted Edge browser specs (`git-graph-focus.spec.ts` including new `squash-merged branches join main in the Git graph` suite at `1440`/`600` across Jet/Midnight/Light, `git-branches.spec.ts`, `git-history-cache.spec.ts`, `git-access.spec.ts`, `git-compare.spec.ts`, `git-changes.spec.ts`, `git-changes-controls.spec.ts`, `git-changes-marks.spec.ts`, `git-session-evidence.spec.ts`, `git-typography.spec.ts`, `link-cards.spec.ts`, `settings-typography.spec.ts`; `DRISHYA_BROWSER_CHANNEL=msedge --workers=2 --retries=0`): 43/43 passed.
- Not run: full browser gate (per house rules, reserved for batch gate), hosted CI, `package:verify`.
