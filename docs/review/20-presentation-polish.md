# 20 — Presentation polish: palettes, timeline, file lift

6 October 2026 · Harsh (with Claude Opus 5.5) · Local checks only (hosted CI deferred per [CI_POLICY](../CI_POLICY.md)).

The builder asked for the main UI to feel finished: 2–3 good themes, the original `docs/prototype/index.html` as the reference for materials, more room for real code, and motion where "the file comes out of the folder" without popups or lag. This increment is presentation plus one navigation fix. It makes no capture, store, API or schema change.

## What changed

**Named palettes.** Settings → Appearance now offers:
- **Jet**, the signature default, at the builder's request: **matte jet black with champagne gold** (replacing Charcoal's grey graphite).
  - Neutral blacks (`#0b0b0b` world, `#111`/`#161616` surfaces) with no warm or blue cast. Surfaces are flat, with no gloss or sheen; separation comes from hairlines and depth.
  - Champagne gold (`#d4b98a`) is the single accent: brand mark, selection ring, active view, "Back to latest", current timeline tick, source/navigation identity, syntax keywords, and a hairline under the crown. Other syntax: ivory functions, sage strings, rose numbers, italic comments.
  - Matte finish: a static inline-SVG fine grain and a soft edge vignette. These are pointer-transparent fixed layers with no animation; low resource mode removes them (`data-low-resource`).
- **Midnight**: the prototype's near-black world, periwinkle focus, orchid MCP.
- **Light**: paper and stone, slightly warmer than before.
- **System**: Jet or Light, following the OS.

How it is stored and applied:
- `data-theme` stays `dark`/`light`, so every existing light rule and test keeps working.
- The new `data-palette` (`jet`/`midnight`/`paper`) selects the tokens.
- The stored value `dark` now means Jet, and it remains the default, so existing users keep their choice. `midnight` is a new stored value.
- Map and lens redraw on a palette change: `useResolvedTheme()` is now a scheme-plus-palette key.

**Type and materials.**
- Fonts: Segoe UI Variable / Inter, and Geist Mono / JetBrains Mono / Cascadia.
- 13.5 px body, tabular numbers on counts, themed thin scrollbars.
- Cards: 10 px radius, hairline border, inset highlight and a deeper lift on hover/selection.
- Headers: a quiet graded backing.
- The crown and transport use a blurred translucent chrome, as in the prototype.

**Reading width.**
- Source 620 px, reading 700, medium 360, compact 300; the column maxes out at 1360.
- At 1440 px a patch plus its test run share one row with far less code wrapping.
- At 1920 px search, patch and test sit side by side.

**Compact toolbox.**
- Dock rows are icon + name + count, with observed tool names on one muted line.
- MCP tools hang off a tree line under their server, like the prototype's drawers.

**History activity timeline.** The history transport shows the whole recording as ticks:
- copper = edit, red = failure, green = passed test, orchid diamond = subagent, grey = prompt.

How it behaves:
- Ticks are placed by recorded order, not wall-clock time.
- Clicking a tick opens that operation in history.
- **Next failure / Previous failure / Next edit** walk through them from the keyboard.
- The ticks are a pointer shortcut and are `aria-hidden`; the jump buttons are the accessible path.
- Long recordings show at most 400 ticks, thinning quiet ones first. Failures are never thinned. A paged recording uses the worker's sampled markers and says so in the tooltip.
- `Marker` gained an optional `operationId` (`packages/scene`). The golden marker strip was updated deliberately; the only diff is the added ids.

**File lift.**
- When a read arrives and its origin (repository node, or the labelled working-set row fallback) is visible, a plain document silhouette rises out of that origin, travels along a curve and lands on the action's header glyph. This takes 700 ms with the existing finite ease.
- No path text or captured content travels. The excerpt is already stationary and selectable in its final DOM.
- It joins the existing Emit from the Read instrument. It is cancelled by the same interrupt rules, and suppressed by Motion off or reduced motion.

## Navigation fix found by the new test

Jumping to a distant operation could leave it off-screen. The history scrolled to the right place, then the reading-anchor restore pulled it back: the anchor was taken from whichever slot was first visible before the target window had been measured.

Also, a passage taller than the viewport was centred as a whole, which could put its first action above the top.

Fix in `History.tsx`:
- Scroll to the selected action itself; anything taller than the viewport is top-aligned with a 16 px margin.
- Anchor reading to the navigated passage.

This also improves verification links, search results and file-history "open in history".

## Checks run (local, Windows, Chrome)

- Typecheck plus 245 unit tests.
- 35 browser journeys, with the 2 opt-in real-session journeys skipped. This includes the new "history activity timeline opens recorded failures and edits; named palettes switch". It failed first (target off-screen) and passes after the fix.
- `package:verify`.
- Demo bundle regenerated byte-identical.
- Ten-minute sustained-reading soak: 604,732 ms, 114 rounds, peak 709 DOM nodes. It ran before the final CSS-only Jet palette pass; the full browser suite and `package:verify` passed again afterwards.
- Jet, Midnight and Light were reviewed visually at 1280, 1440 and 1920 px. The file lift was captured mid-flight in headless Chrome.

No Linux/macOS certification; no human preference claim.

## Not done here

- Explorer tree, editor-grade reader tabs and evidence gutter: see [19](19-developer-feature-proposals.md), after the baseline.
- Density setting and command palette: proposed in 19.
- A real-session visual review of the new palettes: needs the builder's own sessions.
