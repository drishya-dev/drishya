# SITE-3: the landing site, smoother through a whole visit

Yash, 13 Nov: "if landing page first load, the svg animation can be made a bit more smooth, its a bit laggy." 14 Nov: "also making the site even more smoother to experience in site3." Rule: pixels and motion stay identical.

## How it was measured

`node scripts/site-trace.ts --dist <built site> --label <name> --runs 3 [--hz 60]` (a build: `pnpm --filter drishya-site build`). Edge through Playwright, headless, DPR 1, **CDP CPU throttle 4x**, viewports 1440×900 and 2000×1100, three runs each, medians below (range in the JSON under `.local/site-trace/`). One visit = first load and 3.5 s of intro, 1.5 s settle, pointer sweep over the hero and the buttons, a wheel scroll top to bottom at 2,400 px a second (through the tour and every feature), a hover over each Compare row, then four window resizes. Frame times are `requestAnimationFrame` deltas recorded before the page runs; long tasks, long animation frames and layout shifts come from PerformanceObservers; attribution from a CDP trace and a CPU profile.

**This machine's display is 240 Hz**, so the native table is what Yash sees, with every `requestAnimationFrame` loop running 240 times a second. The 60 Hz table holds `requestAnimationFrame` to 60 a second in the page (a model of a normal display). Both are in the PR.

## Result (medians of 3, 4x throttle, native 240 Hz)

| | 1440 before | 1440 after | 2000 before | 2000 after |
|---|---|---|---|---|
| first 3.5 s: frames over 33 ms | 24 | **5** | 21 | **12** |
| first 3.5 s: longest frame (ms) | 542 | **183** | 725 | **175** |
| first 3.5 s: longest long task (ms) | 593 | **401** | 538 | 484 |
| hover over the hero: frames over 33 ms | 84 | **3** | 83 | **43** |
| scroll: longest frame (ms) | 2142 | **363** | 1679 | **259** |
| scroll: frames over 33 ms | 127 | 97 | 131 | 110 |
| scroll: long tasks over 100 ms | 24 | 18 | 16 | **4** |
| resize: longest frame (ms) | 1604 | **413** | 1075 | **221** |
| resize: long tasks over 100 ms | 4 | **0** | 4 | **0** |
| whole visit: long tasks | 70 | **50** | 126 | **51** |
| layout shift (CLS) | 0.462 | **0.014** | 0.298 | **0.006** |
| main-thread script time (ms) | 17,420 | **8,717** | 22,061 | **10,499** |

Under the 60 Hz model the same picture holds (1440: first-3.5 s frames over 33 ms 14 to 7, scroll longest frame 1650 to 433, resize longest frame 2163 to 150, CLS 0.461 to 0.014; 2000: 28 to 11, 1621 to 433, 1109 to 150, 0.298 to 0.006). Not better and said plainly: **scroll frames over 33 ms barely move (127 to 97 at 1440, 113 to 142 at 60 Hz)**, because the tour's replay steps are the real Drishya app rendering inside the laptop (below).

## Causes found, and what was done

