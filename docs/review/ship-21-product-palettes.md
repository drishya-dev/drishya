# SHIP-21 — Product palette completion

Yash with Codex, 11 November. Expanded by Yash to cover product-wide colour literals, strict shared floors and three finished palettes. Colour only: no layout, spacing, typography or motion changes. The toolbox rail, `large-screens.css`, protected files and other active claims remain untouched.

| Before | After | Why |
| --- | --- | --- |
| Palette paint split between presets and tokens | Palette values owned by `tokens.css` | One place to tune and verify paint |
| Daylight meaning inks checked at 4.5:1 | All palettes checked at 7:1 and chroma 0.09 | The explicit 11 November acceptance floor |
| Midnight is close to graphite/teal | Clearly navy canvas and raised surfaces | A distinct option rather than a near-duplicate |

## Implementation and evidence

- Three palette blocks and their exact Settings previews moved into the token sheet. Daylight's syntax/meaning inks strengthened; type/property/function colours remain distinguishable. Midnight has navy surfaces and blue-neutral text/chrome. Existing primary/secondary/metadata, diff-wash, syntax-separation and deuteranopia guards remain.
- Strict palette unit passes. Literal migration and renderer bridges are built; 18 focused units pass, including a product-wide CSS literal guard. The combined real-session set and targeted browser checks are complete. Opus palette sign-off remains an external acceptance step; the broad command is not green (details below).
- Inventory includes 806 literal occurrences across 35 non-Clarity source files before classifying shadows, masks, fallback values, inactive selectors and non-paint regexes. The user's approximate 259 count is not treated as an exact acceptance count.
- Baseline running app inspected on genuine Claude `rec_39af3c94` and Codex `rec_7cb1cda1` in a scratch home. Real content is not printed; private screenshots remain in `.local/`.

## Order and boundaries

SHIP-16 workflow is already merged in #388; its candidate/platform walk remains phase E. The latest order adds SHIP-16a after SHIP-21, then SHIP-3, FILES-15, LAYOUT-1c and MOTION-4. LAYOUT-1c measures the stage in device pixels, with no viewport-driven text scale. FILES-15 keeps the session's own checkout as its file system and repository, with collapsed, file-evidence-only worktree groups; switching is FILES-16 after release. Extra themes remain optional after the assigned current work.

Known toolbox-rail pointer interceptions are reported, not fixed here and not clean-main-compared. SHIP-20's report lists the exact prior cases, including the non-rail baseline failures. No green product-wide gate or platform acceptance is implied.

## Migration record

- 564 declarations in 15 stylesheets now reference palette roles. 260 root bootstrap defaults were lifted verbatim into tokens.css to avoid self-referential variables in older root rules; the selected Modern palettes override these bootstrap values. This preserves old selector/default behaviour without retaining a second paint source. Shadows, masks, Clarity and non-paint parsing regexes are explicit audit exceptions.
- Agent families use palette identity roles and tint toward primary ink, so Daylight no longer blends them toward white. The active-tab mark and SVG Git ribbons use token paint. WebGL receives RGB from a DOM token boundary; the Git geometry function stays pure and takes palette data explicitly. Cached colours refresh on theme change, not on pan/hover.
- No geometry, layout, spacing or animation declarations changed. The renderer's existing material colours move to uniform inputs; no shape, topology, motion or blend timing changed.
- LAYOUT-1b redo is now merged in #409 (`15b0582e`), verified through origin/main history and integrated before acceptance. This task does not edit its rail or large-screen rules. LAYOUT-1c must also precede MOTION-4; its device-pixel work is not part of this colour task.

## Genuine combined comparison

One scratch Drishya home, read-only native source imports, no native prompts or settings changes. **132 frames**, eleven surfaces × two genuine harnesses × three palettes × two widths (600 and 1440); **44 side-by-side strips**, Jet Black / Daylight / Midnight. All files remain private in `.local/ship-21/compare/`; numeric manifest `.local/ship-21/frames.json`. No page errors occurred.

| Harness | Recording prefix | Source bytes | Operations | File references |
| --- | --- | ---: | ---: | ---: |
| Claude Code | `rec_39af3c94` | 14,545,573 | 747 | 46 |
| Codex | `rec_7f72dcb0` | 1,981,961 | 38 | 3 |

