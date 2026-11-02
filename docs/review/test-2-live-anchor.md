# TEST-2: live reader anchor stability

Status: verified repairs integrated with current main; three clean full commands remain required. Task remains open. Claim pushed on main in 289ae6f before branch work. Branch harsh/test-2-live-anchor has its own frozen pnpm install.

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


## 2 November: three blocking failures, trace-first continuation

Harsh explicitly continued draft #314 on the same branch. The existing 25-file ceiling remains. The builder now requires **three consecutive clean complete browser commands**, without the earlier cause-only alternative. No retries, relaxed assertions, timeout increases or hidden failures. Main through audit #317 and merged LIVE-5/UI-17 is integrated before acceptance.

| Before | After | Why |
| --- | --- | --- |
| Home applies recordings/discovery/storage only after every endpoint settles. | Apply each result on settlement; accumulate endpoint errors in the existing combined line. A revision rejects obsolete refreshes. | Pending disk accounting must not withhold sessions or their journal-update marker. |
| Concurrent refreshes each walk the store. | Per-server shared in-flight Promise and a two-second successful advisory cache; failures are never cached. | Avoid duplicate asynchronous disk walks without changing consent, symlink handling or claiming measured daemon latency improvements. |
| Files test chooses approval before readiness. | Wait for the permission action or the readable README row. | Preserve all preview, double-click and kept-tab assertions. |
| Late keyboard-reading navigation can overtake an explicit card action. | Control focus invalidates pending reading work; Escape cancels even while no card is focused yet. | Prevent late navigation from closing a newly expanded card or stealing focus before Enter. |

### Proven Home and Files behavior

- Held-storage regression fails before the Home correction (journal marker absent), passes afterwards while storage remains unresolved, and preserves both the discovery warning and useful row when released storage fails.
- Files preview/navigation: **24 passed / zero failed, four workers**, no retries.
- Both storage units pass. The new regression checks shared Promise identity, cache expiration, fresh accounting, and recovery after an uncached failed walk.
- Genuine scratch imports: Codex **01a1824b, 5,011,679 bytes / 1,348 observations**; Claude **3a2fb933, 3,616,835 bytes**, 384 observations before integration / 392 with the current reducer. One genuine complete row was appended only to each scratch copy (758 / 83 bytes), after import. At **600 and 1440 px**, both rows and both journal-update markers render with storage pending, zero page errors or horizontal overflow. The private driver supplies discovery metadata for those actual scratch copies; standard-directory discovery is not claimed. Native journals remain read-only and screenshots stay private.

### Expansion: actual trace evidence

Private instrumentation synchronously subscribes to every expandedOp change with timestamps/writer stacks, and observes button mount identities, DOM replacement, focus, keys and clicks. The actual card toggle and Enter/assertion helper remain unchanged during diagnosis.

| Diagnostic | Result |
| --- | --- |
| Complete instrumented parallel pass, four workers | 588 passed / 27 skipped / two failed. Expansion case passed. Palette failure is the diagnostic build preserving #000000 instead of normal CSS minification to #000. Workspace shared-draft line-1200 navigation is retained, cause unresolved. |
| Unchanged collection expansion, 24 repetitions at four workers beside 16 CPU workers bounded to 120 seconds | 23 passed / one failed. Reporter omitted its in-memory attachment body; retained but not used for attribution. |
| Same command, corrected trace persistence | 22 passed / two failed; both failed traces retained privately. |
| Two controlled held-reading-target regressions | Both fail before correction; both pass afterwards. |
| Same CPU-load diagnostic after correction | 24 passed / zero failed. Whole run extended beyond the 120-second burner bound; no constant-load-for-every-case claim. |

First failed trace: the same button **mount 1** is focused at **2642.8 ms**, receives Enter at **2650.7**, click at **2651.4**, keyup at **2675.8**. expandedOp goes null -> operation at **2652.6**, then operation -> null at **2678.1**. The closing stack is ReadingKeys' awaited navigation -> History's navigate callback (original line 690), **25.5 ms after expansion**. There is no button replacement, second toggle, reload, select() call or stale expanded closure.

