# VANTAGE — Base Prompt for the Design and Build Agent

Version 1.1 · September 2026 · Working name: **Vantage** (not yet cleared as a brand)

---

## 0. How to read and use this prompt

You are the agent that will help me design and build Vantage. Read this entire prompt before you respond. It is long on purpose: it carries the idea, the decisions already made, the visual direction, the constraints, the research so far, and the order of work I want.

**Terms used throughout**

- **Builder**: me, the human you are working with.
- **Observed agents**: the coding agents whose work Vantage visualizes (Claude Code and Codex first, more later).
- **You**: the agent reading this prompt.
- **Vantage vocabulary** (from an earlier draft, kept because it is useful):
  - **Terrain**: the ambient repository and pipeline graph in the background.
  - **Run**: one session or task from one or more observed agents.
  - **Pulse**: one meaningful event (a read, a search, a command, a decision, an edit, a test, a handoff, a failure).
  - **Focus**: the object currently enlarged on screen (a file region, a diff, a command output, a plan).
  - **Row**: a group of actions the agent took without stopping to think or write, followed by the thinking or text that ends the row (see Section 2.2).
  - **Reader**: a clean viewer docked at the right side of the screen where the user can read a whole file or a whole output in place, instead of opening a new window or tab.
  - **Rail**: the scrollable, replayable sequence of Pulses.
  - **Lens**: the chosen presentation mode (for example Calm, Operator, Inspector, Replay, Review).

**How I want you to work**

1. Do not re-argue whether the idea is feasible or novel. That has been examined and the conclusions are in this prompt. Spend your effort on design, decisions and building.
2. Verify the facts you rely on by reading sources or running tools. Label every important claim as **verified**, **derived**, or **assumed**. My own statements about competitors (Section 11) are my assessment, not verified facts. Testing them is part of your first task.
3. Be specific and opinionated. Give reasoning and trade-offs, pick defaults, and tell me plainly when something I asked for conflicts with something else or will not work. Do not comply silently.
4. Follow the order in Section 14 and stop at the checkpoints.
5. Do not invent capabilities of any harness. If a harness does not expose something, say so and design around it.

---

## 1. The idea, in my words (cleaned up)

When coding agents work today, in Claude Code, Codex, Cursor, OpenCode, Aider, Cline and others, I mostly see text scrolling in a terminal or a chat panel. I cannot easily see which file the agent is looking at right now, why it chose that file, what a tool returned, what it changed, or how the parts of the repository connect. Most people prompt, look away until the final answer, and then either trust it or review a diff afterward.

I want to change that. A user should be able to watch an agent work, understand what it is doing and why, see the actual files, tool outputs and edits as they happen, and come back to any earlier moment. The agents keep running inside their own harness. Vantage sits beside them, on the user's own machine, and turns their work into a visual experience.

The concept in one sentence:

> **A local, cinematic workspace that shows coding agents working, live or replayed. The repository and pipeline graph sits in the background, and each turn plays out as real content (what the agent read, ran, decided and edited). You can scroll back through it, across the harnesses people already use.**

The main thing I am relying on you for is **the visualization**: how it looks, how it moves, how it is paced, and how it is built so that it stays smooth. I do not have much experience with graphics, motion design or frontend work, but I can picture what I want. Think of it as a "Jarvis" that puts up its own working on screen. It should not be boxes of text such as "model thinking: …", "tool call: …", "output: …", "code edit: …". Visualization is the product.

---

## 2. The experience I am picturing

### 2.1 The background: the Terrain

- A graph of the whole repository sits behind everything, dark and quiet by default, with only the active path illuminated.
- It is organized by **pipeline and connections, not by folders**: what connects to what, how work flows through the system. Zooming in takes you from the pipeline to modules to individual files and what each one does.
- Databases appear as **references** (models, migrations, known query sites), not as live data. See Section 4.
- If the graph is turned off, something else plays in the background instead. The user can choose an alternative, for example a blurred topology, a clean void, a generative field, or an image they supply. The background is user-editable.
- Huge repositories must be handled gracefully (Sections 7 and 9).

### 2.2 The foreground: turns as scenes

The work is a sequence of turns. In each turn the observed agent calls something (a tool, a bash command, a file read, a search) and something comes back. I want this shown as a flowing, readable sequence, not a log.

**The row rule (my mental model, refine it)**

- Actions the agent takes **without stopping to think or write anything in between** belong together in one row, whether they run in parallel (several reads or searches at once) or sequentially (one after another). Where the data allows, show which it was.
- As soon as the model produces **thinking or text**, a **new row** begins. That thought or message becomes its own moment, tied to the actions before it and after it.
- A run therefore reads like: a group of actions → the thought that followed → the next group of actions → the next thought, with each row mapped to the section of the system it touched.

**How a group of actions arrives**

