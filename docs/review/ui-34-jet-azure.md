# UI-34 — Jet Black azure accent

**Task:** Replace Jet Black's indigo accent (`#8b92ec` focus / `#5e6ad2` active & swatch) with the site's azure accent (`#4f9cff`) and partner cyan (`#34d6e6` for two-tone data displays), keeping semantic meanings (`--source`, `--pass`, `--fail`, `--edited`, agent inks) intact and Daylight / Midnight unchanged.

## Changes

- **`apps/ui/src/tokens.css`**: updated `[data-palette=jet]` `--focus` (`#4f9cff`), `--palette-active` (`#4f9cff`), `--accent-partner` (`#34d6e6`), and `.theme-dark --swatch-accent` (`#4f9cff`).
- **`apps/ui/src/modern/theme-presets.css`**: derived `--accent-hover`, `--accent-pressed`, `--accent-tint`, and `--accent-tint-strong` from `--focus`; applied azure hover/pressed states and press transitions to `.btn.primary` and `.prompt-composer .send-prompt`; set unstyled links to `var(--focus)`; extended the palette-accent active-control and switch rules (`.mini-switch.on`, `.workspace-grant`, `.workspace-toggles button[aria-pressed="true"]`, `.atlas-eyebrow`, `.atlas-ref>span`, `.atlas-commit[aria-pressed=true]`, `.commit-row[aria-pressed=true]`, `.history article.op[data-search-hit]`) to `[data-palette=jet]` so `--source` (`#80b8ff`) remains distinct for file-reads and paths.
- **`apps/ui/src/components/recorded-usage.css`**: bound `[data-tone="1"]` in `/context` usage bars and legend swatches to `var(--accent-partner, color-mix(in srgb, var(--focus) 78%, var(--s3)))`, using `#34d6e6` on Jet Black while leaving Midnight and Daylight unchanged.
- **`apps/ui/src/components/ProductShell.tsx` & `docs/review/ship-17-palette-contract.md`**: updated `"indigo"` labels/description for Jet Black to `"azure"`.

## Measured contrast and separation on Jet Black

- `--focus` / `--palette-active` (`#4f9cff`) on `--bg` (`#000000`) / `--s1` (`#121212`) / `--s2` (`#1a1a1a`) / `--s3` (`#232326`): **7.53:1 / 6.72:1 / 6.24:1 / 5.62:1** (>= 4.5:1 text and >= 3:1 focus).
- Primary foreground (`#000000`) on `#4f9cff`, hover (`#67a9ff`), pressed (`#4283d6`): **7.53:1 / 8.68:1 / 5.62:1** (>= 4.5:1).
- `--accent-partner` (`#34d6e6`) on `--bg`..`--s3`: **11.91:1..8.89:1**.
- `--focus-ring` (`color-mix(in srgb, #d0d1d9 82%, transparent)`) on `--s3`: **>= 3:1**.
- OKLab distance from `--focus` (`#4f9cff`) to `--source` (`#80b8ff`): **0.094** (>= 0.06).
- `git grep -i "5e6ad2|8b92ec|indigo"` across `apps/`: **0 matches** in shipped code (only unit test assertions verifying their absence and unrelated synthetic SCSS text in `tests/browser/file-icons.spec.ts`).

## Verification

- **Real local sessions** (scratch store, `.local/ui-34/`, before & after at `600×900` and `1440×900` across History + composer, Files, Changes, Git graph, and Settings in Jet Black):
  - Claude Code `rec_5ee6b391` (2,400 observations)
  - Codex `rec_8415940e` (263 observations)
- **Unit & build checks**: `corepack pnpm typecheck`, `corepack pnpm ui:build`, `apps/ui/test` (**118 files, 581 passed, 1 existing skip**, including updated `palette-contrast.test.ts` and `palette-paint-policy.test.ts`).
- **Browser specs** (`DRISHYA_BROWSER_CHANNEL=msedge`, 3 workers): `palette-contrast.spec.ts`, `focus-rings.spec.ts`, `fresh-workspace.spec.ts`, `settings-typography.spec.ts`, `workspace-real-review.spec.ts`, `git-graph-focus.spec.ts` (**94 passed, 15 existing skips, 0 failures, 0 retries**).
- **Not run:** the full browser gate (runs once per batch of finished tasks).
