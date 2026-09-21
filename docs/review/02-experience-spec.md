# Drishya: experience, graphics and motion specification

21 September 2026 · Revised to the user’s continuous-canvas direction

The interface should feel like operating a carefully edited, interactive account of real work. Its objects are source regions, diffs, results and relationships. A user can stop on any object, select its contents, and change direction immediately. This document refines the [motion catalog](../reference/02-motion-catalog.md); the corrections here take precedence over choreography that implies unobserved causality or makes content harder to read.

> **Latest design decision:** [Continuous canvas](../reference/04-continuous-canvas.md) is the authoritative spatial/motion specification. Tool actions accumulate left to right; actual agent prose appears unboxed beneath them; subsequent action passages continue down the same history. Agents belong at the top, tool/MCP origins on the right, and the interactive repo map behind. The original replacing-panel storyboard was a first probe and is superseded.

## 1. Art direction: a quiet instrument

Borrow the restraint, focus and material hierarchy of premium game menus rather than their fictional machinery. Borrow match cuts and continuity from film editing, precise navigation from an editing suite, and spatial persistence from maps. Do not reproduce game artwork, typography assets or UI layouts.

The scene has a deep ink base, restrained warm highlights and an architectural map that recedes around readable text. No permanent dashboard card grid, neon everywhere, fake scanning text, decorative counters or perpetual particle field. Negative space is useful only where it makes the active material easier to locate.

| Inspiration | Principle to use | Concrete implementation |
|---|---|---|
| Modern game menus | One strong focal subject; context remains around it | Active source surface, background map dimming, minimal transport |
| Film match cuts | Preserve an object's identity across transitions | Same file header, source anchor and selected line survive read → edit |
| Editing suites | Time is directly navigable | Scrub, marks, step, speed, selection, jump to edit/failure |
| Architectural maps | Stable places and meaningful routes | Persistent file/module locations, typed relationships, local drill-down |
| Debuggers | State belongs to a specific moment | Event-time file version, execution status, explicit stale checks |
| Scientific instruments | Measured facts remain distinguishable from interpretation | Source labels, capture gaps, relationship explanations |

Proposed tokens, to validate in the actual renderer: base `#0B1013`, reading surface `#11191E`, primary text `#EDF0EB`, secondary text `#B4BDBB`, active accent `#D7B77A`, captured-read accent `#89BFC1`, additions `#A8CFA7`, removals/failure `#EF9290`. These are starting colors, not a contrast certification. Agent identity uses compact labeled marks and distinct shapes; action/status color is a separate channel.

Use Inter and JetBrains Mono, self-hosted with their license notices. Main UI 14–16 px; source 14–16 px with 1.5 line height; secondary labels at least 12 px. Review mode can become denser by showing fewer decorations, never by shrinking source to 9 px. Meaningful text should not inherit half-opacity from a demoted scene.

## 2. The default composition

**An accumulating work canvas, with one selected reading focus.** Source, searches, commands and external results enter from left to right within an action passage. Earlier operations remain in the passage with restrained overlap. The agent's emitted explanation or response flows below as ordinary readable prose, without a card or chat bubble. Further tools start the next passage underneath.

At desktop sizes, agent identities occupy a stable top rail; an interactive repository map sits behind the history; native tools and MCP server names occupy a quiet right dock; playback stays discoverable below. Content width follows the material, not an equal-sized card grid. A file read carries actual source, a search carries matched excerpts, and a tool result grows from its invocation.

An MCP action originates visually at its named server in the right dock, travels inward as a lightweight shell, and unfolds to the required bounded reading space. A file-origin tether and tool-origin motion are different semantic cues. Actual text appears at final readable size.

Overlap applies to scrim margins and compact preview regions. Active source and controls remain unobstructed. Earlier titles and excerpts stay exposed; selecting one brings it forward, pauses advancement and preserves the user's vertical position. After roughly three readable items, continue/wrap the passage rather than making code tiny.

At narrower desktop widths show two readable items per passage; on mobile stack with a small stagger. Earlier history is virtualized with stable scroll anchors, not removed from the recording. See [the full continuous-canvas specification](../reference/04-continuous-canvas.md) for layout, choreography and acceptance criteria.

## 3. One scene, three useful modes

