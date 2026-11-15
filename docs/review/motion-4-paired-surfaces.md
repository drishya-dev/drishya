# MOTION-4 — paired click-surface motion

Claimed by Yash with Codex, 11 November 2026. Work in progress; this inventory is not completion evidence. Modern only, existing composition and components; no new design, native policy or evidence behaviour.

## Measured baseline

Normal redacting imports into a disposable Drishya home, genuine Claude Code `rec_39af3c94` (14,545,573 bytes / 747 operations) and Codex `rec_7cb1cda1` (15,023,432 bytes / 1,115 operations), 1440×900. Only animation metadata/counts were printed; no native journal text. Private output: `.local/baseline-motion.log`.

| Surface | Opening | Closing | Finding |
| --- | --- | --- | --- |
| Settings | 200 ms, real dialog remains mounted | 140 ms, mounted through exit | Already paired; inspect interruption and shared timing. |
| Session menu | No running entrance observed immediately after pointer open | 160 ms transitions observed while content remains visible | Check first-frame/first-open behaviour before changing it. |
| Workspace | 200 ms arrival | Section immediately unmounted | Missing return/exit. |
| File peek header close | Shared ReadingDialog owner | Existing modeless delayed close | Check on real peek, reduced motion and reversal. |
| File peek final-tab close | CurrentFileReader directly clears currentFile | Last tab unmounts its reader via that state | Needs the isolated peek-tab lifecycle in SessionWorkspace; UI-28c owns that file. No edit before reservation/merge. |

## Inventory to complete

Session and context menus; native popovers/selects/tooltips; ReadingDialog surfaces (Settings, Usage/details readers, Queued inputs, file evidence/peek, Git, search, Screen); Workspace; Toolbox and MCP drawers; Home filters; native and persisted disclosures/expanders. Mark browser-owned controls and frequent keyboard actions explicitly rather than inventing decorative transitions. LINK-1 hover cards stay excluded until its merge.

### Source-owner map (not a claim of runtime acceptance)

| Surface family | Current owner | Integration needed |
| --- | --- | --- |
| Session/utility menus, workspace actions | `dismiss-menus.ts`, native details, Modern motion rules | Preserve light dismissal/focus; pair first pointer entrance and exit, cancel stale closes on reopening. |
| Card/file context menu | `ProductMenu.tsx`, conditional portal | Retain the same portal through exit; keyboard actions remain immediate. |
| Settings and shared readers | `ProductShell.tsx` / `ReadingDialog` | Retune the shared timing; preserve modal/modeless focus, close ownership and interruption. |
| Usage and Session details | `RecordedUsage` / session utility disclosures | Pair the deliberate disclosure only; no replay on data refresh or remount. |
| Queued inputs, notes, review insights, resource/data/source readers, captured commands/outcomes | Shared ReadingDialog callers | Verify central coverage and each dismissal route rather than editing every caller. |
| Git entry and composer model/effort/attachment menus | Native persistent popovers | Existing allow-discrete CSS; check both directions and global gates. Leave composer.css untouched. |
| Search | `Viewer.tsx`, native persistent popover | Pointer feedback only; keyboard opening stays immediate. |
| Command palette | `WorkspaceNavigation`, ReadingDialog explicitly excludes its animation | Frequent/keyboard navigation remains immediate; do not add latency for decoration. |
| Files peek | Shared ReadingDialog plus `CurrentFileReader` | Header close already retains the dialog; final-tab close/reopen needs the UI-28c-owned file after merge. |
| Workspace | `DeveloperWorkspace.tsx`, conditional section | Retain the real section through pointer exit; reverse re-entry without dropping its state. |
| Toolbox/minimise, MCP and agent drawers | `ModernToolStation`, `Disclosure`, `useSurfaceReflow` | Existing whole-surface reflow; pair deliberate disclosure exits without replaying arrivals. |
| Screen | `ScreenView.tsx`, separately owned native dialog and conditional host | Its native close/onClose path needs its own retained exit; not a ReadingDialog caller. |
| Home filters | Native select controls in `modern/SessionHome.tsx` | Keep browser-owned popup behaviour; verify field feedback and document native ownership. No replacement design in this item. |
| Native title tooltips | Browser-owned `title` | Do not create decorative duplicate tooltips or claim a DOM exit that is not owned by the app. |
| Prompt minimise/expand | UI-28c, existing surface-reflow hook | Wait for UI-28c; preserve its reserved-gap/scroll invariance. Retune shared timing only after integration. |
| History content expanders | Deliberate details / existing card reading | Animate only explicit toggles; do not touch History arrivals/hover or animate paging remounts. |

