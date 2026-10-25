# CONTENT-7 — existing resource reader boundary acceptance

25 October 2026, PR #225. Acceptance coverage only: no production source, UI, schema, dependency, native protocol or capture behavior changed. The broader CONTENT-7 item remains open; this report is not a second work list.

| Existing behavior checked | Accepted behavior | Why |
| --- | --- | --- |
| Empty and repeated resource entries | Empty captured text remains a real empty body; an absent body is explicitly absent. Repeated URIs retain their distinct captured fields and exact bodies. | A URI alone does not establish interchangeable content or a captured file. |
| Bounded JSON/resource inspection | Incomplete JSON is not salvaged as fabricated content. Exact UTF-8 byte and traversal limits retain only whole references and disclose limits. | Preserve provenance and bounded reading without silently claiming full artifact coverage. |
| Native and MCP resource windows | Exact copy, keyboard/filter/focus recovery and unselected/bounded-out siblings in original output remain available. | Inspection is a reading choice, not a destructive transform of recorded output. |

## Local evidence

- Nine resource units: five existing cases and four added guards for empty/absent/repeated identity, incomplete JSON, exact 256 KiB UTF-8 boundary and traversal cutoff. No production defect was reproduced in these cases.
- Four browser journeys: retained native/MCP mixed-resource document/JSON/unsafe-link checks plus two new phone boundary checks. The parser visits at most 64 content entries; two non-resource siblings therefore leave 62 whole resources in the synthetic bounded list, correctly marked limited. The original output still contains the final references. No assertion or limit was weakened.
- Actual available Codex recording: nine resource-bearing operations and 28 reference entries, none carrying captured text. The selected seven-reference operation was checked at 1440/390/320 px: exact URI fields and current-link targets, explicit absent-body message, no automatic external requests, no dialog overflow/page errors and Escape focus return. The 390 px frame was inspected. Real source and screenshots remain local.
- The available Drishya Claude recording has no resource-bearing outputs. Synthetic native/MCP mixed bodies establish transport-independent reader behavior; this is not claimed as genuine Claude captured-text acceptance. No current files or URLs were loaded to fill absent historical bodies.
- 799 whole unit tests, both TypeScript projects and production UI build pass. Local browser checks only; no hosted CI or signed-in native turn.

The first boundary test used Escape while focus remained in a native search input. That key first clears the search field in Chromium; the final test deliberately focuses the resource panel before testing dialog cancellation. No product handler was changed to bypass normal search behavior.

## Remaining boundaries

Full captured-document/media transport, sources not present in the sample and broader structured view parity remain under CONTENT-7/CONTENT-6/CONTENT-8 in TASKS. The separate TEST-2 reading-position defect remains open and History/PERF-2 stays paused by the builder. This PR is ready for focused review, not automatic merge through that failure or a whole-product release claim.
