# Full-page marketing pass design

## Intent

Make the marketing page read as one replay of an agent session: the hero states the promise, each section advances the story, and every claim is paired with captured product evidence.

## Goals

- Give the first screen a concise product proposition and one clear primary action.
- Make the fixed map/dot backdrop quiet outside the hero and tour.
- Add a lightweight chapter/progress rail that follows the existing sections.
- Reframe the why, features, comparison, install, privacy, and closing sections around evidence and outcomes.
- Preserve the existing laptop tour, real screenshots, accessibility semantics, reduced-motion path, and desktop-only scope.
- Keep this as an uncommitted preview until the builder approves the result.

## Non-goals and anti-goals

- No fabricated customer quotes, metrics, integrations, or product capabilities.
- No new dependencies, backend work, or changes to the event schema.
- No additional decorative particle systems, generic feature-card grids, or extra 3D effects.
- No changes to the existing reload-fix PR branch.

## Approach

Use the existing HTML sections and GSAP/Lenis scroll choreography. Add a small semantic chapter rail, concise copy, contextual backdrop states, and evidence-shaped layouts in `index.html`, `main.ts`, and `site.css`. Reuse the existing real footage and replay data; the compare panel remains the only expanded overlay. Keep every new interaction optional and provide a static/reduced-motion composition.

## Success criteria

- The hero explains Drishya without a paragraph wall and has one obvious action.
- Scrolling shows a visible but restrained section position and coherent chapter transitions.
- The privacy and install sections communicate process/result visually, not only as text columns.
- The feature and comparison sections feel like one evidence viewer rather than repeated cards.
- The page remains readable on the supported desktop widths, survives reload, and builds with the existing site command.
