# UI-10 — small and large collections

20 October 2026 · PR #169 · completes the surfaces remaining after [tool inventories](ui-10-tool-inventories.md) and [Agents](ui-10-agent-inventory.md).

Used the installed `emil-design-eng` skill. Inspected the running application with already-redacted copied Codex/Claude stores before changing presentation. Existing deliberate full-height Files, virtual history/rail, hover reading and ledger aggregation remain their own owners; a generic list component must not replace those algorithms.

| Before | After | Why |
| --- | --- | --- |
| Import page state can point beyond a smaller replacement collection | Shared `collectionPage` clamps the effective page and retains complete8-item paging | A saved large page must not make a short list appear empty |
| Changed-file lists use the broad reader height budget regardless of count | Natural short list; long list at most264px desktop /144px phone, further limited by viewport | Keep the selected patch visible and every file reachable |
| Rail keyboard focus uses a frame callback that can precede React’s virtual-row commit under load | Pending focus applied in a layout effect after the row exists, without another scroll | Home/End must reach the requested row reliably |
| Tools/Agents already use shared natural/capped collection bounds | Retained and reverified with3/300 items | Preserve hierarchy, full inventory and keyboard navigation |
| Tree, rail, hover material and ledger have specialized bounds | Retained; added end-to-end count/length extremes | Do not replace working virtualization or aggregate300 operations as300 chips |

## Per-surface policy

| Surface | Small state (fixture3) | Large state (fixture300) |
| --- | --- | --- |
| Hover output | Natural whole-material allocation; ≤48px unused band | Viewport-capped real material; local scrolling and explicit200-line stored pages reach the final line |
| Prompt rail | Natural48px rail | Virtual rows; full logical extent, bottom anchoring, Home/End and local scroll; no omitted prompts |
| Native/MCP runtime tools | Natural short collection | Six-row216px /36dvh local scroll budget; disclosure stays reachable |
| Recorded Agents | Natural hierarchy | Same216px /36dvh budget; family/filter behavior preserved |
| Files tree | Natural row heights inside the builder-requested resizable full-height Files panel | Virtual rows; Home/End reach every file without mounting the entire tree. The panel’s intentional unused reading area is not synthetic filler rows |
| Turn ledger | Only nonzero captured categories | Same bounded category set (at most10), larger numbers; wraps naturally. No chip per operation |
| Import neighbors | All3, no pager | Eight per page,38 pages; final4 remain reachable. Shared clamping covers300→3 |
| Current-Git changed files | Natural3 rows without a scroll band | Existing50-file server pages; six pages reach300 files. Each long resident page has the local budget above; refresh back to3 removes it |
| Recording search | Natural short results | Existing explicit50-hit API scope, scrollable results; refining the query reaches the final prompt. This work does not claim enumeration beyond that API contract |
| Library search | All3 hits in natural results | Existing50-result pages plus local scrolling; all six pages enumerate300 distinct prompt observations under an exact workspace filter |

`collectionBounds` remains the shared fit/scroll policy. `collectionPage` extends that policy for paging, validates dimensions and clamps an old page to the current count. Row height is a budget, never a fixed text height: wrapped names are scrollable rather than cropped. No new dependency or animation.

## Validation

- Six new browser journeys use isolated3/300 repositories and redacted synthetic journal fixtures: complete stored output pages, hover allocation, tree/rail virtual bounds, repeated Home/End, ledger counts, all import neighbors, all library pages, recording search refinement, current-Git pages/shrink, and desktop/390/320px menu/list containment.
- Current-Git DTOs alone are normalized for this presentation matrix; it is not native Git or consent acceptance. Two retained real isolated-Git control/handoff journeys pass separately.
- Two existing prompt-rail, two Tools/runtime inventory and two Agents journeys pass. Integrated browser set:14 passed. Full local unit suite:672 passed across122 files. Both TypeScript projects and production build pass.
- Actual copied stores: Drishya Codex41 prompts, Skeletongraph Codex48 and Skeletongraph Claude287. Home/End work at1440/390px; captured ledger metadata remains consistent with the full-history API. Current Drishya imports expose8 neighbors per page; current-Git reading remains bounded at1440/900/390/320px with no document overflow.
- Screenshots inspected locally: `ui10-navigation-*`, `ui10-imports-*`, `ui10-hover-*`, `ui10-git-*`, `ui10-real-rail-*`, `ui10-real-imports-*` and `ui5-diff-before-ui10/after-ui10-*`, under ignored `.local/`. Real content is not committed.

One old copied Codex recording refers to a removed native journal; segment lookup logged ENOENT while captured-history navigation passed. NATIVE-1 records graceful missing-source handling and continuation revalidation. This PR does not certify native continuation, physical devices, assistive technology or the human ten-minute test; REL-3 remains open.

Main #167/#168 integrated cleanly. No adapter/schema/backend/History.tsx changes by this PR; captured text, consent, Legacy composition, map and replay clock remain unchanged. UI-10’s stated local scope is complete; broader UI/component work remains in its own TASKS IDs.
