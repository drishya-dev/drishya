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

## File boundaries

FINISH-0a/0b reserve shared tokens and overlay owners. Before implementation, reserve only the motion lifecycles in ProductShell's ReadingDialog, ProductMenu, Disclosure, dismiss-menus and Modern motion rules; preserve their contents, layout, focus and selection contracts. Workspace needs its existing mount/return lifecycle. The peek tab close/reopen section of SessionWorkspace needs a separate explicit reservation or the UI-28c merge. Composer gap, composer.css, PromptRail, History arrivals/hover, LINK-1 and ingest lineage remain untouched.

## Acceptance still required

Complete inventory with open/close evidence on both real harnesses at 600/1440 in all three palettes; matching interruptible exits on menu/dialog/popover/drawer/peek; reduced motion and low resource; no delayed captured text or replayed history arrivals; named browser guards and check:affected, two workers, one browser command at a time, no full gate. Opus reviews/merges.
