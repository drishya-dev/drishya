# SHIP-7 — search, retained frames and returning to a read

8 November 2026 · Yash with Codex · [PR #377](https://github.com/drishya-dev/drishya/pull/377).

## Behaviour and causes

- **Search:** choosing a result now detaches Follow and navigates to the exact recorded prompt, prose or operation, preserving the existing operation inspector. Previously prompt observations had no destination, live following could win over the jump, and a Codex wrapper receipt could target a wrapper which its recorded child calls had replaced on screen. The helper uses observation IDs, passage membership and explicit `parentOperationId` relationships; a hidden wrapper opens its first displayed child. It does not guess from words, timestamps or turn ordinals. Unresolved results stay in Search with an explanation. Paged prompt identity is optional derived Scene metadata, not a recorded-event schema change or a full-projection fetch.
- **Screen:** the outgoing frame previously expired after 220 ms regardless of whether the requested image had loaded. Under delayed delivery, the held-frame caption could sit above an undecoded image with no loading or unavailable state. Frame identity now follows the image URL, so holding the same frame does not remount it. A different frame retains the last actually decoded compatible image until the new bitmap decodes, with an explicit loading notice. Markers wait for that bitmap; failed requests keep the existing honest error. The existing finite fade and reduced-motion behaviour remain; no new visual design or stylesheet changes.
- **Workspace return:** the captured-file handoff explicitly cleared the file reader and selected/expanded operation. The toolbar also cleared the file panel. These entry points now preserve reading references; the captured reader is hidden while Workspace is open and restored through its existing evidence-memory mechanism on return. Consent, disk/captured separation and the Workspace implementation are unchanged.

## Real-session acceptance

Only prefixes, sizes, counts and navigation measurements are recorded here. Journals were read through the normal redacting ingest path into disposable Drishya homes. No native session was resumed, no source journal was modified, and no real journal text or screenshot is committed. Windows Edge, headless desktop windows at **600 × 960** and **1440 × 960**.

| Accept line | Genuine evidence and result |
|---|---|
| Search moves to the selected step on long sessions of both harnesses | Claude `rec_39af3c94`, 14,545,573 bytes, 747 operations: prompt hit did not move before; afterward target visible, scroll 148739→11068 and 148980→11004. Codex `rec_7cb1cda1`, 15,023,432 bytes, 1,115 operations: hidden-wrapper result did not move before; afterward its recorded child is visible, 96133→361 and 92999→239. |
| Search remains bounded on genuinely paged sessions | Claude `rec_c8e5c9c8`, 83,716,730 bytes, 2,695 operations: paged prompt hit visible, 390370→7429 and 389722→7226. Codex `rec_fa9e37da`, 39,239,090 bytes: paged result visible, 58198→49 and 36252→0. Both sources used the daemon's paged path. |
| Screen shows retained pixels or an honest state | Claude `rec_ab475ed8`, 39,915,978 bytes, 41 computer steps / 15 frames, held index 11. Warm loads were healthy before the fix; the defect was reproduced by delaying that genuine retained image's HTTP delivery. On clean main at both widths: incoming natural width 0, no retained visible frame, no loading status. On this branch at both widths: incoming image hidden until decoded, previous decoded frame visible, one loading status; release gives real pixels and removes the notice. This is a controlled delivery-delay reproduction, not a claim that every warm load was black. |
| Workspace restores the read and reading position | Claude `rec_ab67986c`, 451,820 bytes, 9 operations, captured Read; Codex `rec_7cb1cda1`, above, captured edit. Before: reader present before handoff and absent after return at both widths. After: reader and exact selected evidence restored at both widths. History offsets remain 0→0 for Claude and 24867→24867 / 23392→23392 for Codex. Those first readers had no internal overflow. A further genuine long-read check used Claude `rec_39af3c94`: content scroll 100→100 and history 96113→96113 / 95880→95880 at 600/1440, with exact evidence restored. A larger Codex edit also retained evidence and history 91400→91400 / 87587→87587; its selected content viewport retained 0→0 at 600 (no overflow there) and 100→100 at 1440. The ordinary expanded-card/toolbar loop was already healthy and remains a regression guard. |

`pnpm check:real -- workspace-files --pick 1` separately scanned 73 Claude sessions / 4,588 hits and 7 Codex sessions / 78 hits, importing one source per harness into scratch homes. `computer-frames --pick 1` found 9 Claude sessions / 73 mentions and verified a genuine 14-step / 5-frame run. The current scanner found **zero Codex computer-frame sessions**; its documented Codex computer-frame capture limitation remains. Screen acceptance above is on the genuine Claude case that reproduced the defect; no synthetic Codex session is presented as computer-frame acceptance.

## Regression checks

- `search-position.spec.ts`: both harnesses, both widths, more than 10,000 observations, unloaded prompt and result navigation, including the Codex wrapper/child case; Follow stays detached. Four passed.
- `screen-view.spec.ts`: controlled held-image delay plus existing placement, reduced motion, playback, replay cutoff, browser batches and 150-step mounting bounds. Eight passed.
- `file-reading-actions.spec.ts`: restored exact evidence, reader hidden in Workspace, preserved history offset, existing disk/captured/outside-root cases. Fifteen passed.
- Search identity units and Scene goldens: 18 passed. The four golden changes add prompt identity; anonymized identifier numbering consequently changes.
- Both typechecks pass. All units: **1,273 passed / 1 existing skip**, three workers. Package verification passes (isolated offline install, both harness imports, authenticated API and restart).
- Final frozen source `04256aa3`: `DRISHYA_BROWSER_CHANNEL=msedge DRISHYA_WORKERS=3 pnpm check:affected` rebuilds the UI, runs both typechecks, 177 related units and the whole parallel/serial browser suite. **Final browser outcome: 673 parallel passed / 27 existing skips / zero failures (8.0 min); 27 serial passed / 1 existing skip / 5 failures (2.3 min), three parallel workers plus one serial worker, zero retries. The complete command is red.** The initial `54fba354` run exposed three search-inspector regressions (product-workspace:759, p1-pacing:356 and :461); these were fixed by preserving selected-operation reading, not labelled as baseline failures. All seven paged-search/inspector/verification regressions then passed, and the eight genuine search checks were repeated successfully on the corrected UI.

## Merge boundaries

No `History.tsx`, `Origins.tsx`, `SessionWorkspace.tsx`, `DeveloperWorkspace.tsx`, worktree inventory, queue, plans, native policy, event schema, Clarity or shared stylesheet edits. Viewer reservations are only Search and temporarily hiding FileHistory during Workspace. FileReadingActions changes only the Workspace handoff state; Workspace changes only the toolbar entry state. Other-builder review is required; this PR is not merged.

### Baseline control

Rebuilt clean main `f30d9b52` (only claim docs after production `ea555312`), Edge, one serial worker, zero retries, with no tracked changes: `material-motion:132`, `p1-pacing:40` and `p1-pacing:266` all fail alone too. These are the same previously recorded motion/renderer-node failures; this task does not edit their owned History/Origins/motion code or weaken their assertions. Final-source browser results, including any recurrence, remain explicit rather than calling a red complete command green. Private baseline output: `.local/ship7-baseline-motion.log` in the main checkout.

### Final gate follow-up for Claude before merge

The three motion failures listed above recur on the final source and reproduce on clean main. Two further failures in the final serial pass are **not proven baseline failures**:

- `b2-live.spec.ts:63`: the initial triple-click produced a zero-length selection instead of text (before the later anchor/burst assertions).
- `b2-live.spec.ts:194`: source-find navigation expected active line 249 but remained on 240.

Each passed **5/5 isolated runs on the final branch** and **5/5 on rebuilt clean main** (10 checks per checkout, one serial worker, zero retries). This does not establish their cause, prove a clean complete gate, or authorize weakening assertions. The same cases passed in the earlier whole command on this task before the inspector correction; that is evidence of intermittence, not evidence of innocence. Claude should investigate the full-run interaction before merging. Existing owned History/reader/motion code and B2 assertions were not changed. Raw private logs: `.local/final2-affected.log`, `.local/final-b2-isolated.log`; clean-main control `.local/ship7-baseline-b2.log` in the main checkout.

All three SHIP-7 acceptance cases and their direct regressions pass. The ready-for-review state is **not** a release-gate or merge clearance; this report preserves the unresolved broader failures separately.
