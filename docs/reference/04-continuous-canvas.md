# Continuous canvas: authoritative visual direction

21 September 2026 · User-directed revision after the first storyboard

**The primary experience is an accumulating, vertically navigable composition.** Actions arrive left to right during an action passage. Captured agent explanation and response text then flow underneath, directly on the canvas. The next action passage starts below. Earlier material remains in the history and can be brought forward. The first storyboard's single replacing panel was a design probe, not the intended default.

This document governs the spatial composition where it conflicts with the earlier review, blueprint or motion catalog. Evidence honesty, observe-only behavior, historical content and resource limits remain unchanged. “Thinking” means text actually exposed by the harness; the design never infers private reasoning from a pause.

## 1. The screen has places, without becoming a panel grid

```text
 project / session           AGENTS · active presence / current passage

                    quiet, interactive repository map behind the work

       READ SOURCE       SEARCH RESULTS       EXTERNAL RESULT       TOOLS
           ↘ retained, staggered overlapping surfaces ↗               Read
                                                                      Search
       Agent explanation flows here as readable prose.                Edit
       No bubble, no rectangular container, no “thinking card”.        Shell

       EDIT HUNK         TEST OUTPUT                                  MCP
                                                                       Context7
       Agent response continues beneath this action passage.           GitHub
                                                                       Browser
       ... history continues downward ...

                     replay / step / live position
```

**Top: agent presence.** A compact, stable row of names, activity states and identity marks. Select a name to emphasize its contributions in the shared history. Do not allocate a permanent box or column to each agent. Only current/recent agents appear by default; the rest are in a searchable roster. Identity remains legible without color.

**Background: repository terrain.** A quiet map with stable coordinates and genuine relationships. File activity emphasizes its actual origin. Blank canvas areas remain map hit targets; a deliberate Explore action grants the map full pointer/keyboard interaction. Content always wins hit testing where it overlaps the map. A selected path can remain highlighted when returning to the work history.

**Middle: continuous work canvas.** This is the dominant space. It holds horizontal action passages alternating with open prose. It is scrollable vertically. A passage contains real source, snippets, arguments, command output or an actual diff; a header saying “tool called” is insufficient.

**Right: tool dock.** Stable, quiet labels for native tools, followed by installed/observed MCP server names. Active tool labels briefly brighten. An MCP server can expand to reveal its tool names, but the entire dock is not an always-open catalog. The active item sends its invocation/output surface toward the work canvas. It stays at its dock position so the user learns where actions come from.

**Bottom: time controls.** Small, persistently discoverable play/pause, step, speed, jump-to-edit/failure and live position. Their role is transport, not a dashboard footer full of metrics.

## 2. Visual grammar: material and typography

Avoid equal-sized rounded cards, borders around every event, window title bars, chat bubbles and floating metadata badges everywhere. Tool material can have a subtle, irregularly faded scrim so code is readable. Its dimensions come from its contents. Different tools should produce visibly different compositions rather than reuse one generic card template.

Read: path and range above actual code. Search: query above matched excerpts. Shell: command on a baseline with output beneath. Edit: a diff whose line alignment is preserved. MCP: server/tool attribution next to arguments, followed by the result's natural shape. Prose: readable text directly on a dimmed area of the shared background.

Use a small palette, large enough source text and stronger typographic hierarchy. Fine guide lines may indicate chronology or source attribution; they are not mandatory rectangle outlines. No noisy status chips, omnipresent glow, fake holographic machinery or animated wallpaper.

An unframed paragraph is still placed over a contrast-preserving background. Use a feathered scrim behind the text area; reduce motion/blur without reducing contrast. Light text over raw graph edges is not a premium compromise.

## 3. Action passages and prose interludes

The normal sequence is:

1. Tool invocation starts in the active passage at the next horizontal position.
2. The invocation's result develops in place. The command/request remains associated with its result.
3. Further tools append to that passage; preceding actions remain present.
4. Emitted reasoning-summary/explanation or model response opens a prose interlude below, with quiet agent attribution.
5. The next tool activity begins in a new passage underneath.

This is a presentation rule, not a claim that every harness exposes an identical reasoning cycle. An absence of text does not mean the model was not thinking. Do not create a fake thought boundary. Native groups and actual ordering remain inspectable. Late results update their existing operation, without jumping down into the wrong passage.

Parallel calls share a group indicator when the source establishes the relationship. Arrival order is not used to claim execution order. Interleaved agents have attributed passages on one time axis; selecting an agent emphasizes its passages. A grouped narrative never invents communication between agents.

Prose interludes distinguish emitted reasoning summaries from user-facing replies with a quiet label, not different enclosing boxes. Text already captured appears in complete readable phrases/paragraphs; only genuine live text deltas stream. Do not type out previously recorded words as a visual effect.

## 4. Retention and overlap, precisely

**Overlap is a memory cue.** It should feel as though work is accumulating on a desk, while the current object has clear reading priority.

