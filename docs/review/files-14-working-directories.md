# FILES-14 — recorded working-directory boundaries

Implementation prepared on `codex/files-14`, from `9cb060e3`. Scoped verification and genuine acceptance are recorded below; the integrated full gate is running. This report does not certify a clean full gate.

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
