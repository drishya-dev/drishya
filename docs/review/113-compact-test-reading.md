# Compact result reading and horizontal composer identity

18 October2026. TASKS remains the single active work list. Git graph presentation is explicitly deferred by the builder; no graph implementation changes here.

## Prompt correction

The previous symbol-only edit retained `flex-direction:column` on `.modern-composer-target`, so the workspace name occupied a second line. It is now a horizontal aligned row with a9px gap, a fixed-size original symbol and a shrinkable, ellipsized basename. Status and permissions retain their existing positions. Codex/Claude names and recording suffix stay out of this row. A geometry-based browser guard checks shared vertical centers,7–11px separation,24px maximum row height and viewport containment for both harnesses at320/390/1440px, including a deliberately long basename.

## Captured result bars

The shared `CapturedOutcomes` owner renders compact semantic pass/fail/skip/etc rectangles. When an explicit reporter row supplies a name/index, its bar can be hovered, keyboard-focused (Left/Right/Home/End), and selected. Selection opens the existing portal-based ReadingDialog owner with exact nearby captured output and return to the initiating bar. A full captured-output action opens the original operation reader. Portal click propagation is isolated so closing this reader cannot select its underlying card and accidentally open Inspector.

Summary-only results remain grouped counts with no invented names, indices or execution order. Partial case-only results explicitly say captured rows and runner totals unavailable. Captured row order is never labelled execution order; only complete flat TAP indices retain the existing ordered guarantee. Ambiguous repeated runs or rows exceeding a summary are not attached to that summary. Native shell/test, MCP/structured results and Inspector use this presentation without changing operation kind/status or native process-success meaning.

### Formats and limits

- Existing Vitest/Jest, pytest, Cargo and TAP totals remain, plus explicit Playwright counters under a reporter context. Pytest warnings are separate metadata, never test counts; real Skeletongraph outputs exposed this gap.
- Case rows: explicit timed Jest/Vitest cases, numbered Playwright rows with reporter evidence, verbose pytest, Cargo and flat TAP. Nested TAP rows are not mapped to global indices. Suite-only rows, script arguments, arbitrary successful exits and unsupported output remain raw.
- Already redacted stdout/stderr/content/result envelopes are read as separate captured fragments. No code evaluation or regeneration. Per existing budgets:128KiB parser input,8fragments/runs,256visited wrapper nodes/depth6,64KiB per fragment,240named rows,300character display names and bounded6KiB nearby excerpts. Complete source remains in the original reader.
- Recognized long native outputs may request at most200head lines and200tail lines through the shared byte-budgeted preview ArtifactCache. Complete small material recovers clipped JSON wrappers. Disjoint slices are never concatenated or case-mapped across gaps. A tail summary is explicitly labelled; TAP/Playwright tail context is supported only by a genuine matching head header. Larger/partial JSON, unsupported reporters, missing/expired artifacts and MCP material not stored as artifacts retain raw/preview limitations.
- No background polling, new schema/store format, capture changes, native turns, source writes, runtime dependencies or external content request. Artifact IDs remain bounded by the current historical projection; pending replay results stay unavailable.

## History selection repair

Real-session validation found that `count:1` centered at `target - count/2`, then floored, selecting the preceding passage. Using `target - floor(count/2)` keeps the actual selected operation in even the smallest supported window. Regression checks one loaded passage and unchanged historical step; ordinary32-page behavior is unchanged.

## Design review

| Before | After | Why |
| --- | --- | --- |
| Symbol and basename stacked | One horizontal row with ellipsis | Reclaim composer height as explicitly requested |
| Noninteractive result tiles | Small named-result bars with focus/selection | Reach captured evidence directly |
| Inline selected excerpt can clip inside a compact card | Focused reading dialog with full-output handoff | Keep cards compact and source readable |
| pytest warning summaries not recognized | Test counts plus separate warning metadata | Match actual developer output without inflating tests |
| Clipped JSON preview hides a summary | Bounded stored material recovery | Show available evidence without guessing |
| One-passage request returns its predecessor | Exact centered selected passage | Keep bounded navigation correct |

## Validation

Both TypeScript checks and production build pass. Full511-test/91-file local suite and focused history/parser regressions; synthetic native/MCP/wrapped/long-output/keyboard/raw-access journeys, both-harness prompt geometry at320/390/1440px, and real Drishya/Skeletongraph Codex/Claude desktop/phone test-output investigation. The actual runs supplied pytest-with-warnings examples. Initial browser checking caught portal bubbling into the underlying action; the guarded rerun checks that Inspector remains closed. Local screenshots inspected; nothing private is committed. No hosted CI, signed-in native turn or physical/screen-reader acceptance claim. Unsupported formats and broad adaptive media remain on TASKS.
