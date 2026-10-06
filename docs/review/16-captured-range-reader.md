# Captured-range reading — 6 October 2026

An integrated baseline refinement, not the completed W1 explorer. The builder asked for hover clarity, direct source inspection and shared documentation that Harsh's agent can continue from. VISION governs presentation; DEVELOPER_WORKSPACE preserves the later capability groups.

## Implemented

- A loaded read preview has a **Preview · lines a–b / Read excerpt** control. Coordinates come from the returned artifact range, falling back to the operation source start only when no range exists. The preview remains bounded to twelve lines. Hover/focus draws a source-coloured edge around the existing excerpt; no additional fetch, character motion or follow-state change.
- Activation opens **this operation's** artifact in place, rather than the file's earliest action. It holds presentation/replay following while capture continues. Focus moves to the persistent Close control before replacing the preview; Escape and existing history navigation remain available.
- Deliberate expansion occupies the passage width. Manual review found that production shape rules had overridden full-width expansion, leaving readers at preview width. The production rule now restores reading space; siblings wrap below.
- Expanded reads expose returned provenance and stored source ranges, including ranges on historical snapshots. Excerpts remain excerpts; no current file substitution or stitching of unrelated captures into a whole file.
- Source readers offer case-insensitive literal **Find in loaded source page**, highlighting matching lines and reporting their count without filtering selectable content. Zero matches says nothing about other pages/files. Query length is capped at 200 characters. Paging retains the query and recomputes highlights in source coordinates; changing artifacts resets it.
- Pending reads retain requested input/range without an excerpt-opening control. The composed/as-of boundary masks future results during sequence replay.

## Shared implementation seams

`History.ReadPreview` uses preview-scope `useArtifact`, then existing `expandedOp` state for exact opening. `ExpandedOperation` enables read provenance. `ArtifactReader` owns the local query and still requests at most 200 lines through the existing DataSource API. `common.CodeView` already supports source-line highlights. `p1.css` styles reading chrome; `product.css` restores full-width expansion. No editor dependency, API, observation-schema, capture/store or daemon change.

Keep deliberate opening distinct from selecting text in an operation body. Never make a code click silently open an inspector. Hover cannot change `follow`, `held`, `step` or `playing`. Find is reader-local state, not a new index or whole-file scan.

## Verification and limits

The daemon-backed B3 browser journey checks exact opening, Close focus, provenance, zero page-one matches for line 250, its match after paging, case-insensitive search and clearing. A separate offline fixture deliberately gives the artifact a different source start than the operation fallback: preview and reader must use artifact lines 81–94. It checks keyboard activation, matching source line 88, full-width expansion, narrow overflow and replay before the result.

Run `corepack pnpm check`, `corepack pnpm ui:build`, then `corepack pnpm exec playwright test` with `DRISHYA_BROWSER_CHANNEL=chrome`. Optional `DRISHYA_REVIEW_SHOTS=1` writes a local synthetic frame; the deliberately inconsistent range fixture is an authority regression, not a real session. Typechecks/245 units and 33 ordinary browser cases pass (two opt-in skips). Fresh final-build ten-minute reader passed: 600,148 ms, 114 rounds, peak 664 DOM nodes. Its isolated startup failure was corrected by waiting for visible/scrollable history at latest before the first gesture; all subsequent assertions remain. Charcoal/light integrated reading was manually reviewed. PR #34 merged as `3ad7336` after seven green exact-head checks on `9b25ec8` (run `37449558192`); final main CI is checked separately.

Still missing: match navigation, cross-page search, go-to-line, range copying, pins, folder navigation, semantic zoom and separately approved current whole-file reading. Find highlights lines, not individual substrings. Missing/empty artifacts retain existing explicit states. Final visual preference and physical/platform release gates remain open.

## Next bounded task for either builder

Add next/previous matching-line navigation and go-to-line within explicit stored range limits. Keep pages bounded and keyboard focus deliberate; verify a held expanded reader during live append before adding pins/tabs. Claim shared reader files in STATUS first. W2–W6 remain staged; current workspace reads require separate privacy/consent design. Read CONTINUITY → STATUS → this record → DEVELOPER_WORKSPACE when switching chats/models/builders.
