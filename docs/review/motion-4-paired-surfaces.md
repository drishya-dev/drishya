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

The managed local checkout resumed the published `951b638d` history. No earlier MOTION-4 checkout, stash or archived attachment was available on this host. The earlier handoff's uncommitted changes could not be recovered. `d391d73d` main is integrated, including UI-47's wait states, UI-49 narrow chrome, UI-50 formatting, UI-41d mode switching, SHIP-5 questions and LIVE-7a. UI-48's shaped placeholders are a follow-on in the detailed TASKS entry and run within the same windows.

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
| Shared ReadingDialog callers | Captured commands and outcomes, queued inputs, evidence/insights, file histories, delimited/structured data, source versions, recovery and library search each share the existing chrome, close button and focus lifecycle. | Same dialog owner as Settings, Notes and Git graph; keyboard reader and other targeted fixtures. Individual real journeys for these additional callers are still outstanding. |
| Session and local menus | Existing summaries and context triggers, including session utility, reading options, worktree picker, Git recorded work, file filters and navigation. Open and close travel from the adjacent edge; closing content stays inert. | Real session menu on both harnesses in all six cells, context and keyboard fixture. |
| Usage and session details; controlled reading disclosures | Their own summary controls reveal or fold the same panel. Deliberate click sets motion. Saved states, remounts and keyboard activation are immediate. | Real Usage on both harnesses in all six cells, session menu/keyboard fixture. |
| Search, model, effort, permission, attachments, operation evidence | Each native popup stays on its existing trigger edge. Browser top-layer retention supports reversal and immediate native light-dismiss semantics. | Search genuine in all six cells per harness. Native composer control fixture exercises current modes. |
| Toolbox | 600 px catalog control opens and closes the same right-side station. Minimize/expand morphs the existing dock. Agents, MCP and Run tools use the dock's existing paired recentering so there is one moving surface. | Genuine minimize/expand in all six cells per harness. Catalog and drawer fixture exercise both directions, keyboard, current frame, reduced motion and layout. |
| Composer shell and switch controls | Existing Whole-surface reflow is gated on pointer and shared preferences. Virtual file rows, command palette, native Home selects/title tooltips, text selection and browser-owned menus, direct dragging and copying stay immediate for their existing keyboard, browser or reading contracts. | Shared motion path; named browser fixtures. No app-owned toast surface was found. System notifications use browser ownership. |

Scratch re-import, 600 and 1440 px at 900 px high, Jet Black/Midnight/Daylight. Claude Code `rec_85e4d976`, 7,964,522 bytes, 189 operations, 25 file references. Codex `rec_537e2fc4`, 22,907,838 bytes, 686 operations, 9 file references. The first integrated measurement exercised 126 surface journeys, with zero incomplete open/close journeys. Settings and Screen used 240/180 ms, panels 220/160 ms, session menu/Usage/Search 180/140 ms. Some Codex peek openings had already settled by the frame sample, so that first pass proves the opening and exit interaction but does not certify those entry timings. The local files and screenshots remain under `.local/motion-4`.

The existing branch had two independent Changes exit owners: the old close path held `aria-expanded` true and the Viewer unmounted the reader when state changed. The regression failed on this combination and passed after the single retained mount. At 600 px the Toolbox catalog had no transition; its new fixture failed before the shared display/scale rule and passed afterward. A generic held disclosure interfered with the Toolbox's existing recentering, detected by its existing paused-animation assertion. Its disclosure stays with the dock owner and the original test passes again.

The task remains in draft while the remaining real interactions, affected gate and human MOTION-3 follow-on are tracked. The affected dry plan selects the full browser suite because this change touches shared Modern CSS, ProductShell and Viewer. The local batch gate is reserved for the final source after named and real acceptance. No hosted dispatch.
