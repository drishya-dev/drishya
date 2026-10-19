# 124 — Sacred Timeline: Git graph art direction and build spec

**19 October 2026.** Builder direction: the Git graph should feel like the *Sacred Timeline* from Loki. That means a dark space backdrop with stars; the main branch as one luminous braided river of light; other branches peel off it like lightning tendrils and merge back into it; commits are small points of light on the strands. Earlier attempts (including the current SVG ribbon, `lib/git-ribbon-geometry.ts` + `components/GitThreadGraph.tsx`) did not reach this look. This spec says why and how to build it. Topology truth from the existing Git atlas is unchanged: no decorative or invented branches.

## Reference, described

1. **The main strand (reference 1).** A wide band made of **thousands of hair-fine filaments**, each slightly independent, sweeping in one long, gentle arc.
   - Colours run across the band's width: cyan, ice-blue, violet, magenta, near-white.
   - The core is brighter where filaments overlap: additive light, not paint.
   - The edges are frayed and translucent.
   - It reads as volume because filaments cross over each other with depth, not because of a drop shadow.
2. **Branches (reference 2).** A bright white-blue core line with branches leaving at shallow angles. Each branch is a thinner bundle that **splits fractally** into finer twigs, ending in fuzzy sparkling tips. The branching is irregular, as with lightning or neurons, and stays thin and sharp, not blurry blobs.
3. **Backdrop.** Deep navy-black space, sparse stars at two or three depths, optionally a faint nebula wash at very low contrast. The graph is the only bright thing.

## Why the current attempt reads flat

- It draws **filled SVG bands** (a ribbon surface plus a few `ribbon-lamina` stripes). Filled shapes produce flat colour and hard edges: the "DNA strip" look.
- There is **no additive blending and no bloom**. Light should accumulate where strands overlap; SVG paint just covers.
- There are **too few elements**. The look needs hundreds of 0.5–1 px filaments at low alpha; a handful of thick stripes can't produce it.
- **Branches are the same ribbon shape**, scaled down, rather than tapering, fraying bundles that split at the tip.

## Rendering approach

**Layering (back to front):**

| Layer | Technique | Redraw when |
|---|---|---|
| Star field (2–3 parallax depths) + optional nebula | Canvas 2D or WebGL, deterministic seed from the repository path | Resize; slight parallax on pan |
| Filament light | **WebGL** (or Canvas 2D with `globalCompositeOperation='lighter'` as fallback), additive blend, to an offscreen buffer | Pan/zoom/data change only; cached otherwise |
| Bloom | Downsample the light buffer 2–3 times, blur each, composite additively over the sharp buffer | With the light layer |
| Commit points | Small bright cores drawn in the light pass, with a sharp centre and a soft halo | With the light layer |
| **Interaction and text** | **DOM**: one transparent `<button>` per visible commit (existing `.thread-commit`), labels, refs, peek card | Normal React |

Text is never drawn in WebGL ([AGENTS](../../AGENTS.md) constraint 8). The existing DOM commit buttons, keyboard navigation and peek card stay, and only the drawing layer changes.

**Filaments.** Each Git edge (parent → child) becomes a bundle:

- **Main line** (first-parent chain of the primary ref): 300–600 filaments, bundle width ≈ 28–40 px at fit.
- **Branch bundles:** 30–120 filaments, width scaled by the branch's commit count, capped at half the main width (existing rule).
- **Each filament** is a polyline along the edge's centre curve, offset across the width by `w · (u + n₁(t))`:
  - `u` is the filament's fixed lane in [−½, ½] with a slight bias toward the centre, so the core is denser;
  - `n₁` is low-frequency 1D noise along the edge (a different seed per filament), so filaments braid and cross;
  - a small second noise term gives fibre "hair".
- **Colour.** Sample the spectral gradient by lane `u`, plus a slow drift along length `t`. Alpha 0.04–0.12 and width 0.6–1.2 px. Accumulation creates the white-hot core naturally.
- **Depth.** A gentle `z(t)` twist; filaments with `z>0` draw slightly brighter and later. This gives the crossing-over volume without real 3D.

