# External results as readable material — 6 October 2026

The next integrated refinement addresses a concrete reading failure: documentation results and MCP argument names were compressed into a 300 px surface. More animation would not solve it. A result should retain its natural form and give the reader enough space to understand the input and output together.

## Implemented behavior

- MCP/web results over 300 captured preview characters use a 560 px reading allocation. A long directly captured argument/query can reserve that space before the result arrives. Short receipts use 300 px; source/compact/wide allocations remain unchanged. These are repeatable presentation decisions, not claims about tool complexity. New siblings do not stretch an existing surface. A substantial result can enlarge its own surface when observed; existing held-anchor logic handles the reflow.
- Arguments use their actual available width: narrow material stacks labels and values rather than breaking long keys into many tiny fragments. All content remains escaped, stationary DOM text; no simulated streaming or new timing queue.
- MCP feeds its existing bounded result preview to the structured renderer without cutting valid JSON at 1,400 characters. The projection/worker limits remain unchanged; this is not a complete-result or historical-file claim.
- Tables discover scalar fields across the captured rows, show at most eight rows/four fields, and state those limits. Missing fields say **not present**; `null` remains `null`, rather than becoming an empty value. Scalar object layouts and tables both expose **Original captured preview**. Nested or unrecognized JSON remains literal text. Non-JSON content uses readable prose typography with whitespace preserved, without executing HTML or inferring Markdown semantics.
- Tables retain at least 480 px of column space and scroll inside the result on mobile; the workspace itself does not overflow. Surface expansion remains the existing reversible reader interaction.
- The repository's three page-local action links now have bounded descriptive labels: completed read ranges, recorded commands or titles. Only composed action IDs/outcomes qualify. A pending action uses its tool identity, preventing a full replay projection's completed range/title from leaking backward. These are navigation metadata, never an inferred decision or agent quotation.

## Evidence and limits

Typechecks/245 unit tests pass. The ordinary browser suite passes 31 cases with two opt-in skips; a subsequent mobile-table refinement passes its focused geometry/evidence regression. That new case checks a >1,400-character valid JSON preview, all five records, preserved null, reversible raw preview and mobile-local table scrolling. Existing live-input/result, held context, replay, resource, keyboard and reduced-motion tests remain intact. CI validates the final revision separately.

Rendered review covers the actual integrated documentation result plus synthetic desktop/mobile table frames. The previous reader-context increment's 603,171 ms sustained test remains prior evidence; no new ten-minute measurement or human-preference claim is made here. No capture/schema/backend/pacing logic changes.

Next useful work: make the evidence journey from source through change to recorded verification more directly navigable without turning the canvas into dashboard widgets. Keep historical cutoffs, order-only test qualification, bounded pages and recorded content. Do not claim that a pleasing frame completes the premium experience.

PR #32 final head `95c921b` passed all seven jobs in run `37444050155` and squash-merged as `e57d98f`. The initial Windows run caught the new test scrolling before asynchronously loaded history was ready; it now waits for visible, scrollable history, then confirms held navigation. Five focused local repeats and the final full suites on both platforms pass. The builder's subsequent toolbox/source/graph/folder expansion is planned in [DEVELOPER_WORKSPACE](../DEVELOPER_WORKSPACE.md), with baseline presentation first.