| Mode | Primary question | Default behavior |
|---|---|---|
| **Watch** | What is happening now? | Follow live, group bursts, preview salient material, show lag and capture health |
| **Review** | What changed, and what evidence surrounds it? | Enter on changed files/hunks; move edit to edit; include checks and uncertainty |
| **Explore** | How does this work fit into the system? | User-directed map navigation; event overlay remains available |

Pause and replay speed are transport states within these modes, not additional product sections. Retain Calm/Operator/Inspector as advanced presets only if testing demonstrates a need; five overlapping lenses should not be the initial onboarding decision.

**Detail default: maximum available evidence.** This controls what can be expanded and whether metadata is retained. **Stage density default: accumulating.** Up to three retained operations per passage, with one selected reading focus and unboxed prose below. These choices are compatible: full information does not require simultaneous display.

## 4. The signature sequence, frame by frame

Use a clearly labeled fixture: a checkout handler incorrectly treats a zero total as missing. Source shows `if (!total)`; the patch changes it to `if (total == null)`. The captured test initially fails for a free order, then passes after the edit. No inference is needed to show the bytes; an explicit rationale is included only if the fixture actually contains one.

| Scene | What appears | Motion | Interaction and meaning |
|---|---|---|---|
| 1. Orient | Checkout → pricing relation and a selected file | Quiet emphasis at source node, no camera flight | Learn where the material belongs |
| 2. Read | Actual captured source range, path, revision/availability label | Surface frame lifts from its node in 260–360 ms; text arrives whole | Scroll/select source; outside-range content is separately labeled |
| 3. Inspect failure | Test name and expected/actual assertion | Source holds position; result opens beside it | User can see the discrepancy rather than a red count |
| 4. Change | Removed and added code in stable alignment | Matched lines remain; changed region gets a short emphasis | Clear before/after state with no disappearing deletions |
| 5. Check | Captured rerun result with command and time | Outcome changes once; no counting animation | Passing check linked to its observed workspace/version evidence |
| 6. Rewind | Same source region before the edit | Immediate seek, restrained continuity highlight | Historic bytes are loaded; no fake reverse typing |
| 7. Return | Current activity plus unreviewed interval | Explicit Return to live action | Collection has continued throughout inspection |

At any frame, selecting the hunk can open a left-to-right evidence path. The default canvas already accumulates actions and prose; this optional evidence path adds an explicit relation view without replacing that history. The UI must also work when the explanation is unavailable: leave a labeled gap, not a generated bridge.

## 5. Motion grammar with truthful semantics

### Lift: location

Origin emphasis at 0–80 ms; frame translation/unfold at 50–260 ms; text appears at final size at 180–300 ms. A static, restrained tether remains while origin context is useful. Content must be selectable immediately; it never waits for a transition.

Compute the screen-space origin from the map camera. Animate a separate surface shell; do not scale a source editor. If origin is outside the viewport, use an edge locator. If the map is disabled, emphasize the source breadcrumb instead. If origin is unknown, simply reveal at the stage anchor.

### Trace: an explicitly typed relationship

A repository dependency, agent access event and temporal association are different relationships. Do not draw an agent read as though execution flowed along an import. Use a subtle structural edge for imports; a transient labeled access path from agent to file; a dotted connection for nearby activity. The detail view explains why each edge exists.

### Hold: the user is reading

Selecting text, clicking a source range, focusing a control, pinning material or deliberately scrolling content enters inspection. The current surface stops advancing. Pointer movement alone does not trigger cancellation. Incoming events update only the compact live indicator and queue markers.

### Resolve: a recorded outcome

The tool's status resolves once. Failure and success change the result mark, not the entire repository. A failed assertion highlights the test location if known. Do not animate a bug travelling to a source function unless captured evidence establishes that location; even then, a traceback is a reference, not proof of root cause.

### Settle: continuity without obstruction

When following live, prior operations settle into retained previews in their passage; they do not disappear as soon as the next tool arrives. Keep their source, outcome and a useful excerpt readable. Use restrained overlap only in safe margins. Offscreen passages may virtualize while retaining stable history positions. Pinning/selection pauses automatic advancement while collection continues.

**Defaults:** immediate feedback within 100 ms; ordinary motion 160–280 ms; Lift up to 360 ms; explicit scene transition up to 500 ms. No repeating attention effects. Use one orchestration clock, not unrelated timers. Disable camera motion during automatic follow. These are design targets to test, not performance measurements.

