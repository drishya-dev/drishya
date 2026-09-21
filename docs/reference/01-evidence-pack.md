# Reference 01 — Evidence Pack

> **Historical research, reviewed 21 September:** Some conclusions below are overstated or outdated. Use the [new research ledger](../review/04-research-ledger.md) and [product findings](../review/01-product-review.md#3-findings-that-change-the-plan) for current decisions. Agent Flow does render content; newer documented integration surfaces exist; HTTP hooks are not async command hooks; unavailable Karna evidence and market-exclusivity claims are not current proof. `[V]` below records the previous document's classification, not blanket re-verification by this review.

**Verified 20 September 2026.** Everything in the blueprint tagged `[V]` traces to this file. Everything tagged `[A]` is listed in §5 as still needing validation.

This file exists because base prompt §0 rule 2 says: verify the facts you rely on, and label every claim. The base prompt's own §11 competitor assessment was explicitly offered as a hypothesis to test. §4 below reports the test result, including where it was wrong.

---

## 1. Claude Code — capture surface

### 1.1 Hooks: 32 events `[V]`

Source: [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)

`SessionStart` · `Setup` · `UserPromptSubmit` · `UserPromptExpansion` · `PreToolUse` · `PermissionRequest` · `PermissionDenied` · `PostToolUse` · `PostToolUseFailure` · **`PostToolBatch`** · `Notification` · `MessageDisplay` · `SubagentStart` · `SubagentStop` · `TaskCreated` · `TaskCompleted` · `Stop` · `StopFailure` · `TeammateIdle` · `InstructionsLoaded` · `ConfigChange` · `CwdChanged` · `DirectoryAdded` · `FileChanged` · `WorktreeCreate` · `WorktreeRemove` · `PreCompact` · `PostCompact` · `PreModelSwitch` · `PostModelSwitch` · `Elicitation` · `ElicitationResult`

**Common stdin payload (all events):**

```json
{
  "session_id": "string",
  "prompt_id": "UUID (absent until first user input)",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "scratchpad_dir": "...",
  "permission_mode": "default|plan|acceptEdits|auto|dontAsk|bypassPermissions",
  "effort": { "level": "low|medium|high|xhigh|max" },
  "hook_event_name": "PreToolUse",
  "agent_id": "subagent-uuid (when inside subagent)",
  "agent_type": "agent-name (when using --agent or in subagent)"
}
```

**Tool-event extras:** `tool_name`, `tool_input`, `tool_use_id`, `tool_response` (Post only).
**Other event extras:** `session_start_reason`, `session_end_reason`, `notification_type`, `compaction_trigger`, `from_model`/`to_model`, `last_assistant_message` (Stop), `file_path` (FileChanged), `load_reason` + `file_path` (InstructionsLoaded).

### 1.2 Why this changes the plan

| What the base prompt assumed | What is true `[V]` | Impact |
|---|---|---|
| Row boundaries must be inferred from timing | **`PostToolBatch` fires "after a full batch of parallel tool calls resolves"** | The row rule is native. Blueprint §8 is now a data structure, not a heuristic |
| Claude Code is Level 1–2 | Lifecycle, subagents, approvals, compaction, tasks, file changes all exposed | **Level 3**. Blueprint §11.3 |
| Hooks mean installing shell scripts | Handler types are `command`, **`http`**, `mcp_tool`, `prompt`, `agent` | Install is a settings block pointing at loopback. No scripts, no PATH, cross-platform |
| Thinking may be unavailable | Assistant entries carry `thinking` blocks in the transcript (§1.3) | Real reasoning display where present, still governed by the trust rule |

The `http` handler takes `url`, `timeout`, `headers`, `allowedEnvVars`. Command handlers support `async: true` and `asyncRewake` — relevant to the "never block the agent" constraint.

**Matchers** are per-event and filter on tool name (`Bash`, `Edit|Write`, `mcp__.*`), start/end reason, agent type, compaction trigger, etc. Values containing characters outside `[A-Za-z0-9_\-, |]` are treated as unanchored regex. `UserPromptSubmit`, `PostToolBatch`, `Stop` and several others take no matcher and always fire.

### 1.3 Transcript format `[V]`

Sources: [claude-dev.tools JSONL reference](https://claude-dev.tools/docs/jsonl-format) · [frederick-douglas-pearce/claude-code-sessions](https://github.com/frederick-douglas-pearce/claude-code-sessions) · [simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts)

Path: `~/.claude/projects/<encoded-project-path>/<session-id>.jsonl`, where the encoding replaces non-alphanumerics in the absolute path with `-`.

Universal per-line fields: `type` · `uuid` · `parentUuid` · `timestamp` (ISO 8601) · `sessionId` · `cwd` · `gitBranch` · `version`.

| Line type | Carries |
|---|---|
| `user` | `message.content` — string, or blocks including `tool_result` with `tool_use_id` |
| `assistant` | `message.content` — array mixing `text`, `thinking`, `tool_use` blocks; `message.usage` with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` |
| `system` | Compaction boundaries, summaries, file snapshots, team coordination |
| `summary` | Session summaries |

`parentUuid` makes the transcript a **tree**, not a list — forks and retries are representable. Drishya's Rail must handle branches; a naive linear reader will silently mis-order forked sessions.

**Caution:** system entry types "evolve across Claude Code versions" `[V]`. Parsers must skip unknown types.

### 1.4 Where the real bytes live `[V]`

Source: [Explore the .claude directory](https://code.claude.com/docs/en/claude-directory)

```
~/.claude/projects/<project-path-hash>/
├── <session-id>.jsonl                      # transcript
├── <session-id>.orphaned-<ts>-<suffix>.jsonl
├── <session-id>.jsonl.superseded-<ts>
└── <session-id>/
    ├── subagents/<subagent-id>/<transcript>.jsonl
    └── tool-results/<tool-output-id>.json  # LARGE OUTPUTS SPILLED HERE

~/.claude/file-history/<session-id>/
└── <file-path-hash>.snapshot.N             # PRE-EDIT ORIGINALS, up to 100

~/.claude/plans/<plan-id>.md                # plan-mode documents
~/.claude/shell-snapshots/<session-id>.sh
~/.claude/image-cache/<session-id>/<image-id>
~/.claude/tasks/<task-list-id>/
```

**This is the single most useful finding in the pack.** "Show real content, not labels" is the product's core promise, and it turns out to be a filesystem read:

- `file-history/*.snapshot.N` are **pre-edit file contents** — a true before/after diff with no git dependency and no reconstruction from diff hunks.
- `tool-results/*.json` hold **untruncated** large outputs that the transcript elided.
- `subagents/` gives real multi-agent content rather than just "a subagent ran".

**Retention `[V]`:** `projects/*.jsonl`, `file-history/`, `plans/`, `image-cache/`, `tasks/` are swept after `cleanupPeriodDays` (default **30**). Drishya must copy what it needs into its own store at ingest, or replays decay.

**Privacy `[V]`:** the docs state transcripts and history are stored **unencrypted**. This is exactly why blueprint §13.1 puts redaction before persistence — Drishya would otherwise create a *second* unencrypted copy of the user's source and secrets.

---

## 2. Codex — capture surface `[V]`

Sources: [openai/codex#24948](https://github.com/openai/codex/issues/24948) · [Session/Rollout Files discussion](https://github.com/openai/codex/discussions/3827) · [agent-ouija rollout package](https://pkg.go.dev/github.com/kylesnowschwartz/agent-ouija/codex/rollout) · [Where Six AI Coding CLIs Store Session Logs](https://allaboutcoding.ghinda.com/where-ai-coding-clis-store-session-logs/)

**Path:** `~/.codex/sessions/YYYY/MM/DD/rollout-YYYY-MM-DDTHH-MM-SS-<uuid>.jsonl` (undocumented officially).

**Structure:** line 1 is `session_meta`. Then mixed record types: `event_msg`, `response_item`, `turn_context`, `compacted`, and — observed July 2026 — `world_state` and `inter_agent_communication_metadata`. **The record set is still growing**, which is a direct instruction to write a tolerant parser.

**Contents:** user prompts, model responses, tool calls, tool results, approval decisions, token usage.

### 2.1 The size hazard

Issue #24948 documents a single rollout file at **732 MB**, with the class of problem reaching **700 MB – 2 GB**, caused by repeated persistence of compaction history and raw tool output.

**Design consequences, non-negotiable:**
- Stream-parse with a bounded reader. Never `read()` a session file.
- Build an offset index (`seq → byte offset`) so seeking does not re-scan.
- Cap individual record size; spill the remainder to the blob store.
- Never hold a Codex session in daemon memory — it would breach the 300 MB daemon budget on its own.

### 2.2 The "Codex merged into ChatGPT desktop" question

The base prompt asked whether this invalidates the rollout-file path. Evidence as of this date: rollout files at `~/.codex/sessions/` are still the documented-by-community location, still actively discussed and filed against in 2026 `[V]`. The CLI persists locally regardless of the desktop app's packaging. **Treat the CLI path as live and re-verify before the Phase 3 build** `[A]`.

---

## 3. Other harnesses `[V]`

Source: [Where Six AI Coding CLIs Store Session Logs](https://allaboutcoding.ghinda.com/where-ai-coding-clis-store-session-logs/)

| Harness | Path | Format | Notes |
|---|---|---|---|
| **Claude Code** | `~/.claude/projects/<project>/<session>.jsonl` | JSONL | Plus spill dirs (§1.4) |
| **Codex CLI** | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | JSONL | Undocumented; size hazard |
| **Cursor CLI** | `~/.cursor/chats/<id>/<uuid>/store.db` | SQLite — `blobs`, `meta` tables | Undocumented; payloads in blobs |
| **Amp CLI** | `~/.local/share/amp/threads/T-*.json` | JSON per thread | Server-side storage is primary — local may be partial |
| **opencode** | `~/.local/share/opencode/opencode.db` | SQLite — projects/sessions/messages/parts | JSON text payloads |
| **pi** | `~/.pi/agent/sessions/--<cwd>--/<ts>_<uuid>.jsonl` | JSONL tree with parent IDs | Branching, like Claude Code |

**Pattern worth noting:** three of six are JSONL trees with parent pointers and two are SQLite. A normalized schema with an explicit causal-parent field (reference 03) covers both shapes without special-casing.

---

## 4. Competitive landscape — testing the base prompt's hypothesis

Base prompt §11 offered its assessment as a hypothesis: *"they all show parts of what I want, but none does it with this visual depth... and none creates a strong need."* Here is the test result.

### 4.1 Where the base prompt was wrong

| Base prompt claim | Finding | Why it matters |
|---|---|---|
| Agent Flow "roughly 990 stars and 111 forks" | **~1.7k stars** `[V]` — [repo](https://github.com/patoles/agent-flow) | It has roughly doubled. This is not a slow-moving project in a quiet space |
| "Upstream looks slow-moving" | Active: Codex support shipped, multiple forks, open PRs | Assume a live competitor, not a stalled one |
| "The repo description still says Claude Code only" | Now describes Claude Code **orchestration** and auto-detects both runtimes `[V]` | Description has been updated |
| (User, in conversation) "almost very less competition with no active commits" | At least four new entrants in 2026 across both camps `[V]` | **The market is busy.** See §4.3 for why that is good news |

### 4.2 Where the base prompt was right — and it is the important part

**Agent Flow's graph renders the agent's execution flow, not repository structure** `[V]`. From the repo: it shows "how agents break down problems, call tools, and coordinate across branches", with "click agents and tool calls to inspect details", plus "the full execution timeline, file attention heatmap, and message transcript."

Two things follow, and they are the whole thesis:

1. **There is no repository model.** Files appear in an attention *heatmap* — a frequency ranking, not a structure. Blueprint Moments 1 and 3 are not expressible in that data model at any level of polish.
2. **Detail arrives as a transcript panel.** That is precisely the lossy graph-as-line encoding argued in blueprint §2.4. The README does not document full file content or diffs at a clicked node `[V — absence of evidence; verify by running it, §5]`.

Also confirmed: **the npx build ships opt-out anonymous telemetry** `[V]` (session count, duration, event count, OS/arch, version, model IDs; explicitly not prompts, paths, tool calls or env vars). Disclosed and narrow — but "opt-out" versus Drishya's "none" is a real, permanent, zero-cost differentiator for a tool that reads source code.

### 4.3 The structural finding: two camps that never meet

This is the most valuable output of the research, and it reframes the strategy.

**Camp A — agent-execution visualizers.** Agent Flow (~1.7k★) · [Event Horizon](https://github.com/HeytalePazguato/event-horizon) (MIT, VS Code, agents as planets, *also orchestrates*) · [Claude Code Agent Monitor](https://github.com/hoangsonww/Claude-Code-Agent-Monitor) (D3 DAGs, Sankey, cost analytics; *also controls*) · [claude-office](https://github.com/paulrobello/claude-office) (pixel-art office) · [agent-pixel-visualizer](https://github.com/maharshi-coding/agent-pixel-visualizer) · [disler observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) (event feed).
→ They have the **agent stream**. They have **no repository model**.

**Camp B — code knowledge graphs.** [CodeGraph](https://github.com/colbymchenry/codegraph) (pre-indexed, 9 harnesses, auto-sync) · [Graphify](https://github.com/Graphify-Labs/graphify) (Tree-sitter + LLM over code/docs/SQL/PDFs) · [Axon](https://github.com/harshkedia177/axon) (Sigma.js/WebGL, hulls, impact radius, Cypher) · [Karna](https://github.com/shailesht003/karna-ai) (MCP graph + alpha `karna live .` 3D agent view) · [GraphiQuest](https://github.com/Bosheda/graphiquest) (local-first 3D).
→ They have the **repository map**. They have **no clock**, and they were built to save the *agent* tokens, not to help the *human*.

**On reuse:** none of these is adopted. Drishya's indexer is built from scratch (blueprint §10.6), because their data models target retrieval rather than a timeline with stable persisted layout and per-edge provenance — adapting one would cost more than writing one. They remain useful as references for *scalable graph exploration* (Axon) and *3D terrain feel* (GraphiQuest).

**Nobody has joined them.** Karna is nearest — a live 3D view of agent activity on a code graph — and its own framing is a token-saving MCP tool with the visualization as an alpha side feature `[V]`.

**Why this is better news than an empty market.** An empty market usually means no demand. Camp A's star counts prove developers want to watch their agents. Camp B's existence proves the map is buildable. What nobody has done is the expensive middle: a repository map with a clock and the real bytes attached. Demand is validated; the hard version is unbuilt.

### 4.4 Vendor encroachment is real and was underrated

**Google Antigravity 2.0**, launched at Google I/O **19 May 2026** `[V]` — [developers blog](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/) · [antigravity.google](https://antigravity.google/):

- **Agent Manager**: a dedicated surface, separate from the editor, for running and supervising up to five parallel agents — monitor them from one control surface, review artifacts, approve pending actions.
- **Artifacts**: plans, task lists, screenshots, browser recordings, code diffs — framed explicitly as letting a human "verify an agent's work quickly instead of reading raw logs."
- 2.0 added a standalone desktop app, CLI, SDK, enterprise tier, dynamic subagents.

That is the supervision gap, named by Google, with a shipped product against it. Plus: the Codex app merged into ChatGPT desktop with inline diff editing and a PR review panel.

**The structural limit that protects Drishya:** a vendor visualizes *its own* agent, in *its own* IDE, against *its own* artifacts. Antigravity will never show a Claude Code run. ChatGPT desktop will never show Codex next to Cursor. The multi-harness developer is a growing population no vendor can serve — and cross-harness is the one position that gets *more* valuable as vendors fragment.

### 4.5 Polish is not a moat — with a dated example

Base prompt §11 already noted it; the evidence confirms it. An "Office" mode with Sims-like avatars and rooms was proposed on Agent Flow via PR on **5 September 2026** `[V]`, roughly five weeks after the metaphor appeared elsewhere. Separately, `claude-office` and `agent-pixel-visualizer` are independent implementations of essentially the same idea.

A visual metaphor is cloned in weeks. A multi-language call graph with entrypoint detection, flow traversal and stable persisted layout is not. Blueprint §5.3 orders the defensibility layers accordingly.

---

## 5. Still unverified — the `[A]` list

Ranked by how much the plan moves if the answer is unexpected.

| # | Open item | Why it matters | How to close it |
|---|---|---|---|
| 1 | **What Agent Flow actually reveals on click** — full file region? real diff? complete command output? Or labels + transcript panel? | This is *the* differentiator claim. It must be tested, not assumed from a README | Run it against a live Claude Code session; capture a read, an edit and a failing test. Base prompt Step 1 |
| 2 | **Import resolution accuracy** for Python and TypeScript on real repos — path aliases, re-exports, `__init__.py`, barrel files | The call graph is only as good as this, and it is where most of the indexer's difficulty lives (blueprint §10.6) | M0 spike: index 10 OSS repos, hand-check a sample of resolved edges |
| 3 | **Do the 4 entrypoint detectors cover real repos?** | Blueprint §10.2's core assumption; the whole moat rests on it | M0 spike on 10 OSS repos |
| 4 | **Does Codex still write `~/.codex/sessions/` post-ChatGPT-desktop merge?** | Phase 3 adapter | Re-verify at Phase 3; run it and look |
| 5 | Node indexing speed at 5k and 50k files | Decides whether `napi-rs` is needed | M0 measurement |
| 6 | Candidate name availability (Drishya, Bezel, Vigil, Parallax) | Naming decision | Domain + USPTO/EUIPO search |
| 7 | Event Horizon / Karna hands-on | Learn from the most visually ambitious and the nearest-to-the-join | Install and use |

**Item 1 is the most important unfinished piece of research in this project.** The entire positioning rests on "click any moment and get the file, not a label." If Agent Flow already shows full content on click, the differentiator narrows to the repository map and replay — still real, but the pitch changes. Test it before writing a line of marketing copy.

---

## 6. Technology evidence

### 6.1 Rendering `[V]`

- WebGPU now ships in all major browsers; Safari 26 (Sept 2025) closed the last holdout. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- **PixiJS v8 supports WebGPU but recommends WebGL for production** — "inconsistencies in browser implementations may lead to unexpected behavior." [PixiJS renderers](https://pixijs.com/8.x/guides/components/renderers)
- WebGPU's advantages are lower CPU overhead, more objects, and compute shaders.

→ Blueprint §14.2: WebGL2 now, WebGPU behind a `Cinematic+` flag. Pixi's renderer abstraction makes it a config switch, so the hedge costs nothing.

### 6.2 Desktop shell `[V]`

Source: [Tauri vs Electron 2026 comparisons](https://www.buildmvpfast.com/blog/tauri-v2-vs-electron-desktop-apps-2026)

- Tauri bundles ~3–10 MB vs Electron ~120–200 MB; idle RAM ~40–80 MB vs ~150–400 MB.
- **"If your UI depends on... heavy canvas/WebGL behavior, or pixel-perfect rendering, you need real cross-platform test coverage before choosing Tauri."**
- **Tauri uses WebKitGTK on Linux, with known performance issues on some distributions.**

→ Blueprint §14.1: web app first (user's own Chromium, zero packaging, best GPU path), Tauri as a later wrapper with a Linux "open in system browser" escape hatch, Electron rejected on the RAM budget alone.

---

## 7. Name conflict `[V]`

Searched 20 Sep 2026:

- **vantage.sh** — established multi-cloud cost management platform, explicitly positioned "For Developers", reported in use at ~4,600 companies.
- **vantage.software** — separate product, sign and print industry.
- **github.com/vantage-org/vantage** — "a developer's build tool that cares for your environment."
- **Teradata Drishya** — analytics database.

For a developer tool this is a live collision in the exact category, not a hypothetical one: `.com` is gone, `.sh` and `.dev` sit next to a known devtools brand in search, and a GitHub org name is taken by another build tool.

→ Blueprint Appendix A: rename now, while the cost is zero.

---

## 8. Source index

**Harness formats**
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Explore the .claude directory](https://code.claude.com/docs/en/claude-directory)
- [Manage sessions — Claude Code Docs](https://code.claude.com/docs/en/sessions)
- [Claude Code JSONL transcript format](https://claude-dev.tools/docs/jsonl-format)
- [frederick-douglas-pearce/claude-code-sessions](https://github.com/frederick-douglas-pearce/claude-code-sessions)
- [simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts)
- [Where Six AI Coding CLIs Store Your Session Logs](https://allaboutcoding.ghinda.com/where-ai-coding-clis-store-session-logs/)
- [openai/codex issue #24948 — rollout file size](https://github.com/openai/codex/issues/24948)
- [openai/codex discussion #3827 — session/rollout files](https://github.com/openai/codex/discussions/3827)

**Competitors**
- [patoles/agent-flow](https://github.com/patoles/agent-flow) · [HeytalePazguato/event-horizon](https://github.com/HeytalePazguato/event-horizon) · [hoangsonww/Claude-Code-Agent-Monitor](https://github.com/hoangsonww/Claude-Code-Agent-Monitor) · [paulrobello/claude-office](https://github.com/paulrobello/claude-office) · [maharshi-coding/agent-pixel-visualizer](https://github.com/maharshi-coding/agent-pixel-visualizer) · [disler/claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability)
- [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) · [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) · [harshkedia177/axon](https://github.com/harshkedia177/axon) · [shailesht003/karna-ai](https://github.com/shailesht003/karna-ai) · [Bosheda/graphiquest](https://github.com/Bosheda/graphiquest)

**Vendors**
- [Build with Google Antigravity](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/) · [antigravity.google](https://antigravity.google/) · [Antigravity docs](https://antigravity.google/docs/home/)

**Technology**
- [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) · [PixiJS renderers](https://pixijs.com/8.x/guides/components/renderers) · [Tauri v2 vs Electron 2026](https://www.buildmvpfast.com/blog/tauri-v2-vs-electron-desktop-apps-2026)

**Name**
- [vantage.sh](https://www.vantage.sh/) · [vantage-org/vantage](https://github.com/vantage-org/vantage) · [vantage.software](https://www.vantage.software/)
