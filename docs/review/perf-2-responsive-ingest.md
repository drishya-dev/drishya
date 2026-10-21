# PERF-2: bounded ingest and ownership-safe history blobs

21 October 2026 · Harsh with Codex · `harsh/perf-2-responsive-ingest`

## Outcome and ownership

**The performance gate remains open.** Yash owns the private 166/347/564 MB reference journals and the five-run real gate matrix. No journal copies were requested. This PR needs those real runs before merge; DATA-3 remains blocked in Harsh's lane under his explicit instruction. Physical/platform acceptance remains separate.

The candidate adds 256 KiB committed ingest slices, ownership-safe reuse of captured history blobs, an opt-in deterministic invented large-journal generator, and stronger rescan/reader-update measurements. Main `f48d778` already includes Yash's #181 policy-version cache and map/file-tree reductions. That base is present on both sides of the final comparison. The overlapping expression-index experiment was dropped, so its earlier gains are not attributed to this PR.

The clearest result is **about 90% less derived-blob payload** in all three invented cases, with exact artifact bytes preserved. Timing and RSS are mixed; this is a diagnostic candidate, not a restored-budget or broad-readiness claim.

## Invented workload

`node scripts/make-large-journal.ts <new-output.jsonl> <nominal-decimal-MB>` exclusively creates a new file, streaming one cycle at a time. It reads no native journals, invokes no harness and does not import its output. Generated files stay ignored and are not committed.

The published 8,803 → 26,593 observation amplification calibrates 4,400 wrapper call/result pairs, two typed items per wrapper, one cumulative/request token receipt per wrapper and 190 extra cumulative-only receipts, plus three metadata/turn observations. This matches **observation amplification**, not an unavailable exact private event/size histogram. The chosen command/file/MCP proportions and output/patch sizes are explicit synthetic assumptions. Output is unique per operation, patches range from 16 to 2,048 changed lines, and all content is invented.

Nominal 160/350/560 MB requests produce 171,108,013 / 374,361,644 / 600,021,470 bytes after JSON escaping/repeated material, with 7,599 / 16,622 / 26,593 observations. The report uses actual bytes. The largest record is below 322 KB; these probes do not certify worst-case 16 MiB single-record responsiveness. The hard record limit is unchanged.

## Implementation and safeguards

- **Ingest:** the soft committed slice decreases from 1 MiB to 256 KiB. Complete records remain indivisible; IDs, order, offsets, redaction and atomic cursor/data commits are preserved. Yield opportunities increase, but neither individual large records nor slow disk commits acquire a hard sub-100 ms bound.
- **History:** reuse an exact SHA-256 only when this view's own captured observations explicitly reference it. A global hash match alone is unsafe: forgetting an unrelated recording must not remove another view's sole artifact copy. New derived material still uses the worker's own `index.db`; existing cached copies are not deleted.
- **Compatibility:** artifact bytes/IDs/metadata, event contract, reducer `r9` and cache `h2-4096` remain unchanged. These are storage/scheduling changes, not new projection rules.
- **Regression coverage:** committed intermediate cursors stay on complete records, including a record larger than a slice; rescan adds zero and preserves IDs. Generator bytes/counts are deterministic and exclusive creation refuses overwrite. History reads complete reused artifacts across restart and retains derived material after forgetting an unrelated owner of identical bytes. Existing goldens remain unchanged.

A 128-page automatic-checkpoint experiment was removed. Its exploratory largest-case API p95/tail timing did not justify changing the default checkpoint policy. The raw exploratory data is retained separately from the final comparison.

## Final comparison on current main

[All numeric samples, workload hashes and earlier exploration](perf-2-responsive-ingest-results.json). Control `f48d778` and candidate use identical harness bytes and built UI. One fresh process per source/condition, all control runs then all candidate runs. No competing benchmark/test load. Windows, i7-13650HX (20 logical CPUs), 23.7 GiB RAM, Node 24.11.1, installed headless Edge at 1440×900/default resource and motion settings. This differs from Yash's reference machine. OS cache/load/thermals/power are uncontrolled; single samples do not establish statistical attribution.

Each cell is **control → candidate**. API p95 is within each 20-request browser window, not a five-run p95 or human interaction score. Import times below cover the bulk prefix; withheld append is 16 MiB. Every append is independently checked against a fresh full import.

| Actual synthetic size | Bulk-prefix import s | First history page s | Append catch-up s | API p95 ms | Peak daemon RSS MiB |
|---|---:|---:|---:|---:|---:|
| 171.1 MB | 6.68 → 6.92 | 4.32 → 4.14 | 0.93 → 0.97 | 189 → 224 | 460 → 468 |
| 374.4 MB | 15.65 → 17.04 | 10.78 → 12.29 | 1.06 → 1.21 | 210 → 92 | 536 → 497 |
| 600.0 MB | 25.48 → 35.31 | 15.61 → 16.13 | 1.19 → 1.34 | 201 → 106 | 610 → 616 |

| Actual synthetic size | Derived payload MiB | Append event-loop max ms | Append to visible reader s | Browser frame max ms |
|---|---:|---:|---:|---:|
| 171.1 MB | 85.9 → 8.5 | 99 → 98 | 2.67 → 2.76 | 486 → 472 |
| 374.4 MB | 188.1 → 18.7 | 118 → 118 | 3.72 → 3.70 | 56 → 49 |
| 600.0 MB | 301.7 → 29.9 | 123 → 224 | 4.15 → 4.01 | 118 → 111 |