- When three or four things have been done, they should come up and **attach to the agent** in a distinctive, tasteful way, and not just as plain connecting lines (which is the basic option). I do not have a specific effect in mind, so this is a design task for you. They also reveal **which section of the Terrain** they belong to.
- Two turns may sit side by side so the user can see what just happened next to what came before. Whether that is the right layout is your call.
- The thinking or message that follows is shown next, then the next group.

**Real content, not names.** If the agent reads a file, I see the relevant region. If a command runs, I see the command and its real output. If it edits, I see the diff. When a tool output comes back it drives dynamic visuals, for example the affected part of the graph lights up.

**Coming back.** The user must be able to come back to earlier moments at any time and then return to the live edge. **How** navigation works (horizontal, vertical or a hybrid; scroll, drag, keyboard, scrubbing) is **not decided**. My original picture was left to right within a turn and scrolling through history, but it is only a picture. Choose what works best.

### 2.2b "Zoom in" means drill-down at the same place, not a camera zoom

When I say zoom in, I do **not** mean a literal camera zoom into the graph (the Terrain may support that as well). I mean the developer can go deeper into what an action did **without leaving the scene and without opening something new**:

- **Search:** a small dynamic window appears, the query types out as if being entered, and the results appear cleanly below it. All the text is readable. Results carry links, and following one takes the user to that spot in the Reader.
- **Reading a section:** the section is shown. An option lets the user read the **whole file**, which opens the clean Reader docked at the **right side** instead of a new window or tab. The region the agent read stays highlighted inside it.
- **Editing:** the diff is shown in place. The user can open the full file in the Reader with the changed regions marked.
- **Running a command:** the command types out, output streams in, and the exit status is clear. Long output can be expanded fully in the Reader.
- **Anything else the agent does** follows the same rule: show the essential part first, and let the user expand to everything, in place, using one consistent docked Reader.

The principle: the developer gets everything they need at its place, and the screen stays uncluttered until they ask for more.

### 2.3 The feel

- The reference feeling is **a really well-edited promo video for a software product**: things appear, change, merge and dissolve with purpose, like the panels in a video editor.
- The UI reference is **Black Myth: Wukong**: clean, modern, transparent and restrained. Only what is needed comes up, elements are the right size for their job, and nothing takes over the screen without a reason. It should feel like a transparent layer over the world, not a dashboard or a wall of cards. I am deliberately **not** using God of War as a reference: its UI is good but not great.
- **No permanent boxes.** Information appears as **ephemeral translucent surfaces** that emerge when relevant and dissolve when their moment has passed. Text always sits on a dimmed background so it stays readable over the moving Terrain.
- One focal point at a time. If a command matters, its output takes the stage. If an edit matters, the diff does. Everything else recedes into quiet context.
- Motion must mean something: a file read sends a trace through what it connects to, a passing test closes a loop, a failure marks where the flow broke, a handoff travels to the receiving agent.

### 2.4 Agents and tools on screen

- Several agents can be active at once. I do not want big separated boxes per agent.
- **Default layout (decided in this prompt, from the options I listed):** one shared Terrain. Each *active* agent is a distinct, calm presence with its own color and visible path. Inactive agents collapse into a small roster at the edge. A split view, with the screen divided into parts or selectable boxes, is an optional toggle for comparing agents or investigating collisions. Agents touching the same file should produce a gentle conflict signal, not a loud alert.
- Tools live in one place, at a corner of the screen, and appear on demand. Pinning is explicit.

### 2.5 Other things I want visible

- **Goals and plans**: the current objective and plan checkpoints.
- **What it retrieved**: the evidence the agent used for its next action.
- **Real-time git diff**: changes shown as they happen.
- **A conversation view**: **read-only**. Vantage is not a place to type prompts (see Section 4). This view shows the messages of the observed session, so the user can navigate conversation-wise or turn-wise as they like.
- **Transcript detail levels**: I want maximum detail by default (every captured read, search, tool result, message and edit) with lower levels available. Claude Code's transcript already offers detailed and minimal modes, so adapt to that. Higher levels group repetitive mechanics, and the lowest keeps goals, changes, validation, decisions and exceptions. Grouping must never delete provenance: a stack of repeated reads can be opened to inspect every source range and result.

### 2.6 Settings, designed like a game and a studio tool

I want this to feel like the settings of a high-end game and a video editor, because performance is part of the promise. At minimum:

- Terrain on or off, semantic depth, edge density, minimap, database-reference layer, alternative background.
- Animations: full, reduced, off, and toggles for specific animations (event trails, camera easing, focus transitions, particles, glow).
- Render quality profiles (Efficient, Balanced, Cinematic), render scale, frame-rate cap, GPU acceleration.
- Evidence density (Maximum Evidence, Standard, Executive).
- Memory: a recent-turn window (default around 10 turns kept in RAM), pinned artifacts, disk replay cache, automatic compaction.
- Privacy and redaction controls, alerts, and accessibility (reduced motion, high contrast, font scale, keyboard playback, screen-reader timeline).

You should extend this with inspiration from other places where users tune fidelity: game graphics menus, video-editor preview quality, terminal and IDE settings, and so on.

