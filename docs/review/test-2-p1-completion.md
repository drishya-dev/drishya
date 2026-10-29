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
