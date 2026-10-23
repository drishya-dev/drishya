# PERF-2: locate RSS and latency before further fixes

23 October 2026 · Harsh with Codex · `codex/perf-2-diagnostics`, stacked separately on frozen #188 (`aa29956`). **Not a performance-gate pass.**

## Measurement contract

`DRISHYA_BENCH_DIAGNOSTICS=1` adds numeric phase/isolate/server/page observations. The original 20 `/v1/recordings` round trips, 50 ms pause, frame samples, complete-line split, source snapshots, latest-revision/material/two-frame visible-update wait, process-wide peak RSS and fresh-import/rescan checks remain the gate outputs. No timings or memory are subtracted from those outputs. Diagnostic overhead is measured separately with off/on alternating runs. No native source is modified and no content enters diagnostics.

Phases are prefix import, first history page, browser open, append, reader update and probe drain. The first page precedes Playwright import in the existing harness: it is not silently folded into browser-open time. Independent 20 ms RSS sampling continues during daemon stalls; main/worker heaps are sampled every 100 ms where available. At each phase RSS peak, the most recent preceding heap sample and its age are reported; future samples are never attributed backwards. Short phases without an RSS sample remain null.

Node's RSS is process-wide. Main and history-worker used/physical heaps and external allocations are separate observations; the sampler's own heap/external allocations remain included. The signed unassigned residual after observed V8 physical heaps/external allocations is **not an exact SQLite measurement**: it includes code, native stacks, allocator slack, other allocations and unsampled movement. Component maxima are not additive, committed V8 memory is not an exact resident set, and missing/stale worker samples remain explicit. SQLite cache_size/mmap_size/page_size/temp_store are reported for the main connection and both history-worker connections. No cache setting changes.

Playwright checkpoints bracket its dynamic import and client/context setup before navigation. Both process RSS and main-heap deltas are reported, with no subtraction from the gate RSS. They are observed net allocation changes (GC/allocator behavior can affect them), not a claim that every changed native byte belongs to Playwright. Browser/GPU RSS remains outside the original process metric; browser JS heap is reported separately.

A callback enabled only by the benchmark timestamps `/v1/recordings` at Node request dispatch, response-end and finish. A numeric probe header correlates the original fetches; responses and production headers are unchanged. Handler time excludes time queued before the Node request callback. Page Resource Timing reports network completion to body/promise delivery; remaining delay can include network, server queueing and page scheduling. Long Tasks and CDP script/style/layout counters cover the append-to-reader-update window. Long-task overlap can run concurrently with server work; quantiles must not be subtracted or summed as an exact decomposition.

## Visual parity

Same invented Codex recording, same observation IDs/order, 1440×900 and 390×844. Both captures use normal motion with the supported static map preference and hover reading disabled; finite animations are fast-forwarded only by screenshot capture. Before/after PNGs are byte-identical at each viewport, not merely within a perceptual threshold. No product UI, visual or animation code is changed.

The four PNG captures were checked byte-for-byte and are not committed; regenerate them with the same isolated probe.

The inherited isolated probe blocks refresh/live/native routes; the refresh-denial banner and unavailable connection are visible on both captures. They were not hidden or changed to improve measurements. This is parity evidence for the existing isolated scenario, not human acceptance of a normal native session.

## Status

Focused checks cover response/body parity even when the diagnostic callback throws, bounded numeric probe IDs, no worker creation from diagnostics, no future heap attribution, and unchanged source bytes/IDs/rescan behavior with diagnostics off/on in both import modes. Script typechecks pass with erasable syntax enforced. A 2 MB invented smoke completes with all 20 correlated requests and Long Tasks support; it is setup validation, not gate evidence.

The synthetic measurements below locate costs and expose overhead; broad and reference-machine acceptance remain open. #188 remains frozen awaiting real non-regression runs. PERF-2 remains unchecked; DATA-3 remains blocked. Real 166/347/564 MB acceptance stays with Yash; missing sources remain unmeasured and journals private.

## Local synthetic attribution (23 October)

All 22 numeric samples and five isolated Playwright controls were recorded locally (raw sample files are not committed). Frozen invented 171,108,013 / 374,361,644 / 600,021,470-byte inputs; same built UI and Node 24.11.1 / headless Edge / i7-13650HX, 20 logical CPUs, 23.7 GiB RAM. Five alternating off/on browser and five alternating off/on complete-import pairs at 171 MB, plus one diagnostic browser sample at each larger size. Background CPU observations were 13.35%, 17.46%, 17.91% before this run: this machine was **not idle**. No competing Drishya test/build/benchmark was run during the matrix, but OS load, power and thermals were uncontrolled. These are attribution and overhead observations, never real-journal acceptance.

Each cell is p50 / p95 across five fresh-process runs (nearest rank). API values are aggregates of each run's unchanged 20-request p95, not a pooled request percentile.

