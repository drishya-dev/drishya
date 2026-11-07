# CONTENT-17 — Markdown tables in agent prose

Behaviour only; FINISH-3 owns the eventual look. The document-only guard was why pipe tables in an agent reply read as a single paragraph. Prose now uses the same inline-content renderer inside semantic table headers and cells, with a local horizontal scroll region rather than page overflow. The dedicated CSS adds containment and uses existing neutral tokens. Clarity, palette definitions, shared control styling and motion are untouched.

The parser requires a matching header and delimiter row. Escaped pipes remain cell content, including inside inline code; malformed headers remain ordinary text and fenced code stays code. Short body rows are padded and excess cells follow the header's column count. Links to local captured work reuse the existing path callback; HTTP(S) table links require an explicit click and open with `noopener noreferrer`. Unsupported schemes remain text, never executable links or HTML.

Original table Markdown replaces the formatted table through the existing Original control. Its existing fenced-code Copy action copies the original source, not a serialization of the DOM. Document readers and an existing Original owner keep their own source control; a first regression run caught duplicate Original buttons there, which were removed without changing those tests.

## Acceptance on real native replies

Fresh genuine Claude Code and Codex responses were requested in a throwaway Git repository, using read-only native work and no tools or project edits. They each recorded three tables: narrow, wide, and a table containing inline code, a local file link, an HTTP(S) link and an escaped pipe. Only redacted copies were imported into a scratch Drishya home. Journal contents and screenshots remain private under `.local/`.

| Harness | Prefix | Bytes | Observations | Checks |
|---|---|---:|---:|---|
| Claude Code | `rec_69977fa0` | 225,393 | 13 | Three tables at 600/1440, all seven palettes |
| Codex | `rec_13949e17` | 187,447 | 15 | Three tables at 600/1440, all seven palettes |

All **28** harness × width × palette checks passed: inline code and both link forms present, wide content scrollable, no horizontal page overflow. The same genuine sessions on the independently built main baseline rendered **zero tables in all four width/harness journeys**. Plain text, source and cell content remain selectable. The controlled browser regression additionally verifies exact original copy, replacement rather than duplicate display, and return to the table.

`pnpm check:real -- markdown-tables` is added as a reusable read-only scanner/scratch importer. It found 49 Claude sessions (360 matching native message records) and six Codex sessions (12 matching native message records) under its default 90 MB ceiling. Selected existing imports contained 75 Claude and five Codex table-bearing prose entries; both verified. This is additional corpus evidence, separate from the complete fresh native acceptance matrix above.

## Validation

Focused Markdown units: **20 passed** across tables, lists, links and native citations. The first affected/browser run overlapped implementation and reported the duplicate Original controls and a wide-cell wrapping issue. After correcting source containment and respecting the existing Original owner, all **10** focused table/document browser journeys passed. No existing assertion was weakened.

Final `check:affected` passed both typechecks, 38 related units and 90 browser checks with 15 existing skips, configured three workers. The named prose-table browser spec passed 2/2 with `--workers=3 --retries=0`. The final-source isolated worktree has its own frozen install and rebuilt UI: both typechecks, build and package verification passed; **1,211 units passed, one skipped / 201 files** at three unit workers; **632 parallel + 33 serial browser checks passed, 28 existing skips, zero failures/retries**, with three parallel workers and the one-worker serial pass. Source snapshot: `3f6c6625` (isolated cherry-pick `55638256`); later changes document acceptance only.

No merge is authorized. No phone/touch work, backend schema changes, native journal writes or remote image loads were added.
