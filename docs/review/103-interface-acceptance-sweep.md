# 103 — Full interface acceptance sweep

18 October 2026. Continue the installed Emil design skill audit on actual imported Drishya material, alongside the full local browser suite. Card allocation feedback has its own104 increment/PR88.

| Before | After | Why |
| --- | --- | --- |
| Prose's decorative background extends24px outside its horizontal allocation | Keep the background inside the prose width, retaining the vertical fade | The quiet background must not create horizontal reading overflow |
| Surface survey could race restored reader state and photograph loading content | Explicit empty initial navigation for this survey; wait for captured content and approved Workspace tabs | Survey the actual surfaces from a repeatable start; recovery retains its separate tests |

## Local findings and checks

The full pre-repair suite at PR87 returned **174 passed,6 skipped,4 failed**. This is not a green full-suite result. The skipped cases require explicit private-store or sustained-probe opt-in.

- **Fixed here:** the prose veil added24px of horizontal scroll extent. The existing nested-list/ordinal/narrow-reading regression fails on the previous build and passes with bounded horizontal inset at1440/900/390px.
- **Open:** two older origin-motion tests assume nested Files rows are already expanded. Their timeouts occur while finding those rows, after the preceding motion assertions pass. Update the journeys to open the actual tree before evaluating origins; preserve the default closed tree.
- **Open:** initial follow stops72px short of the final history bottom in the160-prompt test. Reproduces alone; investigate late composer/history allocation rather than weakening the assertion.

The new opt-in actual-session surface journey passes at1440 and390px: recorded review, changed-file evidence, questions, usage, current source, approved Workspace navigation and typed map import connections. Dialogs stay inside the viewport and the document does not acquire horizontal overflow. Frames remain private under.local and were inspected. These assertions are geometry/navigation checks, not proof every surface is visually finished.

Observed polish still worth doing: narrow Review pagination wraps into tall controls; current-source reader's upper controls consume disproportionate space. Retain these in84's remaining component pass. The source-version/joined native correction workflow and92's selected secondary tools remain distinct work, not delivered by an audit.

UI build and the two focused browser journeys pass after the CSS repair. Both typechecks and447 units across77 files passed immediately before it, with no TypeScript change here. No hosted CI/native turn/private content committed. Physical hardware, assistive technology, signed-in native lifecycle and human ten-minute acceptance remain open.
