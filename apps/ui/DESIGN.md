# Drishya canvas design

## Active observation canvas — 15 October

The pasted rebuild brief is the current authority for the default Canvas
presentation (`?experience=canvas`). `src/canvas.css` is its scoped visual layer,
loaded after the retained Classic foundation below. This presentation observes
captured work: its bottom field searches evidence and never submits an agent
prompt. Native controller interfaces remain in the explicitly retained versions.

| Role | Dark | Light |
|---|---|---|
| Canvas | `#18181B` | `#F4F4F5` |
| Material | `#222226` | `#FFFFFF` |
| Raised | `#27272C` | `#F4F4F5` |
| Border | `#313136` | `#E4E4E7` |
| Text | `#F2F2F3` | `#18181B` |
| Selection / read | `#5AA9FF` | `#2566B4` |
| Edit | `#F4E04D` | `#8C7200` |
| Failure | `#E35FD2` | `#A62D96` |
| Pass | `#7BE0A6` | `#197849` |

Use locally bundled Outfit WOFF2 for interface text and JetBrains Mono WOFF2 for
code. Both licenses ship beside the fonts. The 56 px header and icon rail frame a
static 22 px dot field. The activity panel is 284 px; the selected reader is
380 px. Rounded 292 px action materials connect in recorded order, with captured
helper relationships branching to the helper's lane. Prose remains unboxed.
The floating bottom bar searches stored evidence and supplies failure/edit jumps
and a bounded timeline. Appearance offers Dark, Light and live System preference.

Pan/zoom uses one DOM world transform; characters stay selectable DOM text.
New nodes arrive over 260 ms, connections over 320 ms, measured file-icon lifts
over 500 ms, and occasional reader entry over 220 ms. Captured content mounts
without a choreography delay. Deliberate camera movement/selection detaches
following; capture and explicit replay continue independently. All finite motion
is disabled by Motion off, reduced motion or low resource mode.

