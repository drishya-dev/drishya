# FILES-7 — current reading for exact recorded main-root aliases

Whole task in progress. UI-16 #297 and SCREEN-1 #298 are merged; Harsh's requested wait is satisfied. The released SessionWorkspace integration now preserves the merged Files rail presentation. Final browser and real-session acceptance waits for the coordinated browser lease. No native journal material is included here.

## Cause and boundary

On the starting tree, `apps/daemon/src/app.ts:127-128` returns a captured file-only graph when a multi-root projection has no single workspace root. Its nodes keep namespaced historical identities. `apps/daemon/src/workspace.ts:137` admitted an absent current relative path only when the graph was truncated or stale, so exact main-root aliases were refused.

`apps/ui/src/components/SessionWorkspace.tsx:275` (click), `:281` (double-click) and `apps/ui/src/components/FileHistory.tsx:46` also suppress the action because that decoded path is absent from the captured graph. The unowned FileHistory guard now permits the exact-root action and remembers its captured alias before current reading; the daemon remains the bytes/consent owner. SessionWorkspace click/double-click now uses the same exact-root mapping and remembers the original captured identity for the current reader's Recorded work return. The bounded memory-only reference revalidates metadata before enabling that return. Harsh approved replacing only the obsolete main-alias premise in `tests/browser/files-6-worktrees.spec.ts:29`; outside-root/grouping/security guards remain intact.

The daemon now accepts that missing graph membership only for a `recording-files-only` graph whose exact recorded prefix identifies the captured approved main root and whose exact namespaced file node exists. It then applies `isIndexableFile` and all existing current-reader consent, identity, protected-path and symlink checks. A sibling, descendant or similarly named root grants nothing. Captured identities, historical artifacts and the event schema are unchanged. Complete current graphs retain their old missing-node refusal.

## Real-session evidence (counts only)

The baseline scan read 74 Codex journals and 41 Claude journals under a 700 MB per-journal bound. Three Codex journals had multiple raw cwd values and an existing primary root. Claude had 29 such journals, 27 with an existing primary root. All 30 locally rooted candidates were imported into a scratch home. Nested cwd changes alone are not called distinct worktrees.

| Harness / recording prefix | Bytes | Observations | Exact main aliases | Eligible existing main files | Current reads before / after backend fix |
|---|---:|---:|---:|---:|---:|
| Codex `rec_5da1cec3` | 15,795,654 | 5,463 | 48 | 29 | 0 / 29 |
| Claude `rec_b067a552` | 2,694,624 | 676 | 55 | 1 | 0 / 1 |
| Claude `rec_14f29d5f` | 28,184,536 | 4,416 | 24 | 0 | 0 / 0 |
| Claude `rec_2a19c19d` | 1,031,859 | 238 | 15 | 0 | 0 / 0 |
| Claude `rec_93a3f541` | 10,113,732 | 3,426 | 55 | 6 | 0 / 6 |
| Claude `rec_560c2ba9` | 9,596,554 | 2,919 | 96 | 2 | 0 / 2 |
| Claude `rec_89ed5380` | 7,564,786 | 2,327 | 66 | 2 | 0 / 2 |

The exact alias case remains one Codex recording and six Claude recordings before and after; current readability changes from 0/29 to 29/29 eligible Codex files and 0/11 to 11/11 Claude files. Missing/excluded files are not claimed readable. Current-root approval and every actual read used the normal WorkspaceAccess implementation.

Before source edits, the running app on `rec_5da1cec3` and `rec_b067a552` at both 600 and 1440 px showed a captured dialog, zero current readers and zero on-disk actions for an approved main alias. Screenshots and private drivers remain in ignored `.local/`. Final UI acceptance is pending the shared browser lease; shared-file release is complete.

## Verification so far

- 53 targeted units pass after integrating current main: 15 new alias/consent/exact-root/indexability/link/missing/identity/redaction guards, three new bounded navigation-origin guards, plus unchanged workspace, map eligibility, recorded-root and UI mapping regressions.
- After merging current main at cf25d9e and integrating SessionWorkspace, both TypeScript projects and all 53 targeted units pass again. The prior affected related-unit command passed 194 tests across 23 files, with one existing POSIX-only case skipped on Windows. No browser was launched during integration.
- `pnpm package:verify` passes: isolated offline package install, both harness imports, bundle, authenticated API and persisted restart.
- `pnpm check:real -- main-root-aliases`: one Codex candidate / two distinct outside-primary root declarations; nine Claude candidates / 11 declarations. Selected imports preserve 48 namespaced files / one prefix (`rec_5da1cec3`, 15.8 MB) and 120 / three (`rec_14f29d5f`, 28.2 MB). This scanner locates native multi-root evidence; it does not itself approve or read current bytes. Exact-root/current-read evidence is in the separate matrix above.
- `pnpm check:affected --dry` maps 64 browser specs after adding the captured-reader guard and dedicated fixture through broad workspace-name matching. The dedicated browser fixture lists four cases at 600/1440 but has not executed. Browser execution waits for complete UI integration and the coordinated browser lease. Full batch verification belongs to the coordinating root lane.

## Remaining whole-task acceptance

Final running-app current reading at 600/1440 for both genuine harness samples; approved single-root current and captured-reader regressions; dedicated browser guards; affected check execution; package verification if required by the final daemon scope. SessionWorkspace integration is implemented after PR #297 merged, with FileRowName and the rail-width presentation preserved. The only files-6-worktrees assertion changed is the approved obsolete main-alias captured-only premise; worker/grouping/metadata/origin checks remain intact. Current exact diff is 12 paths against origin/main (14 with central completion docs). FILES-7 stays open and its own claim stays present until acceptance and the root batch gate pass.
