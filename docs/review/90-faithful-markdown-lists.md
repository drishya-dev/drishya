# 90 — Faithful instruction lists

17 October 2026. Bounded follow-up to84/85/87, using the installed Emil design-engineering skill. This is reading correctness, not a new presentation or animation.

| Before | After | Why |
|---|---|---|
| Adjacent bullet/numbered rows merged into one list | Separate semantic ordered/unordered lists | Preserve the distinction between steps and supporting notes. |
| Indentation disappeared | Nested lists remain within their parent item | Do not change the hierarchy of captured instructions. |
| Numbered steps restarted at1 | Captured starting ordinals and explicit discontinuities retained | A later excerpt must not pretend to be the first step. |
| Continuation paragraphs/fences detached from items | Indented paragraphs, quotes and fenced content stay with their item | Keep instructions and their examples together. |
| Recursive nesting could be unbounded | At32 levels, remaining text is a selectable text fence | Keep extreme input readable without an unbounded render stack. |

Shared Markdown applies to agent prose and current Markdown documents. Captured text, raw source, artifact identity, Copy and provenance are unchanged. This remains a deliberately small safe renderer, not a claim of full CommonMark support. No transcript HTML is executed. Repeated reading has no added animation.

Validation:435units/73files and both typechecks pass; UI production build passes. Focused Edge browser verifies imported instruction structure and no horizontal overflow at1440/900/390px. Actual private Drishya continuation history/manual scrolling/multi-file Workspace also passes. No native prompt, hosted CI, private recording or artwork/package-manager edit is included.

Next: keyboard-operable exact Markdown path/line reading destinations, source/base/draft comparison and the joined evidence → current source → native correction → recorded check loop. The wider84/85/87 component/palette and native/human/platform acceptance queue remains open. Antivirus recurrence is tracked independently in38; this UI increment does not fix it.
