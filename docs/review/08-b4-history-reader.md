# B4: bounded history reader and release evidence

Implementation and local validation: 5 October 2026. This amends the historical [B4 measurements](07-b4-scale-install.md). The builder resumed B4 optimization before further premium experience work; the earlier deferral is superseded.

## Result and scope

The integrated app no longer sends a complete projection to the browser for a large recording. Capture commits sanitized observations independently, a worker derives history, and the browser requests nearby passages and bounded artifact slices. Scrolling back keeps the reader in place while capture continues. Optional sequence replay still uses global, deterministic as-of steps. This changes the reader boundary, not the captured observation schema or the observe-only product.

Reference-machine normal and long-session probes pass their measured latency gates. This is an engineering candidate, **not broad release certification**: physical 8 GiB/integrated-GPU and lower-core hardware validation remains outstanding. Synthetic package CI is necessary but does not certify real harness discovery on every operating system. Do not describe all remaining product work as cosmetic frontend work.

## Ownership and data flow

1. The ingestor remains the sole writer of captured observations, source cursors and revisions in `drishya.db`. Redaction and protected-file suppression happen before this store and its blobs. Ingest obtains session-list metadata through SQL, rather than rebuilding every previous operation after a commit.
2. Store schema 3 adds an internal `clock_time` column. JavaScript normalizes valid source timestamps, preserving the original `sourceTime` in the captured JSON. SQL carries the most recent timed **sequence** forward for missing/invalid timestamps, then orders by effective time, sequence and selected-recording rank. This matches the reducer's ordering, including backwards clocks and fractional seconds. Migration streams existing rows; it does not rewrite source journals or invent timestamps in captured evidence.
3. `HistoryService` lazily starts one worker. The worker reads captured SQLite through a read-only connection and owns a separate derived `history/index.db` and `history/blobs/`. The daemon's event loop and capture do not perform history composition. The worker has a 384 MiB old-generation and 16 MiB young-generation heap limit; these are **not process RSS limits**. A failure rejects reader requests, is visible in the UI, and can be retried without stopping capture.
4. The worker stores versioned view headers and ordered operation, prose, artifact, relationship, passage and timeline items. Its revision fingerprint includes selected-recording revisions, live state, reducer version `r2` and history format `h1-4096`. An unchanged view can be restored from this index after restart. Derived data is replaceable; the sanitized observation store is authoritative.
5. At most one complete metadata workspace is retained in the worker. A single-recording reducer can append warm batches of up to 10,000 observations when timestamps are valid and do not precede its frontier, and no new workspace context appears. Late, missing-time, backwards-time, new-root or larger batches rebuild through repeatable streaming reads. Combined recordings also rebuild through ordered streaming reads. Correctness wins over a speculative incremental merge.
6. The browser automatically chooses the paged API above 10,000 observations **or** 32 MiB of committed source offsets across its selection. Source bytes are a routing hint, not a recording's retained-storage size. Small sessions and offline bundles retain the compatible complete-projection path. Large-session graph metadata, artifact lookup, briefing facts and model request preparation use the worker boundary as well.

The reducer does not retain complete read bases or source/result observations after completion. Full read bases live in content-addressed blobs. Preview substrings are explicitly copied so a tiny preview cannot keep a giant source string alive. Snapshot cloning copies mutable objects while sharing immutable strings; completion and late-record tests compare the result with a fresh reduction.

## Reader API and navigation

These are internal presentation APIs; they do not freeze or extend the captured observation contract.

| Endpoint | Purpose |
|---|---|
| `POST /v1/recordings/:id/history` | Window by passage start/count, selected operation, observation or replay step; filter and up to three pinned passages |
| `GET /v1/recordings/:id/summary` | Whole-view deterministic facts, optionally from a global step |
| `POST /v1/recordings/:id/history-marker` | Exact next/previous edit, failure or other supported marker across the complete timeline |
| `GET /v1/recordings/:id/file-operations` | Global file history, server filtering and bounded pagination; respects replay step |
| `GET /v1/storage` | Explicit own-store usage and advisory budget |

Existing artifact, search, graph and model endpoints remain authenticated and local. Query validation rejects invalid offsets, steps, filters and identifiers. Selection is capped at sixteen recordings. Pages contain 32 passages by default, at most 64 requested passages plus three pins. They carry global scene totals, stable unloaded passage identities, nearby content, the last 128 timeline entries, incident typed links and references needed to navigate evidence outside the loaded window. The filmstrip samples at most 500 markers; exact next/previous navigation uses the worker rather than that sampled list.

