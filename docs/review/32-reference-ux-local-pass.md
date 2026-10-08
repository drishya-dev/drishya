# Referenced UX elements — local integrated pass (8 October 2026)

**Executed follow-up:** [33 — Smooth following and map navigation](33-smooth-follow-map.md) records the builder's subsequent request to implement the proposed map steps and make the interactions visible. It supersedes the initial timing/header candidate here. Observed-file filtering, direct import paths, a Follow switch, an activity strip/menu, segmented view controls and searchable file fields are now implemented locally.

The builder supplied Uiverse and CodePen references to improve the existing workspace. These are interaction references, not a component kit to import. No external font, animation library, CSS package or runtime request is needed. The branch remains local for visual review.

| Reference | Useful idea | Drishya decision |
|---|---|---|
| [Uiverse Design](https://uiverse.io/design/) | Consistent visual tokens | Keep the repo's theme tokens and content shapes; a separate system would fragment the workspace. |
| [Uiverse switches](https://uiverse.io/switches) | Clear state changes | Existing theme, motion and resource settings already use labelled controls; retain their accessible state and short transitions. |
| [Border button](https://uiverse.io/tirth_5172/yellow-pug-84) | Hover/focus should acknowledge intent | Use a short 2 px focus rail on workspace view toggles. Skip the one-second sheen and segmented animated frame. |
| [Terminal card](https://uiverse.io/emmanuelh-dev/serious-grasshopper-66) | Command/output material should read as a terminal | Keep Drishya's captured command and result composition; decorative traffic lights would suggest a terminal window the agent did not open. |
| [Search input](https://uiverse.io/Galahhad/breezy-wolverine-23) | Keyboard discoverability and focus contrast | Show `/` beside Search and give the opened input a focus rail. Use the native popover and existing search semantics. |
| [Weekly chart card](https://uiverse.io/NK2552003/silly-moth-73) | Compact visual counts | Existing activity marks and truthful test tiles already serve this role. Do not invent time-series data or mount another chart. |
| [Skewed glass card](https://uiverse.io/Fcodingx/afraid-lionfish-0) | Distinct hover state | Keep measured whole-material reading focus; constant skew, blur and expanding card height would distort evidence. |
| [Flip card](https://uiverse.io/gharsh11032000/selfish-owl-57) | More detail on intent | Existing Expand/hover reading keeps captured text selectable and visible; a 3D back face hides evidence and incurs another layer. |
| [Notification card](https://uiverse.io/SouravBandyopadhyay/rude-tiger-29) | A narrow semantic edge | Use a thin error edge on the workspace notice; omit radial glow and gradient. |
| [Card Illumine](https://codepen.io/RAFA3L/pen/ZYbabEa) | Directed visual focus | Existing true-origin tethers and restrained focus marks communicate relationships without a cursor-following light or external font. |
| [Folder card](https://uiverse.io/byllzz/great-wombat-13) | A folder should visibly open | Keep actual folder navigation and files. Infinite hint motion and 3D paper layers would misrepresent file activity. |
| [Prompt card](https://uiverse.io/Cobp/dangerous-dolphin-47) | Clear input focus | Add a restrained focus border to the existing native prompt composer; keep it compact and solid. |
| [Hover stack](https://uiverse.io/kamehame-ha/chilly-snake-91) | Distinguish the active material | Current hover reader enlarges one real DOM article. Blurring or shrinking sibling evidence would undermine comparison and cost paint work. |

## Local changes

- The pinned workspace header stays translucent at rest and while scrolled. Only its lower edge has bounded blur; low-resource mode removes that blur.
- Workspace view toggles, search and prompt input have focused feedback tied to real interaction. Captured text and neighbouring evidence do not animate for attention.
- The existing material origin/settle, hover reader, prose arrival and map camera timings are shorter. They remain finite, interruptible and disabled by reduced motion or the existing motion/resource controls.
- The graph keeps its spatial density levels, deterministic edge paint budget and bounded DOM labels. Canvas backing resolution is capped at 1.5 device pixels per CSS pixel (1 in low-resource mode), and moving over the same map node does not allocate a new tooltip state for every pointer event.

## Map direction without another full graph

The proposed increments have been implemented: **All files / Observed** filters captured file IDs without changing their coordinates. **Import paths** shows the selected file's direct static imports and reverse imports; current-passage file choices provide starting points. Neighbor buttons move to their exact file, and recorded work opens separately. The path overlay retains at most 64 resolved relations and the drawer displays pages of 12. These describe current static relationships, not agent execution or causality. See [33](33-smooth-follow-map.md) for local checks and resource measurements. Physical low-resource machines remain a release check.

This pass is a local candidate for the builder to judge in the integrated app. It does not establish human preference or release-scale performance.
