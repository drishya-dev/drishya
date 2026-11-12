# SHIP-8 · The map under reading

Release 1, P0. COMP-1 presentation P06 (lines and dots run through prose) and P07 (cluster labels collide; several are an unhelpful "Mixed files"). Built by Claude Sonnet 5.5 (taken over from Codex, 10 November). Nothing here changes rotation rules, the camera, or what the map shows.

## What changed

1. **A quiet zone beneath reading material.** At rest (not exploring) the map recedes under the reading column. The zone is the measured column, `.history-inner > *`, full height of the map, with a 72 px soft edge. Inside it a file dot keeps 30 % of its strength and an import line keeps 8 %; outside the edge nothing changes. A line is cut where it enters and leaves the zone, so a GPU line ramps down, runs quiet beneath the prose and returns on the far side (`apps/ui/src/lib/map-quiet.ts`; the flat renderer strokes each cut run at its own strength). Exploring has no reading material, so the whole map is full strength there.
2. **The selected origin stays sharp.** The dots of the hovered file and of the files of the current passage are exempt from the quiet zone. Import lines are never exempt: a line is not evidence of an origin, and exempting the lines of a spatial group that held the passage file put 4,147 strong pixels beneath prose in the synthetic dense repository before it was removed.
3. **Labels that cannot collide.** Placement now uses real label boxes: text measured in the stylesheet's mono face (the predicted widths equal the DOM widths to a tenth of a pixel for file and group labels), a 25 px file box, an 18 px group box, a 4 px margin, and the map controls as obstacles. The selected file and its import neighbours (the explicit working set) are placed first through the same collision pass, replacing the separate unchecked block that could draw over other labels (`apps/ui/src/lib/map-labels.ts`).
4. **A generic cluster names its members on hover.** Hovering or focusing a spatial group opens the existing map card with up to four member paths, files touched in this run first, then path order, and "+ N more" (`groupMemberPaths`). The card closes when the pointer or focus leaves. The label text is unchanged, so duplicate "Mixed files" are told apart by what they hold, not renamed. The group's accessible name carries its path and count.

## Evidence

Units (`apps/ui/test/map-quiet.test.ts`): quiet falloff, line cutting (crossing, inside-start, vertical, outside, no zones), label placement (no overlap over 200 mixed candidates, priority, bounds, controls, pinned working set, limit, sizing), member order.

Browser (`tests/browser/map-quiet.spec.ts`, synthetic 280-file repository whose files all import a hub): labels never overlap at 1440 and 600 px across ten zoom steps and with Import paths open; hovering a group lists its members and closes; in the flat renderer the pixels beneath the reading column are almost entirely quiet (under a tenth of the strong pixels outside it) while the margins and exploring keep full strength.

### Real sessions (counts and prefixes only; screenshots stay in `.local/`)

| Session | Harness | Recorded files | Checked |
|---|---|---|---|
| rec_452bae4c (11.7 MB) | Claude Code | 307 | Explore, 16 zoom steps at 1440 and at 600 px, Jet Black and Daylight: 0 overlapping labels at every step; hover card on a 37-file "Mixed files" group; reading view with the quiet zone |
| rec_5128e5bd (10.4 MB) | Claude Code | 108 | Explore after re-entering shows 14 non-overlapping labels; the first entry showed a squeezed camera with no labels, which the unchanged baseline reproduces (see Limits) |
| rec_c87c8458 (live, another agent's session) | Claude Code | 92 | Explore and reading view before the label change; "Mixed files" labels visible |
| rec_fa9e37da (39.2 MB) | Codex | 2 | Explore and reading view render; the single visible label is placed |
| rec_372f6b61, rec_45333698, rec_275b92f0 | Codex | 2, 1, 2 | Imported; maps are one or two files |

Case: a dense map with clusters and duplicate generic labels. Genuine Claude Code sessions contain it (307 and 108 recorded files). **No real Codex session on this machine produces a map larger than two files** (Codex records most reads through shell calls, so few file paths resolve to map nodes), so the dense case itself was not reproduced for Codex; Codex was checked only for rendering. A genuine current-repository graph with import edges needs the live controller's workspace approval, which no imported session here provided, so line behaviour is verified on the synthetic repository only.

## Limits and notes

- **Pre-existing, not part of this item:** opening Explore straight after loading `rec_5128e5bd` (and on `rec_452bae4c` after a reload with a persisted far-out camera) can show the whole map squeezed into the top-left corner with no labels, and Fit does not recover it; leaving and re-entering Explore does. Reproduced with the baseline `MapCanvas.tsx` swapped in, so it is not caused by SHIP-8. Recorded as MAP-2 in TASKS.
- Browser checks: `map-quiet` (4), `map-fit`, `connected-workspace`, `workspace-map-limit`, `nested-checkouts`, `repository-navigation`, `workspace-toolbar` and the ten specs `check:affected` selected pass. Four failures under three-worker load (toolbox minimise, Git atlas phone reading, captured image at 320x640, workspace toolbar narrow layouts) pass 9/9 when re-run alone; none touches the map.
- The flat label rule that skips labels whose point is within 70 px of the header was left alone (not part of this item).
- A label may sit over another file's dot (dots are not obstacles). Only label-to-label and label-to-control collisions are prevented.
- The reading-zone shape is the whole column. If passages become narrower than the column, the zone should follow the passage rectangles instead.
