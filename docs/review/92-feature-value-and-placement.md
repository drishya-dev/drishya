# 92 — Useful developer tools without a crowded canvas

**Archived planning/review evidence.** The single current checkbox list is[docs/TASKS.md](../TASKS.md). Its checked state supersedes stale next-task wording below; retain this document for rationale and historical verification, not as another active queue.

17 October2026. Builder authorizes selecting useful features from82/83, not implementing every suggestion indiscriminately. Main priority stays readable, live agent visualization. Installed Emil design-engineering skill applies; no new permanent dashboard panels for occasional tasks.

## Placement decisions

| Item from82 | Decision and user value | Home in the interface |
|---|---|---|
| 1 Agent blame | Later: evidence-backed changed-line attribution is useful; uncertain chains must stay unknown | Source/patch gutter, on demand |
| 2 Tripwires | Keep a narrow factual review slice; not a safety score or intrusive alarm | Review findings, exact matched evidence |
| 3 Review packet | Keep: one factual handoff of changes/check gaps is useful | Existing Review, explicit export |
| 4 Repetition | Later quiet signals, not an asserted stuck-agent diagnosis | Review findings, collapsed when absent |
| 5 Mission control | Keep Home session inventory; defer a second wall/dashboard | Home, explicit session selection |
| 6 Turn report cards | Keep factual prompt overview, not scoring | Existing prompt navigation/Review, on demand |
| 7 Editor-grade reader | Keep readability, compare, tabs and precise source navigation | Existing Workspace/readers |
| 8 Explorer | Keep, refine identity/resize rather than a new panel | Existing Files |
| 9 Semantic zoom/map | Keep useful typed neighborhoods; do not switch renderer from a proposal alone | Existing Repository |
| 10 File time travel | Keep exact captured versions and gaps | Existing file evidence reader |
| 11 Symbol timeline | Defer until extraction/identity is reliable and basic reading complete | Future source context, not main chrome |
| 12 Cross-session search | Prioritize: find a past error, decision or file without opening many sessions | Home evidence-search action and command menu |
| 13 Bookmarks/notes | Keep as an optional return point; do not add a second timeline | Saved moments inside utilities/Review |
| 14 Command ledger T1 | Optional secondary tool, not a main destination; helps reproduce/debug failures even if the builder does not use it | Commands within Review/command menu; no toolbar button or runner |
| 15 Session compare | Later, explicit two-session comparison; avoid default split clutter | Home selection/Review |
| 16 Captured usage | Keep only supplied values with honest missing states | Existing Usage disclosure |
| 17 Commit/PR links | Useful when captured/proven; avoid inferred association | Git/Review metadata |
| 18 Capture completeness | Keep actionable missing/stale/capture errors; no fictitious percentage | Existing status and Review gaps |
| P1 Command palette | Keep as the common navigation hub | Existing menu and Ctrl/Cmd+K |
| P2 Keyboard/help | Keep discoverable shortcuts, no permanent instructions panel | Help/command menu |
| P3 Density | Keep a measured compact option later, not a CSS-only row-height hack | Settings |
| P4 Prompt timeline | Keep complete independent navigation; fix the reported scroll skip first | Existing right edge |
| P5 Themes | Refine existing presets; retain Jet Black | Settings |
| P6 Recovery | Keep bounded navigation recovery and explicit volatile-draft scope | Existing background recovery/status |
| P7 Notifications | Defer OS notifications; useful quiet in-app findings first | Optional Settings, never default interruption |

T1 remains a reusable query foundation forT2/T4/T5, not justification for a new visible section. Build order is dependency-aware after core scroll reliability; feature acceptance still follows83. All deferred features remain recorded here; they are not implicitly implemented or permanently rejected. Avoid duplicate control surfaces and unbounded queries.

## Native continuation utility

Some native Codex conversations store subsequent work in another journal. The existing verified-parent lookup prevents an old recording looking permanently stale. Keep this capability, hide the technical "segment" term and move its entry into the existing More workspace options menu as **Newer session work**. It remains absent when there is no known newer work, partial result or error. The command palette can also reveal it. No silent history stitching, native turn or extra main-header button.

| Before | After | Why |
|---|---|---|
| Extra arrow beside Search/Settings | Contextual submenu in existing utilities | Rare recovery should not consume permanent canvas chrome. |
| Technical native segment labels/filename suffix | Newer session work, captured date and short explanation | Explain the developer's task, not the journal implementation. |
| Hidden utility lacks keyboard route | Command-palette destination when relevant | Navigation remains discoverable without another tab. |
| Nested section outside shared dismissal | Outside/focus/Escape behavior joins the existing menu owner | Closing a menu must not strand an open nested state. |

Validation: both typechecks/build and five focused Edge journeys pass (native lookup/import/Home guard, phone bounds, contextual command route, nested dismissal/keyboard/resource behavior and existing navigation). The first regression caught missing nested dismissal and a command-dialog focus-return race; both repaired with retained assertions. This increment changes placement/wording, not the underlying metadata validation/import boundaries. Cross-session search and the remainder above are plans until their own implementation and validation land. The upward-scroll report, theme refinement and full skills/Uiverse pass remain open. No hosted CI/native turn.
