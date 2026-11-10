# Drishya Landing Motion Implementation Plan

> **For agentic workers:** Use `executing-plans` to implement this plan task by task. Harsh explicitly requested immediate implementation in separate PRs; continue through the plan without another approval checkpoint.

**Goal:** An original dimensional Drishya landing page with scroll-linked identity, an evidence-led walkthrough and crafted finite interactions.

**Architecture:** Keep the static generator and existing synthetic chapters. Add deterministic 3D-to-SVG geometry, a small event-driven browser motion controller and a separate stylesheet. LAND-6 integrates scroll selection through the walkthrough's existing render owner, never through a second text renderer.

**Tech stack:** Node 24, TypeScript, Vite, DOM/SVG/CSS, existing Playwright/Vitest tooling; no new runtime dependency.

**Spec:** [Reference findings and design contract](../../review/land-4-reference-motion.md).

## Global constraints

- Pure black `#000000`; existing Inter/JetBrains, mint accent and paper privacy fields.
- Desktop minimum 600 px; motion pinning only at least 1000×700.
- No copied reference media/code, remote runtime resources, text splitting, capture/schema/native changes, endless animation or blurred captured content.
- Static first: no-JS, reduced motion, `?motion=0`, save-data and hidden pages remain usable.
- Every PR owns one TASKS item. Draft after first implementation commit, ready after that whole item's acceptance; Yash reviews. Do not merge or publish.

## Review focus

1. Very short/half-width windows must not strand controls inside a pinned scene: desktop size tests.
2. Fast reverse scrolling must compute absolute state, not accumulate transforms: progress/geometry tests and browser reversal.
3. A click, keyboard change or playback must not be stolen by scroll: LAND-6 ownership test.
4. Missing metadata must not remove navigation or static material: existing regression plus new story fallback.
5. Changing motion preference or hiding the page mid-transition must cancel active motion: both browser specs.

## Task 1 — LAND-4: evidence and plan PR

Files: this plan, `docs/review/land-4-reference-motion.md`, TASKS/STATUS.

- [x] Inspect reference in browser and public source; separate observation, implementation evidence and unknowns.
- [x] Specify original artwork, motion ranges, controller ownership, fallback and acceptance.
- [ ] Check task synchronization and links, finish LAND-4 docs and open its own PR.

## Task 2 — LAND-5: dimensional identity hero

Files: create `apps/landing/src/identity-geometry.ts`, `identity.ts`, `landing-motion.ts`, `landing-motion.css`; modify `site.ts`, `scripts/build-landing.ts`; add `tests/landing-motion.test.ts`, `tests/browser/landing-motion.spec.ts`; TASKS/STATUS. At most 10 files.

Interfaces: `identityFaces(turn: number): Face[]` returns finite projected points and depth-sorted shading; `trackProgress(top: number, height: number, viewport: number): number` returns [0,1]; `identityHTML(): string` emits original static artwork; `initLandingMotion(): void` enhances the current home only. LAND-6 consumes these motion preferences and augments the existing `enhanceSample` owner.

- [ ] Write `node:test` checks first: finite geometry at turns -1/0/1, stable face count, clamped progress including zero scroll range. Run with `node --test tests/landing-motion.test.ts`, observe failure before implementation.
- [ ] Implement geometry and static hero markup. Keep source material level; copy all landing source modules into the generated source directory.
- [ ] Implement one-RAF-per-invalidation scroll controller, static media/preferences/lifecycle fallbacks and styles. No active idle animation.
- [ ] Browser spec: headline/CTA, black ground, no overflow at 600/1024/1440/1920, ring/graph reversal at 1440, short-window fallback, live preference changes, no-JS and motion=0. Confirm failure before code, then passing results.
- [ ] Build, run both landing specs, inspect hero/end-of-track screenshots in the real browser. Record evidence and create a separate ready PR with no application files.

## Task 3 — LAND-6: scroll story and finishing

Files: `site.ts`, `landing-motion.ts`, `landing-motion.css`, `scripts/build-landing.ts`, `tests/browser/landing-motion.spec.ts`; TASKS/STATUS. At most 7 files. Branch from LAND-5 and target that branch so the PR contains only this task.

Interfaces: reuse existing chapter `render(index, reason, updateURL)` and `pause()`; add reason `scroll` without changing recorded chapter material, labels or bookmark resolution. Add explicit owner state and a “Follow scroll” button. Scroll progress never changes the URL.

- [ ] Add failing ownership/reversal tests: scrolling selects a chapter; deliberate selection retains control until Follow scroll; reduced/short view stays manual; metadata failure retains complete walkthrough.
- [ ] Add semantic chapter stops, sticky material and connector progress. Derive scroll selection from stop position, not time or sequence playback. Keep controls reachable without animation.
- [ ] Add finite whole-row arrivals and small arrow/brand interactions, cancel on focus/preference/visibility. No character animation or text clones.
- [ ] Run geometry tests and both landing browser specs, build and inspect 600/1440 story/closing states plus keyboard and reduced-motion behavior.
- [ ] Complete task docs and separate stacked PR. One final fresh-context review of the implementation range; fix actionable findings and rerun affected checks. Keep all PRs unmerged for Yash.

## Execution record

Record commits, actual commands/results and material deviations in the task completion entries in STATUS and the ignored plan ledger. This plan explains execution order; TASKS remains the sole active queue. A full product gate is inappropriate for this isolated public landing change; the relevant browser suite and static artifact build are the completion gate.
