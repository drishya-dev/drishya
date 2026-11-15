# SITE-2 — finished-product presentation

Status: SITE-2 complete in PR #498; ready for builder review, not release or merge clearance. Yash transferred SITE-2 from Harsh to Codex on 14 November. Product UI, daemon, native policies and other LAND claims are untouched.

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
- Rebuilt site: eight named browser cases pass in Edge and eight in Firefox, 600 and 1440, no retries. DRISHYA_WORKERS=2 is the cap; one spec effectively used one worker. Tests cover replay reversal, breakpoint resize without iframe reload, forged acknowledgements, 16 decoded frames in preserved order, reduced-motion reading, no sideways overflow, loading and failure, navigation, evidence dismissal and installation copy feedback. Escape now closes comparison evidence without focus immediately reopening it.
- Initial browser failures: the new test sought the final replay step too early (41 was correct at that position); corrected the position. Real layout failures: laptop base overflow in normal motion and at 600 in reduced motion; fixed the actual geometry, without weakening the overflow assertion.
- `pnpm check:real -- questions --pick 1` uses a scratch home: Claude `rec_024517cd`, 6.3 MB, 426 operations, nine questions; Codex `rec_c777ea7f`, 0.2 MB, one operation/one question. No native turn or harness setting was changed.
- Primary replacement: recent Claude Code `rec_4f80d97c`, 8,108,810 bytes, 406 operations, 44 recorded file paths (15 repeated), two prompt chapters. All 16 required views were captured, including Claude Code's own composer; the typed follow-up is a draft, never submitted. File history has 13 actions on the chosen file. The older limit-ended session was rejected, not published.
- Yash requested a heavier prompt rail and populated Git graph before approval. Claude `rec_81c22a35`, 319,038,727 bytes and 10,097 operations, exposes 506 genuine prompt chapters; the count is not changed to the approximate 531 in the request. Git footage was replaced with 250 loaded commits and 29 branch labels, using normal pagination and Fit controls. A shaped history placeholder caught during this check was rejected; capture now waits for visible paged-history material too.
- Earlier Antigravity footage remains a private alternative; it is not the approved primary set. Every frame has its own actual harness/recording provenance. Yash approved the final exact 16-frame set in chat on 14 November. Its SHA-256 approval digest is `cceee5caec2286c6b8cb16c1eda0feffe3462c98de1fbc7030884692f477aba5`; those bytes and measured cursor coordinates were committed in `46f8d372`. Antigravity and the rejected limit/loading captures remain local.
- The laptop's synthetic bundle was regenerated through the normal CLI: 17 operations and 45 steps remain; only its privacy-policy and reducer-version metadata changed. This is SITE-2's explicitly required bundle refresh, not a product UI change.
- Capture failures exposed obsolete selectors, hidden secondary actions, a wrong dataset, unrelated background requests and swallowed failures in the old script. Current work uses visible native controls, actual material/reader states and a required-frame inventory. Errors report controlled stage names, never Playwright snapshots containing journal text. Partial captures remain explicitly incomplete.

## Acceptance

- All 16 approved real frames are committed, with exact measured cursor positions and unchanged grouping/order/timings. Twelve actual pointer-event receipts and the deliberate prompt hover are validated within 4 px. Frames without a click retain their original hold. Public JPEG hashes were checked against all 16 approved source buffers.
- Yash approved the exact final set in chat. The publisher refuses partial captures or a mismatched approval digest. Private journals, scratch stores, metadata, galleries and alternate captures remain under .local; only the approved public JPEGs were committed.
- Root, UI and site typechecks pass; site and UI builds pass. Related-unit invocation succeeds with no related unit tests; no unit count is invented.
- Final approved-asset browsers: eight Edge (13.7 s) and eight Firefox (15.7 s), no retries, at 600 and 1440. DRISHYA_WORKERS=2 is the cap; this single spec uses one worker. All 16 images decode and follow the preserved sequence; reversal, resize, reduced motion, no horizontal spill, image loading/failure, keyboard dismissal, navigation and copy feedback pass.
- An additional normal-motion Firefox walk checks nine sections at each width, waits for fonts and visible images, opens/closes comparison evidence, and finds no horizontal overflow or runtime errors. Twenty local screenshots remain in .local/site-2/final-firefox-walk; the laptop shows actual rendered material.
- The broader affected run is **red**: 446 parallel passed / four failed; 20 serial passed / one skipped / one failed. All five reproduce alone (one worker, no retries; an extra composer case passes). Exact causes and handoff follow. This is not a green full-product gate, and no clean-main reproduction is claimed.
- TASKS is ticked and the SITE-2 claim is removed in this PR. The full gate, hosted CI, deployment and merge are not performed by this task.

