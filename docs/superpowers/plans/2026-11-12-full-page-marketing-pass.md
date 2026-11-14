# Full-page marketing pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Drishya marketing page feel like one evidence-backed replay story from hero to footer.

**Architecture:** Preserve the existing static HTML and GSAP/Lenis runtime. Add a small chapter rail and state hooks in the page markup, drive active chapter/contextual backdrop state from the existing scroll position, and restyle the existing sections into larger evidence-shaped compositions without adding dependencies.

**Tech Stack:** HTML, TypeScript, CSS, GSAP, Lenis, existing real screenshot footage.

**Spec:** `docs/superpowers/specs/2026-11-12-full-page-marketing-pass-design.md`

## Global Constraints

- Desktop-only supported range; do not design for phone widths or touch input.
- Visualization is the main; use captured screenshots and replay material instead of invented proof.
- Motion is transform/opacity based, interruptible, and disabled or reduced for `prefers-reduced-motion`.
- Preserve the reload first-paint guard and existing laptop tour behavior.
- Do not add dependencies or modify capture/storage/event-schema code.
- Do not commit or push this exploratory preview until the builder approves it.

## Review Focus

- Reload from a hash and repeated reloads: dark first paint, no raw HTML flash, and chapter state recovers.
- Scroll through each chapter: only the current chapter is emphasized and the backdrop does not overpower content.
- Keyboard navigation: chapter links and compare rows retain visible focus and correct labels.
- Reduced motion: content is visible in a useful static arrangement without relying on GSAP.
- Existing evidence: screenshots, command text, privacy claims, and compare evidence remain truthful and selectable.

---

### Task 1: Hero promise and chapter navigation

**Files:**
- Modify: `apps/site/index.html`
- Modify: `apps/site/src/site.css`

- [ ] Add one concise hero proposition and a single primary action while keeping the logo dominant.
- [ ] Add a semantic chapter rail for Why, Tour, Features, Compare, Install, Privacy, and Open source.
- [ ] Style the rail as quiet text/markers with an active state, not a floating control panel.
- [ ] Add focus and reduced-motion styles.
- [ ] Run the site build and inspect the hero at the live desktop viewport.

### Task 2: Contextual backdrop and why narrative

**Files:**
- Modify: `apps/site/index.html`
- Modify: `apps/site/src/main.ts`
- Modify: `apps/site/src/site.css`

- [ ] Add section context hooks to the existing backdrop and update them from one IntersectionObserver.
- [ ] Quiet the map/dots outside the hero/tour while keeping the dark surface intact.
- [ ] Recompose the why section around a three-beat claim and captured stream, preserving real sample output.
- [ ] Run the build and verify the section remains readable while scrolling.

### Task 3: Evidence-led tour and feature grouping

**Files:**
- Modify: `apps/site/index.html`
- Modify: `apps/site/src/site.css`

- [ ] Add a compact tour progress cue tied to the existing tour steps.
- [ ] Group the feature chapters visually into five outcome lenses without deleting the underlying real screenshots.
- [ ] Add stronger selected/hover/focus treatment for the single feature viewer.
- [ ] Verify the laptop remains the dominant visual and the existing scroll choreography still works.

### Task 4: Compare, install, privacy, and closing pass

**Files:**
- Modify: `apps/site/index.html`
- Modify: `apps/site/src/main.ts`
- Modify: `apps/site/src/site.css`

- [ ] Add evidence metadata and a clearer selected-row treatment to the comparison section.
- [ ] Reframe install as command/result with copy feedback intact.
- [ ] Replace the privacy columns with a read-only/redaction/local-store/replay pipeline.
- [ ] Strengthen the closing CTA around the real repository and install action.
- [ ] Verify links, copy behavior, focus states, and no fabricated claims.

### Task 5: Verification and preview handoff

**Files:**
- Test: `apps/site` build and live browser preview

- [ ] Run `git diff --check`.
- [ ] Run `corepack pnpm --filter drishya-site build`.
- [ ] Reload repeatedly at the hero and a deep hash; verify no white/raw-HTML flash.
- [ ] Scroll the full desktop page and verify chapter rail, evidence viewer, install copy, privacy pipeline, and footer.
- [ ] Leave all changes uncommitted and report the preview branch and review notes.
