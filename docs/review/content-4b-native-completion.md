# CONTENT-4b — native plan acceptance

29 October 2026. The remaining plan/checklist forms now have genuine native captures and desktop acceptance. No native journal was fabricated or edited. Private screenshots, native messages and drivers stay in ignored `.local/`; only prefixes, counts and sizes are recorded here.

| Source | Recording prefix | Journal bytes | Observations | Captured material checked |
| --- | --- | ---: | ---: | --- |
| Fresh Claude TaskCreate/TaskUpdate | `rec_dc1705a1` | 150594 | 106 | 12 creates, 24 updates, one 12-row list, 36 revisions, final 12 completed |
| Fresh Claude TodoWrite | `rec_8d7e3351` | 118123 | 46 | 13 full snapshots, 12 rows, final 12 completed |
| Fresh Codex literal code-mode checklist | `rec_13fd690b` | 230155 | 71 | 13 native updates/notifications and 13 projected revisions, 12 rows, final 12 completed |
| Existing Claude desktop checklist | `rec_554b9318` | 8133665 | 1253 | 41 recorded calls; 21 supported lists, including incremental changes; unsupported calls stay generic |
| Existing Claude plan-mode session | `rec_210973b8` | 223930304 | 32901 | One ExitPlanMode proposal plus the separate captured plan-file document; one proposal card at its recorded result boundary |
| Fresh Claude host rejection | `rec_0dc85036` | 70768 | 14 | EnterPlanMode, native plan-file Write and one rejected ExitPlanMode; unknown host denial remains the literal generic error, never an invented person-decline label or approval |
| Fresh Codex computed code-mode checklist | `rec_855af271` | 235407 | 75 | Dynamic arguments remain readable script text; zero invented plan revisions |

All seven sources were checked at 600 and 1440 px: fourteen desktop frames, no page errors or external requests. The three fresh supported lists have one evolving pinned list, an eight-row compact window and all twelve rows reachable through Show all. Their 143 combined replay boundaries were checked; result-confirmed task/Codex revisions never appear before the result. Existing fixture journeys retain unknown-shape fallback, revision navigation, proposal Markdown and desktop incremental updates.

## Native availability and evidence boundaries

The current Codex 0.165.0 CLI initially reported `update_plan` unavailable. The supported per-process `tools.update_plan.enabled=true` exposes it without changing saved settings, sandbox or approval policy: read-only/on-request remain effective. Claude Code 2.1.282 exposes native TaskCreate/TaskUpdate through `--tools`; the supported per-process `CLAUDE_CODE_ENABLE_TASKS=false` selects the legacy TodoWrite surface. Neither required project writes or a policy bypass. Native Claude owned its synthetic task records; plan-mode rejection probes wrote only the harness's own permitted plan file.

Code-mode journals preserve these calls as source, not `plan_update` events. A bounded helper decodes only one whole awaited `tools.update_plan` call with strict literal JSON, optionally wrapped by `text(...)`. It never evaluates JavaScript. Variables, generators, interpolation, callbacks, multiple calls and unsupported shapes stay captured text. A revision also requires the native empty-object acknowledgement: arbitrary text, nested error objects, nonzero exits and an arbitrary prefix before `Output:` do not establish success. The recognized optional metadata wrapper is validated in full. Original script/result artifacts remain available and classification is labelled derived.

The first rejection probe used a custom host denial message. The existing conservative classifier correctly leaves that as an ordinary captured error. A subsequent host-supplied canonical wording probe was excluded from person-decline acceptance: choosing a host message cannot prove the native CLI emits that wording. No new wording heuristic was added. The accepted proposal and rejected call are both honest; rejection does not become approval or successful plan progress.

## Checks and merge dependency

- 214 targeted capture-core/projection/scene units pass; the final focused parser/projection set has 19 passing tests, including nested-error and arbitrary-prefix guards.
- Eleven targeted plan browser journeys pass. Both TypeScript projects and the production UI build pass.
- `check:real plan-material` finds the genuine Codex 13-revision list and genuine Claude task/desktop cases; it counts actual calls rather than declarations or quoted text.
- This PR depends on CONTENT-3 PR #288's reducer `r24` cache invalidation in the same integration batch. Existing sealed shell observations rebuild into the literal-plan presentation without reimporting or mutating recordings. Do not merge standalone on an unchanged `r23` cache.
- The root runs the single full batch gate. No hosted CI, physical platform certification or ten-minute human study is claimed here.
