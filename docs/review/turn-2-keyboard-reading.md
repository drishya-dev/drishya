# TURN-2 — keyboard reading without an inspector

20 October 2026 · PR #141 · `codex/turn-2-keyboard-reading`

**READY FOR CLAUDE REVIEW / MERGE** — final local checks passed. Claim and dependency/retest index were pushed on main before implementation. One TASKS ID; 15 files, four branch commits including integration of reviewed main. Claude owns squash merge.

## Baseline and design

Verified in running Skeletongraph Claude: `j` focused no card and `?` opened no guide. Applied installed `emil-design-eng` and `animate`: keyboard use is frequent, so there is no added travel, zoom, flash or animated focus ring. Existing pointer-open modal motion remains; opening the guide by keyboard is immediate even with relationship motion enabled.

| Before | After | Why |
| --- | --- | --- |
| No operation-reading keys | j/k moves real card focus, without opening Inspector | Read the captured work without replacing the scene |
| Only resident operations available to the browser | Compact worker cursor across the entire recording | First/last and next edit/failure work across unloaded pages |
| No shortcut reference | One shared `?` guide and Settings → Keyboard entry, also available from Home | Discoverable without another resident toolbar button |
| Finished turns fold individually | c folds other finished turns; C unfolds all | Scan a long session while retaining the focused turn and anchor |
| Generic global keys can conflict with editing | Input/CodeMirror/menu/reader guards and queued navigation cancellation | Typed characters and local controls retain their normal meaning |

## Keys and truth boundaries

Modern history: j next operation, k previous; n/p next/previous edit or write; f next captured failure; t/T next/previous user turn; g/G first/last matching operation; e expand/collapse; o existing file peek; y selection or the existing material copy control, otherwise the visible card preview; c/C bulk folding/unfolding; ? guide; Escape clears keyboard focus when no reader/menu owns Escape.

Peek follows existing workspace consent. No current file is read merely because an operation has a path. Missing paths/material produce a quiet status rather than a guessed file. Copy does not claim that a bounded preview is the full stored result. Navigation honors existing agent/tool/server/kind filters. Turns retain captured timeline identity for subsequent cursor queries, while rendering positions remain timeline offsets, not observation sequence numbers. Absolute edges do not wrap. An unsupported cursor fails explicitly instead of silently counting a page as the whole session.

The UI batches at most20 queued reading steps and limits key-repeat backlog. Opening help, typing or changing pointer context invalidates stale work. New history loading uses the existing paged API; focus and its virtual-list pin have a single real DOM home. Reading detaches Follow; capture continues. Replay keeps its explicit transport keys and clock, including while the shortcut guide is open.

## Integration and validation

Integrated main through `4d22126` (FILES-1 #139, Git #140). Resolved overlapping adjacent imports/service methods/routes/tests by retaining both APIs and both test cases. No capture/event-schema, adapter, projection, Git, Usage or FolderExplorer changes in this PR. ProductShell owns guide visibility so it also works on Home; History owns keyboard focus and existing anchor/fold state.

- Full suite **624 unit tests / 114 files passed**. Both TypeScript projects and production build passed. Final focused cursor/API checks **45/45 passed**, covering authentication, bounds, filters, first/last, no-wrap, revisions and captured turn identity after an inserted earlier timeline entry; the final whole-session keyboard journey also passed after that refinement.
- New browser journeys: all requested reading keys on a45-turn recording; two rapid queued backward keys; exact command copying; file peek/consent; other-turn folding with the focused card moving at most2px; typing into Find and CodeMirror; Settings and Home guide at320px; zero guide animations when invoked by keyboard with motion enabled; explicit replay continues through guide open/close.
- Actual redacted sessions: Drishya Codex, Skeletongraph Codex and Skeletongraph Claude navigate first/next/last/previous across paged history with no inspector and no horizontal overflow; guide screenshots inspected. No new page errors.
- Existing regression checks: replay clock continues through hover/scroll/reading; three turn-fold tests and two FILES-1 live/actual tests passed after integration.
- The known missing original Skeletongraph Codex journal still logs an ENOENT from session-segments. Imported evidence remains usable; no live native turn or new import of private journals was performed. Viewport emulation is not physical keyboard/assistive-technology certification. No hosted CI.

## Dependency retests

The single current checklist now has **Dependency gates and retest triggers** near its top. A pending gate remains unchecked until the prerequisite is available **and** its acceptance is rerun. It covers FILES-1 explicit deletion/enrichment, READ-1/TURN-1 typed Codex material, CONTENT-9 reasoning absence, questions/images/web/plans/subagents, usage/context, real model validation and physical/native acceptance. This is an index into TASKS, not another queue or an automatic readiness claim.
