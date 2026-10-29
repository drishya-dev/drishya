# GIT-5 — read local branches without changing the checkout

29 October 2026. Whole-task acceptance for PR #284.

The Git history header chooses a local branch by its existing opaque ref identity. Its graph, commit list and commit patches read that ref; the checked-out branch or detached HEAD remains separately visible. Local branches sort current first, then by last-commit time. The header's first 100 branches remain independent of sidebar search and pagination; the existing bounded reference search/pages reach the rest. Tags and locally stored remote refs retain their existing sidebar routes and are labelled as such when selected.

Selected branch details show the last commit date, configured upstream (explicitly local state), and ahead/behind against the current HEAD and default branch. A stored remote HEAD identifies the default; absent that evidence, local main/master is explicitly labelled a convention. No known default says unknown locally. Counts use `git rev-list --left-right --count base...selected`, with left = behind and right = ahead. Different tips in a shallow repository withhold counts. No merge-base is reported only after both local ancestry walks succeed; failed/missing-object reads say unavailable. Identical tips can truthfully show zero even in a shallow repository.

There is no checkout, fetch, network request, repository/configuration write, new dependency or captured-event schema change. Existing authentication, separate workspace/Git grants, generation checks, redaction, fixed argument arrays, subprocess limits and disabled lazy fetching remain in force. Captured session links and hunk attribution retain their existing owners.

## Acceptance against genuine captures

All imports used scratch Drishya homes, removed after each browser check. Native journals were opened read-only. Four fresh native CLI turns were recorded with the saved default policies and a request to reply without tools or edits; the native harnesses owned their journal writes. The full and shallow repositories contain synthetic source, but the captures are genuine Claude Code/Codex sessions, not fabricated journals.

| Harness | Recording prefix | Journal bytes | Observations | Cases |
|---|---|---:|---:|---|
| Claude Code | `rec_b25fc1ad` | 135,610 | 5 | Full local repository; topic exactly ahead 2 / behind 1 against current and default; unrelated branch; no upstream |
| Claude Code | `rec_9ab0d2fd` | 135,591 | 5 | Shallow local clone; detached HEAD; unavailable ancestry counts |
| Claude Code | `rec_061e5f2d` | 7,150,502 | 1,138 | Existing Drishya repository; 289 refs at the acceptance snapshot; configured upstream; exact current/default counts |
| Codex | `rec_60089691` | 176,160 | 15 | Full local repository; topic exactly ahead 2 / behind 1 against current and default; unrelated branch; no upstream |
| Codex | `rec_44031e29` | 171,790 | 15 | Shallow local clone; detached HEAD; unavailable ancestry counts |
| Codex | `rec_99b8dd22` | 1,043,057 | 84 | Existing Drishya repository; 288–289 refs across snapshots; configured upstream; exact current/default counts |

Every case was checked at **600 and 1440 px**, with selected-tip equality, exact known counts checked against the same Git object pair, unchanged HEAD before/after browsing, and contained dialog/page geometry. Real screenshots and native outputs remain private under ignored `.local/`; none are committed. The full-repository synthetic regression additionally checks unchanged refs and a clean working tree, reads the chosen branch's actual patch, and follows its captured hash-output link. Existing GIT-2 command/working-file and commit-hunk picker browser regressions pass.

The existing larger Claude session legitimately needs more than the browser assertion's former ten-second default while the history request is pending. Acceptance waits up to forty seconds, covering the existing thirty-second inspection budget and UI scheduling; product timeouts were not changed. A subagent-only journal lacking a recorded workspace root was rejected as an acceptance candidate, and the main session above was used instead.

## Reproduction and checks

- `pnpm check:real -- local-branches --max-mb 15`: counts-only workspace-root candidate scan and scratch imports for both harnesses. The new case identifies candidates; the browser spec verifies recording-root access and branch behavior. The helper now consumes pnpm's leading `--`, so bounds/options are actually parsed.
- `DRISHYA_GIT_BRANCH_SESSIONS` points to an ignored local JSON array of `{adapterId, path, case}`; cases are `unrelated`, `shallow`, or `many`. Run `pnpm exec playwright test tests/browser/git-branches.spec.ts --workers=1` with an installed browser channel. This mounts genuine captures; no real path or journal is a committed fixture.
- Both TypeScript projects and `ui:build` pass. `check:affected` passed 108 related units across 14 files; its initial browser phase could not launch because this machine lacks Playwright's default bundled browser. The same named specs pass with installed Chrome. Five dedicated branch units pass, including recency ordering, detached/shallow/unrelated and failed-object reads.
- Seven additional browser regressions pass: B4 paged history, two Git review controls, two Git session-evidence journeys, and two commit-hunk attribution/picker journeys. The complete branch suite passes two fixture regressions plus twelve real-session desktop checks. The final sidebar-independent branch-list correction is additionally checked by both fixture journeys and both existing real-session repositories at both widths.

The full gate is reserved for the root agent's finished-task batch, per AGENTS.md. No hosted CI, merge, broad release/hardware certification or native account-policy change is claimed. There is no outstanding external blocker for GIT-5's stated acceptance.

## Final integrated gate and merge order

This PR is stacked after #283 to preserve the reconciled real-case registrations. Merge #276, #282, #285, #283, then #284, retargeting each remaining PR to main after its parent lands. Frozen source batch `ef541e4` passes build, both typechecks, 1001 units (one skip) and package verification. Full browsers: 481 passed, 26 skipped, one b2-live:139 failure; the named case passes alone on unchanged integrated code and clean main, so baseline failure is unproven. Feature acceptance is complete; shared merge-gate qualification remains explicit.
