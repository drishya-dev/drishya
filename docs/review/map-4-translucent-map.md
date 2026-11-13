# MAP-4 · The map seen through the reading area again, and a calmer ground

Release 1, P0. Yash, 13 Nov: "maybe the map behind as transparent type for nodes and edges ... it was there previously but somehow got removed later"; then, from frames: the map "barely has any map", "the edges more bright, they arent even visible"; the Jet Black dot ground is "scattered and too large" and lags scrolling; and finally "way too intense ... just use the previous dots and just a bit more in size".

## Cause (confirmed on frames)

Compared the build just before #400 (`8e29da53^`) with main on the same real session (Claude Code rec_5128e5bd, 232 operations, 108 files; Codex rec_372f6b61 also checked). Two things held the map down:

1. SHIP-8's quiet-zone floors (dot .3, line .08) multiply with the 0.38 dim on the whole canvas (`atelier.css`) and the .68 rest strength: under the reading column dots ended at about 8 % and lines under 3 %, below what the eye sees. Pixels beneath the column differing from the background by more than 3 levels: 313 before #400, 0 after #400.
2. Outside the column the same 0.38 x .68 left lines and dots at about a quarter strength, so even the margins read as nearly empty.

## Change

- **Map strength.** The 0.38 dim on the canvas is removed (`atelier.css`). Rest strength is `MAP_REST_ALPHA` = .85 (was .68 x .38) in the margins; under the reading column dots keep `QUIET_NODE_FLOOR` = .38 and import lines `QUIET_EDGE_FLOOR` = .5 (were .3 and .08). The floors are the highest that keep prose at 4.5:1 or better over the densest map area with the ground included. Zone, 72 px feather, exempt passage dots, SHIP-8's label collision rule and every redraw trigger are untouched.
- **Ground.** `apps/ui/src/modern/jet-ground.css` is UI-39 part 3's first ground (#456) again: one `radial-gradient` of a straight 12 px grid at 11 % cream as the background of `.connected-workspace`, with the dot a little larger (radius 1.25 px, soft edge to 2 px; it was 1 px). All dots are the same size and brightness. No glow, no gradient, no fade, no stagger, no pseudo-element, no mask, no SVG. The staggered 288 px mask layer from #458 is deleted. Jet Black only; the low-resource rule that removes it (`atelier.css`) still wins.

Dot candidates (frames `dots-candidates-100.png` and `-150.png`, 100 % and 150 % zoom, in `.local/map-4/`): 1 px (#456) is barely there; 1.25 px is a visible step up and still reads as calm texture; 1.5 px starts to read as a pattern. 1.25 px was chosen.

## Evidence (real sessions; counts and prefixes only; frames in `.local/map-4/`, never committed)

| Check | Result |
|---|---|
| Frames before #400, before this change, after, at 1440 and 2000 | `before-*`, `today-*`, `after-*`, `final-*` (each with a map-only frame); side-by-side product before / Home / product after in `side-by-side-*` |
| Prose contrast over the brightest pixel beneath the column (map and ground together) | 5.2:1 at 1440 and 2000 (Claude Code); 4.8:1 on the Codex session; floor 4.5:1. Edge floor .6 gave 3.75:1, so .5 is the brightest that holds |
| Idle redraws, 5 s, rotation on | 132 draws (132 on the pre-#400 build); 0 under reduced motion |
| Scroll, 3 s of in-page scrolling of the 232-operation session, 3x CPU throttle, 5 rounds each | p95 frame time medians: this branch 317 ms, main 200 ms, before #458 325 ms; individual runs of the same build range from 108 to 1,312 ms, so the three are **indistinguishable** here. Paint time from a CDP trace: medians 229 / 254 / 293 ms, raster 75 / 101 / 113 ms, equally noisy |
| Specs | `map-quiet.spec.ts` (shapes present beneath the column, weaker than the margins; separates the old floors from the new by rebuilding), `jet-language.spec.ts` ground test rewritten to the plain-grid shape; connected-workspace, map-fit, nested-checkouts, repository-navigation, workspace-map-limit, workspace-toolbar pass; UI units pass |

## Limits

- The scroll measurement is headless Edge with software rendering: it cannot show the GPU cost of a masked layer, only that the change is not worse. The gain is structural (no masked layer, a background on a non-scrolling element); it is not demonstrated by these numbers.
- The densest real map available is 108 files; SHIP-8's 307-file session is gone. The 280-file synthetic hub covers density.
- The reference worktrees index their own checkouts, so their nodes differ from this branch's; compared look and pixel counts, not identical nodes.
- A low-resource attribute added after load does not stop rotation (read at start); that rule is untouched here.
- `jet-language.spec.ts` "surfaces nested in a panel ... outline returns with focus" failed on origin/main 5a78176f (not this change) and passes on the branch rebased onto 0dac90ec.
- Full gate and the ten-minute test not run; Yash accepts from frames.
