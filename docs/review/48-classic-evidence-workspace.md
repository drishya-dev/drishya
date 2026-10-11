# Classic: evidence workspace and developer review

11 October 2026. Latest builder direction supersedes 47's two-design product plan: **Classic is the active experience**. Keep its centered, accumulating canvas; bring over Studio's useful right panel. Studio and Legacy are retained under Settings → Earlier design backups and explicit URL selection, rather than parallel development targets. Preference v3 starts existing users in Classic without reinterpreting their old Studio preference. No backend/event-schema change. Hosted CI stays publishing-only.

## Delivered composition

- Left: larger actual-session folder explorer, 13 px filenames, 19 px extension-specific glyphs and a continuous scrollbar. Folders are muted taupe; TS, React/JSX, JavaScript, JSON, Python, Rust, Markdown, styles, images, shell, Git, database and configuration formats have distinct readable marks/colors. Unknown extensions remain neutral. Format color does not imply a test result or agent action.
- Center: existing Classic materials, parallel passages and prose. No new presentation queue, fake text typing, copied captured characters or renderer. The real DOM arrival now takes 700–820 ms instead of 620–740 ms; deliberate hover takes 400 ms in / 350 ms back instead of 360 / 320. Evidence stays immediately available and transitions interrupt/retarget. Reduced motion and low resources retain their fallbacks.
- Right: the **Evidence desk**, with Review work and separately consented current Git; captured agent identities/family-state descriptions; actual native/MCP tools. The whole rail scrolls independently when necessary. Agent descriptions are on hover; there is no Classic Agent overview on/off control or header roster. Clicking an agent focuses its work while retaining surrounding history; contextual nonmatching cards are muted, returning to full contrast while read. Names/states come from the scene boundary, including replay; no future agent appears early. The legacy comparison remains only in the backup.
- Header: existing translucent tint/blur and centered session identity; a larger 22 px Settings glyph. Mobile keeps Review work in the header when the rail is closed, and a Tools disclosure for the complete desk/roster/catalog. No second toolbar added across the world.
- Map reading: a modeless file reader starts with the action trail collapsed, allocating its initial space to source/patches; Show actions restores the trail. Full-dialog reading keeps its original default. Map engine, 3D orbit and typed relationships are unchanged.

### Continuous explorer bounds

Pagination was removed from the **folder list**, not by mounting every file at once. A fixed 32 px row window renders viewport rows plus overscan; scroll height accounts for every visible tree entry. Search can reach any indexed file. Home/End and Up/Down move through the full flattened tree, including unmounted rows. Expanding/collapsing a distant folder preserves its clicked-row anchor and focus; changing the query resets to the start. ARIA positions describe siblings at that level, not the complete flattened list. Historical source/patch services still retain their existing bounded content requests; this change does not pretend that all repository bytes are in memory.

### Relationship motion after moving the roster

The review caught two real integration problems before commit: prose origins still searched only the old crown, and tool visibility checks ignored the new station's clipped viewport. Origins now resolve the real visible right-hand agent row, and reject native/MCP/agent origins clipped by the station, dock, spine or folder list. Rail scrolling revalidates relationship geometry. An unavailable visible origin is omitted rather than invented. Single-agent sessions retain the captured title as the prose home.

## Explicit themes and brand

System was removed from both the selector and the automatic OS listener. A legacy saved System preference resolves to Jet Black. These are explicit color themes, independent of workspace design:

| Theme | World / material / raised material | Navigation | Meaning |
| --- | --- | --- | --- |
| Jet Black | `#080808` / `#141414` / `#1d1d1d` | Mint `#9cdac1` | Neutral black, restrained hairlines, vivid semantic source/change/test/error colors |
| Midnight | `#090d16` / `#121a27` / `#1b2637` | Iris `#b3a7ff` | Cool ink surfaces with readable contrast, shared semantic colors |
| Paper | `#f4f5f2` / `#ffffff` / `#ecefeb` | Forest `#29654c` | Soft light materials; darker source/syntax/extension colors for legibility |

The Settings names, notes and miniature swatches match these actual Classic tokens. Source syntax remains multicolor; neutral action borders and colored type glyphs remain the grammar, with thin red contours reserved for errors. No continuously animated theme decoration was introduced.

The new original vector **neural eye** uses one eye contour around a connected iris, readable at small navigation size. It replaces the generic ring in the workspace and Home and is the favicon. Reusable SVG: `apps/ui/public/brand/drishya-eye.svg`; React mark: `BrandMark.tsx`. It represents seeing observable work, not access to private model thinking. No bitmap dependency or generated raster is needed for a scalable UI identity.

| Before | After | Why |
| --- | --- | --- |
| Studio provided the useful evidence desk while Classic review was split across header controls | Evidence desk and tools in Classic's right rail | Consolidate evidence, ownership and tool context without changing the centered working canvas |
| Agents across the top plus a separate overview toggle | Captured identities on the right with hover explanations | Keep session header calm; make ownership available beside tools |
| Explorer Previous/Next and 120-item slices | Continuous virtualized tree with expansion anchoring | Keep a normal explorer scroll without losing large-repository bounds or reading position |
| Small mostly document-shaped format marks | Larger distinct extension glyphs and meaningful colors | Faster scanning without replacing filenames or fabricating state |
| System and misleading palette descriptions | Three explicit named palettes with matching swatches | Make appearance intentional and predictable |
| Modeless map reading stacks its action trail before source | Source-first reading with an optional action trail | A file opened from the map should initially show actual file material |
| Generic ring brand | Connected-iris eye | A specific scalable identity connected to Drishya's seeing/agent concept |

