# 27 — Continuous materials and a density map

7 October 2026. This records the builder's latest correction to the integrated product, superseding conflicting motion/map/prompt details in reviews 24–26. It changes presentation, not captured-data contracts or native controller permissions.

## Builder direction and narrow overrides

The whole action surface should zoom continuously from its true origin until it reaches its final allocation. Moving a clipped surface into place and revealing its full size afterwards produced a visible pop. Moving existing surfaces when another action joins a row must also ease into place.

This explicitly overrides the earlier ban on scaling captured characters **only for a finite arrival/reflow of the single real DOM surface**. No duplicate text, synthetic typing, simulated scanning, delayed ingest or rewritten evidence. Source remains mounted whole and selectable. Reading intent cancels motion immediately; reduced motion renders the resting surface immediately. Agent prose remains unboxed and arrives through a finite paragraph fade, never a typewriter.

Scrolling *within* a scrollable result/source/terminal is local reading and must not detach live follow. History scrolling, selecting text, opening evidence and deliberate navigation still hold the reader. Capture always continues. Overscroll stays inside the material rather than scrolling the history accidentally. Automatic pacing holds for large results are distinct from a reader interruption: they hold the camera without cancelling an already travelling surface.

The repository is still a spatial node map with real import connections. Density groups are navigation conveniences, not folders, agent reasoning, architectural boundaries or invented causal relationships. Nearby files can cross folder boundaries. Zoom around a group reveals finer spatial bins and eventually individual files; Fit restores the overview. Root configuration files remain individually identifiable at the indexer's recorded positions. The actual folder hierarchy has its separate explorer.

The native prompt is an ordinary always-visible textarea, not a disclosure. Enter sends; Shift+Enter adds a line; IME composition does not send. Workspace consent, native availability and the explicit idle-other-clients acknowledgement remain mandatory. These checks are enforced at submission as well as in the disabled send button; the server's independent checks remain unchanged. Offline bundles/demos remain read-only.

## Implementation and boundaries

- `material-motion.ts` measures natural DOM geometry using a top-left transform origin. Arrival durations are approximately 1.4–1.65 seconds; reflows use 720 ms. A finite animation retargets from its last visible rectangle as real dimensions change, with the original deadline preserved. Scroll offsets are compensated. No permanent rendering loop or composer wall-clock dependency is introduced.
- `Origins` briefly prepares new arrivals before their post-follow measurement, avoiding a full-size flash. It keeps the real arrival across passive React updates and automatic pacing holds. Child glyphs, relationship markers and excerpt readiness use resting geometry, not the temporary zoomed rectangle. Missing/occluded origins remain explicit fallbacks.
- `History` measures up to 80 mounted operation geometries and animates genuine layout changes. Inner scrolling cancels only the material under the reader; main-history scrolling cancels arrivals and holds follow. Existing selection/focus/reader safeguards remain. Local scrolling does not promise that future large bursts will never trigger the independent readability hold.
- `map-detail.ts` uses deterministic spatial bins, preserving average node positions, exact membership and aggregated real imports. At high zoom it returns original files. The group labels use a shared path prefix only when present, otherwise Mixed files. Current `.local` caches stay excluded; historical captured paths stay intact. Map labels and edges remain bounded (48 group labels, 600 drawn imports); budgets prefer visible camera geometry. There is no folder-drill mode or fake group-as-file origin.
- `flow-route.ts` tries direct and outer-gutter orthogonal routes against all measured visible surfaces. It never draws through an action's contents. A route with no free endpoint/corridor is omitted until geometry allows it. Sequence is labelled order, not causality. These are action-order connectors; graph import lines remain separate evidence.
- Jet black/charcoal lining remains. Source/change/verification/external surfaces have semantic coloured borders and chrome. Syntax uses distinct keyword, function, string, number, comment, type and property colours; the lightweight tokenizer is a display heuristic, not a language parser. Selection/read-range affordances remain real captured ranges. Terminal commands and output wrap within their material, including long uninterrupted strings.

## Verification

Local typechecks and 283 unit tests pass. The regular browser suite passes 42 journeys, with real-session and ten-minute soak opt-ins excluded from that count. New browser checks sample the continuous real surface zoom while a captured result changes allocation, and use a real wheel gesture plus local pointer/focus/keyboard checks to verify inner scrolling keeps follow while a history gesture holds it. Existing arrival-origin, interruption, reduced motion, source evidence, comparison, native controller/approval, mobile containment and long-history checks pass. Isolated offline package install/import/API/restart passes.

Fresh ten-minute synthetic live reading passed at **601,959 ms / 112 rounds / peak 798 DOM nodes**. The final local scrollbar/keyboard gesture extension followed its start; targeted interruption/zoom/scroll checks and the full browser/type/package checks are repeated on that final build. These checks establish implementation behaviour on this Windows reference machine, not human preference, cross-platform acceptance or universal release readiness. Hosted CI remains publishing-only; no Actions run is dispatched during development.

## Carry forward

Keep both original `docs/prototype` references. Implement improvements in the integrated app; do not resurrect competing HTML demos. Preserve other builders' features and authorship, the paged history boundary, redaction before every sink, passive capture independence and the connected workspace consent/native permission model. Do not return to folder-card maps, collapsing composers, fake typing, or a translate-then-final-size reveal.
