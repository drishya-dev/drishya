# SHIP-16b — local browser reliability

Whole item in progress, Yash with Codex, 11 November. Fresh worktree and own frozen install; current main including merged SHIP-16a (#413 / `de0fffa1`) is integrated. No hosted dispatches. The verification policy in TASKS is unchanged.

## Observed first, then repaired

Fresh-branch baseline, Edge/two workers/no retries: both agent-inventory cases and the 600 px commit/branch card fail; the 1440 case passes. Earlier tracing reproduced four failures at 600 and four passes at 1440. In each failure Git returned the correct post-consent data; the tooltip disappeared on the client.

| Before | After | Why |
| --- | --- | --- |
| Scrolling the agent collection can lose its disclosure header outside the outer drawer | The existing header stays sticky within its own disclosure and uses the existing surface token | The person can always collapse the collection; no new chrome or changed sizing |
| Every scroll or pointer leave closes a card, including native scrolling caused by keyboard focus | A focused, visible token keeps its description attached and repositioned; unfocused/offscreen cards close | Keyboard focus owns its description without a mouse-position race |
| An async lookup can finish after a newer open/close request | Generation checks ignore superseded results and unmounts | Old responses cannot win a new card's lifecycle |

Unchanged regression assertions: **16/16 pass**, four repeats of both 3/300-agent cases and both 600/1440 commit/branch cases, Edge/two workers/no retries. Existing durations/easing and Git/permission boundaries are unchanged. The original product-workspace anchor check also passes; the remaining five cases have now passed their unchanged-or-intentionally-migrated targeted checks below. Genuine-session acceptance and the final broad gate are still pending; this item is not yet ready.

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
