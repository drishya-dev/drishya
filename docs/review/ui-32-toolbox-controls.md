# UI-32 — Toolbox window end and bottom-right controls

Yash with Gemini 3.8 Flash, 12 November 2026 (`gemini/ui-32`, PR #420). Whole item complete for Opus review and merge; no merge by agent.

## Root cause verdict (comparing before and after #409, #418, #416)

1. **Clipped rows, footer, and right border (`#409` / `15b0582e`, exposing pre-existing `#359` / `af8fc04f`):** `LAYOUT-1b` revert (`#409`) restored `toolbox-dock.css` `.toolbox-rail` `bottom: max(24px, ...)` with `overflow-y: auto` on `.workbench-station.modern-tool-station`, while `recovered-surfaces.css` kept the rounded `1px` border, radius, and surface fill on inner `.modern-toolbox`. Whenever content exceeded the available viewport height, `.modern-tool-station` clipped the inner `.modern-toolbox` borders mid-row ("computer 99", "Available tools · recorded 50 of 176") with no top/bottom scroll cue. At desktop rest (`--composer-gap: 24px`), `24px` bottom clearance also placed the bottom of `.toolbox-rail` behind the bottom-right controls (`12px`–`46px` from viewport bottom).
2. **Jump-to-latest overlapping Follow latest (`#418` / `34925da1` + pre-existing hardcoded offsets):** Pre-existing `recovered-surfaces.css` positioned `.follow-pill` independently at `right: 128px` / `right: 132px`, which collided with `.workspace-follow` once the switch label widened to `"Follow latest"`. `LAYOUT-1c` (`#418`) restored `[data-stage-limited] .follow-pill { right: calc(128px + var(--stage-edge)) }` without moving `.history-transport` (`right: 12px`), detaching them further on ultrawide and zoomed-out stages.
3. **`#416` (`76865759`, GIT-9):** Only removed `.modern-git-drawer` rules in `large-screens.css`; it did **not** cause any part of `UI-32`.

## Changes

- **Toolbox frame & scroll edge cues (`ModernToolStation.tsx`, `lib/scroll-edge-cue.ts`, `toolbox-dock.css`, `recovered-surfaces.css`, `hud.css`, `finishing.css`):** Moved the outer `1px` border, border-radius, background, and elevation onto `.toolbox-rail > .workbench-station.modern-tool-station:not(.toolbox-minimized)` and removed duplicate borders/top-bottom padding on `.modern-toolbox`. Added `scrollEdgeCue()` + scroll/`ResizeObserver`/capturing `toggle` listeners driving `data-scroll-top` and `data-scroll-bottom` to render sticky `16px` surface edge fades (`var(--s1)`) inside the frame, and raised `.toolbox-rail` bottom clearance (`max(58px, ...)` desktop; `max(96px, ... + 48px)` at `<= 820px`) plus `top: calc(var(--workspace-header-h, 70px) + 66px)` on narrow viewports so the frame clears both the header Review/Git button and bottom controls.
- **Bottom-right control group (`Viewer.tsx`, `History.tsx`, `recovered-surfaces.css`, `large-screens.css`):** Added `.history-follow-slot` inside `.transport.history-transport` before `<LiveWatch />` and portaled `.follow-pill` into it in Modern history/live mode so the jump-to-latest button and `Follow latest` switch form a single flex group (`gap: 8px`, matching `34px` heights, zero overlap regardless of unread step badge width). Shifted both `.history-transport` and replay-mode `.follow-pill` (`bottom: 92px`) by `--stage-edge` under `[data-stage-limited]`.

## Real-session verification (scratch store, no journal content printed)

| Harness | Recording prefix | Source prefix | Bytes | Observations | MCP servers / tools |
|---|---|---|---:|---:|---:|
| Claude Code | `rec_210973b8` | `c757fa6a` | 245,921,792 (234.53 MiB) | 5,044 | 29 MCP servers (incl. `Claude_Browser`), 176 tools |
| Codex | `rec_fa9e37da` | `01a1b6ba` | 41,147,520 (39.24 MiB) | 459 | 5 MCP servers, 14 tools |

- **Matrix (36/36 measured checks passed, zero overlaps, zero clipped borders/footers):**
  - **Viewports & zoom:** `1440×900`, `1440×620`, `600×900`, `600×640`, `3840×1600`, plus 67% zoom (`2149×1343` & `896×1343`, `dpr: 0.67`).
  - **Palettes & skins:** `jet` (Jet Black), `paper` (Daylight), `midnight` (Midnight), plus `clarity` (`1440` & `600`).
  - **States:** MCP drawers closed and open (scroll top, middle, and footer bottom reachable with full `1px` outer border + scroll edge cues), composer minimized, expanded, and absent (`?demo` at `1440` & `600`).
  - **Measured geometry:** arrow-to-switch gap consistently `8px`, vertical center delta `0px`, zero overlap across `.follow-pill`, `.workspace-follow`, `.modern-tool-station`, and `.catalog-toggle`. Private screenshots stored in `.local/ui-32/`.

## Automated checks

- `corepack pnpm typecheck`: passed (`@drishya/daemon` / root + `@drishya/ui`).
- `corepack pnpm ui:build`: passed.
- Unit tests (`vitest run test/scroll-edge-cue.test.ts test/collection-bounds.test.ts test/stage-geometry.test.ts`): **9 passed / 0 failed**.
- Targeted browser batch (`DRISHYA_BROWSER_CHANNEL=msedge DRISHYA_WORKERS=2`, 10 specs: `toolbox-window`, `large-screens`, `composer-grows`, `fresh-workspace`, `palette-contrast`, `agent-inventory`, `connected-workspace`, `hover-inside-window`, `product-workspace`, `workspace-real-review`): **164 passed / 15 existing skips** before fixing the new `Playback` tab + scroll-detach step in `tests/browser/toolbox-window.spec.ts:333-338`, followed by `tests/browser/toolbox-window.spec.ts`: **10 passed / 0 failed** (covering dark/light/midnight borders, scroll cues, reachable footer, 600px live badge + expanded composer, 1440px, 3840px stage + replay transport + exit replay, `?demo` at `1440`/`600`/67% zoom).
- Not run: full browser gate (per house rules), hosted CI (per house rules).
