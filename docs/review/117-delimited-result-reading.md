# 117 — Explicit delimited-text reading

18 October2026. Installed Emil design engineering and animation guidance applied. TASKS remains the only active queue. This is the CSV/TSV portion of adaptive content, not media capture or the full content selector.

| Before | After | Why |
| --- | --- | --- |
| Captured CSV/TSV remains a wall of text | Explicit CSV/TSV choice opens a bounded virtual grid | Read rows/cells without guessing a schema or delimiter |
| Wrapped native/MCP text is hard to reuse | Recognized literal output/content fields feed the same reader; original siblings stay intact | Adapt to captured evidence rather than exact tool names |
| Long or missing values lose context in a compact row | Exact cell reader/copy and supplied record position; absent cells distinguished from empty strings | Preserve the evidence while keeping the table scan-friendly |
| A filtered single row leaves a large empty viewport | Viewport follows visible row count up to the shared height cap | Spend space on selected content, not blank allocation |
| Assumed headers/types can distort data | First-record names require a checkbox; all values stay literal text | Duplicate names, formulas and uneven records remain truthful |

## Bounds and behavior

256 KiB of supplied text,5000records,32columns,50000cells and8suggested text fields. Parsing is on explicit delimiter selection. Quoted commas/tabs, escaped quotes and exact multiline cell strings are preserved. Invalid/unclosed quoting and capacity overruns show no partial grid; original field text remains available. Header names and record indices are presentation choices, not captured database schema or source line numbers. Search visits all parsed records, not just mounted rows. Numeric values/formulas are never evaluated; no chart or inferred units.

Only known literal fields are selected from complete captured envelopes. Generic JSON retains its tree/original owner; a selected text string can invoke the same delimited reader. Unknown/MCP resource siblings remain in the parent result. No remote URL request, screenshot regeneration, native turn, image/artifact seam, project write, telemetry, new dependency or navigation-body persistence. The open reader snapshots candidates so ordinary parent text updates do not replace its selected strings. Owner/session removal still closes it.

## Local verification

- Seven parser/field-selector tests cover multiline/escaped quoting, duplicate and empty names, missing cells, BOM, delimiter choice, malformed/incomplete values, byte/row/column/cell caps, literal formulas, mixed MCP siblings, native wrapped fields and suggestion bounds.
- Both TypeScript projects and production build pass;534unit tests in96files pass.
- Five browser journeys pass: existing JSON/reading-window interaction regressions plus MCP/native-shell1200-record cases and malformed input. Explicit initial Original, optional names, bounded DOM, full search, Ctrl+End/horizontal cell navigation, missing-cell copy disable, exact multiline/formula/original copy, multiple text fields, no remote loading, Escape/focus return and320/390px containment verified. Grid/selection desktop and phone frames inspected locally.
- Three actual redacted Drishya/Skeletongraph Codex/Claude long-history upward-scroll and multi-file editor journeys pass. These establish integration regression, not a claim that every real session contains CSV. Private frames stay under `.local`. Hosted CI was not run.

## Motion verdict

**Approve this bounded implementation.** Frequent format/search/cell navigation is immediate; the pointer-requested reading dialog uses the existing200ms arrival/140ms exit with keyboard/reduced-motion bypass. Table text is mounted whole and selectable, with no cell/count typing or animated virtual-row dimensions. Existing capture, replay clock, hover and graph choreography are unchanged. Broad native/device/all-theme/human acceptance remains open.