Second failed trace: mount 1 is focused at **2066.8 ms**, a pending reading navigation focuses its article at **2069.4**, and Enter reaches that article at **2071.2**. No expandedOp write occurs; the button was not replaced.

The verified cause is **pending keyboard-reading navigation**, closest to candidate (c), but not the suggested reload/selection writers. Button focus did not invalidate pending g/j work, and Escape returned early before queued work had focused any card. The product fix changes ReadingKeys cancellation; History and the toggle are unchanged. Both held-response regressions retain the expanded/focused assertions after the response and two rendering frames. The temporary helper instrumentation is saved privately and removed from the final source.

Also retained, excluded from acceptance: invalid diagnostic injection/build, shell quoting that selected no tests, and an edit-script encoding failure followed by a stale-build run. No such run is counted as passing fixed-source evidence.

### Final integrated gate

Candidate b607f95: own frozen install, both typechecks, UI build and package verification pass; **192 unit files / 1,174 units pass, one skipped**. The first genuine integrated driver run passes both Home widths but fails all four delayed-reading journeys; its broad first-card locator is being diagnosed, with failures retained. It is not accepted as a product pass.

Pending: final genuine delayed-reading acceptance and **three consecutive normal complete browser commands**, four parallel workers plus the standard one-worker serial pass. Every complete command, including failures, will be recorded here. TEST-2 stays unchecked and #314 stays draft until the strict streak passes.


### First three-worker attempt: not accepted; atlas readiness/targeting defects proven

The four-worker full command on 9bf3a0f failed: **605 parallel passed / 27 skipped / two failed**, **33 serial passed / one skipped**, exit 1, **623.97 seconds**. The failures were B4's already-handled route and Claude delegation's failed fetch before History. Both subsequently passed **24/24 unchanged diagnostic cases at four workers**. Their precise causes remain unverified; isolated success is not attribution.

The first three-worker attempt on that same commit is fully retained:

| Run | Parallel | Serial (one worker) | Exit | Seconds |
| --- | --- | --- | ---: | ---: |
| 1 | 607 passed / 27 skipped / 0 failed | 33 passed / 1 skipped / 0 failed | 0 | 780.22 |
| 2 | 607 passed / 27 skipped / 0 failed | 33 passed / 1 skipped / 0 failed | 0 | 945.36 |
| 3 | 606 passed / 27 skipped / 1 failed | 33 passed / 1 skipped / 0 failed | 1 | 944.28 |


The third run fails the existing Fresh Workspace atlas case at its first merge-commit assertion. Its failed frame still shows the enabled Git approval action, with no Git error. The test checked approval visibility once while access could still be unknown, then never returned to approve.

A controlled desktop driver holds the actual Git-status response through that decision: the old decision is **false**, release exposes the approval action, and the original merge-commit assertion fails. The counterpart waits for known permission state, then approves and passes the same assertion. No product change, retry, longer timeout or weakened assertion is involved.

After adding that readiness guard, the original complete atlas case passes **21/24 at four workers**. All three retained failures are later in its branch-hover probe: it stops at the first visible tooltip, which names **atlas-merge**, while the unchanged assertions correctly require **atlas-feature**. This is the earlier recorded neighbouring-strand driver defect, not a failed text assertion to remove.

The driver now settles Fit's layout and performs **one pointer move** to the midpoint between the fixture's rendered base and feature endpoints, matching the actual feature strand's parent edge. The offset-probing loop is removed. Visibility, exact feature-branch/commit text, geometry, topology, patch, clipboard and original timeout assertions remain. The whole original atlas case then passes **24/24 at four workers**.

These are test-only corrections in the already-approved Fresh Workspace file. The application/packages/lockfile are identical to fully checked b607f95, so the passing types, 1,174 units/one skip, build/package and six genuine journeys remain valid. The two clean commands above are **not** borrowed: the strict streak restarts from zero on the newly sealed candidate.

