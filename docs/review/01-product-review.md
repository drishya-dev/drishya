# Drishya: product review and build recommendation

21 September 2026 · Review of blueprint v1.2 and its three references

**Recommendation: build Drishya as a cinematic, evidence-linked review workspace for coding-agent work.** Live observation attracts attention; understanding an unfamiliar change is the repeatable job. Preserve the ambitious visual direction, but prove that the visual language improves review before investing in a comprehensive static-analysis engine.

This is a design and research review, not evidence that the product works. The repository contains documentation and maintenance scripts, with no application, adapters, benchmarks or user-study results. Research here consists of primary documentation and targeted competitor source inspection; no competitor was installed or evaluated in a live user session. Sources and limits are in [04-research-ledger.md](04-research-ledger.md).

Read this document for the argument and priorities, [02-experience-spec.md](02-experience-spec.md) for the interface, and [03-engineering-plan.md](03-engineering-plan.md) for implementation. These review recommendations supersede conflicting v1.2 planning claims where the blueprint's review notice says so. The existing event schema remains a draft; proposed changes are listed for the two builders to agree before freezing it.

## 1. The idea worth preserving

The original vision is more ambitious than a graph with a transcript beside it. An operation should become a manipulable scene: a place in the codebase, the content observed there, a change to that content, and a path back to the evidence. The developer controls the pace. They can stop on a line while collection continues, then rejoin the present.

That is feasible as a local browser application. Its difficulty is not drawing translucent surfaces. The difficult combination is accurate historical content, useful relationships, comprehensible pacing, dependable capture, and a composition that works for hours rather than thirty seconds.

The premium quality comes from the agreement between these layers. A beautiful transition into the wrong file version is worse than a plain, accurate diff. A correct replay hidden behind tiny type and constant movement will not be used. Give engineering truth and visual craft equal acceptance criteria.

**Working category:** agent work review. **Product description:** a visual record of what your coding agents read, changed and checked. **Brand line:** “Keep up with what your agents change.” Keep **Drishya** and the visible/scene association already established in the repository. Naming availability and commercial clearance remain separate questions; this review did not establish either.

## 2. What the existing docs get right

- Local operation, explicit provenance, observe-only behavior and replay are a coherent foundation.
- Terrain / Stage / Rail / Reader provides a useful vocabulary for an integrated experience.
- Lift can teach location without requiring a second explanatory panel.
- DOM text over a GPU-rendered map is a sensible separation of responsibilities.
- Captured fixtures and a deterministic presentation engine can decouple capture from design work.
- Byte-bounded caches, quality presets and graph levels of detail address real constraints.
- A shared adapter contract is the route to breadth without bespoke interfaces for every harness.

Keep these. The changes below remove assumptions that would otherwise make the product misleading or very expensive to finish.

## 3. Findings that change the plan

Severity here means impact on the proposed product, not a vulnerability rating for an application that does not exist.

