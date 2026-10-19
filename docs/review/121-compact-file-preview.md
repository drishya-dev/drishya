# Compact right-docked Explorer preview

18 October2026 · Builder screenshot refinement.

| Before | After | Why |
| --- | --- | --- |
| Default44vw preview competes with agent work |28vw width bounded360–720px, taller right dock | Matches the supplied arrangement and returns horizontal canvas space |
| Adjacent passage content stays full size |90% desktop fine-pointer passage content while preview is open | More work fits without scaling the whole UI, reader or scroll owner |
| Redundant move glyph among title actions | Drag title/tab bar; focus title and use arrows/Home | Less chrome without removing movement/accessibility |
| Motion assumes screen pixels equal local pixels | Screen/local conversion uses the passage scale for translation and settlement | Preserve measured origin/endpoints during compact mode |

Saved intentional geometry remains preferred and bounded; Reset applies the new default. Existing below-navigation/above-composer48px-edge safeguards and phone sheet remain. Desktop compact rule applies above1100px with a fine pointer. Virtual slots/history are outside the zoomed passage, preserving screen-space measurements; arrow geometry uses actual screen rectangles. Main map, prompt, Files and file-reader typography remain normal. No content duplication.

**Motion verdict:** No animated zoom/layout properties. Preview mode applies a static allocation; existing finite whole-material arrivals/reflows retain their measured motion with corrected local translations. Direct resize/drag and keyboard moves remain immediate. No new loops or capture delay.

**Local verification:** Both TypeScript projects/build;543units/99files. Five focused browser journeys cover generic readers, tabs/all edges, saved bounds, Workspace handoff, default width/position, removed move button, title arrows/Home/drag and normal phone/closed scale. Actual Drishya Codex/Skeletongraph Codex/Claude journey covers long Blueprint, reset defaults, retained tabs, scroll-anchor stability and phone. Private desktop/actual screenshots inspected. Physical device/browser-zoom and human visual preference remain acceptance checks. No hosted CI/native turn/project writes/schema/dependency change.