The shared ReadingDialog has callers in 19 component files: CapturedCommands, CapturedOutcomes, CapturedResources, DelimitedDataReader, DraftRecovery, EvidenceReview, FileHistory, GitHistory, GitReview, LibrarySearch, ProductShell, ProseFiles, QueuedInputs, ReviewInsights, SessionWorkspace, SourceVersions, StepNotes, StructuredDataReader and WorkspaceNavigation. This source map avoids a cross-product sweep of unrelated content/layout changes.

## Dependency decision — 11 November

Opus's later execution order, recorded on main `9f643c76` and confirmed by Yash: MOTION-4 runs last, only after **UI-28c, LINK-1 and the LAYOUT-1b redo** merge. Until then #403 contains this inventory and the genuine baseline only. SHIP-20, SHIP-16's CI workflow, SHIP-21 and SHIP-3 run ahead of it, in that order. This supersedes the earlier UI-28c-only wait below.

Yash chose **leave UI-28c with the actively working Claude session; resume MOTION-4 after its merge**. The local `claude/ui-28c-composer-toggle` branch had fresh commits at 09:31 and uncommitted PromptRail/SessionWorkspace/composer.css edits at 09:36 when checked. No takeover, copying of its uncommitted work or overlapping source edit was made. Draft #403 and the main claim record this wait. This task remains open; no UI behaviour is marked complete by the inventory.

## File boundaries

FINISH-0a/0b reserve shared tokens and overlay owners. Before implementation, reserve only the motion lifecycles in ProductShell's ReadingDialog, ProductMenu, Disclosure, dismiss-menus and Modern motion rules; preserve their contents, layout, focus and selection contracts. Workspace needs its existing mount/return lifecycle. The peek tab close/reopen section of SessionWorkspace needs a separate explicit reservation or the UI-28c merge. Composer gap, composer.css, PromptRail, History arrivals/hover, LINK-1 and ingest lineage remain untouched.

## Acceptance still required

Complete inventory with open/close evidence on both real harnesses at 600/1440 in all three palettes; matching interruptible exits on menu/dialog/popover/drawer/peek; reduced motion and low resource; no delayed captured text or replayed history arrivals; named browser guards and check:affected, two workers, one browser command at a time, no full gate. Opus reviews/merges.

## 14 November continuation and integrated verification

The managed local checkout resumed the published `951b638d` history. The earlier handoff's uncommitted changes were unavailable on this host. The branch integrates `d0243b44` main, including UI-47 and UI-48 loading states, UI-49 narrow chrome, UI-50 formatting, UI-41d mode switching, SHIP-5 questions and LIVE-7a/b.

