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


## 1 November completion continuation (Harsh with Codex)

The builder explicitly requested whole TEST-2 completion after reviewing Claude's takeover. The existing claim, branch and draft #314 are continued; Claude's committed Git access and fixture repairs are preserved. Current-main integration retains #315's shared graph controls and Fit-settling repair. No History, capture, store or schema source is changed by this continuation.

### Verified recovery and reading-control repairs

| Before | After | Why |
| --- | --- | --- |
| Resetting the screen boundary remounts the retained failed reader before asynchronous bootstrap selects the new destination. The original malformed-response route is requested again and the view crashes a second time. The saved repair also leaves an old error displayed while bootstrap is held, and does not protect navigation Home. | Recovery enters the existing loading state and stops replay before resetting the boundary. Bootstrap then resolves the current destination. The regression holds bootstrap, verifies no old-reader request, checks the original healthy-session assertions and exercises Home recovery. | A failed reader must never render from retained state while navigation is loading. Existing calm loading/error surfaces are reused, with no added motion or chrome (emil-design-eng review). |
| The saved chip gesture selects the first `.captured-result-views`, which can be an empty hidden argument group. Other entry points click result buttons while the new corner handle still clips them; the trace records repeated pointer interception. | Select the exact `Captured result views` group and reveal its handle before normal pointer clicks, including the initial document reader and explicit reading-format disclosure. | Exercise the current supported gesture and preserve literal source, copy, provenance, page limits, viewport and timeout assertions. No force click or timeout increase. |

The held-bootstrap regression fails before the recovery correction and passes three consecutive repetitions afterwards. The complete `check:affected` passes both typechecks and all **97 selected browser cases** across seven files. No related unit test imports either UI component; the full unit gate remains required. The corrected document/CSV files additionally pass **10/10** with action traces retained. An initial focused run (18 passes / one document timeout) is retained, and the traces establish the clipped-control click rather than a document-parser timeout.

### Genuine-session recovery and Git access

Read-only native source copies were imported through redaction into a scratch Drishya home. A malformed reader response is deliberately fault-injected over these genuine sessions; it is not claimed to be malformed native journal evidence. Both source sessions contain the captured file material used by the reader.

| Harness / source prefix | Source bytes | Observations | Operations | Checked widths |
| --- | ---: | ---: | ---: | --- |
| Codex `01a1824b` | 5,011,679 | 1,348 | 317 | 600 / 1440 |
| Claude Code `3a2fb933` | 3,616,835 | 384 | 71 | 600 / 1440 |

All four journeys pass: the Git approval action stays absent while its actual status response is held, then the status resolves; recovery reaches the other genuine session and Home without another old-reader read, page errors or document overflow. Each viewport begins with isolated saved reading state. The first private driver reused the previous viewport's saved open reader and timed out at both second widths; that failed driver run is retained and does not count as product acceptance. Resetting the scratch navigation metadata before each case resolves the driver isolation problem without changing product persistence. Screenshots and numeric results stay private under `.local/`.

### Finished-task gate

Pending on the frozen source: genuine arrival/held-reading checks, one complete type/unit/package gate, and three consecutive complete four-worker browser commands (including the usual one-worker timing-sensitive pass). Previous failed full runs remain recorded above and cannot count towards this streak. No cause is claimed for an intermittent failure merely because it passes an isolated check.

### Traced diagnostic gate and final driver corrections

The first frozen continuation candidate `e139568` passes its frozen install, both types and **1,152 units / one skip (189 files)**. Its traced full browser command fails: parallel **573 passed / 27 skipped / 16 failed**, serial **32 passed / one skipped / one failed**, 1,714.34 seconds. This diagnostic run is preserved and is not part of a clean streak.

Harsh approved **17 files** on 1 November; the main claim records the exact bounded scope. No later production source or dependency changed from the passing unit candidate. The remaining corrections are test drivers and fixture ownership:

- Content-reading tests now activate the same supported controls with Enter, as the existing `expandCard` helper does. Locator-driven pointer scrolling was repeatedly intercepted by neighbouring passage material while hover reading changed allocation. The initial handle-hover repair was insufficient under the full traced workload. All literal text, original/copy, provenance, format, paging, focus and bounds assertions remain. Pointer-specific animation coverage still uses pointer input.
- Each Fresh Workspace and Git evidence journey owns its own scratch repository/App/server. The failed full run recorded HTTP **409** for the next case's first Git snapshot/history read; the daemon's existing inspection guard correctly rejects overlapping reads. Fixture ownership no longer carries a prior case's native work into the next case.
- Prompt morph inspection and the first inspected dialog arrival are paused **when the animation is created**, then sampled at the original times. A runner round trip can exceed the entire short animation; pausing it only after the round trip can sample the already-collapsed end state. All geometry, reversal, duration, keyboard and reduced-motion assertions remain; no production animation changes.
- The shared legacy fixture now makes every concurrent startup GET await the same initial navigation reset. A controlled old/new two-request probe proves the old fixture yields markers **0,1**, while the corrected fixture yields **0,0**. Later reloads retain their saved state because the reset is performed only once per journey.
- Repository navigation explicitly expands a root with ArrowRight when its recorded initial state is collapsed. The original trace has one 32-px root row while expecting the full list above 19,000 px. Every original full-list, virtual-row, keyboard, source and overflow assertion remains. Structured tree-focus coverage now uses the supported 600-px minimum instead of 390 px; the journey and assertions are identical.

After these corrections: **52/52** reader checks (two repeats, four workers), **18/18** Git/morph checks (three repeats, four workers), the unchanged serial material file **4/4**, repository navigation **6/6** (three whole-file repeats), and the controlled reset probe **2/2** pass. The earlier single serial hover failure passes in the unchanged file after fixture correction, but an exact cause for that original hover failure is not claimed from an isolated pass alone.

The standard untraced `pnpm test:browser` acceptance sequence will restart on the final clean candidate, with four parallel workers and the usual one-worker timing-sensitive pass. The earlier traced diagnostic and its failure attachments remain separate. The unit gate is reused only after a Git comparison proves all production paths and the lockfile identical to `e139568`; final typecheck and package verification still run. No assertion or timeout has been relaxed.
