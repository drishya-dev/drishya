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

- [Before 1440](perf-2-diagnostics-visuals/before-1440.png) / [after 1440](perf-2-diagnostics-visuals/after-1440.png)
- [Before 390](perf-2-diagnostics-visuals/before-390.png) / [after 390](perf-2-diagnostics-visuals/after-390.png)

The inherited isolated probe blocks refresh/live/native routes; the refresh-denial banner and unavailable connection are visible on both captures. They were not hidden or changed to improve measurements. This is parity evidence for the existing isolated scenario, not human acceptance of a normal native session.

## Status

Focused checks cover response/body parity even when the diagnostic callback throws, bounded numeric probe IDs, no worker creation from diagnostics, no future heap attribution, and unchanged source bytes/IDs/rescan behavior with diagnostics off/on in both import modes. Script typechecks pass with erasable syntax enforced. A 2 MB invented smoke completes with all 20 correlated requests and Long Tasks support; it is setup validation, not gate evidence.

Full before/after diagnostic-overhead measurements, broad checks and the reference-machine handoff will be added to this report. #188 remains frozen awaiting real non-regression runs. PERF-2 remains unchecked; DATA-3 remains blocked. Real 166/347/564 MB acceptance stays with Yash; missing sources remain unmeasured and journals private.
