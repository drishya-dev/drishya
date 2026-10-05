# B4 measurement and packed-install record

**5 October 2026.** This is a bounded B4 slice, not a scale certification or public release. The repeatable probe is `node scripts/bench-b4.ts --observations 10000 --files 5000 --repeats 5`. It creates only invented Codex-format call/result records and a 5,000-file TypeScript tree in a temporary directory, then measures one-time import (including projection), final scene composition, current-repo graph indexing and process memory after those phases. It removes the temporary source/store. This *skinny synthetic* journal has much less content than a typical 1 GiB real journal; these numbers cannot stand in for burst, browser, passive-overhead or real-session measurements.

Reference machine: Windows x64, Node 24.14.0, Intel Core i9-14900HX (32 logical CPUs), 31.6 GiB RAM. Power mode was not recorded; Chrome/JS heap was not measured. The following five-run result was taken **before** the reducer's long-session quadratic paths were fixed, so it remains a baseline rather than a post-fix claim:

| Workload | Metric | p50 | p95 |
|---|---|---:|---:|
| 10,000 call/result observations, 5,000 eligible files | Full import + projection | 2.92 s | 3.19 s |
| Same | Final scene composition | 22 ms | 24 ms |
| Same | Current-repo graph build | 6.41 s | 6.76 s |
| Same | RSS after work | 225 MiB | 265 MiB |
| Same | V8 heap after work | 40 MiB | 76 MiB |

A **single** 100,000-observation, 1,000-file run exposed a red long-session gate: initial import 91.1 s and RSS about 752 MiB. CPU profiling found repeated scans of the entire operation set for each result and passage-end lookup. The reducer now indexes result groups and passage ownership, and appends per-agent operations instead of copying arrays. A follow-up single run imported in 23.2 s (about 4× faster) but still used about 764 MiB RSS after work. This does not meet a long-session bounded-resource claim. The workload was not a 1 GiB source, and single runs have no p95. The current UI still requests a full projection and composes it on the browser main thread. Those are architectural B4 blockers for 100k history, regardless of the faster reducer.

The next scale work should separate capture from projection CPU on a worker with one writer/shutdown owner, add a disk-backed paged history/projection reader and move composition of bounded windows off the browser main thread. Measure source flush-to-DOM latency and browser JS heap, including a 2,000-event/30s burst, before claiming the numeric gates. Do not add premium visual features while these gates remain red.

## Local package probe

`pnpm package:verify` builds the UI, bundles the backend's workspace imports to ordinary JavaScript, packs `dist/package` as an **unpublished** `@drishya-dev/cli` tarball, installs it offline in a clean temporary directory, and checks both synthetic harness imports, a synthetic demo bundle, first launch, served UI and authenticated local API. The package contains no runtime dependencies or workspace symlinks. The Node 24 requirement and Apache-2.0 license are in its manifest. CI now runs this same probe on Windows, Linux and macOS; cross-platform passage is pending until those jobs pass.

For a developer checkout, use Node 24 and the pinned pnpm version, `pnpm install --frozen-lockfile`, `pnpm ui:build`, then `pnpm serve`. Data defaults to `~/.drishya` and may be redirected with `DRISHYA_HOME`. Uninstalling the CLI package does **not** remove that local data directory; removing recordings in the app/CLI is a separate action. No npm package has been published, and a packed-install probe is not a release authorization. Release still needs restart/offline/retention and opt-in real-harness checks on each supported platform, plus checksums/provenance and the browser/resource gates above.
