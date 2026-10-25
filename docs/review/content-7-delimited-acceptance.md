# CONTENT-7 — literal delimited-reader acceptance

25 October 2026, PR #231. Acceptance of the existing explicit CSV/TSV reader; no production change or new feature. Broader CONTENT-7 document/structured scope remains open.

| Before | After | Why |
| --- | --- | --- |
| Existing tests covered common quoted cells and large-grid navigation. | Additional guards cover terminal line endings, quoted empty records, exact byte/cell boundaries and literal Unicode/numeric/formula-like values. | A literal reader must preserve values and distinguish absent from empty. |
| Empty/missing selection and duplicate-header/block/filter state combinations lacked joined coverage. | Browser checks carry exact copying through those states and explicit CSV/TSV choices at desktop/phone widths. | Reader controls must not coerce data or retain a selection from another captured block. |
| Over-column behavior had unit coverage only. | Browser verifies no partial grid and exact Original fallback. | A bounded inspection must never imply that omitted columns were absent in the capture. |

## Checks

- Ten delimited units pass (three added). Exact 256 KiB and 50,000-cell boundaries; an extra byte/field refuses inspection without a partial model. CR/LF/CRLF endings, empty/missing cells, BOM, duplicate headers, Unicode, leading zeroes, exponents, negative zero, formula-like text, escaped quotes and multiline cells stay literal. These are acceptance guards, not claimed preexisting failures.
- Five browser checks pass: two new empty/missing/header/filter/block/format/copy/limit journeys and existing native/MCP large-grid plus malformed-text journeys. Quoted CRLF/tab bytes and BOM survive clipboard copying exactly. A 32-column limit retains Original; no partial grid. DOM stays bounded; Ctrl+End, focus return and 1440/390/320 containment covered. New 320 px frame inspected.
- Four actual journeys pass using existing local Codex and Claude stores at 1440/390 px. Explicit CSV inspection of supplied comma-bearing captured text has 42 and 33 records respectively; exact Copy original, last-record keyboard navigation, missing-cell semantics, containment and focus return pass with no page errors. Claude phone frame inspected. No source content/screenshots committed; no native turn or project/journal writes.
- The actual samples are comma-bearing tool text, **not asserted to be schema-defined CSV datasets**. Parsing is deliberately selected by the reader; no automatic delimiter/type inference or claim about source meaning. A preview/full-artifact comparison was rejected as mismatched diagnostic input; final checks choose matching supplied previews without linked artifacts. Genuine dataset-producing source acceptance remains open.
- **847 whole units / 151 files**, both TypeScript projects and production UI build pass on main #230 plus the CONTENT-7 test claim. PR #229 recovery changes are independent and not yet part of this branch. Local checks only, no hosted CI.

No production source, CSS, animation, capture/contracts/projection, persistence, native controls or paused History/PERF-2 change. Installed emil-design-eng guidance informs containment/readability review; no motion changed. Physical/platform/human acceptance remains REL-2/REL-3. Parent CONTENT-7 is not closed by these bounded checks.

## Combined review handoff

PR #229 plus this branch were temporarily combined without publishing or merging either PR into main: **855 whole units, seven focused browser checks, both TypeScript projects and build pass**. No production/test conflict; only STATUS has a documentation conflict because both PRs replace the latest Codex handoff and release their own claim. Keep both completion reports/handoff evidence, remove both completed own claims, and preserve DATA-3 and paused PERF-2 rows. TASKS additions merge automatically. The temporary verification merge was aborted after checking; branches remain independent and require builder review. #229 was updated against main's newer CONTENT-7 claim before this probe.
