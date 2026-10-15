# 79 — Compact Modern review controls and headers

15 October 2026 · Yash with Codex · `codex/modern-reading-craft`, PR #65.

The builder rejected the large floating session header and oversized Git workspace. Toolbox should be a toolbox. Give Git review its own icon control styled like Files / Repository. This supersedes those surrounding choices in 78; the recovered composer and Legacy agent visualization remain intact.

Applied installed `emil-design-eng` and the animation decision framework: keep repeated navigation immediate, reuse the established button/menu feedback, and avoid adding decorative motion to the header or readable patch.

| Before | After | Why |
| --- | --- | --- |
| Git/review launchers inside Toolbox | Independent branch-icon Git control at the right, matching Files / Repository; Review work/questions in workspace utilities | Tools retain a clear home without removing review functionality |
| Rounded, bordered floating header with a Sessions cue | Slim translucent edge header, centered project/session identity and quiet utility icons | Give the working visualization more room and remove a redundant outer frame |
| Git reader up to 1000 px / 76vw, fixed full height | Content-sized right reader, maximum 680 px on desktop and viewport-bounded scrolling | Keep the agent’s work visible and avoid a large empty permission window |
| Large Git title/context/control spacing | 44 px icon heading, compact repository/branch/actions and file list | Allocate space to the patch |
| Permanent scope paragraph | Short visible current-Git disclosure; details expand the exact review/refresh semantics | Preserve the distinction from captured evidence without repeating explanation |

`ModernToolStation` renders the separate review navigation and the existing tool rail. Native/MCP origin elements and compound filters remain intact. Empty Git navigation is hidden for offline/demo/combined sessions where the existing Git eligibility rule rejects it. `GitReviewEntry` retains the existing selected-session owner and reports expanded state. The shared `ReadingDialog` accepts an optional decorative header icon; Legacy and Canvas readers are unchanged.

Git access, bounded snapshots, per-file fingerprints, review notes, staged/worktree scopes, raw patches, hunk/find, current-file links and revalidated handoffs continue through the existing implementation. No new permission, schema, capture or backend behavior is introduced. Readable code uses existing two-axis reader scrolling; compact width must never truncate the underlying patch.

## Verification

Both typechecks and production build pass. Combined local browser run: **34 passed** across Modern, Legacy and Canvas. The Git journey checks the compact right-hand bounds and heading, actual temporary-repository patch, both permission gates, relocated Review work/questions dialogs and 390 px access. Its extended final rerun passes. Toolbox/MCP focus and true-origin tests pass. The existing 380-unit baseline was not rerun for this presentation correction.

Actual local Codex recording visually inspected for the header, separate review control, Toolbox and unapproved Git state; actual patch reading verified on the disposable local repository. No native prompt submitted or new access granted for the real recording. Screenshots remain ignored under `.local/`. No hosted CI. User package-manager/artwork changes stay uncommitted. Human visual acceptance, real native-account execution and physical/platform release gates remain separate.
