# P1 — fresh design directions, 6 October 2026

## Builder direction and scope

The builder asked to start the visual exploration afresh, create different interactive versions, choose the strongest, and preserve all of them. Minimalism must not hide developer essentials. Agent ownership and work belong in the centre/top; native tools and named MCP tools belong on the right. The left composition is open. Smooth, meaningful relationships, content-shaped reading and useful context must earn adoption; attractive transcript boxes alone are insufficient.

This work contains two separate deliverables: **three retained synthetic design prototypes**, and a bounded improvement to the integrated reader. The prototypes are not replacement harnesses or three production applications. No real capture is imported, no model is called, and no source file is changed. The integrated history retains its pure composer, paged worker/data-source boundary, sanitation and as-of behavior.

Open the gallery through the running daemon at `/concepts/index.html`. Sources live in `apps/ui/public/concepts/`; `studio.html`, `relay.html` and `atlas.html` share `concepts.js` and `concepts.css`. The normal build copies them into the local app. Keep every direction; future agents must not delete an alternative simply because Studio was recommended.

## Same evidence, different spatial systems

All three read the committed `/demo/bundle.json`: synthetic Claude Code, its Explore child, and Codex reviewing the checkout change. Source excerpts, MCP inputs/results, captured patches, assertions and agent prose come from that bundle. Artifact bytes outside the bundle are never substituted from the current filesystem. Classification and derived test counts retain their qualifications. The fixture map is **files-only**: no edges are drawn, because no dependency edges exist in this bundle.

The controls reveal captured passages, filter by file/tool/agent, open a larger reading space, switch map/motion off and return to latest. The prototype reader uses a native modal dialog with Escape/close and focus return. That is a comparison affordance, not a decision that the final app must move all reading into a modal. Reading material is already selectable before animation. The only animated element is an evidence-backed connector; no typewriter, simulated token stream, invented thoughts or idle loop.

An edit's reading space compares an available captured-before artifact or an explicitly labelled earlier captured read, its captured patch, and its derived/reconstructed-after artifact. In this bundle the immediate-before descriptor has no bytes; the prototype compares the earlier read and explicitly states that it is not a verified immediate-before state. The after state is labelled with its derivation rule, never presented as a newly read file. This is a retained feature/layout experiment for the file-centred utility stage, not a new production P2-B implementation.

**Timing limit:** these are full-recording material studies. Reveal-next samples a complete captured passage, including its recorded result; it is not an as-of replay clock or a simulation of a live pending tool. The catalog explicitly describes the full synthetic recording. Production must continue using the existing deterministic composer and immediate input/late-result logic, not this prototype sampler. The prototypes are bounded to this tiny fixture and are not large-repository or long-session implementations.

| Direction | Composition | Strength | Cost / why it is not the default |
|---|---|---|---|
| **Studio** | A shared chronological stage; contextual file index left, complete observed instruments right; graphite with warm agent identity; code uses broad reading surfaces, outcomes occupy compact space, prose is unboxed | Preserves the combined account and reading width. Instrument locations remain familiar as work accumulates. Clear foundation for content-driven inline expansion | The left list is still a candidate; permanent context cannot grow without a bounded layout. Needs production integration, deeper visual hierarchy work and human comparison |
| **Relay** | Explicit per-agent lanes with sticky ownership; cool blue graphite; each agent retains its own order; a larger reader handles source inspection | Makes responsibility and delegation easy to compare. Useful optional multi-agent mode | Splits combined chronology and narrows code. Empty lanes waste space early in a run; three agents do not automatically justify three permanent columns |
| **Atlas** | A light, repository-first exploration field on the left; the captured work occupies its own reading stage; persistent tools right | File identity becomes an obvious navigation target. Useful expanded-map mode and a retained light-theme experiment | Reserves substantial width for the map even when reading is the task. Labels needed separation from the heading during visual review. Not the default theme decision |

**Choose Studio as the default direction.** This is an engineering/design judgment after reviewing the rendered versions, not measured user preference. It best matches the builder's central-work/side-instruments grammar while preserving readable code and combined history. Borrow Relay's explicit ownership and optional comparison, and Atlas's deliberate expanded repository exploration. Do not combine every treatment at once: the stage would lose its hierarchy.

## What is worth carrying into production