## 6. Presentation by action

| Action | Content on stage | Useful visual behavior | Drill-down |
|---|---|---|---|
| Read | Captured lines and returned range | Source location highlights; material lifts intact | Complete captured range; optional current file in a separately labeled view |
| Search | Query, matched contexts and paths | Hits emphasize relevant locations; selection narrows to one | Each returned excerpt; full captured result when available |
| Edit | Before/after hunk, application status | Preserve line alignment; emphasize changed interval | Event-time versions, intervening changes, base mismatch |
| Shell | Command, working directory, output, exit status | Output appears at actual captured chunk boundaries in live mode | Paged output; no terminal escape execution |
| Test | Actual assertion, counts and scope | Failed assertion takes focus only while following | Raw result, parser basis, source/version association |
| Plan | Captured current step and neighbors | Checklist changes in place | Entire captured plan with history |
| Explanation | Emitted agent text, explicitly labeled | Quiet prose with stable wrapping | Complete exposed text; absence remains explicit |
| External/MCP | Qualified tool name, inputs, results | External boundary indicator; renderer selected by safe content type | Captured text/table/image; never execute returned HTML |
| Subagent | Identity, captured delegation and status | Add a lane; no forced spotlight transfer | Agent-filtered history and actual parent links |
| Approval | Pending/denied/allowed plus where to respond | Hold only that agent's lane | Read-only input and recorded outcome |
| Compaction | Marker and captured summary if available | Add timeline landmark | Earlier history remains navigable |
| Unknown/gap | What is available and what is missing | Neutral explicit state | Sanitized metadata and recovery options |

Remove simulated typing of already captured commands, search queries, test counts and code. Small emphasis can distinguish new information without pretending to reproduce an agent's reading order or private thought process.

## 7. Replay and live pacing

There are three clocks: **source time** (when the harness says it happened), **capture time** (when Drishya received it), and **playback position** (what the user is viewing). Keep them distinct in state and in debug tools. The visible UI can say “Live”, “12 events behind”, or “Reviewing 14:32:08”; it need not expose implementation jargon.

**Watch:** brief previews and grouped bursts. Dwell is not enough to read a file; it helps identify what to inspect. Start with simple rules before a mathematically elaborate governor: new edit/failure outranks repeated reads; minimum preview around 0.8 seconds; maximum automatic hold around 3 seconds; repeated activity groups; sustained bursts become a clearly counted summary.

**Inspect:** no catch-up and no auto-jump. Capture continues. Users can spend ten minutes on one hunk.

**Replay:** play/pause, 0.5×/1×/2×/4×/8×, next/previous event, next edit/failure, draggable scrubber and bookmarks. Long idle gaps can compress with an explicit duration marker. Speed changes temporal spacing; it never forces the user to read text before it becomes selectable.

**Critical bursts:** show “18 edits · 2 failures”, mark all of them individually on expanded timeline lanes and keep each discoverable through navigation. A critical event can be acknowledged by a grouped marker without having had its own readable stage moment. Those are separate metrics. Do not claim both individual dwell for all critical events and bounded live delay under arbitrary input rate.

**Scroll contract:** the default central canvas scrolls through accumulated passages and prose. Deliberately expanded source/output scrolls locally. Playback and scrub controls change the replay cursor. Manual history scroll leaves automatic follow; incoming data updates the live indicator without moving the reader.

Keyboard: Space play/pause except inside editable fields; arrows step when transport is focused; Shift+arrows jump edits; a discoverable failure action; Escape closes one level. Shortcut labels should match platform conventions. All actions have visible controls as well.

## 8. The repository map

The map is a progressively built, stable orientation surface. Start at file/import level. Group by observed relationships; use package/directory boundaries only as an explicitly labeled fallback. A spatial layout is not evidence of architectural importance by itself.

Default view includes the active file, its relevant immediate relationships and surrounding module context. The whole repository exists as a coarse silhouette, not thousands of readable nodes. Zoom reveals modules, files and then supported symbols. Search can locate a file without requiring map navigation.

Use separate edge types for imports, resolved calls, framework references, test references and observed agent access. Label potentially affected dependents as static reachability. A route through a dependency graph is a possible structural path, not proof that a request executed it. Unknown dynamic dispatch must remain unknown.

