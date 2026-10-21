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
