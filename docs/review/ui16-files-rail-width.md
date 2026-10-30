# UI-16 — Files rail space belongs to filenames

30 October 2026. Whole-task implementation in progress; real-session acceptance follows before ready review.

| Before | After | Why |
|---|---|---|
| The legacy `.folder-tree button > span:last-child` rule overrides the evidence column's flex rule. A single E marker receives 88 px in the reproduced 600 px window. | A narrowly scoped evidence rule keeps badges intrinsic and gives the remaining space to the filename. | The status letter must not compete with its filename for half the row. |
| Long filenames lose their extension in an end ellipsis. | The stem truncates before a literal extension; folders and extensionless names keep their ordinary text. | A developer can still identify the file type. Full path tooltip and accessible name are unchanged. |

No selection, file routing, count, worktree grouping, indentation, row height or lift origin changed. Filenames contain one copy of their literal characters; no measuring observer, synthesized label, capture change or new animation is introduced.

## Checks so far

- Reproduced the original CSS allocation in the running baseline build, with a regression guard failing on its 88 px marker column. Private synthetic screenshots retained locally.
- Four fixture cases pass: genuine-format Claude Edit and Codex custom apply_patch at 600 and 1440 px. At wide desktop, the native resize control exercises 220–420 px and filename width must gain the same pixels as the rail. At 600 px the existing transient Files overlay remains unchanged; it does not expose a resize control.
- Tests retain E, full path tooltip, full accessible name, visible extension, bounded columns and no horizontal scrolling. Narrow overlay and normal desktop modes are both covered.
- Real deep-tree checks, related count/lift/grouping regression checks, typechecks and final batch gate are pending. This is a draft, not a completed acceptance claim.