Mount at most 96 action nodes (32 in low resource mode), 28 nearby passage/prose
groups, 240 order connectors, 80 timeline marks and 100 repository file labels
(40 in low resource mode). Keep the existing paged history and artifact cache.
File readers request bounded source/diff pages; large recordings use worker-owned
history windows. See [review 72](../../docs/PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#72-observation-canvas).

## Retained Classic foundation — 14 October

14 October 2026. The builder requested a full local redesign and supplied six
PicGen dashboard screenshots as the primary visual reference. This document
describes the integrated application, not a marketing site or another renderer.

## Atmosphere

A quiet, practical studio for inspecting a coding agent's work. The repository
remains a world behind the evidence. Source, patches, terminal output, matches
and test outcomes have their own content-shaped surfaces. Agent prose stays
unboxed. Utility controls have less visual weight than the captured work.

The references contribute a static dot field, restrained charcoal materials,
thin connections, compact controls and Outfit typography. Reference screenshots
are design inputs; their images, invented data and generation controls are not
included in the product.

## Type

- Outfit variable, locally served under `public/fonts`, for interface and prose.
  The bundled SIL Open Font License permits distribution. No runtime font request
  leaves the machine.
- The existing monospace stack for actual code, commands and paths.
- Home heading: 30–46 px, weight 500, tracking −0.055 em.
- Workspace title: 14 px, weight 450; readable session/agent metadata: 11–12 px.
- Prose and captured prompts: 15 px, line-height 1.85; 14 px prose on phones.
- Source previews: 12 px, line-height 1.75; expanded source: 13 px, line-height 1.8.
- Session rows: 14 px titles, 12 px secondary metadata. Long titles wrap.

## Palette

| Role | Jet Black | Midnight | Paper |
|---|---|---|---|
| World | `#0d0d0d` | `#11141a` | `#f4f3f0` |
| Material | `#1c1c1c` | `#1c212a` | `#fdfcf9` |
| Control | `#252525` | `#272e39` | `#eeede8` |
| Primary text | `#f0f0ee` | `#edf0f4` | `#242522` |
| Secondary text | `#c1c1bd` | `#bec5ce` | `#52554e` |
| Supporting text | `#9b9b97` | `#99a5b5` | `#686c63` |
| Focus | `#a6ddb8` | `#afc5e1` | `#39744e` |
| Read/source | `#89bdf0` | `#91bfe8` | `#336987` |
| Edit | `#e6c17d` | `#e3c593` | `#886328` |
| Pass | `#90dca7` | `#9cd2b7` | `#3c784d` |
| Fail | `#ef9694` | `#eca0a8` | `#aa4946` |

Neutral one-pixel material edges; colour stays semantic. The dot field repeats
every 22 px and is static. Low-resource mode removes it. Materials have no rest
shadow; floating dialogs retain a bounded shadow. Headers use a solid ground.

## Composition

- Home is a session library: compact introduction, real inventory counts, search
  and filters, then workspace/date groups. Rows replace repeated session cards.
  Discovery, loading, failure, refresh, import and empty states remain functional.
- The workspace title is centered between the brand and utilities. Multiple
  recorded agents have compact named shortcuts. A single agent uses the session
  identity without a redundant badge. The station retains captured agent-family
  disclosures.
- Floating materials occupy the center; repository files live left and observed
  tools live right. Preserve the content-based allocation and history window.
- Source and results use 12 px corners, 12–14 px interior spacing and 24 px gutters
  between materials. Prose separates passages with 40 px spacing.
- The review station uses compact shared surfaces and flat tool rows. Observed
  identities and MCP names stay readable. Connected runtime inventory has its
  own scope.
- The native composer retains the exact target, workspace consent, idle-client
  acknowledgement, attachment lifecycle and supported approval actions.
- At 820 px the rails become explicit drawers. At 600 px the title and roster
  move below the toolbar. The library collapses to one column. Utilities remain
  keyboard accessible and all reading controls retain their names.

## Motion and interaction

Use the existing measured Lift/Emit/Settle/Surface/Resolve systems. Whole captured
materials remain the only material that moves; source characters are never
copied, typed or hidden to create spectacle. The named header shortcut supplies
the actual visible origin for multi-agent prose.

Pointer controls use 160 ms colour feedback and a one-pixel press response with
`cubic-bezier(.16,1,.3,1)`. Respect motion-off, reduced-motion and low-resource
preferences. No new motion library, permanent `will-change`, continuous decorative
animation or scroll takeover.

Explicit prompt/action navigation measures fixed controls and places its target
in the readable area below them. Detached anchors, recording history and the
independent replay clock retain their existing behavior.

## Applying the requested skills

| Skill | Contribution |
|---|---|
| redesign-existing-projects | Audit first; retain the working React/evidence architecture |
| gpt-taste | Deliberate type hierarchy, varied material shapes, precise interaction timing |
| high-end-visual-design | Optical alignment, coherent spacing, restrained utility hierarchy |
| minimalist-ui | Flat materials, neutral palette, clear rows and readable supporting text |
| industrial-brutalist-ui | Utilitarian structure and semantic colours without decorative telemetry |
| image-to-code | Generated full-screen references followed by the supplied PicGen references |
| stitch-design-taste | Explicit design-system roles in this document |
| full-output-enforcement | Complete integrated components and states, no substitute mockup |
| design-taste-frontend | Read and evaluated; its landing-page workflow explicitly excludes app screens |

The builder's request for a minimal working product and supplied references take
precedence over incompatible marketing heroes, random layouts, photography,
nested glass shells, infinite loops and typography reveals.

## Maintenance

`src/atelier.css`, imported last by `src/classic-entry.tsx`, is the active Classic visual layer. The independent Fresh entry keeps its own styles. Existing styles
continue to provide the tested renderer/reader geometry and retained alternate
experiences. Add future visual amendments here instead of extending older palette
layers. Captured/current/generated provenance and evidence boundaries stay in
their existing components and contracts.