| Surface | Trigger and paired path | Runtime evidence |
| --- | --- | --- |
| Changes | Header Changes button or explicit return from peek; retained window moves toward the pointer's originating control. Keyboard navigation and Escape are immediate. | Genuine in all six size/palette cells per harness. Fixture proves close, re-open of the same DOM element, restored interaction and mid-exit preference change. |
| Git graph | Git icon to reader and actual scrim; the same window and scrim leave on the panel clock. | Genuine in all six cells per harness. Git graph focus and branch fixture suite. |
| Workspace | Workspace icon or file's Open in Workspace; the same editor surface returns toward that control. Header height for Files comes from layout while Workspace is moving. | Genuine in all six cells per harness. Files/workspace fixture exercises tab and draft preservation. |
| File peek | Files row or reference action opens the reader toward the recorded pointer origin. Closing the last tab uses the same exit as its header button; new file intent interrupts that exit. | Genuine last-tab exit in all six cells per harness. File and checkout routing fixture. |
| Files rail | Files control opens the existing rail; its close button or pointer dismissal retains the real rail through its exit. | Real peek journey uses the Files tree; focused narrow-window and Files/workspace fixture. |
| Settings and Notes | Their existing controls open centered dialogs, which settle back along the same short offset. The native backdrop uses the modal clock. | Genuine in all six cells per harness. Fixture checks Escape, keyboard focus restoration, reduced motion and low resource. |
| Screen | Captured frames or menu entry open the same native viewer from the pointer trigger; the modal backdrop fades on the same clock. | Genuine Claude Code in all six cells. Screen fixtures exercise pointer geometry, loading and reduced motion. Codex Screen evidence is limited to the fixture because no candidate in this local scan contained a supported native computer call. |
| Image reader | Thumbnail or separately approved current file opens the centered native modal; Close, backdrop and Escape use the corresponding path. | Captured-image browser fixture. |
| Shared ReadingDialog callers | Captured commands and outcomes, queued inputs, evidence/insights, file histories, delimited/structured data, source versions, recovery and library search each share the existing chrome, close button and focus lifecycle. | Genuine Commands, Review findings, Prompt overview, Review packet and library search in every size/palette cell for both harnesses. The other callers share that lifecycle; fixture coverage includes captured results and keyboard readers. |
| Session and local menus | Existing summaries and context triggers, including session utility, reading options, worktree picker, Git recorded work, file filters and navigation. Open and close travel from the adjacent edge; closing content stays inert. | Genuine session menu, file context menu and Navigate history in all six cells on both harnesses. Context keyboard fixture. |
| Usage and session details; controlled reading disclosures | Their own summary controls reveal or fold the same panel. Deliberate click sets motion. Saved states, remounts and keyboard activation are immediate. | Genuine Usage and Session details in all six cells per harness. Session menu/keyboard fixture. |
| Search, model, effort, permission, attachments, operation evidence | Each native popup stays on its existing trigger edge. Browser top-layer retention supports reversal and immediate native light-dismiss semantics. | Search genuine in all six cells per harness. Native composer control fixture exercises current modes. |
| Toolbox | 600 px catalog control opens and closes the same right-side station. Minimize/expand morphs the existing dock. Agents, MCP and Run tools use the dock's existing paired recentering so there is one moving surface. | Genuine minimize/expand in all six cells per harness and catalog at 600 px in all three palettes per harness. Catalog and drawer fixture exercise both directions, keyboard, current frame, reduced motion and layout. |
| Composer shell and switch controls | Existing Whole-surface reflow is gated on pointer and shared preferences. Virtual file rows, command palette, native Home selects/title tooltips, text selection and browser-owned menus, direct dragging and copying stay immediate for their existing keyboard, browser or reading contracts. | Shared motion path; named browser fixtures. No app-owned toast surface was found. System notifications use browser ownership. |

Scratch re-import, 600 and 1440 px at 900 px high, Jet Black/Midnight/Daylight. Claude Code `rec_85e4d976`, 7,964,522 bytes, 189 operations, 25 file references. Codex `rec_537e2fc4`, 22,907,838 bytes, 686 operations, 9 file references. The integrated runtime `a803b888` completed 228 genuine open/close pairs across 20 distinct kinds, with zero incomplete. Settings, Notes and Screen used 240/180 ms; windows and the narrow Toolbox catalog 220/160 ms; utility, context and reading menus 180/140 ms; Toolbox collapse/restore 220/220 ms. All 12 file peek timings include the actual 220/160 ms Web Animations starts, even when a long history had already settled by the next sampled frame. The Claude Screen recording has 59 steps and 36 retained frames. The local files and screenshots remain under `.local/motion-4`.

