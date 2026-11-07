# LIVE-6 — applied change intervals

## Cause and implementation

The composer previously marked arrivals/outcomes only on `step - 1`. A Codex result followed by bookkeeping or another entry in the same UI update lost its outcome marker. `ComposeInput.since` now describes the previously applied boundary; entries in `(since, step]` arrive/resolve. Omission preserves the default single-step scenes and replay. There are no clock reads in the composer.

The small-session Viewer remembers the last committed composition. Worker-backed history carries that boundary in HistoryQuery, plus `previousSince` to retain the preceding interval when a page request discovers no new step. Same-step render/page changes therefore keep the interval. The server validates both fields as nonnegative safe integers. Neither changes the event schema.

A second, reproduced bug: when the two newly resolved cards unmounted for scrolling and remounted at the same step, their CSS Resolve markers replayed (four events for two results at both widths). Yash reserved the exact History.tsx outcome guard alongside MOTION-3 and approved up to 18 paths. A history-scoped seen set now prevents that replay; a mounted card keeps its original permission while its animation is running. Replay gets a new scope per explicit step, retaining deliberate replay semantics. No timings, appearance, origins or styles were redesigned.

## Genuine local evidence (counts only)

All turns resumed existing synthetic-only throwaway repository sessions through Drishya's native controller, using a scratch Drishya home, explicit workspace consent and the idle-other-clients acknowledgement. No policy options changed and no saved native settings/journals were edited. Each request asked for five separate harmless echo calls. Later motion-isolation runs submitted through the same authenticated controller endpoint after consent; they do not claim a new composer usability acceptance. Early UI-driver attempts that lost their setup state remain in private logs; no product fix for that is claimed here.

| Case | Captured evidence | Counted browser result |
|---|---|---|
| Codex baseline, 1440 | `rec_13949e17`, 426,576 bytes, 107 observations; five material results (ten raw operations include their enclosing scripts) | Five material arrivals; zero CSS outcome-marker Resolve events. The baseline driver did not count the separate contour cue, so zero total motion is not claimed. |
| Claude baseline, 1440 | `rec_69977fa0`, 407,906 bytes, 61 observations; five calls/results | Five arrivals and five outcome markers, no duplicates. |
| Codex fixed, 1440 | `rec_13949e17`, 639,373 bytes, 297 observations; five material calls/results (ten raw operations) | Five arrivals, five outcome-marker Resolves, five contour Resolves; all five results also marked by the genuine worker history query; zero duplicates. |
| Claude fixed, 1440 | `rec_69977fa0`, 674,050 bytes, 222 observations; five calls/results | Five arrivals, five outcome-marker Resolves, five contour Resolves; worker marks all five; zero duplicates. |
| Codex fixed, 600 | `rec_13949e17`, 584,038 bytes, 259 observations; five material calls/results | Five outcome-marker and five contour Resolves, all five worker results; **zero physical arrivals**, no duplicates. |
| Claude fixed, 600 | `rec_69977fa0`, 621,611 bytes, 192 observations; five calls/results | Five outcome-marker and five contour Resolves, all five worker results; **zero physical arrivals**, no duplicates. |

The material count uses the existing `materialOperations` contract: enclosing scripts remain evidence, not a second completed material action. Raw totals are retained in private counts, not silently discarded. Screenshots, source manifests and native output stay only in ignored `.local/`.

Supplementary `pnpm check:real -- live-batches` passes against Claude `rec_c8e5c9c8` (83.7 MB, 2,695 operations/results) and Codex `rec_c05206c0` (13.9 MB, 271 operations, 268 result positions): two distinct outcomes in each final interval are marked, deterministically.

## Checked and not checked

- Both typechecks pass.
- 31 focused units pass: two-call batch boundaries, default single-step equivalence and existing goldens unchanged, as-of concealment, worker same-step paging, state query transport and replay query defaults.
- Two browser regressions pass at 600/1440 on Edge, three workers, zero retries: both cards arrive/resolve in one update, scroll completely out of the virtual DOM and back without duplicate outcome markers, and invalid history boundary inputs are refused. These cases failed before the guard; assertions were retained.
- No full gate or broad affected command was run for this still-partial draft, following AGENTS.md's rule against full gates on drafts. They remain required after the decision and whole acceptance below are resolved.

## Blocked decision — for the builder / FINISH-7 and TOOLS-3

**At 600 px there is no visible dock instrument from which the existing Emit can travel.** The narrow layout hides the instrument; opening the available Tools control did not supply a measurable origin during these runs. Existing truth-preserving origin visibility checks therefore omit physical arrivals. Result resolution and both local/worker change intervals work.

LIVE-6 says every arriving card lifts once, and the common acceptance includes 600 px. This line is **not met**. This task was explicitly forbidden from changing Toolbox files or making a design decision. Do not invent an off-screen/fallback origin or mark the item done.

**Question recorded on draft PR #362:** should the existing narrow Tools control be the real Emit origin, or should TOOLS-3 / FINISH-7 expose a measurable instrument first? Alternatively, the builder can explicitly agree that a hidden-origin, no-travel fallback satisfies this line. No option has been selected here.

PR #362 remains draft, LIVE-6 unticked and claimed. Stop here pending that answer. FLOW-1, FILES-13, CONNECT-4, NATIVE-1 and the final IDEA-1–6 documentation repair have not been started, respecting the requested one-at-a-time order.
