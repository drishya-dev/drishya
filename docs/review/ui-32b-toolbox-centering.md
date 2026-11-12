# UI-32b — Toolbox vertical centering and zero screen shift

Yash with Gemini 3.8 Flash, 12 November 2026 (`gemini/ui-32b`, PR #424). Whole item complete for Opus review and merge; no merge by agent.

## Root causes

1. **44 px layout/scroll jump on Follow toggles (`SessionWorkspace.tsx`, `PromptRail.tsx`):** Recordings with past `queue-operation` receipts keep `.queued-input-receipts` mounted even while idle (`data-waiting` unset), hidden in Modern with `opacity: 0` when not waiting. When Follow toggled off, `QueuedInputs.tsx` also toggled `visibility: hidden` on the button, causing `PromptComposer` in `SessionWorkspace.tsx` to drop `--composer-raised-gap` from `44 px` to `0 px`. Because `.history-inner` (`hud.css`) and `.toolbox-rail` read `--composer-raised-gap`, toggling Follow shifted `history.scrollTop`, the first visible passage, and `.modern-tool-station` height/position by `44 px`. Additionally, `PromptRail.tsx` initialized `bottom = 48` instead of `58` (the cleared height above `.history-transport`), causing a `10 px` rail jump when `.follow-pill` appeared or disappeared.
2. **Toolbox sitting ~95 px above vertical midpoint (`toolbox-dock.css`, `ModernToolStation.tsx`):** On wide viewports (`>= 1020 px`), the centered `590 px` composer never shares columns with the right-hand Toolbox (`1240..1422 px`), yet `.toolbox-rail` still applied `--composer-gap + --composer-raised-gap` (~`266 px`) bottom clearance instead of `58 px` (`96 px` during replay transport). Flex `justify-content: center` then centered inside that truncated band (`midY = 355 px` instead of `450 px` at `1440×900`).

## Changes

- **Stable clearances (`SessionWorkspace.tsx`, `PromptRail.tsx`):** Keep `--composer-raised-gap` constant for `.queued-input-receipts` across Follow toggles so history padding, scroll position, and Toolbox never shift; start `PromptRail` clearance at `bottom = 58 px` so `.follow-pill` mount/unmount never moves prompt ticks.
- **Viewport Y-axis centering (`toolbox-dock.css`, `ModernToolStation.tsx`):** Release `.toolbox-rail` bottom clearance to `58 px` (`96 px` when `.modern-replay-transport` is shown) on wide viewports (`min-width: 1020px`) where Toolbox and composer never share horizontal columns, switch `.toolbox-rail` alignment to `flex-start`, and compute `--toolbox-center-top` from `innerHeight / 2 - boxHeight / 2 - railRect.top` clamped inside `[0, railRect.height - boxHeight]` across resize, disclosure toggles, container/content `ResizeObserver` events, 600 px drawer class changes, and pre-paint disclosure recentering (using unscaled `offsetHeight`).

## Real-session verification (scratch store, no journal content printed)

| Harness | Recording prefix | Bytes | Widths & palettes | Toolbox `midY` error vs expected | Follow OFF/ON shift |
|---|---|---:|---|---:|---:|
| Claude Code (`42a5fd26`) | `rec_061e5f2d` | 7,150,502 | `1440×900`, `600×900` × `jet`, `midnight`, `paper` | `0 px` | `0 px` |
| Codex | `rec_7cb1cda1` | 15,023,432 | `1440×900` (`midY=450`), `600×900` × `jet`, `midnight`, `paper` | `0 px` | `0 px` |

## Checks

- `corepack pnpm typecheck`: passed (`@drishya/daemon` / root + `@drishya/ui`).
- `corepack pnpm ui:build`: passed.
- UI units (`vitest run apps/ui/test`): **116 files / 570 passed / 1 existing skip**.
- Targeted Edge browser specs (`toolbox-window`, `approval-clearance`, `composer-grows`, `large-screens`, `connected-workspace`, `agent-inventory`, `palette-contrast`, `b4-history`, `hover-inside-window`; `DRISHYA_BROWSER_CHANNEL=msedge DRISHYA_WORKERS=2 --retries=0`): **68 passed / 0 failed**.
- Not run: full browser gate (per house rules), hosted CI (per house rules), `package:verify` (ingest/store/packaging untouched).