| Priority | Finding in existing docs | Consequence | Required correction |
|---|---|---|---|
| P0 | README and blueprint §1 say everything has already been recorded | Missing/truncated data becomes a broken promise | Say “captured evidence”; make availability visible per artifact |
| P0 | §9.8 requires every edit/failure to receive a moment while live lag stays bounded | Impossible under sustained overload | Separate durable capture, live awareness and paced review; permit counted critical groups |
| P0 | §11.3 combines HTTP hooks and nonblocking guarantees | Installation can add latency or wait during daemon failure | Default passive tailing; optional measured enrichment; see research ledger |
| P0 | Schema mixes captured data with inferred grouping, salience and graph resolution under one provenance value | Derived relationships can look like facts | Immutable observations plus versioned projections and field/link provenance |
| P0 | File snapshots are treated as sufficient for arbitrary before/after history | Partial reads, shell edits and concurrent edits defeat reconstruction | Versioned artifacts, base hashes, validity intervals and explicit gaps |
| P0 | Motion catalog §5 says the next edit was caused by a test failure | Temporal proximity is presented as causality | “Related activity” unless an explicit source establishes the link |
| P0 | Redaction is a principle, but roadmap delays its implementation to M2 | M0/M1 real fixtures could persist secrets | Privacy pipeline before the first real import; synthetic fixtures until then |
| P1 | Marketing says competitors only show labels | Source inspection disproves this | Compete on the complete review workflow, not absence of content |
| P1 | “Nobody has joined them”, “no vendor can serve this”, and stars prove demand | Unsupported exclusivity and market validation | Treat the opportunity as a hypothesis; test against native tools and actual users |
| P1 | Cursor/OpenCode are framed primarily as private-database integrations | Unnecessary reverse engineering and maintenance | Investigate documented hooks/server endpoints first |
| P1 | Codex is framed as rollout-only Level 1–2 | Integration roadmap is incomplete | Evaluate current hooks; distinguish accessible server APIs from passive attachment |
| P1 | Pipeline extraction/BFS is described as an execution flow | Static dependencies are not runtime order | Distinct edge types, uncertain paths and bounded reachability |
| P1 | M0 prioritizes ten repository maps as the product go/no-go | Can spend weeks proving analysis before proving a useful experience | First gate: read → edit → test → inspect evidence, against a small real session |
| P1 | Pure composer takes all events; schema creates fresh UUIDs | Slow seeks and duplicate imports threaten determinism | Stable source IDs, indexed checkpoints and a bounded projection window |
| P1 | Wrapper/proxy exception contradicts observe-only and never-launch rules | Scope quietly becomes agent infrastructure | Exclude wrappers and interception proxies from this product plan |
| P1 | “Never mutate harness files” conflicts with automatic hook setup | Unclear integration contract | Adapters never write harness data; initial setup is manual, with future explicit config installation |
| P1 | Native SQLite remains while WASM is said to remove install failures | Packaging promise is incomplete | Test actual packed package on clean supported machines without compilers |
| P2 | Typewriter commands, staggering code and counting test totals | Simulated activity delays already available evidence | Reveal content intact; animate spatial relationships, not the reading task |
| P2 | Any pointer event cancels all animation; controls auto-hide | Mouse movement destabilizes the view; navigation is difficult to discover | Interrupt on interaction intent; keep a quiet transport visible |
| P2 | A paused agent freezes the entire world | Other concurrent agents appear paused too | Scope waiting/approval states to the affected agent |
| P2 | Confidence >0.6 and fixed human reading speeds appear authoritative | False precision | Rule categories and empirical calibration; dwell is a preview, not proof of comprehension |
| P2 | Package availability/trademark issue described as resolved | Availability is volatile and not legal clearance | Retain name; remove clearance implications until independently checked |

The architecture should not require confidence that all existing prose is correct. This review's corrections, the test corpus and versioned compatibility reports replace that confidence with inspectable evidence.

## 4. Competition: the real benchmark

