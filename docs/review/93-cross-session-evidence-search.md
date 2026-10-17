# 93 — Cross-session evidence search without another panel

17 October2026. Implements the selected high-value T3 slice from83/92. Installed Emil design-engineering guidance: quiet Home entry, a task-shaped modal, clear scope, immediate keyboard navigation and bounded scrollable results. Captured text remains selectable DOM; snippets never execute HTML.

| Before | After | Why |
|---|---|---|
| Home searches session titles/roots only | Separate Search evidence action | Find a past command, error, file or decision without opening each session. |
| Search limited to selected/joined recording IDs | One local FTS query across imported observations, behind the history worker | No unbounded ID list or full browser projection/library load. |
| Another proposed main-page destination | On-demand modal plus existing command-palette route | Keep the visualization canvas and Home session inventory primary. |
| Result context could be ambiguous | Recording/harness/root/source time and exact captured observation destination | Preserve provenance and return to actual evidence. |
| Limited result set without continuation | Up to50 rows with descending indexed-row cursor, Next results and First page | All indexed matches remain reachable without accumulating result DOM. |
| Late query may overwrite new reading | Debounced requests with stale-response guard | Changing filters/query does not restore an obsolete result set. |

Authenticated `GET /v1/search-library` accepts query up to200characters, exact workspace root, harness, UTC from/to bounds, count1–50 and a positive safe-integer `before` cursor. Dates must be canonical ISO instants and not reversed. One worker-owned query joins already-redacted FTS rows to existing recordings/observations; snippets are bounded to1,600characters and identified as excerpts. No new observation schema, database migration, filesystem scan, runtime dependency, native prompt or external service. Deleted evidence cannot appear through orphan search rows because the query joins live observation/recording identities.

Scope is explicit: imported sessions only, bounded indexed text, not every full artifact or undiscovered journal. Sorting is recently indexed first, not claimed source chronology or relevance. Missing times remain missing. Workspace suggestions are the first200 known roots, with an editable exact-root field; queries are not limited to those suggestions. Search terms/results are volatile component state, not persisted source or credentials. Next-page cursors do not freeze the library against later imports/deletions; First page refreshes the newest visible results.

Selecting a hit opens its recording, disables viewport Follow for deliberate reading, clears unrelated readers and requests its exact observation window. No current-disk substitution or native action. The native journal/segment utility remains independently under existing navigation.

Validation:441units/75files and both typechecks pass; production build and imported-session browser paging/exact-jump/stale-query/filter/phone journeys pass, plus actual private-library search without a native turn. Final retained Home checks are recorded in STATUS. Local actual-store worker samples: test78ms including worker startup, the5ms, file3ms, each50 rows plus continuation. These are single-machine examples, not a whole-workload performance guarantee. No hosted CI or private content committed.

Open: core upward-scroll regression, entire skills/Uiverse UI and palette pass, source/base/draft comparison and joined review workflow. T1/T2/T4/T5 remain secondary review tools planned in92, not delivered by this search increment. Native-account/human/platform acceptance remains explicit.
