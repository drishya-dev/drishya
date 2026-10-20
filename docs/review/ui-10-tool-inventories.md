# UI-10 — small and large tool inventories

20 October 2026 · PR #146. First UI-10 surfaces: Modern MCP server tools and available runtime tools. Other surfaces remain on TASKS.

| Before | After | Why |
|---|---|---|
|300-tool inventory expands its body to13040px in the actual-session layout | Body scrolls under a216px budget, additionally bounded by36dvh | Keep the disclosure reachable and the surrounding Toolbox bounded |
| Same unbounded behavior for MCP server tools | Both lists use shared `collectionBounds` policy | Consistent small/large behavior; one cap implementation |
| Long runtime list has no keyboard region target | Long body is a labelled, focusable scrolling region | Home/End/Page navigation without tabbing through every item |
| Small lists could acquire a fixed empty allocation under a blanket height rule | Natural height for up to6 items, subject only to viewport safety | Three items consume only their content's height |

## Policy

`collectionBounds(count, rows=6, rowHeight=36)` returns natural fit versus a row-budget cap. The cap is a maximum, never an item height or content limit. Wrapped names remain complete. CSS applies `min(cap,36dvh)` (short-list safety cap360px); overflow stays native and local. Every item remains rendered and reachable, including the300th. The parent disclosure/summary is outside the scroller. No wheel interception, scroll snapping or artificial spacer; ordinary scrolling can chain at the ends. Existing phone Tools entry, disclosure behavior and station ownership are retained. No new resident controls, animation, data inference or external library.

## Verification

- Before editing, inspected the running actual redacted Drishya Codex session with a clearly synthetic300-entry controller response; measured body13040px. After:216px, parent station585px. This verifies layout in real captured context, not genuine native runtime inventory delivery.
- Two browser journeys import synthetic captured Claude MCP calls/results:3 and300 distinct tools, plus matching controlled runtime inventories. Both list variants retain every entry; three fit without overflow;300 scroll within the cap, keyboard End reaches the last item and the heading remains reachable.
- Both fixtures checked at1440/390/320px. Narrow screens use the existing Tools drawer. Last entry is visible at the scroll end, list remains within viewport width, disclosure closes. Local screenshots inspected.
- Two helper tests cover natural/long bounds, a caller-provided budget and invalid dimensions. UI typecheck and production build pass. No hosted CI or native prompt execution.

## Limits and remaining UI-10 scope

This does not virtualize arbitrary million-item catalogs, certify physical phones, change agent-family nesting or fix every surface's density. It bounds these two supplied tool lists and preserves their content. The independent outer Toolbox scroll still handles many simultaneously expanded groups. Other count-dependent surfaces (prompt rail, file tree, changed files, search, ledger chips and long result cards) remain on TASKS, with their own3/300 acceptance required. No protocol changes or native inventory truth claims.
