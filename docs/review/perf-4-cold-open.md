# PERF-4: large sessions open at once, the rest loads quietly

Yash, 11 Nov: "opening the first time as not all at once ... show the whole interface ... and then in background ... the user shouldn't know that the thing is updating." Built on LIVE-7b's resumable fold ([live-7b-fold-checkpoint.md](live-7b-fold-checkpoint.md)); numbers sit beside LIVE-7's ([live-7-latency.md](live-7-latency.md)).

## What it does

| # | Point | How |
|---|---|---|
| 1 | **Recent first** | A recording of at least 6,000 observations (`DRISHYA_TAIL_FIRST`; `0` switches it off) is answered from its last prompts: a prelude (`session.meta`, the first prompt) plus the tail, reduced on their own (`packages/ingest/src/open-fold.ts`, `buildTail`), with a whole-recording `rootsHint` so path namespacing is the one a full fold gives. The page gets `partial: { observations }`; step numbers in that page count from the tail. Whole-session facts (toolbox counts, Files marks) read as loading (`…`, blank) until the whole view exists; nothing is wrong or missing. |
| 2 | **Full fold in the background** | `ChunkedFold` folds in 200-observation slices, at most 20 ms at a time between the requests the worker is asked, so a read never waits behind it; capture is on the main thread and is never involved. Callers that would hold one of the browser's 6 connections until the whole view exists (`now`, `turns`, Files, graph, queue…) are answered `202 loading` and asked again. When done it catches up with what was stored meanwhile, writes the view, and tells the daemon, which announces it like any change. |
| 3 | **One quiet batch** | The page replaces the tail with the whole history once: same operation, prose and passage ids, earlier history joins above, the reading place held by the existing B2 anchor (`History.tsx`), no arrival replayed, nothing re-requested. |
| 4 | **Remembered** | `FoldCheckpoint` (`packages/projection/src/fold.ts`: `checkpoint()` / `ProjectionFold.restore()`; reducer state via `exportState`/`importState`, `v8.serialize`) is written to the history index (`folds` table in `history/index.db`, Drishya-owned, built from sealed, already-redacted observations) after the swap and on close, and read back after a restart or a session switch. A cold open resumes it and appends only the new tail. |

Also fixed: LIVE-7's stale-open burst. A session that already has steps opens with all of them (the page no longer opens at the stored step and then replays the rest as arrivals).

### A checkpoint is used only while every input is the one it was written for

`checkpointKey` = `[FOLD_FORMAT, REDUCER_VERSION, HISTORY_VERSION, prose limit, input limit, adapters digest, recordings read (ids, in order)]`, and the stored meta must still satisfy: no ancestor of a lineage grew (their counts), the last recording still holds at least the rows folded and its highest sequence is not lower, the lineage's repeat check state is present for a lineage, the head passes `restore` (format and reducer version again, readable bytes), and every base blob the state names is still stored. Anything else drops the row and folds again (recent-first as before). While resident, an append additionally requires `stored rows == folded rows + new rows`, so a row deleted or rewritten under the fold is a rebuild. The fold's `canAppend` still refuses everything LIVE-7b's note lists (an observation before the head, another recording, a new root, a new generation, a truncation).

## Proof

- **Parity** (`packages/ingest/test/fold-checkpoint.test.ts`): for every synthetic fixture (the sources of the golden scenes included), finished and live, at every split point (sampled above 160 observations), a fold built from the prefix, written as a checkpoint, read back through JSON + bytes, then appended with the rest equals the full rebuild by digest; a checkpoint written again from the restored fold is the same fold. Plus the head-level invalidations (reducer version, fold format, damaged bytes, an observation before the head, another recording, a new root, a new generation).
- **Worker level** (`apps/daemon/test/history-checkpoint.test.ts`): write, restart, append: the first page is whole (no recent-first detour) and equals a rebuild from the same store; a stored view with nothing new is served and the next append still resumes; each of fold format, reducer version, history version, prose limit, input limit, adapters, recordings read, damaged bytes, damaged head, fewer rows than folded and a missing base blob stops the checkpoint being used and is replaced by a good one; forgetting a recording drops its checkpoint.
- **Tail / full identity** (`apps/daemon/test/history-tail-first.test.ts`, `packages/ingest/test/open-fold.test.ts`): every operation, prose and passage of the recent-first page exists in the whole page under the same id with the same title and status; chunked folds equal the rebuild for any slice size; lineage (resumed Claude sessions) folds in slices and appends with the repeat check and equals a fresh rebuild (`history-lineage-fold.test.ts`).
- **Browser** (`tests/browser/perf4-quiet-swap.spec.ts`, 600 and 1440): a 12,800-observation synthetic journal with the background fold held for 4.5 s. The passage on screen is at the same pixels before and after the swap (≤ 2 px at the swap, ≤ 1 px drift after, painted layout-shift < 0.01), same text and markup, no arrival replayed, no placeholder in view, no page re-requested, the document is far taller afterwards.

