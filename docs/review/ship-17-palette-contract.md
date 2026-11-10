# SHIP-17 — Modern palette contract

Draft for Yash and Opus review. Release 1 uses Modern. UI-8 already walked the seven presets on real Claude Code and Codex recordings at 1440 px and three at 600 px. It reported a lowest measured solid-token contrast of 4.78:1. The Release 1 review still found dark card text muddy beside Daylight. The new contrast pairs guard legibility, while the palette decision also depends on side-by-side reading. [UI-8 evidence](ui-8-surface-pass.md#git-graph-one-original-switch-palettes-screen-trail-338341-4-nov) · [Release 1 review](release-1-scope.md)

## Release candidates

Keep all seven existing preferences available for the review. Nominate Jet Black and Daylight as the core dark and light pair, with Daylight as the comparison baseline. Midnight, Orchid, Royal, Emerald and Ember are candidates for retention if their evidence is equally clear and their accent earns a separate preset. Jet Black stays the default. The existing stored System preference still resolves to Jet Black or Daylight with the OS scheme. SHIP-21 records the final decision and keeps the saved preference fallback valid if a preset is retired.

| Settings name | Stored ID | Palette ID | Direction |
| --- | --- | --- | --- |
| Jet Black | `dark` | `jet` | Neutral graphite and indigo. More separation among source syntax hues. |
| Daylight | `light` | `paper` | Cool paper and blue. Reference for quiet chrome and readable materials. |
| Midnight | `midnight` | `midnight` | Navy and sky blue. Give functions a separate violet hue. |
| Orchid | `mocha` | `mocha` | Violet-black and rose. Keep syntax and active control colours distinct. |
| Royal | `tokyo` | `tokyo` | Cool white and deep blue. Check that it earns a place beside Daylight. |
| Emerald | `nord` | `nord` | Green-black and emerald. Keep blue functions distinct from green keywords. |
| Ember | `gruvbox` | `gruvbox` | Warm black and orange. Let cool property and type ink balance the warm literals. |

Use the existing Modern sans, Segoe UI Variable Text with its system fallback, for interface and prose. Use the already distributed JetBrains Mono as the proposed single face for code, commands and paths. Keep the current size scale. SHIP-17 changes colour declarations only, so the existing font resolution remains in effect for the preview. The type choice is part of the brief review.

## Colour roles

| Material | Role and application |
| --- | --- |
| Primary content | `--text-primary` (`--t1`) for prose, prompt text, source text, titles and main values. Body text needs at least 4.5:1 on the actual surface. |
| Secondary content | `--text-secondary` (`--t2`) for supporting copy and useful counts or values. Use tabular figures for aligned numbers. Supporting body copy needs at least 4.5:1. |
| Metadata | `--text-muted` (`--t3`) for timestamps, provenance markers and line numbers. Metadata needs at least 3:1. Keep the existing 4.5:1 automated checks on the base and raised surfaces. |
| Chrome | `--text-chrome` (`--t4`) for quiet utility marks. Use primary or secondary ink for actionable labels. Retain the canvas and material values `--bg`, `--s1`–`--s3`, neutral hairlines `--line`–`--line-3` and `--focus` for keyboard focus. `--palette-active` is accent paint. Measure any text placed on it. |
| Paths | `--source` for source and verified path links. Keep existing affordances and provenance. Use secondary or muted ink for incidental path fragments. |
| Numbers and syntax | `--syntax-number` for numeric literals. Use `--syntax-keyword`, `--syntax-string`, `--syntax-function`, `--syntax-type` and `--syntax-property` for their captured source roles. Comments use `--text-muted`. Use colour within the existing syntax classifier. |
| Diffs | `--diff-added` and `--diff-removed` for signs and coloured line ink, with their matching `-wash` backing. Keep context and ordinary line text in primary ink, plus visible signs or labels. Measure ink over the composed wash. |
| Outcomes | `--pass` and `--fail` for recorded outcomes, with the existing `--pass-wash` and `--fail-wash` where used. `--edited` marks changes and `--external` marks external tool material. Retain text labels and existing shapes alongside colour. |
| Agent identity | `--agent-claude-ink` is warm and `--agent-codex-ink` cool. The four `--agent-*-ink` fallback hues support a stable harness assignment. Unattributed material uses muted ink. Subagent tint should preserve family hue and readable contrast. |

Modern's shared role declarations live in `tokens.css`. The active per-palette values and the existing syntax selectors live in `modern/theme-presets.css`. Keep derivations on the same root as their selected palette values. Use role tokens at the point of consumption. Compose washes from role colours and use palette-neutral backdrop and shadow roles when migrating those consumers. Check the composited result wherever translucency sits over a map, card or image.

## Adoption boundaries

- **SHIP-18** adopts these roles in shared styles and History. Compare captured read, diff and outcome material on its real backing. Keep prose and turn layout and the motion timing with their owners.
- **SHIP-19** adopts them in Home, shell, Settings, composer and overlays. Check labels, values, swatches, focus and translucent chrome against the contents underneath.
- **SHIP-20** adopts them in captured readers, Workspace, file evidence, replay, search and Screen. Check code and diffs in each reader, including current and captured files. Keep evidence labels and media colours truthful.
- **SHIP-21** adopts them in active Git and agent identity paint, including Now. Keep stable identity assignments when reading a palette in a DOM or canvas consumer. Audit the active shipped source for raw colour outside the token owners. Decide the shipped presets with Yash and record Opus sign-off from the private comparisons.

## Pending verification

Execution is deferred for this code-first draft. Start in the candidate worktree with Node 24 and an independent frozen install.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm exec vitest run apps/ui/test/palette-contrast.test.ts
corepack pnpm ui:build
corepack pnpm exec playwright test tests/browser/palette-contrast.spec.ts
corepack pnpm check:real -- content-parity
corepack pnpm check:real -- workspace-files
```

The unit covers all seven presets on the canvas and three raised surfaces, including the separate syntax and agent inks and the composed diff washes. The existing browser contrast checks retain their 4.5:1 floor. The real-case commands locate and count candidate material. Use an isolated redacted store for the rendered review, since those commands clean up their own scratch homes.

For each harness, select a genuine recording with prose, source syntax, paths, a diff and passing and failing outcomes. Include a child agent where available and record a genuine case in a throwaway repository if a required case is missing. At 600 and 1440 px, capture Daylight and each candidate at the same History anchor with the same materials expanded. Sample actual foreground against rendered background for body and metadata, including the wash and header above a passing card. Check readable syntax roles and identity hues, distinguishable diff signs, outcome labels, and quiet chrome. Record only prefixes, byte sizes, counts, measured ratios and any gaps. Keep frames in the ignored `.local/` directory and have Opus review the same pairs before rollout.

After the palette adoption batch is ready, run one full local gate in an isolated worktree. The browser command rebuilds the UI and uses the measured three-worker Windows configuration with its existing serial pass.

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