### 2.7 Your role: professional frontend developer and product designer

I am not a professional in design or UI, and I do not know what is possible and what is not. What I have given you is a **vision and a set of concepts, not a specification**. I want you to act as a **professional frontend developer and product designer** who makes this user-friendly and looks like a premium, professional website or product.

- **Decision authority is yours** for the layout, the scrolling and navigation model, how groups of actions appear, how rows and turns are arranged, the animation style, the typography and color system, and the components. Decide, justify, and tell me what you chose and what you rejected. Push back if something I described is a bad idea.
- **What is fixed:** the concept (Section 1), the decisions (Section 4), the ability to come back to earlier moments and return to live, drill-down in place (Section 2.2b), the row rule as a starting model, a clean, transparent, Black Myth: Wukong-style UI, the performance settings, and honest captured-versus-derived content.
- **For each different thing an agent can do, design a proper presentation with its own animation and graphics**, at the level of a professional site. Deliver this as a **Presentation and Motion Catalog**: for each action type, what it shows, how it appears, how it animates, what happens on drill-down, and how it degrades in Efficient and reduced-motion modes. Cover at least these action types: file read, search (text, file and semantic), file edit or write, bash command, test run, git operation, plan or to-do update, thinking or reasoning text, assistant message, web search or fetch, MCP or external tool call, subagent start or handoff, permission or approval prompt, error and retry, context compaction, and screenshot or image.

---

## 3. Why anyone would need this (the part that has to be earned)

The goal is not a prettier log. It has to create a felt need: once you have seen your agent's work this way, going back to text feels like driving blind. That need must be demonstrated, not claimed. It rests on four moments:

1. **I can see what the agent is doing without reading.** A glance tells me where in the system it is, what it read, and what it just changed.
2. **I catch a wrong turn early.** For example the agent wanders into a part of the system the task shouldn't touch, and the Terrain makes that visible immediately. Vantage only observes, so I act by correcting the agent in its own harness.
3. **I understand why a diff exists faster than with a transcript.** The edit shows up together with the reads, the failing test and the decision that led to it.
4. **I can replay a run to review, teach or document it.** Scroll back and the map and the content move together.

Three properties are what I believe make Vantage different, and they are harder to copy than visual polish:

- **Real content per turn, synced to a timeline**: the source, the diff, the command output and the decision, not just labels on nodes.
- **The repository as a pipeline map**, not only a graph of the agent's own execution.
- **Replay that moves the map and the content together.**

Visual polish, motion and graphics are the layer that makes those three feel unlike anything else. I want to move quickly and be the first to do this at this depth before someone else picks it up, but I do not want you to rely on "nobody has done this". Section 11 shows that parts of it exist, and the differentiation has to hold up against them.

---

## 4. Decisions already made

| Topic | Decision |
| --- | --- |
| Control vs observation | **Observability only.** Vantage does not control agents. Controlling would make it a harness, which is hard and out of scope. Adapters are read-only by default. |
| Live vs replay | **Both.** Live updates as the agent works, and the user can scroll up to previous steps at any time. A "return to live" affordance appears only when reviewing history. |
| Database | **References only for now** (declared models, migrations, known query sites), not actual data. Live database integration may come later because of the security implications. |
| Target users | Anyone who uses coding agents and wants to see them work, and to get real understanding out of it, not only the fact of work. |
| Harnesses | Start with a few, expand one by one to the most widely used. The ambition is the majority of used harnesses, not just two. |
| Distribution | Leaning **open source** (and local-first). I think an open-source product can spread faster than a paid one. Licence and any commercial layer are open questions for you to weigh in on. |
| Name | **Vantage** as a working name. It needs trademark, domain and market-confusion checks before I commit. |
| Default layout | Shared Terrain with working agents shown (Section 2.4). |
| Visual reference | **Black Myth: Wukong**: clean, modern, transparent, only what is needed appears. Not God of War. |
| Navigation and scrolling | **Not decided; you choose.** Fixed requirements: come back to earlier moments, return to live, drill down in place (Section 2.2b). |
| Trust | Captured facts are always distinguished from generated explanations (Section 8.3). |

---

## 5. The pacing problem (the design problem I cannot solve alone)

Agents can act extremely fast. A run can produce dozens of reads, searches, commands and edits in a few seconds, in bursts. A person can absorb roughly one meaningful thing at a time. If Vantage shows events at real speed it is unreadable. If it queues them one by one it falls further and further behind. This is the design problem I cannot get on my own, so I need you to design it properly.

**What I have in mind**: the pacing should adapt dynamically, based on the amount of text and the importance of each event: a dynamic window, a time-on-screen per item, and newer items overlapping or replacing older ones once their moment has passed.

**Requirements the scheduler must satisfy**