## Real sessions (prefix and size only; a scratch home and port; never 7878 or the real home)

Scratch homes made by `scripts/bench-cold-open.ts` (a copy of the journal imported, then read by a **fresh App**, which is a daemon restart: no resident fold, no cached view). `--append 20` adds 20 real tail lines while the daemon is "away". The browser rows are measured in Edge against the same scratch homes (`startServer` on port 0).

| Session | Size | Observations | Before: cold open | After: first interface | After: whole history | After: restart + 20 new lines (checkpoint) | After: stored view |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claude `dd136b25` | 304 MB | 35,696 | 4.5 s (4.6 s after a restart; nothing remembered) | 0.84 s | 6.8 s | **1.24 s** | 0.63 s |
| Codex `14a7880a` | 959 MB | 73,168 | 10.6 s | 0.76 s | 12.2 s | **1.52 s** | 0.64 s |
| Codex `5b4a6ee0` | 37 MB | 1,735 | 0.38 s | 0.38 s (not partial: below the threshold) | – | 0.34 s | 0.17 s |

(One bench run each, same machine; the whole-history time includes the background fold sharing the machine with the polling client. "First interface" is the first `history` reply: the page's own boot is on top: from navigation to the first passage painted in Edge it was 1.1–2.0 s in total, headless, with the daemon in the same process.)

The swap, measured in Edge on the real sessions, painted movement of the passage under the reader's eye:

| Session | Width | Movement at the swap | Drift afterwards | Layout shift | Placeholder in view | Arrivals replayed | Pages re-requested |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claude `dd136b25` | 1440 | 0.0 px | 0.02 px | 0 | none | none | 0 |
| Claude `dd136b25` | 600 | 0.0 px | 0.02 px | 0 | none | none | 0 |
| Codex `14a7880a` | 1440 | 0.0 px | 0.0 px | 0 | none | none | 0 |
| Codex `14a7880a` | 600 | 0.0 px | 0.0 px | 0 | none | none | 0 |
| Claude, live (12 new records written during the fold, view following) | 1440 | 0.0 px | 0.44 px | 0 | none | none | 0 |

Live events during the background fold (12 new records appended, one every 400 ms while the fold runs): journal append to the daemon's change notice 19–43 ms on the 304 MB Claude session and 2–5 ms (two at about 410 ms) on the 959 MB Codex one; the change after the swap is appended to the resident fold (70 ms), not rebuilt.

## What this found and fixed on the way

- The resident fold's folded-row count was taken after the view was written (which yields to the event loop), so a record stored in between was counted but not folded and the next read rebuilt the whole history (3.9 s + 1.4 s writing) instead of appending. It is now counted in the same tick as the catch-up read.
- Writing the checkpoint holds the worker for about half a second on a 300 MB session; it now follows the swap by 3 s (the page's burst of requests after the swap is answered first) and a close flushes it.
- Connection starvation: whole-session endpoints held the browser's 6 connections open until the fold ended; they are answered `202 loading` now.

## What is not done, and what could not be checked

- **Toolbox and Files**: counts show `…` and Files marks are blank while the view is partial. Other surfaces that read the whole projection (the classic dock) were not changed and show what the tail holds until the swap.
- **Sub-agent started before the tail** and still running: its early steps are not in the tail projection. Not handled; the whole fold replaces the view in seconds.
- **The main-thread cost of `file-roots` / `graph` on a very large session** (about 0.6–0.8 s of main-thread time at open on the 304 MB session, `recordedFileRoots`) is unchanged by this task.
- **Checkpoint size**: a 300 MB session's checkpoint is the reducer state as bytes in `history/index.db`. It is rewritten at most once per 200 appended rows after a 20 s quiet spell, and on close.
- **Antigravity** (#490, not merged at the time of this PR): the parity and checkpoint tests have no Antigravity fixture yet; add one when #490 lands. `exportState`/`importState` list every closure variable of `createReducer`, so a new state variable in #490 must be added there (the parity test fails on a missing one).
- **Codex 5b4a6ee0** is below the threshold (1,735 observations); no real Codex session between 150 and 959 MB beyond `14a7880a` was available, and no real session had a sub-agent running at the cut.
