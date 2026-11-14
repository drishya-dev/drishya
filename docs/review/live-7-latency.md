# LIVE-7: live latency at every step

14 November 2026 · Yash with Claude (Sonnet 5.5) · branch `claude/great-cannon-da4770`

How long passes between a harness writing a journal record and Drishya painting it, measured per step with a probe that only exists behind a developer switch, then shortened without changing a pixel or a motion. Everything here is local; Drishya has no telemetry and the probe sends nothing anywhere.

## The bug, and what caused it

Yash, 14 Nov: "sometimes its that the session doesnt load and than next second there is thinking block and 2-3 commands already done."

Reproduced on real Codex runs (a throwaway repository, a scratch Drishya home on its own port, a real Edge page). Before any change, a brand-new session showed up on Home **9.2–9.3 s** after its first journal write and was imported only when the person clicked it, so every step written so far (5 in one render) landed together about 9.5 s late. That is the symptom. The causes, in the order the time was spent:

| # | Cause | Where | Fix |
|---|---|---|---|
| 1 | Home listed new journals from a page poll every 10 s (`DISCOVERY_MS`) | `apps/ui/src/components/Home.tsx` | The daemon sends a `sources` SSE notice when a journal appears or, while small, grows (`packages/ingest/src/source-watch.ts`: file names and sizes, no parsing, only while a viewer listens). Home runs its discovery on it; the 10 s scan stays as the fallback. |
| 2 | Following started only after open, and the first read waited one 500 ms tick; `POST /live` returned before it, so the page reloaded a stale state and a second paint brought the rest | `ingest.startLive`, `server.ts` | `startLive` looks at once; the live-on call awaits that first read (at most 1.5 s). |
| 3 | The tail polled every 500 ms (p50 230 ms, p95 about 900 ms of every step) | `ingest.startLive` | 100 ms poll (one `stat` per source); companions are still looked for about every 2 s. |
| 4 | The page refreshed 150 ms after every notice (trailing debounce) | `apps/ui/src/lib/sync.ts` | The first notice after a quiet spell refreshes at once; notices within 150 ms of the last refresh's start collapse into one more. |
| 5 | **The page's render.** `Output` re-ran a backtracking path-finding regex over every line of every mounted tool-output card on every live update: about 5.5 s of main-thread time over 60 steps on a 1,735-observation Codex session, data to paint p95 373 ms | `components/common.tsx`, `lib/output-paths.ts` | `Output` is memoised on its props, and `outputPaths` keeps recent answers (pure in text, root and limit). Same output, same pixels. |
| 6 | Opening a session rescanned every journal on the machine just to validate the path (about 0.25 s) | `POST /v1/import` | Reuses a discovery from the last 15 s; scans only when the path is not in it. The allow-list rule is unchanged. |
| 7 | Every projection rebuild asked the filesystem whether each derived blob existed | `BlobStore.put` | Blobs already stored are remembered (forgotten on delete); a rebuild is about 40% faster. |

The stale-open burst (the page showing 28 of 47 steps, then the rest) measured the same after the change (first paint 414 ms with 28 of 52 steps, current at 647 ms): the live-on read helps later updates, but the open's first paint still shows the older state. Recorded, not solved here.

## How it was measured

`scripts/bench-live-latency.ts`:

- an independent tailer stamps every journal line the moment its size changes (2 ms poll);
- the daemon's own commits are timed in process;
- a real Edge page, with `localStorage['drishya.liveProbe']='1'`, records `notice` (the SSE change arrived), `data` (the projection is in the store) and `paint` (two animation frames later) in `window.__drishyaLiveProbe`;
- steps are joined by observation count: observation N is visible once a mark with count at least N exists.

Each step is one of prompt, reasoning, tool-start, tool-result, prose, plan-or-question, turn-end or sub-agent-start (from the observation kind and tool name). `scripts/live-latency-report.ts` pools the runs. Before and after ran **paired**, scenario by scenario, so both saw the same machine load: "before" is clean main (93a51e30) plus only the probe, in its own worktree with its own install; "after" is this branch. Steps written before the viewer opened arrive with the open itself and are counted under "Opening a session", not as live steps.

Real sessions, by id suffix and counts only (contents never printed; copies live in a deleted temp folder, never in a real Drishya home):

