# Drishya — Product & Engineering Blueprint

**Version 1.2 · 20 September 2026 · End-to-end, concept through deployment**

> **21 September review amendment:** Read [the product review](review/01-product-review.md), [experience specification](review/02-experience-spec.md), [engineering plan](review/03-engineering-plan.md) and [research ledger](review/04-research-ledger.md) before implementing this blueprint. They supersede conflicting planning claims below on capture completeness, competitive exclusivity, hook overhead, causal inference, pacing guarantees, artifact history, privacy sequencing, integration choices and first-milestone scope. Unaffected design intent remains in force. The historical v1.2 text is retained for traceability, not as verified current evidence. The event schema is still a draft; the review proposes amendments for agreement before freezing it.

### Current implementation direction after review

**Latest user-directed visual decision:** [Continuous canvas](reference/04-continuous-canvas.md) supersedes any single-panel/replacing-scene default below or in the first review. Tools accumulate left to right with restrained overlap, agent explanation/response text flows unboxed beneath them, and the next passage continues downward. Agents occupy the top; native tools/MCP server origins occupy the right; the interactive repo map stays behind the work. Preserve earlier material as navigable history. This is the primary experience, not an optional Journey lens.

Build an evidence-linked replay slice before a comprehensive graph engine: captured read → edit → test → hunk inspection, with historical content/gaps, reduced motion and map-off behavior. Use a small second-harness fixture early to challenge the schema. Keep observation independent of agent execution. Default to passive collection, evaluate documented enrichment interfaces, and never promise hidden reasoning or complete capture. Live awareness and paced review have separate clocks; burst summaries preserve individually retrievable events without promising readable dwell for all of them. Redaction precedes the first real import. See the linked review documents for the replacement acceptance gates and architecture.

*Named **Drishya** (दृश्य, "the visible / a scene") — see Appendix A. Two builders, shared ownership. No fixed schedule.*

> **This is the source of truth.** Both builders and both of their agents read this file before doing work. Current position, who did what, and what is next live in [`STATUS.md`](STATUS.md) — this file holds knowledge and decisions, that one holds state. When they disagree, this file is right about *what* and that file is right about *where*.

Companion references (deep specs, linked from the relevant sections):

- [`reference/01-evidence-pack.md`](reference/01-evidence-pack.md) — verified harness formats, competitor teardown, corrections to the base prompt
- [`reference/02-motion-catalog.md`](reference/02-motion-catalog.md) — the Presentation & Motion Catalog, one entry per action type
- [`reference/03-event-schema.md`](reference/03-event-schema.md) — the normalized event schema and adapter contract

**Evidence convention used throughout.** Claims are tagged `[V]` verified against a primary source (linked in the evidence pack), `[D]` derived by reasoning from verified facts, or `[A]` assumed and needing validation. Untagged text is design intent, which is neither true nor false yet.

---

## 0. What this document is, and what changed

This is the build blueprint for Drishya: the case for why it should exist, the product definition, the experience design, the engineering architecture, the performance contract, and the path to a shipped, installable, open-source release.

It supersedes the base prompt (`Vantage_Base_Prompt.md`) where the two disagree. Six things changed as a result of verification, and they change the plan rather than decorating it:

| # | Finding | Consequence |
|---|---|---|
| 1 | Claude Code exposes **32 hook events**, including `PostToolBatch` ("after a full batch of parallel tool calls resolves"), `MessageDisplay`, `SubagentStart/Stop`, `PermissionRequest/Denied`, `PreCompact/PostCompact`, `TaskCreated/Completed`, `FileChanged` `[V]` | The **row rule is not an inference — the harness emits the boundary natively**. Claude Code is a **Level 3** adapter, not Level 1/2. §8, §11 |
| 2 | Hooks support a **`type: "http"`** handler that POSTs to a URL `[V]` | Install is one settings block pointing at `http://127.0.0.1:7717`. No shell scripts, no wrappers, no PATH problems. §11.3 |
| 3 | Claude Code already stores the real bytes: `~/.claude/file-history/<session>/*.snapshot.N` (pre-edit originals) and `<session>/tool-results/*.json` (spilled large outputs) and `<session>/subagents/<id>/*.jsonl` `[V]` | "Real content, not labels" is **a read, not a reconstruction**. True before/after diffs and untruncated output without touching git. §11.4 |
| 4 | Codex rollout files are documented reaching **700 MB – 2 GB** from repeated compaction persistence `[V]` | Ingest must stream-and-index. Never load a session file into memory. §11.5, §15 |
| 5 | The competitive read in base prompt §11 is **wrong about density and right about the gap**. Agent Flow is at ~1.7k stars, not ~990 `[V]`; at least four more entrants appeared in 2026 `[V]`; Google shipped Antigravity 2.0 with an Agent Manager supervision surface in May 2026 `[V]` | "Almost no competition" is not the situation. **"Proven demand, unbuilt hard version" is.** That is a better position, and §4–§5 rebuild the strategy around it |
| 6 | **"Vantage" had a live conflict in developer tools**: vantage.sh is an established cloud-cost platform, vantage.software exists, and `vantage-org/vantage` is a developer build tool on GitHub `[V]` | **Renamed to Drishya.** Appendix A |

**What changed in v1.1** (from the original idea document taking priority over the base prompt):

| Change | Where |
|---|---|
| **Renamed to Drishya.** A mechanical model of a system in motion, watched from outside — a description of the product, not a metaphor for it | Appendix A |
| **No existing code is reused.** The graph engine is built from scratch, scoped to Python and TypeScript first, with a stage-by-stage build order and an honest cost estimate | §5.3.2, §10.6 |
| **Daemon language re-decided: TypeScript, not Python.** The old reason was code reuse; that reason is gone, and one language for a duo plus a non-duplicated schema now wins | §14.5 |
| **Craft moved into the moat.** The v1.0 claim that "polish is cloned in a weekend" conflated metaphor-swapping with craft. Corrected | §5.3.1 |
| **The need restated at full strength:** not "logs are hard to read" but "you are losing your own codebase" | §1.1 |
| **Lift** — content is drawn *out of the map*, never faded in from nowhere. The signature mechanic, and the moat made visible in one second | §7.4, catalog §0.6 |
| **Per-harness attach strategies.** Every harness connects differently; the CLI adapts | §11.2b |
| **Roadmap is milestone-based, not calendar-based**, with no fixed ownership split between the two builders | §20 |

**One judgment this document keeps arguing for.** Substrate and craft are both necessary and neither is sufficient. Substrate without craft is Camp B — correct and unused. Craft without substrate is Camp A with better shaders — beautiful until someone clicks a node and gets a label. Every scope decision here is made in that order: substrate first, craft built on top of it, features last.

---

# PART I — THE NEED

## 1. The problem: the supervision gap

The problem Drishya solves is not that logs are ugly. It is an economics problem, and it got worse every month of 2026.

**Agents now produce work faster than humans can verify it.** A twenty-minute Claude Code run routinely touches dozens of files, issues hundreds of tool calls, runs a dozen commands, and rewrites code in parts of the system the developer did not name. The developer has exactly two options:

- **Watch the transcript live.** This fails. The text scrolls faster than reading speed, it is linear, it has no structure above the line, and the interesting 3% is buried in mechanical 97%. Nobody does this for more than a minute.
- **Look away and review the final diff.** This is what essentially everyone does.

Option two is the actual status quo, and it has a specific defect: **a diff is an answer with its reasoning deleted.** You can see what changed. You cannot see why, what evidence the agent had, what it considered and rejected, which test failure drove the change, or the moment it wandered somewhere it had no business being. All of that existed, was captured, and was thrown away — it is sitting in a JSONL file nobody opens.

The gap between production speed and verification speed is **the supervision gap**, and it produces three failures that every agent user recognises:

| Failure | What it looks like | Cost |
|---|---|---|
| **Over-trust** | Diff looks plausible, gets merged, breaks something three files away that was never opened | Production incidents attributable to unreviewed agent work |
| **Under-trust** | Developer cannot verify quickly, so they re-read everything or redo it by hand | The agent's speed advantage is cancelled by review cost |
| **Non-learning** | The developer never builds a model of *how this agent behaves* on their codebase, so their prompts never get better | Permanently mediocre results, blamed on the model |
| **De-skilling** | The developer stops knowing their own codebase. They did not read the file, did not see the decision, did not know which rule was applied | **The compounding one.** Every subsequent task is harder to specify and harder to review |

### 1.1 The real cost: you stop knowing your own codebase

The fourth row is the one that matters most and it is the least discussed. People prompt and walk away, read the final message, and merge. They do not know the code. They do not know the decision behind the change. They do not know which convention the agent followed or invented. That is the actual mechanism behind "vibe coding" as a liability — not that AI wrote the code, but that **nobody ever looked at the reasoning, and the reasoning was available the entire time.**

This compounds. Each unreviewed change makes the next task harder to specify, because the developer's mental model of the system drifts further from the system. Six months of this produces a codebase its owner cannot reason about — written in their repo, under their name, and opaque to them.

Directing an agent well is a learned skill, and it is not learnable from a diff. It is learned by watching an agent be wrong in a specific, memorable way, and recognising that shape early next time. **A transcript makes that unlearnable; a replay makes it unavoidable.**

That is the need, stated at full strength: not "logs are hard to read" but **"you are losing your own codebase, and the record that would prevent it is sitting unread on your disk."**

**The claim Drishya has to earn:** the captured record of an agent's work already contains everything needed to close this gap. It is not missing. It is unreadable. Drishya makes it readable — and *readable* here means perceivable at a glance, not merely better formatted.

## 2. Why visualization closes it — the argument, not the assertion

"Visualization helps understanding" is the kind of claim that is either a truism or a lie depending on how it is cashed out. Here is the specific cash-out, in four mechanisms. Each one predicts a measurable difference, which is how we will test them (§17.4).

### 2.1 Text is serial; space is parallel

Reading is one token at a time; it is hard-capped near 250 words per minute and the cap does not move. Spatial perception is not serial — position, size, color and motion are processed preattentively, across the whole visual field, in roughly 200 ms, largely independent of how many objects there are.

**The consequence:** "the agent is working in the payments module" takes about four seconds to establish from a transcript (find the path, recognise the directory, remember what lives there) and about 200 ms from a map (a region you already know the shape of is lit). That is a large difference on the single most frequently asked question during a run.

### 2.2 Text has no persistent location; a map does

In a transcript, `src/auth/session.py` appears as a string in forty separate places, and nothing relates those forty occurrences to each other. The reader must hold the relationship in working memory, which is famously about four items.

On a map, those forty events happen **at one place**. Forty entries collapse into one accumulating signal at a location you have already learned. This is not a rendering trick — it is a genuine reduction in working-memory load, and it is the reason a map beats a list as sessions get longer. The advantage *grows* with session length, which is the opposite of how transcripts behave.

### 2.3 Spatial memory is how humans index things they want to return to

The method of loci works because location is a strong human retrieval cue. Give the agent's work a stable place and the developer can *remember* it — "that was down in the queue worker, right after the test went red" — and navigate there directly.

In a transcript you cannot remember, you can only search. And to search you must already know the string you are looking for, which is precisely the thing you do not know when you are trying to reconstruct why something happened.

**This makes layout stability a functional requirement, not an aesthetic one** (§10.5). A map that rearranges itself between sessions destroys the one advantage it had.

### 2.4 Provenance is a graph, so showing it as a list is a lossy encoding

