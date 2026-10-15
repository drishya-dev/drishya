# 76 — Modern on the Legacy foundation

15 October 2026 · Yash with Codex · supersedes the independent Modern architecture in 71/72/74/75.

## Builder decision

The builder rejected the unfinished workspace re-layout and explicitly asked to revert that last turn, use the complete Legacy product as Modern's foundation, preserve its agent visualization, and modernize everything around it. The unfinished allocated-grid/virtual-tree/map replacement was reverted before implementation. No user package-manager or logo edits were reverted.

Modern now renders the same `App`, `Viewer`, `History`, action materials, hover/origin choreography, map, explorer, source/Git readers and native composer as Legacy. This is shared code rather than a physical fork: fixes cannot silently diverge between two copies. `modern/entry.tsx` imports `classic-entry.tsx` plus **only** `modern/surroundings.css`. The retired independent `FreshApp` and old Modern components/styles remain unmounted source history; do not use them as the active product or add features there. They are absent from the production entry graph.

`data-ui-version=modern` identifies the skin; `data-experience=classic` selects the proven behavioral layout. Canvas remains independent, Legacy remains selectable, and saved/explicit Modern or former Fresh links resolve to this foundation. Settings still has Canvas / Legacy / Modern. Appearance is separate: Jet Black / Midnight / Paper.

## Design boundary and skill review

Applied installed `emil-design-eng` and motion guidance. The main agent visualization is deliberately untouched. No new typing, duplicate material, arrival or hover implementation was introduced.

| Before | After | Why |
| --- | --- | --- |
| Independent Modern omitted working Legacy features | Shared complete Legacy implementation | Retain established evidence/native/reading behavior |
| Parallel action-card and map implementations | Original Legacy cards, history, hover and 3D map | Preserve the visualization the builder prefers |
| Modern settings lacked real palettes | Legacy's complete appearance/resource settings | Predictable controls with working persistence |
| Bare surrounding panels and uneven controls | Scoped neutral surfaces, hairlines, compact input and instrument treatments | Improve presentation without moving the work |
| Repeated agents across the top | Existing right-side agent family menu | Preserve identity/filtering and give the stage more vertical room |
| Tool identifiers broke across small fragments | Single-line ellipsis with complete native title | Keep the compact rail readable |
| Browser Back after logo Home left the loaded session hidden | Restore the loaded viewer when its recording hash returns | Navigation must work even when the recording ID is unchanged |

Only surrounding elements are styled: header, workspace controls, explorer, tools/review rail, composer, search, settings, reading dialogs and Home. No rule targets History, Passage, operation cards or map geometry; semantic colors inside captured materials remain Legacy's. Existing finite pointer/menu feedback and reduced-motion behavior are reused. Chrome blur is disabled for low-resource/reduced-motion paths.

## Verification

- Production build and both TypeScript checks pass; full unit outcome recorded in STATUS.
- Six Modern browser journeys cover imported Claude/Codex history, logo/Home/browser Back, settings close, persisted palettes, reload, attachment preparation/removal, outside-click dismissal, consent-disabled submission, 390–1920 px bounds and version isolation.
- The parity test compares actual card text, IDs, background, radius, font, font size and width between Legacy and Modern.
- Long-diff/header-hover regression passes in Classic, Studio and Modern: expands both dimensions, keeps all captured lines and allows scrolling to the final line.
- Canvas's 12 and Classic refinement's 8 browser journeys pass. A wrong map test selector was corrected; the two initial Home/Back failures exposed and fixed the shared navigation bug above.
- Inspected actual local Drishya Codex and Skeletongraph Claude recordings. The older rootless Claude recording correctly stays read-only for native continuation/current disk access. No native prompt sent, no private screenshot/recording committed, no hosted CI dispatched.

This is the requested foundation reset and surrounding-interface pass, not a claim that physical/platform/native-account/public-release acceptance is complete. Keep iterating on the surroundings; changes to the core visualization require explicit builder direction.
