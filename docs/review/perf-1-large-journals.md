# PERF-1 — retained large Codex journals

20 October 2026. Benchmark only; no capture, schema, adapter or UI runtime change. DATA-1/2 owners retain those files.

The benchmark uses the actual retained large journals identified by audit123, with native sources opened read-only. The journal formerly described as232MB has grown to approximately347MB. Raw journal text, local source paths and captured titles are absent from this report and the numeric results.

## Method

- Windows10.0.26300, Intel Corei9-14900HX (32 logical CPUs),31.6GiB RAM, Node24.14.0. Installed Edge155.0.4283.62, headless1440×900, default resource/motion settings. Active Windows power scheme reports Performance; background development activity and thermal/load conditions are not controlled.
- Five independent Node processes per source and condition. Fresh disposable stores every run. The OS file cache is not flushed: the first observed run is listed separately and repeat numbers are warm-cache candidates, not certified cold-start measurements. No source/session data is committed.
- A bounded backwards scan freezes the last complete JSONL line at the observed size. The probe streams that prefix to a disposable snapshot; ongoing native appends are excluded. The original is never modified. Raw snapshots and redacted stores are removed on normal/error completion (forced process termination may leave a temporary directory).
- **Complete import:** import the whole snapshot through the shipped adapter → privacy seal → SQLite/blob path; time import and first one-passage history projection separately. A second sync must add zero observations. Peak RSS includes the history worker and its first page, not just ingest. It excludes browser processes.
- **Append + browser:** bulk import everything except the last16MiB (10% for smaller sources), open the actual recording, append the withheld real bytes to the snapshot, and catch up using16MiB turns. Normal viewer catch-up remains enabled and serialized through the existing ingest lock; `concurrentCaptured` records observations consumed by those requests instead of the manual probe. All observation IDs and order must equal a separate fresh full import. Gap totals must agree, and a repeat sync must add nothing.
- During append, the actual browser requests `/v1/recordings`20times,50ms apart, and alternates48px history scrolls. Report API round-trip and requestAnimationFrame gaps; these are automation proxies, **not** human interaction latency or a60fps certification. Headless Windows can produce sub16ms frame gaps. Maximum gaps matter even when p95 is small. The probe includes browser opening and append activity in sampled daemon RSS; separate browser/GPU memory is not measured.
- RSS uses the existing separate worker sampler every20ms so synchronous ingestion stalls do not hide peaks. Event-loop excess is a20ms timer proxy, not tracing. Projection/import/sync use production owners; no full in-memory projection is added by the benchmark.
- Synthetic regression exercises a partial final write, a split through a large output record, both probe modes, exact observation accounting and original-byte preservation. Both TypeScript checks and focused JSONL/ingest/benchmark tests run locally. Hosted CI is not invoked.

## Reproduction

Run from the repository root, with an approved retained local journal path. No native turn, external model or harness settings change is involved.

```powershell
node scripts/bench-real-journals.ts --runs 5 --full-import <journal-path> [<other-journal-path> ...]
$env:DRISHYA_BROWSER_CHANNEL='msedge'
node scripts/bench-real-journals.ts --runs 5 --browser <journal-path> [<other-journal-path> ...]
```

Run the two conditions sequentially. Source identities in numeric output are positional1/2/3 rather than native paths. Measurement results apply to the current adapters; rerun after DATA-1/2 because more retained evidence changes workload size, storage and projection cost.

## Results

All30 measured runs completed with **zero adapter-reported capture gaps**. All15 append runs matched a fresh full import by observation IDs and order. This validates the current adapter's output, **not** complete coverage of every typed harness event: DATA-1/2 remain independent open capture work.

Times below are p50 / nearest-rank p95 across five runs. With n=5, p95 is the maximum; this is a small local sample, not a population estimate. Sizes are decimal MB. The middle source was still growing, so its exact frozen byte count and observation count vary slightly between runs. See [all numeric samples](perf-1-large-journals-results.json).

| Source | Whole import seconds | First history page seconds | Peak daemon RSS MiB | Whole-import first run seconds |
|---|---:|---:|---:|---:|
| 166.4MB | 0.98 / 0.99 | 0.92 / 0.97 | 375.90 / 383.54 | 0.99 |
| 347.0MB | 2.07 / 2.27 | 3.55 / 3.80 | 401.95 / 402.88 | 2.07 |
| 563.8MB | 4.64 / 4.96 | 6.35 / 6.82 | 504.82 / 528.73 | 4.64 |

| Source | Bulk prefix seconds | Append catch-up ms | Warm indexed browser open ms | Peak daemon RSS MiB | API p95 per run ms | Worst browser frame gap ms |
|---|---:|---:|---:|---:|---:|---:|
| 166.4MB | 0.90 / 0.90 | 315.91 / 334.37 | 417.46 / 556.43 | 425.34 / 468.36 | 192.40 / 292.60 | 221.0 |
| 346.8MB | 1.96 / 2.09 | 246.06 / 336.23 | 752.73 / 845.40 | 439.74 / 457.46 | 158.30 / 407.20 | 154.4 |
| 563.8MB | 5.00 / 5.21 | 387.56 / 536.77 | 820.63 / 1062.96 | 500.48 / 512.66 | 386.00 / 464.90 | 258.3 |

The browser condition opens **after** the first history page has been indexed; its open number is deliberately warm and does not replace the initial page cost. Frame/API samples finish before the independent full-import validation. The diagnostic Node event-loop timer covers the whole probe including validation, so its maxima must not be presented as append-only UI latency.

## Gate and next work

**PERF-1 measurement is complete. The scale/resource gate is not green.** The largest whole-import run peaks at528.73MiB (512MiB reference screening budget); initial history indexing takes up to6.82s. During actual append reading, per-run API p95 reaches464.9ms, with a1261.8ms maximum request and a258.3ms browser frame gap. These automation proxies expose stalls; they do not establish a passing p95 human interaction score. No loss, duplicate or adapter-reported gap was observed.

`PERF-2` in TASKS owns restoration/retest. Before new feature work, coordinate with DATA-1/2 and measure their merged evidence-retention path. Compare bounded bulk batches/yields and first-history indexing without lowering material fidelity or record limits. Preserve full-import identity/order, then measure actual interaction and visible update latency under controlled load. The current headless reference run does not certify physical lower-resource machines, browsers/platforms, reduced resources or human ten-minute acceptance. Those remain REL-2/REL-3.

Local validation:679 integrated units and36 focused JSONL/ingest/probe checks, both project TypeScript checks and the script's direct ES2023 typecheck; final integrated checks are recorded in STATUS. No hosted CI, schema/dependency change, native turn or production runtime edit. Main #172's TodoWrite UI-only integration does not change the capture path measured here. The built UI bundle stays fixed throughout the append matrix; DATA-1/2 have not yet merged.

