# SHIP-17 — Modern palette contract

Release 1 uses Modern. The Release 1 review found dark card text muddy and content undifferentiated beside Daylight, so the contract fixes the ink and the face, not only the hue list. Opus reviewed the draft and set binding decisions ([#394 comment](https://github.com/drishya-dev/drishya/pull/394#issuecomment-6763280430), STATUS decisions log, 10 Nov). This page is the result. [UI-8 evidence](ui-8-surface-pass.md#git-graph-one-original-switch-palettes-screen-trail-338341-4-nov) · [Release 1 review](release-1-scope.md)

## Shipped palettes

Release 1 ships three. Orchid, Royal, Emerald and Ember are retired from Settings and can return after the release.

| Settings name | Stored ID | Palette ID | Direction |
| --- | --- | --- | --- |
| Jet Black (default) | `dark` | `jet` | Neutral graphite and azure (UI-34). |
| Midnight | `midnight` | `midnight` | Navy and sky blue. |
| Daylight | `light` | `paper` | Cool paper and blue. The light reference. |

The stored System preference still resolves to Jet Black or Daylight with the OS scheme. A stored retired preference resolves silently: `mocha`, `nord` and `gruvbox` to Jet Black, `tokyo` (Royal, a light palette) to Daylight. The map lives inside `storedTheme()` in `state.ts`, because the store calls it while the module is still initialising. A module-level constant is not yet defined at that point, the lookup throws and the catch returns Jet Black (the browser spec caught this).

## Ink floors

Measured on every surface (`--bg`, `--s1`, `--s2`, `--s3`), the card surfaces included. Asserted by `apps/ui/test/palette-contrast.test.ts` for all three palettes.

| Role | Floor | Measured minimum, worst surface (Jet Black / Midnight / Daylight) |
| --- | --- | --- |
| `--text-primary` | 13:1 | 14.3 / 14.7 / 13.6 |
| `--text-secondary` | 7:1 | 10.3 / 10.9 / 7.5 |
| `--text-muted` (metadata) | 4.5:1 | 6.9 / 7.2 / 5.1 |
| `--text-chrome` | 3:1, non-text marks only | 5.0 / 5.2 / 4.9 |
| Syntax, path, number, diff, outcome and agent inks | dark 7:1 with OKLCH chroma at least 0.09; Daylight 4.5:1 | dark at least 7.6 |

Further assertions: the six syntax inks differ pairwise by at least 0.06 in OKLab; pass and fail differ by at least 0.1 in OKLab after a deuteranopia simulation (Machado 2009, severity 1), which holds because the outcome inks differ in lightness and in the blue-yellow axis (mint and coral on dark, teal and red on Daylight); primary ink on a diff wash keeps 7:1 and the diff ink on its own wash 6:1 on dark. Prose, prompt text, titles and values use primary ink; secondary is for supporting copy.

Hierarchy comes from ink and weight, not boxes (Opus decision 4, applied by SHIP-18 and SHIP-19): prose headings in primary ink at weight 600; body prose in primary ink; inline code in `--source` ink on a faint wash of it; labels in opened surfaces in muted ink with their values in primary; card titles in primary, tool kind and provenance in muted.

## Type

The UI and prose sans is Inter (variable), bundled in `apps/ui/public/fonts/` as `InterVariable.woff2` with `Inter-OFL.txt`, the same files the landing site ships, and declared in `modern/settings.css`. The Segoe UI Variable stack stays as fallback, so a missing file degrades rather than breaks. JetBrains Mono stays the single mono. The size scale is unchanged: no layout moves, only the face.

## Colour roles

| Material | Role and application |
| --- | --- |
| Primary content | `--text-primary` (`--t1`) for prose, prompt text, source text, titles and main values. |
| Secondary content | `--text-secondary` (`--t2`) for supporting copy and useful counts or values. Use tabular figures for aligned numbers. |
| Metadata | `--text-muted` (`--t3`) for timestamps, provenance markers and line numbers. |
| Chrome | `--text-chrome` (`--t4`) for non-text marks only. Use primary or secondary ink for actionable labels. Retain the canvas and material values `--bg`, `--s1`–`--s3`, neutral hairlines `--line`–`--line-3` and `--focus` for keyboard focus. `--palette-active` is accent paint. Measure any text placed on it. |
| Paths | `--source` for source and verified path links. Keep existing affordances and provenance. |
| Numbers and syntax | `--syntax-number` for numeric literals. `--syntax-keyword`, `--syntax-string`, `--syntax-function`, `--syntax-type` and `--syntax-property` for their captured source roles. Comments use `--text-muted`. |
| Diffs | `--diff-added` and `--diff-removed` for signs and coloured line ink, with their `-wash` backing. Context and ordinary line text stay primary, plus visible signs or labels. |
| Outcomes | `--pass` and `--fail`, with `--pass-wash` and `--fail-wash` where used. `--edited` marks changes and `--external` external tool material. Keep text labels and shapes alongside colour. |
| Agent identity | `--agent-claude-ink` warm, `--agent-codex-ink` cool, four fallback hues for a stable harness assignment. Shared across palettes, so each clears the dark floors on both Jet Black and Midnight surfaces; Daylight overrides them in `tokens.css`. |

Shared role declarations live in `tokens.css`; per-palette values and the syntax selectors live in `modern/theme-presets.css`. Keep derivations on the same root as their palette. Use role tokens at the point of consumption and check composited results wherever translucency sits over a map, card or image.

## Adoption boundaries

- **SHIP-18** adopts these roles in shared styles and History, including the hierarchy above.
- **SHIP-19** adopts them in Home, shell, Settings, composer and overlays.
- **SHIP-20** adopts them in captured readers, Workspace, file evidence, replay, search and Screen.
- **SHIP-21** adopts them in active Git and agent identity paint, including Now, and audits active shipped source for raw colour outside the token owners. The shipped list is already settled here.

## Verification record

Taken over from Codex by Claude Sonnet 5.5 on 10 Nov (Codex limits exhausted). Node 24, own worktree with its own frozen install.

- `apps/ui/test/palette-contrast.test.ts` passes; the whole `apps/ui` unit suite passes (107 files, 516 tests, 1 skipped); typecheck clean; `ui:build` and `package:verify` pass.
- `palette-contrast.spec.ts` passes (7 tests, three palettes), including the new case: retired saved values fall back as above, Settings lists exactly Jet Black, Midnight and Daylight, and the body face resolves to Inter. The other palette-looping specs were reduced to the three shipped palettes.
- `check:affected`: 28 passed, 1 skipped, 4 failed (`b2-live.spec.ts:63`, `material-motion.spec.ts:132`, `p1-pacing.spec.ts:40` and `:266`). Run alone, the same four fail identically on clean `origin/main` (05f31308), so they are not caused by this change; they belong to TEST-2.
- `check:real` (`content-parity`, `workspace-files`) was not run: this change moves no data or projection. The rendered check used real sessions instead.
- Side-by-side frames of Jet Black, Midnight and Daylight on the same anchors at 1440 and 600 px, from four genuine local recordings imported into a scratch home (never the real one): Claude Code operations `rec_f230ca48` (0.4 MB, 6 operations: read, edit, passing and failing shell), Claude Code prose `rec_e1f36f6e` (2.8 MB, headings, tables, code), Codex operations `rec_44739d61` (1 MB, 22 operations: edit, test, passing and failing shell) and Codex prose `rec_7cb1cda1` (15 MB, bold, lists). Frames are in the ignored `.local/ship-17/`, composites in `.local/ship-17/compare/`.
- Gaps: no real Codex session renders a markdown heading (scanned every local Codex journal under 40 MB: one candidate, no heading element rendered), so the Codex prose anchor shows bold and lists. The Claude prose frame at 600 px has no prompt-capsule anchor. Opus sign-off from the frames is still required before SHIP-18 starts adopting.

After the palette adoption batch is ready, run one full local gate in an isolated worktree with its own install. The browser command rebuilds the UI and uses the measured three-worker Windows configuration with its existing serial pass.

```powershell
corepack pnpm check
$env:DRISHYA_WORKERS = '3'
try {
  corepack pnpm test:browser
} finally {
  Remove-Item Env:DRISHYA_WORKERS
}
corepack pnpm package:verify
```
