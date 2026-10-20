# UI-2 — Toolbox text

20 October 2026 · `codex/ui-2-toolbox-type` · PR #159. Bounded typography slice; other UI-2 surfaces remain open.

| Before | After | Why |
| --- | --- | --- |
| Tool counts were 10px | Counts are 11px | Read usage without enlarging primary tool rows |
| MCP labels, agent counts and active/idle states were 9px | Secondary metadata is 11px | Secondary information must still be legible |
| Server/agent disclosures and Clear focus used 10–11px text | These controls use 12px | Match the control floor without changing their ownership or behavior |

Verified the running actual redacted Drishya Codex Toolbox before editing: the counts and states above were measured at 9–10px. Afterward, both that session and actual Skeletongraph Claude have no measured Toolbox text below 11px. Local screenshots inspected. Legacy remains unchanged; no new palette colors, layout, inventory logic or animation.

The existing browser matrix now checks primary entry text at12px, metadata at11px, Agents disclosure text and Clear focus. Both 3- and 300-tool captures/runtime inventories pass across all seven palettes and 1440/390/320px layouts; the large list remains bounded, its last entry is keyboard-reachable and its disclosure stays outside the scrolling list. The existing palette contrast guard, UI typecheck and Vite build pass.

Local checks only; no native prompt, journal/configuration write, backend/schema/dependency or hosted CI. The human ten-minute, physical-device and remaining whole-product typography checks stay open. Claude owns review and squash-merge.
