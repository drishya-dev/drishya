# FILES-18 · A file's history reads newest first

## What changed

- [`packages/scene/src/file-timeline.ts`](../../packages/scene/src/file-timeline.ts): [`fileOperationPage`](../../packages/scene/src/file-timeline.ts#L21) now reverses matching operations into newest-first order before slicing the requested page (`start=0` is the latest action) while computing `timeline.positions`, `timeline.first`, `timeline.last`, `previous`, and `next` in chronological time order so `Previous change` moves to earlier edits (further down the list) and `Next change` moves to later edits (further up).
- [`apps/ui/src/components/FileHistory.tsx`](../../apps/ui/src/components/FileHistory.tsx): feeds chronological order into [`fileTimeline`](../../apps/ui/src/lib/file-timeline.ts) for fallback stepping, updates cross-page direction flags (`moreOlder` -> higher `start`, `moreNewer` -> lower `start`), and keeps `[aria-pressed="true"]` scrolled into view via `scrollIntoView({ block: 'nearest' })` both while stepping and when revealing the action list (`Show actions` on narrow widths). Because `page.operations` arrives newest-first, both the action list (including Peek / Workspace fallback) and `<select>` choices list newest-first and open on the latest step (`choices[0]`).
- [`apps/ui/src/components/file-reader-controls.css`](../../apps/ui/src/components/file-reader-controls.css): under `@media(max-width:899px)`, places `.file-timeline-steps` and `.file-evidence-actions` on separate wrapping rows so narrow widths (`600 px`) never overlap `Previous change` / `Next change` with `Open in Workspace` when a workspace notice is shown.

## Checks & real-session evidence

- `corepack pnpm typecheck` — passed.
- `corepack pnpm --filter @drishya/ui test -- --run` — passed (`file-timeline.test.ts` updated for newest-first pages + chronological time metadata).
- `corepack pnpm ui:build` — passed.
- Edge browser specs (`DRISHYA_BROWSER_CHANNEL=msedge DRISHYA_WORKERS=2`, `--retries=0`):
  - `file-timeline-steps.spec.ts`, `file-timeline-pages.spec.ts`, `files-navigation-roles.spec.ts`, `product-workspace.spec.ts` (**41 passed / 0 failed**)
  - `b2-live.spec.ts` (**3 passed / 0 failed**)
- Real local sessions in scratch Drishya home at `600` & `1440` px in `jet`, `midnight`, and `paper` (screenshots kept privately in `.local/files-18/`):
  - Claude Code (`rec_be806b25`, 8,426 KB, 14 actions on file): top row = latest op, opens on `14 of 14` (`Next change` disabled), stepping back advances downward (`[0..8]`) with selected row kept in view (`allInView: true`) in all 6 width/palette combinations.
  - Codex (`rec_7cb1cda1`, 14,671 KB, 12 actions / 10 read+edit steps on file): top row = latest op, opens on `10 of 10` (`Next change` disabled), stepping back advances downward (`[0,2,3,4,6,7,8,9,10]`, skipping non-evidence shell steps) with selected row kept in view (`allInView: true`) in all 6 width/palette combinations.
- Not run: full multi-spec gate, hosted CI, `package:verify`.
