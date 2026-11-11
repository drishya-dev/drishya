# FILES-15 — One session checkout, other roots as evidence

Yash with Codex, 11 November. Whole item, implementation and acceptance in progress. No event schema or native journal changes. The session's recorded checkout remains the Files/Git/map root; another root never gains consent or Git controls by appearing in captured evidence.

| Before | After | Why |
| --- | --- | --- |
| Root metadata includes every captured command cwd | File activity is derived from the worker's complete read/write references | A shell cwd alone does not prove file work |
| Multi-root projections prevent the current map being indexed | The map uses the recording's captured checkout, after existing approval | Namespaced evidence does not erase the session's checkout |
| Worktree names alone | Captured branch when known, file count, recorded agents, current directory existence, recent first | Explain what each evidence root contains |

Root evidence uses the existing full projection in the history worker, not the currently visible history page, without returning full operations to the main thread. Raw root aliases still exist for stable captured-path identity and existing consent checks. Branches come only from recorded session metadata. Disk state is a bounded read-only stat snapshot, not file-reading consent. Removed directories retain their captured paths and material. Plain controls use existing classes/tokens; no new layout or motion.

## Genuine reproduction

Coordinator native prefix `dd136b25`, recording `rec_81c22a35`, 181,158,245 bytes, 23,292 observations: 19 recorded roots, 13 other roots with read/write evidence, five cwd-only roots, seven removed evidence roots, thirteen captured branch labels, two recorded agents. All have a captured main root. This confirms the distinction matters on real data. The older Claude `rec_39af3c94` and Codex `rec_7f1936ab` samples each have one recorded root, so they are not claimed as multi-root acceptance. More specific subagent/worktree samples, screen checks and exact independent count checks follow.

## Regression checks so far

Both project types pass. Twenty-nine focused backend/UI units pass, including cwd-only exclusion, recent-first collapsed counts, removed-state retention and main-only indexing despite a mismatched prior graph root. The route uses the existing authenticated recording membership checks. No broad/full gate acceptance claimed yet. Real material stays private in `.local/files-15/`.
