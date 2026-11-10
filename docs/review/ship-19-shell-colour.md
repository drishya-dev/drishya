# SHIP-19 — Shell, Home and overlay colour adoption

Taken over from Codex by Claude Sonnet 5.5 with Yash, 10 Nov. Applies the SHIP-17 roles ([contract](ship-17-palette-contract.md)) and the 10 Nov hierarchy rules to Home, the shell, Settings and the dialogs and menus that open over a session. Colour and weight only: no layout, controls, spacing, layer or motion, and no new boxes.

## What changed

New Modern sheet `apps/ui/src/modern/shell-ink.css` (imported after `history-ink.css`):

| Material | Ink and weight |
| --- | --- |
| Home wordmark | `--text-primary` (Jet had a hard-coded warm white) |
| Harness marks on Home | `--agent-claude-ink` and `--agent-codex-ink`, the stable identity inks (they used `--edited` and `--focus`, unrelated meanings) |
| Home and dialog titles, session titles, option names | `--text-primary`, weight 500 to 600 |
| Supporting copy in dialogs | `--text-secondary` |
| Counts, times, group labels, notes | `--text-muted` |

Literal-colour audit of the listed sheets, scoped to what paints Home, shell and overlays:
- Removed 14 dead `.tk-*` colour literals in `modern/workspace-chrome.css`: the palettes own syntax ink since SHIP-17 and already won on specificity.
- `modern/surroundings.css` dark `--modern-accent:#8cdec4` is now `var(--focus)` (the palette value already won).
- `polish.css` Jet `.brand` literal is now `--text-primary`.
- The rest are black shadows, masks and fallback values behind a variable (`reliability.css`), which are palette-neutral and left as they are.

A Home contrast spec flipped `data-palette` without `data-theme`, so Daylight measured the dark theme's agent ink (1.84:1). It now sets both, as the app does, and is renamed to the three shipped palettes.

## Verification

- Ink mapping per element measured on Home, Settings and About in the running app before and after.
- Frames of Jet Black, Midnight and Daylight at 1440 and 600 px in the ignored `.local/ship-19/compare/`, over the genuine Claude Code `rec_f230ca48` and Codex `rec_44739d61` (Home lists the local sessions of both harnesses): Home, About, Settings (Appearance, Reading), Search, Navigator, Shortcuts, session menu, Toolbox. Frames before the change are in `frames-before/`.
- Gaps: a standalone composer frame could not be recaptured (the opened state persists and its scene times out); the opened composer is visible behind the dialogs in the Midnight and Daylight Settings frames. Usage and the card menu were not captured as separate scenes.
- Specs: see the PR.
