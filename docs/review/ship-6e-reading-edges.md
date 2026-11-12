# SHIP-6e — Reading edges so fixed chrome never sits on reading text

**Branch:** `gemini/ship-6e`  
**Owner:** @yash + Gemini 3.8 Flash (Antigravity)  
**Date:** 2026-11-12  

## Cause
In Modern Workspace view, History scrolled smoothly underneath the floating header/chips and bottom controls (`Tools`, `Follow latest`, `Ask your agent...` composer pill, replay transport, and queued receipts) without bounded reading-edge veils, leaving prose and operation cards visually colliding with overlapping controls at both `600 px` and `1440 px`. At narrow widths (`<= 600 px`), `.workspace-secondary` buttons could also wrap awkwardly over the reading band.

## Fix
1. **Dynamic chrome measurement (`apps/ui/src/lib/reading-edges.ts`, `apps/ui/src/components/Viewer.tsx`)**:
   - Added `measureReadingEdges(viewer)` to measure only visible top controls overlapping the History column (header cluster, `Files / Repository` leading pills, secondary controls, Git trigger) and bottom fixed controls (`Tools`, `Follow latest`, native composer + raised approval/queued receipts, replay transport) with an `EDGE_BUFFER` of `6 px`.
   - Observed chrome resizes and attribute/child mutations inside `Viewer.tsx` to update `--reading-edge-top` and `--reading-edge-bottom` on `.viewer`.
2. **Bounded masked reading-edge veils (`apps/ui/src/modern/large-screens.css`, `apps/ui/src/modern/reading-windows.css`, `apps/ui/src/components/Viewer.tsx`)**:
   - Mounted `.reading-edge-top` and `.reading-edge-bottom` (`aria-hidden="true"`, `pointer-events: none`, `z-index: 5`) inside `.viewer` above `.history` and below floating controls.
   - Styled bounded `backdrop-filter: blur(8px)` + `--bg` gradient and `mask-image` fading cleanly over `28 px` (`READING_EDGE_FADE`) into the reading world, with `backdrop-filter: none` fallbacks under `[data-low-resource]`, `prefers-reduced-motion: reduce`, and `@supports not (backdrop-filter: blur(1px))`.
   - Kept `.workspace-secondary` row-aligned at `<= 1100 px`.
3. **Scroll destination & composer clearance (`apps/ui/src/components/History.tsx`, `apps/ui/src/modern/large-screens.css`)**:
   - Updated `readingClearance` in `History.tsx` so prompt-rail jumps, search/evidence scrolls, and initial/end padding clear `--reading-edge-top + 28px` and `--reading-edge-bottom + 48px` (at `<= 820px` so both `Tools`/`Follow latest` and compact composer targets clear end-of-history without regressing `fresh-workspace` bottom gap bounds).
   - Scoped `scroll-padding-top` and `scroll-padding-bottom` on `.history` directly to the opaque edge extents so focus/hover targets never trigger spurious scroll nudges (`product-workspace` hover reading preserved at `scrollTop = 0`).

## Verification
- **Build, typecheck & unit tests:**
  - `corepack pnpm ui:build && corepack pnpm typecheck` — passed.
  - `corepack pnpm exec vitest run apps/ui/test/` — **119 files, 587 passed, 1 existing skip**.
- **Targeted browser specs (`DRISHYA_BROWSER_CHANNEL=msedge`, `--retries=0`):**
  - `tests/browser/ship-6e-reading-edges.spec.ts` (new synthetic Claude Code & Codex spec asserting zero visible text-node intersections with chrome at `600` & `1440 px`, start/jump/end scroll destinations, expanded composer updates, and low-resource fallback) + `fresh-workspace.spec.ts`, `product-workspace.spec.ts`, `ship-6a-reading.spec.ts`, `material-motion.spec.ts`, `palette-contrast.spec.ts`, `composer-access.spec.ts`, `composer-grows.spec.ts`, `toolbox-window.spec.ts`: **139 parallel + 4 serial = 143 passed, 0 failures, 0 retries**.
- **Real local sessions (scratch store, 600 & 1440 px, Jet Black / Midnight / Daylight Paper, private screenshots in `.local/ship-6e/`):**
  - Claude Code `rec_cc00` (`24.04 MB`): `600 jet/midnight/paper` (`top=132 bottom=305 uncovered=0 overlaps=0`), `1440 jet/midnight/paper` (`top=60 bottom=64 uncovered=0 overlaps=0`).
  - Codex `rec_7cb1` (`15.02 MB`): `600 jet/midnight/paper` (`top=132 bottom=305 uncovered=0 overlaps=0`), `1440 jet/midnight/paper` (`top=60 bottom=64 uncovered=0 overlaps=0`).