"Why does this null check exist?" is answered by a path: *search for `session_expiry` → read `session.py:40-90` → run tests → one fails → decide → edit*. That is five nodes and four edges.

A transcript can only render that graph as five text blocks separated by three hundred lines of unrelated mechanics. The edges — the actual answer — are not represented at all; the reader must reconstruct them. A timeline with a linked map represents the edges directly, as one connected shape you can traverse in either direction.

**This is the deepest reason visualization wins here, and it is structural.** The data is a graph over time. Text is a line. Any line-encoding of a graph loses the edges. Every competitor that ships a "transcript panel" next to a graph is still paying this cost, because the transcript and the graph are not the same object.

### 2.5 What this argument does *not* claim

It does not claim pictures are better than words. Drishya shows **more** text than a terminal does — full file regions, whole diffs, complete command output. The claim is narrower and stronger: *the index over that text should be spatial and temporal rather than linear.* The words stay. The table of contents becomes a map and a timeline.

This distinction is also the design constraint that keeps Drishya from becoming a toy: **every visual element must be a handle onto real captured bytes.** A glowing node that cannot be clicked into source is decoration, and decoration is how this product fails.

## 3. The five moments — where the need becomes felt

An argument does not create a need; an experience does. These five moments are the product's reason to exist, and every one of them is a thing to demo, a thing to instrument, and an acceptance test (§17).

**Moment 1 — The Wrong Neighbourhood.** *(detection)*
You asked for a checkout fix. Eight seconds in, the Terrain lights up in `auth/`. You see it without reading a word and correct the agent in its own harness before it has written anything.
*Transcript equivalent:* noticed four minutes later, in the diff, or never.
*Why only Drishya:* requires a map **of the repository**, not of the agent's call tree. Camp A tools (§4) cannot show this — they have no model of where `auth/` is relative to `checkout/`.

**Moment 2 — The Unexplained Diff.** *(comprehension)*
A diff has a null check you would not have written. You click the hunk. The Rail rewinds to the failing assertion and the file region the agent read immediately before, side by side, with the decision text between them.
*Transcript equivalent:* grep, scroll, guess.
*Why only Drishya:* requires the edit, the evidence and the decision to be **the same object on one timeline**, not three panels.

**Moment 3 — The Blast Radius.** *(risk)*
The agent edits one function. The Terrain shows two routes and a queue consumer downstream of it illuminate. You now know what to test, and the agent never told you — it does not know either.
*Transcript equivalent:* does not exist at any cost.
*Why only Drishya:* this is pipeline extraction (§10), the hardest component, and the one nothing in either camp has.

**Moment 4 — The Collision.** *(multi-agent)*
Two agents are running. Both approach the same file. A quiet conflict signal appears on the map before either writes.
*Transcript equivalent:* two terminals and no relationship between them.

**Moment 5 — The Replay.** *(the habit)*
Tuesday's run, scrubbed at 4× while reviewing the PR it produced. Map and content move together. You jump edit-to-edit, stop at the one failure, and understand the change in ninety seconds.
*Transcript equivalent:* the JSONL file, which nobody opens.

### 3.1 The strategic point hidden in Moment 5

Moments 1–4 are what sells Drishya. **Moment 5 is what retains it.**

Watching live is thrilling once and then competes with doing something else while the agent works — which is, after all, the whole reason people use agents. Reviewing afterwards is a task the developer *must* do, every time, forever. If replaying a run in Drishya is faster than reading the diff in GitHub, Drishya gets opened every day regardless of whether anyone watched live.

This reframes the roadmap: **replay is not the easy warm-up before the real product, it is the product.** Live is the feature that makes people install it. That is why §20 builds replay first — not to defer difficulty, but because it is where the durable job lives.

It also sets the retention metric honestly (§17.4): not stars, not installs, but *replays opened per merged agent PR*.

---

## 4. Where the market actually is

The base prompt's assessment — "hardly anything in terms of UI and working... very less competition" — is half right in a way that matters. The space is **crowded**. It is crowded in one place, and the place Drishya wants is empty. That is a better starting position than an empty market, because demand is already proven by someone else's stars.

The landscape splits into two camps that have not met.

### Camp A — Agent-execution visualizers

They render **the agent's own call tree**: which tool ran, which subagent spawned, in what order.

| Tool | State `[V]` | What it renders | Ceiling |
|---|---|---|---|
| **Agent Flow** | ~1.7k★, Apache-2.0, Claude Code + Codex, npx/VS Code/web, opt-out telemetry in npx build | Execution graph, timeline, transcript panel, file-attention heatmap | The graph is *of the agent*. No repository model. Detail arrives as a transcript panel — the §2.4 lossy encoding |
| **Event Horizon** | MIT, VS Code, Claude Code/OpenCode/Copilot/Cursor | Agents as planets, tasks as debris, file collisions as lightning | The most visually ambitious. **Also orchestrates agents** — a different product, and a path deliberately not taken here |
| **Claude Code Agent Monitor** | Node/Express/React/SQLite/WS | D3 orchestration DAGs, Sankey, cost analytics, kanban | The dashboard baseline. Also crosses into control |
| **claude-office**, **agent-pixel-visualizer**, Agent Flow's Office-mode PR | Active 2026 | Pixel-art offices, avatars at workstations | Proves how fast a *metaphor* gets cloned. Confirms polish is not a moat |
| **disler observability** | Hooks→Bun→SQLite→WS→Vue | Multi-agent event feed | Clean ingest reference. An event feed, not a graph |

**Shared ceiling:** they visualize the agent and *mention* the code. The repository is a set of filenames. Real content, when available at all, is a panel of text beside the picture.

### Camp B — Code knowledge graphs

They render **the repository**, and they were built to save the *agent* tokens, not to help the *human* understand.

| Tool | What it renders `[V]` | Ceiling |
|---|---|---|
| **CodeGraph** | Pre-indexed graph, auto-syncs, 9 harnesses, local | Built for retrieval. No session, no time |
| **Graphify** | Tree-sitter + LLM semantic extraction over code, docs, SQL, PDFs | Rich graph, no agent timeline |
| **Axon** | Sigma.js/WebGL explorer, hulls, impact radius, Cypher console | The scalable-graph-exploration reference. Not a monitor |
| **Karna** | Code graph over MCP, `karna live .` 3D view with agent activity | **Closest to the join** — and the visualization is an alpha side-feature of a token-saving tool |
| **GraphiQuest** | Local-first read-only 3D code graph | 3D Terrain reference. No agent stream |

**Shared ceiling:** a beautiful map with no clock. Nothing moves, nothing happened, there is no run to review.

**Note on reuse:** Drishya builds its graph engine from scratch (§10.6). None of these is a dependency, and none is a shortcut — their licences would permit vendoring, but their data models are built for *retrieval*, not for a timeline with stable layout and provenance. Adopting one would cost more in adaptation than it saves.

### 4.1 The vendors, moving up

This is the threat the base prompt underrates and should not.

**Google Antigravity 2.0** (19 May 2026) ships an **Agent Manager** — a dedicated surface for supervising up to five parallel agents — plus **Artifacts**: plans, task lists, diffs, screenshots and browser recordings, explicitly framed as "verify quickly instead of reading raw logs" `[V]`. That is the supervision gap, named by Google, with a product against it. The Codex app merged into the ChatGPT desktop app with inline diff editing and a PR review panel `[V]`.

**Read this correctly.** It is not that the niche is closing. It is that **the problem is now validated by the largest possible parties**, and every one of their solutions has the same structural limit: *a vendor will only ever visualize its own agent, inside its own IDE, against its own artifacts.*

The developer running Claude Code in one terminal and Codex in another has no vendor who will ever serve them. That population is growing, not shrinking, because model diversity is increasing. **Cross-harness is the position that gets more valuable as vendors fragment, and it is the one position no vendor can take.**

### 4.2 The actual gap

Nobody has joined the camps. There is no tool where **a live agent stream plays on a map of your own repository with the real captured bytes attached to a scrubbable timeline.** Camp A has the stream and no map. Camp B has the map and no clock. Vendors have both but only for themselves.

That intersection is Drishya.

---

## 5. Positioning and moat

### 5.1 The sentence

> **Drishya is a local, cross-harness replay and live view for coding agents. It plays an agent's work as real content — the source it read, the output it got, the diff it wrote — on a map of your actual repository, on a timeline you can scrub.**

### 5.2 The one-line differentiator, per competitor

Said to a developer who has already tried the alternative:

- *vs Agent Flow:* "Their graph is your agent. Ours is your codebase. Click any moment and you get the file, not a label."
- *vs Event Horizon:* "They drive your agents. We only watch — and we show you the code."
- *vs Karna / CodeGraph / Axon:* "You have the map. We add the clock, and the run that happened on it."
- *vs Antigravity / ChatGPT desktop:* "One screen for every agent you use, on a repo map they don't have, on your machine."
- *vs the terminal:* "You already have all of this on disk. You just can't read it."

### 5.3 Four layers of defensibility, hardest first

| Layer | What it is | Time to clone | Status |
|---|---|---|---|
| **1. Pipeline-first Terrain** | Entrypoint detection → flow traversal → stable layout, per framework, with community-detection fallback | Months of unglamorous static-analysis work per language/framework | **The moat.** §10 |
| **2. Content-complete capture** | Knowing where every harness spills its real bytes and stitching them into one provenance-carrying store | Weeks, and it compounds per harness | Partly free — the bytes are on disk `[V]`. §11.4 |
| **3. Deterministic linked replay** | Composer as a pure function; map and content seek together; golden-session tests | Weeks, and it constrains architecture from day one | §9.6, §17.1 |
| **4. Craft at the $1,000 level** | Motion that means something, pacing that reads, a transparent layer that never becomes a dashboard | **Months, and most teams never get there** | §7, motion catalog |

### 5.3.1 A correction about craft

The first draft of this document said polish is "cloned in a weekend" and cited the Office-mode PR that landed on a competitor in five weeks. That conflated two different things, and the distinction matters enough to state plainly:

- **A metaphor is cloned in a weekend.** Pixel-art offices, Sims avatars, planets-and-orbits — these are reskins. Swapping one theme for another is a weekend, and three separate projects did exactly that in 2026 `[V]`.
- **Craft is not cloned at all.** The difference between a $10 edit and a $1,000 edit is not the assets — it is timing, restraint, what is left out, how things interrupt, and a hundred decisions each of which is invisible and all of which are felt. That is taste plus iteration, and it does not transfer by looking at a screenshot.

**So craft belongs in the moat, not outside it** — provided it is actually at that level. A competent animation library and some blur is layer-4 theatre, and it *is* cloneable. What is being built here is the other thing, and §7, §9 and the motion catalog exist to make it specifiable rather than hoped for.

The honest ordering is therefore: **substrate and craft are both necessary, and neither is sufficient.** Substrate without craft is Camp B — correct and unused. Craft without substrate is Camp A with better shaders — beautiful and shallow, and it dies the moment someone clicks a node and gets a label. The product is the pair.

### 5.3.2 Building the graph engine from scratch

There is no existing indexer to reuse, and the Terrain is the hardest thing here. That is a cost and it is also the point: **it is the exact work no Camp A tool will do**, because it is months of unglamorous static analysis with no demo value until it is finished.

Two design consequences (detail in §10):