All six runs have zero gaps, exact fresh-import ID/order equivalence, and zero additions on repeated sync/rescan. No concurrent viewer capture occurs. Derived payload is `SUM(length(body))` in the cache's derived-blob table, not total database/file size or RSS; it is queried after performance sampling stops.

API p95 improves on two sizes and worsens on one; RSS has no reliable general improvement. Bulk-prefix import is slower (about 4%, 9%, 39% in these phased samples), and history timing is mixed. Process timer p95 is lower, but the largest append still has a long stall. Do not use these samples to claim a universal speed/memory improvement or accept a throughput tradeoff without the real matrix.

**Synthetic targets are still missed:** small/largest API p95 exceeds 100 ms, largest RSS exceeds 512 MiB, and every end-to-end reader update exceeds 1.5 s. Ingest catch-up alone would falsely suggest visible-update success. PERF-2 stays open.

## Measurement boundary

The probe opens only disposable snapshots. Discovery, native/controller, live and refresh routes are blocked; only the probe advances capture. Ordinary reads have no user route callback (an earlier all-API routing callback added an artificial scheduling hop and was removed). Browser frames/API round trips are automation proxies, not physical/human interaction acceptance.

Peak RSS includes daemon and workers, sampled independently every 20 ms; browser/GPU memory is excluded. Import/page/append/append-stall/reader-update values are distinct. Identity and full-rescan validation run after sampling stops. Reader update requires the final timeline count, latest material passage intersecting the viewport, then two animation frames; it does not claim that offscreen content painted. Temporary snapshots/stores are cleaned on normal/error completion.

## Reproduction and real-gate request

From the candidate checkout after pinned install and `corepack pnpm ui:build`:

```powershell
New-Item -ItemType Directory -Force .local/perf-2 | Out-Null
node scripts/make-large-journal.ts .local/perf-2/rollout-160.jsonl 160
node scripts/make-large-journal.ts .local/perf-2/rollout-350.jsonl 350
node scripts/make-large-journal.ts .local/perf-2/rollout-560.jsonl 560
$env:DRISHYA_BROWSER_CHANNEL='msedge'
node scripts/bench-real-journals.ts --runs 1 --browser .local/perf-2/rollout-160.jsonl .local/perf-2/rollout-350.jsonl .local/perf-2/rollout-560.jsonl
```

Use a separate `f48d778` checkout with the candidate's exact benchmark script and identical built UI as the control. Reuse frozen invented bytes; do not run other tests/builds/benchmarks concurrently. Yash's #181 policy cache is present on both sides. This PR adds no expression index/store migration.

Yash: run five `--full-import` and five `--browser` runs per private 166/347/564 MB source on this PR branch, on an idle reference machine. Post numeric-only import/page times, peak RSS, API p95, event-loop max and visible reader update. Keep the journals private. Before merging/unblocking DATA-3, require interaction p95 <100 ms, visible update <1.5 s and RSS ≤512 MiB; physical/platform checks stay separate. The old ingest-tail timing is not equivalent to the new end-to-end reader-update measure.

## Local real-journal sanity check (not gate acceptance)

The largest available local source is 57,651,337 bytes: one candidate append/browser run yielded 5,830 observations, zero gaps, exact full-import IDs/order and an idempotent rescan. Prefix import 1,590 ms; first history page 1,144 ms; append 228 ms; append event-loop max 39 ms; API p95 222 ms; visible reader update 1,064 ms; peak daemon/worker RSS 395.8 MiB. This is a smaller source on a different machine, not a substitute for Yash's private matrix. Source content and paths are excluded from committed numeric results.

## Validation on comparison base f48d778

- `corepack pnpm check`: 720 tests in 134 files, both project typechecks pass; direct script typecheck and UI build pass.
- Final full browser suite: 288 passed, 26 skipped (13.5 minutes). Earlier full-run pinned-reader raw-scrollTop failure (`b2-live.spec.ts:186`) also reproduces on unchanged f48d778 alone; final suite passes it, cause undiagnosed and TEST-2 remains open.
- `corepack pnpm package:verify`: isolated offline install, Claude/Codex import, demo, authenticated API and persisted restart pass.
- `corepack pnpm demo:bundle`: initial diff finds only the pre-existing upstream reducer tag r5→r9; no other JSON leaf changes. That refresh is included. A second regeneration is byte-identical and the staged-file diff check passes. No reducer version is changed by this PR.
- Final opt-in ten-minute synthetic reader soak: **90 rounds, peak 806 DOM nodes, 602,577 ms**, all assertions pass. Initial setup timed out before entering the loop; stable operation identity and keyboard activation fix setup, with duration/anchor/evidence/DOM assertions unchanged. A prior repaired run also passed 90 rounds.

The pipeline's initial nonzero result was solely the stale demo-tag diff; browser/package/demo generation/soak all returned zero. Subsequent byte-identical regeneration resolves that check. Later CONTENT-9 and DATA-4 commits on main are outside this measured/verified base; this draft does not claim their combined performance. No hosted CI, native-account turns, merge or physical acceptance was performed.
