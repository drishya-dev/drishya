# CONTENT-8 — cross-tool parity audit and acceptance handoff

27 October 2026, PR #257, stacked on CONTENT-6/PR #254. **CONTENT-8 remains open.** This increment adds a dedicated fixture and browser corpus, records actual-session inspection, and hands off genuine gaps. No production code, dimensions, hover/motion, capture, adapters, contracts or projections changed. Passing generic fallback assertions are not counted as first-class parity acceptance.

## Before / after

| Before | After | Why |
| --- | --- | --- |
| The content readers had separate family and transport tests without one CONTENT-8 corpus. | Twelve content/absence families and eight native/MCP property cases share a dedicated synthetic corpus; two harness-specific late-result journeys compare history and replay. | Check common reading properties while retaining each content-shaped presentation. |
| The image-focused actual samples had no delegation operations. | Two additional genuine, read-only native imports extend the private corpus with Codex and Claude delegation and questions. | Fixture delegation cannot establish genuine harness acceptance. |
| Generic questions or array output could be mistaken for completed parity. | Completed Codex question requests are explicitly marked a first-class view gap; literal array output is not called sealed orchestration. | Preserve the difference between readable fallback, verified structure and a dedicated view. |

## Common-property matrix

| Property | Checked evidence | Qualification |
| --- | --- | --- |
| Large input / short output | Native and MCP inputs with 95 literal fields; the short result retains a visible excerpt, raw arguments and exact copying; argument paging reaches field 30. | Synthetic. No accepted box allocation was retuned. |
| Short input / large output | Native and MCP 1,200-record results, bounded table DOM, late field retrieval, Original and exact copy. | Synthetic record dataset; actual large-record dataset parity is not inferred from comma-bearing output. |
| Late output / stable reader | Both synthetic native journal formats begin pending, append the same mixed result, retain an open source snapshot through later prose, and copy it exactly. | Real local ingest/SSE/UI path with synthetic journals; no native prompt or approval was sent. |
| Replay truth | Both late-result cases hide future data before the recorded result and expose identical original text after it. | Same reader path as history. Family fixture journeys also use replay. |
| Empty, error, truncated and missing | Native/MCP empty and error cases, explicit missing result, literal incomplete JSON, truthful wrapper acknowledgement and running-session receipt. | Synthetic boundaries. No missing output or success is manufactured. |
| Expandable / complete supplied raw access | Source and change paging, search remainder count, full plan detail, raw argument/result access, late table cells and exact clipboard content. | Complete supplied text/page, never an inferred whole file. Search's expanded view remains capped at 50 and declares the remainder; this corpus does not certify its full Inspector retrieval. |
| Control chrome / excerpt allocation | Large-input and large-output native/MCP previews retain a nonzero visible captured-text line after clipping by real ancestor viewports. Tiny empty output adds no data reader. | A visibility guard, not a claim of final visual polish or new target dimensions. |
| Semantic statuses | Captured failure is red/error; outer orchestration and process receipts say tool returned; missing exit stays missing; no-answer question stays unanswered; known plan states remain literal. | Unknown plan-state behavior is an existing CONTENT-4/PR #258 dependency. |
| Tabs, local scrolling and keyboard | Argument pages, bounded data scroll to the final record, source/change pagination, keyboard open/close and exact raw/copy operations. | Whole-product motion, assistive technology and physical acceptance remain separate tasks. |

## Content-family matrix