## Smoothness: paired whole visits

Same SITE-3 script and four-times CDP CPU throttle, Edge DPR 1, three visits each at 1440x900 and 2000x1100. Each visit includes first load, hover, full-page wheel scrolling, evidence hover and resize. The final run uses the approved assets, with no capture or browser suite alongside it. Medians of three; raw results/traces stay in .local/site-trace/site2-before.json and site2-approved-clean.json. An earlier diagnostic run overlapped capture and is not used below.

| Metric | 1440 before | 1440 final | 2000 before | 2000 final |
| --- | ---: | ---: | ---: | ---: |
| First 3.5 s, frame p95 (ms) | 25.0 | 12.6 | 33.3 | 20.8 |
| Scroll frame p95 (ms) | 91.7 | 33.6 | 33.4 | 29.2 |
| Scroll frames over 33 ms | 154 | 128 | 138 | 97 |
| Long tasks, whole visit | 105 | 48 | 77 | 41 |
| Longest scroll frame (ms) | 645.8 | 541.5 | 599.9 | 466.6 |
| Layout shift (CLS) | 0.0140 | 0.0161 | 0.0063 | 0.0071 |

Frame costs and long-task counts improve. Not claimed: identical CLS or zero stalls. CLS increases by 0.0021/0.0008 with the changed content; it remains small. The laptop still renders the real product, so its worst frames remain material; this is not a new lightweight renderer or a broad performance guarantee. No extra draw loop, presentation-dependent capture or changed tour timing was introduced.

All six paired runs (three at 1440, three at 2000) exist in both the before and the final trace files (`site2-before.json`, `site2-approved-clean.json`); the table above is the complete comparison, with no run missing. Final frame costs and long-task counts are at or better than the before (SITE-3 baseline) at both widths; only CLS rises slightly, as disclosed.

Reproduce: build with `corepack pnpm --filter drishya-site build`, then `node scripts/site-trace.ts --label <name> --runs 3`. Source capture is read-only into a scratch store. For the heavy-rail supplement, open the genuinely imported history, scroll to prompt 498 of 506 and wait for all visible history placeholders to leave before hovering its real tick. For Git, use four Page Up loads to reach 250 commits, Fit and move focus back to the graph; choose the actual branch for the next frame. No DOM content or counts are substituted.

Reference: https://superconscious-app.webflow.io/ (composition and pacing; no copied code/assets).

## Broader affected-check failures (not concealed as green)

The first 59-spec run used two parallel workers plus the one-worker serial pass. Its five failures are outside the site source changes:

- `composer-typography:107` at 390 px: the Tools toggle intercepts the composer click. This is below the supported 600 px desktop minimum; no phone UI is changed for SITE-2.
- `fresh-workspace:153`: an old geometry assertion reports a large displacement (expected under 1 px). The product/composer sources are unchanged here.
- `fresh-workspace:1444`: the spec expects “Answer requested”; the current product says “Needs an answer”. This branch changes neither string nor that test.
- `toolbox-window:172`: the composer Attach control intercepts a Toolbox interaction. Keep with the product/motion owner; do not work around it in the site.
- `p1-pacing:722`: the next-page replay text assertion fails. Product history and paging code are unchanged here.

All five failures reproduced without the capture workload, using one browser worker and no retries; the additional minimized-composer case passed. They are not dismissed as timing flakes. **Clean-main check (15 Nov, Claude, clean `origin/main` worktree with its own install, UI rebuilt, Edge, `--retries=0`): all five fail identically on main, so all are pre-existing and not caused by SITE-2.** No product UI/daemon/package source differs from origin/main; only the explicitly required synthetic public bundle metadata changed outside the site. Fable should route these five findings to the product/test owners; SITE-2 does not work around them. The broad affected run remains red, while all eight site cases pass in both browsers.
