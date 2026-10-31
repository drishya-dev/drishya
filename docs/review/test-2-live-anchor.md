# TEST-2: live reader anchor stability

Status: diagnosis in progress; task remains open. Claim pushed on main in 289ae6f before branch work. Branch harsh/test-2-live-anchor has its own frozen pnpm install.

## Problem and acceptance

The current TEST-2 entry records an intermittent 5 px passage-anchor mismatch in b2-live.spec.ts:63 on clean main. Its cause is NOT VERIFIED in this run. The whole item requires either three consecutive complete browser commands without failures, or every remaining failure recorded with its verified cause (TASKS.md, TEST-2 Do/Accept).

## Verified baseline

At main plus claim 289ae6f, UI build passed. Command:

    pnpm exec playwright test tests/browser/b2-live.spec.ts --project=serial --workers=1 --repeat-each=6 --grep "live history keeps the reader anchored" --trace=retain-on-failure

Result: six passed, 1.7 minutes. Assertions, timeouts, test source and product source were unchanged. A passing repeat does not establish the cause of the recorded intermittent failure.

## Diagnosis boundaries

- Compare the full B2 file as well as the first test alone; later cases share an accumulated fixture journal.
- Observe native wheel/scroll, numeric passage geometry, spacer sizes and scrollTop setters without changing behavior.
- History.tsx is reserved by FILES-9; diagnosis is read-only until any necessary handoff is agreed.
- No assertion relaxation, retry wrapping, timeout increase, event-schema change, native journal mutation or permission change is authorized.
- Real-session acceptance, targeted checks and the finished-task batch gate are still pending. Counts and session prefixes only; real content and screenshots remain private.

## 1 November continuation (Harsh with Claude, after Codex stopped)

Branch head before this section: 2190a93. Edge, own frozen install, UI rebuilt before every run, one browser command at a time, long TEMP/TMP.

### Fixed with a verified cause

| Failure | Cause | Change |
|---|---|---|
| fresh-workspace.spec.ts:554 | GIT-6 moved the zoom value from a second span to `output[aria-label="Zoom level"]`; the locator found nothing. | Locator only (0580762), approved by Harsh. All zoom, position, pixel and timeout assertions unchanged. |
| git-graph-focus.spec.ts 700 px | A commit read started in the 1440 px case outlived its page and held the Git inspection lock; the next case's history request got HTTP 409 and drew no commits (Codex probe: lock held at both case boundaries in 3 of 3 pairs). | Each width gets its own scratch repository, App and server (a684898), approved by Harsh. No assertion, action or timeout change. |
| ui-1b-header-git.spec.ts:78 | `GitHistory` started as "not approved" (`useState(false)`) and rendered "Approve read-only Git history" until `gitStatus` returned, then hid it for an already-approved repository. The test's `isVisible()` caught the flash and its click waited on a vanished button until the 90 s timeout. A person saw the same flash. | Product fix (2190a93): the status starts unknown and the reader says "Checking Git access…" until it is known; a failed status read still offers the prompt. Spec unchanged; 5 of 5 repeats with nested-checkouts pass; `check:affected` 80 of 80. |

### Full browser commands on this branch

| Run | Command | Parallel | Serial | Failures |
|---|---|---|---|---|
| 1 | `pnpm test:browser` (before 2190a93) | 569 passed / 27 skipped / 2 failed | 33 passed / 1 skipped | nested-checkouts:39 at 600x720 (`.map-legend` absent for 10 s after Explore); ui-1b-header-git:78 (fixed above) |
| 2 | `pnpm test:browser` | 570 / 27 / 1 | 33 / 1 | fresh-workspace:562: the hover loop's first visible branch peek belonged to the neighbouring merge strand |
| 3 | `pnpm test:browser` | 570 / 27 / 1 | 33 / 1 | git-commit-hunk-recorded-work:75: the header Git button never became stable for a click within 90 s |
| 4 | same two passes, traces kept per pass | 569 / 27 / 2 | 33 / 1 | fresh-workspace:1624: the error screen stayed after hash navigation for 10 s; git-typography:21: `.home` never became visible within 90 s after `goto` |

The b2-live reader-anchor test (the item's original failure) passed in all four serial passes.

### What is and is not established

- Every run failed a different set of tests, and every failing test passes in isolation: nested-checkouts and ui-1b-header-git 45 of 45 (5 repeats), and the three run-1 to run-3 failures 32 of 32 (8 repeats, 4 workers, traces kept). Run 4's traces hold no page snapshot (blank page) for the 90 s Home timeout.
- Pattern, NOT VERIFIED as a cause: failures appear only under the full four-worker parallel pass, including a page that does not load in 90 s, which points to resource contention on this machine rather than defects in these specs. TEST-3 chose four workers on 28 Oct when the parallel pass was smaller.
- TEST-2's Accept (three consecutive clean full commands, or a verified cause for every remaining failure) is NOT met. The item stays open.

### Suggested next step (needs Harsh's decision)

Run the full command three times with `DRISHYA_WORKERS=3` (and, if needed, 2) to test the contention hypothesis. If those are clean while four workers are not, record the measured worker count for this machine class in TEST-3/AGENTS.md instead of changing any spec.