| Mode / diagnostics | Import ms | First page ms | RSS MiB | API p95 ms | Visible update ms | Append loop max ms |
|---|---:|---:|---:|---:|---:|---:|
| browser / off | 7905.9 / 8296.5 | 7682.4 / 8304.0 | 456.8 / 483.9 | 679.6 / 949.6 | 6306.5 / 6479.2 | 284.3 / 329.7 |
| browser / on | 8095.5 / 9590.0 | 7274.5 / 11398.4 | 458.4 / 475.1 | 668.9 / 1025.6 | 6252.5 / 6590.3 | 258.2 / 307.5 |
| complete import / off | 6170.1 / 10832.9 | 4085.8 / 9759.3 | 368.4 / 376.1 | — | — | — |
| complete import / on | 10294.2 / 11744.3 | 9443.6 / 12037.9 | 350.7 / 389.0 | — | — | — |

Diagnostic overhead is material and variable: complete-import median rises from 6170 to 10294 ms. Do not use diagnostic-on timings as equivalent to normal performance or subtract overhead to pass a gate. Original process RSS includes all diagnostic/client allocation. Every run preserves zero gaps and idempotent rescan; all browser appends match fresh-import IDs/order with no concurrent captures.

### Phase and isolate observations

First 171 MB diagnostic browser sample. Heap columns are maxima within a phase; residual is evaluated at its RSS peak using preceding samples and is not additive with those maxima. Missing/stale samples and their lags are in the numeric data.

| Phase | Peak RSS MiB | Main used heap max MiB | Worker used heap max MiB | Unassigned at peak MiB |
|---|---:|---:|---:|---:|
| prefix-import | 289.88 | 104.21 | 0.00 | 52.08 |
| first-history-page | 360.45 | 65.63 | 68.35 | 65.21 |
| browser-open | 439.70 | 130.84 | 69.92 | 111.16 |
| append | 451.02 | 148.77 | 70.64 | 88.97 |
| reader-update | 472.38 | 165.45 | 79.73 | 114.85 |
| probe-drain | 448.37 | 157.14 | 64.61 | 82.21 |

All three SQLite connections report cache_size=-8192 (8 MiB advisory each), mmap_size=0, page_size=4096; source/main temp_store=1, derived temp_store=0. The measured native residual is much larger than the combined 24 MiB advisory cache, so lowering these values cannot be assumed to recover that residual. Worker cached projection and incremental reducer are resident; their presence alone does not prove disjoint allocations. The main Ingestor cache is capped at two / 20,000 observations, and large paged routes already use the worker; its full projection is still needed for explicit small/full-projection and export paths. Do not remove it based solely on process heap totals.

### Interaction attribution

| Synthetic bytes | Handler p95 ms | Page after network p95 ms | Original API p95 ms | Append loop max ms | Visible update ms | RSS MiB |
|---|---:|---:|---:|---:|---:|---:|
| 171108013 | 0.82 | 726.90 | 732.40 | 237.69 | 5902.59 | 472.38 |
| 374361644 | 0.52 | 124.60 | 282.00 | 131.66 | 3340.16 | 548.21 |
| 600021470 | 0.90 | 41.50 | 487.30 | 386.04 | 7910.70 | 642.82 |

The first sample has 1.328 s script, 1.571 s style, 0.327 s layout and 4.394 s total page task time, 71 layouts / 176 style recalculations. The handler is quick after dispatch; pre-dispatch daemon queuing is excluded. Post-network page delay and Long Task overlaps support investigating page scheduling, alongside independently measured daemon stalls. These are overlapping observations, not a subtractable causal partition or proof that all delay is React.

### In-process Playwright cost (included)

The five separate fresh-process controls load the App module without constructing a store or ingesting. Explicit GC is used **only in this isolated control**, before import and after setup, to expose retained heap; no benchmark forces GC. Median / p95 client-ready minus pre-import post-GC RSS is 77.0 / 77.9 MiB; retained used-heap delta is 39.6 / 39.6 MiB. In the populated first browser run the raw net RSS increase before navigation is 10.77 MiB. Concurrent GC/allocator reuse makes that raw net delta much smaller; both controls are reported, neither is subtracted. Chromium/GPU remains outside the original process RSS.

Reproduce the isolated control in a fresh node --expose-gc process: import App (do not instantiate), force GC and sample process.memoryUsage/getHeapStatistics; dynamically import @playwright/test, sample raw/after GC; launch Edge, create context/page without navigation and sample raw/after GC. Close the browser. Repeat five times. The committed numeric controls contain every checkpoint.

## Follow-up validation

Both project typechecks and **757 tests in 142 files pass**. A startup race found during validation is handled by reporting no worker heap before its online event; diagnostics never creates a worker. Earlier full-check Git-review timeouts pass unchanged in the final rerun; no unrelated assertion or timeout was changed. Full Edge browser suite: **296 passed, 26 skipped, no failures (16.1 minutes)**. Package and ten-minute checks plus the clean-main comparison remain pending before readiness. The frozen performance samples above precede this startup-only diagnostic availability guard and strict type annotations; they are not silently relabelled as later-head runs.