Long single-agent runs are partitioned at 32 operations or 16 consecutive prose entries so one captured passage cannot force every action into the browser. These are presentation boundaries, not fabricated user turns. Passage identities come from actual events. Tool command and prose previews are capped at 4,096 characters in the worker; full captured content remains selectable through artifact readers. Command input artifacts are available at the call step; result artifacts remain hidden until captured completion. Full prose readers remain beneath the passage, unboxed.

The history mounts nearby passages and requests missing windows. Selected, focused and reading passages can remain pinned. The file spine is virtualized; the file panel fetches 100 actions at a time, with a server maximum of 200. Search can land outside the current page. Briefing counts use whole-session facts, rather than pretending the page is the entire recording. Stale reader loads are discarded; failed updates keep prior evidence and expose a retry. Replay does not display a page from a different requested step while loading.

Two browser regressions found during validation are worth preserving:

- Observing both the outer passage slot and inner section under the same ID alternated incompatible heights and caused an endless resize/scroll feedback loop. Measure and anchor **only the outer `.passage-slot`**.
- A live update could arrive while a scroll was settling. Replacing the reading anchor with the new layout silently lost the old position. Preserve the anchor recorded by the actual scroll and restore it when navigation settles.

Correct virtualization means historical actions may be unmounted. Tests must navigate to evidence through search/file/history controls rather than assuming every action is already in the DOM.

## Resource settings and retention

The low-resource preset persists locally. It disables map and motion, reduces passage overscan from 900 to 300 px, and lowers settled decoded-text cache budgets from 8 MiB previews + 40 MiB readers to 2 + 10 MiB. Four in-flight requests reserve at most another 16 MiB; the normal material budget stays at 64 MiB including those reservations. Existing mounted-reader limits remain. Disabling the preset does not forcibly re-enable preferences the user turned off. Content, search, selection and capture semantics are unchanged.

`drishya storage [--json]` reports captured blobs, derived history, captured database files and other own-store bytes. The default 10 GiB budget is **advisory**; `overBudget` is explicit and automatic deletion is false. No source journal is deleted. `forget` stops the selected live reader, invalidates affected combined derived views, removes recording rows, and removes only blobs no surviving recording references. Derived blob cleanup also preserves shared references. SQLite free pages are reusable; forgetting is not a secure-erase guarantee and does not immediately shrink every database file. There is no quota-enforced automatic retention or vacuum feature.

## Measured evidence

Reference: Windows x64, Intel Core i9-14900HX, 32 logical CPUs, 31.6 GiB RAM, Node 24.14.0, installed Edge, Performance power plan, 1440×900 viewport. Browser probes use reduced motion unless stated. Sources are invented Codex records; they are not production traces. Browser append measurements are warm additions in one session, not five independent cold opens. Import probes use five independent temporary stores. RSS is process-wide, including worker threads, sampled every 20 ms by a separate sampling worker; very brief peaks may be missed. Browser heap is CDP used JavaScript heap, not whole-browser or GPU memory.

| Probe | Result | Scope |
|---|---|---|
| Normal: 10,101 observations, five 200-record additions, map off | Open 0.87 s; update p50/p95 269/296 ms; browser heap 18.1 MiB; peak daemon RSS 413.8 MiB | One browser sequence |
| Normal + 5,000 eligible files, map on | Open including indexing 3.42 s; update p50/p95 258/278 ms; browser heap 39.5 MiB; peak daemon RSS 402.6 MiB | File spine <100 mounted nodes and file panel ≤100 actions asserted |
| Long: 101,001 observations, five 200-record additions | Open 6.06 s; update p50/p95 1,060/1,113 ms; browser heap 17.2 MiB; peak daemon RSS 638.1 MiB | Long RSS exceeds the **normal-workload** 512 MiB ceiling; do not apply that normal limit to this result |
| Passive live + low-resource: normal session, 2,000 records over 30 s | Update p50/p95 644/699 ms; browser heap 20.6 MiB; peak RSS 417.4 MiB; no loss/duplicates | One ten-burst sequence on reference desktop, not an 8 GiB hardware certificate |
| Physical valid 1 GiB shell-output source, five independent imports and worker pages | 51,971 observations / 25,985 operations / zero gaps each; import+page p50/p95 40.18/41.95 s; sampled peak RSS p50/p95 484.6/486.3 MiB | Repeated output blobs deduplicate; not a worst-case unique-content or heavy-edit workload |
| Physical valid 1 GiB prose source | 26,097 observations / zero gaps; import+page 21.91 s; peak RSS 548.5 MiB | Single run; no p95 |
| Passive overhead, five rotated runs, 2,000 records, 2 ms synthetic work per pair | Observer −0.1%; observer + browser +2.7% median slowdown; no loss/duplicates | Reference desktop; negative values are noise, not a speedup promise |

