# MAP-3 · Lit files on the map (Brainstorm & Architecture Options)

**Status:** Brainstorm / Spec review (No product code)  
**Author:** Antigravity (Lane 2)  
**Date:** 13 November 2026  
**Context:** Yash, 12 Nov (reference [Personal Memory graph](https://dribbble.com/shots/27852226-Personal-Memory-graph-for-agentic-AI)): *"not the exact thing from the graph, just the concept of movement and pulling up the file type thing somewhere, or in background ... can make it look premium but only if the placement is looked properly ... without costing too much compute."*  
**Scope rule (Yash, 13 Nov):** *"map 3 is just if possible thing, if it can be done then keep it ... we have to see how we can do those graph animations to look more premium while also not getting too compute heavy. It does not block the release; if it cannot be made to look right at no idle cost, it moves to the first release after."*

---

## 1. Core Idea & Non-Negotiables

From the Dribbble inspiration, the key visual sensation is:
- A dark, calm spatial constellation of quiet background nodes (the repository graph).
- Active files touched by the agent glow softly in their semantic action colour:
  - **Read:** Azure / Cyan (`var(--syntax-constant)`, e.g. `#38bdf8`)
  - **Edit:** Emerald / Green (`var(--pass)`, e.g. `#34d399`)
  - **Fail / Error:** Coral / Red (`var(--fail)`, e.g. `#f87171`)
- A floating chip identifies the active file (`[Icon] filename.ts`), easing smoothly as focus moves.
- When an operation concludes or falls out of the recent working set (last 3 active files), the chip gently dissolves and the node returns to faint background rest.

### Non-negotiable Constraints (AGENTS.md & SHIP-8):
1. **Zero idle compute at rest:** No continuous `requestAnimationFrame` loop when the agent is idle or reading. The GPU draws the points/edges; the DOM draws characters.
2. **Text is never obscured (Placement Rule):** Chips must NEVER render over reading prose, the history column, the prompt rail, the composer, or the toolbox. If there is no unobstructed margin, the chip is suppressed.
3. **Respect low-resource & accessibility modes:** Under `prefers-reduced-motion: reduce`, low-resource mode, or hidden tabs, any gentle camera ease or ambient pulse is completely disabled.

---

## 2. Direction A: Spatial Halo & Free-Gutter DOM Chips (Direct Point Anchor)

### Concept
The 3D map canvas highlights recent file vertices with an ambient radial glow shader pass. A compact DOM chip is positioned directly at the projected 2D coordinates `(screenX, screenY)` of the node, offset into the nearest free space.

```
       ┌────────────────────────────────────────────────────────┐
       │ Workspace Header                                       │
       ├──────────────┬─────────────────────────┬───────────────┤
       │ [Map Node]   │                         │               │
       │     ● ✨     │                         │               │
       │   ┌────────┐ │    HISTORY / PROSE      │               │
       │   │📄 guard│ │                         │               │
       │   └────────┘ │   "I verified the auth  │   TOOLBOX     │
       │              │    guard in guard.ts"   │   (Native /   │
       │              │                         │    MCP tools) │
       │              │   [Diff / Output Card]  │               │
       │              │                         │               │
       │              │                         │               │
       ├──────────────┴─────────────────────────┴───────────────┤
       │ Transport / Prompt Composer                            │
       └────────────────────────────────────────────────────────┘
```

### Visual Anatomy of the Chip
```
┌─────────────────────────────────┐
│ [● Read] [TS] src/guard.ts  42L │
└─────────────────────────────────┘
```
- **Height:** 24 px; **Padding:** 4 px 8 px; **Border:** `1px solid var(--hairline)`.
- **Background:** Subtle translucent graphite (`rgba(18, 18, 20, 0.72)`) with `backdrop-filter: blur(8px)`.
- **Typography:** 11 px Jet Mono, truncated path.

### Collision & Placement Logic
Integrated directly into `placeLabels` (`apps/ui/src/lib/map-labels.ts`):
- Obstacles: The central reading column (`.history-inner`), prompt rail (`.prompt-rail`), toolbox (`.modern-toolbox`), and workspace header (`.workspace-header`).
- If projected node `screenX` falls inside the reading column + 48 px padding, the chip is nudged into the left or right gutter. If neither gutter has >= 160 px free width, the chip is hidden (only the glowing dot on canvas remains).

### Motion & Lifecycle
- **Arrival (Lift & Glow):** On step arrival, canvas point glows via a 200 ms linear interpolation. The DOM chip fades in (`opacity: 0 -> 1`, `transform: translateY(3px) -> translateY(0)` over 160 ms `cubic-bezier(0.16, 1, 0.3, 1)`).
- **Idle State:** Completely static. Zero JS execution per frame.
- **Departure:** When superseded (beyond 3 recent steps), the chip fades out over 200 ms (`opacity: 1 -> 0`) and unmounts.

### Idle Cost & Budget
- **Idle CPU/GPU:** **0.00 ms / frame.**
- **During map rotation (if enabled):** Synchronously updated inside the existing spatial render tick (`translate3d(x, y, 0)`), costing `< 0.03 ms` per frame for up to 3 DOM elements.

---

## 3. Direction B: Constellation Filament with Lateral Rail Tethers (Constellation Trail)

### Concept
Rather than floating detached chips, the agent's recent operations form a luminous "constellation trail" across the repository map. A thin, glowing spline connects the last 3 files in traversal order (e.g. `auth.ts` -> `guard.ts` -> `session.ts`). From each active node, a hairline leader line connects to a structured "Active File Chip" docked in the quiet margins flanking the central stage.

```
       ┌────────────────────────────────────────────────────────┐
       │ Workspace Header                                       │
       ├──────────────┬─────────────────────────┬───────────────┤
       │   ● (Node 1) │                         │               │
       │    \         │                         │               │
       │     \        │                         │               │
       │      ● (Node)│    HISTORY / PROSE      │               │
       │       \      │                         │               │
       │  ──────●     │                         │   TOOLBOX     │
       │  │           │   "Running tests..."    │               │
       │ ┌┴─────────┐ │                         │               │
       │ │ [TS] auth│ │   [Test Bar: 42 passed] │               │
       │ │ [TS] guar│ │                         │               │
       │ └──────────┘ │                         │               │
       ├──────────────┴─────────────────────────┴───────────────┤
       │ Transport / Prompt Composer                            │
       └────────────────────────────────────────────────────────┘
```

### Visual Mechanics
- **Canvas Spline:** 1 px anti-aliased gradient line between active nodes (`opacity: 0.4`), rendered in the map canvas pass with no separate layers.
- **Docked Stack:** Up to 3 chips neatly stacked vertically in the left gutter (or right gutter on narrow viewports).
- **Hairline Tether:** An SVG line (`stroke: var(--hairline)`) drawn from the stack item to the projected node coordinate, fading out before touching reading text.

### Placement & Collision Safety
- Because the chips are docked in the dedicated peripheral margin, **collision with reading text is mathematically 0%**.
- If viewport width is < 1024 px, leader lines and tethered stacks collapse into a single badge above the history gutter.

### Idle Cost & Budget
- **Idle CPU/GPU:** **0.00 ms / frame.** The filament is static geometry uploaded once to the WebGL buffer on step change.
- **Transition Cost:** 1 static draw call update on agent step arrival (~0.12 ms once per turn).

---

## 4. Direction C: Peripheral HUD Echo with Directional Ray Vectors (Peripheral Projection)

### Concept
Designed specifically for maximal reading tranquility and low-compute hardware (e.g. MacBook Air or laptops on battery).
The map canvas points brighten when touched by the agent, but no DOM chips float in 3D space. Instead, a slim, minimalist "Active File Echo" badge is placed on the edge of the reading card or in the secondary toolbar, with a subtle directional arrow/vector pointing toward the off-center position of the file in the 3D repository constellation.

```
       ┌────────────────────────────────────────────────────────┐
       │ Workspace Header                                       │
       ├────────────────────────────────────────────────────────┤
       │  [3D Map Behind: Quiet Background Canvas]              │
       │                                                        │
       │      ┌───────────────────────────────────┐             │
       │      │ Card: Read src/checkout/guard.ts  │             │
       │      │ ┌───────────────────────────────┐ │             │
       │      │ │ ↖ Map: cluster [checkout]     │ │  (Vector    │
       │      │ └───────────────────────────────┘ │   Echo)     │
       │      │ export const verifySession = ...  │             │
       │      │                                   │             │
       │      └───────────────────────────────────┘             │
       │                                                        │
       └────────────────────────────────────────────────────────┘
```

### Visual Mechanics
- Inside the active operation card (or in the top margin of the passage), an inline chip displays:
  `[Icon] guard.ts · ↖ checkout (layer 2)`
- Clicking or hovering the chip briefly eases the 3D map camera to center on that node.

### Placement & Collision Safety
- Embedded within the existing card layout hierarchy; zero possibility of overlay collision.
- Identical layout across 600 px, 1440 px, and ultrawide viewports.

### Idle Cost & Budget
- **Idle CPU/GPU:** **0.00 ms.** Zero new animation frames, zero WebGL shader modifications.

---

## 5. Comparison Matrix

| Criteria | Direction A: Spatial Halo & Floating Chips | Direction B: Constellation Trail & Tethers | Direction C: Peripheral HUD Echo |
|---|---|---|---|
| **Visual Premium / "Dribbble Feel"** | **High** (closest to Yash's reference) | **Very High** (architectural depth) | Moderate (understated developer utility) |
| **Reading Calm (Freeze Test)** | High (suppressed in reading zone) | Medium-High (requires clean gutters) | **Highest** (integrated into cards) |
| **Idle Frame Compute** | **0.00 ms** (stationary at rest) | **0.00 ms** (stationary at rest) | **0.00 ms** (zero canvas changes) |
| **Responsive (600px vs 1440px)** | Suppresses chip when gutter < 160px | Collapses to compact badge at 600px | Unchanged across all widths |
| **Collision Risk** | Handled via `placeLabels` obstacles | Zero (docked in margins) | Zero (part of flow) |
| **Implementation Complexity** | Low-Medium (uses existing `placeLabels`) | Medium-High (spline buffer + SVG tethers) | Low (pure UI component) |

---

## 6. Recommendation

**Direction A (Spatial Halo & Free-Gutter DOM Chips)** delivers the exact premium aesthetic requested from the Dribbble inspiration while strictly honouring Drishya's creative doctrine:
1. **It preserves the 0 ms idle frame budget** because the WebGL points glow statically, and DOM chips are CSS-transformed without polling or continuous RAF loops.
2. **It leverages existing, battle-tested infrastructure:** `placeLabels` in `apps/ui/src/lib/map-labels.ts` already tracks screen obstacles (reading area, header, toolbox) and can greedily place up to 2-3 recent file chips with zero collisions.
3. **It fails safe:** On narrow viewports (600px) or crowded sessions, chips simply don't mount if unobstructed margin is unavailable—preserving total calm for reading.
