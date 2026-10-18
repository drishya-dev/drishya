# 99 — Adjustable Files space without covering Workspace

18 October2026. A separate UI increment after Git reading space in98/PR83 (`f3176e8`). Continue the installed Emil design-engineering guidance: readable content, intentional allocation and immediate repeated controls before alternate palette tuning.

| Before | After | Why |
|---|---|---|
| Files width is derived from a shared fixed rail |260px default with explicit220–420px resize, further capped at32% of the viewport | Let developers reveal longer paths without consuming an unbounded share of the canvas |
| Wider Files would cover the current Workspace | Workspace starts after the actual reserved Files rail | Source reading and file navigation remain separate usable surfaces |
| Hiding Files could recompose the agent's work | Agent history retains the rail allocation when Files is minimized | Keep the builder's stable agent-visualization requirement |
| Workspace retains empty Files space after minimizing it | Workspace reclaims the hidden Files area | Maximize the deliberate reading surface without moving the underlying agent history |
| Canvas reading-origin measurements only observe the outer viewer | Also observe the real history column | Origin coordinates follow an explicit column-width change |
| Width preference could be lost or exceed the current screen | Source/session-scoped validated220–420px preference, rendered viewport cap | Restore the preference when space returns without storing source content |

The existing separator provides pointer capture and Arrow/Home/End keyboard operation. Narrow screens retain96's local chooser/dismissal and do not show the desktop resize control. Existing tree virtualization, path tooltips, query, expansion and scroll restoration are unchanged. No new animation, source grant, direct file write, native action, endpoint, dependency or observation schema. Only bounded navigation dimensions are added to the existing allowlist. Legacy retains its rail.

## Local checks

- Both typechecks, production build and446 unit tests across76 files pass. Metadata bounds include malformed/non-finite/out-of-range Files widths.
- Four focused Edge journeys pass together: pointer/keyboard Files width, stable history on minimize, Workspace clearance/reclaimed width, viewport cap/preference recovery,96's phone chooser/default tracking and six-width navigation.
- All three opted-in actual Drishya/Skeletongraph Codex/Claude history and multi-file Workspace journeys pass, including95 upward wheel samples per session and post-render jump detection. Existing physical/platform/human acceptance limits remain; no universal scroll-fix claim.
- Local expanded Files frame inspected; no hosted CI/native submission/private content committed. User package/artwork changes remain excluded.

## UI and theme sequence

Keep Jet Black as the baseline while refining reader/dialog/menu density and interactions. Neutral surfaces/hairlines remain shared, type icons and syntax retain semantic color, and focus remains visible. Evaluate other palette colors on these real source/patch/result surfaces after their allocations are usable; do not compensate for layout problems with more accent fills or motion. This is the builder's requested mixed decision process, not a claim the palette/all-component pass is complete.

Continue84: untouched reader/menu/settings/composer details, palette quality, source-version comparisons and joined evidence→native correction→recorded-check workflow.92's optional useful review tools remain under quiet navigation; release/human/platform checks remain open.
