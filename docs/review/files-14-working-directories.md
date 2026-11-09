# FILES-14 — recorded working-directory boundaries

Implementation prepared on `codex/files-14`, from `9cb060e3`. Task acceptance is complete for other-builder review. The full gate has four failures reproduced on clean main; its exact disposition is recorded below.

## Cause and contract

The reducer discarded recorded descendant working directories when collecting roots and then preferred a recording's primary ancestor when assigning an absolute path. A genuine nested checkout therefore lost its directory boundary before Files could render its existing Other working directories group.

The reducer now retains exact captured `workspaceRoot`, payload `cwd` and operation `intent.cwd` boundaries. Relative file paths resolve from their operation cwd first, with dot segments resolved, and use the deepest matching captured boundary. No folder-name or Git-worktree heuristic is introduced. Namespace hashes retain existing slash/case normalization; same-name files in distinct roots remain distinct. Reducer version r37 invalidates derived caches.

The daemon enumerates operation cwd in file-root metadata; history's incremental root predicate rebuilds when one first arrives. Store root enumeration includes it for existing export masking. These operations read already redacted observations only. No current-file consent, filesystem policy, native journal, event schema or controller behavior changes.

`worktreeFileRows` keeps every displayed leaf's exact projection path. A primary inventory alias inside a separately captured descendant is excluded from both browse and search, so the descendant is not browsable as primary repository contents. Namespaced descendant leaves retain their existing Other working directories grouping. Unknown namespaces and unresolved search locations retain FILES-13 behavior.

## SHIP-13 integration

No `SessionWorkspace.tsx` or `DeveloperWorkspace.tsx` edits. Existing helper signatures, `WORKTREE_GROUP` and root metadata shape are unchanged. The active-file reveal must expand `WORKTREE_GROUP`, the exact root prefix, and ancestor folders for another directory. Main folders retain `canonicalFileFolders` behavior. `currentWorkspacePath` continues to map only exact main-root aliases into the approved current reader; another root remains captured-only.

## Verification status

The phase-one regression inventory (executed results below) included: projection root-assignment regressions for nested/sibling same-name writes, operation cwd, dot segments, absolute nested paths, Windows primary aliases, unevidenced folder names and unresolved locations; UI helper regressions for primary inventory exclusion and collisions; daemon regression for append versus fresh import, root metadata and export masking.

Prior read-only source research is retained privately in `.local/files-14/`: `source-scan.json` (31 Claude candidate sources), `codex-source-scan.json` (63 Codex candidates), `root-evidence.json`, `baseline-manifest.json` (11 imported baseline candidates), and `baseline-1440.png`. Source `7eef4c37ef` is 687,248 bytes with one edit; `a4d91c1f6c` is 1,016,053 bytes with two edits. These are research candidates, not completed acceptance. The original screenshot capture from Yash's machine is unavailable locally; a local equivalent must be verified separately.

At phase one, scoped checks, genuine checks and the package/full gates were still pending. The measured continuation below supersedes that status. Native Claude account-dependent work, if needed, remains delegated to Yash. No passing test or real-session acceptance is claimed here.

## 9 November acceptance

Source `52254012`: typechecks, 24 focused units and 22 named Files browser cases pass (three requested browser workers, zero retries). The first new unit expected outside absolute paths in the repository inventory; existing policy preserves them on operations and excludes them from that inventory. The corrected assertion verifies both boundaries. Its failed log is retained privately.

Fresh normal redacted scratch imports, independent of the older baseline home:

| Native journal prefix | Bytes | Captured directories | Exact-once placed edited leaves |
| --- | ---: | ---: | ---: |
| Claude `2226bdea` | 687,248 | 4 | 1 |
| Claude `c743c426` | 2,019,147 | 4 | 5 |
| Codex `01a1be5d` | 182,354 | 3 | 3 |

All three Files views were checked at 600 and 1440 px: Other working directories exists, directory groups expand, zero horizontal overflow. The Codex tree has exactly three `proof.ts` leaves in distinct captured roots. The fully expanded display model has each of the nine unique edited leaves exactly once, with exact captured-root prefixes and no unresolved placement. The first display-model probe omitted canonical main-folder ancestors; adding those real folder identities to its expanded set corrected the probe without changing product code. Journal content and screenshots remain private under the integration checkout's `.local/release-real/`.

