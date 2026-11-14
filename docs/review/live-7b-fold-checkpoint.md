# LIVE-7b: the resumable fold and the seam PERF-4 builds on

14 November 2026 · Yash with Claude (Sonnet 5.5) · branch `claude/live-7b`

A followed recording's projection is now **folded**, not rebuilt: the daemon keeps the reducer's state resident and appends only the observations stored since. Numbers are in [live-7-latency.md](live-7-latency.md); this note is the design, what is checked, and exactly what PERF-4 has to add to persist it.

## What was there

`reduce()` is `createReducer(...).snapshot()`, and `createReducer` already kept its state between `append` calls. Only the paged history worker used that (its `incremental` variable). The non-paged path (`Ingestor.projection`, used by `GET /v1/recordings/:id/projection` for every session under 10,000 observations and 32 MB) rebuilt from scratch after every update: 150–400 ms of daemon main-thread time at about 3,400 observations, and a third of that was the ordered database read run three times (the reducer iterates its input three times). Measured on a real 24 MB Claude journal: a full rebuild 93–318 ms, an append of three observations plus a snapshot 1–3 ms.

## The seam: `packages/projection/src/fold.ts`

`ProjectionFold` wraps the reducer and records what it has consumed in a **`FoldHead`** (plain, JSON-safe, versioned by `FOLD_FORMAT` and `REDUCER_VERSION`):

| Field | Meaning |
|---|---|
| `format`, `reducerVersion` | The shape of the head and the reducer that folded. Any other value: never resumed. |
| `parts`, `recordingId` | The recordings folded, ancestors first; the last is the one followed. Today one part (see "Not done"). |
| `counts`, `sequences` | Observations folded and the highest `receivedSequence`, per recording. |
| `clock` | The effective source clock (ISO) of the last observation of the last part. |
| `sourceClocks` | Per `<recording>/<source>`: the newest-by-sequence observation that carries its own time and its clock. An observation without a time sorts by this, exactly as the store's SQL ordering does. |
| `generations` | The source generation seen per source. |
| `roots` | Workspace roots seen (`workspaceRoot`, `payload.cwd`, `payload.intent.cwd`). |

`canAppend(added)` is pure and `append(added)` changes nothing when it is false. An append equals a full rebuild only when the new observations would sort after everything folded and nothing the reducer decided from the whole input has changed, so it returns false (and the caller rebuilds once with `ProjectionFold.build`) when:

1. an observation belongs to another recording than the last part (an earlier lineage part changed);
2. an observation's `receivedSequence` is not above the head's (replayed);
3. an observation is in another source generation, or is a `source-truncated` marker (the file was replaced and is read again from its start);
4. an observation's effective clock is before the head's (it would sort earlier: a later journal of a sub-agent, a record without a time carried from an older source, a clock that went backwards, a rescan backfilling older records);
5. an observation names a workspace root the fold has not seen (roots decide the path namespace of every earlier operation, and the reducer computes them from the whole input up front);
6. the head's `format` or `reducerVersion` is not the current one.

`Ingestor` adds the checks that need the store: the stored observation count must equal the folded count plus the batch (a deleted or rewritten row), and a batch over 5,000 is rebuilt in one ordered read instead.

## Who holds it, and for how long

`Ingestor.folds`: at most **two** resident folds, only for recordings that are being followed and that a viewer asked the projection of. Released when the recording stops being followed, is forgotten, the process closes, no viewer is connected (`releaseFolds()` from the server when the last event stream closes), or after a quiet minute. Capture never reads or waits on a fold; it is built from rows already committed. A fold is held beside the history worker's own, so a followed recording the worker also reads exists twice in memory (bounded by the two-fold cap).

Stopped recordings are not folded: they are rebuilt once and stored (`putProjection`). A followed recording is no longer written to `projections` after every update (that JSON write was about 60 ms of the old rebuild); it is stored when following stops.

## Checks that it is right

- `packages/ingest/test/fold-parity.test.ts`: for every synthetic fixture journal (19; they are the sources of the golden scenes), at every split point (all of them up to 160 observations, otherwise both ends plus an even sample), `build(prefix)` then `append(rest)`, in one batch and a few at a time, equals `reduce(all)` by digest, with the recording finished and live. Hand-made timelines cover each refusal above (records without a time, a clock that goes backwards, a second root, a new generation, a truncation marker, another recording, a replayed sequence, a foreign reducer or format). There are no `fixtures/redacted` journals in the repository, so none are covered. `checkout-fix` has a sub-agent journal that interleaves in time with the main one, so a split that stores the main journal first correctly refuses and rebuilds.
- `packages/ingest/test/fold-live.test.ts`: through `Ingestor.projection`, a followed journal's projection equals a rebuild after every append; a replaced (shorter) journal rebuilds; at most two folds; release on stop; a recording that is not followed is not folded.
- Developer switch **`DRISHYA_FOLD_CHECK=N`**: every Nth incremental update is compared with a full rebuild by digest. A mismatch is logged to the local console (`[drishya] fold check: …`), counted in `ingest.foldStats.mismatches`, the rebuild is served and the fold replaced. Nothing leaves the machine. `foldStats` also counts `appended`, `rebuilt` and `checked`.
- The reducer is untouched, so the composer stays pure; no clock is read in it.

