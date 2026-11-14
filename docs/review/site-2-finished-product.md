# SITE-2 — finished-product presentation

Status: in progress in PR #498, not release or merge clearance. Yash transferred SITE-2 from Harsh to Codex on 14 November. Product UI, daemon, native policies and other LAND claims are untouched.

## Presentation

The existing Superconscious-inspired composition and scroll-driven tour remain the foundation. Refine the hierarchy, neutral controls and supporting content rather than replace the established tour. The page now explains following the agent and inspecting the code in one place, includes Claude Code, Codex and Antigravity, and states that Antigravity is read-only. Comparison copy avoids claiming that other harnesses cannot show their output or diffs. Privacy wording says recognised secrets are redacted, rather than promising perfect secret removal. Source/docs/releases/issues links replace empty footer destinations; no invented community channel.

Skills read: emil-design-eng, Taste, Impeccable, animate. Impeccable's Windows context launcher was absent; its documented fallback was used with repository context. Repository desktop widths, evidence rules, existing assets and approved tour choreography take precedence over generic starter/mobile requirements.

## Interaction fixes

- The laptop acknowledges a step after the actual React material can paint. Its parent has one seek in flight, coalesces to the latest scroll position and verifies message origin, source and request identity.
- The original chapter order and timeline durations remain. Breakpoint measurements update during resize; caption positioning does not accumulate its own transform. Laptop sizing accounts for the base as well as the lid, preventing sideways overflow.
- Feature pinning uses CSS sticky ownership without reparenting. Original cursor, click and zoom sequence/timing remain in the shared ordered footage manifest.
- Reduced motion previously left all feature descriptions on one grid cell with an empty demonstration window. It now exposes all descriptions and 16 stills in order, with descriptive alternative text.
- Pending/failed footage has an explicit status. Its state is derived from timeline position and image decoding, without reading computed styles on every scroll frame.

## Evidence and checks so far

- Separate worktree and frozen install. Own loopback site preview uses 5193, never the user's 7878 or 5180.
- Root, UI and the new site TypeScript configurations pass.
- Rebuilt site: seven named browser cases pass in Edge and seven in Firefox, 600 and 1440, no retries. DRISHYA_WORKERS=2 is the cap; one spec effectively used one worker. Tests cover replay reversal, breakpoint resize without iframe reload, forged acknowledgements, 16 decoded frames in preserved order, reduced-motion reading, no sideways overflow, loading and failure.
- Initial browser failures: the new test sought the final replay step too early (41 was correct at that position); corrected the position. Real layout failures: laptop base overflow in normal motion and at 600 in reduced motion; fixed the actual geometry, without weakening the overflow assertion.
- `pnpm check:real -- questions --pick 1` uses a scratch home: Claude `rec_024517cd`, 6.3 MB, 426 operations, nine questions; Codex `rec_c777ea7f`, 0.2 MB, one operation/one question. No native turn or harness setting was changed.
- Capture candidate Claude `rec_08e86b81`, 7,544,502 bytes. Its complete linked history has 10,212 operations. Capture tooling must wait for complete imports and visible material, not a fixed timeout; source fragments are not published as a complete session.
- Capture failures exposed obsolete selectors, hidden secondary actions, a wrong dataset, unrelated background requests and swallowed failures in the old script. Current work uses visible native controls, actual material/reader states and a required-frame inventory. Errors report controlled stage names, never Playwright snapshots containing journal text. Partial captures remain explicitly incomplete.

## Still required

- Finish all 16 new footage views, exact measured click mapping, before/after content checks and the laptop sample refresh against the selected current-main product.
- Yash reviews each real frame locally before any is copied/committed. Existing public footage remains unchanged until that approval; screenshots and scratch stores stay under .local.
- Final complete capture and website walk, Edge/Firefox at both widths; performance comparison using SITE-3's three-run, 4x-throttled whole-visit protocol at 1440/2000. Baseline is saved privately; do not claim the smoothness floor cleared before the after measurement.
- Run affected checks at the completed boundary. Its dry plan selects both types, related units and 54 browser specs through shared class/import matches. The full gate has not run for this draft.
- Completion tick/claim removal and task sync only after acceptance, or an exact external blocker is documented. No merge by Codex.

Reference: https://superconscious-app.webflow.io/ (composition and pacing; no copied code/assets).