Codex was captured through the normal native CLI on synthetic main, nested and sibling Git worktrees. The CLI exited zero and recorded native file changes in all three roots. The generator's additional exact-value check failed because the resulting bytes differed from its requested value and the main file ended unchanged; that failed setup receipt is preserved. Acceptance here checks genuine recorded edit locations, not a claim that every requested final byte was produced.

Recorded cwd boundaries are shown truthfully as **Other working directories**. A captured directory alone does not prove Git-worktree membership; no branch/folder-name inference was added. The original machine-specific screenshot is unavailable, so the native local equivalent above is the checked case.

Integrated full gate: frozen source candidate `b843726`, three parallel browser workers and one serial worker, zero retries; result pending. Do not report packaging/full-suite success until that command finishes. Normal other-builder review and merge remain outstanding.


## Final integrated gate disposition (9 November)

Product source `35e4393`: both typechecks and UI build pass; all 215 unit files pass, **1,315 tests / one existing skip**. Browser run used **three parallel workers plus one serial worker, zero retries**: **696 parallel passes / 27 skips; 28 serial passes / one skip / four failures**. This is not a clean full browser gate.

All four failures reproduce with the same assertions on separately rebuilt, clean main `f93d880b`, one serial worker and zero retries: B2 live :63 opens an unexpected operation detail (expected zero, got one); material-motion :132 loses its hover-reading surface; p1-pacing :40 sees three active animations instead of zero; p1-pacing :266 has no repository tether. These remain TEST-2/MOTION-3 baseline failures, not fixes claimed by this task. The baseline control lives in the coordinator checkout's `.local/release1-baseline-20261109/`.

The first gate `b843726` stopped at three golden mismatches after 1,312 unit passes / one skip. Only the reviewed raw sequence expectations changed (18 to 19, 20 to 21, 22 to 23), reflecting retained Claude completion observations; all other golden fields remain unchanged. Golden/queue checks then passed 46/46. The first independent packaging run also failed its old exact observation count of 34: the fixture now retains three completed-turn rows. The corrected exact assertion is 37, with zero capture gaps. **package:verify passes at integration `70825e6`**, including isolated offline installation, both imports, checksums, demo, authenticated API and persisted restart. Its apps/packages tree is byte-identical to the full-gate product source; the additional change is the verification script, plus docs. No browser assertion, retry or timeout was relaxed.

Private complete gate evidence: `.local/release-gate-20261109-141147/` and `release-gate-20261109-142009/` in the isolated integration checkout. No further full-suite command was run to erase these failures. Other-builder review remains required; no merge or release certification is implied.

## Final representative coverage

Claude `5e486837` (1,031,859 bytes) supplies both nested and sibling edited-directory cases: two exact-once located edited leaves across four captured roots; its Files groups pass at 600/1440. The native Codex source `01a1be5d` was normally resumed, adding two synthetic main-repository files; at 206,161 bytes it has five exact-once edited leaves across three roots. Together with the two earlier Claude sources, the expanded display models contain 13 unique located edited leaves exactly once. Native main, nested and sibling identities stay separate; primary inventory aliases inside a separately captured descendant remain excluded. These are captured directory boundaries, with no claim that a cwd string alone proves Git membership.

The standard bounded worktree-roots scanner exits zero but selects a Codex candidate with zero projected files and finds no Claude match under its narrow native-directory naming prefilter. That result is **not** used as worktree acceptance; the explicit positive imports, placement assertions and real frames above supply it. Standard workspace-files and mid-turn-input scans also exit zero; their counts do not replace the direct case checks. The unavailable original builder screenshot remains unavailable.

FILES-14's explicit Accept list is met on the local genuine equivalents above. Completion docs are included in this PR; main remains claimed until review/merge. The separate baseline blob-backed diff crash discovered during queue acceptance is CONTENT-19, not a hidden Files fix.
