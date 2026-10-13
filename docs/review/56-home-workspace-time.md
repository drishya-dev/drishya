# Home workspace and local-time organisation

13 October 2026. Implements Home from review 52 on `codex/home-outcomes-polish`.

| Before | After | Why |
| --- | --- | --- |
| Slice 60 sessions before grouping | Group all matching metadata, then bound visible workspaces/rows | Complete workspace counts; no workspace split across a global page |
| Full-path heading only | Collapsible name, full recorded path and matching count | Distinguish equal basenames and scan projects |
| Flat chronological rows | Today, Yesterday, Previous 7 days, Older, Future date and Time unavailable | Use the viewer's local calendar without inventing timestamps |
| Import/update time substitutes for missing captured time | Explicit unavailable source time | An import is not proof of when the agent worked |

Identities use complete recorded roots, without guessed filesystem canonicalisation. Missing roots have an explicit unassigned group. Recordings use last captured source time; discovered sources use labelled journal modification time. Filtering applies before grouping. Selection survives filtering/collapse; native sources show existing import state, never an inferred running-agent status.

Initially at most 20 workspace headings and 20 rows in each of the first three expanded groups mount per column. Closed groups mount no rows. Explicit Show more controls reach all matches; counts are never sampled. No capture/backend/schema/dependencies or persistent prompt/session metadata added. Frequent navigation is immediate, including keyboard/reduced motion.

Uses the official `emil-design-eng` guidance, downloaded into ignored `.local/design-skills` on this machine. Unit tests cover local calendar boundaries, invalid/missing/future dates, equal basenames, Windows roots and 800 rows. The API/browser journey covers counts, collapse/keyboard, paging, selection/filtering, imported state, date/harness filters and 390 px layout. Initial unit checks, typechecks/build and the focused browser journey pass. Complete local candidate results follow in STATUS.
