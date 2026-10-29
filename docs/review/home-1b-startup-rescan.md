# HOME-1b startup rescan

The scope and acceptance live in [TASKS, HOME-1b](../TASKS.md#home--sessions). This report records evidence for that item; it is not another work queue.

The requested change replaces the startup rescan's date-based candidate rule with missing turn data: a Codex recording must have no `codex-turn-details-rescan-v1:<id>` marker and zero stored `turn.detail` observations. The query must use an existing index, which the implementation report will cite. Other rescan behavior remains unchanged.

Validation must cover a recording imported after the old cutoff, existing turn details, marker repeat prevention and existing legacy-rescan regressions. Real-session acceptance uses scratch imports and reports only session id prefixes, sizes and counts. The performance comparison uses a copy of the real database and one large invented Codex journal, with three rescan and three no-work startup runs; it measures completion time and server event-loop maximum against PR #281's recorded `appendEventLoopMaxMs` values.

Implementation, index choice, regression results, real-session acceptance and performance results: **NOT VERIFIED**. This initial report establishes the requested scope for draft visibility; it claims no completed acceptance.
