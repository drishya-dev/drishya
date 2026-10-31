# FILES-7 — current reading for exact recorded main-root aliases

Whole-item local acceptance is checked after UI-16 #297 and SCREEN-1 #298 merged, satisfying Harsh's requested wait. PR #299 stays draft and FILES-7 stays claimed until the coordinating root finishes the integrated batch gate. No native journal material is included here.

## Cause and boundary

Older multi-root captures keep historical file identities under recorded-root prefixes. The daemon's captured file-only graph therefore lacks the decoded current relative path; the old current-reader graph-membership check refused it. SessionWorkspace click/double-click and the captured reader repeated the same restriction.

The daemon now admits an absent relative node only when a `recording-files-only` graph contains its exact namespaced node and that recorded prefix identifies the already approved captured main root. The path must still pass `isIndexableFile`, current-reading consent, root identity, protected-path and symlink checks. Directory ancestry, a similarly named root and another worktree grant nothing. Complete current graphs keep their previous missing-node refusal. Captured file identities, historical artifacts and the event schema are unchanged.

SessionWorkspace and FileHistory now use the existing exact-root mapping. A bounded WeakMap remembers only current-to-captured navigation references: eight sessions per source, 32 paths per session, no bodies, grants or persistence. Recorded work revalidates the alias against current root metadata before returning to the original namespaced history; it stays disabled while that proof is unavailable. UI-16's FileRowName and rail-width presentation are preserved. Only the approved obsolete main-alias captured-only premise changed in `files-6-worktrees.spec.ts`; worker/grouping/metadata/origin assertions remain intact.

## Real-session evidence (counts only)

The baseline scan read 74 Codex and 41 Claude journals under a 700 MB per-journal bound. Three Codex journals had multiple raw cwd values and an existing primary root. Claude had 29 such journals, 27 with an existing primary root. All 30 locally rooted candidates were imported into a scratch home. Nested cwd changes alone are not called distinct worktrees.

| Harness / recording prefix | Bytes | Observations | Exact main aliases | Eligible existing main files | Current reads before / after backend fix |
|---|---:|---:|---:|---:|---:|
| Codex `rec_5da1cec3` | 15,795,654 | 5,463 | 48 | 29 | 0 / 29 |
| Claude `rec_b067a552` | 2,694,624 | 676 | 55 | 1 | 0 / 1 |
| Claude `rec_14f29d5f` | 28,184,536 | 4,416 | 24 | 0 | 0 / 0 |
| Claude `rec_2a19c19d` | 1,031,859 | 238 | 15 | 0 | 0 / 0 |
| Claude `rec_93a3f541` | 10,113,732 | 3,426 | 55 | 6 | 0 / 6 |
| Claude `rec_560c2ba9` | 9,596,554 | 2,919 | 96 | 2 | 0 / 2 |
| Claude `rec_89ed5380` | 7,564,786 | 2,327 | 66 | 2 | 0 / 2 |

The exact alias case remains one Codex and six Claude recordings before and after: 0/29 to 29/29 eligible Codex files, 0/11 to 11/11 Claude files. Missing/excluded files are not claimed readable. Every actual read uses normal WorkspaceAccess approval and guards.

Before source edits, the running app on `rec_5da1cec3` and `rec_b067a552` at 600/1440 showed a captured dialog, zero current readers and zero on-disk actions for an approved main alias. After integration, all eight genuine browser journeys pass:

| Case | Harness / recording prefix | Bytes | Widths | Result |
|---|---|---:|---|---|
| Captured → explicit consent → current → original captured → Workspace via Enter | Codex `rec_5da1cec3` | 15,795,654 | 600 / 1440 | Both pass; 48 file identities unchanged, one captured action retained, one current reader and one Workspace document, zero page errors |
| Same main-root journey | Claude `rec_b067a552` | 2,694,624 | 600 / 1440 | Both pass; 55 file identities unchanged, one captured action retained, one current reader and one Workspace document, zero page errors |
| Approved workspace, outside-root file stays captured | Codex `rec_b0db8e34` | 4,681,372 | 600 / 1440 | Both pass; one captured action, zero current actions/readers; honest missing captured bytes |
| Same outside-root journey | Claude `rec_560c2ba9` | 9,596,554 | 600 / 1440 | Both pass; two captured actions, zero current actions/readers |

Current and Workspace frames at both widths, plus outside-root frames, were inspected locally. Screenshots and drivers stay ignored in `.local/`; no source text, local file path or native configuration is included in this report.

Real refusal checks on the two main samples also pass for absent consent, protected paths and revoked consent, preserving all captured file identities. One genuine missing-file case in the Claude sample and one existing symlink case in the Codex sample are refused. The imported corpus contains one Codex and three Claude recordings with captured outside-root files; selected outside references above are refused by the current reader and remain captured-only in the UI. No native root-replacement race was induced; stale/root-identity races have deterministic unit coverage.

## Verification and acceptance accounting