Surfaces: Home, history, Workspace, Files, peek, Settings, session menu, Usage, search, Git review and Git graph. Both sessions have an existing checkout for current-file and read-only Git approval. Current files are shown as on-disk material, not historical bytes. Screenshots were inspected locally; no journal text is printed or committed.

The active Git-history surface is `GitNetworkGraph`. The retained `GitThreadGraph`/WebGL renderer also receives token paint, but these frames do **not** establish runtime acceptance of that retained renderer. Its deterministic model/cache tests, types and build are the recorded checks. The shared palette observer refreshes paint only after root palette attributes change, without touching pan/hover geometry.

## Checks and remaining review

- Both typechecks and UI build pass. `check:affected`: 25 related units pass in seven files. Separate focused palette/policy/Git/presentation run: 18 pass in four files.
- Focused palette-contrast, reader-ink and classic-refinement browsers: **20 pass**, Edge, two workers, zero retries. Two intentionally changed old-palette expectations additionally **pass 2/2** after their values were updated; composer draft and navigation assertions are preserved.
- The one broad affected command: **745 parallel passed / 27 skipped / 6 failed**, then **27 serial passed / 1 skipped / 5 failed**. The two old-palette expectations are resolved above. Nine other failures remain recorded below; no clean-main comparison was run and none is labelled a proven baseline failure.
- No explicit toolbox-rail pointer-interception timeout appears in this run after integrating #409. The rail and `large-screens.css` are untouched. Hit-test and origin assertions below are reported separately, rather than silently attributed to the old rail bug.

| Remaining browser case | Observed assertion |
| --- | --- |
| `agent-inventory.spec.ts:32`, 3 agents | At 600 × 568, disclosure summary viewport ratio 0 |
| `agent-inventory.spec.ts:32`, 300 agents | Same summary visibility assertion |
| `link-cards.spec.ts:99`, 600 px | Git tooltip disappears after Looking up, before expected commit title |
| `product-workspace.spec.ts:627` | Filter changes reading position by 34 px; expected under 3 |
| `b2-live.spec.ts:63` | Observation count 928, expected 926 |
| `b2-live.spec.ts:194` | Previous source match stays on line 240, expected 249 |
| `material-motion.spec.ts:132` | Chrome hit ownership false during hover overlap |
| `p1-pacing.spec.ts:40` | Three content animations, expected zero |
| `p1-pacing.spec.ts:266` | Missing repository-node origin tether |

Private full log `.local/affected.log`. Focused reruns: the four parallel failures recur (the 1440 px Git tooltip counterpart passes); all five selected serial cases fail again. B3 changes failure from previous-match line 240 to a timeout waiting for the Go-to-line textbox after its menu is opened. These are not called new regressions or proven current-main baselines without a comparison, which Yash prohibited. No widened timeout, retry, hidden assertion, layout or motion repair is included in this palette task.

**External acceptance:** Opus must sign off the three palettes from the combined frames, and assess the reported non-colour browser failures before merge. SHIP-21 is implementation-complete for that review, not a green release gate. No extra themes were added ahead of the assigned queue.

### Narrow diagnosis and read-only command check

A private instrumentation copy of the synthetic pacing test identifies all three counted animations as `bounded-fade` on `op-body`, `command-request` and `result-content`. The unchanged `modern/recovered-surfaces.css` binds these masks to `scroll(self)`. This establishes that the assertion counts existing scroll-edge masks, not three newly introduced arrival effects. No animation/test assertion was changed. The private log is `.local/animation-diagnosis.log`.

`pnpm check:real -- local-branches --max-mb 30 --pick 1` also passes the read-only scan/import check: Claude `rec_39af3c94` (14.5 MB, 747 operations, 3,419 observations); Codex `rec_60715088` (0.2 MB, zero operations, 11 observations). This second Codex sample is **not** visual acceptance: the richer `rec_7f72dcb0` above supplies the actual Codex frames. Scratch homes were removed. Final focused units remain 18/18 and both typechecks pass after the renderer observer change.
