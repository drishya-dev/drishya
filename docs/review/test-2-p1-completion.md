# TEST-2 â€” remaining P1 regression acceptance

29 October 2026. The builder transferred this item from Harsh/Codex after the P1 content tasks.

The integrated P1 batch (browser evidence, questions/approvals, plan material, direct readings and image-first recovery) completed its parallel browser pass with 472 passed and 25 skipped. In the serial pass, b2-live:62 failed a strict anchor assertion at the third width: its selected synthetic operation was from the second preceding append burst, identifying the 390 px loop. The reported offset changed from -90 to -85 px. Its 1440 and 900 px stages had passed. The remaining b2-live cases at :139, :186 and :308 passed in that run.

The repository explicitly supports desktop windows of 600 px and wider. The old 390 px loop is replaced by the minimum supported 600 px window, preserving the entire journey and every anchor, follow, capture, reconnect and overflow assertion. No tolerance or timeout changed, and there is no History product change in this increment.

The first batch also found a stale r23 literal in the legacy agent-delivery migration unit after the intentional r24 question repair. CONTENT-3 now asserts REDUCER_VERSION; the sealed bytes and exact original-artifact assertions remain. This repair belongs to PR #288.

## Additional reproducible causes

With the supported 600 px loop, the complete B2 file reproduced the long-history wheel-end failure three of three times. The document exceeded 269,000 px; the fixed 100,000 px gesture needed several runner round trips. The test process also hosts its daemon: the diagnostic measured 1,980.8 ms maximum Node event-loop delay and a 5,638.8 ms element lookup, while the browser continued 679 animation frames and the wheel hit history-inner. This is test-driver coupling, not evidence of a frozen browser. The native wheel now uses the measured document extent, and its two-frame wait plus exact distance read share one browser call. Repeated measurement still handles later extent growth. Native wheel delivery, <2 px, mounted-node bounds, selected-operation retention, focus, follow and all timeouts are unchanged.

After the wheel test completed, two of three runs exposed B3 selecting the previous one-line read via .last(). The step counter had already updated, but the newest virtual material had not mounted. The fixture helper now returns the exact operation ID it appended, and the UI journey awaits that action. The 200-line, paging, copy, focus, source-provenance and live-update assertions remain unchanged.

On the combined P1 tree, all four B2 journeys then pass three consecutive whole-file runs: 12 passed, zero failures or skips. The repaired full unit suite gives 1,031 passed / one skipped; both typechecks, UI build and package verification pass. Real-session and three consecutive full-browser acceptance follow before this task is ticked.

Private logs remain under the isolated gate checkout's .local/p1-gate and .local/test2 directories. No History runtime, hover, visual density or PERF-2/3 source was changed.
## Genuine-session held reading

Both harnesses were imported through a scratch Drishya store and opened at 600 and 1440 px. Codex prefix 32f628ee: 533,572,179 source bytes and 32,854 observations. Claude Code prefix c8e5c9c8: 82,859,509 bytes and 10,466 observations. All four desktop checks recorded zero held-reading displacement, zero horizontal overflow and zero page errors. Mounted passage slots remained bounded (two for Codex, four for Claude).

These checks prove static reading stability after scrolling through genuine paged history; they do not claim a fresh native live append. The B2 fixture separately verifies live append, focus, paging, copy and held-scroll behavior. Private screenshots and numeric logs remain in .local/test2/ in the isolated integrated checkout.
## Full-suite prompt-rail follow-up

The first post-B2 full pass on integration 03911eaf gave 471 parallel passes, 25 skips and one prompt-rail-evidence:33 keyboard-focus failure; the serial pass gave 33 passes and one skip, including all B2 cases. Its missing first marker did not reproduce in five isolated whole-file runs (ten checks passed). The failing width was not recorded, so phone sizing is not claimed as its proven cause.

That journey still exercised unsupported 320/390 px widths. It now covers 600/900/1440 px, matching the desktop contract, and names each width as a report step for future diagnostics. Exact first/last marker focus, virtualization, ledger content, popup bounds and final prompt navigation are unchanged. The acceptance sequence restarts after this supported-range correction; the failed pass is retained rather than counted as green.
## Git fixture lifetime follow-up

On a1f53354, the first two complete commands each passed 505 checks with 26 skips. The third passed all 33 serial checks but failed git-branches at 600 px: its branch selector remained disabled. The original file passed three isolated repeats (six checks), so isolated green was not treated as proof of a clean full gate.

The branch fixture reused one daemon across viewport tests and closed the first page as soon as a captured-link button was visible. Selecting the last commit starts a separate native Git read; the link does not depend on its result. Diagnostic instrumentation recorded one pending commit read at close in all four measured cases. Two controlled immediate history probes, one per width, both returned HTTP 409 while that read was pending. The daemon intentionally rejects concurrent Git inspection, and the next page has a new in-browser request queue. Thus this fixture can leak its final native read into the next viewport's initial history request. The original failed command did not retain its API response, so the controlled reproduction is distinguished from its timeout log.

The fixture now awaits the successful response for the exact selected commit before closing through its captured link. It retains the same navigation, branch, patch, captured-link, unchanged-repository and bounds assertions; no product lock, runtime behavior, timeout or assertion tolerance changed. Diagnostic probes/instrumentation stay private and are removed from the committed spec. Consecutive acceptance restarts after this repair.

## Final consecutive acceptance

Three consecutive full browser commands passed on frozen integrated P1 revision 46bebde5. Each command rebuilt the production UI first, then ran the normal four-worker parallel project and one-worker serial project. No concurrent native, unit or other browser workload was started by this lane.

| Run | Parallel passed | Serial passed | Skipped | Duration |
|---|---:|---:|---:|---:|
| 1 | 472 | 33 | 26 | 396.7 s |
| 2 | 472 | 33 | 26 | 412.4 s |
| 3 | 472 | 33 | 26 | 441 s |

The earlier failed commands are not part of this streak. The prompt-rail supported-width journey also passed five isolated whole-file runs (ten checks), with no assertion/tolerance/timeout relaxation. The combined batch also passed both typechecks, production build, 1,031 units (one skipped), and package verification. Those checks were not repeated per test-only correction.

TEST-2's remaining acceptance is complete on this Windows/Edge reference machine. This does not close deferred PERF-2/3, physical platform, accessibility or human preference gates. Other builders review and squash the task PRs; this integrated gate branch is not a feature PR to merge.