1. **The dotted backdrop ran on the page's main thread.** About 10,000 to 15,000 dots drawn at 12 to 30 frames a second plus the canvas commit were a 40 to 50 ms frame (at 4x) every 80 ms: most of the frames over 33 ms in the first 3.5 s and every pointer move over the hero (the hover p50 was 41 ms). The drawing moved to a worker on an `OffscreenCanvas` (`apps/site/src/dots.ts`, `dots.worker.ts`), the same code with the same grid, stagger, glow sprite and timing; where the browser has no OffscreenCanvas it draws on the page as before.
2. **The demo app booted in the middle of a scroll.** The real app inside the laptop starts with a 1.9 s task (at 4x) of layout effects; the page started it as the laptop came within 150% of the screen, so it froze the scroll into the Why section (the 2 s longest frame, and the 0.45 layout shift: the pin jumped when the stall ended). It now also starts three seconds after the intro, in an idle moment, with the old trigger kept as a fallback.
3. **A window resize reloaded the laptop's app.** ScrollTrigger's pin moves the pinned element in the page on every refresh, and moving an iframe's ancestor reloads the iframe: each resize step paid a full app boot (1.1 to 1.6 s at 4x) and blanked the laptop. The tour is now held in place by CSS `position: sticky` in a section as tall as the pin plus seven screens (`.tour` height), with the same ScrollTrigger scrub and no pin. Frames at 13 scroll positions through the tour, and at the start and end of it, match the pinned build (below). This also removed the pin jump that was the layout shift.
4. **First-load work was one long stall before the intro.** The module's layout was forced three times (once for the ScrollTrigger plugin before the logos and screens existed), the two agent screens (about 500 elements) were in the first layout, and the intro, every scroll scene and the refresh ran as one task, with the intro already running so its opening was spent inside it. Now: the plugin registers when the animated page is built, the screens mount in their own task, each scroll scene is its own task, and the intro timeline is built paused and started two frames after the page is shown. Longest first-load task 593 to 401 ms; the longest frame 542 to 183.
5. **The hero map redrew on every display refresh** (240 times a second here). Held to 60 drawn frames a second; the turn is about 20 px a second at the rim, so it looks the same.
6. **Smaller:** the page body's reveal animation used `fill-mode: both`, which kept the whole 22,000 px page one animated layer for the visit (now `backwards`, same pixels); the Compare card follows scroll once per frame; the pointer and scroll signals to the dots worker are throttled; the laptop's replay steps are paced by what the app reports a step cost (the next one waits as long again, a no-op on a fast machine).

Checked identical: pixel diff of 30 frames (hero, Why, 13 positions in the tour, 7 in Features, Compare, Install, Privacy, close) between the old and new build at 1440: Why, Features, Compare, Install, Privacy and close differ by 0.000% of pixels above a 24-level threshold; the hero and tour differ by 0.04 to 0.25% in the dot field and the map (they are random and turning), and nothing else. Full motion and reduced motion load with no console errors, nav anchors land, and a resize in the middle of the tour re-syncs the laptop without reloading it.

## Not fixed, and why

- **The tour's replay steps.** Each step is the real app rendering (`HandlePostMessage`, about 110 to 250 ms at 4x, 28 to 60 ms real), and the app's own layout effects (`measureReadingSides` and others in `apps/ui`, 1 to 3 s of `getBoundingClientRect` in a 4x profile) are most of it. That is the product's cost, not the site's; a lighter showcase render in `apps/ui` is a separate task. The pacing above keeps the scroll from starving.
- **The first layout (250 ms at 4x, 700 elements)** and the relayout when the web fonts arrive cannot be removed without delaying the whole page; moved out of the stall, not removed.
- **A visible option, not applied:** GSAP's ticker and Lenis run at the display rate (240 times a second here). `gsap.ticker.fps(60)` would cut the page's own per-frame work by three quarters on a 240 Hz display and make scrolling look like 60 fps. That is a visible trade-off, so it is Yash's call.

## The dots decision

Frames of the site with its current dots beside the clean even grid Home and the product use (12 px grid, 0.75 px dots at 11% ink, no glow): [`docs/images/site-3-dots-current-left-clean-right-hero.png`](../images/site-3-dots-current-left-clean-right-hero.png) (whole hero) and [`docs/images/site-3-dots-current-left-clean-right-2x-crop.png`](../images/site-3-dots-current-left-clean-right-2x-crop.png) (2x crop of the dot field); the other sections are in `.local/site-trace/dots/` (Why, Features, Compare, close). The clean grid is calmer and matches the product, but it is a different look, not a cleaner version of the same one: the dots shrink from a 2 px radius to 0.75 px and nearly disappear at normal size, and the twinkle and the glow that follows the pointer are gone (that is a motion change). It would also remove the dots' cost entirely. It does not read as *clearly* cleaner without losing something, so **it is not applied: the decision is Yash's, from the frames.** If he chooses it, it is a one-rule change (a CSS background on `.backdrop`, drop `dots.ts`, `dots.worker.ts` and the canvas).

## Verify

`node scripts/site-trace.ts --label x --runs 3` on a build; compare with the JSON in `.local/site-trace/` (not committed). There are no browser specs for `apps/site` (none existed to run); the checks are the site's typecheck and build, the frame comparison and the smoke checks above.