- Both TypeScript projects and UI build pass after the upstream merge and complete SessionWorkspace integration.
- All 53 targeted units pass: 15 dedicated alias/consent/exact-root/indexability/link/missing/identity/redaction guards, three bounded navigation-origin guards, and unchanged workspace, recorded-root and UI mapping regressions.
- The final affected related-unit tier passes 195 tests across 24 files, with one existing POSIX-only case skipped on Windows.
- Focused browser run: 24/25 pass across the four new alias journeys, two FILES-6 worktree/security journeys, seven FILES-4 reader journeys, six rail-width journeys and six Workspace-routing journeys. The unchanged `files-workspace-routing.spec.ts:90` 1440 px draft-close/reopen case failed at line 100 because its editor was absent on reopening. Its unchanged isolated rerun passes 1/1. The original failure is retained; it is not proven to be a clean-main flake. No assertion or timeout was relaxed.
- The four new alias journeys cover captured/current/original-captured return, explicit consent, Workspace keyboard entry and outside-root captured-only routing at 600/1440; the 1440 journey also proves double-click pins the decoded file and returns to its original captured history.
- Plain current reading, Markdown/source, empty files, source navigation/copy, local drafts, return from Workspace and the merged rail presentation pass their unchanged focused checks; the single draft-reopen failure above remains for the integrated gate to assess.
- `pnpm check:real -- main-root-aliases` passes freshly: two Codex candidates / three outside-primary declarations and nine Claude candidates / 11 declarations. Selected imports preserve 48 namespaced files / one prefix (`rec_5da1cec3`, 15.8 MB) and 120 / three (`rec_14f29d5f`, 28.2 MB). This scanner locates native multi-root evidence; it does not itself approve current bytes.
- `pnpm package:verify` passed at the backend milestone: isolated offline install, both harness imports, bundle, authenticated API and persisted restart. Daemon source has not changed since that check. Final package/full verification belongs to the integrated root batch.
- `pnpm check:affected --dry` maps 66 browser specs through broad Workspace component matching. Both typechecks and its exact related-unit tier have run; the broad browser tier is covered by the coordinating root's once-per-finished-batch gate, rather than duplicated here.

The TASKS Accept line is covered by the genuine pre-existing Codex main-root journey, relevant Claude main-root journey, genuine outside/missing/link refusals, deterministic stale/protected/index/identity guards, and unchanged plain/captured reader regressions. The final integrated gate and its assessment of the preserved draft-reopen failure remain pending. FILES-7 is not ticked, its claim is not removed and PR #299 is not marked ready in this increment. Exact current diff is 12 paths against origin/main; central TASKS/STATUS completion makes the planned final scope 14.


## 31 October completion takeover

Yash authorized Codex to finish the inactive pre-audit PRs, preserving Harsh's implementation. The FILES-7 branch was integrated with main including CONTENT-13; no additional production change, assertion relaxation or timeout change was needed in this verification pass. The independent checkout has its own frozen dependency installation.

- Both TypeScript projects, the rebuilt UI and 32 focused alias/index/root/navigation units pass on the integrated branch.
- The unchanged whole `files-workspace-routing` file passes 30/30 checks (five repeats, four workers). Its closed-tab draft case then passes 40/40 further checks (20 repeats at both supported widths, four workers). The earlier one-off editor-absent failure remains recorded above: these reruns do not establish its original cause or prove it also fails on clean main. No product editor change is justified by the evidence collected here; the final integrated gate must retain any recurrence.
- All six exact-alias and worktree-group/security browser cases pass on the same rebuilt branch. Combined targeted fixture checks in this takeover: 76 passed, no failure, no changed assertion.
- This machine's original bounded native corpus has no qualifying outside-primary working-root transition. Its Claude multi-cwd journals contain descendant directory changes, which the scanner correctly excludes. This differs from Harsh's earlier machine/corpus; his existing genuine-session matrix above is retained, not represented as a fresh rerun here.
- A new genuine Codex session was therefore recorded through the installed native CLI, without editing any harness file or changing saved settings or permissions. Two new synthetic scratch repositories were used. The native CLI ran in read-only mode, read a small file in the primary root, then resumed the same session from the sibling worker root and read its small file. Session prefix `01a19186`, 227,001 journal bytes, two recorded working roots; imported recording prefix `rec_658acbd1`, four operations, two preserved namespaced files. This is fresh native acceptance with synthetic material, not a pre-existing user recording.
- At 600/1440 px that genuine recording passes captured reading → explicit consent → current reading → original captured history → Workspace via Enter → outside-root captured-only reading. Both journeys preserve the two captured identities, with zero page errors, external requests or document overflow. Screenshots, native output and drivers remain ignored under `.local/`.
- Fresh `check:real main-root-aliases --harness codex --pick 1` finds the new native session and passes its two namespaced-file/two-prefix check. The scanner is an evidence locator; the browser journeys above establish the current-reading behavior.
- Claude Code is installed but `auth status` reports signed out. No authentication, credential or configuration change was attempted; a fresh Claude native capture cannot run in this environment. The earlier genuine Claude reader/refusal evidence above remains the task's Claude acceptance, and no newly recorded Claude result is claimed.

The once-per-finished-batch full gate remains with the coordinating root. Until it finishes, PR #299 remains draft and FILES-7 remains open/claimed. The takeover does not silently classify the preserved draft-reopen failure as a fixed product defect or a proven clean-main flake.
