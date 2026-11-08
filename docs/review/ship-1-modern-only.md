# SHIP-1 — Modern-only Release 1

Implemented in [PR #369](https://github.com/drishya-dev/drishya/pull/369), branch `codex/ship-1`. Ready for the other builder's review; not merged. Release-candidate or all-green browser-gate readiness is not claimed.

## Scope and agreements

Claimed on main before implementation (b57bcd9f). Yash approved the expanded version-test footprint and narrow sections alongside UI-28, then approved the remaining composer test migration after UI-28 merged (3943b148) and up to 35 paths for the final serial migrations (3ada82e7). No composer, Toolbox, motion, schema or policy implementation changed. Independent UI-28, TOOLS-3 and LAYOUT-1 merges are included. Clarity source remains archived; its entry is unreachable. Modern uses the existing single cascade layer; no extra layer declaration or styles are needed.

## Every Accept line

| Acceptance | Evidence |
| --- | --- |
| Fresh package and existing home with old Clarity/Legacy preferences open Modern | Final packaged CLI: 12 successful combinations across fresh/existing scratch homes, both preferences and 600/1440 px. Existing home contains both genuine harness recordings below. Old URL/developer selectors also fall back to Modern. |
| No version wording in Settings or menus | Five ordinary Settings sections; no chooser or developer version switch. The two-width browser matrix also checks retired stored/query values. |
| Built UI has no chooser strings | Artifact guard checks extracted JS and confirms the archived Clarity entry is not imported. |
| package:verify passes | Final offline package install, both synthetic adapter imports, authenticated API, demo export and persisted restart pass. These are verification packages, not a release candidate. |
| Keep Modern pixels unchanged | Repeated after current-main integration and the final entry cleanup: all four genuine history screenshot pairs have exactly zero differing pixels. Before build is main 3ada82e7; runtime freeze is 6cc18e37. |

Genuine scratch-home acceptance (not demo acceptance): Claude Code `rec_ab67986c`, 451820 bytes, 9 operations/8 prose; Codex `rec_2dcde4d9`, 248572 bytes, 7 operations/6 prose. Both at 600 and 1440 px. Screenshots remain in `.local/ship1-proof/`; no private content is published. `check:real -- person-prompts` additionally passes scratch imports for Claude `rec_c8e5c9c8` (83.7 MB, 2695 operations) and Codex `rec_fa9e37da` (39.2 MB, 459 operations).

## Checks and migrations

Final both-project typecheck and 45 related units pass. Package verification and all 12 packaged cases pass. Seven final release/reading/browser guards pass together. All 17 connected-workspace cases pass together, including sending, approval, attachments, model/effort menus, native questions, drafts, source reading and map navigation. Their native process is a synthetic protocol stand-in; this is not a claim of fresh signed-in model turns.

Other focused passing checks include 21 Git/recovery/folding/version/source-control cases, the retained product-workspace journeys, discovery and virtualized grouping, B4 paging/replay, settings keyboard operation, distant stored-source search, dock identity/tether controls, Source range copying/pinning/paging, verification during replay, independent replay reading, replay camera continuity and paged replay. Core scroll, motion and coordinate predicates are retained.

Retired tests assert only unshipped Legacy/Studio/picker compositions (crown shortcuts, duplicate version comparison, old working-set/navigation wrappers). Existing Toolbox cases with old query aliases still assert the Modern dock and serve as fallback coverage. Modern reading/actions use existing menus, compact counters' accessible labels, Replay speed/Exit replay and the actually painted dock rather than its display:contents wrapper. Native wheel targeting waits for closing chrome and finds a genuine exposed background target; it does not force events through overlays. Neither protected file was changed.

## Broad-gate accounting — not green

`check:affected` ran with three parallel workers, one serial worker and no retries: 632 parallel passed / 27 skipped / 24 failed; 10 serial passed / one skipped / 22 failed. It preceded the final selector migrations. Failures were then investigated and the corrected cases rerun; no second full sweep or aggregate all-green result is claimed. Logs: `.local/affected-final.log`, `.local/connected-complete.log`, `.local/release-final.log`, `.local/serial-latest.log` and the focused follow/dock reruns.

## Claude investigation

Please investigate these three remaining Modern motion expectations; they are not changed, removed, quarantined or silently marked passing here:

1. `material-motion.spec.ts:132`: hover reading under chrome fails a final hit-test predicate (expected true, got false). The test uses the full header rectangle; Modern's header controls float. Verify the exact failing edge and whether the test addresses real chrome. Do not add an opaque full-width blocker just to satisfy it.
2. `p1-pacing.spec.ts:40`: a pending request has three animation objects where the predicate expects zero. Waiting for finite transitions did not clear them. That experiment was reverted, preserving the original assertion. Inspect animation types/states before changing motion or weakening the test.
3. `p1-pacing.spec.ts:266`: the synthetic fixed-position renderer marker is reported visible, but the expected Repository-node tether is absent (expected one, got zero). Check actual occlusion and the real endpoint. A trial placement did not resolve it and was reverted; the fixture and coordinate assertions are retained.

A separate worktree with its own frozen install and **unchanged pre-SHIP-1 production code at d8e16d43**, run in Modern with the same migrated selectors and original predicates, reproduces all three. This is a production-code baseline with an identical test harness, not a claim that unmodified main's Legacy-selected tests fail. Initial baseline also reproduced B2 selection/Follow and obsolete compact-counter expectations: the former passes on a later unchanged branch run; the latter is a completed test migration. Baseline log is `.local/wt-ship1-baseline/.local-baseline-browser.log`. That worktree was subsequently advanced to 3ada82e7 for the final pixel comparison; use the recorded commit to repeat the earlier probe.

The earlier workspace-toolbar wheel failure was a premature/covered target during floating chrome dismissal; the exposed-target helper now passes it without changing the Follow assertions. These findings do not establish an SHIP-1 runtime regression, and do not certify Release 1. Claude/TEST-2 must resolve or explicitly disposition the three remaining Modern expectations before release.
