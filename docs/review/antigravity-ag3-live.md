# AG-3 · live Antigravity capture and replay boundaries

14 November 2026 · PR #474 · base `codex/harness-antigravity` · Fable reviews, no self-merge.

The two blocking code defects are fixed: cold restart restores a sanitized inspection checkpoint instead of scanning consumed journal bodies, and late task output has separate replay versions/artifacts at its observed boundary. Native event kinds and Claude Code/Codex adapters are unchanged. The derived reducer is r42; the captured-event contract remains 0.2.1-draft.

## Accept evidence

| Requirement | Check and result |
|---|---|
| Genuine live steps and Running now | `660a1ec4`, final journal 21,144 bytes, six operations, one readable child. A pre-armed final-build observer saw six journal changes and 15 growing-log snapshots; the new command card appeared and History remained available at 600/1440. Prior Running now frames at both widths also passed. |
| Measured arrival | Journal detection p50/p95 89/501 ms (six changes); task-file detection 1,570/1,872 ms (15 snapshots). One local run, 500 ms observer ticks with periodic side-file refresh; not an internal harness flush or broad performance certificate. Private evidence: `.local/ag-3/armed-counts.json`. |
| Output and task identity | Three genuine background commands retain native task identity and captured output; absent exit status stays unknown. Exact manage_task completion, late file writes, redaction, bounded/partial output and replay boundaries have synthetic regression cases. All 25 real live/task-case sessions imported into scratch storage with zero unknown/unaccounted calls. |
| Child opening | One real child opens from its exact parent receipt at 600/1440. A spawn in `61769918` (548,027 bytes) exposes five exact child links; targets validated and a child opened at each width. Missing imports are labelled; no timing/name joins. |
| Restart during the live run | Drishya reopened at cursor 18,861; zero cursor advance and zero duplicate inserts on resume, then continued capturing the growing log. |
| Cold restart of the large session | A separate Node process reopened `99ef88f8` (43,659,730 bytes): 3,072 journal bytes read in three validation-prefix reads, zero body reads, zero cursor advance. Synthetic append and malformed/replaced checkpoint tests also pass. This is stronger than a cursor-delta-only assertion. |
| Partial final line | Synthetic interrupted-write tests retain the incomplete suffix and consume it once complete, including after restart. No genuine partial-line/process-crash case is claimed. |
| Deliberately killed Antigravity | **Not run: external acceptance pending.** There is no isolated signed-in native test profile. The accessible instance owns the user's real histories; it was not force-crashed. Existing allowed index metadata has zero readable sessions with a recorded killed flag. A builder must provide an isolated native interruption case; no native content was fabricated to substitute for it. |

## Validation

- Both typechecks passed. All units: **1,554 passed, one existing skip**, four workers, 249 files.
- **29 targeted Edge browser checks passed**, two workers, zero retries: antigravity-live, delegation-thread, home-current/stats/groups/opening, library-search, conversation-switch. UI rebuilt first.
- Package verification passed: isolated offline install, Claude/Codex import, bundle, authenticated API and persisted restart.
- Genuine existing-harness frames at 600/1440: Claude `rec_6f4e5cf3` (212,057 bytes, one prose passage), Codex `rec_88f439d7` (194,590 bytes, one operation/one passage); zero page errors or page overflow. Automated geometry/visibility, not a claimed human design review.
- No hosted CI or final combined full gate. `check:affected --dry` selects the full browser suite for the reducer; that integration gate remains after AG-1–5. AG-1's earlier six reproduced baseline failures are historical evidence, not a claim about today's main.
- Screenshots and raw local evidence remain in `.local/`; no conversation content was printed, committed or uploaded. Native sources are read-only; checkpoints live only in the scratch Drishya store and pass through seal before persistence.

## Merge seams

- capture-core index/jsonl: optional checkpoint restore/snapshot plus asynchronous prepare/refresh hooks. Store index: cursor interface only, no database migration. Ingest: restore before discovery/import/sync, seal the bounded checkpoint before cursor writes, retain valid journal records on side-file failure.
- adapter index: two allow-listed transcript inspection checkpoints, validated against size/time/prefix identity; incremental unread suffix inspection. tasks/subagents/live modules: bounded same-conversation references, exact IDs and stable observed snapshots.
- projection/contracts: optional **derived** result versions only for Antigravity background commands, distinct output artifact and timeline IDs, historical selection without future result bytes. Running snapshots become scrubbable at the next existing timeline boundary; no native event is invented to animate each file poll.
- delegation-thread/types and DelegationDetail: exact imported-child lookup and every child link using existing classes. No layout/style/motion redesign.

Keep AG-3 unticked/claimed until the external native interruption line is resolved. The PR can be reviewed under AGENTS' external-acceptance exception; it is not a declaration that all Antigravity integration is accepted. Merge #469 first; #472 supplies product identity. AG-4, AG-5 and the final integration gate remain separate work.

## Final integration review follow-up, 14 November

Yash approved reopening only pinned side-file reads and native child replay after review found two blockers. These changes are delivered in the cumulative AG-5 branch for one integration review, not merged into main.

- Output logs and child receipts now use openObservation's validated inode-pinned read-only open. The child allow-list admits only same-conversation `.system_generated/subagents/<id>.json`; no private paths, cross-conversation reads or extra native writes. Directory/junction swaps between validation and open are refused before any bytes are read. Existing media/artifact guards stay intact.
- A late Antigravity agent.spawn receipt snapshots the earlier completed operation, adds a derived revision boundary, and versions its child association/provenance. It is not another native tool completion. Historical projections hide native children and stops before their evidence boundary. Claude/Codex branches remain unchanged. Reducer r45, no event schema change.
- Eleven focused tests pass, including two adversarial swap tests and a completed-spawn replay test that checks operation, agent and link visibility before/after the receipt. Backend typecheck passes. The currently running broad gate is frozen at c04947e4 before this delta; do not attribute its result to this fix without the recorded delta/final validation.

The external signed-in native-application interruption case is still unrun: there is no isolated authenticated profile and shared Antigravity must not be force-crashed. Killing a background task does not satisfy that line.

Parallel native swarm child receipts are now explicitly unresolved: a shared planner result step cannot identify a unique request. This is a visible captured-data gap, not a name/model/timing join. Single-request invoke/swarm child references retain exact opening. The final focused safety/native/replay set has 20 passing tests.
