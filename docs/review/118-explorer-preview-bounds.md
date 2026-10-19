# Explorer preview bounds

18 October 2026 · Builder screenshot correction · Modern only.

| Before | After | Why |
| --- | --- | --- |
| Saved modal x/y/height override safe preview CSS | Shared numeric bounds constrain restored, moved and resized previews to the adjacent right lane | A prior tall centred window must not cover the prompt or displace all agent work |
| Preview may cross the independent time rail | Rail occupies the free right edge while preview is open | Prompt navigation stays accessible without drawing over tool cards or the document |
| Full Workspace starts below Git/Workspace navigation stack | Right navigation hides; editor starts alongside Files, with its existing Back to agent action | Recover vertical editing space and avoid duplicate navigation |

Bounds recompute from right controls, logical composer height/bottom and viewport size. Logical dimensions avoid chasing the finite composer scale animation. Saved geometry remains a preference and no source bodies or consent enter navigation metadata. Existing generic reader geometry is preserved. Four edges hold their opposite edge; movement stops at the reading-lane boundary. Phone uses the existing sheet.

**Motion verdict:** Direct drag/resize remains immediate and interruptible; no new layout animation or content copies. Existing shared reader arrival/exit stays intact. Keyboard actions remain immediate.

**Local verification:** Both TypeScript projects, production build,535 unit tests/96 files; four focused browser journeys covering generic reading windows, file-tab replacement/retention, all resize edges, restored oversized geometry,1920/1440/1000/390px and prompt collapse/reload. Actual current Markdown to Workspace transfer passes; actual Drishya Codex/Skeletongraph Codex/Claude tabbed reader checks include oversized persisted geometry and the long Blueprint document. Private screenshots stay in `.local` and were visually inspected. No native turn/project write/hosted CI. Physical browser-zoom and device acceptance remain open.
