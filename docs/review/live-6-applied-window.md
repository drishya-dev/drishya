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
- Frozen `ac4215ec` in `.local/wt-live6-gate`, with its own frozen install: both typechecks, 277 related units / one existing skip, build, all 1,237 units / one existing skip, and package verification pass. Browser run: **664 parallel + 32 serial = 696 passed**, 28 existing skips, **one failure**, Edge three parallel workers / one serial worker, zero retries. `check:affected` therefore exits 1; no clean complete command is claimed.
- The failure is `b2-live.spec.ts:63`, assertion line 116: the same passage stays selected but its offset changes from −292 to −287 px. A separately installed/built clean-main checkout at `9bab2cc9` reproduces the **exact same assertion and 5 px difference** on its first one-worker, zero-retry run. The candidate's isolated rerun also fails identically. This is the already documented TEST-2 anchoring failure, not a newly passing test or a fix in this PR. All failed logs remain in the ignored gate/base `.local/` directories; no assertion, timeout or skip changed. AGENTS.md explicitly allows this baseline-reproduced failure not to block the unrelated task.
- Main was integrated afterward with documentation-only SEC-1 task changes; implementation/test files remain exactly the tested frozen revision. No full gate was repeated for that documentation integration.

## Decision resolved — 7 November, Yash

Yash explicitly selected the recommended fallback: when the actual tool instrument is hidden, show the card directly, with all content and its outcome animation intact. Omit only travel from an unavailable origin. Do not fabricate a location or wait for the Toolbox finishing pass. Visible-origin arrivals still animate once.

The 600 px native results above therefore meet the clarified acceptance; their zero physical travel is intentional and is not described as a completed flight. This decision is also recorded in TASKS and the STATUS decisions log. Earlier draft #362 correctly remained blocked until that answer.

LIVE-6 acceptance is complete under that explicit clarification. The task is ticked, claim removed in PR #362, and the PR is ready for other-builder review, not merged. The gate retains the baseline-reproduced TEST-2 failure above; it is not described as fully green. No Toolbox, style or additional motion implementation is needed for the selected fallback.
