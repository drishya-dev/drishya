# 98 — Adjustable current Git reading space

18 October2026. First layout increment following the builder's direction to refine UI and theme together, keeping Jet Black as the baseline. Installed Emil design-engineering guidance applied; existing Git evidence/consent/validation owners remain unchanged.

| Before | After | Why |
|---|---|---|
| Git reader always capped at680px | Compact680px default, explicitly adjustable420–1200px within viewport bounds | Small checks remain economical; larger patches can use meaningful reading space |
| Fixed146px file column always takes patch space | Proportional bounded146–220px rail, Hide/Show files in the existing toolbar | Read a wider patch without adding a permanent panel |
| Long paths wrap or truncate ambiguously | Basename plus parent path, exact full-path tooltip and existing type icon | Distinguish files without filling the rail with repeated path text |
| No equivalent to a drag handle for keyboard users | Shared separator in the sticky header; Arrow keys and Home/End | Keep resize reachable even after scrolling the reader |
| Reopening resets available space | Source/session-scoped width and file-list visibility in navigation memory | Preserve reading preferences without storing file bodies or granting access |
|11px patch text across wide readers |12px patch text | Use expanded width for legibility, not only longer lines |

Widths adapt to the viewport without overwriting the preferred width. Narrow screens retain the full bounded drawer and hide the desktop resize handle. Width/list preference is validated allowlisted navigation metadata only:420–1200px and a boolean. No observation schema change, source body persistence, native action, repository mutation, new endpoint/dependency or changed Git permissions. Legacy keeps its existing modal/layout. Frequent resize/toggle actions are immediate; no new animation or palette rewrite.

## Local checks

- Both typechecks/build and446 unit tests across76 files pass. Metadata regression checks valid recovery and rejection of malformed/out-of-range widths/visibility.
- Focused Edge journeys verify actual temporary-repository Git content, keyboard/pointer resize, additional patch width with hidden files, close/reopen retention, phone bounds and preserved patch Find/Side by side state.
- Read-only actual Drishya repository review passes with an expanded1200px patch and hidden file rail; private screenshot inspected. No native turn/repository write/hosted CI/private content committed. Final12px type refinement verified in the focused browser rerun.

Continue84's Files sizing and untouched component/palette pass. Source-version/joined workflow, optional quiet Review tools and native/human/platform acceptance remain open. UI geometry is being refined before judging alternate palette quality; retain Jet Black.