The existing branch had two independent Changes exit owners: the old close path held `aria-expanded` true and the Viewer unmounted the reader when state changed. The regression failed on this combination and passed after the single retained mount. At 600 px the Toolbox catalog had no transition; its new fixture failed before the shared display/scale rule and passed afterward. A generic held disclosure interfered with the Toolbox's existing recentering, detected by its existing paused-animation assertion. Its disclosure stays with the dock owner and the original test passes again.

Draft #403 remains open for the verification limits below. MOTION-3 owns the separate human ten-minute evaluation.

The integrated targeted suite ran 80 tests on two Edge workers: 79 pass and one existing main failure. `toolbox-window.spec.ts:179` at 600 px cannot click Tools over an expanded composer because Attach intercepts the center. The exact locator, interception and timeout reproduced in an isolated, freshly built `d391d73d` checkout using only that test. Both typechecks, the production UI build and 68 related units passed. `check:real -- workspace-files` and `check:real -- computer-frames` also ran and reported the local capture counts only.

The integrated review guards reproduced and fixed four defects before the broad gate. Changes fetched its lazy bundle on ordinary session open, and its delayed first mount could use a later pointer press as its origin. Changes now loads only on first request and snapshots the owning opening coordinates before the chunk resolves. Closed and detached native disclosure actors are disposed even when navigation happens with the keyboard. A pending final-tab peek exit now verifies the recording or checkout and the selected path before updating the tabs or clearing the reader; the regression delivers a competing intent through the real Changes Open on disk action. All eight focused cases passed on the integrated build, and UI-48's four existing browser cases passed with the new wait cards at both widths.

### Full local gate and control

The 600 px catalog now animates only on a deliberate Tools toggle. Crossing the responsive breakpoint immediately hides a closed catalog. A dedicated regression failed before this correction and passed after it, and all six genuine catalog cases at 600 px (three palettes on each harness) retained 220/160 ms open/close timing on `5359e1a0`.

The full local gate used runtime `5359e1a0` and an isolated install. Both typechecks, the production build, 68 related units and `package:verify` passed. All nine paired-motion fixtures passed within the broad run. Browser results on two Edge workers plus one serial worker were 924 passed / 27 skipped / 28 failed parallel and 31 passed / 1 skipped / 3 failed serial. All units reported 1,576 passed / 1 skipped / 2 Git compare timeouts. On isolated rerun one of those two passed. The fingerprint test at `git-compare.test.ts:152` timed out on the branch and on freshly built control `d0243b44`.

- 24 browser failures reproduced at matching assertions or with matching failures on control `d0243b44`: Agent Inventory (2), approval Follow interception (2), conversation switch, fresh Workspace (2), current-image recovery/consent (12), SHIP-2f history, SHIP-6g layers, Toolbox, result scrolling, and paged replay.
- Queue receipt tests at 600 and 1440 hit an earlier pointer interception during the gate. Isolated reruns reached the same zero raised-gap assertion as clean main, and the earlier interception did not recur.
- Jet nested focus and rapid Conversation scroll passed isolated on both branch and control. Their gate failures remain intermittent and unclassified. Two failures at unsupported widths were not pursued.
- The old structured-data assertion checked `transform` and a fixed 140 ms exit after the motion implementation moved to individual `translate` and `scale` properties and a shared dialog clock. Test-only commit `48f7b284` verifies exit from the sampled opacity/translate/scale frame, identifies exits by target opacity, and retains focus, keyboard and reduced-motion coverage. It passed in isolation after the migration.

The full gate remains red. The genuine matrix covers 20 kinds; a native Codex Screen case and some individual shared-reader/composer cases are covered only by fixtures or the verified shared lifecycle. They are not counted as genuine checks. No readiness or release completion is claimed.

### Main integration and final local gate — 14 November

