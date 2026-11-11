# LAYOUT-1c — the stage follows physical screen width

Yash with Codex, 11 November. Claimed on main before work; runtime `9b8aab21`. Whole implementation and genuine acceptance complete; the final broader gate is still running. No merge by Codex, hosted dispatch or clean-main comparison.

## Behaviour

The CSS stage cap is `calc(2560px / var(--device-ratio, 1))`. The entry point installs the device ratio before rendering, updates it on resize and resolution changes, and rearms the resolution listener after each ratio change. The stage-only selector activates when the actual CSS viewport exceeds that physical limit, including high-density displays. The full-width repository map is unchanged.

ReadingWindow resolves the same CSS expression using a zero-height invisible measurement element; it no longer tries to parse an unevaluated calc expression as a number. Zoom-out gives passages a proportionally larger maximum, while agent prose retains its existing ch measure. At device ratio 1 the existing 1280 CSS-pixel passage maximum remains; neither font size nor the constant interface scale is changed.

| Before | After | Why |
| --- | --- | --- |
| A 1920 CSS-pixel cap shrinks to half a laptop screen at 50% zoom | A 2560-device-pixel cap leaves a 1920-device-pixel laptop uncapped at every requested zoom | Zoom-out adds working space instead of widening empty map margins |
| ReadingWindow parses only a number/rem token | It measures the actual computed CSS length | Peek and docks share one cap, including calc and device ratio |
| A fixed CSS passage maximum prevents zoom-out from showing more material per row | Its physical maximum can grow in CSS pixels when zoomed out; prose remains ch-bounded | More cards fit without stretching reading text or changing text size |
| Width-only media gating cannot distinguish high-density from physically ultrawide windows | Stage limiting follows device ratio and measured CSS cap | A 5120-device-pixel screen centres at either tested density |

The selected cap deliberately fills both 1920 and 2560 device-pixel windows and centres a 5120-device-pixel ultrawide. This changes the former 1920-pixel cap's wide-screen placement, as requested; it does not reinstate viewport-derived font scaling. Existing 600/1440 text and controls stay browser-sized. Toolbox hit/layer rules, composer gap, History source, shared palette/foundation tokens and motion are unchanged.

## Genuine acceptance

Imported read-only into a scratch Drishya home. No journal material is printed or committed; screenshots and numeric results stay in `.local/layout1c/`.

| Harness | Prefix | Bytes | Observations | Final physical-size/ratio cases | Actual file peeks |
| --- | --- | ---: | ---: | ---: | ---: |
| Claude Code | `rec_be806b25` | 8,627,732 | 2,747 | 9 | 9 |
| Codex | `rec_aba0ec58` | 201,701 | 27 | 9 | 9 |

Each harness covers 1920×1080 at 100/80/67/50/33%, 1440×900 and 2560×1440 at 100%, and 5120×1440 at both ratio 1 and ratio 2. All 18 cases retain a 16 CSS-pixel root, no document horizontal overflow, History at y=0, correct capped/uncapped state, and the actual current file peek's right edge 48 CSS pixels inside the stage. Zero page errors. A separate live CDP metrics sequence on each real capture traverses 100→80→67→50→33→100%: 12 steps, zero surviving dock displacement between settled frames, zero page errors. This emulates browser zoom through viewport/device scale; it is not a human browser-toolbar or physical-monitor test.

The initial 50% baseline on both harnesses had the Files controls at x=978 CSS pixels. The final laptop cases keep them at x=18 at every ratio. A richer Codex sample (`rec_275b92f0`, 6,046,741 bytes, 319 observations) also passed the main-stage geometry matrix but had no current indexed file suitable for peek acceptance; the genuine FILES-16 native scratch capture supplies that case instead. No journal was fabricated and no harness policy or saved setting changed.

## Verification ledger

- Both project typechecks and fresh UI build pass.
- Three focused units pass: immediate ratio installation, resolution-only updates/listener rearming, high-density physical limiting, invalid-ratio fallback and complete cleanup/previous-state restoration. They also assert no font-size write.
- All 17 large-screen browser cases pass with two Edge workers and no retries, including old reader bounds, composer toggles, 600 px overflow, the five device ratios and an in-place ratio sequence. Old stage geometry expectations intentionally move from 1920 CSS pixels to 2560 device pixels. The new right-header assertion initially assumed 25 px; measured existing 30 px is now asserted exactly. No product margin was changed to make that new test pass.
- Final all-unit/package/affected-browser results pending. Do not call the whole gate green from these focused results alone. TASKS completion and claim removal belong in the final PR.

## Merge boundary

Fresh branch/install from current main after FILES-16 ready PR #417; FILES-16 source is not stacked here. Six source/test paths plus this report, TASKS, STATUS and CONTINUITY (10 total). GIT-9 UI consolidation stays separate. This task touches only the root stage installation, stage CSS/reading bounds and their tests; no protected file changes. Opus reviews and merges.
