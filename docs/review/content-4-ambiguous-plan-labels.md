# CONTENT-4 — repeated task labels are not identities

25 October2026, PR219. A correctness fix to the existing TodoWrite comparison, not a new plan source, layout or History feature.

## Reproduced defect

Two literal tasks named Run tests, one pending and one completed, are captured again unchanged. The old text-keyed Map retained only the last status for that name, so the unchanged pending task was labelled reopened. A duplicate in either the previous or current revision also made comparisons unreliable. Five new regressions fail before this fix.

The comparison now identifies repeated labels in each revision. When a label already existed and is repeated on either side, it keeps the captured task text/status without inventing a per-task transition. Nothing is merged, reordered or dropped; totals and completed counts still include every literal item. A label absent from the previous revision is still added, even when repeated. Once a label is unique on both sides again, ordinary transition comparisons resume. Exact unique labels, real additions and removed labels otherwise keep their existing behavior; no row-index identity is guessed.

| Before | After | Why |
|---|---|---|
| Unchanged duplicate row could say reopened | No derived transition for an ambiguous match | The source gives no stable task identity |
| Map's last status represented every matching name | Every literal row/status/count remains visible | Captured material must not be deduplicated by label |
| A unique neighboring task completed | Same legitimate completion remains visible | Ambiguity is isolated to the repeated name |

## Local checks

-10 plan-thread units: five existing cases plus five regressions for unchanged pairs, duplicates on either/both sides, genuine new duplicates and returning to unique matches. Baseline failed all five new regressions; fixed suite passes.
-Three browser checks: existing checklist journey plus1440px/390px guards for pinned totals, both duplicate states, honest stream summary, expanded markers and revision navigation. Each viewport starts with clean navigation metadata in its disposable store; otherwise deliberate expansion in the preceding case is correctly restored.
-Both project TypeScript checks and production build pass. 790 integrated units pass. No CSS, DOM, History, paused PERF-2, capture/schema/contracts/projection, dependency or native-control change.

## Evidence limits and handoff

The edge fixture is synthetic. A bounded read-only scan of39 recent Claude journal candidates (files above45MiB excluded) found no exact assistant tool_use calls for TodoWrite, TaskCreate, TaskUpdate, EnterPlanMode or ExitPlanMode. Tool definitions and quoted command content were not counted. This is not an exhaustive absence claim and cannot certify real plan-mode capture.

CONTENT-4 stays open for real-source verification, TaskCreate/TaskUpdate/ExitPlanMode and Codex plan sources (DATA-7). DATA-3 ownership and the builder's History/PERF-2 pause remain untouched. Main's known TEST-2 reading-position regression still blocks a clean whole-browser merge gate; focused review is ready, but do not auto-merge through it.