- **Codex, live, real runs** (Codex CLI 0.165; three runs each of a new session, an already-open session resumed, and the same session resumed through Drishya's own controller; plus two stale opens and two plan prompts): about 0.2 MB journals, 29–55 observations each.
- **Codex, real journals copied, then appended to** with real records (ids rewritten): `cb591946` (25.6 MB) and `b4a6ee05` (39.2 MB, 1,735 observations).
- **Claude Code, real journals copied, then appended to**: `1c9e372a` (24.0 MB, 3,438 observations, with 5 real `AskUserQuestion` calls, the plan-or-question rows) and `876b1fb8` (156.8 MB, 11,617 observations).
- **Invented journals** (`make-large-journal`, and a small one at a steady pace): 42.5 MB and 0.02 MB.

Not measured, said plainly:

- **Claude Code live runs.** Its sign-in in this environment reports "OAuth session expired and could not be refreshed"; only the person can sign in again. Claude rows come from real Claude records appended to a copy, so they exercise our tail, store, projection and page, not Claude's own writing.
- **Sub-agent start and `ExitPlanMode`** on any path: no usable sample. Codex's headless `exec` produced no plan call on a plan prompt, and the only real sub-agent sample was on a 318 MB paged journal whose join to page counts was invalid, so it is not reported. Both kinds ride the tool-start commit path, so expect the tool-start figures; that is an inference.
- **Paged journals:** the page's counts are joined by observation count. The 318 MB case showed that join can fail, so the paged rows above (40 MB, 39 MB, 157 MB) were checked to be positive and plausible, and larger ones are not claimed.
- **Passive observation versus the controller:** the controller path was measured on Codex (the daemon's `controller/prompt`, the harness resumed by Drishya). After the harness writes, it is the same tail. The harness's own start-up (about 0.5 s from the request to its first journal line) is Codex's, not Drishya's.
- A 988 MB Codex journal exists locally but was not used: the question here is the live path, and a cold open of one is PERF-3's.

## Results

### End to end (journal append → painted), live steps

| Case | Journal | Steps | before p50 | before p95 | after p50 | after p95 |
|---|---|---:|---:|---:|---:|---:|
| 40mb | 42.5 MB | 132 / 132 | 507 ms | 759 ms | 151 ms | 243 ms |
| claude157 | 156.8 MB | 120 / 120 | 753 ms | 1.26 s | 329 ms | 603 ms |
| claude24 | 24.0 MB | 81 / 81 | 1.17 s | 2.18 s | 658 ms | 1.07 s |
| claudepick | 24.0 MB | 16 / 16 | 1.20 s | 1.94 s | 535 ms | 995 ms |
| codex26 | 25.6 MB | 31 / 31 | 612 ms | 1.21 s | 482 ms | 875 ms |
| codex39 | 39.2 MB | 33 / 33 | 1.40 s | 3.50 s | 142 ms | 384 ms |
| codexctl | 0.2 MB | 5 / 21 | 441 ms | 576 ms | 96 ms | 160 ms |
| codexnew | 0.2 MB | 12 / 23 | 373 ms | 620 ms | 89 ms | 167 ms |
| codexplan | 0.2 MB | 0 / 17 | – | – | 92 ms | 249 ms |
| codexresume | 0.2 MB | 23 / 27 | 462 ms | 711 ms | 94 ms | 157 ms |
| small | 0.0 MB | 220 / 220 | 446 ms | 676 ms | 89 ms | 179 ms |

### By step kind (all live cases pooled)

| Step | before p50 | before p95 | after p50 | after p95 | n before / after |
|---|---:|---:|---:|---:|---:|
| prompt | 576 ms | 2.00 s | 117 ms | 840 ms | 19 / 23 |
| tool-start | 521 ms | 1.38 s | 119 ms | 506 ms | 204 / 216 |
| tool-result | 632 ms | 1.96 s | 243 ms | 761 ms | 364 / 376 |
| prose | 436 ms | 1.01 s | 113 ms | 473 ms | 44 / 57 |
| plan-or-question | 1.03 s | 1.93 s | 550 ms | 954 ms | 4 / 4 |
| turn-end | 373 ms | 711 ms | 63 ms | 157 ms | 6 / 11 |
| reasoning | 991 ms | 3.01 s | 229 ms | 928 ms | 32 / 34 |

### Where the time went (p50 / p95, pooled)

| Stage | before | after |
|---|---:|---:|
| append → committed | 230 ms / 899 ms | 60 ms / 115 ms |
| committed → page notified | 2 ms / 64 ms | 1 ms / 28 ms |
| notified → data in page | 244 ms / 996 ms | 86 ms / 514 ms |
| data → painted | 17 ms / 357 ms | 14 ms / 50 ms |

### Steps that arrive in one render

| Case | before (renders, largest group) | after (renders, largest group) |
|---|---|---|
| 40mb | 50, 5 | 70, 3 |
| claude157 | 20, 11 | 35, 6 |
| claude24 | 28, 5 | 26, 5 |
| claudepick | 6, 5 | 6, 5 |
| codex26 | 22, 2 | 21, 2 |
| codex39 | 12, 6 | 22, 2 |
| codexctl | 5, 1 | 18, 2 |
| codexnew | 12, 5 | 24, 2 |
| codexplan | 3, 10 | 15, 2 |
| codexresume | 21, 2 | 25, 2 |
| small | 66, 5 | 117, 3 |

### Opening a session

| Case | before | after |
|---|---|---|
| 40mb | click → viewer 5.74 s | click → viewer 3.96 s |
| claude157 | click → viewer 2.98 s | click → viewer 2.10 s |
| claude24 | click → viewer 7.87 s | click → viewer 14.46 s |
| claudepick | click → viewer 13.85 s | click → viewer 8.32 s |
| codex26 | click → viewer 3.52 s | click → viewer 2.84 s |
| codex39 | click → viewer 22.21 s | click → viewer 19.46 s |
| codexnew | on Home 9.31 s after first write; click → viewer 834 ms | on Home 976 ms after first write; click → viewer 177 ms |
| codexplan | on Home 8.54 s after first write; click → viewer 2.18 s | on Home 505 ms after first write; click → viewer 209 ms |
| codexstale | click → viewer 452 ms; stale open: first paint 407 ms (28/47 steps), current 665 ms | click → viewer 460 ms; stale open: first paint 414 ms (28/52 steps), current 647 ms |
| small | click → viewer 228 ms | click → viewer 183 ms |

Notes on the tables:

- With few samples p95 is nearly the maximum; case rows under about 30 steps are indicative. Per-run timelines are in `.local/live7/` (private, not committed).
- The codexctl and codexplan "before" rows show few or no steps because the old code began following only when the person opened the row 9–12 s in, by which time the short run was over; those steps arrived as the opening burst.
- **Opening a large session is not changed by this work** and is noisy (the 24 MB Claude copy took 7.5–15 s across six paired runs, the 39 MB Codex copy 19–24 s, before and after alike). That is the cold history page: PERF-3 and PERF-4.
- **Paint groups:** with the faster poll, steps the harness wrote in separate bursts now arrive in separate renders (more renders, smaller groups) instead of waiting for the next tick. The 12-step group on the 157 MB Claude row is lines the bench wrote together; it fell to 6.

## Proposed target (for Yash to agree from the PR)

1. **Ordinary journals** (not paged: under 10,000 observations and 32 MB, the sessions most people run): **p95 under 500 ms from journal append to paint for every live step.** Now 157–249 ms p95 on the small real and invented journals.
2. **Large paged journals:** p95 under 1 s. Now 243–603 ms.
3. **A new session listed on Home within 2 s** of its first journal write (now about 0.5–1 s) and a small session open within 500 ms of the click (now 0.18–0.21 s).
4. **Not yet met: mid-size non-paged sessions** (about 3,000 or more observations, such as the 24 MB Claude copy at p95 1.0–1.1 s, and the 25.6 MB Codex copy at p95 0.88 s): The daemon rebuilds the whole projection after every update, 150–400 ms each on its main thread, and the page waits for it. The next step is an incremental reduce, or doing it in the history worker. Proposed as its own item, not started here.

## Guards

- `packages/ingest/test/live-latency.test.ts`: with nobody listening, 30 appended steps each commit with p95 under 250 ms and p50 under 150 ms; following reads at once what was written since the import; the source watch announces new journals and ignores the growth of a settled one; the helper maths.
- `apps/ui/test/sync.test.ts`: the first notice refreshes at once, a burst collapses to one more, a slow refresh holds.
- `apps/ui/test/output-paths-cache.test.ts`: the cached scan returns the same locations and the same array.
- `scripts/bench-live-latency.ts` is the opt-in end-to-end bench behind the table (run `pnpm ui:build` first; `--mode live --harness codex --scenario tools [--resume] [--controller] [--stale]`, `--mode synthetic [--mb N | --source <id suffix> [--pick ask]]`).

## Capture and privacy

Nothing in the capture path waits on a viewer: the tail runs without one (the guard test attaches none), the source watch starts only while an SSE client is connected and only broadcasts, and the live-on call's 1.5 s wait cannot delay capture because the tail is already running. Harness journals are only read; the watch lists names and sizes and opens nothing. No schema, redaction, native-policy, pixel or motion change.

## Also found, not changed

- `tests/browser/material-motion.spec.ts:71` ("scrolling a result keeps live follow") fails the same way on clean main (the result body never overflows); not from this work.
- Three daemon unit tests (`images`, `compaction`, `file-roots`) time out at 5 s when the whole `apps/daemon` folder runs in parallel, also on clean main; each passes alone.