- **Scope it to two languages first — Python and TypeScript/JavaScript.** Not ten. These two cover the overwhelming majority of what this audience writes, and each additional language is real, separate work. Ten languages shallowly parsed is worse than two parsed well, because a wrong edge is worse than a missing one (motion catalog §17.2).
- **Compute centrality ourselves.** PageRank over the call graph drives visual hierarchy, so node prominence is structural importance rather than arbitrary size. This is cheap to compute once the graph exists and it is what makes the map look right — because it *is* right.

### 5.4 Things Drishya will deliberately not do

Stated so scope holds under pressure:

- **No control.** Never sends a prompt, never approves a tool call, never starts a run. The moment it does, it is a harness competing with Claude Code, and it loses. Read-only is a *feature* — it is the reason it can be trusted with every harness at once.
- **No cloud by default.** No account, no sync, no telemetry. Agent Flow ships opt-out anonymous telemetry in its npx build `[V]`; Drishya ships **none**, and says so on the first screen of the README. For a tool that reads your source, this is a cheap, real, permanent differentiator.
- **No live database access.** Static references only. Live inspection means credentials and a security surface out of proportion to the value.
- **No IDE lock-in.** A VS Code extension may exist, but only as a launcher.

---

# PART II — THE PRODUCT

## 6. Users, jobs, and scope

### 6.1 Who

| Segment | Why they show up | Which moment retains them |
|---|---|---|
| **Solo devs and indie builders** running agents daily | Curiosity, then the wrong-neighbourhood catch | 1, then 5 |
| **Reviewers of agent-written PRs** (often the same person, later) | The diff they must approve has no story | **5** |
| **Teams adopting agents**, needing to build trust and shared practice | Need evidence agents are behaving | 3, 5 |
| **Educators, content creators, conference talks** | Replay is inherently presentable | 5 |
| **Multi-harness power users** | Nobody else serves them at all | 1, 4 |

The primary wedge is segment 1; the retention engine is segment 2; they are usually the same human on different days. Design for the overlap.

### 6.2 Jobs to be done

1. *While it runs:* "Tell me if it is going somewhere wrong, without making me read."
2. *When it finishes:* "Show me why this diff exists, faster than I could reconstruct it."
3. *Before I merge:* "Show me what else this touches."
4. *Later:* "Play me that run again."
5. *Always:* "Do not send my code anywhere, and do not slow my agent down."

Job 5 is a constraint, and it is load-bearing — violating it once ends the product's credibility permanently.

### 6.3 Scope, by release

| | Must (v1) | Should (v1.x) | Later |
|---|---|---|---|
| **Capture** | Claude Code (transcript + hooks), Codex (rollout) | Cursor, OpenCode, Gemini CLI | OTel emitter, LangGraph/CrewAI, CI agents |
| **Terrain** | Dependency graph, clusters, L0–L2, stable layout | Flow extraction for 4 frameworks, blast radius | Runtime traces, DB reference layer |
| **Stage** | Read, search, edit, bash, test, message, thinking | Full 16-type catalog | Screenshots, browser recordings |
| **Time** | Replay + scrub + jump-to-marker, live with pacing | Bookmarks, annotations, export bundle | Shared replay links |
| **Trust** | Provenance marks, pre-persistence redaction | Redaction audit view | LLM summaries (opt-in) |
| **Perf** | 3 quality tiers, reduced motion | Auto-tier stepping | WebGPU tier |

---

## 7. Experience architecture

The base prompt hands me decision authority here (§2.7). These are decided, with the rejected alternatives stated.

### 7.1 The layout: Terrain / Stage / Rail / Reader / Scrubber

```
┌────────────────────────────────────────────────────────────────────┐
│  ▏                                                     ◉ ◉ ◌ ◌    │  ← Roster (agents)
│  ▏                                                                 │
│  ▏            ╭──────────────────────────────╮      ┌───────────┐ │
│ R▏            │                              │      │           │ │
│ a▏            │           STAGE              │      │  READER   │ │
│ i▏            │   one focal composition      │      │  (summon) │ │
│ l▏            │   ephemeral surfaces         │      │  0→40%    │ │
│  ▏            ╰──────────────────────────────╯      └───────────┘ │
│  ▏                                                                 │
│  ▏        · · · TERRAIN (full-bleed, behind everything) · · ·      │
│  ▏                                                          ⚙ ⛭   │
│  ╰──────── ◀◀ ▶ ▶▶  ──●───────────────  1× ────────────── LIVE ───│  ← Scrubber
└────────────────────────────────────────────────────────────────────┘
```

**Terrain** — full-bleed, always present, dark and quiet. The world. Only the active path is lit.

**Stage** — the centre. One focal composition at a time, built from ephemeral translucent surfaces that emerge and dissolve. Never a fixed panel, never a grid of cards.

**Rail** — a **72 px vertical spine** on the left. This is the most important layout decision in the document, so it gets its own justification: the Rail is deliberately **not a list of text**. It is a column of glyph-marks, one per Row, colored by agent, with distinct marks for edits, failures, decisions and handoffs. It is simultaneously the scroll position, the minimap of the run, and the jump target list. Hovering expands a peek; it never expands into a transcript.

> *Why this matters:* the instant history becomes a scrollable column of text, the product **is** a transcript with a picture next to it — which is exactly the §2.4 failure, and exactly what every Camp A tool does. The Rail is the structural commitment that prevents regression to a log.

**Reader** — right-docked, summoned, 0→40% width, one instance ever. Whole file, whole output, whole diff, with the agent's region highlighted in place. This is the "expand to everything without leaving the scene" affordance from base prompt §2.2b.

**Scrubber** — bottom, auto-hiding. Appears on hover, on pause, or whenever the user leaves the live edge.

**Roster / Tools** — top-right and bottom-right corners, small, on demand, explicit pinning.

### 7.2 The navigation model

| Gesture | Does | Why |
|---|---|---|
| **Vertical scroll** | Move through Rows (time) | Matches reading; content wants vertical space |
| **Horizontal scroll / ←→** | Move between Beats *within* a Row | This is where the base prompt's left-to-right picture actually belongs: the parallel-actions dimension |
| **Click a Pulse** | Freeze, expand in place | Drill-down without leaving the scene |
| **`R` or double-click** | Summon Reader with that artifact | One consistent destination for "show me all of it" |
| **`Esc`** | Collapse one level | Always reversible |
| **`L`** | Return to live | Always available when off-live |
| **`E` / `F` / `D`** | Jump to next edit / failure / decision | Video-editor muscle memory |
| **Drag Scrubber** | Fast traverse; Terrain follows | The linked movement that is the core of the product |
| **`Cmd`+scroll on Terrain** | Camera zoom (distinct from drill-down) | Two different "zooms", never conflated |

**Rejected:** *horizontal-primary filmstrip* — horizontal scroll is poor on most input devices and code wants vertical space. *Vertical chat feed* — that is a transcript. *Fixed multi-panel dashboard* — that is Camp A, and it violates "no permanent boxes".

### 7.3 Lenses

A Lens is a preset over density, motion and which surfaces auto-summon. Not different apps — one scene, different settings.

| Lens | Stage density | Motion | Reader | For |
|---|---|---|---|---|
| **Calm** (default live) | 1 focal surface | Full | Manual | Ambient watching |
| **Operator** | 3 surfaces, Beat stacks visible | Reduced | Manual | Fast runs, high attention |
| **Inspector** | 1 surface, maximum evidence | Minimal | Auto-summons | Understanding one moment |
| **Replay** | Adaptive to speed | Full, speed-scaled | Manual | Review, teaching |
| **Review** | Edits and failures only; everything else collapsed | Reduced | Auto on diffs | PR review — **the retention lens** |

**Review lens is a v1 must**, despite sounding like a nice-to-have, for the reason in §3.1.

### 7.4 Visual language

Derived from the stated reference (clean, transparent, restrained; only what is needed appears).

#### The signature move: **Lift**

From the original idea: *"show the whole repo graph or pipeline and connections — then from those graphs, bring that file in a cool way, as well as meaning to those graphs."*

That is the single most distinctive mechanic in this product and it must be the thing people remember. **Content is never summoned from nowhere. It is lifted out of the map.**

When the agent reads `auth/session.py`, the source does not fade in at the centre of the screen. The node for that file **brightens, elongates, and unfolds** — the file's content rises out of its own position in the Terrain, along a visible path, and settles onto the Stage while a faint tether keeps it connected to where it came from. Close it and it falls back into place.

Three things this buys, none of them decorative:

1. **It answers "where am I?" without a label.** You watched the content come out of a specific place in a map you already know. That is §2.2 and §2.3 made literal — the location is taught by the motion itself.
2. **It gives the graph a job.** The base prompt worried the Terrain would be wallpaper. It cannot be wallpaper if every piece of content physically originates from it. The map earns its screen space by being the source of everything.
3. **Nobody else can do it.** Camp A has no repository model, so there is no place for content to come *from*. Their content must appear in a panel, because a panel is all they have. **This mechanic is the moat rendered visible** — a one-second animation that demonstrates the architectural difference (§5.3) without a word of explanation.

It is also the opening shot of the hero demo, and it is what a 45-second loop on the README should show first.

Mechanically it is a fourth motion verb (motion catalog §0.3), and every content-bearing action type uses it.

#### The rest of the language

- **Surfaces, not boxes.** Every information surface is translucent, has no hard border, and has a lifecycle: lift → hold → demote → dissolve. Nothing is permanent except Terrain, Rail and the Scrubber's hit area.
- **Readability floor is absolute.** Text always sits on a scrim: `backdrop-filter: blur(16px)` plus a background at ≥70% opacity of the base, tuned so measured contrast never drops below **4.5:1** — in every quality tier, including Efficient where blur is off and the scrim goes opaque instead. A quality setting may never reduce legibility.
- **Depth via three planes only.** Terrain (far, desaturated, blurred), Stage (near, sharp), Reader (nearest, opaque). No arbitrary z-stacking.
- **Color carries meaning, never decoration.** Agent identity = hue. Edit = warm. Failure = the only saturated red in the product. Derived content = desaturated with a dashed edge (§12). Everything else is neutral.
- **Motion means causality.** A read sends a trace along a real dependency edge. A failure travels from the test to the node it broke. Nothing eases for beauty alone.
- **Timing tokens:** `instant 90ms` · `quick 160ms` · `base 260ms` · `considered 400ms` · `cinematic 700ms` (Terrain camera only). Nothing exceeds 700 ms. **Everything is cancellable.**
- **Type:** one variable sans for UI (Inter var), one mono for code (JetBrains Mono / Berkeley Mono). Two families, full stop.

Per-action-type presentation and motion specs: [`reference/02-motion-catalog.md`](reference/02-motion-catalog.md).

---

## 8. The event model: Run → Turn → Row → Beat → Pulse

The base prompt's "row rule" was a mental model. Verification showed the harness emits it natively `[V]`, so it becomes the formal structure.

| Level | Definition | Source |
|---|---|---|
| **Run** | One session | `SessionStart` → `SessionEnd`; `sessionId` |
| **Turn** | User message → agent stops | `UserPromptSubmit` → `Stop` |
| **Row** | One or more Beats terminated by assistant text or thinking | `MessageDisplay` / assistant `text`/`thinking` block |
| **Beat** | A set of tool calls resolved together | **`PostToolBatch`** `[V]`; fallback: timestamp clustering with no intervening assistant text |
| **Pulse** | One tool call and its result | `PreToolUse`/`PostToolUse` pair; `tool_use`/`tool_result` blocks |

