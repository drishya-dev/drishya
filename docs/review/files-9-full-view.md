# FILES-9 — captured files remain readable across entry points

Whole-task completion takeover authorized by Yash on 31 October. The canonical checklist remains TASKS; this document records the design, exact scope and acceptance evidence for its FILES-9 item. Not implemented or accepted yet. Baseline running-app checks precede source changes.

## Purpose and evidence boundary

A developer chooses a recorded read, edit or write to understand the material the harness captured. That captured reading is the first destination, including a file that is outside the workspace or no longer exists. Current disk reading and editing remain separate, explicitly consented capabilities. A captured excerpt is labelled as an excerpt; a reconstructed after-state retains its provenance; an absent whole file is never filled with today's bytes.

The same small set of navigation choices belongs with captured file material across card expansion, Inspector, peek, Changes and Git review: captured file view, Open in Workspace, Show in Files. Secondary choices reuse existing menus and action styling rather than introducing a resident toolbar on the canvas. Unavailable current actions have a plain reason. Outside paths never launch an impossible disk read; a restored or stale current view keeps the captured reading instead of a spinner plus a dead Retry.

## Reserved scope

Fifteen exact paths, approximately five coherent commits, as reported to the coordinating root before production edits:

1. `apps/ui/src/lib/file-reading.ts`
2. `apps/ui/src/components/FileReadingActions.tsx`
3. `apps/ui/src/components/InvestigationActions.tsx`
4. `apps/ui/src/components/FileHistory.tsx`
5. `apps/ui/src/components/DeveloperWorkspace.tsx`
6. `apps/ui/src/components/SessionWorkspace.tsx`
7. `apps/ui/src/components/History.tsx`
8. `apps/ui/src/components/EvidenceReview.tsx`
9. `apps/ui/src/components/GitReview.tsx`
10. `apps/ui/test/file-reading.test.ts`
11. `tests/browser/file-reading-actions.spec.ts`
12. This report.
13. `docs/TASKS.md`
14. `docs/STATUS.md`
15. `docs/CONTINUITY.md`

Inspector uses its existing InvestigationActions owner, avoiding a second navigation implementation. FileHistory's bounded ArtifactReader/DiffReader remains the captured material owner, including embedded fallback readings. No adapter, ingestion, lineage, native control, filesystem permission or schema changes are planned. No disk permission is inferred from captured path text. The daemon's existing consent, root identity, protected-path, index and symlink checks remain authoritative.

## Validation status

Baseline: locating genuine Claude Code and Codex sessions with inside, outside and missing read/write/edit paths. Native content and paths remain private in ignored `.local/` files. Only prefixes, source sizes, counts and outcomes will be recorded here. Browser execution waits for the root's TEST-2 gate lease. Fixture checks are regression guards, not acceptance. The root coordinates one full gate after the finished feature batch; this draft does not claim one.
