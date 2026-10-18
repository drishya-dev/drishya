# 101 — Palette text contrast and quiet unboxed reading

18 October2026. Continues100's actual-session findings with the installed Emil guidance: improve the content's hierarchy rather than add more chrome or decorative motion. Jet Black remains the graphite baseline; saved palette IDs and Legacy remain unchanged.

| Before | After | Why |
|---|---|---|
| Tertiary text/selected syntax fails on some elevated surfaces | Targeted lifts to tertiary dark text and Nord syntax; darker Paper text/numeric/keyword colors | Readability must hold inside controls/cards as well as on the canvas |
| Paper's canvas is nearly white | Soft gray canvas, off-white panels and distinct elevated surfaces | Separate materials without an all-white field |
| Repository lines cross unboxed prose | Static fading background veil beneath the existing prose DOM | Keep reading calm while the map remains visible around it |
| Palette checks sample only the canvas | Regression checks primary/secondary/tertiary/syntax tokens against base plus three elevated surfaces | Catch subtle contrast regressions rather than rely on swatches |

The veil is a pseudo-element with empty content, no pointer events, no border, no blur, no shadow and two static gradient masks. It changes no text, selection, geometry, source identity or animation. There is no duplicate material or new frame loop. Captured prose remains unboxed on the world; the GPU map, origins and connections are untouched. History's ordinary bounds remain unchanged.

The token regression uses the4.5:1 normal-text floor described by [W3C's Contrast Minimum guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), comparing unrounded values. This is a guard for these solid token pairs, **not** whole-product WCAG certification: alpha composites, actual focus indicators, semantic washes, icons, user environments and assistive technologies need separate acceptance. Baseline fails18 pairs; the revised seven palettes pass all chosen pairs.

## Local validation

- Both typechecks/build and447 units across77 files pass, including the baseline-failing contrast regression and known black/white ratio checks.
- Updated opt-in actual-session palette survey checks no horizontal history overflow across all seven choices, captures final-state screenshots and exercises six narrow Settings sections. Final-state capture avoids judging an in-progress color transition as a palette's settled appearance.
- All three actual Drishya/Skeletongraph Codex/Claude long-history and multi-file Workspace journeys pass with post-render upward-scroll sampling. Paper settings/history and all palette histories inspected privately; prose is readable without removing the surrounding world.
- No hosted CI/native turn/private content/dependency or evidence/schema change. Physical/platform/assistive-tech/human acceptance remains open.

Core palette tuning is now measured and inspected for this pass. Continue84's remaining component inspection and developer workflow, not another palette rewrite. Retain further concrete contrast findings rather than claiming every rendered state is certified.