Parallel vs sequential — which the base prompt asked to show "where the data allows" — is now directly available: Pulses inside one `PostToolBatch` ran in parallel; consecutive Beats without intervening text ran sequentially. **Render these differently** (parallel Beats fan out simultaneously from the agent presence; sequential Beats chain). This is a small detail that makes the visualization *true*, and truth is the thing that makes people trust it.

For adapters without batch semantics, the same structure is inferred (≤150 ms inter-call gap, no assistant output between) and marked `inferred` in provenance (§12).

Full schema: [`reference/03-event-schema.md`](reference/03-event-schema.md).

---

## 9. The pacing engine

This is the design problem the base prompt says it cannot solve alone. Here is a buildable spec.

**Framing:** this is a **rate-adaptive scheduler where the scarce resource is human attention-seconds** and the controller is a lag-driven compression governor. Not a queue with a delay.

`Ingest → Classifier → Priority queue → Scene composer → Renderer`

### 9.1 Classifier

Each Pulse gets three numbers:

- **Salience `s ∈ [0,1]`** — base weight by type, then modifiers.

  | Type | Base | | Modifier | Δ |
  |---|---|---|---|---|
  | Failure, error | 1.00 | | First touch of this file this run | +0.15 |
  | Edit, write | 0.90 | | Target is in a changed/staged file | +0.10 |
  | Test result | 0.85 | | Target has high PageRank centrality | +0.10 |
  | Decision / plan update | 0.80 | | Outside the task's stated scope region | **+0.25** |
  | Approval prompt | 0.80 | | Repeat of a recent (type, target) | −0.30 |
  | Bash command | 0.60 | | Result was empty / no-op | −0.20 |
  | Search | 0.45 | | | |
  | File read | 0.35 | | | |
  | Mechanics (glob, ls, cd) | 0.15 | | | |

  The `+0.25` out-of-scope modifier is Moment 1 implemented as a number.

- **Content mass `m`** — normalized reading cost: code lines × 1.0, diff lines × 1.4, prose words × 0.35, output lines × 0.6.
- **Novelty `n`** — decays exponentially per repeat of `(type, target)` in a 30 s window. This is what stops "read the same file six times" from consuming the screen.

### 9.2 Dwell

```
dwell = clamp(D_min + k · √m · s · n, D_min, D_max) · (1/speed) · γ
```

Defaults: `D_min = 400 ms`, `D_max = 4000 ms`, `k = 900 ms`.

`√m` rather than linear because reading cost grows sublinearly — people skim large blocks rather than reading them proportionally.

### 9.3 The compression governor `γ` — the core mechanism

Let `lag = now − timestamp(event currently on Stage)`, `lag_target = 3 s`, `lag_max = 12 s`.

```
γ_raw = clamp(1 − (lag − lag_target)/(lag_max − lag_target), γ_min, 1),  γ_min = 0.15
γ     = γ + (γ_raw − γ) · (Δt/τ)     // τ_fall = 0.3 s, τ_rise = 1.5 s
```

Asymmetric smoothing: compress quickly when falling behind, relax slowly. This kills oscillation, which is the failure mode that makes adaptive UIs feel drunk.

**Regimes:**

| γ | Behaviour |
|---|---|
| `1.0` | Full dwell. Every Pulse gets its moment |
| `< 0.6` | **Coalescing on.** Salience < 0.5 Pulses stop getting individual moments and accrete into Beat Stacks |
| `< 0.3` | **Essential only.** Salience < 0.7 goes straight to the Rail without staging |
| `= γ_min` and lag still rising | **Catch-up Sprint.** Jump to the live Row; place a `⤒ jumped N events` marker on the Rail. Everything remains in the store and reachable |

Requirement 1 (no information loss) holds at every regime: compression only ever changes *what gets a moment on stage*, never what is stored or reachable.

### 9.4 Coalescing and overlap

**Beat Stack.** Pulses sharing `(type, terrain_cluster)` within the window collapse into one surface — `6 reads · src/auth · 340 lines` — rendered as a fanned card stack. Click expands to all six, each with its own range, result and provenance.

**Stage occupancy.** Maximum `N_stage` surfaces (Calm 1, Operator 3, Inspector 1). A new surface enters at focus; the previous demotes (`scale .92`, `opacity .5`, `blur 2px`, drift back 12 px); beyond `N_stage` it dissolves over 260 ms. Dissolution is not deletion — it is on the Rail, one click away.

### 9.5 Modes

| Mode | Clock | γ |
|---|---|---|
| **Paced Live** (default) | Wall clock | Governed |
| **Raw Live** | Wall clock | Pinned `γ_min`, no dwell — ticker mode |
| **Follow** | Wall clock | Governed, Stage filtered to the followed file/cluster |
| **Paused-with-buffer** | Stopped | Backlog accrues; `N events queued · press L` shown honestly |
| **Replay** | Recording's own clock × speed | `γ = 1` (no lag exists) |

### 9.6 Determinism

**The composer is a pure function:**

```
compose(events[0..i], settings, speed, t) → Scene[]
```

No wall-clock reads inside it; `t` is injected. In replay, `t` comes from the recording. Same recording + same settings → byte-identical choreography, every time.

This is what makes golden-session tests possible (§17.1), and it is an architectural constraint that has to be enforced from the first commit, because it cannot be retrofitted.

### 9.7 Interruptibility

Every transition exposes `cancel()` that snaps to final state. Any pointer or key event cancels all in-flight transitions synchronously, before handling. **Nobody ever waits for a cinematic transition.** This single rule is the difference between "cinematic" and "sluggish", and it is the most commonly skipped one.

### 9.8 Validating it

Replay recorded sessions headlessly through the scheduler and measure:

| Metric | Definition | Gate |
|---|---|---|
| **p95 lag** | Live edge to stage | **< 5 s** |
| **Critical coverage** | Fraction of `s ≥ 0.8` Pulses that got an individual moment | **100 %** |
| **Attention debt** | `Σ max(0, read_time_required − dwell)` over staged Pulses | **≤ 20 %** of total required |
| **Compression ratio** | Distinct moments / total Pulses | Reported, not gated |
| **γ variance** | Over rolling 60 s | **< 0.05** |

Read-time model: 250 wpm prose, 12 lines/s code skim, 6 lines/s diff.

**No edit and no failure may ever be skipped, at any γ.** That is a hard invariant, not a target.

---

## 10. The Terrain engine

The moat (§5.3), the hardest component, and the one to validate earliest — before any of the beautiful parts are built.

### 10.1 Layers

| Layer | Built from | v1 |
|---|---|---|
| Code dependency | Our indexer: Tree-sitter AST → symbol table → call graph → PageRank | ✅ |
| Clusters | Leiden community detection over the call graph | ✅ |
| Pipeline flows | Entrypoint detection + BFS traversal | ⚠️ 4 frameworks |
| Data boundary | ORM models, migrations, SQL literals — **references only** | v1.x |
| Delivery | Build files, CI config, Dockerfiles | Later |
| Verification | Test discovery + execution events | ✅ (from events) |
| Agent work | The normalized event stream | ✅ |

### 10.2 Flow extraction

The base prompt asks for this to be challenged. It is roughly right; here is the refinement:

1. **Entrypoint detectors**, four to start — Express/Fastify, FastAPI/Flask, Next.js app router, Django `urls.py`. Each is ~200 lines of AST matching. These four cover the large majority of repositories this audience has `[A — validate on the 10-repo corpus]`.
2. **Traverse** from each entrypoint along the call graph, BFS, depth cap 6, producing an ordered **Flow**.
3. **Fallback: Leiden**, not Louvain — Louvain can produce internally disconnected communities and is less stable across runs, and stability is functionally required here (§10.5).
4. **Label** heuristically: highest-PageRank symbol + directory mode. Cache it. LLM labels are opt-in, batched, cached, and **always marked derived** (§12).
5. **Never claim more than is true.** Dynamically constructed routes and queries will be missed. The UI says so, at the cluster, not in a footnote.

**Honest risk:** flow extraction may simply not be good enough on real-world repositories. §20 therefore validates it at **M0**, before the cinematic layer is built. If flows are weak, Terrain degrades to *clusters + dependency edges + centrality*, which is still strictly more than any Camp A tool has. The product survives a partial failure of its hardest component — that is deliberate.

### 10.3 Level of detail

| Tier | Shows | Primitive budget |
|---|---|---|
| **L0 Silhouette** | Cluster hulls, 20–60 shapes | < 500 |
| **L1 Systems** | Named modules/services, inter-cluster edges | < 2,000 |
| **L2 Files** | File nodes inside the focused cluster | < 5,000 |
| **L3 Symbols** | Functions and call edges, focused file only | < 8,000 |

Exactly one tier renders fully, plus a halo of the next around the focus. **Hard cap 8,000 drawn primitives per frame**, enforced by tier selection rather than by hope.

### 10.4 Scale

Never lay out the whole graph. Disk index (SQLite + on-disk layout), compressed in-memory representation, layouts precomputed in workers, progressive reveal (silhouette in < 2 s, detail streams in). Compute is prioritized around active files, changed files, recently traversed paths and pinned systems.

### 10.5 Layout stability — a functional requirement

Because spatial memory is the mechanism (§2.3), **a map that moves is a map that does not work.**

- Layout is computed once per index generation and **pinned to disk**.
- Incremental updates place new nodes by *constrained local relaxation only*; existing nodes move by at most ε (target: ≤ 2 px at L1).
- A full relayout happens only on explicit user action, and animates over 700 ms so the user can track the change.

Nothing may move because a file was read. This is the rule that makes Terrain a *place*.

### 10.6 Building the indexer

Everything is from scratch. The build order matters, because each stage is independently useful and independently testable — and because the first two alone already produce a map better than anything in Camp A.

| Stage | What it does | Effort | Ships when |
|---|---|---|---|
| **1. Parse** | Tree-sitter per language → AST. Python and TypeScript/JS only | Small — Tree-sitter grammars are off-the-shelf | M0 |
| **2. Symbol table** | Definitions: functions, classes, methods, exports, with file+range | Small | M0 |
| **3. Import resolution** | Module graph. `import x from './y'` → real file. **This is where most of the fiddly work lives** — relative paths, index files, `__init__.py`, path aliases in `tsconfig`, re-exports | **Medium-large.** Budget for it honestly | M0 |
| **4. Call graph** | Call sites resolved to definitions. Exact within a module; heuristic across modules (name + arity + import scope) | Medium | M1 |
| **5. Centrality** | PageRank over the call graph → visual hierarchy | Trivial once 4 exists | M1 |
| **6. Clustering** | Leiden communities → Terrain clusters | Small (library) | M1 |
| **7. Layout** | Force layout, computed once, **persisted** (§10.5) | Small-medium | M1 |
| **8. Entrypoints + flows** | Framework detectors → BFS traversal → Flows | Medium, per framework | M3 |
| **9. Incremental** | File change → reparse one file → local graph patch → ε-bounded relayout | Medium, and easy to get subtly wrong | M3 |

**Be honest about precision.** Dynamic dispatch, duck typing, monkey-patching, `getattr`, decorators that rewrite call targets, and dynamically constructed imports will all produce missing or wrong edges. The rule from motion catalog §17.2 applies at the source: **a wrong edge is worse than a missing one**, because the Terrain's whole value is that its lights can be trusted. Where resolution is uncertain, drop the edge and record the uncertainty rather than guessing.