## Independent developer/user critique

One fresh agent was explicitly asked to act as an experienced cross-domain developer, frontend designer and daily user: assess adoption, current features and missing utilities, typography, animation, evidence, native harness lifecycle and design. It inspected source and interacted with the earlier served Classic synthetic/live sample at 1280×720: Review work → patch, historical reads/find, agent focus, Settings, map-file reading. It did **not** run native account turns, real Git, permissions or attachment uploads. Its later recheck of this implementation was source-only because its browser connection became unavailable. The parent performed the new-build browser checks. Neither the reviewer nor synthetic testing establishes human demand or real-account release acceptance.

Baseline verdict: **would use as a companion review workspace, would not yet replace the native client as a sole daily interface**. Historical trust 8/10, return/review 7, focused reading 6, live comprehension 6, repository utility 4, multi-agent utility 5, visual coherence 7. These are ratings of the previous served layout, not post-change scores.

### Prioritized next developer jobs

1. **Continuous source → change → check reading.** A stable evidence location with Back/Forward retaining exact file mode, revision, line/scroll and selected action. Reuse existing ArtifactReader/FileHistory/Verification/EvidenceReview rather than another dashboard. Original history remains a contextual detour.
2. **Useful initial reading.** The map's source-below-fold issue is fixed here. A captured read preview can still start with imports/comments while the discussed condition is below the fold. Prefer evidence-backed selected/search lines when available; never infer a supposedly important line from nearby prose. Consider explicit reader text-size/wrap controls and useful source allocation.
3. **Actual native primary-workspace acceptance.** Claude Code and Codex: real prompt, exposed reasoning, text/image/folder attachments, exact one-time approvals, stop, failure/reconnect recovery, same-session follow-up, model/effort, compaction, daemon restart, another native client active and session switching. Session/worktree, effective policy and current turn owner must be clear. Full access must not be simulated or silently weakened. Current protocol mock passes do not close this gate.
4. **Useful ownership focus.** The roster relocation and stronger contextual focus are implemented. Later add stable short session/worktree identities when multiple main agents use one harness; optional owner-focused result/jump navigation and deliberate isolation. Harness hue alone is insufficient. Parent-child and independent sessions remain distinct.
5. **Review continuity and unresolved risks.** Current Git already has separate consent, exact patch fingerprints, browser-local marks/notes, stale invalidation and a privacy-previewed local handoff. Add a durable historical review queue, unresolved questions, pins and a compact return digest. Keep reviewer notes visibly separate from captured agent prose, and current branch state separate from inferred agent authorship/test coverage.
6. **Answerable repository navigation.** A stable readable selected-file neighborhood with typed imports/importers and a bounded label budget. Keep the broader spatial map/folder alternative. The job is to answer a dependency question, not to orbit until the layout happens to be favorable.
7. **Reduce IDE detours carefully.** Bounded whole-file search, supported semantic outline/definition navigation, resolvable diagnostic-to-source jumps, external-editor handoff and a curated historical evidence packet. Current bounded page find, recorded-file trails/current-source mode and current-Git handoff exist; richer semantic/document handling still needs implementation and acceptance.
8. **Sustained craft.** Real ten-minute reading, long names, huge diffs, narrow aspect ratios, independently scrolling catalogs, keyboard/assistive technology, interrupted hover/arrival and multi-agent sessions. Slower origin motion is a modest refinement, never the reason to hold up native work or the only way to read content.

Do not restart theme prototypes to solve these developer jobs. Classic is the current product and these jobs should be incremental, tested improvements on its existing backend/evidence boundaries.

## Local validation

317 unit tests, both TypeScript checks and production build pass. Local browser checks cover the transferred evidence desk/roster; all three palette tokens and absence of System; desktop/narrow geometry at 1920×1080, 1280×720, 900×500, 768×900 and 390×844; 600-file bounded continuous scrolling, search and Home/End focus; distant-folder expansion anchoring and sibling semantics; modeless map source visible on first frame; existing hover geometry, MCP/long-path material bounds, native attachments/approvals/source/settings transport, current Git consent/progress/staleness/handoff, live Follow, optional replay and map orbit. Exact final run accounting is recorded in STATUS. Native connected tests use synthetic protocol transport, not actual account turns. No hosted CI was dispatched.

Two stale design-selector assertions and an asynchronous consent test race were corrected; Git approval is now awaited before inspecting the next consent UI. The orbit test now drags a hit-tested exposed canvas rather than a fixed point that can land on a correctly interactive file label after layout changes. Rotation/pitch/12-second resume/reduced-motion assertions remain intact.

Remaining release checks: actual harness accounts/versions/platforms, physical low resources, native attachments/pixel privacy, multi-agent live ownership, assistive technology and human/ten-minute visual acceptance. The independent critique is a prioritization input, not a claim of release readiness.