Normal map-on viewport scrolling → next animation frame plus layout had p95 10.6 ms across 50 samples. Normal/long map-off probes gave 4.3/4.8 ms. This is a narrow responsiveness probe, **not** a full input-to-paint, dropped-frame or universal 60 Hz certificate.

Historical contrast: the prior 100k update took 4.35 s and valid 1 GiB import reached approximately 1.97 GiB RSS. The new probes exercise actual shell handling: `exec_command` and `functions.exec_command` now map to shell intent; they are no longer inadvertently measured as generic tools. The new memory sampler observes blocked import intervals, unlike end-of-phase snapshots.

## Correctness and install checks

- Typechecks and 206 unit tests cover streaming timestamp ordering/migration, reducer snapshot/append equivalence, late rebuilds, as-of artifact visibility, restart, shared derived cleanup, bounded page/material APIs, metadata updates and storage reporting.
- Eight synthetic browser tests cover existing B2/B3/P1 behavior and the new 12k-observation paged journey: earlier windows, detached capture, global search, optional replay and low-resource state. Scroll-anchor regression is also repeated five times.
- Opted-in local real-session checks passed on **copied** journals: Claude Code 1,669 lines → 798 observations / 697 steps / 292 operations / 12 explicit gaps; Codex 101 lines → 30 observations / 27 steps / 11 operations / zero gaps. Both opened operation detail, held the reader at 1440 and 390 px, followed/reconnected, and resynced without additions. Claude gaps remain visible evidence of unsupported/uncaptured records, not silently repaired events. Real paths/content are not committed or uploaded.
- Packed installation now includes a separately bundled history worker, `BUILD.json` and `SHA256SUMS`. Isolated offline install verifies every hashed file, both adapters, authenticated worker history, persisted restart and worker restart. Node 24 remains required; the public npm package is not published. Cross-platform CI must pass on this exact change before merge.

## Reproduction

Use Node 24 and the repo's pinned pnpm; an installed browser channel can be selected locally. Core probes use synthetic sources and remove their temporary stores.

```powershell
corepack pnpm check
corepack pnpm ui:build
$env:DRISHYA_BROWSER_CHANNEL = 'msedge'
corepack pnpm test:browser
node scripts/bench-browser.ts --observations 10000 --files 5000 --map --repetitions 5
node scripts/bench-browser.ts --observations 100000 --repetitions 5
node scripts/bench-browser.ts --observations 10000 --live --low-resource --repetitions 10 --interval-ms 3000
node --expose-gc scripts/bench-valid-source.ts 1024
node --expose-gc scripts/bench-valid-source.ts 1024 --prose
node scripts/bench-overhead.ts --runs 5 --records 2000 --work-ms 2 --browser
corepack pnpm package:verify
```

For five independent valid-source samples, invoke that command five times; the probe creates a fresh store each time. Real-session acceptance is opt-in through `DRISHYA_REAL_SESSIONS`, a **local-only** JSON mapping adapter IDs to selected inactive journals. Do not put this mapping or real browser artifacts in CI.

## Remaining release boundaries

1. Validate low-resource behavior on a physical 8 GiB/integrated-GPU machine and capture overhead on a 4–8 core machine. More RAM and browser throttling cannot certify those environments. Measure ten-minute reading and actual interaction-to-paint/dropped frames before making smoothness claims.
2. Validate real-source discovery/import/reconnect on macOS and Linux as well as Windows. Synthetic offline package CI covers installation mechanics, not every harness format/version on those hosts.
3. Full `/projection`, CLI inspection and complete exports remain explicit compatibility materializations. They do not acquire a bounded large-export guarantee from the new paged viewer. Do not route routine large-session navigation back through them.
4. Worker metadata still scales with operations, artifacts and relationships. It is one capped workspace, not an unlimited disk-only reducer. Unique huge edits, many unfinished edit intents, combined-session append rebuilds and very large metadata sets require further probes. Heap-limit failure must remain explicit and recoverable.
5. Broad publication, signed releases, upgrade/data-retention documentation and the contract freeze still require the agreed release/review process. Core operation does not require a model key. Premium P1/P2 design, useful return-to-work features and user comprehension studies remain separate product work.

PR #21's since-last-visit proposal is separate. Review it against the paged summary boundary before merging: a page is not the whole recording. Avoid restoring full-projection dependence through a new feature.
