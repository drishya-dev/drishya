# UI-10 — bounded recorded-agent families

20 October 2026 · `codex/ui-10-agent-inventory` · PR #160. Reuses the existing `ToolCollection` / `collectionBounds` owner; no new visible panel or controls.

| Before | After | Why |
| --- | --- | --- |
| Agents rendered in an unbounded disclosure body | Agents use the same bounded local list as MCP/runtime tools | A large family must not consume the Toolbox |
| Seven real recorded agents occupied roughly399px with no local maximum | More than six agents get a216px budget, limited further to36dvh | Preserve access to other instruments and the disclosure itself |
| Agent nesting/filtering was already useful | The same family tree and filter buttons remain inside the list | Containment must not replace or flatten captured relationships |

## Acceptance

- Running real redacted Drishya Codex baseline inspected before changing UI: seven agents, no local max height. Afterward its seven agents remain present in a216px local scroller; keyboard End reaches the last agent while the Agents summary remains in view. Final frame inspected locally.
- Synthetic normalized observation fixtures cover3 agents and300 agents with explicit parent/child references. Short names in the three-agent fixture fit naturally; the300-agent fixture includes long names. All switches remain present, family disclosure works, filter/clear retains the chosen identity, and keyboard End reaches the last row.
- Both fixtures pass at1440/390/320px and320×568. The large list has no more than216px client height, is actually scrollable, keeps the summary reachable and produces no horizontal page overflow. As with other bounded lists, unusually tall labels may need local scrolling even below the count threshold.
- Existing3/300 MCP/runtime tests also pass (four browser journeys together). UI typecheck and Vite build pass. Native lineage compatibility is not inferred from normalized fixtures; DATA-1/DATA-3 and native multi-agent acceptance remain their own gates.

No schema/adapter/backend/lineage or inventory policy changes, no new dependency, native prompt, journal/configuration writes or hosted CI. This is local scrolling, not agent-row virtualization. Other UI-10 surfaces remain open. Modern Toolbox typography is independently ready in PR159; this increment does not modify its files. Claude owns review and squash-merge.
