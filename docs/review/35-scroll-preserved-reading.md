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

## Latest builder clarification — fixed hover bounds

After scrolling, the enlarged card stays at its allocated viewport position and dimensions while history/source slots move behind it. Scroll events never dismiss it. Actual mouse movement outside the enlarged card's rectangle triggers its smooth return, not leaving the original source slot or a transient browser `:hover`/event-target change. Escape, explicit reader/view actions and capability changes still release it. Pointer bounds win when a post-scroll event is retargeted to underlying history. The same article/source-passage pin remains; no captured content is duplicated.

This small follow-up passed local typechecks/build and three affected browser journeys: live hover/capture, both nested result boundaries with unchanged x/y/width/height and pointer departure, and whole-card hover/rapid switch/selection/reduced motion. It does not rerun or extend the earlier ten-minute release evidence. No hosted CI.
