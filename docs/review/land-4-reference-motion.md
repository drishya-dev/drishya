# LAND-4 — reference motion investigation and Drishya specification

Requested by Harsh, 8 November 2026. Reference: [live Superconscious site](https://superconscious-app.webflow.io/) and [Outcrowd presentation](https://dribbble.com/shots/27239697-Superconscious-AI-Powered-Self-Growth-App). This is a reconstruction of interaction patterns with original Drishya artwork, not a port of the reference's code, branding or media.

## Evidence and limits

Applied the [REA reverse-engineer-anything instructions](https://github.com/morluto/rea/tree/main/.agents/skills/reverse-engineer-anything), installed under ignored `.local/skills/`. No REA MCP is registered in this session; no REA engine execution is claimed. Used the supported browser for visible scrolling and read the publicly served HTML/inline scripts. The saved reference and inspection snippets stay under `.local/landing-reference/`; no reference assets ship. HTML SHA-256: `97748aba34bd2a1cdf505e956d0ff4e8628d3c85866f6acf29bd1e1b654228ef`.

| Observed behavior | Supporting public source | Original Drishya interpretation |
|---|---|---|
| Large introductory wordmark; later a floating compact navigation | Preloader handling and visible navigation | Headline and CTA available immediately; compact navigation retains real links |
| Rings separate and resolve into a central mark during scrolling | Visually checked at successive scroll positions; exact ring controller not isolated | A faceted aperture, derived from Drishya's own mark, turns and reveals a repository constellation |
| Pinned typography moves laterally and upward through depth/blur | `initAboutAnimation`: pinned container; scrubbed lateral/upward transforms | Short pinned hero on larger desktop windows; level, readable DOM evidence beside the dimensional object |
| Sections/lines arrive when entering the viewport | `data-split` presets and one-time ScrollTrigger entry | Whole-section finite arrivals, no character splitting or duplicated text |
| Animated link labels and inertia hover movement | `text-hover-trigger`, `data-hover-button`, `data-hw-trigger` handlers | One real label; small arrow/mark translation on hover, immediate keyboard actions |
| Volumetric hero and layered app presentation | Hero WebP fallback and MP4 source URLs occur in the served HTML | Original procedural projected 3D mesh; no video download or external runtime dependency |

The source loads GSAP, SplitText, ScrollTrigger and InertiaPlugin. This establishes available libraries and the cited inline behavior, not that every plugin executes. MP4 references do not establish that the entire scene is a real-time WebGL model. Timing, implementation and asset ownership outside the inspected snippets remain unknown.

## Design contract

On this page, **Drishya's faceted aperture becomes a way into the user's repository**, then the evidence explains what the agent did. Keep pure-black ground, Inter/JetBrains typography, mint semantic accents and existing paper privacy sections. No stars, purple glow, looping particles, waiting screen, character effects or blurred captured material.

### LAND-5: hero, identity and navigation

- Preserve the immediately visible “See what your agent did.” headline, supporting sentence and demo/setup actions. The fixed synthetic source remains visible in a level DOM frame.
- Render an original polygonal aperture from deterministic three-dimensional torus geometry, with a hexagonal silhouette and neutral/mint lit facets. Project sorted faces to SVG; SVG contains decorative geometry only. No new dependency, image/video request or continuously running animation loop.
- At widths at least 1000 px and heights at least 700 px, a 170 svh hero track owns one sticky viewport. Progress is clamped from the track's visible scroll range. The aperture rotates at most 55 degrees, scales to 0.78 and moves upward at most 40 px while repository nodes/edges resolve behind the evidence. Reverse scroll reverses the same state. Copy never becomes unreadable.
- Below that range use normal document flow and a composed static object. All reduced-motion, `?motion=0`, hidden-tab and save-data cases use the finished static composition. Page lifecycle/preference changes cancel pending frames; resize measures again. Request one animation frame per scroll invalidation, never self-schedule an idle frame.
- Compact desktop navigation gets a solid black floating composition and hairline boundary; links, focus, menu dismissal and skip behavior remain native. The header mark makes a bounded rotation tied to the same scroll relationship, with a static preference fallback.

### LAND-6: evidence story and polish

- On wide/tall desktops, make the existing four-moment walkthrough a bounded scroll story: the reading stage stays sticky while four chapter stops pass. Each stop selects the exact existing synthetic read/failure/edit/retest and retains its provenance and replay bookmark. Show the selected chapter through a line/number and one real material surface.
- Clicking a chapter, using the range/keyboard, playing the finite sample, or restoring browser state takes explicit ownership. Scroll must not overwrite that choice. An explicit “Follow scroll” action returns control to scrolling. Explicit sample playback keeps its existing clock and interruption rules; scroll does not invent an agent's causal reasoning.
- No metadata/no script: the complete static walkthrough and replay links work. Reduced motion and shorter/narrower windows use the existing manual walkthrough and normal flow; no scroll coupling.
- Whole editorial rows and the closing composition may arrive once with at most 18 px translation over 420 ms. Content is mounted/selectable and opaque; focus cancels an active arrival. Hidden tabs, reduced motion and `?motion=0` finish/cancel effects. No permanent `will-change` or rest-time animation.
- Buttons move only the existing arrow by 3 px over 160 ms; press feedback 0.98 scale. No pointer-attracting hit targets, cloned labels, infinite rotation or synthetic data changes.

## Scope and acceptance

Landing routes only. Existing public replay isolation, source text and consent boundaries stay intact. Supported desktop checks: 600, 1024, 1440 and 1920 px, plus a short 1440×600 window. Test deterministic geometry/progress, reverse scroll, explicit ownership, reduced-motion changes, hidden tabs, keyboard, no JavaScript, blocked metadata, page return and exact replay links. Run the existing landing browser spec and new motion spec, build the static artifact and inspect real-browser screenshots. Public synthetic content is intentional here; this does not claim genuine-session acceptance or product release certification.

PR #371 owns the original jet-black token change. Implementation adds a separate landing-motion stylesheet and does not edit its claimed `site.css`; the new composition also explicitly uses the same black ground. LAND-4 is documentation; LAND-5 and LAND-6 are separately claimed whole tasks. No merge or publication in this request.
