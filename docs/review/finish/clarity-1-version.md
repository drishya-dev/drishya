# CLARITY-1 · Clarity, a new UI version built beside Modern

Opus, 6 November 2026. Yash's direction, the same day, after seeing the Home concepts:

> "The one you designed right now looks clean and modern and takes accurate space, making it minimal but professional and premium. I want that look for the whole product: each page, each interaction, each component, each division, menu, dropdown. Keep this one [Modern] as a backup UI version that we can switch to in Settings, make a replicated one, and work your whole way over there. If the agent visualization can be done better, do that; the themes, the colour palette: full freedom."

He chose Home concept A, **Ledger + Now** ([canvas](https://claude.ai/artifact/F7R4ZjPx9ShBjNe2Xa31AB)).

## Why the product does not look like the concept today

1. **The typeface.** The app renders **Outfit**, a rounded display face bundled in `public/fonts`. The concept used **Inter**, a face built for interface text. `--sans` names Inter first, but Inter is never bundled, so it never renders.
2. **Sixty layered sheets.** Modern is Legacy's app plus a stack of Modern sheets over it, about 60 in all. Every surface is a negotiation between rules written at different times, at specificities up to `:root[data-ui-version=modern][data-experience=classic][data-theme][data-palette=jet]`. Nothing has one owner, which is why spacing, menus and motion drifted.
3. **No system to follow.** The FINISH-0 inventory found no spacing, layer or duration scale, three menu systems and 28 native selects.

The concept looks clean because it was drawn from one system, in one face, with nothing underneath it.

## The decision

- **Clarity** is a third UI version. It starts as an exact replica of Modern, and every FINISH item lands in it.
- **Modern does not change.** Its CSS, its markup and its behaviour stay byte for byte where FINISH work is concerned, so it remains the backup in Settings.
  - **Shared content logic** (CONTENT-16, CONTENT-17, FILES-12, CONNECT-3, LIVE-6, data and projection fixes) belongs to both versions. That is information, not presentation.
- **Default:** Modern stays the default until FINISH-13. Then Clarity becomes the default, and Modern stays one click away.
- **Full freedom** inside Clarity, under the AGENTS doctrine and VISION. Clarity's own direction is recorded in VISION §9.
  - The agent visualization: FINISH-5 and FINISH-6.
  - Themes and palettes: FINISH-0a and FINISH-12.

## How Clarity is built: one layer that wins

1. **Version and skin.**
   - Clarity sets `data-ui-version="modern"` (so it inherits everything Modern does on day one) plus `data-ui-skin="clarity"`.
   - `lib/ui-version.ts` gains `selectedUISkin(): 'modern' | 'clarity'` and a `useSkin()` hook.
   - Settings' UI versions panel lists Legacy, Modern and Clarity, with Clarity labelled "In progress". It is visible to everyone, not only behind the developer switch: Yash asked for it in Settings. Choosing it saves and reloads, as today.
2. **Cascade layers.** A small Vite plugin in `apps/ui/vite.config.ts` wraps every CSS file outside `apps/ui/src/clarity/` in `@layer legacy { … }`. The first stylesheet loaded declares `@layer legacy, clarity;`. Clarity's sheets are written in `@layer clarity`, scoped to `:root[data-ui-skin=clarity]`, so they beat every legacy rule whatever its specificity. A layer cannot be outranked from inside an earlier layer.
   - **Modern stays identical**, because all its CSS moves into the same layer in the same order. Within one layer, order and specificity behave exactly as before.
   - **`!important`:** legacy has 48. An important declaration in an earlier layer beats one in a later layer. List all 48 in the PR, and mark the ones Clarity will need to override. Each such declaration moves to `:root:not([data-ui-skin=clarity])` in its own file, so Modern is unchanged.
   - **Fallback:** if the plugin approach fails in the production build (extracted CSS, chunk order), stop and report rather than inventing another architecture.
3. **Markup.** Where Clarity needs different structure, a component branches on `useSkin()`. Examples: a real Select instead of a native `<select>`, the new Home, the composer.
   - New Clarity-only components live in `apps/ui/src/clarity/`.
   - Modern's branch keeps its current markup exactly.
   - Shared logic is never forked: only the rendering differs.
4. **Fonts.** Bundle **Inter** (variable, SIL Open Font License) in `public/fonts` with `@font-face` in Clarity's sheet; `font-display: swap`; no network. JetBrains Mono is already bundled. Clarity uses Inter for all interface text and JetBrains Mono for code. This is FINISH-0a's, not the scaffold's: the scaffold must still be identical to Modern.
5. **Where files go.**
   - `apps/ui/src/clarity/entry.tsx` imports Modern's entry and then `clarity/index.css`.
   - `clarity/index.css` imports Clarity's sheets in layer `clarity`: `tokens.css`, `base.css`, then one sheet per component as the FINISH items add them.

## CLARITY-1 acceptance (the scaffold only, no visual change)

- Settings offers Clarity, and switching to it and back works, persists and keeps the open session.
- **The guard:** Modern is pixel-identical before and after the layer change. Clarity is pixel-identical to Modern. Compare screenshots on real sessions of both harnesses in a scratch home:
  - **Surfaces:** Home, a session at rest, an expanded card, Files and peek, Workspace, Git review, Settings, the composer open, a context menu.
  - **Sizes and palettes:** 600 and 1440 px, in Jet and Paper.
  - **Comparison:** zero differing pixels. Anti-aliasing noise is allowed only if it is measured and explained.
  - Harsh's prepared UI-26 capture scripts (#350, `scripts/ui-26-capture.ts`, `ui-26-guard.ts`) may be reused with credit.
- A Clarity rule in `@layer clarity` overrides a high-specificity legacy rule; prove it with a unit or a browser spec.
- Each of the 48 `!important` declarations is listed and handled as above.
- `pnpm check:affected`, the UI-version specs, and a full `ui:build`; the production build is checked for layer order.

## After the scaffold

FINISH-0a (tokens, Inter, palettes, buttons, switch, inputs) is rebuilt as Clarity's first layer. Then 0b, 0c, FINISH-1 (Home, concept A) and onward, all in `apps/ui/src/clarity/`, with `useSkin()` where the markup differs.

**The Modern rule for every FINISH PR:** the diff touches nothing Modern renders, except shared logic and the `useSkin()` branch points. The guard proves it.
