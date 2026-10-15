# Modern reading and visual craft — 15 October 2026

Builder direction: continue Modern as a connected developer workspace, borrowing useful reading behavior from Legacy while keeping its own design. Typography, font style and vivid, attractive colors are part of the request, alongside content-shaped sizes and meaningful motion. Preserve Canvas and Legacy. Use local tests only; hosted CI remains a publication gate.

Applied skills: installed `emil-design-eng` for composition, typography and material hierarchy, and `animate` for deliberate, interruptible whole-material reading. This implements the builder's explicit header-hover exception to generic advice against frequent enlargement.

| Before | After | Why |
| --- | --- | --- |
| System-dependent sans and muted material colors | Locally hosted Outfit and JetBrains Mono; dark slate surfaces with mint, sky, violet and amber semantic/syntax accents | Stable typography and stronger readable contrast without coloring every card differently |
| Card previews only; no deliberate reading enlargement | Hover the title/header for 200 ms to enlarge the one actual card within viewport/composer bounds | Reading space without losing the surrounding sequence or duplicating captured content |
| Multiple nested scroll containers | One bounded material body per card | The wheel has one predictable local reading area and can chain to history at its edge |
| First three hunks/sixteen lines and first four search hits | Every hunk/line/hit already present in the bounded projection is mounted and scrollable | Changed lines must not disappear behind an artificial preview count |
| Long full paths dominate titles | Filename title with full original title tooltip and full path footer tooltip | Distinguish neighboring files quickly without throwing away location evidence |
| Test result below a long command | Captured aggregate outcome above the command | See the outcome before scrolling through setup commands; rectangles remain aggregate, never fabricated test identities |
| Unsent prompts lost when visiting another screen | Up to eight memory-only text drafts, 65,536 characters each, keyed by API client and recording | Navigate safely without writing private unsent text/attachments to storage |

## Material behavior and constraints

`modern/useReadingMaterial.ts` owns header reading; `fresh/material-motion.ts` continues to own arrival/reflow, suspending itself while the card is reading or returning. The same DOM material is translated and scaled from its actual current rectangle to the new allocation in one 300 ms WAAPI transition using the existing ease token. No text clone, typewriter, fake scanning or separately timed border plate.

A stable flex slot retains history allocation. The enlarged card is absolute relative to that slot, not fixed to the screen: it travels with normal page scroll and passes beneath fixed page controls. It opens near its source, clamped horizontally and above the composer. Only one card is enlarged at a time; moving away returns it after a short dwell. Escape/Tab/resize/blur restore the compact material. Reduced motion changes the allocation immediately. Touch/narrow layouts keep the explicit click-to-inspector path rather than hover.

Reading a source/result requests at most 120 captured lines on demand; resting previews retain their separate eight-line slice. Closing does not accidentally turn the compact card into a 120-line preview or reuse a completed artifact before its replay point. Backend omissions and larger artifacts remain explicitly disclosed and reachable through the paged inspector. This is not an unbounded full-artifact mount. Projected patch/search content has no additional frontend slice. MCP and ordinary tools share the material/scroll/reading implementation.

Connection curves remain attached to the stable recorded-order slots, behind raised materials. They show captured start order, not causal dependence. Inner scrolling detaches Follow only if an upward wheel actually reaches history; local code scrolling is not treated as navigation. Optional replay playback remains independent.

## Presentation

Modern-only `palette.css` uses existing licensed local font assets; no font-service requests or dependencies. Neutral card surfaces/edges are shared. Icons, syntax, captured outcomes, selected state and error contours carry color. Body prose is 15 px, material code 12 px with generous leading and ligatures disabled; file/tool labels are increased to 13 px. Mobile composer type remains 16 px. Source, code fences and readers use the same lexical syntax palette. All changes are scoped to Modern; the other version styles are preserved.

Native drafts reuse the existing bounded `PromptDrafts` implementation. Attachments, authorization and native settings are not cached in these drafts. A successful submission clears only the submitted draft/attachments; subsequent text typed while the submission resolves is retained. Refresh intentionally clears drafts. Native execution remains explicit and consented; no native prompt was sent during this review.

## Validation

- Both TypeScript projects, production build and 374 unit tests pass locally.
- Browser coverage: Modern native consent, evidence questions, stale Git handoff, replay as-of material, all-version routing, files/map, long prose, responsive bounds, exact hover return/history height, reduced motion, all projected changed lines, MCP wheel chaining and draft navigation. **28 browser journeys pass** across Modern and Canvas/version integration.
- Actual local Codex Drishya and Claude Skeletongraph recordings inspected in the browser. Claude's rootless recording remains correctly read-only. Screenshots/store stay ignored under `.local`.
- Test development exposed a loading-state height measurement and an obsolete full-title text locator; the final assertions wait for captured material and locate the preserved title tooltip. No assertion was removed to mask a product regression.

## Continue without losing scope

This is a reading/presentation increment, not a claim that Modern has full Legacy parity or is release-ready. Keep the remaining review-72 gates: true 3D/resource controls, complete historical prompt navigation, offline bundle entry, deeper reader/navigation memory, broader review-50 utilities, actual native-account lifecycle and physical/platform/accessibility/ten-minute acceptance. Text draft continuity is now implemented within one loaded application. Cross-reload draft persistence is intentionally not enabled.

Further motion work must be judged on dense real histories, rapid hover reversal, live late results and replay; preserve whole selectable evidence and independent capture. Do not replace these with a synthetic-only visual demonstration or remove the alternative UI versions.