Merged main `cc2340b4` into this branch at runtime `20bf4817`; the earlier `5359e1a0` gate above remains historical. The integrated build retains PERF-4's partial-history handling, Antigravity's read-only identity and referenced-image state, and UI-41e's mode-switch changes. Frozen-lockfile installation and the UI build passed. On this integrated build the same scratch imports of Claude Code `rec_85e4d976` (7,964,522 bytes, 189 operations, 25 file references) and Codex `rec_537e2fc4` (22,907,838 bytes, 686 operations, 9 file references) completed 168 main surface pairs and 60 shared-reader pairs across 600/1440 px and three palettes, with zero incomplete. These are the 20 surface kinds listed above; they do not establish a genuine Codex Screen case or independent genuine coverage for every shared caller. The focused suite passed 35 of 39: all nine paired-motion tests, structured-data tests, wait cards, PERF-4 quiet swaps, captured-image and Antigravity read-only checks passed. Four Conversation-switch failures reproduced at the same assertions and similar geometry on freshly rebuilt clean `cc2340b4`.

The frozen `20bf4817` full local gate ran sequentially: typecheck passed; all units reported 1,716 passed, 29 skipped, 17 failed, plus four failed suite hooks; the rebuilt browser suite on two Edge workers reported 936 passed, 27 skipped, 30 failed, followed by one serial worker with 32 passed, one skipped, two failed; `package:verify` passed. The browser total is 968 passed, 28 skipped and 32 failed. The two serial failures were result scrolling and paged replay, previously reproduced with matching assertions on `d0243b44`; that earlier control is not an assertion that they were independently reproduced on `cc2340b4`.

The four new parallel failures relative to the earlier gate were connected-workspace composer geometry, the Conversation keyboard shortcut, landing-opening repeat visits, and the nested-checkout map legend. Each passed isolated on both clean `cc2340b4` and this branch (four of four on each, two workers); their gate failures did not repeat and remain intermittent, not proven baseline. The prior gate's Jet focus failure also recurred in this gate; its earlier isolated passes on both revisions do not establish its cause. The other earlier failures were compared as documented above against `d0243b44`, not all rechecked against the newer main. Two unsupported-width failures were not pursued.

In clean `cc2340b4` control, all eleven Antigravity/ingest assertions from the integrated unit gate reproduced at matching tests and assertions: artifact versions and live transitions, discovery, media, review artifacts, and checkpoint state. Discovery includes an 8.3 versus long Windows path mismatch; this is an observation, not a proven cause of the other failures. The six remaining unit failures concern Git/checkout timeouts; four suite hooks also timed out or failed cleanup. They were not all reproduced on the newer control. No unrelated owners were changed.

The existing computer-frames case explicitly skips Codex. A separate metadata-only scan examined 109 local Codex journals for the direct computer MCP and browser-batch action shapes recognised by `screenRun`; it found zero matching calls or actions. It does not establish that unsupported `cua_repl` or node-repl computer calls are absent. The available computer-use route has not been shown to produce a recognised native Codex Screen capture; the Codex Screen result remains fixture-only and a genuine case is an external acceptance limit. Logs and screenshots remain local. No hosted gate, broader release verification, or readiness is claimed. The full gate is red. The additional tests below record the remaining verification and capture limits.

### Genuine Codex Screen capture follow-up

A real Codex CLI turn used a local browser MCP on a disposable page. It took a screenshot, clicked, and took another screenshot. The native journal remained read-only to Drishya. The scratch import `rec_6fdb2eb3` (254,690 bytes) had seven projected operations and three Screen steps. The two screenshot images were retained with bytes on the Code Mode wrapper operations, so the Screen run had zero associated frames and zero placeable markers. The same counts were reproduced on clean `cc2340b4` and `79145192`. No browser Screen journey could start for this capture. Frame association for this Codex tool format remains capture work under the existing SCREEN-1/NATIVE-5 boundary. Claude Code Screen has genuine 600 and 1440 px coverage, and Codex Screen motion is fixture-checked.

### Independent gate and test follow-up — 15 November

The independent gate ran on `f580a7b9`, with a clean-parent comparison at `e45cc6b1`. Both worktrees had their own frozen install. The elevated runner's default temporary path differed from its canonical Windows spelling. The runner used the canonical spelling for `TEMP`, `TMP` and `TMPDIR` in both worktrees. A focused image test still failed earlier at workspace access with the short spelling. That comparison did not explain the later retry timeout in the full gate.

