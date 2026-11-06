# MOTION-1 — interaction motion inventory

Every clickable control and nested state in Modern, measured in the running app on 4 November 2026: each control was triggered and the
animations it started were read from `document.getAnimations()` (property, duration, curve). Synthetic demo session plus real sessions
(Codex `rec_93fd`, Claude `rec_81c2`) for the surfaces the demo has no data for (composer, Git, Workspace). Method from TASKS:
`find-animation-opportunities` (read-only sweep and gate), then the fixes below, then `review-animations`.

**Gates, unchanged and shared by every row.** Motion runs only with motion on (`data-ui-motion`), not in low-resource mode
(`data-low-resource`) and without a reduced-motion preference; both variants were measured with nothing left running. Press feedback
also waits for a pointer (`data-ui-press`), so keyboard use is immediate. Escape always closes at once.

**One curve.** `--ease-out` (`cubic-bezier(.16, 1, .3, 1)`) everywhere; dialogs used a second hard-coded curve and now read the token.

## Inventory

| Control | Motion | Duration | Fallback (reduced motion, low resource, keyboard) |
| --- | --- | --- | --- |
| Toolbox minimise / restore | Station resizes; the stage's cards reflow into the room (one real-material transform) | 200 ms station, 300 ms cards | Immediate |
| Prompt composer minimise / expand | Composer resizes from its docking edge | 200 ms | Immediate |
| Files ⇄ Repository | The map behind fades; the panel swaps in place | 200 ms (map) | Immediate |
| Folder expand / collapse | Chevron rotates; rows appear without animation (virtual rows never animate) | 140 ms | Immediate |
| Session menu, Search, other pointer menus | Scale .95 → 1 from the trigger corner, fade; exit the same way | 160 ms in, 160 ms out | Immediate |
| **Git popover** (Git review / Git graph choice) | **New:** the same scale-from-trigger as the session menu; leaves faster | **160 ms in, 120 ms out** | Immediate |
| Settings, Changes and other modal dialogs | Rise 6 px and scale .98 → 1; exit rises 4 px and fades | 200 ms in, 140 ms out | Immediate; Escape closes at once |
| **Reading windows** (Git review, Git graph, file readers; modeless) | **New:** rise 4 px and scale .99 → 1; exit fades | **160 ms in, 120 ms out** | Immediate; Escape closes at once |
| **Workspace entry** | **New:** rises 4 px and fades in where it docks; returning to the agent is immediate | **200 ms** | Immediate |
| **Disclosures in menus and Settings** (Usage, Navigate history, settings sections) | **New:** opened content settles in place (fade, 2 px), no height animation | **140 ms** | Immediate |
| Disclosures in History cards and the Toolbox | None (they remount with paging and the stage; an animation would replay) | — | — |
| **Switches** (Follow, settings toggles) | Knob travels; track colour follows; **now on the product curve** (was plain `ease`) | **160 ms** | Immediate |
| **Press: buttons, Files/Repository, session menu, Original, Git choices** | 1 px dip that now **eases in and out** (it snapped before; four controls had none) | **120 ms** | No dip |
| Press: Toolbox tool rows | Scale .98 | 130 ms | No scale |
| Card expand into reading space | The card's own chrome and borders settle; the material moves once (MOTION-3 covers arrivals) | 140–180 ms | Immediate |
| Copy buttons | The label changes to "Copied"; no motion needed | — | — |
| Tooltips | Native titles; no motion | — | — |

## Rejected, with the gate that rejected them

- **Folder children rows animating in.** Frequency (tens a day) and the virtual-row rule: rows never animate.
- **Files ⇄ Repository panel crossfade.** Function: the two panels are different tools; a fade would delay the one being read. The map behind already fades.
- **Workspace return animation.** Purpose: returning shows the History the person left, exactly where it was; an entrance would imply new content.
- **Keyboard-opened search, dialogs and Escape.** Frequency: keyboard use repeats all day; it stays immediate by design.
- **History disclosures and Toolbox lists settling.** Truth and calm: they remount while paging and with every stage reflow, so the settle would replay without any action.

## Verdict

Modern was close: menus, dialogs, the stage and the composer already moved well and were gated correctly. The gaps were consistency
gaps — a Git popover and reading windows that appeared from nowhere next to menus and dialogs that did not, a second easing curve, a switch
on plain `ease`, and press feedback that snapped or was missing. Highest leverage: the reading windows, which open many times a session.

**Checked:** the inventory measured at 1440 on the demo and on Codex `rec_93fd`. On Claude `rec_81c2` (16k observations) and Codex `rec_93fd`, at 600 and 1440, each from a fresh load: the Git popover opens in 160 ms; Git review opens in 160 ms and closes in 120 ms; a menu disclosure settles in 140 ms; Workspace arrives in 200 ms at 1440 (at 600 its entry is not in the header); no horizontal overflow. The first menu open after a load does not animate, because pointer feedback turns on with the first press (existing, intended). Reduced motion and low resource leave no animation running for the Toolbox or the session menu. Motion specs: 280 passed across 34 files.

**Not run:** `review-animations` (it can only be started by the builder: `/review-animations`).
