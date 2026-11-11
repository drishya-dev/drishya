# SHIP-16b — local browser reliability

Whole seven-case item complete for review, Yash with Codex, 11 November. Fresh worktree and own frozen install; current main including merged SHIP-16a (#413 / `de0fffa1`) is integrated. No hosted dispatches. The verification policy in TASKS is unchanged.

## Observed first, then repaired

Fresh-branch baseline, Edge/two workers/no retries: both agent-inventory cases and the 600 px commit/branch card fail; the 1440 case passes. Earlier tracing reproduced four failures at 600 and four passes at 1440. In each failure Git returned the correct post-consent data; the tooltip disappeared on the client.

| Before | After | Why |
| --- | --- | --- |
| Scrolling the agent collection can lose its disclosure header outside the outer drawer | The existing header stays sticky within its own disclosure and uses the existing surface token | The person can always collapse the collection; no new chrome or changed sizing |
| Every scroll or pointer leave closes a card, including native scrolling caused by keyboard focus | A focused, visible token keeps its description attached and repositioned; unfocused/offscreen cards close | Keyboard focus owns its description without a mouse-position race |
| An async lookup can finish after a newer open/close request | Generation checks ignore superseded results and unmounts | Old responses cannot win a new card's lifecycle |

Unchanged regression assertions: **16/16 pass**, four repeats of both 3/300-agent cases and both 600/1440 commit/branch cases, Edge/two workers/no retries. Existing durations/easing and Git/permission boundaries are unchanged. The original product-workspace anchor check also passes; the remaining five cases have now passed their unchanged-or-intentionally-migrated targeted checks below. Genuine acceptance and the final broad gate are recorded below; this closes the named seven-case scope, not the overall release reliability gate.

The remaining cases are those named in TASKS: product-workspace:627, b2-live:63, material-motion:132, p1-pacing:40/:266. The SHIP-16a inventory retains the additional hosted observations; a symptom is not a diagnosed cause, and no unknown failure is waived. Protected specs and MOTION-3 production choreography remain untouched.

## Remaining local causes and checks

| Case | Cause and correction | Preserved proof | Local result |
| --- | --- | --- | --- |
| product-workspace:627 | Selecting an agent adds Clear focus to the toolbar. The inner history padding increases 184 → 218 px without any passage changing height. The approved inner ResizeObserver branch now restores the detached reading anchor, as the passage-size observer already does. | Original test unchanged: same passage and less than 3 px displacement through filter, map return and appearance changes. No arrival or hover changes. | Pass |
| b2-live:63 | The copied native-shaped fixture contains 28 observations, not the old 26. Observation totals and rendered steps are different domains. Capture the initial store count and assert exactly 900 appended observations; keep the exact 924-step check. | All burst, size, reconnect, map-off, anchor and zero-additional-ingest checks retained. | Pass |
| material-motion:132 | Modern intentionally removed the centre header capsule; the clear gap passes pointer hits to the world. The old assertion required an invisible header to intercept those hits. | Composer still owns its hit; the header gap must hit the actual hovered material and the brand must own its own hit; both edge veils retain 8 px blur. Hover/scroll/bounds checks unchanged. | Pass |
| p1-pacing:40 | Scroll-driven preview-edge masks were counted as timed material animation. Surface also correctly requires an exposed recorded agent, while the fixture left Agents closed. | Exempt only the named ScrollTimeline custom-property mask, not opacity/transform/text animations. Expose the real agent before its prose arrives. Emit/Resolve/Surface/Lift/Settle and content visibility assertions remain. | Pass |
| p1-pacing:266 | The synthetic map node was behind the card at x=1120 px, so its true origin was occluded. The renderer correctly rejected it. Move only the fixture node to the exposed gutter, x=341 px. | Same measured-node tether coordinates, explicit occlusion/tree fallback and map-off fallback checks. Production origin logic unchanged. | Pass |

Final targeted logs are private `.local/final-anchor-links.log`, `.local/final-target-parallel.log`, `.local/final-target-serial.log` and `.local/final-b2.log`. Edge, two parallel workers and one serial worker, retries zero. Seven named cases have eight parameterised checks (Agents has two sizes); link cards also retain both widths. No higher timeouts or retries were introduced.

The earlier hosted failure inventory remains [here](ship-16a-browser-classification.md). These local repairs do not claim a new Linux/macOS browser run or silently clear the additional hosted observations. Hosted verification remains the already recorded phase-E gate, untouched by this PR.

## Genuine-session acceptance

The sources were imported read-only into fresh temporary Drishya homes, never the user's home. Both use actual native recordings. At each width, open Agents, reach its last row and keep its summary reachable; use a real wheel gesture to detach Follow, wait for measured allocations to settle, apply and clear a real agent filter, and measure the same surviving passage. Then focus an actual prose link, scroll its history by 8 px without losing the card, and Escape to dismiss. No journal text is logged. Four private frames and metadata are in `.local/ship-16b/`.

| Harness | Recording prefix | Source bytes | Observations | Widths | Agents | Surviving-anchor displacement | Focused prose card | Page errors |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- | ---: |
| Claude Code | `rec_be806b25` | 8,627,732 | 2,747 | 600 / 1440 | 1 | 0 px / 0 px | commit, both widths | 0 |
| Codex | `rec_73cbf2eb` | 246,794 | 55 | 600 / 1440 | 1 | 0 px / 0 px | file, both widths | 0 |

The four genuine checks pass. Both native samples have one recorded agent; the unchanged synthetic 3/300-agent checks supply the large-family regression stress, not a claim of a genuine 300-agent session. The initial private harness attempt used a different capture whose initial history window had no tool cards; it was not counted. Another attempt set scrollTop without detaching Follow and was corrected to an actual exposed-gutter wheel gesture; that invalid test setup is not claimed as a product defect or a pass.

## Final verification

- Both-project typecheck: pass. Related units: 43 pass across nine files.
- All units: 1,378 pass / one existing skip / one five-second Git-branches timeout. The unchanged Git-branches file passes all five tests alone afterward. No unit timeout was increased and the failed all-unit result is retained.
- Package verification: pass, including isolated offline installation, both harness imports, authenticated API and restart.
- `pnpm check:real -- workspace-files --max-mb 1 --pick 1`: scratch imports pass for both harnesses; 31 Claude and two Codex candidate journals, 29 and one captured file references in the chosen samples. This scan supplements, rather than replaces, the four actual UI journeys above.
- One full browser command through `pnpm check:affected`: Edge, two parallel workers / one serial, retries zero, own install and freshly built UI. **751 parallel + 31 serial pass; 28 skips; three failures.** Parallel 15.3 min; serial 2.5 min. All seven named cases pass inside this full run as well as targeted runs. It is **not a green full gate**.

| Remaining full-gate failure | Exact evidence | Isolated result and disposition |
| --- | --- | --- |
| fresh-workspace:55, Toolbox collapse | Initial y differs by 8.25 px from the earlier measured rectangle. Agents is closed; its sticky summary does not change flow height. Collapse/motion owners are unchanged. | 3/3 unchanged isolated passes. Keep the failure; initial measurement timing is a candidate, not a verified cause. Existing TEST-2 follow-up, not a reason to waive release reliability. |
| workspace-toolbar:88 | Exposed-gutter wheel expects scrollTop >20, receives 0. | 3/3 unchanged isolated passes. This exact signature is already recorded on clean main in TEST-2 (21 Oct); no new clean-main comparison run. Source and spec unchanged. |
| b2-live:197, B3 reader | Full run's Previous match stays on 240 instead of 249. Two isolated runs reach later and time out at the hidden Go field; retained snapshots show source options closed after the second toggle. | 1/3 unchanged isolated passes; two 90 s failures. Not called a flake cleared by a pass. Menu setup is implicated, but the production attribution of the earlier match miss is **unverified**. Reopened TEST-2 records both signatures. No B3 assertion or reader source was changed. |

The private all-gate logs and error contexts remain `.local/final-*.log` / `.local/final-gate-artifacts/`; the isolated B3 traces are also copied to `.local/isolated-b3-artifacts/`. The original failure records are retained even where isolated repeats pass. No retries, relaxed assertions, clean-main comparisons, hosted dispatches or protected-file edits.

## Merge and release boundary

The user explicitly reserved **only History.tsx's inner ResizeObserver padding branch** beside MOTION-3; preserve its independent arrivals, hover and choreography edits when merging. LinkCard lifetime and the Agents summary are the other two production edits. The test migrations are listed individually above. No new design, palette, event schema, permission or native-control behaviour.

SHIP-16b's seven named cases are fixed and accepted; TEST-2 is reopened for the three other full-gate failures rather than falsely claiming the full suite green. The existing [hosted inventory](ship-16a-browser-classification.md) is retained: local passing cases do not prove Linux/macOS browser readiness or clear its additional observations. The user already moved that hosted verification to phase E; this PR does not alter that policy. Only Opus reviews and merges.
