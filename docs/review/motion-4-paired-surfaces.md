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

On test-only follow-up `3ce8b632`, the independent verifier passed 21 focused cases on Edge with one worker and zero retries: eight website cases, nine paired-surface cases, both reflow cases, composer draft geometry and corrupt-image retry. The clean parent's eight website cases passed in the same configuration. The full gate was not rerun after the test-only change. The Conversation mode fixture and early Escape persistence repairs are separate #503 and #504 work. The genuine Codex Screen frame-association limit above still applies. #403 remains draft.

### Gate repair and Codex frame ownership follow-up

The site HTTP failures were a missing build prerequisite. TEST-5 #506 wires the synthetic website build into the normal browser command, preserving both Playwright passes. An independent run produced the site and passed all eight cases. TEST-6 #507 aligns the pending-input fixture with SHIP-5's “Needs an answer” state and checks 600 and 1440 px while retaining the original answer and prompt-absence assertions. Both repairs stay separate from MOTION-4.

The two Windows packaging assertions exercise selection of the installed Git and GitHub CLI executables. They indicate a defensive executable-resolution defect; those daemon files overlap SEC-4 #505. Browser issues with responsive chrome overlap, search popover dismissal, Conversation anchoring, replay loading status and several history or Toolbox fixtures remain open. The earlier full gate remains the last full result.

A private shape-only scan of the same genuine Codex recording confirmed three completed computer calls with recorded arguments and two images directly nested in the corresponding child results. Wrapper copies exist separately. The child results establish frame ownership. The typed completion contract lacks fields for those arguments and image candidates. NATIVE-5a is claimed to preserve this evidence through the existing privacy pipeline. Both builders must agree on extending the observation format. The existing genuine browser recording is sufficient to check this path after implementation.

The local integration checkout at `85b2fa5e` combines MOTION-4 and the source changes from #503, #504, #506 and #507. The checkout uses its own frozen install. Its independent Edge run with two parallel workers and zero retries passed typecheck and 33 focused browser cases, including all nine paired-motion tests. The integration checkout is for local verification. Draft #403 remains open for the outstanding browser, packaging and real Codex Screen acceptance.

### Takeover and final targeted verification — 15 November

Yash moved MOTION-4 from Harsh to Claude Sonnet 5.5 on 15 November so it can merge before the 18 November release. Main `147b21d8` merged cleanly into the branch (no conflicts; OWNERSHIP.md, README, STATUS and TASKS only). Fresh frozen install; both typechecks, `ui:build` and the synthetic website build (`corepack pnpm --filter drishya-site build`) passed. `apps/ui/test` reported 667 passed, 1 skipped, 130 files (two reruns). The first run showed one failure in the Antigravity passive-question unit; it did not repeat in three further runs, so it is a cold-transform flake, not this branch.

Browser, Edge, two parallel workers, UI rebuilt first: `paired-surface-motion`, `connected-workspace`, `fresh-workspace`, `structured-data` and `toolbox-window` ran 120 tests: 115 passed, 5 failed. All nine paired-surface tests, the connected-workspace and structured-data cases passed. The five failures were rerun alone on a freshly built clean `origin/main` worktree with its own install:

| Failure | Branch | Clean main | Class |
| --- | --- | --- | --- |
| `fresh-workspace` Modern composer keeps its target and state visible (received 2131.7 where < 1 expected) | fails | same value | Baseline |
| `fresh-workspace` tool cards retain visible results (`data-state` expected focused, received empty) | fails | same assertion | Baseline |
| `fresh-workspace` real pending-input shape ("Answer requested" expected, "Needs an answer" shown) | fails | same text | Baseline; fixture is #507 |
| `toolbox-window` tall foreground Toolbox above the open composer (Tools click blocked at 600 px) | fails | fails | Baseline, as recorded before |
| `toolbox-window` modern Toolbox expands in place (focus assertion) | failed in the batch, then 5 of 6 passed | 2 of 6 failed | Flake on both |

