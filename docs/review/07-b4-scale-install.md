# B4 measurement and packed-install record

> **5 Oct implementation amendment:** [08: bounded history reader](08-b4-history-reader.md) is current for worker ownership, streaming/indexed history, internal reader APIs and measured release limits. Earlier full-projection and deferral statements below are historical.


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

### Second measured slice (5 October)

The repeatable normal probe now includes one prose observation per 100 tool records. Five runs on the same reference machine gave full import p50/p95 **1.019/1.098 s**, final composition **8.87/10.05 ms**, 5k-file graph build **3.15/3.54 s**, and end-of-work RSS **295/301 MiB**. These repeat inside one process; the memory number is sampled, not peak. A deterministic composer lookup change removed repeated passage and turn scans without changing golden scenes.

An opt-in Chromium probe (`node scripts/bench-browser.ts` after UI build; use `DRISHYA_BROWSER_CHANNEL=chrome` for installed Chrome) starts the real local server and app against invented journal records. With 10k initial records and five manually synced 200-record additions, source append to settled DOM was p95 **681 ms**, browser used JS heap **36 MiB**, daemon RSS **424 MiB**. Ten 200-record additions over 30 seconds through passive live tailing settled in **596–889 ms** (p95 **889 ms**) without lost or duplicate observations, ending at browser heap **51 MiB** and daemon RSS **379 MiB**. This measures a single warm run of ten bursts, not five independent 30-second runs. The browser was 1440×900, map off, reduced motion. DOM node count stayed at 766.

Long history is still **red**. A single 100k-record browser open took ~1.55 s and held ~106 MiB used JS heap / ~626 MiB daemon RSS. A subsequent 200-record update took **4.35 s** to settle and reached ~206 MiB browser heap / ~705 MiB daemon RSS. The browser still receives and composes the full projection on its main thread, and ingestion rebuilds the entire projection after each commit. Virtualized DOM alone is insufficient. This is an architectural blocker; the small performance patches above do not close it.

Two separate source probes clarify the read boundary. `node scripts/bench-adversarial.ts` used a sparse, invalid 2 GiB logical source with one oversized line: 32 bounded turns, exactly one gap, ~1.69 s, sampled RSS ~122 MiB. `node --expose-gc scripts/bench-valid-source.ts 1024` used a **physical valid** 1 GiB Codex-format journal: 51,971 observations, 25,985 operations, zero gaps, ~46.9 s import, RSS ~1,972 MiB before and ~1,694 MiB after GC. A valid 512 MiB source reached ~1,025 MiB RSS without explicit GC; with a 512 MiB V8 heap limit it ran out of memory. These are single runs on synthetic repeated outputs, not a production limit. They prove read correctness but disprove a bounded-memory claim for long valid sessions.

The eventual scale work must separate capture from projection CPU with a single writer/shutdown owner, persist a disk-backed history index with paged projection reads, and compose only bounded windows away from the browser main thread. Preserve full-history search and evidence links while paging. Repeat the 100k burst and 1 GiB valid-source probes before calling that scale gate complete. The builder's priority change below allows product experience work in the meantime.

**Priority change, 5 October (builder):** This long-session optimization may follow the next product-experience work. The failure is not only slower initialization: each live addition to a long recording triggers a full projection rebuild, full API transfer and browser composition, while large valid imports can push process memory close to 2 GiB. Fixing it later is technically feasible, but will require a migration to paged/disk-backed history and worker-owned reduction. Keep a replaceable UI source/API boundary and stable evidence IDs and step positions now; avoid features that require all history in browser RAM. Until that migration passes the same probes, describe large sessions as unverified/slow and do not mark B4 or broad release complete. The earlier blanket pause on visual features is superseded by this bounded builder decision; outstanding release checks still apply.

## Passive capture overhead (5 October)

`node scripts/bench-overhead.ts` runs a synthetic agent in its own process: steady CPU work, plus Codex-format journal appends after each record pair. It times the agent alone, with Drishya tailing live (750 ms passive polling, the shipped default), and with Drishya plus a browser viewing the recording (`--browser`). Conditions rotate order every run. Every observed run must capture exactly what a fresh import of the finished journal yields. The same reference machine was used; the browser was installed Chrome at 1440×900.

| Workload | Condition | Median agent time (min–max) | Median slowdown | Lost / duplicate |
|---|---|---|---|---|
| 8,000 records, 2 ms work per pair, 5 runs | baseline | 10,279 ms (10,068–10,759) | — | — |
| | observer | 10,251 ms (10,133–10,506) | −0.3% | 0 |
| | observer + browser | 10,508 ms (10,407–10,690) | +2.2% | 0 |
| 20,000 records, write-bound (0 ms work), 5 runs | baseline | 1,857 ms (1,827–1,948) | — | — |
| | observer | 1,842 ms (1,811–1,864) | −0.8% | 0 |

**Within the proposed budget** (<5% median slowdown, no lost events). The baseline's own run-to-run spread (about 7% in the first workload) exceeds the observer-only difference, so that result means "not measurable here", not "negative cost". **Limits:**
- This is a 32-logical-CPU machine. Contention on a 4–8 core laptop is untested and could be higher; the observer's projection rebuild competes for the same cores.
- Session sizes are normal (8k–20k records). Long-session live cost is the separate red 100k gate above.
- Cold and warm cache were not separated beyond the rotation.
- `apps/daemon/test/overhead.test.ts` keeps the probe working (a tiny workload, no lost events); it does not assert timing.

## Local package probe

`pnpm package:verify` builds the UI, bundles the backend's workspace imports to ordinary JavaScript, packs `dist/package` as an **unpublished** `@drishya-dev/cli` tarball, installs it offline in a clean temporary directory, and checks both synthetic harness imports, a synthetic demo bundle, first launch, served UI, authenticated local API and a second launch with recordings still present. The package contains no runtime dependencies or workspace symlinks. The Node 24 requirement and Apache-2.0 license are in its manifest. The initial probe passed CI on Windows, Linux and macOS in PR #16; the restart extension passed those three package jobs in merged PR #17. Windows/Linux browser and check jobs also passed.

For a developer checkout, use Node 24 and the pinned pnpm version, `pnpm install --frozen-lockfile`, `pnpm ui:build`, then `pnpm serve`. Data defaults to `~/.drishya` and may be redirected with `DRISHYA_HOME`. Uninstalling the CLI package does **not** remove that local data directory; removing recordings in the app/CLI is a separate action. No npm package has been published, and a packed-install probe is not a release authorization. Release still needs restart/offline/retention and opt-in real-harness checks on each supported platform, plus checksums/provenance and the browser/resource gates above.