- The newest operation opens at useful reading width. Previous operations can settle into shorter previews with their title, outcome and a meaningful excerpt intact.
- Surfaces may overlap **outer scrim margins or deliberately collapsed preview regions**, never the active operation's essential text or controls.
- Each earlier object retains a visible title/grip and at least one usable preview line. Selecting it brings it forward and pauses automatic advancement.
- The foreground object does not erase previous objects. Selecting another restores the composition without moving the user's vertical history position.
- Start with at most three simultaneously readable operations per passage at wide desktop sizes. A fourth continues the passage on a wrapped row or in an explicitly counted expandable group. It must not force 9 px code or endless horizontal scrolling.
- At narrower desktop widths, reduce to two readable operations. On mobile, stack them with a small stagger; source readability wins over overlap.
- Pinning two operations opens an aligned comparison within the same history context; unpinning restores their original positions.

The original six moments should remain discoverable together as a sequence. “Remain on screen” means remain in the scrollable composition, not hold an unlimited session in the visible viewport or DOM. Older passages virtualize while preserving measured space, anchors and retrieval. No event disappears from navigation simply because it left the GPU/DOM working set.

## 5. Tool-origin choreography

### Native file read

The relevant repository node brightens. The Read label in the tool dock receives a short emphasis. A restrained source tether establishes the file's origin; its material settles into the next passage position. The text is not scaled or stretched. These gestures have distinct meanings: dock = tool used; map = source location.

### MCP invocation

The named server in the right dock opens enough to show the selected tool. A small operation surface emerges from that label and moves inward to its allocated passage position. During the first 80–140 ms, the dock origin is emphasized; over approximately 220–360 ms, a lightweight shell reaches the destination. Content is laid out at final size and revealed without distortion.

The shell initially accommodates the arguments. The returned content expands that same surface to a measured, bounded reading size. Do not fly a second generic result card from nowhere. An unresolved request keeps its identity and shows a quiet running mark; failure resolves the same object.

Use the real currently visible dock element as the screen-space origin. If the server is inside a collapsed overflow group, animate from that group's actual anchor and name the server. If unknown, use a neutral external-tool origin. No fabricated MCP association.

### Prose arrival

The completed passage settles into its retained layout. A soft dimming beneath it prepares readable space. Agent attribution and the actual explanation appear on the shared canvas; no enclosing panel animates in. The following passage begins after a deliberate typographic gap. This vertical transition is the visual punctuation of the product.

### User inspection

Selecting an older operation raises it within its existing passage. Deliberate scrolling, selecting source or following a map relation leaves live follow. Incoming capture continues and only the live indicator changes. Return to live is explicit. No camera chase or automatic scroll while the user is reading.

Motion-off uses the same topology, labels and retained objects with instantaneous state changes. The design must remain recognizable with every effect disabled.

## 6. Interaction contract

The central history scroll moves through passages and prose. Scroll inside a deliberately expanded source/output viewer moves that content; scrolling never unexpectedly seeks a different moment. Playback adds/reveals events at its cursor. Scrubbing backward hides later presentation from the replay cursor while retaining it in the recording; forward seeking restores it without manufacturing events.

The map can be explored by selecting an exposed node or entering Explore. Explore suppresses automatic history follow, dims rather than destroys the work, and offers Back to work. Selecting a node opens related captured activity or explicitly current structural information. Escape returns to the previous selection/scroll position.

MCP server labels filter/highlight their recorded operations and reveal observed tool names. They are observation/navigation controls, never buttons to run a tool. Agent labels behave similarly. Announce filter state and provide an obvious reset.

On overload, keep the visible chronology coherent: group repeated reads and show all critical events as individually retrievable marks. Do not claim every operation was given readable screen time. The user should see the backlog and decide whether to catch up or inspect.

## 7. Implementation implications

Replace a single swapping `currentArtifact` with a virtualized sequence of passage/prose blocks. Each block has stable identity, operation order, measured height, compact/expanded state, current agent attribution and a playback visibility boundary. Selected or streaming blocks are not recycled until safe.

Compute responsive passage layout before animation. Use measured target rectangles and DOM transforms for source-to-destination shell movement; a separate overlay draws tethers. Actual source text stays in ordinary DOM editors. Reserve space before streaming output expansion to avoid repeated page jumps; preserve the reader's anchor when historical block heights change.

A bounded material cache supports the visible passage plus nearby history. Old preview snippets remain lightweight; full outputs load on demand. Separate event collection, playback cursor, history scroll position and map camera. Neither a filter nor a graph pan changes captured evidence.

The storyboard demonstrates accumulation, overlap, open prose, right-dock origins and map interaction using synthetic data. It does not implement real collection, full history virtualization or production resource gates.

## 8. Acceptance criteria

1. After six or more steps, earlier actions and agent prose coexist in a navigable vertical history; they were not replaced by a single central panel.
2. Tool actions arrive left to right within a passage; emitted prose appears beneath before the next passage.
3. Prose has no bubble/card/rectangle. Tool surfaces are content-shaped and background treatment serves readability.
4. MCP-origin animation is traceable to the named server on the right; file-origin emphasis is traceable to the map.
5. Earlier overlapped actions remain identifiable and selectable; expansion never hides the active reading region.
6. Agent navigation, tool navigation and map exploration work while preserving history context.
7. Keyboard users can reach every operation and expand it; DOM reading order matches the presented history. No essential controls are hover-only.
8. Reduced motion, narrow widths, long output, late results and multiple agents preserve the same information.
9. Maximum detail remains available, while live bursts can group without claiming unavailable internal reasoning.
10. The design is evaluated during actual reading and return-to-history, not just an opening animation.
