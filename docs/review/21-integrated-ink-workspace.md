# 21 — Integrated ink workspace

6 October 2026 · Yash / Codex · Branch `codex/ink-presentation`.

The builder asked to finish the integrated baseline instead of making more HTML studies. The older `prototype/index.html` supplies the useful reference for distinct coloured content boundaries and parallel action rows. The builder-provided `prototype/vantage-ink.html` supplies a dark repository world and calmer surrounding navigation. Both remain references; their invented events, particles, looping activity and decorative effects are not evidence or requirements for the working product. [VISION](../VISION.md) still governs motion and truth.

## Composition and materials

Agents and session context stay across the crown. The left working set is actual recorded file context, not an invented project dashboard. The centre contains accumulating passages: actions allocate their own widths, proceed left to right, wrap when necessary, and restart after the agent's unboxed prose. The right dock names observed native tools and MCP servers. Source, edit, terminal, verification and external results retain different compositions. Expanded reading takes the full available width.

Jet, Midnight and Light remain shared palette choices across Follow, Agents and Repository. Jet keeps champagne navigation; source reads use blue, edits warm copper, external results violet, and outcomes green/red. This distinction carries into the header tint, hairline boundary and reading edge. The background, crown and navigation form one world; reading materials have clear boundaries. Tool aliases wrap rather than disappear behind ellipses.

The PR's grain/vignette and chrome blur have been removed. This follows the canonical no-grain/no-blur doctrine and keeps captured characters clear; the reference HTML is not authority to relax it. No new fonts, dependencies, ornamental image assets or idle rendering loop are added.

## Repository world and activity

`MapCanvas` fits the graph across the available rectangle, rather than hiding a small square behind the central column. Drawing, pointer hit tests, search destinations and DOM motion anchors all use the same projection. Zoom/pan still changes the camera; search can centre an actual matching node and open recorded work on it.

The background labels at most 12 touched paths, outside the protected reading area. Exploration allows at most 24 touched-file labels. These are DOM text, not canvas text. They refer to graph nodes that actually exist, and are not a whole-repository symbol index. Static import edges remain the indexer's edges; no animated edge implies that one file caused another action.

The existing Lift now briefly outlines the measured repository origin with a circular cue before the document silhouette lands in the action header. A working-set fallback retains its own rectangular reference cue. Existing native/MCP Emit, Settle, Surface and Resolve remain finite, origin-checked and interruptible; captured text arrives whole and stays selectable. The original three-action arrival budget, hidden-origin checks and motion/reduced-motion/reading cancellation remain in force.

Live capture updates recorded activity. It does **not** secretly scan the repository on every call. An approved current-workspace graph remains pinned until explicit Refresh when stale; a files-only graph represents recorded locations. Mapping a repository does not grant whole-file content access. An excerpt stays an excerpt.

## Reader and timeline

Find and the historical provenance/range remain visible in an open source reader. Go-to-line and copy/pin range live beneath a native **Source tools** disclosure, operable by pointer and keyboard. Opening it does not fetch anything or alter capture. Existing page navigation, coordinates, pin limits and reading holds remain intact. Deliberate reading still detaches follow while capture/history continue; sequence replay remains optional.

PR #37 introduced the history activity strip and named palettes. Review found machine-derived recording IDs in its marker golden; those now use the scene tests' stable identity normalization. It was locally checked and squash-merged as `fc34e25`, retaining Harsh/Claude and the actual reviewer-fix contributors.

The PR's original failure-preserving thinning could exceed its advertised 400-tick budget. `lib/activity.ts` now reserves half the budget for sampled failures and samples the remaining chronology, with a strict 400 limit and no duplicate ticks. Tests cover 2,000 failures and a rare failure amongst quiet marks. These are **visual samples**, not whole-session counts or a global navigation index. Daemon history still owns bounded projections and its existing global search/file/replay queries. The new history-strip jump shortcuts currently use the supplied marker list; exhaustive next-result navigation across unsampled markers is a separate follow-up, not claimed here.

## Features from Claude's PR

The layout keeps room for the activity strip, named palettes, file lift and the existing since-your-mark / verification / file-comparison / pinned-reference surfaces. [19](19-developer-feature-proposals.md) is a backlog, not an implemented-feature announcement. Reader tabs, folder explorer, tripwires, review packets, mission control and semantic graph zoom need bounded claims and evidence contracts before implementation. Do not add empty dashboard widgets to represent them.

## Local acceptance and publishing

Use [CI_POLICY](../CI_POLICY.md): local tests and commits during development; hosted CI only for the completed product at publishing or immediately before it. Creating this branch/PR must not dispatch Actions. Local Windows checks do not certify Linux/macOS or the physical low-resource release gates.

Acceptance results belong in STATUS after completion. The browser suite covers request-before-result, parallel rows and prose boundaries, measured tool/file origins, cancellation, narrow screens, theme changes, source utilities, held-reader append, replay boundaries, comparison and exports. The opt-in ten-minute synthetic probe checks retained source, anchor stability, growing history, explicit return-to-latest and bounded DOM. Synthetic rendered frames are reviewed locally and excluded from Git. Automated passes do not establish human preference or market superiority.

Local result: typechecks/247 units, 35 ordinary browser journeys (two opt-in skips), deterministic demo and offline package verification pass. Fresh sustained reader: **602,719 ms, 113 rounds, peak 709 DOM nodes**. Final CSS-only theme-switch refinements passed the palette/anchor journeys separately; the sustained probe predates those hover-transition changes. Dark/light, source and toolbox frames were inspected from synthetic test renders because the browser review surface was unavailable. Earlier failing checks are not acceptance.

No capture/store/API/observation-schema change is included. Original package-manager edits remain local and excluded. Next work should improve the integrated product, preserve this reading contract and separately claim the staged workspace features.
