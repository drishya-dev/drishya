# 91 — Exact, keyboard-accessible captured references

17 October2026. Follow-up to the84/85 reading findings after PR71's list correction. Installed Emil design-engineering guidance applies to native button semantics, restrained focus treatment and immediate repeated navigation.

| Before | After | Why |
|---|---|---|
| Inline file references were pointer-only code elements | Native inline buttons with descriptive file/line labels | Keyboard and assistive-tech users can activate the same destination. |
| Click discarded line suffix and only highlighted the map | Open captured file work, retain explicit requested line | A reference should support investigation rather than only change decoration. |
| A referenced line beyond the first stored page was not addressed | Validate artifact range, fetch its bounded page, reveal/highlight the actual line | Keep line addressing exact without loading an entire artifact. |
| Missing line could appear to be available | Explicit outside-stored-range notice; no invented source or silent current-disk substitution | A prose reference does not establish that its source bytes were captured. |
| Same-file references shared one reading visit | Distinct line destinations in Back/Forward and bounded recovery metadata | Retain the exact investigation point. |
| Ordinary navigation could inherit a prior reference | Shared state action clears unspecified reference lines | A normal file open should stay normal. |

The primary prose action opens historical evidence only. Existing explicit disk-reading consent remains separate. A read excerpt covering the requested line is preferred among the bounded loaded evidence choices. If it is not present, the reader remains honest about the selected range; this is not an unbounded search across every historical version or a claim that a later read explains the prose. Other available actions remain selectable. Snippets highlight only actual matching source rows. Patches keep their own controls; a referenced line does not fabricate a before/after source snapshot.

Reference metadata stores only a bounded positive integer alongside the existing path/location. No captured-event schema, provenance, source body, draft, attachment or permission is added to checkpoints. Ordinary file opens/closes use the shared state action so stale references clear; explicit reading-history recovery retains its target. Current Markdown documents without a historical navigation callback retain selectable inline code.

Validation:439units/74files, both typechecks and production build pass. New imported Claude browser fixture verifies Enter/Space, line250 beyond the first page, and unavailable400 without fabricated rows. Five retained search/evidence/source/replay/keyboard browser journeys pass. Final new-reference rerun plus real private Drishya and Skeletongraph Codex/Claude history/manual-scroll/multi-file Workspace regressions all pass (four journeys). Actual Drishya frame inspected. The older Claude source without a captured workspace root remains explicitly read-only. No hosted CI/native turn/private content committed.

Next remains source-version/base/draft comparison and the joined evidence → current source → native correction → resulting check workflow, then the full component/palette audit and another developer critique. Native signed-in, human ten-minute/assistive-tech and physical/platform acceptance remain explicit.38 tracks the recurring antivirus issue independently; supported idle-time managed-runtime update has not been run or certified as a fix.