**Do not reach for an LSP in v1.** Language servers give real precision, and they cost a process per language, a protocol, startup latency, and a large dependency surface. Tree-sitter plus import resolution is enough for a map at cluster and file granularity — which is the granularity the Terrain actually renders at L0–L2. Revisit for L3 symbol precision after the product exists.

---

## 11. Data and adapters

### 11.1 Principle

The renderer must never know which harness an event came from. Every adapter emits the same normalized schema and **declares its capability level**; the UI degrades by level, visibly and honestly.

### 11.2 Capability levels

| Level | Data | Experience |
|---|---|---|
| **0 Replay** | Exported transcript | Rich replay, no live |
| **1 Live events** | Tool calls, messages, file ops, output | Live timeline |
| **2 Structured state** | Goals, plans, delegation, approvals | Decision and multi-agent views |
| **3 Deep integration** | Streaming, lifecycle hooks, artifacts, batch boundaries | Full experience |

### 11.2b Attach strategies — every harness connects differently

Harnesses expose themselves in fundamentally different ways, so there is no single "connect" mechanism and pretending otherwise produces a bad experience for every harness but one. Each adapter therefore declares an **attach strategy**, and the CLI and onboarding adapt to it.

| Strategy | How it works | Latency | Harnesses |
|---|---|---|---|
| **`hooks`** (push) | The harness POSTs lifecycle events to the daemon. Richest and lowest-latency | ~instant | Claude Code `[V]` |
| **`tail`** (pull) | Watch a session directory; stream-parse new lines as they land | ~file-flush | Codex, pi |
| **`poll`** (pull) | Poll a SQLite store for new rows since the last cursor | 250–1000 ms | Cursor, opencode |
| **`proxy`** (intercept) | Local proxy on the model base URL sees every tool call and result | ~instant | Any harness allowing a base-URL override |
| **`import`** (offline) | Read a finished session file | n/a | Everything, always |

```typescript
interface AttachStrategy {
  mode: "hooks" | "tail" | "poll" | "proxy" | "import";
  setup(): Promise<SetupResult>;   // idempotent; returns what it changed
  teardown(): Promise<void>;       // must fully reverse setup()
  status(): Promise<AttachStatus>; // connected / waiting / misconfigured
}
```

**The CLI surface follows from this:**

```bash
drishya attach claude      # writes the hook block, verifies, waits for the first event
drishya attach codex       # starts the rollout tailer on ~/.codex/sessions
drishya open <file|dir>    # import and replay anything, no attachment
drishya status             # what is attached, what is live, what is misconfigured
drishya detach <harness>   # fully reverses attach
```

**Three rules this must obey:**

1. **Every `setup()` is reversible and says what it changed.** Writing into someone's `settings.json` without a clean, complete `detach` is how a tool gets uninstalled angrily. Print the diff before applying.
2. **`status` must be honest and specific.** "Waiting for Claude Code — run `claude` in a watched repo" is useful. A spinner is not. Most support burden in local devtools is attach confusion, and it is cheap to design away.
3. **Drishya does not launch the agent.** The user runs `claude` or `codex` exactly as they always do; Drishya only prepares the connection and listens. This is the observe-only line from §5.4.

> **The one exception worth considering, deliberately:** for a harness where attaching cannot reach Level 1 — no hooks, no readable session files — a wrapper launch (`drishya run <harness> …`) that spawns the process and reads its stdio is the only route to live data. Launching a process on explicit user command is not *steering* an agent, so it does not cross into being a harness. But it adds real surface (process lifecycle, signal handling, TTY passthrough), so: **not in v1, opt-in when it arrives, and never the default path for a harness that can be attached to instead.**

### 11.3 Claude Code — Level 3 `[V]`

Materially better than the base prompt assumed.

**Hooks (32 events).** The ones that matter here:

| Hook | Gives |
|---|---|
| `PreToolUse` / `PostToolUse` / `PostToolUseFailure` | Pulse start, result, failure — with `tool_use_id` for exact correlation |
| **`PostToolBatch`** | **The Beat boundary, natively** |
| `MessageDisplay` | Assistant text as displayed → Row terminator |
| `UserPromptSubmit` / `Stop` | Turn boundaries |
| `SubagentStart` / `SubagentStop` (with `agent_type`) | Multi-agent presence and handoff |
| `PermissionRequest` / `PermissionDenied` | Approval moments |
| `PreCompact` / `PostCompact` | Context compaction as a visible event |
| `TaskCreated` / `TaskCompleted` | Plan checkpoints |
| `FileChanged` | Disk truth independent of what the agent claims |
| `SessionStart` / `SessionEnd` (with reason) | Run lifecycle |