Preserve coordinates for unchanged nodes. Offer a user-invoked rearrange command after major structural changes. During replay, use the graph version available for that interval; otherwise label a current-map overlay. A newly added file must not appear to have existed throughout old history.

When the map is disabled, use a static quiet background and a source breadcrumb. Custom local still images can come later. Animated backgrounds compete with the product's motion language and should remain off by default.

## 9. Multi-agent default

One focused agent or selected change; other active agents remain visible as labeled status marks and timeline lanes. The initial session is followed until the user chooses something else. A captured parent-child link appears as an optional branch, not a permanent web of glowing lines.

If two agents write the same file in one worktree, show the overlap and timestamps. If they only read it, show shared attention. If they work in different worktrees, separate the state explicitly. Never let a shared filename imply identical bytes.

When a background agent encounters an error, add a persistent failure marker and compact notice. Auto-focus is allowed only while the user has explicitly chosen follow mode; it cannot interrupt selection, reading or comparison.

## 10. Settings without a cockpit

Initial settings show three groups: Appearance, Playback and Privacy/storage. Advanced controls expand progressively.

| Setting | Default | Lower-cost/accessibility behavior |
|---|---|---|
| Quality | Balanced | Efficient uses static graph and opaque reading scrims |
| Motion | Follow OS preference | Reduced removes movement; Off changes state immediately |
| Graph | On, local focus | Off retains breadcrumbs and complete review |
| Detail | Maximum available | Controls available detail, never fabricates missing data |
| Stage density | Retained action passages, up to three readable operations | Selecting an older surface brings it forward; prose remains unboxed below |
| Frame cap | 60 foreground | 30 Efficient; stop drawing when hidden |
| Render scale | Capped device scale | Lower graph resolution; source remains native resolution |
| Sound | Off | No audio required to understand state |
| Hot artifacts | Byte budget first | Approximately ten neighboring turns only if they fit |
| Privacy | Local, selected roots, redaction enabled | Content exclusions and purge/export inspection |

Do not expose a browser “GPU on/off” toggle that cannot actually control hardware acceleration. Offer graph rendering modes and a graph-off fallback. Do not promise a strict total browser-memory ceiling from a JavaScript cache setting.

## 11. Empty, broken and unavailable states

The quality of these states is part of the premium experience:

- First launch offers a bundled synthetic replay immediately, then local session selection. No mandatory indexing wait.
- An empty session says “Waiting for events from this session”, with the selected source and last scan time.
- A missing historical file says “Only lines 40–90 were captured”. Offer the present-day file separately, never substitute it silently.
- A disconnected adapter says “Capture disconnected; replay remains available”. Distinguish no activity from lost capture.
- Disk full pauses persistence, records the gap when possible and directs the user to free space or retention settings. It never blocks the coding agent.
- No GPU gives a complete Reader and timeline. The map can become a simple DOM/SVG local path or switch off; do not rely on an unverified renderer fallback.
- Unknown actions show a safe generic tool/result presentation. They should not disappear just because the catalog lacks a bespoke visual.

## 12. Experience acceptance gates

The accumulating-history, dock-origin and open-prose gates in [continuous canvas §8](../reference/04-continuous-canvas.md#8-acceptance-criteria) apply in addition to these correctness/readability checks.

1. A user can select/copy source while incoming events arrive without losing selection.
2. One action leads from a hunk to related evidence; the basis of the link is visible.
3. Backward seek loads correct captured content or an explicit gap.
4. The user can always tell whether they are live, paused or behind.
5. Text contrast meets the chosen accessibility target across actual backgrounds; screen-reader landmarks and all playback actions work without the map.
6. Reduced-motion and graph-off modes preserve all review answers.
7. A burst of 100 critical events creates counted, individually retrievable marks, not flashing unreadable cards.
8. The same sequence is legible at 1440 × 900, 1024 × 768 and 200% browser zoom.
9. No animation implies a hidden decision, runtime path, test coverage or root cause unsupported by the record.
10. A ten-minute use session feels calm. The evaluation includes real reading and interruption, not only watching the opening transition.

The review should compare screen recordings of the same fixture at ordinary speed, with motion off, during scrubbing and under overload. If an animation makes the answer harder to see, shorten or remove it even if it looks impressive alone.