- Typecheck and the production builds passed. The two-worker unit rerun passed 1,769 and skipped one. The first units command had a misplaced argument separator and did not establish the intended worker limit. It reported five timeouts and two cleanup errors. The four affected Git files passed 37 tests on the clean parent.
- The rebuilt browser gate on Edge, two parallel workers followed by one serial worker, reported 985 passed, 27 failed and 28 skipped. All nine paired-surface cases passed. The focused clean-parent run matched eleven browser failures. It reproduced the exact `p1-pacing.spec.ts:758` empty loading-status assertion. The older control log does not contain that exact assertion. Approval and queue hit-test failures recur, including matching historical clean-main interceptions. Two failures exercise standalone widths below the supported minimum.
- `package:verify` checked the installed tarball successfully, then reported two failing executable-selection assertions in its security suite. The same two assertions failed on the clean parent. The repository gate remains red.
- The eight website cases all tried to serve a missing `apps/site/dist/index.html`. The root browser command built `apps/ui` and left the separate website unbuilt. Both isolated worktrees built the synthetic site using `corepack pnpm --filter drishya-site build`. All eight website cases then passed on each revision. The browser runner itself is unchanged in this PR.
- The Toolbox geometry test could observe the compact box after the animation ended. A controlled delay reproduced a 116 px deviation on both candidate and clean parent. The fixture now holds the Toolbox animation at creation using the same guard as the composer. The original 1.5 px geometry assertion still fails when the animation is cancelled. The candidate's path-image retry timed out in the full gate and passed focused on both revisions. The focused synthetic trace showed separate fetch and image requests on retry and the expected decoded width. Its original gate timeout remains unexplained.

On test-only follow-up `3ce8b632`, the independent verifier passed 21 focused cases on Edge with one worker and zero retries: eight website cases, nine paired-surface cases, both reflow cases, composer draft geometry and corrupt-image retry. The clean parent's eight website cases passed in the same configuration. The full gate was not rerun after the test-only change. The Conversation mode fixture and early Escape persistence repairs are separate [#503](https://github.com/drishya-dev/drishya/pull/503) and [#504](https://github.com/drishya-dev/drishya/pull/504) work. The genuine Codex Screen frame-association limit above still applies. #403 remains draft.

### Gate repair and Codex frame ownership follow-up

The site HTTP failures were a missing build prerequisite. [TEST-5 #506](https://github.com/drishya-dev/drishya/pull/506) wires the synthetic website build into the normal browser command, preserving both Playwright passes. An independent run produced the site and passed all eight cases. [TEST-6 #507](https://github.com/drishya-dev/drishya/pull/507) aligns the pending-input fixture with SHIP-5's “Needs an answer” state and checks 600 and 1440 px while retaining the original answer and prompt-absence assertions. Both repairs stay separate from MOTION-4.

The two Windows packaging assertions exercise selection of the installed Git and GitHub CLI executables. They indicate a defensive executable-resolution defect; those daemon files overlap [SEC-4 #505](https://github.com/drishya-dev/drishya/pull/505). Browser issues with responsive chrome overlap, search popover dismissal, Conversation anchoring, replay loading status and several history or Toolbox fixtures remain open. The earlier full gate remains the last full result.

A private shape-only scan of the same genuine Codex recording confirmed three completed computer calls with recorded arguments and two images directly nested in the corresponding child results. Wrapper copies exist separately. The child results establish frame ownership. The typed completion contract lacks fields for those arguments and image candidates. NATIVE-5a is claimed to preserve this evidence through the existing privacy pipeline. Both builders must agree on extending the observation format. The existing genuine browser recording is sufficient to check this path after implementation.

The local integration checkout at `85b2fa5e` combines MOTION-4 and the source changes from #503, #504, #506 and #507. The checkout uses its own frozen install. Its independent Edge run with two parallel workers and zero retries passed typecheck and 33 focused browser cases, including all nine paired-motion tests. The integration checkout is for local verification. Draft #403 remains open for the outstanding browser, packaging and real Codex Screen acceptance.
