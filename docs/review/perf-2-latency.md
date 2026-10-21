# PERF-2 follow-up: history rebuild and ingest stalls after DATA-1/2

21 October 2026 · Yash with Claude (Opus 5.5) · branch `yash/perf-2-latency`

## What changed in the workload

DATA-1/2 retain typed Codex items, so the 563.8 MB reference journal now yields **26,593** observations (8,803 in PERF-1). Measured on 20 October with the same benchmark (`scripts/bench-real-journals.ts`, two runs each): whole import ≈ 7.0 s, first history page ≈ 6.6 s, RSS 415–428 MiB on import and **531–545 MiB** with append + browser, API p95 during append 139–214 ms, event-loop max ≈ 215 ms. Browser frames were fine (max 33 ms).

## Where the time went

A CPU profile of the history worker's cold build (first page) split the 6.6 s as:

| Stage | Time |
|---|---|
| Ordered read of observations (`orderedObservations`) | 0.66 s |
| Reducer logic | ≈ 1.8 s |
| Derived blob reads | ≈ 0.23 s |
| **Derived blob writes** | **≈ 2.7 s**: 6,798 `put` calls, 5,420 distinct, ≈ 4,400 new files / 90 MB, each an exists check, mkdir, temp write and rename |

During a live tail, each sync turn sealed and stored a whole ≤ 4 MiB read at once, holding the daemon thread for 110–150 ms (SQLite append ≈ 46 ms of it).

## Changes

1. **Derived blobs are rows, not files.** `BlobStore`'s file access goes through five overridable primitives; `SqliteBlobStore` keeps the worker's derived blobs in its own `index.db` (`synchronous=NORMAL`, a rebuildable cache). Line slices and resumed search are byte-identical to the file store (new parity test). `HISTORY_VERSION` h2 rebuilds old views; the old `history/blobs` directory is removed. A build-wide write transaction was tried and dropped: it made the ordered read slower.
2. **The ordered read sorts row ids, not bodies,** then fetches each body by id. 666 → 450 ms on 26k rows, identical order.
3. **Ingest seals and stores a read in 1 MiB slices,** committing the cursor after each and yielding between them. Observation ids are unchanged (they come from byte offsets); every run verified identical ids and order against a fresh full import.

## Results

The machine was heavily loaded on 21 October (a game running, CPU ≈ 59%), so absolute times are about 2.5× the 20 October numbers and only **paired, alternating** runs are compared. 563.8 MB journal, `--browser` mode, one run per variant, alternating twice:

| Variant | First history page s | Peak RSS MiB | Tail catch-up s | Event-loop max ms | API p95 ms | Frame max ms |
|---|---:|---:|---:|---:|---:|---:|
| main | 21.17 | 497 | 0.69 | 618 | 781 | 339 |
| branch | **12.59** | **472** | 1.09 | 571 | 917 | 334 |
| main | 20.67 | 465 | 0.65 | 576 | 1020 | 313 |
| branch | **11.01** | **451** | 1.18 | 538 | 1098 | 407 |

- **First history page ≈ 43% faster** in both pairs, and RSS lower in both.
- Tail catch-up is slower (more commits and yields) but stays under the 1.5 s visible-update target.
- Event-loop maxima improved a little. Tail-only profiles: the longest block fell from ≈ 440 ms to ≈ 310 ms; what remains is redaction while sealing (necessary) and SQLite's commit-time WAL checkpoint (not changed here).
- **API p95 is not established:** under this load both variants measure 0.8–1.1 s, so the run cannot show whether slicing helped the < 100 ms target.

## Gate status

Not green. The interaction target (p95 < 100 ms) and the large-journal targets must be re-measured on an unloaded machine with five runs per source, as in PERF-1. Remaining candidates: checkpoint scheduling (`wal_autocheckpoint` plus an idle checkpoint), keeping the cold build's reducer and projection from both staying resident, and moving sealing off the daemon thread.

## Idle re-measure against the targets (21 October, after #176)

The machine was idle (CPU load 9% at start, test runs stopped). `scripts/bench-real-journals.ts`, five runs per source and mode; p50 / nearest-rank p95 (with n = 5, p95 is the maximum). [Raw runs](perf-2-latency-results.json).

| Source | Whole import s | First history page s | Peak RSS MiB (import) | Observations |
|---|---:|---:|---:|---:|
| 166.4 MB | 1.79 / 1.94 | 1.39 / 1.74 | 326 / 389 | 7,418 |
| 347.9 MB | 4.72 / 5.17 | 4.44 / 4.51 | 380 / 416 | 16,480 |
| 563.8 MB | 10.43 / 11.10 | 7.90 / 8.06 | 472 / 475 | 26,593 |

| Source | Tail catch-up ms | Warm open ms | Peak RSS MiB (append + browser) | API p95 ms | API max ms | Frame max ms |
|---|---:|---:|---:|---:|---:|---:|
| 166.4 MB | 732 / 829 | 752 / 881 | 433 / 460 | 294 / 389 | 838 / 965 | 337 / 459 |
| 347.9 MB | 284 / 410 | 827 / 1059 | 476 / 492 | 172 / 445 | 200 / 1045 | 100 / 171 |
| 563.8 MB | 686 / 720 | 1073 / 1154 | **529 / 573** | **145 / 160** | 292 / 307 | 17 / 21 |

Every append run matched a fresh full import (ids, order, gaps).

**The long matrix ran slower than the paired check right after it,** so for the effect of the fixes use the alternating head-to-head on the 563.8 MB complete import (same idle machine, minutes apart):

| Code | Whole import s | First history page s | Peak RSS MiB |
|---|---:|---:|---:|
| before the fixes (`7f11225`) | 7.33 / 7.24 | 6.83 / 6.84 | 417 / 427 |
| main after #176 | 7.25 / 7.17 | **4.09 / 3.96** | 473 / 484 |
| main, derived blobs back in files (diagnostic) | 7.55 / 7.26 | 6.27 / 6.47 | 433 / 471 |

The first history page is about 41% faster and import time is unchanged; the row-backed derived blobs account for nearly all of it. Peak RSS in complete-import runs reads higher after the fixes, but repeated runs of one variant differ by up to 40 MiB, so this sample cannot attribute it.

### Against the reference targets

| Target | Result | |
|---|---|---|
| Visible update < 1.5 s | tail catch-up 0.28–0.83 s, warm open 0.75–1.15 s | **pass** |
| Interaction p95 < 100 ms (automation proxy: API round-trip during append) | 145–294 ms p50, up to 445 ms | **fail** |
| Peak RSS ≤ 512 MiB | complete import ≤ 475 MiB pass; append + browser on 563.8 MB 529 / 573 MiB | **fail** |
| First history page (no fixed target; was 6.6 s) | 1.4 / 4.4 / 7.9 s p50 in the matrix; 4.0 s head-to-head | improved |

**The gate stays red** on interaction latency and append + browser memory. Next, in order: (1) find what holds the daemon thread during append besides ingest. The API p95 is worst on the smallest source, where the tail is a larger share of the work, so profile the `/v1/recordings` path and the worker-to-main page transfer during a tail. (2) Measure the history worker's resident set during append + browser: the reducer and the cached projection both stay resident. (3) Then re-run this matrix.