The earlier predecessor standard command a9dda1f is also retained: parallel **586 passed / 27 skipped / two failed / one timed out**, serial **33 passed / one skipped**, exit 1, **652.57 seconds**. Those are the three initial blocking cases this continuation repaired.


### Manual execution handoff (2 November)

Harsh elected to run the gate himself and return the output. The automatic attempt on 9236f13 is **interrupted, not accepted**. Windows Power-Troubleshooter reports sleep **18:15:51–18:30:54 IST**, and Kernel-Power records **Button or Lid**. That run includes ERR_NETWORK_IO_SUSPENDED and two 90-second timeouts; no software cause is inferred for each timeout. Its partial log and power-event fields remain private. The owned gate process tree was stopped for handoff; no other application/agent session or power setting was changed.

The prepared local manual command runs the unchanged full browser command three times at DRISHYA_WORKERS=3, with the normal one-worker serial pass. It saves unique per-run logs, summaries and result metadata; stops on the first nonzero exit; and restores its process environment afterwards. No retries, larger timeouts, new skips or relaxed assertions. The whole completed script was parsed without running another suite. **No three-clean-run claim, TEST-2 checkbox or ready-for-review transition is made until Harsh returns the results.**

## 2 November takeover (Yash with Claude)

Yash took this over so the runtime fixes stop holding `Home.tsx`, `GitHistory.tsx`, `ReadingKeys.tsx` and the specs the language sweep needs. Harsh's manual three-run command was not waited for.

Merged with current main 55d1aa81 (UI-20, UI-23, DATA-13). Four-worker command on that tree: parallel 606 passed / 27 skipped / one failed; serial 32 passed / one skipped / one failed. All units 1,183 passed / one skipped; package verification passed.

| Failure | Status |
|---|---|
| compaction:67 | Cause found: `Summary` kept `open` in component state, so a row remount closed the summary mid-read and the next-lines assertion saw the closed form. Open summaries now survive a remount. 20 of 20 at four workers. |
| b2-live:63 | Still open, cause NOT VERIFIED. The same 5 px family already fails on clean main (recorded 31 October). |

The strict acceptance (three consecutive clean complete commands, or a verified cause for every failure) is not met, so TEST-2 stays unchecked. The branch lands because every failure left reproduces on clean main, which AGENTS says does not block.


## 2 November: returned manual results and the source-reader readiness fix

The manual command ran all three commands on d00fcc1 with three parallel workers and the normal one-worker serial pass. The first two were clean; the third was not. No clean commands are borrowed across that failure.

| Run | Parallel | Serial | Exit | Seconds |
| --- | --- | --- | ---: | ---: |
| 1 | 607 passed / 27 skipped / 0 failed | 33 passed / 1 skipped / 0 failed | 0 | 965.4 |
| 2 | 607 passed / 27 skipped / 0 failed | 33 passed / 1 skipped / 0 failed | 0 | 977.66 |
| 3 | 606 passed / 27 skipped / 1 failed | 33 passed / 1 skipped / 0 failed | 1 | 966.91 |


The only failing case is workspace-shared-draft's jump to line 1200. Its final frame has the file loaded, which did not establish that it was loaded when Enter arrived. Private numeric instrumentation preserves render, input/submit, scroll-writer and observer timing without printing source bodies.

- Unchanged sequence, four workers: **48/48 pass** without extra load. No cause inferred from that pass.
- Same sequence, 24 repetitions/four test workers beside 16 CPU workers bounded to 120 seconds: **94 passed / two failed**. In one failed trace Enter arrives at **1417 ms**; the first 1,200-line render follows at **1424.1 ms**. In the other, Enter is **1325.8 ms**, first render **1345.4 ms**. Neither records a submit, scroll write or line-reveal request; activeLine remains unset. This is not a scroll position being reset after a successful reveal.
- A held actual file-response proof confirms the state: **Go is disabled** while the file is pending. The original early Enter produces **zero submits** and fails the original line-1200 assertion after release. Waiting for Go to become enabled produces **one submit** and passes that same assertion. This is a test readiness race; the product already exposes the correct disabled state.
- The proposed readiness assertion in the private copy then passes **96/96** under the same bounded-load setup. The complete run outlasts the 120-second burner; constant load for every case is not claimed.

