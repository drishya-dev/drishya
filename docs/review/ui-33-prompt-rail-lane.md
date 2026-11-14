# UI-33 — Open Toolbox never covers the prompt rail

## Root cause

1. On high-DPI / constrained wide viewports (`[data-stage-limited]`, e.g. `1440×900` at `dpr=2`, `--stage-edge: 80px`), `.toolbox-rail` shifted inward by `--stage-edge`, while `.history-prompt-marks` (`stage.css:530`) stayed anchored with `right: calc(var(--stage-rail) + 8px)` without `--stage-edge`. As a result the ticks sat at `x ≈ 0.84` directly underneath the open `.modern-tool-station`.
2. Minimizing the Toolbox switched `--stage-rail` to `76px` (`hud.css:100`), jumping the prompt rail horizontally across the right side whenever collapsed/expanded.
3. Below `820px`, opening Tools (`.catalog-open`) placed the Toolbox at `right: 12px` over `.history-prompt-marks` at `right: 8px`.
4. `PromptRail.tsx` previously mounted `±2` overscan tick buttons past `<nav>`'s clip bounds, and its first pass (`viewport.top + ROW / 2`) still rendered boundary ticks clipped by `1–7px` inside `<nav>`. Hovering `first` or `last` after clicking a tick triggered browser `scrollIntoViewIfNeeded`, firing `<nav>.onScroll` asynchronously after `mouseenter` and calling `setPreview(undefined)` to hide `.prompt-rail-preview`.
5. `hud.css` also added `padding-right: calc(var(--stage-rail) + 32px)` on `.history` even though `.history` (`padding-right: var(--stage-rail)`) plus `.history-inner`'s `28px` inline padding already keeps cards `10px` clear of the open Toolbox (`right: 50px`, width `var(--stage-rail) - 32px`). That extra `32px` narrowed History at `1280×720`, pushing `b2-live.spec.ts`'s earlier `article.op-read` out of the overscan window.

## Changes

- [apps/ui/src/modern/hud.css](../../apps/ui/src/modern/hud.css): Gave `.history-prompt-marks` one invariant outer lane (`right: calc(14px + var(--stage-edge, 0px))`, clearing native scrollbars and preserving pointer room at the outer edge), while keeping `.history` `padding-right: var(--stage-rail)` so cards stay clear of the Toolbox without narrowing History's `1280px` measure.
- [apps/ui/src/modern/toolbox-dock.css](../../apps/ui/src/modern/toolbox-dock.css): Moved `.toolbox-rail` right inset from `18px` to `50px` (`inset-inline: 12px 50px` below `820px`, with `max-width: 100%`), keeping an `8px` clear lane beside the `28px` rail.
- [apps/ui/src/modern/large-screens.css](../../apps/ui/src/modern/large-screens.css): Set `.toolbox-rail` `right: calc(50px + var(--stage-edge))`.
- [apps/ui/src/modern/reading-windows.css](../../apps/ui/src/modern/reading-windows.css): Kept `.file-peek-open .complete-prompt-rail` on the same `right: calc(14px + var(--stage-edge, 0px))` lane.
- [apps/ui/src/components/PromptRail.tsx](../../apps/ui/src/components/PromptRail.tsx): Included `.modern-replay-transport` in bottom control clearance, rendered only unclipped visible ticks (`Math.ceil(viewport.top / ROW)` to `Math.floor((viewport.top + viewport.height) / ROW)` when scrolled, or all chapters when fitting within `clientHeight`), and scoped `onBlur` cleanup to the blurred ordinal so hover/click preview never disappears spuriously.
- [tests/browser/prompt-timeline.spec.ts](../../tests/browser/prompt-timeline.spec.ts): Updated bottom clearance assertion to `58` (matching `UI-32b`) and added `UI-33` rect/hit-test/invariance specs at `1440×900` (`dpr=1` and `dpr=2`) and `600×900`.

## Verification

- `corepack pnpm ui:build` — passed
- `corepack pnpm typecheck` — passed
- `corepack pnpm exec vitest run apps/ui/test/` — 119 files, 587 passed, 1 existing skip
- `DRISHYA_BROWSER_CHANNEL=msedge corepack pnpm test:browser tests/browser/prompt-timeline.spec.ts tests/browser/b2-live.spec.ts --repeat-each=5 --retries=0` — **25/25 `prompt-timeline` passed + 15/15 `b2-live` passed (0 failures, 0 retries)**
- 11-spec Edge browser batch (`prompt-timeline`, `b2-live`, `prompt-rail-evidence`, `toolbox-window`, `large-screens`, `hover-inside-window`, `composer-grows`, `workspace-real-review`, `approval-clearance`, `product-workspace`, `palette-contrast`, `--retries=0 --workers=3`) — 90 passed, 15 existing skips, 0 failures.
- Real sessions (scratch store only; `gap=8`, `badTicks=0`, `minMoved=false`, desktop `cardOverlap=0` across `1440×900` `dpr=1`/`2`, `1280×760`, and `600×900` in `jet`, `midnight`, `paper`; first & last ticks hovered/clicked with open Toolbox):
  - Claude Code `rec_cc00` (24.04 MB, 18 ticks): all 7 cells passed
  - Codex `rec_7cb1` (15.02 MB, 23 ticks): all 7 cells passed
  - Private verification captures kept in `.local/ui-33/` (uncommitted).
