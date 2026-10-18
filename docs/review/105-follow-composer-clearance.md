# 105 — Follow the final composer clearance

18 October 2026. The full interface sweep reproduced a72px gap between initial Follow and the actual bottom of a160-prompt history, including when run alone.

| Before | After | Why |
| --- | --- | --- |
| Passage measurements drive follow, but late composer padding changes no passage height | Observe the history inner border box and reuse existing Follow when its allocation changes | Padding changes the real scroll destination even when captured content stays the same |
| Content-box observation misses padding-only changes | Explicit border-box observation | Account for measured composer clearance without polling or fixed offsets |

Keep the existing follow curve, navigation boundary and pointer-reading guard. Detached reading never triggers this follow path; a clicked prompt destination stays held until genuinely new captured work. No new wheel interception, timing, native/capture/schema behavior or text copy.

The existing160-prompt regression fails on the preceding build and passes with the repair. It additionally checks prompt minimize/expand both reach the real bottom. Local delayed variable-height upward paging, hover-boundary scrolling, click/downward-wheel Follow and actual Drishya/Skeletongraph histories are checked separately. Both typechecks/build and447units/77files pass; two initial targeted journeys, three final focused journeys and all three actual long-history/Workspace journeys pass. The actual journeys include95 upward wheel samples each, delayed post-render stability and both harnesses. No hosted CI/native turn/private content. Physical input-device/human acceptance remains open.
