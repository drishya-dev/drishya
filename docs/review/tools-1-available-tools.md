# TOOLS-1: every available tool is listed, and a tool can be traced through its uses (30 October 2026)

Builder request (Yash, 30 October): the tool list shows all the tools present in the environment, not only the ones seen, and choosing a tool lets you go forward and backward through its uses instead of only dimming the rest. Real session content stays out of this file: ids are prefixes, everything else is counts and tool names.

## What the harnesses record (read-only, counts and shapes)

| Harness | Where the available tools are recorded | Local counts |
|---|---|---|
| Claude Code | `attachment` rows: `prompt_snapshot` (`tools[].name`, up to 51 names, sometimes empty), `deferred_tools_delta` (`addedNames`, `removedNames`, `readdedNames`, up to 128 names) | 122 journals scanned; 95 with a prompt snapshot that lists tools, 54 with a deferred-tool change; 111 contain a usable list |
| Codex | `response_item` rows of type `additional_tools`: tool groups (`functions`, MCP namespaces) with their tools, up to 6 names | 50 journals scanned; 26 sessions with such a row |

Claude Code records the list of tools the model was given, including every MCP tool, as it changes. **Codex records only the additional tool groups**, not its own native tools (for example the shell command tool), so for Codex the list is partial by the harness's own record; a tool that was used but never listed is shown as used and marked "used but not in the harness list" instead of being hidden. The same prompt-snapshot rows also carry the system prompt: it is never read; only the tool names are taken.

## What was built

- **Capture:** a new observation kind `tools.snapshot` (`ToolsSnapshotPayload`: source, tool names with an optional group, withdrawn names) from the Claude adapter (prompt snapshot, deferred-tool changes) and the Codex adapter (`additional_tools`; these rows were metadata-only "unknown" observations before). Names are bounded (120 characters, 400 per row) and anything that is not a name is dropped.
- **Projection:** `Projection.availableTools` (name, group, MCP server read from the name, the timeline step at which the tool was first listed and, if withdrawn, when). Absent when the harness recorded no list. Replay cuts it at the replay step (`asOfProjection`). Reducer r26.
- **`packages/scene/src/tools.ts` (pure):** `toolInventory` merges the listed tools with every tool the recording used (counts per tool; a tool used but not listed is added and marked) and `toolTrail` gives the number of uses, the reader's place among them, and the previous, next, first and last use. Endpoints `GET /v1/recordings/:id/tools` and `/tool-trail` compute them over the whole recording (and to the replay step), so a paged session counts every use; offline bundles compute them from the operations in hand.
- **Toolbox (Modern):** "Available tools · used of available" is shown by default beneath the instruments: native tools, then each MCP server, every tool with its use count; never-used tools are listed quietly with a dash and stay selectable ("Not used in this session"); a search field appears once the list is long; when a harness recorded no list it says "Tools used" and why. Choosing a tool opens a trail under the instruments: the tool's name, "3 of 12" (or "– of 12" when the reader is between uses), first, previous, next and last. The reader moves to that use and marks it; the existing dimming of everything else stays and is cleared with "Clear focus". Choosing a server or an instrument kind works the same way.
- **Fixed on the way:** the reading keys (J and K with a focus) and the new trail match an MCP tool filter by its own name, as the scene's filter does; the keys compared the full `mcp__server__tool` name that Claude Code records, so J and K found no use of a focused MCP tool.

## Real sessions

`check:real -- tools-available` (Claude Code: 111 sessions contain a list; Codex: 27). Three imported per harness; each prints the list, the used and unused counts, and walks the most used tool forward to its last use and back:

| Session | Listed (never used) | Used but not listed | Most used tool, walked forward and back |
|---|---|---|---|
| Claude rec_c8e5c9c8 (82.9 MB) | 72 (55) | 0 | 1,312 uses, all reached once, in order, both ways |
| Claude rec_cc002c1f (24 MB) | 173 (155) | 0 | 308 uses |
| Claude rec_45b046b2 (11.7 MB) | 168 (151) | 0 | 84 uses |
| Codex rec_6375533e (134.5 MB) | 5 (3) | 9 | 473 uses |
| Codex rec_58787f2c (28.4 MB) | 3 (1) | 6 | 85 uses |
| Codex rec_57aa1774 (0.2 MB, no operations) | 11 (11) | 0 | none |

In the running Toolbox on Claude rec_cc002c1f at 600 and 1440 px: "Available tools 18 of 173", 173 rows (155 never used), search shown, most used tool (308) walked "– of 308, 1 of 308, 2, 3, 308 of 308" with the reader moving on each step, no page overflow, no page error. On Codex rec_6375533e at 600 and 1440 px: 14 rows (3 never used), most used 473, the same walk. The toolbox keeps the person's last focus between opens (an existing behaviour), so a recording opened with a tool already focused starts on its trail.

## Acceptance

- Every recorded available tool is listed (units; the real sessions above): yes for Claude Code; for Codex the harness's record is partial and the screen says which tools were used without being listed.
- A tool with several uses is walked first to last and back with mouse and keyboard, count equal to the recorded uses: the browser spec on a synthetic session (3 uses of one tool among 5 calls) at 600 and 1440 px, and the real-session walks above. The keyboard route is the existing J and K reading keys with the focus on, plus Tab to the trail buttons.
- An unused tool is selectable and says so; no focus is applied (spec).
- A harness with no recorded list says so (spec, "Tools used" and the note).
- Replay never reveals a tool listed after the replay position, nor a use that the position has not reached (units on the replay cut, and the endpoints with a replay step in the browser spec).
- Units: 7 (inventory and trail), 2 (capture and projection, including that the system prompt in the same row is not stored), 2 (batch input).

## Limits and not verified

- Claude Code's list is the tools the harness gave the model at each snapshot; the deferred-tool changes are applied additively with withdrawals. A tool list that changes mid-session is covered by units and the replay cut, not driven through a live session in a browser.
- Existing recordings show the list only after a rescan (Claude Code) or a fresh import (Codex, whose rows were stored as unknown observations earlier); older projections rebuild on open without reimport but have nothing to read until then.
- The toolbox at half width (600 px) opens from the Tools button as before; making it shown by default there is a UI-8 decision. The Agents and MCP server sections of the toolbox still start collapsed (UI-17).
- Codex lists tool groups only; the Codex shell and edit tools are never in the harness's list.
- The new list duplicates the instruments and MCP sections of the toolbox; reorganising the toolbox is for the UI pass (ledger).
