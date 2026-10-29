# HOME-1b startup rescan

The scope and acceptance live in [TASKS, HOME-1b](../TASKS.md#home--sessions). This report records evidence for that item; it is not another work queue.

The requested change replaces the startup rescan's date-based candidate rule with missing turn data: a Codex recording must have no `codex-turn-details-rescan-v1:<id>` marker and zero stored `turn.detail` observations. The query must use an existing index, which the implementation report will cite. Other rescan behavior remains unchanged.

Validation must cover a recording imported after the old cutoff, existing turn details, marker repeat prevention and existing legacy-rescan regressions. Real-session acceptance uses scratch imports and reports only session id prefixes, sizes and counts. The performance comparison uses a copy of the real database and one large invented Codex journal, with three rescan and three no-work startup runs; it measures completion time and server event-loop maximum against PR #281's recorded `appendEventLoopMaxMs` values.

## Implementation and focused validation — 29 October

The previous date cutoff could exclude a recording with missing turn data solely because its initial import was newer. Candidate selection now checks the existing completion marker and one prepared `turn.detail` existence query (`packages/ingest/src/index.ts:239–247`). The existing `obs_rec_kind(recording_id, kind)` index is declared at `packages/store/src/index.ts:388`; an `EXPLAIN QUERY PLAN` run on a scratch in-memory Store reports `SEARCH observations USING COVERING INDEX obs_rec_kind (recording_id=? AND kind=?)`. No store, schema, contract or UI file changed; the remaining rescan flow is unchanged.

Harsh approved changing the conflicting regression premise after the required stop. The updated regression at `packages/ingest/test/legacy-codex-rescan.test.ts:50` requires the newer empty-detail recording to rescan while the older partial-detail recording and Claude recording are skipped. Additional regressions at lines 64 and 73 cover complete details on both sides of the old cutoff and a completion marker with no details.

With `TEMP` and `TMP` set to `C:\Users\Harsh Jain\AppData\Local\Temp`, `pnpm exec vitest run packages/ingest/test/legacy-codex-rescan.test.ts` passes all nine tests. `pnpm check:affected` passes both typechecks and 328 related tests in 47 files, with one existing skipped test; its browser plan is "not affected". `git diff --check` passes. These commands required sandbox escalation because Corepack could not download the pinned pnpm through the restricted network; the initial blocked commands did not run tests.

Real-session acceptance, copied-database performance results, final packaging verification and the Tasks 0–3 full batch gate remain **NOT VERIFIED**. HOME-1b remains open and the PR remains draft pending those checks.
