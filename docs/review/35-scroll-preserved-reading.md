# 35 — Scrolling preserves motion and reading

8 October 2026. Latest builder correction, superseding the wheel cancellation and hover-boundary dismissal in 34. Local verification only; hosted CI is reserved for publishing.

## Reader contract

Wheel gestures do not cancel whole-material arrivals, result settlement, prose fades or reflow. Reduced-motion/low-resource settings, explicit interaction, leaving a view and unmounting still release work. No historical character copies, fabricated streaming or repeating arrivals are introduced. Origin geometry is remeasured as the viewport moves; a decorative cue whose target genuinely moved can expire, while the real action continues its finite transform.

Inside an enlarged hover card, a nested result consumes scrolling while it has room. At its boundary, the wheel continues through history without destroying the hover surface or snapping its dimensions back. The source passage is pinned during hover so virtualization cannot unmount that one real article. Pointer departure returns it smoothly; Escape and explicit reading/view actions release it. A captured burst and optional replay clock remain independent. This does not disable Follow for local result scrolling. Forwarded upward history scrolling disables Follow; downward scrolling preserves state.

A forwarded wheel changes Follow before the native scroll event. History therefore defers anchor restoration through that gesture, so React cannot put the camera back at its previous location. Reaching the document start holds the actual start across late layout changes; a new downward wheel/keyboard/scrollbar gesture clears that hold.

## Prompt rail and compact controls

The narrow right-edge navigation rail represents captured prompt chapters, independently of the native scrollbar. Marks use prompt order rather than ratios of estimated document heights. The prompt containing the reading position has a longer bright tick; hover/focus reveals its ordinal and captured prompt, and activation goes to the existing history destination. Up to 60 sampled chapters plus the current and final chapter keep the rail bounded; paged readers explicitly label the scope as loaded history. No fabricated timestamp or progress percentage. In graph/inspector views it stays out of the reading space.

The send button uses an upward arrow and Stop uses a square, in the same compact circular footprint, with accessible names and neutral focus. Mandatory workspace/idle-client consent and exact native approvals are unchanged. The duplicate native response receipt is removed from the composer; recorded agent responses belong to history. Native errors, redaction warnings and approval requests remain visible; no native protocol output or stored evidence is fabricated or discarded by this presentation change.

Search enters already at its final top-right location. Its animation selector explicitly overrides the older centered search transform, which previously caused the observed lateral jump. Reduced motion still suppresses entrance motion.

## Verification

Regression coverage checks real arrivals against wheel cancellation, local scrolling and both hover boundaries, retained single-article identity, prompt rail activation/current chapter, exact consent/approval transport without duplicate response UI, and zero horizontal movement in search entrance. Hover continuity samples account for elapsed frame time so a delayed JavaScript sample is not mistaken for a compositor jump. Final results are recorded in STATUS. Native-version, physical-platform/resource and human preference acceptance remain release work, not certified by synthetic journeys.

Local final-code validation: typechecks and 292 units; 57 regular browser journeys, two opt-in skips; production UI/offline packed install/import/authenticated API/restart; three repeated hover/start journeys; rendered composer, prompt rail and search review; clean diff. The ten-minute synthetic live-reading exercise passed at **603,879 ms, 92 bursts, 804 peak DOM nodes**, preserving passage anchors and finite presentation. No hosted CI. These results do not certify physical/native/platform or human preference acceptance.

## Latest builder clarification — enlarged size, moving with history

The prior viewport-pinned interpretation was incorrect and is superseded. Keep the card's enlarged size, but move it with the conversation by the actual history scroll delta. Because a fixed reader does not inherit an inner scroller's movement, update its top coordinate by that same delta, including during return/arrival motion. Do not clamp it back into a fixed screen position on each scroll.

Hit-test the current, moving enlarged rectangle. While the cursor remains inside it, keep hover active. If scrolling moves that rectangle away from a stationary cursor, or the mouse leaves it, allow the existing brief departure dwell and smooth return. Re-entering the bounds cancels the pending return. Never dismiss merely because a scroll occurred or the event target/`:hover` state is stale. Source-passage pinning, one real article, local-result scrolling, Escape/view guards and independent capture/Follow/replay remain.

Local typechecks/build and three affected browser journeys passed: live hover/capture, nested result boundaries with y movement exactly matching history and unchanged x/width/height, retention inside moved bounds and return when scrolling carries the box away from the stationary pointer, plus rapid switch/selection/reduced motion. Prior broad and ten-minute evidence above is not claimed as rerun. No hosted CI.

### Scrolling beneath workspace chrome

The same enlarged article now stays in history's normal stacking context, using fixed coordinates and its existing resting slot rather than a browser top-layer popover. The header and composer cover it naturally when scrolling carries it beneath them; no clamping, duplicate evidence or separate overlay copy. Their controls remain clickable. Header edge blur samples the actual material underneath, and the composer has a bounded 24 px masked blur above its solid, readable input. Neither veil intercepts pointer input; low-resource mode disables blur. Keep ancestors of this reader free of transforms/filter containment that would change its fixed-coordinate origin.

Browser coverage scrolls the enlarged real card through both chrome edges, checks preserved hover and actual chrome hit-testing at overlapping coordinates, and retains exact scroll-delta geometry, local result scrolling, smooth return and independent replay checks. Composer checks also cover zero artificial horizontal/vertical overflow at desktop and narrow widths. These are local checks; hosted CI stays manual until publishing.