1. **No information loss.** Everything captured stays reachable later on the Rail, even when it was compressed on screen.
2. **Bounded lag.** The live view never falls more than a configurable number of seconds behind the real agent, and it tells the user honestly when it is catching up (for example "N events queued").
3. **Priority.** Failures, edits, test results, decisions and user messages outrank searches, which outrank reads, which outrank minor mechanics.
4. **Dwell time.** Each Pulse stays on screen long enough to read, scaled by how much content it has, with a cap.
5. **Coalescing.** Bursts of similar low-value events collapse into one compact "beat" (a stack of reads, say) that can be expanded.
6. **Overlap.** Newer surfaces can layer over or replace older ones, which dissolve rather than vanish, while remaining recoverable.
7. **Catch-up behavior.** When the backlog passes a threshold, the system speeds up and compresses further, then relaxes.
8. **User modes.** For example Paced Live, Raw Live (fastest), Follow, and Paused-with-buffer.
9. **Interruptibility.** Any click or scrub cancels animations immediately. Nobody waits for a cinematic transition to finish.
10. **Determinism.** The same recording with the same settings always produces the same choreography, so it can be tested.

**What I want from you**: a scheduler design (event classifier → priority queue → scene composer with dwell and overlap rules), the tunable parameters, and a way to validate it by simulating recorded sessions (measure lag, compression ratio and a readability proxy). You may propose a different structure if you can justify it.

---

## 6. Playback and navigation (video-editor behavior)

The navigation model itself is your decision (Section 2.2), and scroll alone is not editing-suite behavior. I want at least:

- Play, pause, speed control (for example 0.5× to 8×), and scrubbing.
- Jump to the previous or next **edit**, **failure**, **test result**, **decision** or **handoff**.
- Selecting a Pulse freezes the scene at that moment. From there the user can expand it into source, output, diff, graph path, plan state and what happened afterwards.
- Per-agent filtering, and a compact minimap of the run showing where edits and failures happened.
- "Return to live" when reviewing history.
- Later: bookmarks and annotations, and exporting a replay bundle.

Scrubbing or selecting must change the Terrain and the Focus together. That linked movement is a core part of the product.

---

## 7. The Terrain: what it has to be and how to build it

### 7.1 Layers

| Layer | Examples | Construction |
| --- | --- | --- |
| Runtime and pipeline flow | route → service → queue → worker → external API | Entrypoint detection plus call-graph traversal (framework-specific first), optional runtime traces later |
| Code dependency | imports, calls, inheritance | Tree-sitter parsers, language servers for precision later |
| Data boundary (references only) | ORM models, migrations, SQL tables, known query sites | Static analysis of models, migrations, SQL literals and connection configs |
| Delivery | packages, containers, CI jobs | Build files, CI config, Docker files |
| Verification | tests, fixtures | Test discovery and execution events |
| Agent work | reads, searches, edits, tests, delegation | The normalized session event stream |

### 7.2 The hard part, stated plainly

A folder or call graph is easy. A **pipeline-first map** is the hardest, most novel piece of the product. My suggested approach, which you should challenge:

1. Start with the call graph.
2. Detect entrypoints for two or three frameworks first (for example FastAPI and Express). Static route analysis only works framework by framework.
3. Traverse from the entrypoints to build flows.
4. Where framework detection fails, fall back to community-detection clusters.
5. Label clusters once and cache the labels. Any LLM-generated label is **derived** and must be marked as derived.
6. Update incrementally as files change, keeping the layout stable so nodes do not jump because one file was read.

Database detection is static: it will cover common cases and miss dynamically built queries, and the product should say so.

### 7.3 Scale

- Never lay out the whole graph at full detail. Use a semantic overview: clusters and boundaries at distance, named services at medium zoom, symbols and edges only in close focus.
- Keep a disk index and hold only compressed graph representations in memory. Prioritize computation around active files, changed files, recently traversed paths and pinned systems.
- Precompute layouts in workers and reveal progressively.
- Provide alternatives when the graph is disabled (Section 2.1).

### 7.4 Something I can reuse

I have already built **SkeletonGraph**, a structural code-retrieval engine for coding agents (github.com/yashdoke7): Tree-sitter AST parsing and a call graph with PageRank centrality across ten languages, packaged as an MCP server with a hook layer. It may serve as the graph substrate for the Terrain. Evaluate how much to reuse. Its retrieval scores are also a real "why did the agent look at this file" signal that generic trace viewers do not have, which could power a decision view.

---

## 8. Data: how Vantage sees what agents do

### 8.1 Adapter strategy

Vantage must be harness-agnostic at the core. Each harness gets an **adapter** that converts whatever native session information is available into one shared, normalized event schema. The renderer must never know which harness an event came from.

**Capability levels (each adapter declares which it reaches)**

| Level | Data available | Resulting experience |
| --- | --- | --- |
| 0 Replay | An exported transcript or log after the session | Rich replay, not live |
| 1 Live events | Tool calls, messages, file operations, command output | Live timeline with real working context |
| 2 Structured state | Goals, plans, delegation, approvals, explicit rationale | High-quality decision and multi-agent view |
| 3 Deep integration | Streaming updates, state hooks, artifacts, runtime trace correlation | Full control-room experience |

