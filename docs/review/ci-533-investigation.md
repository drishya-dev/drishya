# Release CI investigation

Investigation recorded on 18 November 2026 for PR #533 and [CI run 44157728815](https://github.com/drishya-dev/drishya/actions/runs/44157728815).

## Source

The investigation worktree was updated from `1dcc3e1e` to main commit `7e68959dbaaaa0f14f23ef4ec0876e84e9a8697f` on branch `codex/investigate-release-ci`. Its independent `corepack pnpm install --frozen-lockfile --offline` succeeded, and the production UI was rebuilt.

The failed run used PR #533 commit `0d3037ca4a0d39cfe566771d6e64ce52ffb66c4e`. Compared with this main commit, that PR changes only `pnpm-workspace.yaml` and `docs/decisions/log.md`. The investigated application code and tests are identical. The advisory exception does not change these tests or the product implementation.

## Findings

### macOS package verification fails during fixture setup

The first security invocation passed all five cases in `tests/security/16-git-store-boundary.test.ts`. The second invocation, inside `package:verify`, failed at line 36 while writing `.git/worktrees/w/gitdir` in a synthetic repository. Node returned `ENOENT`. The test had just created the parent directory and written the checkout's `.git` pointer. It had not reached `verifyOwnGitDir(work)` or its rejection assertion.

The failure therefore establishes a missing fixture directory before the security check runs. It does not establish a guard failure. Four isolated Windows invocations passed all five cases each. One native Ubuntu invocation passed all five cases. The process or filesystem condition that removed or invalidated the directory remains unconfirmed. No physical macOS environment was available for local reproduction. The next useful macOS diagnostic is to record directory state after each fixture operation and trace directory removal during the failing invocation. A maintenance process is a hypothesis that still needs evidence.

### Prompt-history keyboard focus remains unresolved

Ubuntu failed the three-prompt case in `collection-surfaces.spec.ts`; macOS failed the 300-prompt case. After Home or End, the expected prompt button was inactive. One macOS retry could no longer find the final virtualized row. The failure snapshots do not identify the active element or the focus event sequence, so they cannot establish which operation removed or took focus.

The original cases passed four Windows runs and four Ubuntu runs, with two workers and zero retries. The entire eight-case collection spec also passed on Ubuntu in its original order with one worker. Six additional instrumented keyboard runs passed with a six-times CPU slowdown applied after setup. These results leave the CI trigger unresolved. An earlier experiment that slowed the whole page failed at workspace setup, which is a different failure and is excluded from the focus evidence.

The next useful failed-run artifact would contain focus-in/out events, the active element at each Home/End, and the requested row's mount/removal sequence. Increasing the focus assertion timeout has not been established as a remedy.

### File-reader resize uses stale desktop geometry

macOS failed the file-reader case in `fresh-workspace.spec.ts` after resizing the viewport. The test immediately read `boundingBox()` and expected the reader's right edge to fit inside 390 px. It received 1232 px. This case also retains a width below the supported 600 px minimum.

A controlled experiment used a supported 600 px window and delayed resize callbacks by 150 ms in a disposable Ubuntu test copy. Before resizing, the reader had x=872 and width=360. The immediate measurement retained those values, giving the same right edge of 1232 px as CI. Once the callbacks completed, it had x=12 and width=576, giving a right edge of 588 px. The geometry assertion passed when it waited for the supported window bounds.

This reproduces the stale-layout measurement mechanism. The test needs supported widths and an assertion that waits for the resulting layout. The experiment changed only temporary test copies. No reader implementation was changed.

### Prompt-rail resize assertion also reads immediately

The third persistent macOS parallel failure is `prompt-timeline.spec.ts`. It measured the rail bottom at 786 px while requiring at most 745.859375 px to clear the Tools control. Like the reader test, it samples geometry immediately after `setViewportSize`, and its width loop includes 390 px.

The production rail calculates control clearance in layout and resize observers. Immediate measurements can precede those updates. Supported-width experiments at 1440, 900 and 600 px passed on Ubuntu, including the controlled resize delay. The precise macOS overlap was not reproduced. A synchronized bounds assertion at supported widths would distinguish transient measurement from a persistent overlap.

### Serial reading test fails before switching modes

The macOS serial case in `conversation-switch.spec.ts:133` failed its setup check. It requested a position near 82 percent of the history but measured approximately 5.43 percent, below the required 70 percent. The Work-to-Conversation click had not happened yet.

Its `placeNear` helper sends a wheel input, sets a proportional scroll position, waits fixed intervals, and aligns a rendered passage. It does not verify the final fraction before returning. Paging, saved reading state and scroll updates are possible contributors, but the artifact does not identify which changed this run's position. The original case passed in isolation on Ubuntu with one worker and zero retries. The next diagnostic should record the scroll fraction and loaded extent after each setup operation.

## Outcome

The source is current and the file-reader measurement race has a controlled reproduction. The missing Git fixture directory, the CI prompt-focus trigger, the exact prompt-rail overlap and the serial setup drift require additional failing-run diagnostics before assigning definitive causes or declaring fixes. Physical macOS acceptance remains pending.

The investigation used synthetic recordings and disposable stores. Browser artifacts and temporary diagnostic scripts remain in ignored local storage. No product fix or CI skip was introduced.

## Repair follow-up

Issue #534 tracks the fixes and diagnostics. The two resize tests now use supported widths and poll their complete bounds assertions while the resize handlers settle. The reader keeps its content and edge assertions, and the rail keeps its clearance assertion against Tools.

The collection and conversation-switch specs collect bounded DOM diagnostics. On failure they attach active-element and focus-call information, prompt-row removal events, scroll extents and staged reading-position samples. Recorded text and input values are omitted. The Git boundary fixture logs directory existence after each setup operation and watches changes to its worktree metadata. The security assertions are retained.

Initial Windows checks passed the root TypeScript check, all five Git boundary cases, and the four affected parallel browser cases at two workers without retries. Cross-platform CI will establish the results for this repair commit.

## Shared-draft selection follow-up

[Run 44223516026](https://github.com/drishya-dev/drishya/actions/runs/44223516026) passed all three check jobs and the Ubuntu and Windows browser jobs. The repaired resize cases and the collection prompt-focus cases passed on macOS as well. Its browser job failed the CR shared-draft case on all three attempts. After the first pane changed the shared draft, the test refocused the second editor and immediately compared the document selection with its previous selection. It received an empty string. The serial four-pixel reading-offset miss passed on retry.

CodeMirror retains its editor selection separately from the native DOM selection. Its focus handler schedules an update, and its selection observer explicitly handles browsers resetting the DOM range to the start on focus. The assertion sampled that range without waiting for restoration.

A controlled focus reset reproduced the same empty-string failure while CodeMirror's retained anchor and head remained 0 and 30. Waiting for the selection to return to the second editor passed the same control for LF, CRLF and CR files, including the subsequent cross-pane synchronization, undo/redo and downloaded line-ending assertions. The persistent test now polls for that exact selection within the second editor. The temporary focus-reset injection remains in ignored scratch storage.

The updated regression passed all three line-ending cases on Windows and all three on native Ubuntu, with one worker and zero retries. The root TypeScript check passed. macOS verification of this follow-up remains pending.