## What PERF-4 has to add to persist a fold

`FoldHead` is already the part that is data. The reducer's **state** is not: `createReducer` keeps it in closure variables, some of which are class instances with private fields and some of which share object identity. Persisting a checkpoint means moving them into one state object with a codec. These are all of them (`packages/projection/src/reduce.ts`, `createReducer`), with what each needs:

| State | Holds | For a codec |
|---|---|---|
| `observationCount`, `lastSequence` | counters | plain |
| `taskPlans` (`TaskPlans`), `desktopPlans` (`DesktopChecklists`), `usage` (`UsageAccumulator`), `context` (`ContextAccumulator`), `turnRecords` (`TurnAccumulator`) | class instances with private maps and arrays | each needs `toJSON`/`fromJSON`; `context.snapshot` takes a step-mapping callback, which is code, not state |
| `agents` (`Map<string, Agent>`) | the agents seen | plain once the map is an array |
| `ops` (`Map<string, OpState>`) | per operation: the `Operation`, its `ToolIntent`, `cwd`, call observation id, `completed`, plus **`wrapperResult: { observation, payload }`, a whole `Observation`** and `script` text | the heaviest; the embedded observation should become an observation id re-read from the store |
| `snapshots` (`Map<string, Operation>`), `dirtyOperations`, `opOrder`, `opGroups` | copies handed out at the last snapshot; which operations changed; start order; one call's operations | `snapshots` can be dropped and rebuilt (every operation marked dirty); the rest are plain |
| `prose`, `unrecorded`, `notices`, `lastNotice`, `timeline`, `links`, `gaps`, `artifacts`, `availableTools`, `capabilities`, `harnesses` | the projection's own arrays and maps | plain. **`lastNotice` and `turnByRecord` share object identity with `notices` and `timeline`** (a later append mutates the same object), so a codec must serialise them by id and re-link, not as copies |
| `turnByRecording`, `turnByRecord`, `turnMessageByRecording`, `promptRecordLine`, `pendingTurnImages` (holds `Observation`s), `itemReceipts` | prompt and turn bookkeeping | plain apart from the two points above |
| `checkpoints`, `awaitingCheckpoint` | DATA-5 checkpoint rows by turn and path, and the operations waiting for one | plain (`byPath` is a map built at snapshot time and can be rebuilt) |
| `bases` (`Map<key, sha>`) | captured file bases **by content hash only** (the text lives in the blob store) | plain, but the checkpoint is valid only while those blobs exist in the store it will read |
| `rootsByRecording`, `roots`, `multipleWorktrees`, `locationRoots`, `branchPrimaryRoot`, `workspaceRoot`, `recordedBranch`, `title`, `titleRank`, `firstPrompt`, `currentRecording`, `lineageStarts` | derived from **the whole input** (the first two loops of `createReducer` read every observation before folding) or from lineage | these are why a new root forces a rebuild; a checkpoint stores them and is valid only while the tail adds no new root |

What must version or invalidate a persisted fold (in addition to the head's own checks):

- **`REDUCER_VERSION` and `FOLD_FORMAT`**: any change to reducer logic or the codec. Already in the head.
- **The options the reducer ran with**: `maxProseChars`, `maxInputChars` (the history worker uses 4,096, the daemon's non-paged path the defaults), the **adapter descriptors** (labels and harness names are folded into agents) and **`lineage`** (it changes `correlationOwner`). Store a digest of these in the checkpoint's key.
- **The privacy policy version** of the observations folded (`PRIVACY_POLICY_VERSION`): a re-seal changes bodies.
- **The blob store** the derived artifacts were `put` into (`io.put` in `addArtifact` and `knownFull.set`): the history worker uses its own SQLite blob store, the daemon the file store; a checkpoint is only valid against the store that holds its blobs.
- **Rewritten rows**: anything that changes stored observation bodies in place (the legacy rescans add rows; a re-import under a new policy rewrites them). The stored count check plus the head's sequence/clock rules cover additions; an in-place rewrite needs the recording's revision or a content hash of the folded range.

PERF-4's cold open is then: read the checkpoint, check its head against the recording (`canAppend` on the stored tail), append the tail, show the latest page from it, and keep the full fold for the rest.

## Not done here

- **Lineage (resumed Claude sessions).** A recording with proven parents goes through `combinedProjection`, which still rebuilds. The head already models `parts`, and an earlier part's observations are never appended to (check 1), but the store's duplicate-part omission across a lineage (`lineageObservations`) holds state (the `seen` map) that would have to be resident too. Not needed for the measured cases; recorded for PERF-4.
- **The history worker** is unchanged (`apps/daemon/src/history-worker.ts` is PERF-4's). Its own `incremental` reducer validates with a simpler rule (every appended record must carry a time at or after the last, and no new root); `ProjectionFold` is the stricter, documented version of the same idea and can replace it.
- **Serialising the reducer state** (above).
