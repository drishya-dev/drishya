# CONTENT-6 — shared adaptive content selector

27 October 2026. PR #254 is stacked on CONTENT-7 PR #253. The selector consumes its lossless parsing, document/resource readers and snapshot-context APIs. This report covers the complete CONTENT-6 scope; the shared document implementation and its genuine artifact evidence are recorded in [CONTENT-7](content-7-document-finish.md).

## Result and design review

| Before | After | Why |
| --- | --- | --- |
| Whole-result JSON/CSV/resource hints, with no structured-field or MIME-qualified JSON source choice | Sealed MIME, content/resource text, structured fields, native output and fulfilled/result wrappers share one bounded selector | Tool names and exact command strings do not determine the reader |
| Generic outer envelope was the only data source | Structured fields are preferred, then explicit JSON MIME blocks, then whole-result syntax hints; the exact whole result remains a source choice | Recorded metadata is stronger evidence than an outer JSON wrapper |
| Inline result/argument numbers used ordinary parse/String rendering | Lossless captured-number tokens preserve large IDs, negative zero, decimal/exponent spelling and over/underflow | The inline preview must agree with the existing exact data reader |
| A formatted structured field could look like an original JSON capture | Visible modal context identifies the field and derived JSON formatting; controls say Formatted field / Copy formatted field | Captured values and original serialized bytes are different claims |
| Four reading modes, a source selector and decoded-envelope chrome could consume the whole compact result area | Compact mode controls, a source disclosure, and a decoded/raw toggle after the material preserve a literal excerpt | Captured content remains the main surface |
| Raw Markdown had no explicit document handoff | Substantive multiline material has an explicit Choose reading format disclosure | Reading as Markdown is a user choice, never automatic content invention |
| Stored code pages had no shared views; output pages lost their range context | Already loaded captured pages share the selector and retain page/range/partial context inside every nested reader | A 200-line page must never masquerade as an entire historical artifact |

No new motion, dependency, capture, schema, native execution, current-file fetch or remote material load was introduced. Design skill: `emil-design-eng`.

## Complete criterion matrix

| CONTENT-6 criterion | Implementation and verification | Qualification |
| --- | --- | --- |
| MIME/content blocks/structured fields/artifact evidence first | Optional supplied MIME; sealed text/resource blocks; structuredContent/structured_content; actual loaded captured artifact provenance and page bounds | Explicit MIME and structured-field edge cases are synthetic; see actual source limits below |
| Native, MCP and wrapped tools share readers | ToolInput, ToolOutput, StructuredResult and TerminalPreview use CapturedResultViews; ArtifactReader connects captured historical code/output pages | Shared retained Legacy implementation also powers Modern; no History/Inspector changes |
| Mixed siblings survive | Source selection never rewrites the supplied result; unknown, binary and reference siblings remain in exact whole-result/raw access | Binary/resource bodies are not regenerated or decoded by this selector |
| Exact raw access | Whole captured result, existing raw envelope/source controls, document/resource Original result, lossless numeric values | Structured-field serialization is explicitly derived formatting, with accurate copy labels |
| Limits | 256 KiB UTF-8 input; bounded 64 siblings, 1,024 visits, 8 nested levels; whole result plus 8 JSON candidates and 8 delimited candidates; existing reader limits retained | Bounded-out choices explain their limits; original supplied preview remains available |
| Unavailable/empty/partial | Explicit supplied unavailable/partial state; typed empty text retained; artifact missing/derived/generated paths do not acquire captured reading modes | No request attempts to recover missing bytes from current disk or a URL |
| Live | Synthetic real-daemon tool-result arrival updates the same choices; an open snapshot survives another captured append | No native agent was prompted for this check |
| Replay | Before-result seek exposes no future reader; end seek restores choices; reading modal does not control capture or replay state | Explicit sequence replay tested in Modern |
| Legacy-backed Modern | All new browser journeys use Modern's shared retained readers | Independent retired surfaces and phone widths were not tested |
| No command-only dispatch / regex fabrication / regeneration | Sealed fields, MIME and provenance determine choices; syntax hints only offer explicit inspection; no command matching, inferred media path or execution | CSV syntax hints remain format suggestions, not a claim of a schema-defined dataset |

## Checks

Final stacked source: UI types and build pass. Focused selector/resource/structured-data units: **39 passed** (10 selector, 13 resource/document, 16 structured-data). Final focused browser run: **17 passed together**: six selector, eight document/artifact and three retained folded-output JSON checks. The new browser cases use supported desktop sizes (1440 and 600 px, with ordinary default desktop windows for non-width cases).

The mixed native/MCP/wrapped cases check exact whole result, exact text-block JSON, lossless structured fields, explicit derived-format modal labels, CSV original, document original, unavailable PDF reference, no remote request, and literal captured text intersecting the compact card's clipping allocation before and after reader detours. The visible-excerpt guard initially failed when control chrome consumed that allocation; it now passes for all three shapes. Synthetic frames were inspected locally.

Historical artifact cases cover captured/derived/generated/unavailable code pages, captured/derived output pages, exact 200-line handoff, later-page context, binary-reference/raw behavior and nested reader dismissal. Captured historical pages alone receive these modes; derived/generated output stays literal and retains its existing page provenance.

## Actual source checks (private)

Used an isolated private copy of an already redacted store; package aliases resolve this worktree, not Desktop's unmerged source. No real journal text, path or screenshot is included here. No current source was executed to regenerate a result.

| Session prefix | Harness | Supplied result operations / UTF-8 bytes surveyed | Candidates by operation |
| --- | --- | --- | --- |
| `rec_4d842553` | Codex | 425 / 441,215 | 67 JSON; 17 nested JSON; 145 delimited hints; 9 resource; 20 document; 0 structured-field; 0 selector-limit |
| `rec_061e5f2d` | Claude Code | 60 / 61,311 | 14 JSON; 0 nested JSON; 28 delimited hints; 0 resource; 0 document; 0 structured-field; 0 selector-limit |

Final built app: **14 actual reader/width checks passed** at 1440 and 600 px. Codex cases: JSON (820 bytes), nested JSON/document (403 bytes), delimited text (523 bytes), resource reference (790 bytes), and document original (403 bytes). Claude cases: JSON (393 bytes) and delimited text (367 bytes). Each checked exact source text against the selected stored value; every case had zero remote requests and zero page errors. Screenshots remain private in `.local/`.

The sampled Claude result previews do not contain sealed resource/document/nested JSON blocks. Neither sampled session contains structuredContent fields or the numeric edge cases. Their UI behavior is fixture-qualified, not claimed as observed in real sessions. Delimited hints above include comma-bearing captured output, not a claim that every candidate is a dataset. CONTENT-7 separately records genuine captured CSV/Markdown artifact acceptance across additional actual sessions.

Human freeze/truth/ten-minute judgment, physical lower-resource/platform acceptance and native account journeys remain the repository's release gates; this change does not claim those gates or unmeasured workload readiness.
