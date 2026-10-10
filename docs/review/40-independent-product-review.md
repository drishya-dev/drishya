# Independent developer review — 10 October 2026

## Method and adoption verdict

Two reviewers started without this chat's history and received a broad instruction to assess the whole product as developers: actual usefulness, willingness to switch, usability, presentation, reliability and missing capabilities. Both interacted with Edge against an isolated synthetic-demo server, tested replay and live accumulation, inspected recorded source/diffs, file history/comparison, verification, search and map navigation, and inspected desktop and narrow layouts. No real native prompts or user journals were changed. Screenshots and detailed reports remain local under `.local/review-one/` and `.local/review-two/`; they are not release fixtures.

Both would use Drishya as a **supplemental evidence/review companion**, not replace native chat yet. Reviewer one: **6.5/10 overall**; evidence trust 8, file review 8, navigation 6, default readability 5.5, map utility 3.5. Reviewer two: **6/10 overall**; visual presentation 8, evidence 8, everyday reading 6, replay 7, map utility 4, discoverability 5, chat replacement 4. These are subjective reports from two synthetic-demo reviews, not measured market adoption or proof of real integration.

## What earns repeat use

- Historical file evidence across Claude and Codex is the strongest differentiator. Reviewers could compare the original read with later captured/derived evidence and follow the actual edit.
- Replay correctly hides future verification. Later passing tests are described as recorded order with coverage unknown; unavailable file states remain unavailable. Trust improves when uncertainty is explicit.
- Captured failures, assertion output and passing outcomes make review more useful than a final agent assurance.
- Live work continues while reading earlier material. Upward history scrolling detaches Follow; local result scrolling keeps it. Reviewer one confirmed the settled mobile layout was readable.

## Prioritized iterations

1. **Return-to-work evidence:** surface the existing since-mark digest with changes, failures, test outcomes and capture gaps. Each entry must jump to exact evidence. Add a file-oriented change/verification review without implying test coverage.
2. **Useful previews:** prioritize actual changed hunks, failed assertions and search matches rather than spending a short preview on imports/comments. Keep the complete captured material available; derived preview selection must never masquerade as the agent's read range. Review useful widths and consistent comparison alignment before adding more motion.
3. **Discoverable reading navigation:** expose next edit/failure, file history and evidence comparison where the developer is reading. Preserve return position and keyboard access. Avoid adding more competing tabs.
4. **Repository focus:** make the map answer a question—touched files, supported import relationships, or another session's work. Stable framing, bounded density and readable labels matter more than orbit. Long crossing background strands currently compete with source. Manual Fit worked; the initial exploration orientation/zoom was awkward. Do not record this as a broken Fit implementation.
5. **Proven native workspace:** complete account-specific actual-turn acceptance for both harnesses, attachments, approvals, model/effort, ownership, cancellation, compaction and session switching before claiming a chat replacement. Review 39 records implemented behavior and remaining limits.
6. **Later developer utility:** local reviewed-hunk marks/unreviewed queue, privacy-reviewed evidence packets, branch/commit changes linked to captured work, and editor entry at the changed line. No automatic code editing or fabricated causal links. Theme variants follow these behavioral improvements.

## Findings handled in this pass

Returning from `?demo#token=…` to Home dropped the launch token because the bundle route had not used the daemon API. Preserve that hash on the root navigation; the API consumes it normally. A browser regression verifies authenticated Home. Home's obsolete “Observe only” description now reflects explicit native continuation.

Narrow-screen reports differed: reviewer two saw utility overlap and truncation; reviewer one found the settled 390 px layout usable after initial resize settling. Treat this as a follow-up interaction/resize acceptance task, not a certified mobile failure or a universal mobile pass.

## Acceptance limits and next bounded task

Neither review certifies real native execution, concurrent agents, antivirus behavior, privacy resistance, large-session performance or physical/platform reliability. Keep those release gates separate. The next product iteration should combine return-to-work evidence and useful preview selection, then repeat the same recorded journeys and ask whether developers can find the exact change/failure faster. Keep current neutral action surfaces, colored icons, source provenance, shared hover/scroll behavior and the native observer/controller separation.

Hosted CI remains publishing-only. Continue local tests and commits; do not dispatch GitHub Actions for these iterations.