Common stdin payload carries `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `agent_id`, `agent_type` `[V]` — everything needed for identity and correlation.

**Install is one settings block**, because hooks support `type: "http"` `[V]`:

```json
{ "hooks": { "PostToolBatch": [ { "hooks": [
  { "type": "http", "url": "http://127.0.0.1:7717/ingest/claude-code", "timeout": 5 }
]}]}}
```

No shell scripts, no wrapper binary, no PATH issues, cross-platform by construction. `drishya init` writes it; `drishya init --revert` removes it. **This is a significantly better install story than any competitor's** and it came from reading the docs rather than assuming.

**Hooks must never block the agent.** Every Drishya hook is configured `async: true` where supported, with a short timeout, and the daemon acknowledges immediately and processes off the request path. Job 5 (§6.2) is enforced here.

### 11.4 Content completeness — the bytes are already on disk `[V]`

| Source | Gives |
|---|---|
| `~/.claude/projects/<slug>/<session>.jsonl` | Full event stream, `uuid`/`parentUuid` tree, `thinking` and `text` blocks, `tool_use`/`tool_result`, `usage` |
| `<session>/tool-results/*.json` | **Large outputs the transcript spilled** — untruncated |
| `~/.claude/file-history/<session>/*.snapshot.N` | **Pre-edit originals** — true before/after diffs, no git required |
| `<session>/subagents/<id>/*.jsonl` | Subagent transcripts for the multi-agent view |
| `~/.claude/plans/<id>.md` | Plan-mode documents |

This turns "real content, not labels" from an engineering problem into a plumbing problem. **Retention caution `[V]`:** these are swept after `cleanupPeriodDays` (default 30). Drishya must copy what it needs into its own content-addressed store at ingest — a replay must not decay because the harness cleaned up.

### 11.5 Codex — Level 1–2 `[V]`

`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`; line 1 is `session_meta`, then `event_msg`, `response_item`, `turn_context`, `compacted`, and newer `world_state` / `inter_agent_communication_metadata` records — the set is still growing, so the parser must skip unknown record types rather than fail.

**Hazard `[V]`:** documented rollout files of **700 MB – 2 GB** from repeated compaction persistence. Therefore: stream-parse with a bounded reader, build an offset index (`seq → byte offset`), never materialize a session, and cap any single record at a configurable size with the remainder spilled to the blob store.

### 11.6 Other harnesses `[V]`

| Harness | Location | Format | Level |
|---|---|---|---|
| Cursor CLI | `~/.cursor/chats/<id>/<uuid>/store.db` | SQLite (`blobs`, `meta`) | 0–1 |
| opencode | `~/.local/share/opencode/opencode.db` | SQLite | 0–1 |
| Amp | `~/.local/share/amp/threads/T-*.json` | JSON per thread | 0 |
| pi | `~/.pi/agent/sessions/--<cwd>--/*.jsonl` | JSONL tree | 0–1 |

Undocumented formats will drift. Adapters declare tested version ranges and degrade rather than crash (§17.2).

### 11.7 The universal fallback: local model proxy

For any harness allowing a base-URL override, a local proxy sees every tool call and result without integration. Paired with a file watcher for what actually changed on disk, this yields Level 1 anywhere. Build it after two real adapters — it is the long-tail answer, not the first move.

### 11.8 Ingest architecture

```
hooks (HTTP) ─┐
file tailers ─┼→ normalizer → redactor → SQLite (WAL, append-only) + CAS blobs → WS/SSE → UI
proxy        ─┘                   ↑
                          PRE-PERSISTENCE (§13)
```

Rules: never mutate source artifacts; store a SHA-256 for every captured blob; content-address everything (the same file read twelve times is stored once — a large real-world saving); redact before writing, never after.

---

## 12. Trust: captured vs derived

Drishya shows as much genuine reasoning as the harness legitimately exposes — assistant text between tool calls, thinking blocks where present, plan and task updates — and **never claims to show reasoning it does not have**.

**The Provenance Ledger.** Every Pulse and every rendered string carries:

```
provenance: {
  kind: "captured" | "derived" | "inferred",
  origin: "<hook event> | <file>:<line> | blob:<sha256>",
  confidence?: number
}
```

**One visual grammar, applied everywhere, never a popup:**

| Kind | Rendering |
|---|---|
| **Captured** | Solid 2 px left edge, full-contrast text |
| **Derived** (heuristic or LLM summary) | Dashed left edge, −12% saturation, small `∿` mark |
| **Inferred** (structure Drishya reconstructed, e.g. batch boundaries in adapters without them) | Dotted left edge |

A global **"hide derived"** setting exists and genuinely removes derived content rather than dimming it.

**Cost model for derived summaries.** Default is heuristic titles from observable facts — `Read auth.py 40–90 after searching "session"` — costing nothing and requiring no credentials. LLM summaries are opt-in, batched once per Turn (never per Pulse), cached by content hash, and marked derived. A local-first product must not need an API key to be useful.

---

## 13. Privacy and security

### 13.1 Redaction, before persistence

Redaction runs in the ingest path, **before** anything is written to SQLite, the blob store, a cache, or the screen. Once a secret is in the store it is in the user's backups.

- **Pattern detectors:** AWS keys, GCP/Azure credentials, JWTs, `-----BEGIN * PRIVATE KEY-----`, bearer tokens, connection strings, `.env` assignments.
- **Entropy detector:** high-entropy strings above a length threshold in assignment position.
- **Path denylist, default-on:** `.env*`, `*.pem`, `*.key`, `id_rsa*`, `secrets/**`, `**/credentials*`.
- **Redaction map** records *that* a redaction occurred, its type and location, without the value. The user can see their secrets were caught without the tool storing them.

### 13.2 Localhost is not a security boundary

A local server that hands out your source code is reachable by any process on the machine and, absent care, by web pages via DNS rebinding. Mitigations, all v1:

- Bind **127.0.0.1 only**, never `0.0.0.0`.
- Per-session random token required on every request; the browser is launched with it in the URL fragment.
- **`Origin` and `Host` header validation** — reject anything not matching the expected loopback origin. This is the DNS-rebinding defence.
- No CORS wildcards, ever.
- WebSocket upgrades validate origin identically.

### 13.3 Data handling

Local-first by default: zero telemetry, no account, no network calls except explicit user-invoked update checks. Retention controls with a default sweep. Export produces a **replay bundle** — a self-contained, redacted, portable directory the user may choose to share; nothing leaves the machine unless the user exports it.

---

# PART III — ENGINEERING

## 14. Technology decisions

Each decision states the alternative rejected, because the reasoning matters more than the choice.

### 14.1 Application form — **localhost web app + local daemon; Tauri v2 wrapper at v1.5; never Electron**

| Option | Verdict |
|---|---|
| **A. Localhost web app + daemon** | ✅ **v0–v1.** User's own Chromium: best-in-class WebGL/WebGPU, zero packaging. `npx drishya` is the lowest-friction install in open source, and the competitor set proves the pattern works (`npx agent-flow-app` `[V]`) |
| **B. Tauri v2** | ✅ **v1.5 wrapper.** 3–10 MB bundles, 40–80 MB idle RAM vs Electron's 120–200 MB / 150–400 MB `[V]`. **Caveat:** Linux uses WebKitGTK, with documented weakness for heavy canvas/WebGL `[V]` — and Linux is a large share of this audience |
| **C. Electron** | ❌ 3× the RAM budget before a frame renders. The product promise is performance |
| **D. VS Code extension (primary)** | ❌ Sandboxed webview, constrained GPU, cramped panel, and it contradicts harness-agnosticism. Ship a thin extension that *launches* the web app — cheap distribution, zero architectural cost |

**Hard rule:** the web build must always work standalone. Tauri is a wrapper, never a fork. On Linux the Tauri build offers "Open in system browser" as a first-class escape hatch.

### 14.2 Terrain renderer — **PixiJS v8, WebGL2 now, WebGPU behind a flag**

PixiJS v8 supports WebGPU but **recommends WebGL for production** due to browser implementation inconsistencies `[V]`, while WebGPU now ships in all major browsers `[V]`. Pixi's renderer abstraction makes the eventual switch a config change — exactly the hedge wanted. WebGPU becomes the `Cinematic+` tier when Pixi's implementation stabilizes.

- **vs three.js:** the Terrain is 2.5D — a layered plane with parallax, depth-of-field and glow, not a 3D world. Pixi is a 2D scene graph with excellent batching and filters; three.js is 3D machinery to fight. Also, 3D code graphs are *taken* (GraphiQuest, Karna) and are harder to read.
- **vs Sigma.js:** Sigma is a graph renderer with its own opinions; Drishya needs a *scene* with the graph as one layer. Use **graphology** (Sigma's underlying data library) for structures and layout, render in Pixi.
- **vs Cosmograph:** fast GPU layout, but it brings its own visual identity.

### 14.3 The three-layer rendering rule

1. **Pixi WebGL canvas** — Terrain only.
2. **DOM / React** — all text, code, diffs, controls. Selectable, accessible, screen-readable.
3. **CSS `backdrop-filter` surfaces** between them — the translucent depth.

**Text is never rendered in WebGL.** This is what delivers the premium look *and* accessibility *and* text selection simultaneously, and it is the thing most cinematic UIs get wrong.

### 14.4 Code and diff views — **CodeMirror 6, not Monaco**

Monaco is ~5 MB and expensive per instance; Drishya needs *many* small read-only views plus one full Reader. CM6 is modular, tree-shakeable, and designed for exactly that. Small Stage cards use **pre-highlighted static HTML** (highlighting from the Tree-sitter output already computed for the graph) with no editor instance at all; only the Reader mounts a real CM6 instance, and it is disposed on close.

### 14.5 Daemon language — **TypeScript everywhere** (changed recommendation)

The first draft said Python, for one reason: it would reuse an existing Tree-sitter engine. That engine is out of scope — everything is built from scratch — so the premise is gone and the decision has to be made again on its merits. It comes out differently.

**TypeScript, on Node (or Bun), for the daemon as well as the frontend.**

| Argument | Weight |
|---|---|
| **One language for a duo** | Decisive. Two people shipping ASAP can review each other's work, swap tasks when one is blocked, and hold one mental model. Two toolchains means two test setups, two CI paths, two dependency stories, and a constant context switch |
| **The schema stops being duplicated** | [`reference/03-event-schema.md`](reference/03-event-schema.md) is written in TypeScript. With a TS daemon **that file is the implementation**, shared by both sides through one package. With Python it becomes a spec that two codebases drift away from — and the schema is the core contract (§11.1) |
| **The frontend is unavoidable and it is the bulk of the work** | Whoever builds this writes a lot of TypeScript regardless. Python would be a *second* language added on top, not a first language kept |
| **`npx drishya` is the install this audience expects** | Every competitor in the space ships this way `[V]` |
| **Node is fine at the actual workload** | Tailing JSONL, watching files, serving 1–3 WebSocket clients — I/O-bound, which is what Node is good at |

**Where Node is genuinely weak — parsing and indexing a large repository — mitigate in this order:** the right Tree-sitter binding (below); a `worker_threads` pool for fan-out; incremental on-disk indexing so a cold full index happens once. **If measurement shows indexing misses the §15 budget, move only the indexer** to a native module via `napi-rs`. Do not move the daemon.

#### Tree-sitter binding — **start with WASM**

Tree-sitter is a C parser library, and there are two ways to use it from Node:

| | `node-tree-sitter` (native) | `web-tree-sitter` (WASM) |
|---|---|---|
| What it is | The C library compiled to a native binary for each OS + Node version | The same C compiled to WebAssembly — one portable file |
| Speed | Faster | Slower; expect roughly 1.5–3× parse time `[A — measure]` |
| Install | Needs a prebuilt binary for the user's exact platform. **If none matches, npm tries to compile on install, which needs a C toolchain — and fails on a lot of Windows machines** | Always works. No compiler, no prebuilds, no platform matrix |

**Decision: `web-tree-sitter`.** A failed `npx drishya` on a stranger's Windows laptop costs a user permanently; a slower cold index costs seconds, once, and is hidden behind progressive reveal (§10.4) anyway. Parsing is also not the bottleneck — import resolution and layout are (§10.6).

**Revisit only if** the M0 measurement shows cold indexing of a 5,000-file repo exceeding the 30 s budget. Then either add `node-tree-sitter` with `prebuildify` as an *optional* fast path with WASM as the fallback, or move the indexer to `napi-rs`. Never make the fast path the only path.

Stack: Node 22+ / Bun · Fastify or Hono · `ws` · `chokidar` · `better-sqlite3` (synchronous, fast, WAL) · `web-tree-sitter`.

**When Python would win instead.** If the second builder is a backend specialist who will own the daemon and indexer exclusively and never touch the renderer, the split-language cost mostly disappears and Python's AST ergonomics are genuinely nicer. That is a real scenario — decide it by who is actually writing what, and record the decision in [`STATUS.md`](STATUS.md). The rest of this blueprint is unaffected either way: nothing in the architecture depends on the daemon's language, only on the schema.

**Still rejected: a Rust rewrite.** The classic failure of ambitious small teams is spending the first months on a substrate rewrite and never reaching the thing users see.

### 14.6 Storage

SQLite in WAL mode: append-only `events`, plus `runs`, `pulses`, `blobs`, `graph_nodes`, `graph_edges`, `layout`. **FTS5** for search. **No vector index until measured** — search over a session is small and lexical search is likely sufficient.

**Content-addressed blob store:** `blobs/<sha256[0:2]>/<sha256>`. Deduplication is large in practice (the same file read repeatedly stores once), and it provides integrity hashes for provenance for free.

### 14.7 Frontend

React 19 + TypeScript, Vite. **Zustand** for one declarative scene state — not Redux, not per-component state. The scene composer is a pure function producing a `Scene[]`; React renders it. **Build a scene composer, not a component dashboard** — this is an architectural commitment that determinism (§9.6) depends on.

Animation: `motion` for orchestration plus raw CSS transforms for hot paths; Pixi's own ticker for Terrain. One easing set, timing tokens from §7.4, everything cancellable.

---

## 15. Performance budgets and how they are measured

The base prompt's targets, with four changed and three added. Justification given for each change.

| Measure | Base prompt | **Blueprint** | Why |
|---|---|---|---|
| Repo size | 5k comfortable / 50k supported | Unchanged | Reasonable |
| Session | 300 turns hot, 5k replay | Unchanged | Reasonable |
| **RAM (UI)** | ≤1.5 GB Balanced / ≤600 MB Efficient | **≤900 MB / ≤450 MB** | 1.5 GB means we are holding blobs we should be streaming. A tighter budget **forces the correct lazy-loading architecture**; a loose one hides the bug until users complain |
| RAM (daemon) | ≤300 MB | ≤300 MB active, **≤150 MB idle-tailing** | Idle is the common case and must be invisible |
| Frame rate | 60 / 30–60 / 30 | Unchanged | Right |
| Live latency | <250 ms to visible | Unchanged, **+ ≤50 ms event→store** | Capture must never be gated on rendering |
| Indexing | 5k files <30 s cold | Unchanged, **+ ≤50% of cores, niced** | **The agent must never slow down.** A product promise, not a nicety |
| Seek | 300 ms cached / 1 s cold | Unchanged | Right |
| **Time to first frame** | — | **≤2 s** from launch to rendered L0 Terrain | First impression decides adoption; progressive reveal makes it achievable |

**Measurement plan.** A fixture corpus (§17.3) and a `drishya bench` command run in CI: cold index time on 3 repo sizes, frame-time p50/p95 during a scripted replay, peak RSS for UI and daemon, seek latency cached and cold, event→store and event→visible latency. Budgets are **CI gates**, not aspirations — a regression fails the build.

**Auto-tiering:** when frame time exceeds budget for 2 s, step down one quality tier and tell the user in the corner, once, non-modally. When it recovers for 10 s, offer to step back up. Never step up silently.

---

## 16. Settings and quality tiers

Modelled on a game graphics menu and a video editor's preview settings, because performance is part of the promise and the user should control it.

| Group | Controls |
|---|---|
| **Terrain** | On/off · semantic depth (L0–L3 cap) · edge density · minimap · DB reference layer · alternative background (blurred topology / void / generative field / user image) |
| **Motion** | Full / Reduced / Off · per-effect toggles: event trails, camera easing, focus transitions, particles, glow, depth-of-field |
| **Quality** | Efficient / Balanced / Cinematic (+ Cinematic+ WebGPU when available) · render scale 0.5–2× · FPS cap 30/60/120/uncapped · GPU acceleration · pause-on-blur · battery-saver respect |
| **Pacing** | Lens preset · mode (Paced/Raw/Follow/Paused) · `lag_target` · `D_min`/`D_max` · coalescing aggressiveness · evidence density (Maximum / Standard / Executive) |
| **Memory** | Hot window (turns **and bytes**) · pinned artifacts · disk cache size · auto-compaction · retention days |
| **Privacy** | Redaction rules · path denylist · redaction audit view · retention · export scope |
| **Accessibility** | Reduced motion (honours OS `prefers-reduced-motion`) · high contrast · font scale · keyboard playback · **screen-reader timeline** (the run as a navigable list of landmarks) |

**Efficient and reduced-motion are designed states, not broken ones.** Efficient mode: Terrain at L0 static, no blur (opaque scrims instead — contrast floor preserved), transitions replaced by 90 ms cross-fades, Stage occupancy 1. It should look *deliberately austere*, and it must remain fully usable — a reviewer on a laptop on battery is a real user, not a degraded one.

---

## 17. Testing and validation

### 17.1 Golden sessions

The determinism rule (§9.6) makes this possible: replay a recorded session with fixed settings, serialize the resulting `Scene[]` stream, diff against a committed golden file. Any unintended choreography change fails CI. This is the test that keeps a cinematic UI from silently rotting.

### 17.2 Adapter conformance

Each adapter runs against committed fixture files and must: emit a schema-valid stream, correctly reconstruct Run/Turn/Row/Beat/Pulse, mark provenance accurately, and **degrade rather than crash** on unknown record types (this is what protects against format drift, which is certain — Codex's record set was still growing in 2026 `[V]`).

### 17.3 Fixture corpus

**Fix the number the base prompt left inconsistent: five recorded sessions**, across at least two repositories, chosen to cover: a short clean run; a long run with compaction; a run with a failing test and a fix; a multi-agent run with subagents; a run with a permission denial and a retry. Plus a synthetic pathological session (2,000 Pulses in 30 s) for pacing stress, and three repos of ~500 / ~5,000 / ~50,000 files for indexing.

### 17.4 Product validation — testing the §2 claims

The cognitive argument makes predictions; test them with 5–8 developers:

| Task | Measure | Predicted |
|---|---|---|
| "Is this agent working in the right area?" | Time to correct answer | **Several times faster** than transcript |
| "Why does this diff hunk exist?" | Time + correctness | Faster, with higher accuracy |
| "What else might this change break?" | Recall of downstream components | Transcript baseline ≈ 0 |
| Post-session recall, 24 h later | Components named unprompted | Higher (the §2.3 spatial-memory claim) |

**Retention instrument (self-reported, no telemetry):** *replays opened per merged agent PR*. If that number is not above zero a month after real users arrive, the product is a demo, and §3.1 says the fix is in the Review lens, not in more visual polish.

### 17.5 Other

Playwright for UI journeys and visual regression (with a masked Terrain canvas region to avoid GPU-driver flake). `axe` for accessibility and an automated contrast check across all three quality tiers. Perf smoke in CI per §15.

---

## 18. Packaging, distribution and deployment

### 18.1 Install paths

| Path | Command | For |
|---|---|---|
| **npm** | `npx drishya` / `npm i -g drishya` | The default. Zero install, instant, what this audience expects |
| **Bun** | `bunx drishya` | Same package |
| **Binary** | Signed installers / tarballs | Everyone else |
| **Homebrew** | `brew install drishya` | macOS, after v1 |
| **VS Code** | Extension that launches the app | Distribution surface only |

### 18.2 Build and release

Frontend → Vite build → static assets, shipped inside the npm package. Daemon → the same package, run by the installed Node. Optional standalone binaries via `bun build --compile` or `pkg` for macOS (arm64/x64), Linux (x64/arm64), Windows (x64), for users without Node.

**Native module caveat:** `better-sqlite3` and `node-tree-sitter` are native addons and need prebuilds per platform, or the install fails on machines without a build toolchain. Use `prebuildify`, or prefer `web-tree-sitter` (WASM, no native build) and accept a modest parse-speed cost. **Decide this at M0** — a broken `npx` on Windows is the fastest way to lose a first-time user.

**Signing costs to plan for `[A]`:** Apple Developer Program is ~$99/yr and required to avoid Gatekeeper blocking; Windows code signing is similar or more. Until then, push people toward `npx`, which sidesteps signing entirely, and ship unsigned standalone binaries with a documented SmartScreen/Gatekeeper bypass. Budget the Apple certificate before the Tauri build ships — an unsigned macOS app loses a meaningful fraction of first-time users at the security dialog.

### 18.3 CI/CD (GitHub Actions)

`lint + typecheck` → `unit` → `golden-session replay` → `adapter conformance` → `Playwright + visual regression` → `perf gates (§15)` → `build matrix` → `release on tag`. Perf gates fail the build; they are not advisory.

### 18.4 Runtime deployment model

There is no server. The daemon runs on the user's machine, loopback-bound, token-gated (§13.2), started on demand and stopped with the app. Ports are auto-selected with a stable default (7717). **One daemon, multiple watched roots** — chosen because most users have one machine and several repos.

### 18.5 The hosted demo — the highest-leverage asset

A **static, read-only replay bundle** of a real session, hosted on GitHub Pages, scrubbable in the browser with no install and no daemon.

This is the single most valuable marketing artefact and it costs almost nothing once the replay player exists, because a replay bundle is already a self-contained directory (§13.3). **No competitor has this** `[V]` — every one of them requires cloning and running before you can see anything. Putting a scrubbable real run on the landing page means the argument in §2 is *experienced* in fifteen seconds rather than read.

Make it the landing page. Make the README's first element a 45-second loop of Moments 1, 2 and 5.

---

## 19. Open-source strategy

### 19.1 Licence — **Apache-2.0 throughout, plus a trademark policy**

Reasoning, since AGPL is the reflexive answer:

- The product is **local-first with no SaaS to protect**. AGPL defends against a threat model that does not apply here.
- AGPL has a real adoption cost: many organizations ban AGPL software on developer machines outright. That directly attacks the growth strategy.
- Apache-2.0 matches the ecosystem (Agent Flow is Apache-2.0, Karna is Apache-2.0, Event Horizon is MIT `[V]`) and includes an explicit patent grant, which MIT lacks.
- **The protection that actually matters for an OSS devtool is the trademark, not the copyleft.** A brand policy stopping forks from using the name preserves the thing that can be taken; the code being copied is how adoption happens.

### 19.2 Architecture for contribution

The adapter is the contribution surface. Publish an **Adapter SDK**: the normalized schema, a conformance test suite, a template adapter, and documentation of the capability levels. The realistic path to "most harnesses" is other people writing adapters — so the SDK is a v1 deliverable, not a v2 one, and its quality determines whether §6.3's "Later" column ever ships.

Schema versioning is semver with a documented stability policy, because third-party adapters depend on it.

### 19.3 Commercial layer, if ever

Only additive, never by crippling the local app: team replay libraries, shared annotated reviews, SSO. Decided later; the local product must be complete on its own or the open-source strategy is a bait-and-switch and will be read as one.

### 19.4 Launch

Sequence: hosted demo live → README with the 45-second loop → `npx drishya` working on three platforms → post where this audience is (HN, r/LocalLLaMA, r/ClaudeAI, X). The headline is not "pretty agent visualizer". It is:

> **Your agent already recorded everything. You just can't read it.**

Followed immediately by the scrubbable demo. Lead with the §1 problem, not the graphics, because the graphics are what a reader discounts as a demo and the problem is what they recognize as their own.

---

## 20. Roadmap — milestones, not dates

**There is no schedule.** Two builders, no fixed hours, ship as fast as it is good. So the plan is a **dependency order with exit gates**, not a calendar: each milestone is done when its gate passes, and nothing downstream starts before it does.

Live tracking of who is doing what belongs in [`STATUS.md`](STATUS.md), not here. This section defines the order and the gates; that file records position.

### How two builders share this

**No fixed ownership split.** Both builders work anywhere in the codebase, review each other's work, and take the next thing from the queue. For a codebase this size that is the right call: shared ownership means both people understand the whole system, which matters more than parallelism when the architecture is still settling.

What that gives up is worth naming so it can be managed rather than discovered:

| Risk of shared ownership | Mitigation |
|---|---|
| **Both editing the same file at once** — the real cost, and it is merge pain, not skill overlap | Claim work in [`STATUS.md`](STATUS.md) *before* starting. One line. This is the whole protocol |
| Two agents independently solving the same problem differently | The decisions log in `STATUS.md`. If it is settled, it is written down, and neither agent re-derives it |
| Architecture drifting in two directions | This document is the source of truth, and `CLAUDE.md` puts it in front of every agent automatically |

**Still true regardless of who does what: the event schema is the seam.** [`reference/03-event-schema.md`](reference/03-event-schema.md) plus the graph API is the contract between capture and rendering. Agree it at M0, change it only by agreement, and the two halves of the system can be built and tested independently whoever is holding them.

**And the decoupling mechanism is fixtures, not people.** Rendering work runs against recorded sessions from day one and never waits for live capture — which is also exactly why replay-first (§3.1) is the right build order. If one person is ever blocked waiting on the other, the fixture corpus is too small; grow it.

---

### M0 · Foundations and the go/no-go

*Both areas. The only milestone where sequence genuinely matters.*

| Area | Work |
|---|---|
| **Capture side** | Repo skeleton, TypeScript monorepo, SQLite schema, CAS blob store. **Capture 5 fixture sessions** (§17.3). Tree-sitter parse + symbol table + **import resolution** for Python and TS (§10.6 stages 1–3) |
| **Scene side** | Design tokens, the three-layer render shell (§14.3), Pixi canvas with a static placeholder graph, **Lift prototyped against a fake graph** (motion catalog §0.6) |
| **Both** | Freeze v1 of the event schema. Decide native-vs-WASM Tree-sitter (§18.2) |

**Gate — the project's real go/no-go:** index 10 real OSS repos and hand-check a sample of resolved edges. **Do the maps look like the systems they represent?**

- *Yes* → proceed as written.
- *No* → Terrain descopes to clusters + dependency edges + centrality, which is still more than anything in Camp A has, and §10.2's degradation path takes over.

This is deliberately uncomfortable: the hardest, least glamorous, most likely-to-fail component gets validated **before** anything beautiful is built, while there is still time to reshape the product around the answer.

---

### M1 · The replay player — *the first thing worth showing*

| Area | Work |
|---|---|
| **Capture side** | Claude Code **transcript** adapter (files only, no hooks) · normalizer → Run/Turn/Row/Beat/Pulse · call graph + PageRank + Leiden clusters + **persisted layout** (§10.6 stages 4–7) |
| **Scene side** | Scene composer **as a pure function** · Rail, Stage, Reader · **four presentations** — read, search, edit, bash · Terrain L0–L2 with linked seek · golden-session tests from the first composer commit |

**Gate:** replay a real session end to end · seek to any turn under 300 ms · map and content move together · Lift works from real nodes.

**Ship: the hosted demo (§18.5).** This is the first public artefact and it should exist here — before the product is good. Feedback from strangers beats more solo polish, every time.

---

### M2 · Live

| Area | Work |
|---|---|
| **Capture side** | `drishya attach claude` — hook ingest over HTTP, setup/teardown/status (§11.2b) · redaction pipeline **before** persistence |
| **Scene side** | Pacing engine: classifier, governor, coalescing, simulator (§9) · return-to-live · remaining presentations · subagent presence · **Review lens** |

**Gate:** pacing metrics pass §9.8 on all five fixtures · p95 lag < 5 s on a live run · hooks add no measurable latency to the agent · `detach` fully reverses `attach`.

---

### M3 · Second harness and depth

| Area | Work |
|---|---|
| **Capture side** | `drishya attach codex` — streaming parse + offset index (§11.5) · **Adapter SDK + conformance suite** · entrypoint detectors and flow extraction (§10.6 stages 8–9) · incremental indexing |
| **Scene side** | Blast radius · collision signal · Beat stacks and evidence density · settings and quality tiers · auto-tiering |

**Gate — the test of whether the abstraction was real:** the renderer contains **zero** harness-specific code. If Codex required touching the scene layer, the seam was wrong and it is cheaper to fix here than later.

---

### M4 · Release

Packaging for three platforms · docs site · perf gates green in CI · user study (§17.4) · licence, trademark policy, README, launch (§19.4).

---

### Sequencing rules that protect the plan

1. **No second harness until the loop is excellent on the first.** Breadth before depth is exactly how this becomes another Camp A tool.
2. **No new feature while a perf gate is red.** Performance is a product promise (§15).
3. **Golden tests from the first composer commit.** Determinism cannot be retrofitted (§9.6).
4. **Ship the demo at M1**, before it is good.
5. **Neither side blocks the other.** If scene work is waiting on capture work, the fixture corpus was too small — grow it. Fixtures are the decoupling mechanism, and they are cheap.
6. **The schema changes only by agreement**, recorded in `STATUS.md`. It is the seam; unilateral changes to a seam cost a duo more than they save.

---

## 21. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Pipeline extraction is not good enough on real repos** | **Highest** | Validated at M0, before the expensive UI. Designed degradation to clusters + dependency edges, which still beats Camp A. §10.2 |
| 2 | **"Cool demo, no daily use"** — the classic death of visualization products | **Highest** | The durable job is *review*, not *watch* (§3.1). Review lens in v1. Instrument replays-per-PR, not stars |
| 3 | Harness format drift | High | Conformance suite, declared version ranges, skip-unknown-records, graceful degradation. Certain to happen `[V]` |
| 4 | Solo bandwidth vs scope | High | Phase gates; the §20 sequencing rules; explicit non-goals (§5.4) |
| 5 | Vendor absorption (Antigravity, ChatGPT desktop) | Medium-high | Cross-harness is the one position vendors structurally cannot take (§4.1). Revisit quarterly |
| 6 | Performance on a real 16 GB laptop with Chrome already open | Medium-high | Tightened budgets (§15) as CI gates; Efficient mode as a designed state |
| 7 | Fast-follower clones the look | Medium | Expected, and it happened to a competitor in five weeks `[V]`. The answer is layer 1, not more polish (§5.3) |
| 8 | Privacy incident — a secret persisted | Medium, **unrecoverable** | Pre-persistence redaction, default-on denylist, audit view, zero telemetry (§13) |
| 9 | Node indexing too slow at 50k files | Medium | Measured at M0. Port only the indexer via `napi-rs` if needed (§14.5) |
| 10 | Name conflict | **Resolved** | Renamed to Drishya. Appendix A |
| 11 | Localhost server leaks source to a malicious page | Medium | Origin/Host validation, token, loopback bind — all v1 (§13.2) |
| 12 | **Duo desync** — two builders and four agents drifting on a shared architecture | Medium-high | This file is the single source of truth; [`STATUS.md`](STATUS.md) holds position; `CLAUDE.md` points every agent at both. Schema changes by agreement only (§20 rule 6) |

---

## 22. Open questions

Most of the v1.0 questions are now answered — no fixed schedule (milestone-based, §20), Claude Code and Codex only (§11), renamed (Appendix A), nothing reused (§10.6). These remain.

1. **Does Agent Flow show real content on click?** The single most important unfinished piece of research. The entire "click any moment and get the file, not a label" positioning rests on it, and right now it is a README *absence* rather than a verified fact (evidence pack §5, item 1). **Run it before writing any marketing copy.**
2. **Trademark clearance for Drishya** in class 9/42, before any commercial use. npm, GitHub and domain are checked (Appendix A); the trademark is not.

### Answered since v1.0

| Question | Answer |
|---|---|
| Time budget, target date | None. Milestone-based roadmap, ship as fast as it is good (§20) |
| Which harnesses | Claude Code and Codex only, each with its own attach strategy (§11.2b) |
| The name | **Drishya**, npm verified free (Appendix A) |
| Reuse an existing indexer | No. Everything from scratch, Python + TypeScript first (§10.6) |
| Ownership split between builders | **None.** Shared ownership, mutual review, claim work in `STATUS.md` (§20) |
| Native or WASM Tree-sitter | **WASM** (`web-tree-sitter`) to start (§14.5) |

---

## Appendix A — The name

**Decision: the product is named Drishya.**

### Why "Vantage" was dropped `[V]`

It is occupied in developer tooling, in the exact category. `vantage.sh` is an established multi-cloud cost platform in use at thousands of companies and explicitly positioned "For Developers"; `vantage.software` exists in another vertical; `vantage-org/vantage` on GitHub is *a developer's build tool*. The `.com` is gone, `.dev` and `.sh` sit next to a known devtools brand in search, and the GitHub org name is taken by another build tool. That is a live collision, not a hypothetical one.

### Why "Drishya" — दृश्य

*dṛśya* — **"that which is seen; a scene; the visible."**

In Indian epistemology *dṛśya* (the seen) pairs with *draṣṭā* (the seer). The whole product is the act of making an agent's work **dṛśya** — taking what happened and was recorded but never perceived, and rendering it visible. That is §1 in one Sanskrit word.

It also lands on the product's own vocabulary: the atomic unit the scene composer emits is a **Scene**, which is what *dṛśya* means. The name and the architecture use the same word.

Practical filters: two to three syllables, pronounceable globally (*DRISH-ya*), Indic origin, and it names what the product *does* rather than what it looks like.

### Availability, verified 20 Sep 2026

| Surface | Status |
|---|---|
| **npm `drishya`** | **Free** `[V]` — registry returns 404. `npx drishya` will work |
| GitHub user/org `drishya` | Taken `[V]` — dormant user, 0 public repos, created 2015. Use an org like `drishya-dev`, or host under a personal namespace |
| `drishya.ai` | Taken `[V]` — Drishya AI Labs, energy-industry AI. Different vertical, but an AI-graph company, so avoid `.ai`. **Use `drishya.dev`** |
| Trademark | Not checked `[A]` — run USPTO/EUIPO class 9/42 before any commercial use |

**Note on npm:** a package-name collision would not have blocked the *command* name anyway — npm's `bin` field maps a command to a script independently of the package name, so `@drishya/cli` could still install a `drishya` command. The unscoped name being free just means `npx drishya` works with no scope, which is the cleanest possible install line.

### The alternatives that were close

| Name | Meaning | Why not |
|---|---|---|
| **Yantra** (यन्त्र) | "Instrument, machine" *and* "geometric diagram modelling a whole system" — a Sri Yantra is a cosmos rendered as a map. Arguably the most exact concept fit | npm taken by an abandoned 2018 library `[V]`; more existing Indian-company usage |
| **Pratyaksha** (प्रत्यक्ष) | "Before the eyes" — direct perception, the first *pramāṇa*, explicitly opposed to *anumāna* (inference). Deepest fit: it is the captured-vs-derived thesis (§12) | Four syllables; hardest to say and type for a global audience |
| **Spanda** (स्पन्द) | "Pulse, vibration" — and Pulse is already the atomic event unit (§8) | npm taken by an actively maintained package `[V]` |
| **Pravaha** (प्रवाह) | "Flow, stream" — the pipeline concept | npm taken `[V]` |
| **Zoetrope** | A device turning discrete still frames into visible motion — literally the replay engine | Not Indic; three syllables |

---

## Appendix A2 — Moving the project folder without losing Claude Code history

This matters more than it looks: when a session's chat history is where the project's real context lives, losing it is expensive. The durable fix is that **the docs must be better than the chat** (§App. B) — but the history is still worth keeping, and it *can* be kept.

### How Claude Code keys sessions `[V]`

Sessions live at `~/.claude/projects/<slug>/`, where `<slug>` is the project's **absolute path with `/`, `\`, `:` and `.` all replaced by `-`**. Rename the folder and Claude Code computes a different slug, finds nothing, and creates a new empty directory. The old sessions are not deleted — they are orphaned.

This is a known, repeatedly reported limitation; several requests to make sessions follow a moved folder were closed as not-planned `[V]`.

### The migration, which does work

Rename the folder **and** everything keyed to its path, together. Scripts are in `scripts/`, both with a dry-run mode:

```powershell
# Windows
.\scripts\Rename-Project.ps1 -OldPath "C:\...\vantage" -NewPath "C:\...\drishya" -DryRun
```

```bash
# macOS / Linux
DRY_RUN=1 ./scripts/rename-project.sh /path/to/vantage /path/to/drishya
```

They perform the same six steps: back up `history.jsonl` and `.claude.json`; move the project folder; move `~/.claude/projects/<slug>/`; rewrite path references in `history.jsonl`; rewrite the per-project key in `.claude.json` (JSON-validated, restored from backup if the result would not parse).

Everything under the session directory moves with it — `memory/` (auto-memory) and each session's `subagents/` and `tool-results/`. `~/.claude/file-history/` is keyed by **session id**, not path, so it needs nothing.

**Use the PowerShell script on Windows, including under WSL.** Bash cannot do this job on Windows: WSL sees `/mnt/c/...` while Claude Code builds its slug from the native `C:\...` path, so the two can never agree.

**Gotchas `[V]`:**
- The slug encodes `.` as `-` as well, so a folder with a dot in its name needs care.
- A Windows drive colon plus separator collapses to a doubled dash (`C:\` → `C--`).
- **Paths appear inside JSON in three forms** — raw (`C:\Users\…`), JSON-escaped (`C:\\Users\\…`) and forward-slash (`C:/Users/…`). A rewrite that handles only one silently misses the rest. The scripts replace all three, longest-first.

**Caveat `[A]`:** transcript lines keep a historical `cwd` pointing at the old path. Listing and resume key off the directory, so this appears harmless — but resume one session after migrating, before deleting the backups.

### The separate problem: the desktop app and accounts `[V]`

Distinct from renaming, and not fixable by moving files:

- **The desktop app's session list is account-scoped.** Switch accounts and the sidebar empties, even though everything is local.
- **CLI and desktop keep separate session lists.** CLI reads `~/.claude/` directly and is account-independent, which is why sessions "missing" in the app are still reachable from the terminal.

Both are open, acknowledged issues. **The practical rule: treat the app's sidebar as a convenience, never as storage.** The transcripts are on disk either way, and `claude --resume` in the project directory reaches them regardless of which account the app is signed into.

### What follows for this project

The chat is not the memory. `BLUEPRINT.md`, `STATUS.md` and `CLAUDE.md` are — they survive renames, account switches, retention sweeps and the end of a session, and a new agent reads them in thirty seconds. **If losing a conversation would lose real context, that context belongs in these files instead.**

One retention detail worth acting on `[V]`: `~/.claude/projects/*.jsonl` and `file-history/` are swept after `cleanupPeriodDays`, **default 30**. Raise it in `~/.claude/settings.json`, and archive any session worth keeping — which dovetails with M0 needing five recorded sessions as fixtures (§17.3) anyway. **Archive the good ones into the repo as fixtures and the retention problem solves itself.**

---

## Appendix B — Document map

Two files carry state; the rest carry knowledge. Keep the distinction — a source of truth that also tracks position goes stale, and a stale source of truth is worse than none.

| Document | Contains | Kind |
|---|---|---|
| **This file** | The spine: need, positioning, product, architecture, performance, deployment, roadmap, risks | **Knowledge** |
| [`STATUS.md`](STATUS.md) | Where we are · what is next · who did what · decisions log · open decisions | **State** |
| [`../CLAUDE.md`](../CLAUDE.md) | Agent entry point: what to read, the non-negotiable constraints, working agreements | **Knowledge** |
| [`reference/01-evidence-pack.md`](reference/01-evidence-pack.md) | Verified harness formats with sources, competitor teardown, corrections to the base prompt | **Knowledge** |
| [`reference/02-motion-catalog.md`](reference/02-motion-catalog.md) | Presentation and motion spec per action type, with drill-down and degraded modes | **Knowledge** |
| [`reference/03-event-schema.md`](reference/03-event-schema.md) | Normalized event schema, adapter contract, capability declaration | **Knowledge** |
| `Vantage_Base_Prompt.md` | The original brief. Kept for provenance, superseded where this document disagrees | Archive |

**For a duo with agents:** `CLAUDE.md` loads automatically into every Claude Code session in this repo, so it is the one file guaranteed to be read. It stays short and points here. This file is what an agent reads when it needs to know *why*. `STATUS.md` is what it reads to know *where*.
