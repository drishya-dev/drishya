# SHIP-21 — Product palette completion

Yash with Codex, 11 November. Expanded by Yash to cover product-wide colour literals, strict shared floors and three finished palettes. Colour only: no layout, spacing, typography or motion changes. The toolbox rail, `large-screens.css`, protected files and other active claims remain untouched.

| Before | After | Why |
| --- | --- | --- |
| Palette paint split between presets and tokens | Palette values owned by `tokens.css` | One place to tune and verify paint |
| Daylight meaning inks checked at 4.5:1 | All palettes checked at 7:1 and chroma 0.09 | The explicit 11 November acceptance floor |
| Midnight is close to graphite/teal | Clearly navy canvas and raised surfaces | A distinct option rather than a near-duplicate |

## In progress

- Three palette blocks and their exact Settings previews moved into the token sheet. Daylight's syntax/meaning inks strengthened; type/property/function colours remain distinguishable. Midnight has navy surfaces and blue-neutral text/chrome. Existing primary/secondary/metadata, diff-wash, syntax-separation and deuteranopia guards remain.
- Strict palette unit passes. Literal migration and renderer bridges are built; 18 focused units pass, including a product-wide CSS literal guard. Remaining: combined real-session frames, affected/targeted browser checks and Opus sign-off.
- Inventory includes 806 literal occurrences across 35 non-Clarity source files before classifying shadows, masks, fallback values, inactive selectors and non-paint regexes. The user's approximate 259 count is not treated as an exact acceptance count.
- Baseline running app inspected on genuine Claude `rec_39af3c94` and Codex `rec_7cb1cda1` in a scratch home. Real content is not printed; private screenshots remain in `.local/`.

## Order and boundaries

SHIP-16 workflow is already merged in #388; its candidate/platform walk remains phase E. Continue SHIP-21, SHIP-3, then FILES-15, then MOTION-4 after the LAYOUT-1b redo is merged. FILES-15 keeps the session's own checkout as its file system and repository, with collapsed, file-evidence-only worktree groups; switching is FILES-16 after release. Extra themes remain optional after the assigned current work.

Known toolbox-rail pointer interceptions are reported, not fixed here and not clean-main-compared. SHIP-20's report lists the exact prior cases, including the non-rail baseline failures. No green product-wide gate or platform acceptance is implied.

## Migration record

- 564 declarations in 15 stylesheets now reference palette roles. 260 root bootstrap defaults were lifted verbatim into tokens.css to avoid self-referential variables in older root rules; the selected Modern palettes override these bootstrap values. This preserves old selector/default behaviour without retaining a second paint source. Shadows, masks, Clarity and non-paint parsing regexes are explicit audit exceptions.
- Agent families use palette identity roles and tint toward primary ink, so Daylight no longer blends them toward white. The active-tab mark and SVG Git ribbons use token paint. WebGL receives RGB from a DOM token boundary; the Git geometry function stays pure and takes palette data explicitly. Cached colours refresh on theme change, not on pan/hover.
- No geometry, layout, spacing or animation declarations changed. The renderer's existing material colours move to uniform inputs; no shape, topology, motion or blend timing changed.
- LAYOUT-1b redo is now merged in #409 (`15b0582e`), verified through origin/main history and integrated before acceptance. This task does not edit its rail or large-screen rules. Later order remains SHIP-3, FILES-15, then MOTION-4.
