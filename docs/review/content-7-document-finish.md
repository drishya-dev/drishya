# CONTENT-7 — structured data and document reading finish

27 October 2026. PR #253 supplies reader APIs; PR #254 supplies the shared selector and historical artifact consumer. Whole-task acceptance applies to their combined candidate. Reader APIs alone do not claim visible document choices. No current-file/Workspace/History/adapter/schema changes are part of PR #253.

| Before | After | Why |
| --- | --- | --- |
| Resource reading required leaving its window to recover mixed or bounded-out result fields. | Original result and exact original copying remain inside the resource snapshot. | A selected reference is not the whole result. |
| Captured text blocks had JSON/CSV choices but no independent document handoff. | Source and explicit Markdown reading retain exact text, field provenance, whole original result and nested data choices. | Reading format is a deliberate choice; formatting is not new capture evidence. |
| Resource bodies with binary bytes looked like references with absent text. | Binary presence and reported byte size are explicit; exact original still contains the supplied binary field. | A binary body, a text body and a reference-only entry are different evidence. No PDF or office-file decoder is implied. |
| Shared document tables inherited unspaced browser defaults. | Neutral hairlines, cell padding and document typography make the captured rows readable. | Formatting should support the material. |
| Page context could disappear when opening a nested reader. | All four reader APIs snapshot an optional context note and retain it through document/resource → JSON/CSV handoffs. | A 200-line historical page must not appear to be a whole file. |

## Whole criterion matrix

| CONTENT-7 criterion | Result and evidence |
| --- | --- |
| Safe result/resource-link cards | Existing explicit result URL and MCP resource views retained; sealed native `result` wrappers added. Links are HTTP(S)-only explicit current navigation, never automatically loaded. Unsafe/local/protocol references remain literal. Existing native/MCP resource journeys and real Codex references checked. |
| Markdown/document handoff | New sealed text/resource document selection plus the shared selector's explicit raw-format choice. Literal Source, safe Markdown, exact copying, original mixed result and nested JSON/CSV reading checked. HTML, images and links in Markdown do not execute/load. |
| Historical artifact handoff | PR #254 joins only an already-loaded captured page to shared readers, with line range/partial qualification and no extra fetch or extension-based MIME inference. Source APIs carry that qualification into dialogs. Captured paged Markdown checked on two actual Claude recordings and fixtures. |
| Derived/generated/unknown material | Captured-labelled reading choices require captured provenance. Derived CSV after-state remains derived; generated/unknown sources retain literal access. Captured/derived/generated/unavailable fixture states checked on the combined consumer. |
| Complete raw access | Resource/document windows retain the exact supplied original result, including mixed siblings and bounded-out references. Historical inspection covers the loaded page; existing source paging retains other pages. No full-file claim is made for a page or preview. |
| Explicit current versus captured | Historical text is never repaired using today's path or URL. Resource URL opening is labelled current. Captured page context states that no current file was loaded. |
| Extend existing readers | JSON numeric fidelity, tree/table navigation and strict CSV/TSV parsing remain shared. Only a lossless parse/record helper was exposed for the selector; their parsing/navigation algorithms were not replaced. |
| Charts from selected numeric evidence only | No chart was introduced or inferred. Literal JSON/CSV evidence remains inspectable; missing datasets are not replaced with invented series. |
| Bounds and unavailable states | 256 KiB supplied JSON envelope; at most 8 document fields, 64 resources/siblings, 8 nested levels, 1,024 traversal visits. Markdown formatting permits 5,000 lines; complete supplied Source remains available beyond that. Missing text, binary references, malformed envelopes and original access remain explicit. |

## Actual-source evidence

Private copies of four previously sanitized full-source imports were used. Native journals were read-only; no shared store was mutated. Only prefixes, sizes and counts are recorded here. Real screenshots and diagnostic scripts remain ignored in `.local/`.

| Prefix | Harness | Observations / operations | Checked desktop journeys at 1440 and 600 px |
| --- | --- | --- | --- |
| `4b5ca5b1` | Codex | 1,530 / 542 | Two document and two JSON journeys from a 1,232-byte supplied result; two resource journeys. Recording contains 28 selected text fields and 19 references. |
| `4d842553` | Codex | 2,284 / 757 | Two document and two JSON journeys from a 1,231-byte supplied result; two resource journeys. Recording contains 20 selected text fields and 28 references. |
| `c8e5c9c8` | Claude Code | 10,466 / 2,215 | Two explicit raw-text document and two JSON journeys. Four historical Markdown page journeys: a captured 27,712-byte, 570-line artifact, first and next 200-line pages at both widths. |
| `cc002c1f` | Claude Code | 2,822 / 698 | Two explicit raw-text document and two JSON journeys. Four historical Markdown page journeys: a captured 49,228-byte, 858-line artifact, first and next 200-line pages at both widths. |

All completed actual journeys reported zero external requests and zero browser page errors. An initial combined-run Claude timeout was followed by an isolated two-Claude check that passed. Artifact diagnostics corrected private-script Unicode locator encoding and explicitly returned a retained page to its first page; neither required a product change.

Source qualifications matter: the two Codex imports have no `read`-kind Markdown operations; their Markdown-path artifacts are patches/after-states, so they are not claimed as captured code-page Markdown acceptance. Their captured output-document/resource journeys are actual acceptance. The two Claude imports have no typed resource/resource-link or MIME-labelled document blocks. A read-only scan parsed tool-result content in all 48 local Claude JSONL files (855,828,413 bytes) and found no such typed blocks; this is not a claim that Claude never records them or that Markdown text is absent.

No genuine captured CSV dataset body or JSON record-table dataset was present in these samples. The available CSV after-state is 41 bytes, five records and three columns, explicitly reconstructed by `codex-literal-patch-v1`; its 14,323-byte captured patch is not a CSV body. Literal dataset, edge-number, table and CSV acceptance therefore remains fixture-based rather than being misrepresented as a genuine captured dataset. Binary resources and unavailable/generated artifact cases are also synthetic acceptance; no current file was loaded to manufacture historical bytes.

## Verification and integration

- Running baseline: own production build, two existing native/MCP resource journeys, and visual inspection of the synthetic desktop resource window before edits.
- 39 focused resource/JSON/delimited units; UI TypeScript and production build pass.
- Combined consumer verification: six new document/artifact browser journeys plus two existing resource and eight existing structured-data journeys. New document checks use supported desktop widths only. The consumer-dependent browser specification is handed to PR #254 so PR #253 remains independently typecheckable.
- Existing exact JSON/CSV/number/tree repairs were preserved. No runtime dependency, new capture, schema change, current-file fetch, remote automatic load or chart generation was added.

Root integration performs whole-repository checks and task/claim bookkeeping. This report does not substitute fixture acceptance for unavailable genuine source cases or claim platform/physical release acceptance.
