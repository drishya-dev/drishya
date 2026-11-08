# FILES-14 — recorded working-directory boundaries

Implementation prepared on `codex/files-14`, from `9cb060e3`. Candidate verification is pending the coordinator's testing token; this report does not mark the task accepted.

## Cause and contract

The reducer discarded recorded descendant working directories when collecting roots and then preferred a recording's primary ancestor when assigning an absolute path. A genuine nested checkout therefore lost its directory boundary before Files could render its existing Other working directories group.

The reducer now retains exact captured `workspaceRoot`, payload `cwd` and operation `intent.cwd` boundaries. Relative file paths resolve from their operation cwd first, with dot segments resolved, and use the deepest matching captured boundary. No folder-name or Git-worktree heuristic is introduced. Namespace hashes retain existing slash/case normalization; same-name files in distinct roots remain distinct. Reducer version r37 invalidates derived caches.

The daemon enumerates operation cwd in file-root metadata; history's incremental root predicate rebuilds when one first arrives. Store root enumeration includes it for existing export masking. These operations read already redacted observations only. No current-file consent, filesystem policy, native journal, event schema or controller behavior changes.

`worktreeFileRows` keeps every displayed leaf's exact projection path. A primary inventory alias inside a separately captured descendant is excluded from both browse and search, so the descendant is not browsable as primary repository contents. Namespaced descendant leaves retain their existing Other working directories grouping. Unknown namespaces and unresolved search locations retain FILES-13 behavior.

## SHIP-13 integration

No `SessionWorkspace.tsx` or `DeveloperWorkspace.tsx` edits. Existing helper signatures, `WORKTREE_GROUP` and root metadata shape are unchanged. The active-file reveal must expand `WORKTREE_GROUP`, the exact root prefix, and ancestor folders for another directory. Main folders retain `canonicalFileFolders` behavior. `currentWorkspacePath` continues to map only exact main-root aliases into the approved current reader; another root remains captured-only.

## Verification status

Written, not yet run: projection root-assignment regressions for nested/sibling same-name writes, operation cwd, dot segments, absolute nested paths, Windows primary aliases, unevidenced folder names and unresolved locations; UI helper regressions for primary inventory exclusion and collisions; daemon regression for append versus fresh import, root metadata and export masking.

Prior read-only source research is retained privately in `.local/files-14/`: `source-scan.json` (31 Claude candidate sources), `codex-source-scan.json` (63 Codex candidates), `root-evidence.json`, `baseline-manifest.json` (11 imported baseline candidates), and `baseline-1440.png`. Source `7eef4c37ef` is 687,248 bytes with one edit; `a4d91c1f6c` is 1,016,053 bytes with two edits. These are research candidates, not completed acceptance. The original screenshot capture from Yash's machine is unavailable locally; a local equivalent must be verified separately.

Remaining acceptance: scoped typechecks/units; targeted Files browser regressions; real Claude nested and sibling captures plus Codex at 600 and 1440; exact-once edited leaves under correct roots and absent from primary; package verification and full gate when assigned. Native Claude account-dependent work, if needed, remains delegated to Yash. No passing test or real-session acceptance is claimed here.