| Family | Fixture evidence | Genuine-source inspection / remaining dependency |
| --- | --- | --- |
| Read | 620-line captured range, bounded first page and Next lines. | Claude captured source readers inspected. The three Codex recordings have no typed read-kind operations; literal shell reads are not renamed into typed reads. |
| Edit | 160 hunks, bounded change paging and explicit unverified after-state. | Genuine edits inspected in all six recordings. No current file was loaded or changed. |
| Search | 123 recorded hits, 50 in expanded history and explicit 73-hit remainder. | Genuine Claude searches inspected. Typed Codex search absent in these imports. Full Inspector retrieval was not newly certified. |
| Tests | Captured failure, exact command and preserved literal runner output. | Genuine tests inspected in one Codex and two Claude recordings. No wrapper acknowledgement is called a test pass. |
| Plans | 80 captured items and known statuses in expanded reading. | No native plan tool calls appeared in the bounded standard-call scan described below. CONTENT-4 remains open; its unknown-state correction is PR #258. |
| Delegation | Captured task and explicit acknowledgement/missing child-result boundary. | Codex delegation inspected at both widths. Claude's genuine Agent call/result exists, but its card was not reached in the bounded journey; both widths remain unverified. Do not infer a product defect from this navigation miss. Child-thread/lifecycle acceptance is CONTENT-5b/NATIVE-3. |
| Questions | Offered options, captured question and explicit no-answer state. | Claude dedicated question views inspected. Two completed Codex question requests remain generic argument/result views at both widths: CONTENT-3 is a genuine first-class presentation dependency. No answer was submitted. |
| Process progress | Captured running-session metadata plus a missing final exit; outer tool return is not process success. | Native live transport checked with synthetic journals. A genuine live streaming/process-progress UI journey was not newly certified. |
| Unknown MCP | Mixed text/reference/structured siblings and the shared reading choices; native/MCP property symmetry. | MCP material inspected in five recordings; all original result shapes stay literal when not recognized. This does not certify unintegrated browser/image dedicated views. |
| Orchestration | Explicit fulfilled/rejected mixed wrapper fixture, retained rejected sibling and tool-returned status. | Codex imports contain 15/327/482 typed nested operations. The selected actual shell arrays contain no sealed fulfilled/rejected envelope; report their checks as literal-array fallback, not genuine settled orchestration acceptance. |

## Actual-source accounting

The private corpus contains four previously sanitized full-source recordings plus two new imports through the existing redaction path. Native journals were read-only, no shared store was mutated, and real content/screenshots remain ignored in `.local/`. Only prefixes, counts and sizes are recorded here.

| Prefix | Harness | Observations / operations | Completed inspection journeys at 1440 / 600 px |
| --- | --- | --- | --- |
| `7d8b3224` | Codex | 449 / 130 | 10: edit, tests, delegation, MCP and literal array output. Imported source 12,542,301 bytes. |
| `4b5ca5b1` | Codex | 1,530 / 542 | 8: edit, MCP, questions and literal array output. The two question inspections expose the dedicated-view gap. |
| `4d842553` | Codex | 2,284 / 757 | 8: edit, MCP, questions and literal array output. The two question inspections expose the dedicated-view gap. |
| `c8e5c9c8` | Claude Code | 10,466 / 2,215 | 14: source, edits, search, tests, MCP, questions and literal array output. |
| `cc002c1f` | Claude Code | 2,822 / 698 | 14: source, edits, search, tests, MCP, questions and literal array output. |
| `024517cd` | Claude Code | 2,112 / 426 | 10: source, edits, search, questions and literal array output. Imported source 6,292,879 bytes. Both delegation-width journeys remain unverified. |

There were **64 completed inspection journeys out of 66 scheduled**. Four completed Codex question inspections expose a parity gap; they are not first-class parity passes. Two Claude delegation journeys remained unverified after bounded scroll/navigation. The initial two Claude MCP/question expansion misses were resolved by keyboard-focused targeted rechecks; no production change was required. Completed runs reported zero external requests and zero browser page errors.

The source-discovery scan covered 54 local Claude JSONL files (857,230,617 bytes) and 24 local Codex files (731,822,943 bytes), parsing standard native tool-call records only. It found delegation candidates, but no native plan-tool calls. It did not treat plan names in captured code/prose as tool calls and does not claim those harnesses never record plans. Exact safe operation IDs and detailed count reports stay private for the owning agents.

## Open dependencies and verification

- CONTENT-3: the genuine Codex question views above need their own canonical native presentation/answer interpretation; generic fallback is not acceptance.
- CONTENT-1: the known 13 stored / 12 visible Claude prompt-image integration gap remains with its reducer/History owner. Reader-only image acceptance does not close it.
- CONTENT-2: browser/web dedicated presentation is PR #250 and its History hook is assigned to Claude. Generic MCP/web fallback does not certify that feature.
- CONTENT-4: native plan captures and unknown-state behavior remain separate from this known-state fixture; PR #258 records its helper correction.
- CONTENT-5b/NATIVE-3: genuine delegation lineage/child-return continuity and the unverified Claude card remain explicitly unclosed.

Own frozen dependencies were installed with `C:/Program Files/nodejs/corepack.cmd pnpm install --frozen-lockfile --offline`; root/UI/daemon dependency directories are local and workspace aliases target this checkout. The own production baseline build was inspected before adding the corpus. Twenty-two focused browser cases pass in supported desktop widths; no full browser gate was started. This is a scoped audit/test handoff for the combined CONTENT-6 baseline, not whole CONTENT-8 completion or a release claim. Root integration owns final restacking and TASKS/STATUS bookkeeping.
