# UI-16 — Files rail space belongs to filenames

30 October 2026. Implementation and genuine-session acceptance complete; final integration gate is recorded below before ready review.

| Before | After | Why |
|---|---|---|
| The legacy `.folder-tree button > span:last-child` rule overrides the evidence column's flex rule. A single E marker receives 88 px in the reproduced 600 px window. | A narrowly scoped evidence rule keeps badges intrinsic and gives the remaining space to the filename. | The status letter must not compete with its filename for half the row. |
| Long filenames lose their extension in an end ellipsis. | The stem truncates before a literal extension; folders and extensionless names keep their ordinary text. | A developer can still identify the file type. Full path tooltip and accessible name are unchanged. |

No selection, file routing, count, worktree grouping, indentation, row height or lift origin changed. Filenames contain one copy of their literal characters; no measuring observer, synthesized label, capture change or new animation is introduced.

## Acceptance

- Reproduced the original CSS allocation in the running baseline build, with a regression guard failing on its 88 px marker column. Private synthetic screenshots retained locally.
- Six dedicated fixture cases pass: genuine-format Claude Edit and Codex custom apply_patch at 600 and 1440 px, plus dotted folders, dotfiles, extensionless names and full-path search. At wide desktop, the native resize control exercises 220–420 px and filename width must gain the same pixels as the rail. At 600 px the existing transient Files overlay remains unchanged; it does not expose a resize control.
- Tests retain E, full path tooltip, full accessible name, visible extension, bounded columns and no horizontal scrolling. Narrow overlay and normal desktop modes are both covered.
- Eleven existing count/group/lift guards also pass: **17 focused browser checks** in total. Root and UI typechecks pass.

Genuine journals were imported through existing redaction into private scratch homes; native sources and the real Drishya home were unchanged. Actual deep tree branches were expanded without substituting search for the tree.

| Harness / prefix | Source bytes | Observations | Depth | 600 px rail / name | 1440 px rail / name |
|---|---:|---:|---:|---|---|
| Codex `4b5ca5b1` | 44,016,822 | 1,530 | 5 | 290 / 146.61 px | 220 / 76.61 → 420 / 276.61 px |
| Claude Code `c8e5c9c8` | 82,859,509 | 10,466 | 4 | 290 / 145.06 px | 220 / 75.06 → 420 / 275.06 px |

Both wide trees give filenames exactly 200 px more for 200 px rail growth. Across all four genuine frames: zero horizontal overflow, clipped status columns, page errors or external requests; extensions remain visible and accessible labels intact. Badge widths are 12.39 and 25.94 px (the latter contains multiple genuine states), with a 5 px gap. Screenshots and numerical measurements remain private in `.local/`.

The literal filename is compared as DOM text: Chromium inserts a layout newline between flex items in `innerText`, which is not a character added to the name.

## Design-skill pilot

The installed Emil composition review identified the allocation defect; final review found no further actionable defect. The HIG reviewer lens was privately cloned at `ff4ebdd`. The foundation set plus desktop sidebars, split views and lists/tables corroborated the fix: `references/hig/lists-and-tables.md` › Content (recognizable truncated text) and › Desktop (resize to reveal clipped data), `split-views.md` › Desktop (bounded pane sizes), `layout.md` › Visual hierarchy (indentation/alignment), and `color.md` › Inclusive color / `accessibility.md` › Vision (information beyond colour).

Liquid Glass and top-level navigation depth advice were filtered out under Drishya's flat-material and repository-outline doctrine. Break-ui broadened the checklist; dotted-folder/dotfile/extensionless/search cases received rendered guards, while short/non-Latin/zero/thousand-row considerations were source-inferred. This does not claim a rendered worst-case toggle, zoom or assistive-technology run. Existing virtualization and empty-result owners are untouched. The installed Apple skill supports immediate direct resizing; no spring or new motion is needed.

The extra HIG lens corroborated the fix and clarified acceptance, but found no separate implementation change beyond the installed skills. The read-only review inspected source and synthetic screenshots; genuine-session acceptance above was performed separately by the task owner.

## Integration gate

Pending final results on isolated checkout at `8e44bcdc` (current main plus UI-16). No History, controller, ingest or schema runtime change belongs to this task.
