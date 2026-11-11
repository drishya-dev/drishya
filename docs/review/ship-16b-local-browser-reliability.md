# SHIP-16b — local browser reliability

Whole item in progress, Yash with Codex, 11 November. Fresh worktree and own frozen install; current main including merged SHIP-16a (#413 / `de0fffa1`) is integrated. No hosted dispatches. The verification policy in TASKS is unchanged.

## Observed first, then repaired

Fresh-branch baseline, Edge/two workers/no retries: both agent-inventory cases and the 600 px commit/branch card fail; the 1440 case passes. Earlier tracing reproduced four failures at 600 and four passes at 1440. In each failure Git returned the correct post-consent data; the tooltip disappeared on the client.

| Before | After | Why |
| --- | --- | --- |
| Scrolling the agent collection can lose its disclosure header outside the outer drawer | The existing header stays sticky within its own disclosure and uses the existing surface token | The person can always collapse the collection; no new chrome or changed sizing |
| Every scroll or pointer leave closes a card, including native scrolling caused by keyboard focus | A focused, visible token keeps its description attached and repositioned; unfocused/offscreen cards close | Keyboard focus owns its description without a mouse-position race |
| An async lookup can finish after a newer open/close request | Generation checks ignore superseded results and unmounts | Old responses cannot win a new card's lifecycle |

Unchanged regression assertions: **16/16 pass**, four repeats of both 3/300-agent cases and both 600/1440 commit/branch cases, Edge/two workers/no retries. Existing durations/easing and Git/permission boundaries are unchanged. Genuine-session acceptance and the remaining five failure cases still need completion before this item or PR is called ready.

The remaining cases are those named in TASKS: product-workspace:627, b2-live:63, material-motion:132, p1-pacing:40/:266. The SHIP-16a inventory retains the additional hosted observations; a symptom is not a diagnosed cause, and no unknown failure is waived. Protected specs and MOTION-3 production choreography remain untouched.