Harsh approved a **26-file final ceiling** on 2 November, including the additional Workspace spec and required completion documents. Before the tracked edit, the whole TEST-2 continuation was claimed on main in **6609d97**, branch **codex/test2-source-readiness**. Yash had already merged #314 and later main changes while the manual command ran. The follow-up uses current main a96fa40 plus that docs-only claim, preserving the merged implementation rather than changing the closed PR.

The tracked change is exactly one readiness assertion: after filling 1200, wait for the existing Go button to be enabled, then press Enter once. The expected line text, fewer-than-150 mounted rows, search/wrap, draft retention, file bytes, and original timeouts remain. No retry or product change.

**Current-main verification:** own frozen install and normal UI build pass; check:affected passes both typechecks and all four named browser cases. The complete Workspace file passes **96/96 at four workers** (24 repetitions). Temporary instrumentation is absent from the normal build. This test-only correction adds no native-session acceptance claim.

**Still pending:** three consecutive complete commands on the follow-up candidate, run manually by Harsh. TEST-2 remains unchecked and claimed; the follow-up stays draft. The clean-main five-pixel b2-live anchor is still recorded separately, without a newly invented cause.


## 2 November: second returned manual streak, Pin range failure

Harsh ran the prepared command on **a00af7b**, with three parallel workers, one serial worker and zero retries. The first two complete commands pass; the third fails. All three actual results are retained; the streak resets again.

| Run | Parallel | Serial | Exit | Seconds |
| --- | --- | --- | ---: | ---: |
| 1 | 613 passed / 27 skipped / 0 failed | 33 passed / 1 skipped / 0 failed | 0 | 606.03 |
| 2 | 613 passed / 27 skipped / 0 failed | 33 passed / 1 skipped / 0 failed | 0 | 587.61 |
| 3 | 612 passed / 27 skipped / 1 timed out | 33 passed / 1 skipped / 0 failed | 1 | 629.69 |

The sole failure is `product-workspace.spec.ts:344`, source references reject oversized text, preserve derived provenance and clear on replay seek. The original 90-second test timeout expires at line 364 waiting for Pin range. The line-1200 Workspace case and the serial B2 anchor pass all three returned commands. Git LF/CRLF and SQLite experimental notices are warnings, not the failure.

The manual command preserved error context but no browser trace. A private copy of the unchanged failing test, with reader/disclosure event instrumentation and retained failure traces, reproduces **four failures / 20 passes at four workers**. In those failures the same reader and closed disclosure remain mounted, with no summary activation or open-attribute change. One captured action scrolls History from 0 to 8 to 289 px, targets the summary at y=423.25, then ends back at History scrollTop 0 with the disclosure closed. Earlier hit tests intersect the timeline footer. This establishes a missed pointer activation across a scroll change; the exact reset writer remains under investigation.

Additional unchanged diagnostics pass: geometry-and-writer sampling 12/12; pointer-target sampling 24/24; light event sampling 24/24; bounded-load light sampling 24/24 (16 CPU workers bounded to 120 seconds, stopped when tests finish); click-target sampling 48/48; outside-click-only sampling 24/24; private instrumented writer build 24/24. These are diagnostic results, not acceptance, and do not establish a cause or fix. One initial load-helper invocation selected no tests because of an argument-quoting error; it is not counted as a test run.

**At the initial diagnostic checkpoint, no tracked product or test change had been made for this failure.** No retry, timeout increase, relaxed assertion or additional skip. The follow-up remains draft #331; TEST-2 remains claimed and unchecked. The original five-pixel B2 cause is still unverified.


