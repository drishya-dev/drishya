# Antigravity adapter (AG-1)

Implementation in progress; no acceptance is claimed yet.

## Build and verification plan

1. Constrain all discovery reads to transcript journals and the immutable session index. Resolve real paths before opening files; reject escapes and credential-bearing locations. Never open conversation databases in AG-1.
2. Select the transcript with the greatest complete step index. Preserve an already imported source identity. Count encrypted-only and artifact-only conversations explicitly.
3. Decode argument values once; map captured calls and results to existing harness-neutral intents. Preserve step order and stable IDs. Pair only within a planner's call group, with explicit unmatched calls and unknown outcomes.
4. Pass every observation through the existing ingest seal before persistence. Test protected paths and canaries across stored/exported material.
5. Test synthetic records including duplicates, missing results, backwards times and partial lines. Then scan and import real Antigravity sessions into a scratch home, reporting prefixes, sizes and counts only.
6. Verify real screens at 600 and 1440, measure the largest import, and run types, units and the Home/search/filter/open regressions. Do not mark ready until the whole acceptance list has a result.

## Integration sequence

AG-1 precedes AG-2 product identity and AG-3 tailing. Those may run in parallel after the adapter interface stabilizes. AG-4 uses the builders' approved recommendations: referenced images by default, artifacts as plans rather than repository writes, and source-labelled recorded thinking. AG-5 supplies genuine missing cases; no synthetic fixture counts as real acceptance. AG-6 database enrichment is optional and out of this item's scope.

All item PRs target `codex/harness-antigravity`. Only a final reviewed integration PR targets main; no product code is pushed directly to main.

## Scope review before existing-file edits

The TASKS file list omits package registration (`packages/ingest/package.json` and `pnpm-lock.yaml`), real-case registration (`scripts/check-real.ts`), and the contract/reducer version files needed by its approved `call-order` addition. Exact paths and any further correctness requirements will be recorded in the draft PR before they are changed.
