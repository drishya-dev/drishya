# 23 — P1 material pacing and readable growth

6–7 October 2026 · Yash / Codex · `codex/ink-presentation`.

The builder clarified that smooth presentation means the displayed file/result unfolding coherently, not merely icons moving between locations. Slow the whole meaningful choreography, size source/output/prose for actual reading, and prevent one large item from scrolling past itself. This supplements [21](21-integrated-ink-workspace.md) and [22](22-p1-motion-lifecycle.md); the integrated app remains the deliverable.

## Material, rather than an icon race

The measured material backing travels from the actual map/reference/dock origin, first opens horizontally, then unfolds into the destination's real width and bounded height, and settles into its existing boundary. A low-opacity fill keeps stationary characters readable throughout. Tool/file silhouettes remain secondary identity cues; they are not the complete transition.

All finite cues use a shared slower tempo, scaled by the destination's measured reading area: 1.6–2.1 times their original duration. A material unfold is about 0.99–1.30 seconds; a file transfer about 1.12–1.47 seconds. Source/command/output/prose arrive whole and selectable without waiting for these cues. Resolve, Settle and Surface share the slower tempo rather than racing ahead of the material. Every cue remains bounded and interruptible; reduced motion suppresses it.

Source artifacts can finish loading after their outcome step. A bounded readiness map (96 IDs) and history mutation observer detect the actual pending-to-readable transition for recently observed live reads. The file initially arrives from its real map/reference origin; its loaded contents unfold from the captured filename already on that reading surface, without sending another icon or replaying a tool invocation. This avoids making a completed read depend on a newly discovered or occluded map node becoming visible. Initial historical mounts seed their current readiness and do not animate; deliberate navigation clears the recent-live set. The pending state is seeded before the first paint measurement to avoid missing a fast fetch. Only readiness changes earn this motion; text is never retyped or copied into a flying representation. Loading placeholders are static, with no scanning shimmer.

A staged burst spends its three-action/two-prose motion budget on the earliest newly observed items. Selecting only the last items often spent the budget below the held viewport. This is a bounded presentation choice, not a claim that every action in a 200-call burst has an individual visible animation, nor a queue that delays capture.

## Readable sizing

Unexpanded material surfaces cap their height at `clamp(240px, 54dvh, 430px)`. Their bodies scroll locally, without the old mask fading captured text away. At the preview boundary, wheel input can continue into history; expanded source/output readers retain their own established behavior. Full expansion still takes the passage width and uses bounded source pages.

Desktop titles are 12.5 px; command/request/output text uses 12.5 px and 1.65 line height; source/diff uses 13 px and 1.75. Agent prose remains unboxed at 14.5 px/1.75 and at most 72 characters wide. Semantic surface widths remain allocated; new siblings do not stretch/shrink an existing operation merely to fill a row. Narrow-screen layouts and actual tool identities remain usable.

## A single late result cannot drag the camera to its bottom

Text/burst staging alone missed asynchronous source artifacts. History now remembers its actual rendered extent alongside the passage/pixel anchor and watches growth after live work arrives. A later increase larger than one quarter of the viewport, bounded to a 72–180 px threshold, holds the prior viewport instead of issuing another bottom-follow. Small resolutions still follow normally. Initial load and explicit Return to latest deliberately reach the latest edge and reset the watch.

Long captured command/MCP inputs are staged too, not only long output/prose. Paged timeline checks subtract the explicit global offset before reading their bounded timeline window. Capture and history continue while the reader holds; no data is delayed or dropped.

An automatic reading hold is distinct from deliberate navigation: the visible new material may still finish its initial arrival while the camera stays put. Pointer-down, keyboard reading, scroll, visibility or reduced-motion changes cancel it and discard unshown cues for that frame, so passive hover cannot resurrect an interrupted arrival. The component-owned registry and destination geometry checks from [22] remain.

Origins uses History's exact-position programmatic-scroll guard. An anchor correction revalidates destinations without clearing source-ready eligibility; a real intervening gesture still cancels. This prevents timing-dependent cancellation when the late artifact and the camera hold settle in adjacent frames. Glyphs track their exact header destination, independently of body height. Material rectangles also invalidate on height changes, so old loading-size backings cannot remain over a larger result.

## Verification and phase boundary

A new synthetic browser test delays a real artifact API response, delivers an 80-line captured read, then proves the input header remains visible, the reading position is retained, the preview is bounded, Return to latest is offered and a full-height material unfold accompanies the actual loaded source. The final source-header readiness transition passed 20 consecutive repetitions. Final local checks passed: typechecks, 252 unit tests, 33 ordinary browser journeys and isolated offline package verification. Real-session and sustained-reader cases remain explicit opt-ins. The frozen-arrival cases inspect actual material and instrument animation frames, and verify deliberate-reading/system-reduced-motion cancellation. The stationary-text assertion targets the content body, rather than treating a transient border-colour transition as character movement; passive hover targets the visible header so automation does not scroll the operation's off-screen centre into view. Existing row wrapping, late-result, map-origin, narrow-screen, source utility, replay, export and held-reader checks remain.

The readiness ten-minute reader passed at 602,459 ms, 114 rounds, peak 709 DOM nodes; the material/late-growth reader passed at 603,247 ms, 114 rounds, peak 709 nodes. Both precede the final bounded-input, glyph-geometry, source-header and programmatic-scroll refinements; those passed the final ordinary suite and readiness repeats separately. STATUS carries these measured scopes. Intermediate browser runs exposed automatic-hold suppression, preview wheel trapping, and a later programmatic-scroll/readiness cancellation race; these were fixed. Another run had a Chrome `ERR_NETWORK_IO_SUSPENDED` navigation error; the subsequent complete run passed without weakening that assertion. Original choreography/patch tests remain alongside the new burst tests. Long MCP input checks inspect a bounded number of fields without serializing nested payloads.

P1 is the integrated presentation baseline: content-shaped materials, real origins, five meaningful moves, immediate input/actual output, independent accumulating history, deliberate reading and resource/accessibility alternatives. It is not the entire release or every proposed IDE feature. Read-only folder/symbol/reader-tab proposals remain in DEVELOPER_WORKSPACE and review/19; physical/platform compatibility and human comprehension testing remain release work. Do not call the product user-approved, market-first or universally performant on the strength of local checks.

Keep both docs/prototype references, retire the old standalone gallery, work on this app, and use local tests/commits. Hosted CI remains publishing-only. No capture/store/API/observation-schema/dependency changes accompany this pass.