### Verified writer and native-boundary correction

A normal-build setter-only trace reproduces **one failure / 47 passes at four workers**. Its failing scroll writes at 1761.2 and 1838.5 ms set History to zero from `setScrollTop` -> `restoreReading` -> the History layout effect. The compiled caller is the explicit `readingAtStart` branch, not a reader remount, stale expanded closure or duplicate disclosure toggle. A separate private writer build (24/24 pass) exposes the same path even in successful cases: native positions 8 and 289 are remembered while both `navigating` and the old start flag remain true; the layout effect then writes zero.

`onScroll` marks navigation active before remembering the position. The old `rememberReading` expression preserved a previous start flag for any active navigation, including a later native focus/scrollIntoView moving down. The correction preserves the upward start intent only while the position is not moving down relative to the last observed scroll. The original source-reference test, native pointer clicks, all content/provenance/pinning assertions and timeouts are unchanged. No keyboard substitution, force-click, retry, longer timeout or new skip.

| Before | After | Why |
| --- | --- | --- |
| A stale start boundary could undo a later native scroll and move a source control during its pointer action. | A downward native scroll supersedes the start boundary; upward navigation retains its start intent. | Keep the real control at the reading position the browser just selected. |

The exact new tracked regression centers the loaded source summary with native scrollIntoView, samples the resulting position, crosses two render frames, requires that exact position to remain and opens the disclosure with a real pointer click. With only the boundary expression reverted, **it fails: 289 expected, 0 received**. After restoring the fix and rebuilding, the same test passes. The normal restored build is the final candidate; temporary writer instrumentation is absent.

Verification on the fixed source:

- Unchanged original failing sequence: **96/96**, four workers.
- Exact tracked new regression plus the untouched original case: **48/48**, each repeated 24 times at four workers.
- Complete affected Workspace spec: **35/35**; B2 plus manual-scroll, run serially: **5/5**. This does not identify the earlier five-pixel B2 cause.
- Both typechecks, normal UI build and **17 relevant units / four files** pass. Ingest, storage and packaging did not change; no fresh package or complete-suite pass is claimed.
- Controlled held native pointer diagnostic on the old source: **24/24**, with unchanged control positions during the hold. It did not support the focus/remount candidate.

Genuine copies: Codex **01a1824b**, **5,011,679 bytes / 1,348 observations / 317 operations**; Claude Code **3a2fb933**, **3,616,835 bytes / 392 observations / 71 operations**. The final private navigation check passes **all four Modern journeys**, both harnesses at **600 and 1440 px**: leave the start through native scrolling, retain a nonzero reading position, activate/retain the actual expanded card, no page errors or horizontal overflow. Codex also passes both Classic widths. These are screen-state/bounds checks with frames saved only in `.local/`; no native material or frames are attached to the PR. This is genuine History navigation acceptance, not a claim that these captures contain the synthetic oversized Pin range fixture.

Limits and failed private attempts are retained: two early extra-shell runs each gave **5 passed / three failed**. That driver selected the distinct older `legacy` experience and initially used a fixed wheel distance that did not cover the long Codex history. The matching `classic`/Modern driver gives **six passed / two failed**, both with ordinary entry and with explicit at=end entry. In each, the two failures are Claude Classic initial-card visibility, before the boundary assertion; this extra retained-shell case remains **unverified**, with no new product cause invented. All four required Modern journeys pass in those checks; no six-of-eight result is described as eight clean journeys. Private artifacts stay local.

**Whole TEST-2 is still open.** The second manual streak failed and cannot be counted toward a clean streak for this new candidate. Draft #331 records both repairs and all failures. Harsh's manual runner still uses three parallel workers, one serial worker and zero retries. No automatic complete-suite command was started, no worker-count certification was added to AGENTS/TEST-3, and no TEST-2 completion checkbox or claim removal is made.