**Branch peel and merge.**

- **Fork:** at the parent commit, the branch's filaments start *inside* the main bundle's outer rim (lane |u| ≈ 0.4–0.5), then leave on a smooth curve. Visually the branch **peels off the rim**, as the builder previously asked.
- **Merge:** the filaments fade back into the rim lanes over ≈ 40–80 px around the merge commit.
- **Unmerged tips:** the bundle **splits** into 2–4 child bundles with fewer filaments each, recursively 2–3 levels (thinner, shorter, more angular), ending in bright sparkle points. This is the lightning look.
  - The splitting is decoration on the *tip only*. It must not imply extra branches: tips are visually distinct (fading, sparkly), and the real branch head is the brightest commit point with its ref label.

**Layout (truth first).**

- **x** = topological/time order (existing `git-thread-layout.ts`); **y** = lane. The primary line follows one broad arc across the visible window; no repeating wiggle.
- Branch lanes alternate above and below the main strand by fork order, and spread so bundles never cross commit points.
- Commits are points **on** their strand's core. Merge commits sit where the merge filaments rejoin.

**Motion (optional, interruptible).**

- Default: **static** freeze-frame. Every paused frame must read well (the *freeze* test).
- Optional gentle "flow": the noise phase advances along `t` at ≤15 fps, cached tiles re-composited.
  - Off for reduced motion, low-resource mode and hidden tabs.
  - Stops on any pointer interaction and resumes 12 s after the last one (same rule as the map).
- Hover/select a commit: its strand brightens (alpha ×1.6) and others dim (×0.5) over 160 ms; the peek card appears with its DOM content. No looping pulses.

## Performance budget

- **Filament count** scales with zoom and with the number of visible edges. Hard cap ≈ 40k segments per frame; low-resource mode caps at 8k and turns off bloom.
- **Cache** the light buffer per (zoom bucket, viewport tile). Panning re-composites cached tiles, and only newly exposed tiles render.
- **Paging is unchanged:** 50-commit / 100-ref pages from the existing atlas; older history loads on scroll as today.
- **WebGL fallback:** Canvas 2D `lighter` with half the filaments and a cheap single-pass blur. No WebGL and no Canvas means the existing row list still works.

## Information that must not be lost (from review 122)

The art alone is not a Git graph. Under or beside the timeline, keep a **compact commit row list** synchronised with the canvas: message · author · relative time · refs. Hover in either highlights both. Commits created during a captured session carry a small session mark that links to the turn (GIT-2 in TASKS). By default the branch list filters to refs with commits in the loaded window, with an "All refs" toggle; 183 truncated names is not navigation.

## Acceptance

- [ ] Side-by-side with the references, a viewer describes it as "Loki timeline", not "chart". Get builder sign-off on screenshots first.
- [ ] Fork/merge positions exactly match parent topology on: a linear repo, a repo with 3+ merged feature branches, an unmerged branch, an octopus merge, a shallow clone, and detached HEAD.
- [ ] 60 fps pan/zoom on the reference machine with 500 loaded commits; low-resource mode ≥ 30 fps; idle CPU ≈ 0 with flow off.
- [ ] Keyboard: arrows move between commits, Enter opens changed files, Escape closes; focus ring visible over the light.
- [ ] Reduced motion: static; forced colours: DOM row list remains fully usable.
- [ ] No text in canvas. Commit labels, refs and peek are DOM.

## Build order

1. **Prototype in isolation.** Write a standalone page with synthetic topology (main plus 4 branches, 2 merged), WebGL filaments, additive blend and bloom. Use the `prototype` skill to compare 3 variants (filament density, colour lane mapping, tip splitting), then get builder sign-off.
2. Swap the drawing layer inside `GitThreadGraph`, keeping DOM buttons, peek, paging and keyboard behaviour.
3. Add the synchronised compact row list and ref filtering.
4. Add session ↔ commit marks (GIT-2).
5. Optional flow motion, with all guards.
