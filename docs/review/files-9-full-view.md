# FILES-9 — captured files remain readable across entry points

Whole-task completion takeover authorized by Yash on 31 October. The canonical checklist remains TASKS; this document records the design, exact scope and acceptance evidence for its FILES-9 item. Implementation is in the draft; acceptance and the coordinated full gate are recorded below. Baseline running-app checks preceded source changes.

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


## Baseline, implementation and focused acceptance

Before source edits, the running app was checked on genuine Claude Code `rec_c8e5c9c8` (83,716,730 journal bytes, 10,581 observations), selecting an outside-workspace scratchpad Edit. At both 600 and 1440 px, Open current file for correction produced a disk-read error, one dead Retry source control, zero captured fallback materials and zero captured-file navigation actions. Private frames and the driver remain in `.local/`.

| Before | After | Why |
|---|---|---|
| A typed outside file title was plain text because prose-path parsing rejected it. | Typed file titles open the exact captured identity. | Captured metadata identifies this file; opening historical material does not grant disk access. |
| Investigation unconditionally sent a raw captured path to Workspace. | Shared captured/Workspace/Files choices map only an exact approved-root candidate; outside paths explain the refusal. | Current capability stays separate from captured evidence. |
| A restored Workspace or peek ended at an error and an impossible retry. | The same bounded FileHistory artifact/diff owner renders the captured material in place. | A missing current file does not erase what the harness recorded. |
| Off-page requested evidence could momentarily select an earlier version. | The requested captured reference resolves before another version can be selected, and historical recovery includes the replay cutoff. | Full reading must preserve the exact action and its evidence boundary. |
| Changes, Git review and file reading had different navigation controls. | They share captured-file, Workspace and Files navigation with availability explanations. | Reading and acting on captured work should not require learning separate routes. |

No adapter, ingest, schema, daemon permission or native settings change. Current access still uses the existing backend consent/root/index/protected/symlink checks. Proposed patches and captured excerpts retain their existing provenance; no whole file is invented from a partial read. Images use the existing captured image owner when recorded bytes are available.

Focused validation on the rebuilt implementation: both TypeScript projects, five lexical/navigation units, and eleven new browser cases pass. Browser cases cover Claude read/write/edit and the supported Codex patch/write shapes at 600/1440, full captured selection, Files reveal, restored outside/missing Workspace and peek readings, current-versus-captured distinction, Changes and Git review, exact off-page version selection, and seeking backwards after reading later material. Initial new-driver failures came from a restored Inspector covering the card title and checking approval visibility before status mounted; the driver now closes the Inspector before testing the title, and waits for approval-or-reader before choosing. No product assertion or timeout was relaxed.

### Genuine sessions, first completed matrix

Thirty journeys pass at 600/1440. Sources, screenshots and paths stay private; only counts are recorded here.

| Recording prefix | Harness | Source bytes / observations | Cases checked |
|---|---|---:|---|
| `rec_c8e5c9c8` | Claude Code | 83,716,730 / 10,581 | 18 inside/outside/missing read/write/edit captured-file journeys; four restored outside scratchpad Workspace/peek journeys |
| `rec_2112df1d` | Codex | 307,270 / 100 | Two inside-edit captured-file journeys |
| `rec_08d31045` | Codex | 27,919,575 / 1,872 | Four outside-write/edit captured-file journeys |
| `rec_d1f510ca` | Codex | 177,761 / 24 | Two Workspace journeys while the exact earlier synthetic DATA-7 fixture was temporarily absent |

The Claude sample has 759 file operations: reads 271 inside / 54 outside / 69 missing, writes 24 / 83 / 84, edits 298 / 29 / 41. Missing counts overlap inside/outside counts. There are 29 outside scratchpad Edits. The selected Codex large sample has 20 outside writes and 77 outside edits relative to its captured main root; the smaller inside sample has four inside edits. None of these counts implies permission to read the outside current file.

The missing Codex fixture was a previously genuine native capture with synthetic material. The builder authorized a single known tiny alpha/beta/gamma fixture under the exact temporary DATA-7 family: the resolved source and sibling backup paths were checked, its bytes matched an expected known-content SHA-256, it was moved aside for the two journeys, and a finally block restored it with a matching hash. No folder, real project file, native journal, native policy or configuration was changed. This is temporary synthetic current-file absence, not a permanent deletion of a user's project.

All selected captured materials were reachable. Restored outside Workspace/peek readings had no dead retry, no overflow and retained the captured material. Outside captured-file journeys issued zero current-document reads. The Codex adapter explicitly reports plaintext shell reads as shell operations, not dedicated read cards; those are not claimed as native read-card acceptance, and no unsupported read event was fabricated. Further current-file entry-point checks and the coordinated root gate remain pending; this draft is not marked ready.
