# TEST-2 — remaining P1 regression acceptance

29 October 2026. The builder transferred this item from Harsh/Codex after the P1 content tasks.

The integrated P1 batch (browser evidence, questions/approvals, plan material, direct readings and image-first recovery) completed its parallel browser pass with 472 passed and 25 skipped. In the serial pass, b2-live:62 failed a strict anchor assertion at the third width: its selected synthetic operation was from the second preceding append burst, identifying the 390 px loop. The reported offset changed from -90 to -85 px. Its 1440 and 900 px stages had passed. The remaining b2-live cases at :139, :186 and :308 passed in that run.

The repository explicitly supports desktop windows of 600 px and wider. The old 390 px loop is replaced by the minimum supported 600 px window, preserving the entire journey and every anchor, follow, capture, reconnect and overflow assertion. No tolerance or timeout changed, and there is no History product change in this increment.

The first batch also found a stale r23 literal in the legacy agent-delivery migration unit after the intentional r24 question repair. CONTENT-3 now asserts REDUCER_VERSION; the sealed bytes and exact original-artifact assertions remain. This repair belongs to PR #288.

Verification results will be recorded here after the named reproduction and consecutive full browser runs. This initial evidence records the failure and supported-range correction; it is not yet a passing TEST-2 acceptance claim. Private logs remain under the isolated gate checkout's .local/p1-gate and this checkout's .local directories.
