# PERF-2 — bounded JSONL material batches

20 October2026. PR174; scoped to JSONL reader batching and regression tests. No event schema, native policy, adapter, ingest/store/daemon, presentation or dependency changes.

## Change

`readJsonl` retains its64MiB hard default read ceiling and16MiB individual-record limit. It may now return earlier, **after a complete record**, once4MiB of source bytes have been consumed. This bounds the raw observation array handed to sealing/storage. An individual valid record can exceed the soft batch size; it is never cut or converted into an oversized gap just because of batching. Existing callers already continue from the committed cursor and yield between batches.

The soft budget starts from the post-reset cursor, so truncating/replacing a source cannot accidentally inherit the old generation's offset. Oversized gaps, UTF-8 byte addressing, incomplete final writes and capture identities retain their prior semantics.

## Measurement

Uses the exact real-journal probe from PR171, on the stable563,751,533-byte source. Five **rotated paired** comparisons: before→after for odd runs, after→before for even runs. Each condition gets a fresh process and disposable store. Only the JSONL module changes: a Node24 `registerHooks` resolve hook substitutes the unchanged baseline module for the before condition. It is diagnostic tooling only, never installed in the product.

The baseline module comes from main4f92288; the after module is the change in this PR. Both use the same current daemon/scene code (including merged READ-6), browser bundle and benchmark. Thus absolute times should not be compared directly to PR171's earlier measurements. Background parallel development load and OS cache/thermals are uncontrolled. Reference machine and headless Edge settings match PR171; warm indexed UI opening and API/frame sampling have the same qualifications.

Every condition must retain8,803 observation IDs in the same order as a separate full import, report zero adapter capture gaps and add nothing on repeat sync. This checks current-adapter semantics; it does not close DATA-1 typed coverage.

All10 conditions retained8,803 observations, matched a separate full import by ID/order and reported zero gaps. [Raw numeric samples](perf-2-jsonl-batches-results.json) contain no source text/path/title.

| Metric | Before p50 / p95 | After p50 / p95 |
|---|---:|---:|
| Peak daemon RSS MiB | 514.50 / 521.41 | 389.52 / 406.42 |
| Bulk prefix import ms | 7123.48 / 7537.05 | 8137.88 / 8714.62 |
| Initial history page ms | 8501.13 / 10070.14 | 8981.53 / 9974.18 |
| Manual append catch-up ms | 740.96 / 1032.79 | 454.13 / 1460.28 |
| Browser API p95 within each run ms | 496.00 / 673.20 | 511.10 / 687.90 |
| Worst browser frame gap within each run ms | 199.90 / 283.50 | 216.60 / 233.40 |
| Whole-probe event-loop excess maximum ms | 1574.71 / 1839.46 | 515.53 / 621.70 |

The median daemon peak falls **24.3%**, and all after samples stay below512MiB. That is a measured improvement for this journal, not whole-matrix certification. The bulk prefix median is **14.2% slower** in this noisy comparison; no throughput win is claimed. API/frame proxies still miss responsiveness targets. The whole-probe event-loop number also includes independent reference validation and cannot be called append-only latency. With five samples per condition, nearest-rank p95 is the maximum.

**Review tradeoff:** reduced temporary memory and shorter maximum main-loop stalls versus more batches and possible import/catch-up overhead. Do not present this as completion of PERF-2 or unconditionally prefer the batch size before latency profiling/retest on DATA-1/2. A single valid16MiB record can still require synchronous parsing/sealing; record limits and all captured text are intentionally preserved.


## Reproduction

Use `scripts/bench-real-journals.ts` from PR171 once it merges. For a before run, extract `4f92288:packages/capture-core/src/jsonl.ts` into an ignored temporary folder alongside this hook:

```js
import { registerHooks } from 'node:module';
const baseline = new URL('./jsonl-before.ts', import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  const result = next(specifier, context);
  return result.url.endsWith('/packages/capture-core/src/jsonl.ts')
    ? { ...result, url: baseline } : result;
}});
```

Run `node --import <hook-path> scripts/bench-real-journals.ts --worker --source <approved-journal> --browser` for before, omitting `--import` for after. Set `DRISHYA_BROWSER_CHANNEL=msedge`. Repeat five pairs, alternating order; never run conditions concurrently. Numeric output contains no native path/title/content. Temporary source snapshots/redacted stores are cleaned by the shared probe; no native source writes or native turns.

## Remaining gate

**PERF-2 is not complete.** This is a bounded reader improvement, not proof of the full responsiveness/resource acceptance. Remaining ingest/sealing, storage and first-history costs overlap DATA-1/2's claimed files. Coordinate those changes and rerun the whole matrix after their merge; preserve individual record limits and evidence fidelity. Actual interaction/visible update acceptance and physical REL-2/REL-3 checks remain separate from headless proxies. Do not start new feature work under a red performance gate.
