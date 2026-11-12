# SHIP-6g · Layers stack correctly — Review Record

**Branch:** `gemini/ship-6g`
**Status:** Ready for review
**Scope:** Modern stacking hierarchy across open session/header menus, bottom-right floating controls (`.follow-pill`, `.history-transport`, `.queued-input-receipts`), narrow Files overlay scrim (`.files-scrim`), and empty/non-empty `Queued inputs` rendering.

## Root Causes Found

1. **Session menu & popovers vs bottom-right controls (`z-index` inversion):** Open header menus (`header details[open]`) previously sat below `.follow-pill`, `.catalog-toggle`, and floating `.queued-input-receipts` (`z-index: 22` / `30`+) or had `.product-menu-surface` clipped beneath fixed chrome at narrow widths (`600 px`).
2. **Narrow Files overlay had no backdrop scrim:** When `.folder-explorer` opened over History below `900 px`, History prose ran directly against the drawer edge with no dimmed scrim (`--bg` at ~53% alpha) and no backdrop pointer dismissal, whereas switching to Developer Workspace (`!developerWorkspace`) or `1000 px` docked `Files + File peek` shouldn't dim the stage. Adding `.files-scrim` also required lifting `.workspace-leading` and `.workspace-secondary` (`z-index: 38`, matching `.workspace-header`) so the `Files` / `Repository` / `Git` / `Compare` triggers and Developer Workspace switches remain clickable above the scrim.
3. **Loose `Queued inputs` text and Replay bar collision:** Even with an empty queue (`.queued-input-receipts`), the wrapper stayed mounted and was only hidden under narrow CSS selectors, leaking bare `"Queued inputs"` label text at the bottom right and sitting without clearance above `.modern-replay-transport` + `.follow-pill` in Replay mode (where `QueuedInputs` portals to `document.body`).

## Changes Made

- `apps/ui/src/components/QueuedInputs.tsx` & `apps/ui/src/components/queued-inputs.css`: return `null` when `!waiting && !error && !open` so empty queues emit zero DOM/text while preserving open queue readers; replace inline positioning styles with `data-floating` and `.queued-input-trigger` (token-only `--s1` surface, `1px solid var(--line-2)`, `--round-full`, `30px` pill).
- `apps/ui/src/modern/recovered-surfaces.css`: lift `:root[data-ui-version=modern]:has(.connected-workspace .modern-replay-transport):has(.connected-workspace .follow-pill) .queued-input-receipts[data-floating]` to `bottom: 134px` so portaled Replay receipts clear both the Follow pill and the Replay transport bar.
- `apps/ui/src/components/SessionWorkspace.tsx`: render `.files-scrim` only when `modern && shown && !developerWorkspace && narrow`, with pointerdown dismissal (`closeExplorer(true)`).
- `apps/ui/src/modern/large-screens.css` & `apps/ui/src/modern/reading-windows.css`: establish one Modern z-index ladder (`12` composer -> `16` Follow/transport/Toolbox toggle -> `22` Replay transport & floating queue pill -> `30` map reader -> `34` `.files-scrim` -> `35–36` `.folder-explorer` -> `38` `.workspace-header`, `.workspace-leading`, `.workspace-secondary` while scrim active -> `45` origins -> `70` open `details[open]` menus/popovers).
- `tests/browser/ship-6g-layers.spec.ts`: new Edge browser spec asserting corner `elementFromPoint` hit-testing on Session menu (`Usage`, `Session details`, `Export recording`) over Follow/Tools/Replay at `600` & `1440 px`, waiting `Queued inputs · 1` clearance, zero `"Queued inputs"` text on empty queue, and `.files-scrim` backdrop dismissal + menu dominance at `600 px`. Updated `tests/browser/approval-clearance.spec.ts` and `tests/browser/live-captured-text.spec.ts` for empty-queue omission.

## Verification

- `corepack pnpm typecheck`: **PASS**
- `corepack pnpm exec vitest run apps/ui/test/`: **PASS** (`119` files, `587` passed, `1` skipped)
- `corepack pnpm exec vitest run packages/ apps/daemon/`: **PASS** (`118` files, `894` passed)
- `corepack pnpm test:browser tests/browser/ship-6g-layers.spec.ts tests/browser/approval-clearance.spec.ts tests/browser/live-captured-text.spec.ts tests/browser/session-menu.spec.ts tests/browser/recorded-usage.spec.ts tests/browser/toolbox-window.spec.ts tests/browser/fresh-workspace.spec.ts tests/browser/palette-contrast.spec.ts tests/browser/connected-workspace.spec.ts --retries=0` (`DRISHYA_BROWSER_CHANNEL=msedge`, includes `ui:build`): **PASS** (`147` passed, `1` existing fixture skip in `recorded-usage.spec.ts:142`, `0` failures)
- Real-session verification in scratch store (`claude` `rec_1f7f` / `18e90881*`, `3,510,156` bytes; `codex` `rec_1394` / `01a1b0ce*`, `825,746` bytes) across `600` & `1440 px` and `jet` / `midnight` / `paper`: `12/12` checks passed (`queueText=0`, `replayQueueText=0`, `waitingStep=1`, `menuFails=[]`, `filesScrim=files-scrim`, `menuOverFiles=[]`). Private screenshots inspected via `read_file` in `.local/ship-6g/`.
- Not run: full 4-worker `pnpm test:browser` gate and `package:verify` (no capture/store/packaging files modified).
