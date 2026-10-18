# Simpler Workspace and dock interactions — 18 October 2026

The builder requested crafted **nested controls**, not only outer panels, and confirmed that frequent Workspace actions should stay visible while secondary actions move into compact menus. The single active queue remains TASKS. This increment does not change the core tool-box visualization or deferred Git graph.

| Before | After | Why |
| --- | --- | --- |
| Workspace layout/reset and file navigation/export/discard compete with reading | Native contextual Actions menus; New/edit/compare/native review remain visible | Less permanent chrome without deleting developer workflows |
| Nested Escape could dismiss Workspace; phone menus could extend left | Local menu Escape/focus ownership, bounded available width/height and shared outside dismissal/keyboard rows | Preserve the current task and reachable actions |
| Small-phone return button wraps onto a third header row | Return shares the title row; remaining actions use one row | Give the source more vertical space |
| Duplicate README tabs have identical names | Only collisions receive shortest unique parent context | Real Claude session exposed ambiguous navigation |
| Prompt/Toolbox collapse changes allocation instantly | One200ms measured current-to-final transform, existing ease-out token | Size and position resolve together without a second preset animation |
| A rapid reversal could restart from a fixed compact rectangle | Snapshot current visual bounds before cancelling and retargeting | Continuous interruption from the actual state |
| Composer clearance reads transformed height | Logical border-box ResizeObserver allocation | A decorative transform must not change reading clearance frame by frame |
| A retained phone dock z-index places its heading over Minimize | Reset nested Modern Toolbox stacking | The real phone button must receive pointer input |
| Inner attachment/minimize/tab controls lack consistent press feedback |130ms pointer feedback with existing tokens and reduced-motion/low-resource guards | State confirmation without moving captured work |

## Scope and evidence

`surface-reflow` computes centre-preserving translation/scale around the existing CSS dock transform. `useSurfaceReflow` runs only for explicit pointer toggles and cancels on rapid reversal, identity/viewport change, reduced-motion changes or unmount. It does not observe typing, capture, history scrolling or tool results. Compact labels/icons counter-scale; there is one real surface and no copied captured text, animated layout height or wall-clock reads in the composer. Keyboard and motion-off/low-resource paths are immediate. Incoming native input requests retain their immediate programmatic expansion.

Workspace uses native details and existing action handlers. Editing, undo/redo, retained memory-only drafts, comparisons, downloads, discard and explicit native preparation remain the same capabilities. No direct project/harness writes, new endpoint, credential/config change, runtime dependency or telemetry. Download/discard remain contextual to editing; safety-relevant source conflicts remain visible. Menu choices close and restore focus; navigation can transfer focus to its new owner.

## Validation

- Two geometry tests and three tab-label tests cover interrupted allocations, preserved CSS base transform, shortest suffixes, root/nested collisions, reorder independence, non-Latin paths and Windows separators.
- Both TypeScript projects and production build pass;522unit tests in94files pass locally.
- Prompt browser journey pauses actual geometry at0ms/90ms, reverses mid-flight, checks matching start rectangles, fixed-size compact label, logical clearance, keyboard/reduced-motion bypass and390/320px containment. Toolbox journey checks the same real geometry/icon, restored inventory and phone hit-testing without force clicks.
- Workspace menu journey checks frequent controls, keyboard rows/Escape/outside dismissal, editing focus, and1440/820/390/320px bounds including320×568. Existing full edit/split/resize/draft/comparison/undo/line-ending/download/new-file preparation journeys pass. Existing nested utility keyboard/usage check passes.
- Four real-store journeys pass: manual controls across actual Drishya/Skeletongraph Codex/Claude sessions at1440/390px, and all three long-session upward-scroll/multi-file/editor journeys. The original third-session README collision was repaired and the final four-case run is clean. Private frames remain under `.local`; desktop/phone and intermediate prompt frames inspected.

## Motion review verdict

**Interruptibility & timing:** actual matrices are retargeted in one200ms transition, not two mismatched phases. Buttons/carets use existing short tokens. No animation changes virtual file rows or the core captured-material arrival/hover path.

**Accessibility:** keyboard activation/Escape, reduced motion and low resources bypass the new dock movement. Source remains selectable and native preparation remains explicitly submitted. Context menus retain native disclosure semantics, bounded scroll and focus restoration.

**Approve this bounded implementation.** This is not approval of the unfinished whole-product interaction pass, every-device/human visual preference or signed-in native acceptance. Those remain unchecked in TASKS. Hosted CI was not run.