**Capture mechanisms to evaluate**

- Claude Code hooks (pre and post tool use and other lifecycle events) and its local session transcripts (JSONL under the user's Claude directory).
- Codex local rollout logs (JSONL under the user's Codex sessions directory).
- A local proxy on the model API base URL, which sees every tool call and result without harness integration (works only for harnesses that allow the base URL to be overridden), combined with a file watcher or git diff for what actually changed on disk.
- OpenTelemetry-compatible events for custom and framework agents.
- Never mutate the original logs. Store provenance and hashes.

**Phases**

1. Claude Code and Codex.
2. Cursor, OpenCode, Aider, Cline and Roo Code, Gemini CLI, GitHub Copilot agent.
3. LangGraph, CrewAI, AutoGen, and custom emitters via OpenTelemetry.
4. IDE, CI, git-hosting and browser agents.

**You must verify, not assume:** the current on-disk formats and hook events of Claude Code and Codex. A newsletter report I saw says the Codex app merged into the new ChatGPT desktop app, so check whether Codex session files are still written where and how the existing tools expect.

### 8.2 Normalized event schema (starting point)

- **Identity**: run ID, agent ID, parent agent ID, harness, repository, branch, worktree.
- **Time and sequence**: timestamps, sequence number, streaming chunks, causal parent.
- **Event type**: goal, plan, message, tool request, tool result, file read, search, edit, command, test, handoff, approval.
- **Artifacts**: file URI and range, diff hunk, command, output reference, source snippet hash, screenshot, graph entities.
- **Meaning**: objective, evidence summary, rationale provenance, confidence, risk, a user-visible title.
- **System impact**: symbols, routes, database objects, APIs, queues, tests.
- **Privacy**: sensitivity label, redaction map, retention.
- **Resource telemetry**: duration, tokens when available, CPU, memory, disk, render cost.

### 8.3 The trust rule: captured vs derived

I want to show "how it is taking decisions" and not only final messages but **all the minor thinking as well**, so maximize what is legitimately available: the assistant text between tool calls, plan and to-do updates, explicit rationale, and thinking content where the harness exposes it. But Vantage must **never claim to show hidden reasoning it does not have**. Where a harness provides a plan, rationale or thinking field, display it with its provenance. Where it does not, build a concise explanation from observable actions and label it clearly as a visual summary. Some newer models reportedly obscure their chain of thought, so this rule will matter more over time. No adapter may fabricate content to fill a gap.

Derived summaries need a cost model. The default should be **heuristic titles built from observable facts** (for example "Read auth.py 40–90 after searching 'session'"). LLM-written summaries should be opt-in and batched per turn, because a per-Pulse LLM call adds latency and cost and would need credentials in a local-first product.

---

## 9. Performance, memory and numeric targets

### 9.1 Principles

- Performance is a product promise, not a later optimization. Efficient mode and reduced-motion mode must be designed states, not broken versions of Cinematic mode.
- Observing an agent must never be able to cause an out-of-memory failure or slow the harness. Capture is append-only and separate from the UI.

### 9.2 Memory model

| Tier | Purpose | Policy |
| --- | --- | --- |
| Hot memory | Current scene, latest tool results, nearby timeline | Rolling window of about 10 turns **plus a byte budget** (a single turn can carry megabytes of tool output) plus pinned artifacts |
| Warm cache | Compressed event index, graph slices, thumbnails, source references | Local disk, least-recently-used eviction |
| Cold replay store | Full normalized events and captured artifacts | Local session bundle with retention and export controls |
| Source of truth | Repository state and harness artifacts | Never mutated; provenance and hashes stored |

Heavy payloads (tool output, file contents, diffs) load lazily as a card approaches the viewport, with prefetch around it. Store blobs content-addressed so repeated reads of the same file are stored once. The Rail is virtualized. Only the focused item mounts a full code or diff editor, and it is disposed afterward.

### 9.3 Rendering rules

- GPU rendering (WebGL or canvas) for large graph geometry. Code, diffs and controls remain native, accessible UI.
- Never animate every node. Animate active paths, handoffs, results and explicit user transitions.
- Pause non-essential effects when the window loses focus, when battery saver is on, or when frame time exceeds budget.
- Automatically step down a quality tier when frame time or memory crosses a threshold.

### 9.4 Draft numeric targets (anchors for you to challenge and then measure)

I want numeric targets set and then verified with measurements. These are starting points only:

| Measure | Draft target |
| --- | --- |
| Repository size | Comfortable at ~5,000 files. Supported to ~50,000 files through cluster-level detail and an on-disk index. Beyond that, overview-first with progressive expansion. |
| Session length | Smooth at ~300 turns in the hot window. 5,000+ turns replayable from disk. Seeking to any turn under ~300 ms when cached and ~1 s when cold. |
| RAM (UI process) | About 1.5 GB or less in Balanced on a 16 GB laptop. About 600 MB or less in Efficient. |
| RAM (local daemon) | About 300 MB or less in normal operation. |
| Frame rate | Cinematic: 60 fps on a discrete GPU. Balanced: 30–60 fps on integrated graphics. Efficient: graph off, responsive at 30 fps or better. |
| Live latency | Event to visible in under ~250 ms before pacing is applied. |
| Indexing | A ~5,000-file repository indexed cold in under ~30 s, incremental updates in about a second. |

State which of these you would change and why, and how each will be measured on a real repository and a real long session.

---

## 10. Platform and technology: decide this with me

I do not know whether this should be a web app, a desktop app or something else, and the choice affects the graphics, the install experience and the scope. Evaluate the options and recommend one with reasons.

**Options**: (A) a local web app served on localhost plus a local daemon; (B) a Tauri desktop app; (C) an Electron app; (D) a VS Code extension webview.

**Constraints and considerations**

- It must be harness-agnostic, so not tied to one editor.
- Premium graphics and animation need GPU-accelerated rendering and control over the full screen.
- Local-first: nothing leaves the machine by default. Zero telemetry by default.
- Easy installation matters for open-source adoption (a one-line command, or a small installer).
- My leaning, which you should test and not just accept: start as a **localhost web app with a local daemon** for fast iteration and easy install, and wrap it in Tauri later if it is worth it. If you evaluate Tauri, note that on Linux it uses WebKitGTK, which is known to be weaker than Chromium for heavy canvas and WebGL work.

**Earlier stack thoughts from a previous draft, and the corrections that came out of review**

- Frontend: React and TypeScript. Local storage: SQLite with append-only event tables (WAL mode). Search: SQLite full-text search first, no vector index until measured.
- **Terrain renderer:** the earlier draft suggested Cytoscape.js. Review concluded that Cytoscape is a 2D diagram renderer and will not deliver the cinematic look, which is the differentiator. Use Cytoscape or graphology only for graph data and layout if at all, and render the Terrain in WebGL (for example Sigma.js, PixiJS or three.js) from the start.
- **Code and diff views:** Monaco is heavy on memory. Consider CodeMirror 6, or Monaco with a single instance for the focused item only, and static syntax highlighting elsewhere.
- **Daemon language:** TypeScript, Python or Rust. I am strongest in Python and can reuse my Tree-sitter engine, but choose with reasons.
- **Animation:** a motion library plus native CSS transforms, with a small set of easing curves and consistent timings (transitions short, around 400 ms or less, and always interruptible). Meaning comes from causality, not decoration.
- **State:** one declarative scene state. A Pulse selects a Focus, modifies the Terrain and adjusts the supporting utilities through a single scene composer. Build a scene composer, not a component dashboard.
- **Testing:** golden-session fixtures replayed deterministically, Playwright for UI journeys and visual regression, performance traces.

Because I lack graphics experience, I want you to prototype the look directly in the browser (HTML, CSS, JavaScript) instead of relying on design tools, so that I can see and react to real motion early.

---

## 11. What already exists (my research so far)

This section is here so you can search, learn from these tools and grow the idea. **My assessment**: they all show parts of what I want, but none does it with this visual depth, this clean and premium UI, or this real-content, pipeline-first, replayable experience, and none creates a strong need. **Treat this as a hypothesis to test in your first task.** Some facts below were verified by reading the READMEs; others I could not verify.

| Tool | Link | What it does (verified from its README or page) | What to learn or test |
| --- | --- | --- | --- |
| **Agent Flow** (closest) | https://github.com/patoles/agent-flow | Real-time interactive node graph of agent execution with tool calls, branching and return flows. Watches Claude Code (hooks) and Codex (rollout tailing) side by side. Multi-session tabs, pan/zoom/click canvas, timeline and transcript panels, file-attention heatmap, JSONL log replay. VS Code extension, a local web app, and `npx agent-flow-app`. Apache-2.0, roughly 990 stars and 111 forks, latest release v0.8.0 (Codex support, Apr 22, 2026), several open pull requests. The repo description still says Claude Code only. The npx build ships opt-out anonymous telemetry. | Its graph is of the agent's execution, not of the repository. **Test how much real content a click reveals**: full file regions, diffs and command output side by side, or mostly labels and metadata. Upstream looks slow-moving, but forks are active. |
| Agent Flow forks | https://github.com/DFearing/multi-agent-flow and https://github.com/patoles/agent-flow/pull/75 | A performance-focused fork with multi-window support and a render benchmark harness. An open PR (Sep 5, 2026) adds an "Office" mode with Sims-like avatars and rooms. | Shows how quickly others reskin this space, so polish alone is not a moat. |
| **Event Horizon** | https://github.com/HeytalePazguato/event-horizon | VS Code extension that renders agents as planets in a cosmic system. Works with Claude Code, OpenCode, Copilot and Cursor. Also builds a local project knowledge graph with agent-activity nodes linked to touched files. It also orchestrates agents (it is not observe-only). | The most visually ambitious existing tool and the nearest to a "not a dashboard" identity. Study how it handles readability. |
| **Karna** | https://github.com/shailesht003/karna-ai (PyPI: https://pypi.org/project/karna/) | Code knowledge graph exposed over MCP, mainly to save tokens. Includes a real-time 3D graph view with agent activity highlighted (`karna live .`, localhost:3849). Alpha, 0.1.0 (Apr 2026), Apache-2.0. | Closest on the graph plus live agent activity idea. The visualization is a side feature. |
| disler observability | https://github.com/disler/claude-code-hooks-multi-agent-observability | Claude Code hook scripts → HTTP → Bun server → SQLite → WebSocket → Vue client. Multi-agent event timeline. | A clean reference for the ingest pipeline. It is an event feed, not a graph. |
| **Claude Code Agent Monitor** | https://github.com/hoangsonww/Claude-Code-Agent-Monitor (site: https://hoangsonww.github.io/Claude-Code-Agent-Monitor/) | Local dashboard (Node, Express, React, SQLite, WebSockets) with D3 orchestration DAGs, a Sankey of tool transitions, analytics, cost tracking, kanban. Works with Claude Code and Codex through hooks. It can also start or resume Claude runs from the browser. | The dashboard baseline. It already crosses from observing into controlling, which is a path I have decided **not** to follow. |
| Axon | https://github.com/harshkedia177/axon | Code knowledge graph with a Sigma.js and WebGL explorer, community hulls, callers, callees, impact radius, a Cypher console, and MCP tools. | A reference for scalable graph exploration. It is a graph explorer, not a live agent monitor. |
| GraphiQuest | https://github.com/Bosheda/graphiquest | Local-first, read-only 3D code-graph dashboard built on the Graphify scanner. A finding can be traced to its connected code path. | Reference for a 3D Terrain feel and for tracing a finding to a path. |
| Agent Pixel Visualizer | https://github.com/maharshi-coding/agent-pixel-visualizer | VS Code extension that shows agent activity as a pixel-art world with animated agents and stations. | An example of a very different metaphor, and of how much freedom the visual space has. |

**Also note**

- Vendors are moving up. The Codex app was reported to merge into the new ChatGPT desktop app with inline diff editing and a PR review side panel. Vantage's defensible ground is being cross-harness, pipeline-first and replay-synced.
- Nobody has to be "first" in the abstract. What has to be true is that a user who tries Vantage and Agent Flow side by side immediately sees why Vantage is different.

---

## 12. Known issues and risks to carry into the design

These came out of reviewing an earlier draft and my original notes. Address them explicitly.

1. **Look versus tooling**: a 2D graph library will not produce a cinematic look. Use WebGL from the start (Section 10).
2. **Pipeline extraction is underspecified and the hardest thing**: framework-by-framework detection, cluster fallback, cached and clearly labeled derived labels (Section 7.2).
3. **Derived summaries have no cost model**: heuristic by default, LLM opt-in and batched (Section 8.3).
4. **Scope versus builder**: the earlier plan assumed a team (designer, graphics engineer, tooling engineer, security reviewer). Plan for one builder plus you.
5. **Memory policy counts turns, not bytes**: add byte budgets and lazy payloads (Section 9.2).
6. **Vendor encroachment and competitors**: state the moat clearly and keep verifying it (Section 11).
7. **Adapter assumptions may be stale**: verify formats before locking the event schema (Section 8.1).
8. **Readability over a moving background**: dim, blur or reduce contrast behind text, and keep a minimum contrast in every quality mode.
9. **Live versus replay priority**: build the replay player first against recordings, then live ingestion.
10. **Honesty about "thinking"**: captured versus derived, always labeled.
11. **Database scope**: static references only for now. Live inspection means credentials and a large security surface.
12. **Privacy**: redact secrets, query values, and sensitive paths **before** anything is persisted, cached, exported or shown. Local-first by default with retention controls.
13. **The name**: "Vantage" is a common word. Check trademark and domain conflicts and propose alternatives only if there is a real conflict.
14. **Sequencing inconsistencies**: the earlier plan mentioned recording ten real sessions in one place and five in another. Fix the number and state it.
15. **Clutter**: elements must appear only when needed and be sized for their job. The default screen is mostly Terrain plus one focal point.

---

## 13. About me and the constraints you should plan around

Fields marked **[FILL IN]** I will complete before sending, and you should ask me for any that are still blank.

- **Who**: a final-year Computer Engineering student. Strong in Python, LLM systems and ML research. Limited experience in frontend, graphics and motion design. I rely on you for the visual design and much of the implementation.
- **Team**: [FILL IN, currently solo].
- **Time budget**: [FILL IN, hours per week and target dates].
- **Machine and OS**: [FILL IN].
- **Harnesses I can actually test with, and on which plans**: [FILL IN].
- **Existing assets**: SkeletonGraph (Section 7.4).
- **Goal**: to build this properly and ship it as an open-source product that makes people feel they are missing out if they keep watching agents as plain text.

---

## 14. Deliverables and order of work

Work through these in order. **Stop at each checkpoint and wait for my review.**

**Step 1 — Evidence pack**
- Run Agent Flow (and, if practical, Event Horizon, Karna, and Agent Monitor) against a real Claude Code session. Capture three moments: a file read, an edit, and a failing test. Document exactly what a user can and cannot see in each tool at those moments, including what a click reveals. Correct my assessment in Section 11 where it is wrong.
- Verify the current session and hook formats for Claude Code and Codex, including Claude Code's transcript detail modes.
- Collect or help me collect 3–5 real recorded sessions (JSONL) across at least two repositories, to use as fixtures.

**Step 2 — Pacing specification**
- The scheduler design, parameters and simulation plan from Section 5, validated on the recorded sessions.

**Step 3 — Hero-scene storyboard**
- A frame-by-frame storyboard of one believable end-to-end story, for example: the user assigns a checkout-reliability task; Vantage opens on a quiet whole-system Terrain (route, order service, payment provider, queue, order table); the agent reads a file and that path illuminates; it searches a symbol and candidates appear; it runs a test and the failure travels to the affected node; a plan checkpoint appears; it edits the function and updates a test; the verification loop closes; I scroll back and see why the change was made; a second agent joins only when it has work and hands evidence back into the same scene.
- Include the Calm, Inspector and Replay lenses, the pacing behavior, and the Efficient and reduced-motion equivalents.
- Propose the **navigation and layout model** (how rows, turns, the agent presence, side-by-side turns and the Reader fit together) and justify it.
- Produce the **Presentation and Motion Catalog** from Section 2.7.
- Also build a **working browser prototype** of the hero scene driven by a recorded or synthetic session, including a search window that types out its query, a section read with the Reader open, and an edit with its diff.
- **Checkpoint A: I review the storyboard and prototype.**

**Step 4 — Decisions memo**
- Application form (web, desktop, other), renderer, daemon language, scope cut for the first release, numeric targets with a measurement plan, layout default, licence and distribution approach, and the name check.
- **Checkpoint B: I approve or change the decisions.**

**Step 5 — The in-depth architecture and product document**
- Cover, in depth: the concept and vocabulary; users and jobs to be done; features prioritized (must, should, later); experience design (scene composer, lenses, pacing, playback); the graphics system (Terrain, level of detail, effects, motion tokens, themes, backgrounds); settings and quality tiers; the data model and event schema; adapters and capability levels; storage and the memory model; performance budgets and how they are measured; security, privacy and redaction; deployment and packaging; testing and validation (golden sessions, visual regression, user studies); the open-source strategy (licence, adapter SDK, contribution, docs, a demo); the roadmap; and risks.

**Step 6 — First vertical slice plan for one builder**
- A week-by-week plan, repository structure, task list and acceptance tests for the smallest slice that proves the product: a **replay player** on recorded sessions with the Rail, one Focus stage (source and diff), and a first Terrain scene. Then live ingestion for one adapter.

**Step 7 — Begin building**
- Start with the replay player and the hero scene, then the ingest daemon and the first adapter.

---

## 15. Inputs to attach when sending this prompt

- The earlier product vision document (Vantage_Product_Vision.docx) as prior art. It is a starting point, and Sections 10 and 12 list the corrections to apply.
- Screenshots or frames of the Black Myth: Wukong interface (the visual reference), screenshots of Agent Flow and Event Horizon, and any other visual references I like. Use them to derive concrete visual rules (depth, blur, glow, typography, motion) instead of relying only on names.
- The recorded session files from Step 1 once I have them.

---

## 16. The quality bar for the first release

The first release succeeds only if a developer can:

1. watch a live coding task,
2. click any meaningful moment,
3. see the exact source or tool output,
4. understand the goal and evidence behind it,
5. inspect the resulting diff and test status, and
6. replay the same run later without a cloud account,

and if the whole loop feels **unmistakably better than a terminal transcript, and better than the tools that exist today**. Broad harness coverage and any enterprise or sync features come after that loop works.

**Principles to protect**

- Visualize the work, not just the logs.
- Show actual content (source, outputs, diffs, tests, schemas) whenever privacy allows.
- Keep the whole system present but keep attention narrow.
- Make every explanation traceable to captured evidence or clearly marked as derived.
- Let users choose fidelity, density and performance without losing history.
- Support the harnesses people already use, and never require them to switch.
- Design for understanding and supervision, not spectacle alone.

---

## 17. Rules for how you respond

- Lead with the work, not with reassurance. Be direct about problems.
- Ask only the questions you truly need answered, and ask them together.
- Show your reasoning for each major decision, with the alternatives you rejected.
- Cite the sources you used for facts about harnesses, tools and libraries.
- When you produce documents, make them complete and specific enough that another agent could build from them.
- If any instruction here conflicts with another, say so and propose a resolution.
