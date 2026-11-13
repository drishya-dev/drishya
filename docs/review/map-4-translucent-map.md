# MAP-4 · The map seen through the reading area again

Release 1, P0 (Yash, 13 Nov: "maybe the map behind as transparent type for nodes and edges ... it was there previously but somehow got removed later").

## Cause (confirmed on frames)

Compared the build just before #400 (`8e29da53^`) with main on the same real session (rec_5128e5bd, Claude Code, 232 operations, 108 files; Codex rec_372f6b61 also checked). The 0.38 canvas dim in `atelier.css` is identical in both, so it is not what removed the look. SHIP-8's quiet zone is: its floors (file dot 0.3, import line 0.08) multiply with that 0.38 dim, so beneath the reading column the map fell to about 8 % for dots and under 3 % for lines, below what the eye sees. Pixels differing from the background by more than 3 levels beneath the column: 313 before #400, **0** after #400, 8,280 now (1440 px).

## Change

`QUIET_NODE_FLOOR` .3 to .6 and `QUIET_EDGE_FLOOR` .08 to .45 in `apps/ui/src/lib/map-quiet.ts`. Nothing else: the zone, the 72 px feather, the exempt passage dots, the label collision rule, the 0.38 dim and every redraw trigger are untouched. Under the column dots and lines are the same shapes at translucent strength; the margins are unchanged.

## Evidence (real sessions; counts only, frames in `.local/map-4/`, never committed)

| Check | Result |
|---|---|
| Frames before #400, today (pre-fix), after, at 1440 and 2000 | `before-*`, `today-*`, `after-*` (each with a `-map-only` frame) |
| Prose contrast over the brightest map pixel beneath the column | 11.2:1 (1440) and 12.4:1 (2000) on the Claude Code session; 7.1:1 on the Codex session; floor is 4.5:1 |
| Idle redraws, 5 s, rotation on | 134 draws, 132 on the pre-#400 build (scheduling unchanged) |
| Reduced motion | 0 draws in 5 s |
| Spec | `map-quiet.spec.ts` asserts the shapes are present beneath the column (mid-strength pixels: 4,312 now against 35 with SHIP-8's floors, checked by rebuilding with the old floors) and weaker than the margins |
| Other map specs | connected-workspace, map-fit, nested-checkouts, repository-navigation, workspace-map-limit, workspace-toolbar: 27 pass; UI units 615 pass |

## Limits

- The "before #400" worktree indexes its own checkout, so its map holds different files from today's; the comparison is of the look and the pixel counts under the column, not of identical nodes.
- The densest real map on this machine is 108 files (rec_5128e5bd); SHIP-8's 307-file session is no longer present. The 280-file synthetic hub is the dense check.
- A low-resource attribute set after load does not stop rotation (it is read at start); that rule is untouched by this change.
