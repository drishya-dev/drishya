# CONTENT-5b — genuine Codex lifecycle and child navigation

28 October 2026, PR #276. Follow-up acceptance under the updated whole-task definition of done. The earlier PR #271 implementation had real Claude child activity, but its exact Codex interacted/completed and separately imported-child positives were fixture-only. Those Codex cases are now verified on genuine local capture.

## Real case discovery and reproduced repairs

The latest continuation journals contain child interactions but not the original spawn. A read-only inventory of all **30 available Codex journals**, about **758 MB** at scan time, found the original parent: **17 spawn calls**, **233 native SubAgentActivity records** (17 started, 178 interacted, 38 completed), and an exact activity-address match for every spawn. Several matching child rollouts also contain the captured parent-thread lineage. No fresh native/model call was needed, and no sandbox, approval policy, configuration or credentials were changed.

| Before | After | Why |
| --- | --- | --- |
| A multi-worktree parent deliberately has no single projection workspace root; a valid imported child therefore had no navigation link | Use the workspace captured on the exact spawn observation, then retain the existing UUID, parent-lineage and child-root checks | A missing common parent root must not discard the precise boundary the call actually recorded |
| Native `kind: started` metadata was omitted from the thread because only `spawn` was recognized | Both captured spellings render the existing “Child started” step | The fixture must follow the real harness spelling; retain compatibility with earlier captures |

Both regressions failed on the original implementation before their corresponding fixes. The root-boundary regression also proves a child from a different workspace remains unlinked. No reducer, History, adapter, event-schema, crypto or UI layout change.

## Genuine acceptance

The entire original parent and one exact child were imported through the normal redaction path into a scratch Drishya Store. No journal was fabricated, trimmed or edited. Source growth during the product's passive live observation is retained normally.

| Recording prefix | Acceptance data |
| --- | --- |
| Codex parent `rec_32f628ee` | Initial import: 487,762,553 source bytes / 29,370 observations. Later live snapshot: 488,577,325 bytes / 29,544 observations. Seventeen projected delegations. |
| Codex child `rec_459d400c` | 3,201,890 source bytes / 688 observations. Filename thread UUID, captured parent-thread lineage and captured spawn workspace all agree. |

Two different native delegations cover the required data:

- **Exact child-navigation case:** all **30 captured steps** remain reachable across 25-step pages, including the captured start, **11 interactions** and **one recorded completion**. The parent spans worktrees; its common projection root is absent. The corrected helper links the genuinely imported child within the call's captured workspace.
- **Recorded metadata/start case:** **14 captured steps**, including the genuine **started** record, **three interactions**, **one recorded completion**, and captured model/effort. The later child-navigation sample does not record model/effort; it remains absent there rather than borrowing the other child's metadata.

Each case was opened in the running Modern UI at **1440 × 950** and **600 × 950**. All pages were traversed. The first case's “Open child session” link was activated and reached the exact imported child recording, whose captured history remained readable. The second case displayed its recorded model and effort. Zero page JavaScript errors or horizontal viewport overflow occurred. Screenshots stay private in ignored `.local/`.

Navigation into these deep native cards uses the product's saved selected-operation location, containing only the exact captured operation ID and reading metadata. The session search's bounded hits did not include these calls; no fake search result, source response or captured text was injected. Every delegation query and child-navigation response comes from the actual scratch Store.

Two genuine early replay queries, immediately after each call but before its child identity is recorded, return only the delegation step: **no child link, model or completion leaks from later capture**. This is query-level replay acceptance, alongside the existing replay unit/browser guards.

## Verification

- **16 focused units** pass: twelve daemon delegation tests and four presentation tests, including both reproduced failures, legacy start-spelling compatibility, exact/mismatched root boundaries, current/forgotten children, replay, live append, encrypted and long tasks, and full replies.
- Both TypeScript projects and the UI production build pass.
- Five existing targeted delegation browser guards cover the legacy `spawn` spelling, current `started` regression's surrounding behavior, exact imported-child navigation, Claude pagination, long tasks and baseline cards.
- Four genuine Codex browser journeys pass (two cases × two supported desktop widths).

No full gate was rerun for each fix. The integration batch owns the full gate. This large actual parent is used to prove content correctness; it does **not** certify performance readiness above the previously measured workload range.

## Claude continuity and exact remaining handoff

The previous genuine Claude Code case, `rec_024517cd` (**6,516,417 source bytes / 2,112 observations**), verifies a captured Agent description/type, **33 thread steps** comprising **19 child actions**, **12 child messages**, spawn and parent result. Those same-recording child actions remain separate from the Codex separately imported-child case. Existing Claude pagination/name and root-boundary regressions remain green; this follow-up does not invoke another builder's Claude session or claim a new Claude-native run.

For any additional Claude-specific native acceptance, the Claude builder should create or choose a throwaway Agent delegation with captured `description`/`subagent_type`, a child read and returned reply, import the real main/companion journals normally, and check the name, child activity and parent reply at 600/1440 px. Use “Focus child actions” when the importer keeps companions in the same recording. Assert a separate-session link only if an independently imported child has the exact captured parent-directory/agent identity and matching workspace; never infer a missing import or join by timing.

The native encrypted Codex task remains explicitly unavailable as plaintext. Fixture task-pagination coverage is not described as decryption of that genuine task. No causal attribution, native answer or missing model setting is invented.

## Related MOTION-2 inventory note

The same 30-journal native tool inventory contains **zero direct `Read`/`read_file` calls**. Codex reads in these samples use shell/code tools; they are not evidence for a typed Read card. This does not change MOTION-2 code or claims: genuine Codex Edit/Write and genuine Claude Read/Edit/Write are the appropriate available origin cases. A native typed-Read positive cannot be fabricated by relabelling a shell read.
