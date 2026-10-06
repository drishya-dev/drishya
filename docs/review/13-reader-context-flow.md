# Reader context and stable action flow — 6 October 2026

The builder clarified the original prototype's strength: actions share horizontal space until it is full, wrap naturally, and resume as a new group after the agent thinks or replies. Preserve this in the working app; a row is presentation order, not evidence of concurrent execution.

## Implemented

- Source and medium material have stable allocated widths (440/300 px); compact actions retain 270 px, and genuinely wide/expanded readers retain the full available width. Flex wrapping and narrow-screen limits remain. A lone action no longer expands and then shrinks its captured text when a sibling arrives. The existing reducer's prose boundary ends an action passage. No observation-schema or golden-composer change.
- The measured source/dock material backing opens over 620 ms, with a finite reading-edge cue over 680 ms. This supplies a smoother opening without moving, typing, hiding or delaying captured characters. Existing cancellation, reduced-motion, deliberate navigation and burst camera holds remain.
- The repository gutter distinguishes **Reading here**, **Selected action** and **Latest file reference**. The history publishes only its stable first-visible passage identity, not every scroll pixel; it is ephemeral reader state, reset on recording open. While held, context resolves captured primary file references in that passage. A passage without a resolved reference says so; search hits or nearby/newer actions never stand in for its location.
- Up to three matching actions in the currently composed history link directly to their recorded operation. This is explicitly **In shown history**, not a global recording count or a claim about what immediately caused the action. Full file history remains the global paged evidence reader.
- When the approved graph is a current index, the context shows **Imports** and **Imported by** from typed deterministic static-import edges. Targets must exist in that index; duplicates are removed. At most two per direction are rendered, with explicit overflow. Stale/partial flags remain visible. Wording explicitly distinguishes the current workspace index from historical execution. Files-only maps do not invent connections; map-off releases graph data while retaining captured file/action context.

## Validation and boundaries

The composer's automatic latest-step `focus` is not an explicit user selection. Only `selectedOp` overrides held reading. The context retains just action id/kind plus the composed outcome state, never a future completed state from a full replay projection. Regression cases cover both mistakes, and the sustained reader checks the held context path and scope on every append.

Unit cases cover held vs latest reference, missing/unlocated passages, exclusion of future action IDs and qualified graph adjacency. Browser acceptance covers scrolling to an older passage, current import direction, map-off file reading, explicit return to latest, stable widths with new siblings, actual overflow to a new row, and an action group restarting after agent prose. Existing live/worker/replay/resource/focus tests still apply. Record actual full-suite and sustained-reader results in STATUS.

This improves navigable repository context and accumulation; it does not complete the full creative presentation or establish human preference. The next useful work is a richer evidence-linked world and increasingly articulate content/outcome presentation, assessed in a complete real review journey. Preserve the backend/page boundary, finite motion, recorded provenance and observe-only constraints. Do not add generic dashboard widgets or fake decision pipelines to fill empty space.

Final acceptance: typechecks/243 unit tests, 30 ordinary browser cases (two opt-in skips), and the fresh sustained reader passed: 603,171 ms, 113 rounds, peak 640 history DOM nodes. PR #31 final code head `f44d11d` passed all seven Windows/Linux CI jobs before squash merge `d6f1087`. Held file context, pixel anchors, bounded DOM and inactive arrival cues were checked on every sustained append.

Next presentation review should assess long MCP text in a medium surface and distinguish repeated action links with captured range/title evidence where available. Do not widen every action or add decorative metadata by default; preserve stable sibling widths and justify extra reading space from the content itself.
