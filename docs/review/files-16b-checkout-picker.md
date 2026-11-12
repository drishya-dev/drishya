# FILES-16b · Worktree Checkout Picker Naming & Bounds

Yash, 12 Nov: every row in the Files checkout picker read `drishya` until hovered, and long lists ran past the window.

## What changed

- Added [`buildCheckoutPickerModel`](../../apps/ui/src/lib/checkout-picker.ts) and [`filterCheckoutOptions`](../../apps/ui/src/lib/checkout-picker.ts):
  - Every listed checkout receives a unique human-distinguishable label without hovering: recorded `branch` (excluding detached `HEAD`) disambiguated with `branch · <slot>` on duplicate branches; worktrees under `…/worktrees/<slot>/<repo>` with shared repository basenames labeled by `<slot>` (further qualified with harness container if cross-harness slots collide); and non-worktree directories labeled by their shortest unique path tail.
  - The session's own checkout names its folder visibly while keeping `aria-label="Session checkout"` and `Session checkout` role attribution alongside its quiet metadata line (`[branch · ] remaining tail · N files`).
  - Present roots appear first (`lastFileSequence` desc); missing/unavailable roots sort last under an explicit `Unavailable on disk` (`role="separator"`) divider.
  - Shows an auto-focused filter field at the top when more than 8 checkouts are recorded, with `ArrowDown`/`ArrowUp` keyboard navigation between filter and enabled options and local `Escape` dismissal on open pickers (preserving the Files drawer behind it).
- Bounded the menu cleanly in [`SessionWorkspace.tsx`](../../apps/ui/src/components/SessionWorkspace.tsx) and [`worktree-evidence.css`](../../apps/ui/src/components/worktree-evidence.css):
  - Caps height dynamically above `.prompt-composer` and within the viewport (`min(360px, available)`), scrolls inside `.checkout-picker-list` with `flex: 0 0 auto` rows so options never squish or overlap vertically, overrides container input chrome so only one crisp focus ring/border appears, and expands `.folder-root` so short active names like `drishya` never truncate in the summary button.

## Verification

- **Units:** `apps/ui/test/checkout-picker.test.ts` (`6/6` pass) and `apps/ui/test/worktree-files.test.ts` (`29/29` pass).
- **Real local sessions (scratch home, `600` & `1440` px across `jet`, `midnight`, `paper`, private frames in `.local/`):**
  - Codex `52-86a4` (`rec_32f628ee`, 892.7 MB, 51 roots: `drishya`, `ship-2e`, `files16-nov11`, `ship16a-nov11`, `ship16b-nov11`, `review-search-context/drishya/apps/ui`, etc.): `51/51` unique titles without hover, filter input shown, `Unavailable on disk` divider active, height `360px` (`top: 181, bottom: 541`, composer top `842–850`), switch updates `<summary>` cleanly.
  - Codex `73-9ba5` (`rec_58787f2c`, 31.3 MB, 6 non-worktree dirs): `6/6` unique shortest path tails (`College`, `Mini_Project_Document_Summarization`, `Mini_Project_Document_Summarization/Report`, `Mini_Project_RouteLab/Report`, etc.).
  - Claude Code `80-b172` (`rec_5ee6b391`, 8.1 MB, 7 branch worktrees): `7/7` unique titles (`reverent-nobel-7534b9`, `claude/ui-28c-composer-toggle`, `claude/ui-28b-composer-grows · src`, `claude/ui-28b-composer-grows · components`, etc.), `Unavailable on disk` divider shown, switch updates `<summary>`.
  - Claude Code `13-bd2d` (`rec_be806b25`, 8.2 MB, 6 worktrees): `6/6` unique titles (`claude-be80`, branch worktrees).
- **Automated checks (`gemini/files-16b` merged with `origin/main`):**
  - `pnpm check:real -- worktree-roots --max-mb 400`: PASS (`codex` `rec_73cbf2eb`, `claude-code` `rec_ebc58aff`; >400 MB `52-86a4` verified via scratch harness above).
  - `pnpm check:affected` (`Edge`, `2` workers): typecheck PASS, related units (`7/7` pass), `ui:build` PASS, `11` browser specs (`29/29` pass, `0` retries).
  - Targeted checkout specs (`Edge`, `2` workers): `files-16-picker.spec.ts` (untouched), `files-16b-picker.spec.ts` (new), `files-15-checkout.spec.ts`, `checkout-connection.spec.ts`, `files-7-main-root-aliases.spec.ts` — `14/14` pass.
  - Not run: full suite gate and hosted CI.