No failure was caused by this branch. The serial pass selected none of these specs. Not re-run: the full gate (builder's instruction: targeted specs only), `package:verify`, and the earlier whole-suite baseline failures documented above, which belong to other PRs. The genuine Codex Screen capture remains unmet: Codex Screen motion is fixture-checked only, and frame association for Codex computer calls is NATIVE-5a work.

## MOTION-4b — the remaining surfaces (16 November)

Yash, 16 Nov: MOTION-4 was only partly done. His binding words stay "smooth animations for all the clicks that will look better with motion, and every such interaction has both animations, opening and closing", for the whole product. This section is the walk that finishes it. Everything goes through the shared lib (`surface-motion.ts`, `dismiss-menus.ts`, `use-surface-reflow.ts`, the new `reveal.ts`) and the `--motion-*` tokens in `modern/motion.css`; no surface got a one-off timing. Closing is never slower than opening, a second click reverses from the current frame, and keyboard, reduced motion and low resource settle immediately (the same `surfaceMotionAllowed()` gate as before: the last input must be a pointer press).

### How it was walked

A scratch daemon on port 7931 in a scratch Drishya home. Real Claude Code `rec_39af3c94` (14,545,573 bytes, 747 operations, 689 prose, one agent) and real Codex `rec_af2cd202` (311 operations, 32 prose, two agents) were imported through the normal redacting path; Home read this machine's 329 local sessions. A script clicked every `summary`, `[aria-expanded]`, `[aria-haspopup]`, `popovertarget` and tab at 600 and 1440 px and recorded, per control, whether anything other than a hover colour ran on open and on close (new Web Animations and CSS transitions only; no text was read). Gaps it found were then confirmed against the source. Screenshots stay in `.local/motion-4b/`.

### Paired now

| Surface | Trigger | Start and end | Motion |
| --- | --- | --- | --- |
| **Every `<details>` in Modern** (History "Original notice", image "Original input and output", captured Script; step Links; Notes editor and Resolved; Delegation thread; Full input; Sources and "Choose reading format"; Compare previous edit and Commits; Git graph Working tree and, when narrow, Branches & tags; Workspace "Ask harness to run a command" and Local drafts; Library search filters; Import connections; Source tools; Review file edits; Verification fix chain; Session lineage; Browser input; Context report) | Pointer press on the summary | The body fades and rises 2 px from its summary edge and back; it stays mounted through its exit | `dismiss-menus.ts` now treats every `details` as an animated disclosure (it was a list of classes plus `data-reading-disclosure`). `motion.css` styles `details[data-pointer-menu]`; menu clock 180 / 140 ms |
| **Toolbox drawers** (each MCP server, Agents, Run tools, Subagents) | Pointer press on the drawer summary | Same body fade; the dock still recentres by itself when its height changes | These were excluded on purpose (`.md-server`) because the dock owns recentring. The dock now waits up to three frames for its own height to change before measuring where it travels from, because a paired drawer shows its content one frame after `open` flips. On a tall dock whose height does not change (the drawer scrolls inside) the content used to appear with nothing moving; now it fades |
| **In-flow reveals**: exposed reasoning (History), "why no reasoning" line, changed-outside notice snippet, compaction summary reader, pinned source reference, Net diff | Pointer click on the control | The block fades in from 3 px above and, when closed, stays mounted through its fade, then leaves | New `useReveal` (`lib/reveal.ts`) over the existing `useSurfacePresence`, with a new `inline` surface kind on the menu tokens. No wrapper is added except one `div` where the content was a fragment (reasoning body, Net diff). Content that is open when its owner mounts (a remount, a restored choice) never animates |
| **Home "About Drishya"** | Pointer click | The introduction paragraph fades in and out | `useReveal`. The heading text swap and the section's compact padding still change at once (see below) |
| **Home workspace list below 650 px** | Pointer click on "Choose workspace" | Unfolds from the trigger's lower edge; folds back | CSS in `motion.css`: opacity, translate and scale on the menu tokens with `display` as an allow-discrete transition and `@starting-style`; keyboard opening stays immediate |
| **Command palette** | Closing with the X or backdrop by pointer; opening when the `drishya-navigate-workspace` event follows a pointer press (the classic dock button). Modern opens it from Ctrl/Cmd K only | Centred dialog rises with its backdrop and settles back | `ReadingDialog` no longer excludes `workspace-navigation`. Ctrl/Cmd K, Enter and Escape are keyboard input, which the shared gate already settles at once, so nothing is slowed. Choosing a result still closes at once because it hands focus to the next surface |
| **Hover link cards** | Pointer hover or focus; leave or Escape | The card fades and rises 3 px; leaves the same way | Moved from two bespoke keyframes (140 ms) to transitions on `--motion-menu-enter` / `--motion-menu-exit`, so re-entering the card mid-exit reverses from the current frame instead of restarting |
| **Step note popover (`op-evidence`)** | Pointer click on the card's info button; pointer press elsewhere | Scales from 0.97 at the top-right and back | Already in `motion.css`; verified in both directions on both real sessions (it was listed as a gap but was paired) |
| **Composer controls over the Toolbox button at 600 px** | n/a (layout bug) | With the composer open the bottom row (Tools, Follow latest) lifts above the composer card | CSS in `recovered-surfaces.css` (see below) |

### Left instant, with the reason

| Surface | Reason |
| --- | --- |
| Home Harness and Session age selects; Settings selects | A native `<select>` popup is drawn by the browser; the app owns neither its opening nor its closing |
| `title` tooltips (Home stats, timestamps, card hints) | Browser-owned |
| Prompt "Show full prompt" / "Show less"; fold this turn; terminal "N more lines"; "Show more" on a captured result | These change a line clamp or remove whole passages in the virtualized History column. The clamp is not animatable without copying captured characters (no duplicate captured text), and animating the column's height would move every later passage every frame. MOTION-3 owns History's arrivals and reading |
| Files tree folder rows | The tree is one virtualized flat list: a folder's children are rows the list starts rendering. The chevron rotates (already paired); the rows would need ghost rows kept mounted |
| Home heading text and compact padding behind About | A text swap has nothing to animate |
| Choosing a command-palette result | It is the hand-off to the next surface; focus and the opening surface must not wait for a fade |
| Keyboard-opened anything, reduced motion, low resource | The shared gate settles them at once, by design |

### The 600 px Tools / Attach overlap

At 600 px with the composer open (a card down to the bottom edge), UI-49's shared bottom row placed the Toolbox **Tools** button (14 px from the left, 36 px tall, 12 px from the bottom) and **Follow latest** on top of the composer's Attach and send controls: Tools covered Attach's centre, so Attach could not be clicked and Playwright reported Tools as intercepted. The row assumed a minimized composer. Fix (`recovered-surfaces.css`, one rule at `max-width: 820px`): when the connected workspace holds an open, not minimized native composer, `.catalog-toggle` and `.history-transport` sit at `--composer-gap + --composer-raised-gap + 8 px` from the bottom, above the card; the minimized composer keeps the one-row layout. Measured on the real Claude Code session at 600×640: Tools moved from y 592 to y 338 (composer top y 397); Attach at y 586–614 is clear. `toolbox-window.spec.ts` "tall foreground Toolbox … above the open composer" (the recorded baseline failure at line 179) passes.

### Verification on real sessions

Scripted pass (`.local/motion-4b/verify.mjs`) over Claude Code `rec_39af3c94` and Codex `rec_af2cd202`, plus Home, in Jet Black, Midnight and Daylight at 600 and 1440 px: 18 cells. Per cell it clicked each surface that exists and sampled every frame from before the click for 450 ms, requiring a visible frame at an opacity strictly between 0 and 1 on open and again on close, and a final frame where a closed surface is gone.

- **All 18 cells moved in both directions** for every surface present: Toolbox drawers and Agents (24 of 24 pairs across the two sessions), step note popover (6 of 6, Codex only: the Claude session has no info buttons in view), command palette phases `opening` then `closing`, driven by a pointer press then the event, then the X (12 of 12), Home About (6 of 6) and the narrow workspace list (3 of 3), session menu and Search (12 of 12 each, the MOTION-4 surfaces re-checked for smoothness), exposed reasoning (6 of 6, Claude only; the Codex session had none in view).
- Not exercised on a real session: link cards (neither imported session contains a link in prose) and the compaction summary, notice snippet, pinned reference and Net diff reveals (no such content in the two sessions). They share `useReveal`, which the exposed-reasoning pair exercises on both sessions' palettes, and the link card is covered by the fixture test.
- Worst frame gap per surface was 5–24 ms (12–24 ms for the drawers and menus). Single first frames cost more: the Home workspace list 43 ms (it mounts the workspace rows), the step note popover 33–57 ms (positioning) and, once, the first exposed-reasoning open 52 ms. None of these existed as motion before; the cost was the same instant render. Two outliers (a 100 ms first drawer frame on Codex and 94 and 201 ms on the first Claude session menu open in Daylight) did not repeat: the drawer ran 16 and 18 ms and the menu ran 12 and 11 ms on re-runs, and a long-animation-frame observer saw no long frame over three open/close rounds. I treat them as scratch-daemon contention (it was also reading this machine's live sessions), not the motion code.

### Tests

New cases in `tests/browser/paired-surface-motion.spec.ts` (six, one per group): every pointer-opened disclosure including the Toolbox drawer (and that the keyboard shows no in-between frame); Home About and the narrow workspace list; exposed reasoning; the command palette pointer and keyboard paths; link cards; the step note popover. The sampler binds to the first matching node and follows it, so a surface that leaves is not replaced by another match. Existing cases are unchanged.

Edge, two workers, UI rebuilt first: 118 passed, 1 skipped, 0 failed across the 15 `paired-surface-motion` cases, `toolbox-window` (11), and 21 other specs naming the changed surfaces (link-cards, reasoning-gap, session-net-diff, session-menu, session-lineage, session-segments, workspace-navigation, recorded-usage, tool-inventories, agent-inventory, delegation-thread, narrow-reading-overlap, home-groups, home-running, library-search, compaction, review-questions, ship-6f-notes, outside-changes, workspace-toolbar, header-cluster). Both typechecks and the 667 UI units pass. The full browser gate was not run (docs and AGENTS.md: once per batch, not per task).

The one regression the change itself caused was found and fixed before this run: with every disclosure paired, `toolbox-window` "pointer disclosure recentres the same dock" failed because a paired drawer shows its content one frame after `open` flips, so the dock's own recentring measured an unchanged height and did not start. The dock now waits up to three frames for its height to change.
