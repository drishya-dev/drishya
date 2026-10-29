# HOME-1b startup rescan

The scope and acceptance live in [TASKS, HOME-1b](../TASKS.md#home--sessions). This report records evidence for that item; it is not another work queue.

The requested change replaces the startup rescan's date-based candidate rule with missing turn data: a Codex recording must have no `codex-turn-details-rescan-v1:<id>` marker and zero stored `turn.detail` observations. The query must use an existing index, which the implementation report will cite. Other rescan behavior remains unchanged.

Validation must cover a recording imported after the old cutoff, existing turn details, marker repeat prevention and existing legacy-rescan regressions. Real-session acceptance uses scratch imports and reports only session id prefixes, sizes and counts. The performance comparison uses a copy of the real database and one large invented Codex journal, with three rescan and three no-work startup runs; it measures completion time and server event-loop maximum against PR #281's recorded `appendEventLoopMaxMs` values.

## Implementation and focused validation — 29 October

The previous date cutoff could exclude a recording with missing turn data solely because its initial import was newer. Candidate selection now checks the existing completion marker and one prepared `turn.detail` existence query (`packages/ingest/src/index.ts:239–247`). The existing `obs_rec_kind(recording_id, kind)` index is declared at `packages/store/src/index.ts:388`; an `EXPLAIN QUERY PLAN` run on a scratch in-memory Store reports `SEARCH observations USING COVERING INDEX obs_rec_kind (recording_id=? AND kind=?)`. No store, schema, contract or UI file changed; the remaining rescan flow is unchanged.

Harsh approved changing the conflicting regression premise after the required stop. The updated regression at `packages/ingest/test/legacy-codex-rescan.test.ts:50` requires the newer empty-detail recording to rescan while the older partial-detail recording and Claude recording are skipped. Additional regressions at lines 64 and 73 cover complete details on both sides of the old cutoff and a completion marker with no details.

With `TEMP` and `TMP` set to `C:\Users\Harsh Jain\AppData\Local\Temp`, `pnpm exec vitest run packages/ingest/test/legacy-codex-rescan.test.ts` passes all nine tests. `pnpm check:affected` passes both typechecks and 328 related tests in 47 files, with one existing skipped test; its browser plan is "not affected". `git diff --check` passes. These commands required sandbox escalation because Corepack could not download the pinned pnpm through the restricted network; the initial blocked commands did not run tests.

## Real-session acceptance — 29 October

`pnpm check:real -- turn-details --max-mb 10` uses the new counts-only case in `scripts/real-cases/turn-details.ts`. It found 23 Claude sessions with 87 accounting records and 32 Codex sessions with 657 recorded endings; seven Claude and four Codex journals over the explicit 10 MB scan limit were skipped. The selected Claude recording `rec_4cb0f629` has 16 accounting records and zero captured turns. The selected Codex recording `rec_4ff26e8d` has 86 captured outcomes and 86 durations. Claude accounting is separate from Codex turn details; Claude recordings remain excluded from this startup pass.

An ignored acceptance script imported unchanged copies of those genuine native sources into a scratch home: Codex 2,315,572 bytes and Claude 6,284,629 bytes. Four Codex imports exercise missing, partial, complete and already-marked store states. Only scratch database observations were removed to reconstruct an older importer; native journal bytes were never fabricated or changed.

| Scratch recording prefix | Case | Observations after startup | Stored turn details after startup |
|---|---|---:|---:|
| `rec_fc80df89` | Newer import, missing details | 1,088 | 258 restored |
| `rec_0da05c08` | Existing partial details, no marker | 831 | 1 unchanged |
| `rec_597066b8` | Existing complete details | 1,088 | 258 unchanged |
| `rec_e6c63a3c` | Existing marker, missing details | 830 | 0 unchanged |
| `rec_423f74ef` | Claude accounting | 1,844 | 0 unchanged |

Startup attempted and completed exactly one reread, with zero failed or unavailable recordings. All 830 previously captured observations of the missing-detail recording retained their exact stored bodies. Restart attempted zero rereads. The authenticated recordings API returned HTTP 200, and both original native source digests were unchanged. Counts-only evidence is in ignored `.local/home-1b-native-acceptance/result.json`.

Actual API-backed Home rows for `rec_fc80` and `rec_423f` passed at 600 and 1440 px: exact stat text and harness provenance, unchanged fixed row heights, one-line stats, title space and viewport containment. There were zero page or route errors. This is automated desktop acceptance, not a new human or physical-platform certification; private row data stayed local.

## Startup measurement — three alternating pairs

The live database was opened with `DatabaseSync(..., { readOnly: true })` and copied through SQLite backup before any writable App was created. The snapshot has 6 recordings and 6,141 observations; its source database file is 45,674,496 bytes. Completion markers were set only on unrelated recordings in the copied benchmark seed so that no native journal was reread during the timing runs.

The unchanged `generateLargeJournal` workload requested 171 MB and produced 183,012,440 bytes in 6,781 records (maximum record 321,729 bytes). It imported 8,126 observations; removing its one turn-detail observation from the scratch seed reconstructed a newer empty-detail recording while preserving all other captured observations and the consumed cursor. Each fresh-process run copied the identical seed database and blobs. No-work runs additionally set that synthetic recording's completion marker; rescan runs left it unmarked.

Elapsed time starts immediately before `startServer` and ends when its owned startup rescan resolves; seed copying, App construction, warmup, API verification and shutdown are excluded. Event-loop lag uses the same 20 ms interval basis as `scripts/bench-real-journals.ts:54`: `max(0, elapsed - 20)`. A final 25 ms drain captures a delayed final interval before shutdown. Runs were sequential, alternating no-work and rescan; OS caches and power mode were not controlled. This is startup rereading, not the same workload phase as the earlier append benchmark.

| Pair | No-work completion ms | No-work loop max ms | Rescan completion ms | Rescan loop max ms |
|---|---:|---:|---:|---:|
| 1 | 14.788 | 11.992 | 3,667.433 | 45.131 |
| 2 | 14.087 | 12.241 | 3,769.607 | 43.836 |
| 3 | 15.861 | 10.630 | 3,924.864 | 49.925 |

All three rescan runs attempted/completed exactly one recording, restored one detail, preserved all 8,125 prior observations and returned HTTP 200; no-work runs attempted zero recordings. Listening completed in 13.002–16.027 ms during rescan runs. Median rescan loop maximum is 45.131 ms. PR #281 reports branch append maxima 84.278/40.176/55.324 ms (median 55.324 ms), and main 95.461/90.267/42.113 ms (median 90.267 ms). These startup results do not show a clearly worse event-loop maximum; they do not establish a general speedup or a physical low-resource result. The required performance STOP was not triggered. Counts-only per-run results and the local measurement script remain in ignored `.local/home-1b-startup-bench*`.

`pnpm package:verify` passes UI/package build, isolated offline install, Claude/Codex import, demo bundle, authenticated API and persisted restart. After adding the real-session case, `pnpm check:affected` again passes both typechecks and all 328 related tests (one existing skip; 47 files), with no browser specs automatically affected. The explicitly targeted `pnpm exec playwright test tests/browser/home-stats.spec.ts --project=parallel --workers=1` passes all three cases against the rebuilt UI with the installed Edge browser. `git diff --check` and `node scripts/sync-tasks.ts --check` pass. `TEMP` and `TMP` were set as required before test commands. The Tasks 0–3 full batch gate remains **NOT VERIFIED** until the requested later batch stage. HOME-1b remains open and the PR remains draft until P7.