1. **Persistent instruments, transient activity.** Native category plus the full observed harness tool names; named MCP server plus its visible tools. Activity changes focus once and emits into the stage; the list does not repeatedly disappear/reopen. If a harness later supplies an available-tool manifest, display it as a separately evidenced catalog. Until then, “observed” is the truthful scope.
2. **A reading hierarchy, not equal cards.** A source/patch gets enough width for meaningful lines; a test result gets the space its counts/assertion need; search gets paths plus actual excerpts; MCP gets its actual structured input and result. Unboxed agent prose follows the work it accompanies. Long names/source lines remain accessible without reducing font size.
3. **Two identities for a read.** Its observed tool call leaves the right instrument; its captured excerpt connects to its real file location. These are distinct relationships. No arrow asserts that a prior file or result caused the agent's next decision.
4. **Material-shaped motion.** A source/patch uses a reading rail; command/search/outcome uses a baseline. Motion must not introduce a generic flying rectangular shell for every material. Animate relationships and boundaries while DOM characters remain stationary and selectable.
5. **Reading belongs to the user.** Selection, expansion and navigation hold the camera. Capture continues. Preserve the selected passage and pixel anchor, finite animations, explicit return and quiet idle state. Focus cannot move a control between pointer press/release. Every optional comparison/map mode must exit immediately to reading.

The useful adoption moment is concrete: follow the zero-total source, inspect the captured edit, open the real failed assertion, and notice the later agent's unresolved payment issue. That is something a developer can verify, remember and demonstrate. Smooth visual continuity should make this easier than searching raw logs; do not claim “market first,” a moat, safety or superiority before the comparison pilot.

## Integrated reader improvements in this slice

- Flexible content-based packing replaces an underfilled fixed-column grid. Source and patch previews soft-wrap long captured lines. Source has a restrained backing; changes retain semantic addition/removal washes; terminal, search and outcomes remain quieter compositions. Expanded readers retain their bounded artifacts.
- Native tool names wrap instead of ellipsis. Observed MCP tools stay visible at rest. Files use two lines for directory/name within a bounded virtual row; exceptionally long parts can scroll rather than silently disappear. A narrow-screen Tools control exposes the same dock and deliberately holds follow.
- MCP connectors originate at the visible named tool, falling back to its named server if the tool is outside the dock viewport. New reads can emit from Read and lift from their evidenced file source. Content-shaped rails/baselines replace the generic moving rectangle.
- Pointer focus on a control does not pin/reflow its passage before activation. Spacer measurements resolving during the press are applied after activation; keyboard focus and text selection still hold immediately. Capture is not suspended. Tests exposed the earlier intermittent terminal-fold lost click; temporary event diagnostics remain local.
- P2's full-recording verification panel reloads on a rendered live revision. Its scope is explicit. During optional sequence replay it shows a qualification instead of future verification facts. This is a conservative integration guard, not a new as-of endpoint.
- Visual review exposed stale unversioned JS/CSS from the daemon's year-long immutable cache. Only content-hashed `/assets/` build files now use that cache; public fixture/prototype files use `no-store`. A server regression covers both cases. The first prototype revision has a query version to invalidate already cached resources.

## Validation and limits

The ordinary browser suite covers each prototype's real source reading, modal focus return, file filtering, passage arrival, map/motion off, narrow tools and horizontal overflow. Integrated checks cover recorded input before result, all five finite cues, scrolling/selection, global history/search/replay, visible measured origins, terminal folding and verification refresh/replay qualification. The same fixture is used for all three directions; no performance/preference claim follows from its small size.

On the integrated dock/composition candidate, a ten-minute synthetic reader passed **603,482 ms, 115 rounds / 345 added steps, peak 578 DOM nodes**, with the existing <2 px anchor/explicit-return assertions. This run preceded the final contour-only change from rectangles to rails/baselines and the static prototype/cache additions; the reader/capture algorithm was unchanged afterwards. It is not a human fatigue or comprehension study, and the three prototypes do not inherit this certificate.

Reference-machine normal probe on the revised dock/file layout: 10,101 observations, 5,000 files, five 200-record additions, Chrome 1440×900, map on. Open 4.48 s; update p50/p95 **253/1,251 ms**; browser JS heap 43.10 MiB; 842 DOM nodes; peak sampled daemon RSS **410.86 MiB**; next-frame p95 12.6 ms. The ten-minute reader ran concurrently. This passes the scoped 1.5 s update/resource gate; the result is not a controlled comparison with the earlier isolated 293 ms run, a whole-browser-RSS certificate, or physical low-resource acceptance.

Screenshots and temporary traces stay in `.local/`. Sources, comparison rationale and tests are committed. Keep pre-existing package-manager edits and model planning notes out of commits.

## Next bounded implementation

Bring Studio's hierarchy into the integrated React reader **without replacing its data source, virtualization, provenance or as-of model**. Start with a measured task header and the content reading rail, not a new permanent left dashboard. Evaluate actual 1440/1280/390 px reading, a running call with late output, mixed-agent bursts, very long source/MCP names and held selection. Expand source in place; retain the modal only as an optional deep-reading experiment. Keep the right tool catalog stable and the left context replaceable.

Then test matched tasks against the harness transcript: which file was read; what changed; which assertion failed; what remains unresolved. Measure correctness, completion time and whether developers choose it again. Only then decide whether optional Relay/Atlas modes justify their complexity. Additional skins and effects must earn their reading cost. Physical B4 release gates and P2 file-centred comparison remain separate work.
