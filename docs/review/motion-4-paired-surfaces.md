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
