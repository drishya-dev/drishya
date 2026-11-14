# UI-49 · Narrow windows: chrome never covers what is being read — Review Record

**Branch:** `ag-builder/ui-49-narrow-chrome`
**Status:** Ready for review
**Scope:** Narrow window layout (600, 720, 900 px and 1440 px baseline) across top chrome (session header, view switches, Files / Repository capsules), bottom chrome (Tools toggle, Prompt composer, Follow latest switch, scroll arrows), and reading-edge veils.

## Root Causes Found

1. **Independent vertical floating of bottom chrome at narrow widths:** In `apps/ui/src/modern/recovered-surfaces.css`, `.catalog-toggle` and `.history-transport` were positioned at `bottom: calc(var(--composer-gap, 12px) + 4px)`. Because `--composer-gap` reserves ~158px (134px resting + setup row + padding), while the minimized composer pill is only 38px tall, Tools and Follow latest hovered ~162px from the bottom, floating directly over cards and terminal output, with a massive dead void down to the composer.
2. **Bottom veil encroached deep into the reading column:** In `apps/ui/src/modern/large-screens.css`, the mask gradient for `<= 820px` faded to `#000` only at `calc(100% - var(--reading-edge-bottom) - 36px)`. Combined with `reading-edge-bottom` measuring up to the floating Tools at ~162px, the bottom 305–340px of the viewport was dimmed or blacked out, covering readable code and prompt lines. Furthermore, the gradient retained 10% opacity (`rgba(0, 0, 0, 0.1)`) behind controls instead of cleanly stopping behind chrome.
3. **Scroll padding and bottom margin did not guarantee clearance for the final row:** At rest at the bottom, `.history-inner` had insufficient padding-bottom at 600–900 px to ensure the newest card and its controls sat entirely above the bottom chrome without any text node touching the veil or sitting under a capsule.

## Changes Made

1. **Shared bottom row for Tools, Composer, and Follow latest (`apps/ui/src/modern/recovered-surfaces.css`):**
   - At `<= 820px`, `.catalog-toggle` and `.history-transport` are placed on the same row as the composer pill at `bottom: 12px` (Tools at `left: 14px`, Follow latest at `right: 12px`).
   - For viewports `<= 560px` where horizontal collision would occur, they stack neatly at `bottom: 56px` directly above the 38px composer pill.
   - Because they remain anchored at `bottom: 12px` whether the composer is open or collapsed, expanding/collapsing the composer causes zero jumping of surrounding controls (preserving UI-28b/28c contracts).
2. **Horizontal bounding for composer pill (`apps/ui/src/modern/reading-windows.css`):**
   - Added `@media(max-width:820px)` rule constraining `.modern-native-composer.composer-minimized:has(.composer-minimize[data-now])` to `width: min(340px, calc(100vw - 280px))` so the live-status composer pill never collides horizontally with Tools on the left and Follow latest on the right.
3. **Veil stops and reading column clearance (`apps/ui/src/modern/large-screens.css`):**
   - In `.history`, added `+ 12px` clearance to `scroll-padding-top` and `scroll-padding-bottom` so scrolling to top or bottom stops with comfortable air between text and capsules.
   - At `@media(max-width:900px)`, set `.history-inner` to `padding-bottom: max(144px, calc(var(--composer-gap,0px) + var(--composer-raised-gap,0px) + 32px))`, guaranteeing the bottom-most card clears the 56px bottom chrome at rest.
   - Refined the `-webkit-mask-image` / `mask-image` gradient so it fades to `transparent` behind the chrome (`reading-edge-top - 16px` / `100% - reading-edge-bottom + 16px`) and reaches full `#000` opacity right at the reading edge (`+ 2px` / `- 2px`), completely eliminating the 36px intrusion into readable text.
4. **Updated `tests/browser/ship-6e-reading-edges.spec.ts`:**
   - Updated mask stop assertion from old `+ 36px` to UI-49's `+ 2px` reading-edge boundary.
5. **New browser test suite (`tests/browser/narrow-reading-overlap.spec.ts`):**
   - Tests 12 matrix permutations across Claude Code and Codex at 600, 720, and 900 px with Files open and closed.
   - Validates horizontal row sharing without collision between Tools, Composer, and Follow latest.
   - Measures bounding boxes of all text nodes and card controls against all fixed chrome capsules at rest (bottom/latest), scrolled to top, and mid-history, verifying 0 text overlaps, 0 control overlaps, and 0 veil overlaps.

## Verification

- `corepack pnpm typecheck`: **PASS** (zero errors across both projects)
- Synthetic Browser Specs:
  - `tests/browser/narrow-reading-overlap.spec.ts`: **12/12 PASS** (26.2s)
  - `tests/browser/ship-6e-reading-edges.spec.ts`: **ALL PASS**
  - `tests/browser/composer-grows.spec.ts`: **5/5 PASS** (19.5s)
  - `tests/browser/ship-6g-layers.spec.ts`: **ALL PASS**
  - Combined run of all 4 suites: **27/27 PASS** (27.1s, zero retries)
- Real-Session Verification Matrix (`.local/verify-all-overlaps.mjs`):
  - Ran against real local sessions in scratch store:
    - Claude Code: `rec_5ee6b391f452bd9c` (1,248,318 bytes)
    - Codex: `rec_2dcde4d9ebefcb88` (458,920 bytes)
  - Evaluated all 48 test permutations:
    `[claude-code, codex] × [600, 720, 900, 1440 px] × [files open, closed] × [bottom, top, mid]`
  - Result: **48/48 PASSED** (0 text overlaps, 0 control overlaps, 0 veil overlaps).
- Visual Image Inspection:
  - Inspected before vs after frames at 600, 720, 900, and 1440 px in `.local/ui-49/` and recorded in artifact.
  - Confirmed 1440 px desktop baseline is pixel-identical to baseline.