Agent Flow already documents live graphs, concurrent Claude Code/Codex observation and replay. At the inspected commit, its content renderer includes edit and write snippets; tool detail renders results. Some inspected views truncate content. This is **source-level evidence**, not an end-to-end completeness test. The old “file, not a label” comparison must be retired. [Agent Flow README](https://github.com/patoles/agent-flow), [inspected renderer](https://github.com/patoles/agent-flow/blob/84cd2fb8c704cefe52e6dd41a375c4069442e206/web/components/agent-visualizer/tool-content-renderer.tsx).

| Alternative | Why a user chooses it | What Drishya must demonstrate |
|---|---|---|
| Native terminal/editor + Git diff | Already installed; fast; full developer context | Faster accurate answers about selected changes, without another burdensome workflow |
| Agent Flow and execution visualizers | Immediate understanding of agent/tool activity | Historical content, provenance-linked navigation and a more legible review experience |
| AgentFlow VS Code extension by hercieAI | Its listing already advertises live views and playback controls | Merely adding play/pause or a DAG is not a differentiator |
| LangSmith / Langfuse | Instrumented agent/application tracing, outputs and operational investigation | A developer's local source-change workflow with useful file history and little setup |
| Repository graph tools | Structural exploration and code relationships | Link structure to a particular run and its exact captured versions |
| Vendor agent workspaces | Integrated agent execution and artifacts | Observe independently running supported harnesses without migrating the user's workflow |

The last distinction is **harness independence**, not model variety. Antigravity already lists models from multiple providers. A model picker and observation of external Claude Code/Codex processes are different capabilities. There is no defensible basis for saying vendors can never enter this market. [Antigravity models](https://antigravity.google/docs/models).

LangSmith and Langfuse are adjacent rather than identical products, but they invalidate sweeping claims that observability tools cannot expose inputs, outputs or useful trace context. [LangSmith observability](https://docs.langchain.com/langsmith/observability), [Langfuse observability](https://langfuse.com/docs/observability/overview).

**Differentiation to test:** “From a changed line to the captured work around it, in one continuous workspace.” The conjunction matters: historical content + temporal navigation + repository context + usable craft + independent harnesses. None alone is sufficient.

Do not equate a competitor's unfamiliar visual style with a weak product. A dense table can outperform a gorgeous scene for an expert. Drishya should win an equivalent task, not a screenshot contest.

## 5. Users and the need

Start with developers who use agents several times a week on an existing codebase and personally review the changes. Especially recruit people returning to an agent run after doing something else. They have an observable problem and can assess accuracy. “Everyone who uses agents” remains a possible future audience, not a useful initial design target.

The 2025 Stack Overflow survey reports 46% distrust versus 33% trust in AI accuracy, with 66% frustrated by nearly correct answers and 45% by time-consuming debugging. These are respondent reports, not proof that a visual review product will sell. They support investigating verification work. [2025 AI survey](https://survey.stackoverflow.co/2025/ai).

METR's early-2025 study and its February 2026 follow-up illustrate why perceived productivity and measured outcomes must be distinguished. Its later discussion explicitly identifies study-design and selection difficulties as tools and usage change. Do not market an old slowdown result as a current universal property of coding agents. [METR 2025 study](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/), [2026 update](https://metr.org/blog/2026-02-24-uplift-update/).

| User situation | Felt need | Proposed experience | Observable outcome |
|---|---|---|---|
| Returns after a 20-minute run | Rebuild context without rereading everything | “While you were away”: changed files, failures, unreviewed events | Time to explain a selected change correctly |
| Encounters a surprising diff | Find the supporting evidence | Select hunk → related read/test/message → captured content | Correct evidence identification, with uncertainty understood |
| Agent changes an unfamiliar subsystem | Learn enough to own the result | Local path through related files with event-time source | Explain one relevant dependency and its limitation |
| Two agents touch the same area | Know whether their work overlaps | Same-worktree write overlap, separate branch comparisons | Identify actual shared-workspace overlap without false conflict claims |
| Hands work to another developer | Transfer context efficiently | Portable replay excerpt plus selected evidence | Recipient answers review questions without original operator |
| Teaches or demonstrates agent work | Present a meaningful process | Bookmarked, paced replay with private content excluded | Audience navigates to the actual evidence |

Avoid making people watch continuously. The ability to look away and return confidently is a stronger benefit than turning agent work into mandatory spectator activity.

## 6. Creative features that earn repeat use

### 6.1 Change story — the initial product

Click an actual diff hunk. It stays anchored while related captured items arrange left to right: source region, relevant result, agent-authored explanation if available, edit, subsequent check. Each link states its basis. A temporal association is labeled “nearby activity”; it is not silently renamed “reason”.

The default continuous canvas already accumulates left-to-right action passages with unboxed prose underneath. Change story adds explicit evidence navigation within that history. Passages wrap or group when needed, so the session remains vertically navigable rather than one endless horizontal feed. See [the user-directed composition](../reference/04-continuous-canvas.md).

### 6.2 Return briefing — the habit

Remember the user's last review cursor locally. On return, offer the interval since that cursor: edits, failures and unresolved capture gaps. “Viewed” means displayed or opened; only an explicit review action means reviewed. No inferred approval.

This feature connects the exciting live view to the everyday task of owning agent-written code. It is not a generated final answer; every entry opens its evidence.

### 6.3 Verification trail — make missing evidence visible

For a selected change, show the checks captured after it, their outcomes and their workspace identity. If the file changed after the last passing check, label that check as preceding the latest change. If the relationship to the hunk is unknown, say so. “No test observed” means no test in the available capture, not proof none was run.

Never turn this into a correctness score. The value is making the limits of the record easy to inspect.

### 6.4 Follow a question through a run

Users can follow a file, symbol or selected set of events across time. All other activity compresses into context landmarks. This creates a coherent path through a run without requiring an LLM to invent a narrative.

### 6.5 Compare intent and change

Pin the user's stated goal or an agent plan beside the changed-file route. Optional user-tagged areas define scope. A detected excursion reads “activity outside selected area”, not “the agent is wrong”. Authentication work may be necessary to fix checkout.

### 6.6 Same-workspace overlap

Show observed writes to the same file/range by different agents in the same worktree. Prior reads can be shown as shared attention, but cannot predict an impending conflict with certainty. Different worktrees are a comparison opportunity, not a live file collision.

### 6.7 A replay people can hand over

Export a selected interval with a manifest, allowed source content, provenance and gaps. Let the recipient open it without a harness or account. Public hosting is a separate, explicit step. A replay link is useful distribution because it solves collaboration, not because it locks up the user's data.

### 6.8 Context boundaries

Mark observed compaction and expose the captured summary where available. Preserve pre-compaction Drishya history independently. Do not claim knowledge of the model's current memory or attention from a compaction marker alone.

Prioritize Change story, Return briefing and Verification trail. They provide a reason to reopen the app. Elaborate agent avatars, a model leaderboard, universal chat, generic token dashboards and animated wallpaper do not get priority over this loop.

## 7. “Generate need” through an honest demonstration

The need already exists if developers spend effort reconstructing unfamiliar work. Make that cost visible and remove it. Do not manufacture insecurity or suggest every agent-generated change is dangerous.

Proposed landing copy:

> **Your agent changed 18 files. Start with the one you don't understand.**
>
> Explore the captured reads, edits and checks around a change. Replay at your pace, in a workspace that stays on your machine.
>
> **Try a replay** · **Open a local session**

This is example copy, not a factual statement about the current product. Until a real build ships, label the demo as a concept and never advertise unimplemented harness support.

The opening demonstration should show the interaction before any explanation:

1. A restrained repository map, one changed source region in focus.
2. Select an unfamiliar hunk; the scene reveals a relevant captured failure and original read.
3. Scrub backward; the file returns to its recorded prior version.
4. Pause and select code while an independent live indicator continues.
5. Jump to the next edit; reduce motion or disable the map; the review still works.

The memorable moment is **an answer the viewer can verify**. Lift is how the answer arrives.

## 8. Scope and sequence

| Stage | Deliverable | Explicitly deferred | Exit evidence |
|---|---|---|---|
| A: experience proof | One replay, real captured read/edit/test, history gaps, Change story, keyboard transport, map-off state | Comprehensive graph, live, many adapters | Users answer evidence questions more accurately or faster than their baseline |
| B: reliable local alpha | Privacy-first ingest, Claude import + passive live, bounded storage, restart recovery, quality presets | Cloud, wrappers, database contents | Crash/rotation/redaction fixtures pass; install works on declared platform matrix |
| C: architecture proof | Codex fixture mapping early, then second complete adapter; independent agent lanes; stable file/import graph | Every framework, universal call graph | Same renderer handles both; no false historical substitution |
| D: public release | Supported Claude/Codex versions, replay bundles, documentation, clean installation, accessibility | Paid team infrastructure | Repeat use by target users; review and performance gates pass |
| E: expansion | OpenCode, Cursor, Gemini CLI based on demand and capture quality; framework detectors | Untested “all harnesses” claim | Each adapter passes published capability fixtures |

Bring a **small Codex fixture** into Stage A to challenge the schema. Do not build two full integration products immediately. This removes the old false choice between ignoring the second harness until late and spreading implementation effort across everything.

The first prototype should cover roughly 30–80 meaningful actions and a handful of files. Keep the visual experience representative, not the infrastructure oversized. The ten-repository analysis benchmark remains valuable as an indexer gate later; it is not the first product gate.

## 9. Research plan and go/no-go rules

These are proposed decision thresholds, not results or industry benchmarks.

**Problem interviews:** 12 developers: six daily agent users who review their own work, three team reviewers, three newer developers. Ask about the last real agent change they distrusted, what they did next, and the time spent. Ask for a voluntarily supplied, sanitized example. Do not start by showing the visual design or asking whether they like the idea.

**Usability study:** 8–12 participants, counterbalanced tasks across native transcript + editor + diff and Drishya. Use equivalent seeded tasks, not the same puzzle twice. Measure correct answers, time, unsupported confidence, and capture-gap recognition. Separate experienced and unfamiliar-repo results. An attractive interface that raises confidence without accuracy fails.

**Product thresholds to test:** median time to correctly explain a selected change improves by at least 25%; evidence accuracy does not fall; at least 80% of participants correctly recognize missing/inferred evidence. Report individual results and ranges; this small study is directional, not a population-level claim.

**Retention pilot:** 10 consenting design partners for two weeks. Target six voluntarily returning across three separate workdays, with at least four describing a concrete review benefit. Gather interviews and explicitly shared local usage summaries. Zero product telemetry remains the default contract. Installs, stars and video views are secondary.

**If visual replay is slower:** narrow the default to change-first review and reduce choreography. **If the map adds no benefit:** retain it as an optional exploration layer while improving evidence navigation. **If capture is incomplete too often:** narrow supported versions and show capability limits before asking users to depend on it. **If review is rarely needed:** reconsider the audience before adding more graphics.

## 10. Distribution and business

Keep the repository's Apache-2.0 direction for the local core as the current project choice. This review is not new legal advice or brand clearance. The local product should include useful replay, supported adapters, export and the full reading experience without a subscription.

Release the inspectable demo and a short interaction recording together. Publish technical examples about specific jobs: “Find what preceded this hunk”, “Resume review after an unattended run”, and “Distinguish a test pass from a later untested edit”. Avoid unsupported superlatives and named-competitor insults.

Recruit design partners directly only with explicit permission to contact them. Suggested channels are harness communities, existing open-source contributors, code-review educators and developer demonstrations. Maintainers can adopt adapters when the contract, fixtures and compatibility policy are straightforward.

Potential paid work comes later: managed team replay storage, shared annotations and review workflow, access controls, organization retention administration, private deployment support. Charge for operating a team workflow, not for unlocking readable source. Validate willingness to pay with actual pilot commitments before building SaaS. Do not invent a market size or price from adjacent tools.

The durable advantages could become capture compatibility, trustworthy historical replay, review ergonomics, a fixture corpus, community adapters and a recognized visual language. None is impossible to copy. The product must keep earning preference.

## 11. Immediate build brief

Build one convincing interaction: **select a changed hunk → inspect captured supporting material → scrub to its previous state → return to current activity without losing your place.**

Use a small TypeScript repository, a privacy-reviewed Claude fixture, a tiny Codex fixture for schema pressure, a file/import map and five event presentations. Include reduced motion, missing evidence and an overloaded burst in the first design review. Do not start with a general graph engine, ten themes or production orchestration.

The next milestone is not “looks expensive”. It is “looks exceptional, and helps a developer answer an important question correctly”.
