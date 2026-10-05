# P1 — content first, visible origins

5 October 2026. This is the first premium presentation slice, not the completed P1 experience. B4 engineering merged as PR #22 (`445786f`) after seven green CI jobs, at the builder's explicit request. Physical low-resource/lower-core and real platform release checks in [08](08-b4-history-reader.md) remain open. The builder authorized proceeding to P1 on this engineering baseline.

## Older prototype audit

Reviewed `docs/prototype/index.html` as source. Browser policy refused its file URL; no claim of visual or interaction validation of that prototype is made. The integrated React app was inspected visually instead.

Keep the prototype's composition: top agents, repository backdrop, a right instrument dock, left-to-right operations, unboxed prose below, retained downward history and reversible expansion. Its explicit synthetic-only notice and DOM-owned text are correct. Origin tethers and dock drawers are useful ideas to carry into the product.

Do not transplant its implementation wholesale. Hard-coded events and geometry cannot establish real evidence locations. A busy spinning ring is continuous attention motion. Fixed transport pacing is insufficient for live bursts. Production needs measured origins, content-dependent reading space, keyboard access, bounded history/artifacts and stable selection during capture. Neither prototype nor current base is the final product.

## Implemented composition

`presentationOf` chooses source, wide, medium or compact reading space from captured material. Reads get source width; large/long-line changes and multiline/long commands get full width. Short commands and passing tests remain compact. Container queries adapt to the actual remaining reading column, including when the inspector opens. At narrow widths actions stack, preserving readable text rather than scaling it down.

Read previews carry captured range labels and up to twelve lines. Diffs show up to fourteen lines with reconstruction qualification. Searches expose captured excerpts as links to recorded file work. Passing tests use a static outcome mark. JSON MCP previews can become small field lists or tables, with bounded row/column display and original captured preview access; nested/invalid JSON remains text. These are presentation decisions, never agent-authored summaries.

The SVG origin layer draws only paths and empty contours. It measures the actual visible tool instrument, observed MCP server or file-reference row. Current map nodes have no exposed DOM anchors, so file arrivals use an explicit **File reference** fallback; they must not be described as lifting from a repository node. Missing/offscreen/hidden origins produce no invented tether. Hover/selection shows a quiet relationship; arrivals use a finite contour. Initial history and virtualization remounts do not replay arrivals. At most three relationships are drawn and the recent arrival ledger is bounded to 512 IDs.

Captured characters arrive complete, selectable and available immediately. No typing effect, text scaling, delayed output queue or fake token stream. Deliberate reading, scroll and resize cancel contour animation. Map/motion settings remain independent of capture. There is no continuous animation loop in this layer.

## Interaction fixes and acceptance

The inspector reserves reading space on desktop, so it cannot cover a passage's expand control. A burst holds the previous passage/pixel anchor rather than relying on a stale document-height estimate; the measurement observer reads current follow state to avoid racing detachment. Height-only window resizing now resizes the map backing canvas. MCP drawers clip the entire list when closed, rather than only one grid row.

Checks: typechecks, 208 unit tests, browser input-before-output, full MCP input/result reading, burst camera hold, responsive width, DOM-measured instrument origin, existing live anchor/reconnect/map-off and paged history navigation. Real harness recordings were not imported for this UI slice. Browser visuals use synthetic content. Ten-minute comprehension, dropped-frame behavior and physical hardware acceptance are not certified by these tests.

Final browser result: nine synthetic tests passed; one real-session test skipped intentionally. Normal benchmark (`bench-browser.ts --observations 10000 --files 5000 --map --repetitions 5`, Edge, 1440×900): open 3.47 s, update p50/p95 255/351 ms, browser heap 33.25 MiB, 929 DOM nodes, sampled peak daemon RSS 429.87 MiB, viewport-next-frame p95 6.3 ms. This retests the normal workload, not 100k/1 GiB or physical laptop certification.

## Next P1 slices, in order

1. **Expose real map origins:** publish bounded node anchors from the actual renderer; use measured clipping/occlusion, never approximate coordinates. Lift from a visible graph node only when the node and evidence path agree. Keep the labelled file-reference fallback when hidden.
2. **Craft material readers:** responsive code/diff split layouts when enough space exists, captured search navigation, long terminal output folding and structured result paging. CodeMirror and richer GPU map work need measured benefits before dependencies are introduced.
3. **Complete signature choreography:** agent prose Surface, margin-only Settle, and a single Resolve arrival. Coordinate several operations within a passage without animating captured text or hiding it behind earlier surfaces. Cancel instantly on reading; new capture continues below.
4. **Validate the product:** freeze/truth/ten-minute tests with actual readers, motion off and small screens; compare time to locate a changed line and verification gap against a text transcript. Visual novelty alone does not prove developer value.

P2 since-last-visit remains separately claimed by Harsh (PR #21). Review that proposal against whole-session worker summary facts; do not infer totals from a loaded page. No schema change or harness control is introduced here.
