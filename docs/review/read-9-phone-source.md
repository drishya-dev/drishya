# READ-9: source space on narrow readers

20 October2026. One TASKS ID; claimed on main in b0ed3ec before implementation. PR136 is the integration signal and remains for Claude to verify/merge.

| Before | After | Why |
| --- | --- | --- |
|390px source viewport is46.3% of reader; multiple control rows and footer | One compact find row, inline match navigation/count | Reading the file gets the majority of the window |
| File actions and provenance consume separate rows | Narrow header has one Reading options disclosure with existing actions and source context | Reorganize existing tools rather than adding resident chrome |
| Long match wording forces wrapping | Short visible position/total with complete accessible label/tooltip | Preserve meaning without taking another row |
| Escape from a nested disclosure closes its modeless reader | Disclosure handles Escape locally and restores summary focus | Keep the file open and the reading context intact |

The reader's current-file controls only are changed in SessionWorkspace; SourceFind adds an opt-in compact presentation. Scoped CSS leaves desktop, Legacy and unrelated readers untouched. Line jumps, wrapping, copy, refresh, recorded work, Workspace handoff and redacted/current-source notices remain available. No file/native/config writes or new package dependency.

**Motion verdict:** Uses existing desk-options pointer transition and dismissal/keyboard owner; no new layout/scroll/zoom animation. Keyboard disclosure close stays immediate. Existing shared header drag/reader exit is preserved. Phone inputs use16px type and menu buttons44px targets. Physical keyboard/phone behavior is still a separate release acceptance check.

**Before changing product:** ran the existing connected-source browser journey against the unmodified product build with390/320 assertions restored. It failed at390 with source ratio0.4630803. After implementation, the18-test connected-workspace suite passes, including restored >=0.62 assertions and unchanged Classic/native-controller synthetic journeys. Both TS projects/build and10 focused reading/document/window units pass.

**Actual-session verification:** isolated copy of an already-redacted local store; Drishya Codex, Skeletongraph Codex and Skeletongraph Claude. Two browser matrix journeys cover all three at390/320px, mouse and emulated touch. Source ratios0.6901168 mouse and0.6354315 touch; overflow0. Checks no-match/disabled navigation, line1 reveal, wrapping, source context, Escape focus return, outside dismissal and reader close. No page errors. An existing missing-original-journal warning from the session-segments endpoint appeared for an old imported session; no new journal import/native turn was used. Private screenshots stay under.local and were inspected. Emulation is not physical hardware certification.

**Merge guidance:** eight changed files, scoped to SourceFind/current-file portion of SessionWorkspace, new CSS, existing connected spec, new opt-in READ-9 spec, TASKS/STATUS and this evidence note. No History, scene/store, Viewer/header/navigation, Git graph, adapters, contracts or Usage. Main coordination-only claim changes were merged cleanly. Please compare against concurrently evolving UI-1 after its own review; do not overwrite either builder's claims when resolving documentation.
