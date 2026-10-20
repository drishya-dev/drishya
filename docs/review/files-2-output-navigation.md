# FILES-2 — captured output and search navigation

20 October 2026 · PR #167 · completes the remaining scope after [#157's prose/card work](files-2-prose-links.md).

Applied the installed `emil-design-eng` skill: keep output readable and selectable; put navigation on the existing reference rather than adding a resident toolbar. No new animation, dependency, disk lookup or inferred causal relationship.

| Before | After | Why |
| --- | --- | --- |
| Stack traces, TypeScript diagnostic locations, Python traceback paths, pytest and runner file rows are inert text | Bounded dotted-underlined references open captured file evidence | Act on what the agent saw without leaving its output |
| Captured test-result excerpt is a plain preformatted block | Uses the shared output renderer and its exact same diagnostic links | Case inspection and raw output share one rule |
| Inspector search opens a file but loses the match and line | Exact operation/search index and line select that captured excerpt | Avoid silently reading unrelated captured material |
| Inspector Read and failure paths have inconsistent pointer-only/plain presentation | Keyboard-reachable captured-file controls | Same navigation semantics as History |
| Search has an observation jump and inert path metadata | Keep the observation jump; add an explicit captured-file target for typed paths | These are different destinations, not a reason to change existing search behavior |
| Indexed-file opening uses a graph ID | Uses the canonical path | Node IDs need not be file paths |
| Cross-session diagnostic snippets only jump to the observation | Optional file target first opens the owning recording, then captured evidence | Never resolve another recording's path against the current session |

## Truth and bounds

Only diagnostic syntax is recognized in free output: file:line[:column], TypeScript file(line,column), Python `File "path", line N`, pytest file identifiers and explicit runner file rows. Commands, arbitrary source strings and general English are not treated as location evidence. Existing typed search/failure metadata remains typed. This does not assert that the emitting command read or modified that file.

The pure helper reuses the existing lexical workspace containment rules: Windows/POSIX absolute roots, relative paths and source lines; no filesystem probing. URLs, outside-workspace absolute paths, traversal, partial tokens and ellipsis-truncated references stay text. Unknown captured files open the existing honest empty state, with current reading remaining a separate consented action.

Output enhancement scans up to128KiB per displayed Output and4096 characters per line, at most8 links per line/64 per Output. Additional text remains fully displayed and selectable. Decoded pages get their own budget. Stored/copy/search bytes are unchanged; no base64, source code or command input is rewritten. Library links use only diagnostic references actually present in its bounded snippet; omitted paths are not reconstructed from truncated search text.

## Verification

-17 focused unit cases: Windows/POSIX roots, TypeScript/Playwright/Vitest/pytest/Python syntax, source lines, spaces in quoted traceback paths, URL/traversal/outside/command literals, truncated names and work caps.
- Three new browser journeys: exact output text (diagnostics after70 ordinary lines), missing captured evidence, no current-file requests, keyboard opening, captured-case excerpt links, exact Inspector search selection, cross-session library ownership, recording-search file destination and1440/390/320px containment.
- Two retained library-search journeys and one retained prose/read/edit/write/search journey pass. Both TypeScript projects and production build pass. Full local suite passed665 tests before the final two additional parser edge cases; all17 parser cases pass after them.
- Running app inspected before/after against isolated copies of already-redacted actual Drishya Codex and Skeletongraph Claude sessions. Actual expanded output exposed4 and1 diagnostic links respectively; keyboard activation opens the captured reader in each. Desktop/390/320px checks show no document overflow. Private screenshots `files2-output-<recording>-before/after-*` stay under ignored `.local/`; no real content committed.

No adapter/schema/native/harness writes or hosted CI. FILES-2 is complete within these explicit presentation bounds. DATA-1 enrichment and physical/human accessibility acceptance remain separate checklist items. PR #165's reader chrome is deliberately not included; merge either order and retain both completion handoffs.
