# Research ledger and evidence limits

Checked 21 September 2026. Primary documentation and selected public source only. Source pages can change. “Documented” means the source describes the capability; it does not mean Drishya has tested it. Proposed mechanisms elsewhere in this review are engineering recommendations, not claims of working implementations.

## Integration findings

| ID | Evidence | Consequence for Drishya |
|---|---|---|
| H1 | Claude Code documents `PostToolBatch`, including tool IDs and serialized results. Its HTTP hook type exists, but `async: true` is available only to command hooks. Hooks otherwise block by default. | Do not equate HTTP delivery with nonblocking observation. Batch membership alone is not enough to assert exact execution overlap. [Hooks reference](https://code.claude.com/docs/en/hooks) |
| H2 | Claude documents subagent transcripts, spilled tool outputs and pre-edit checkpoint snapshots. Retention and checkpoint limits apply. | These are useful capture inputs, not a guarantee that every historical file version exists. [Directory reference](https://code.claude.com/docs/en/claude-directory) |
| H3 | Codex now documents pre/post tool hooks and background command hooks. Unified exec completion can arrive on a later polling call. | The old rollout-only assessment is incomplete; test an optional hook enrichment path. Preserve source tool identity across asynchronous completion. [Codex hooks](https://learn.chatgpt.com/docs/hooks) |
| H4 | Codex App Server documents streamed items, command output, file changes and reasoning summaries; raw reasoning text is conditional on model support. | This is a potential integration surface, not proof that a passive client can attach to any independently running app session. Never promise all internal thinking. [App Server](https://learn.chatgpt.com/docs/app-server) |
| H5 | OpenCode documents a server API, session reads and an SSE event endpoint. | Prefer an explicitly selected existing server and read-only routes over immediate private-database polling. Connectivity, authentication and gap recovery still need a fixture test. [Server API](https://opencode.ai/docs/server/) |
| H6 | Cursor documents hooks, including file/tool lifecycle events. | Private SQLite is not the only route. Verify desktop/CLI/version parity and returned content rather than assuming every hook exposes everything. [Cursor hooks](https://cursor.com/docs/hooks) |
| H7 | Gemini CLI documents `BeforeTool`/`AfterTool` and tool responses, with hooks capable of altering agent behavior. | A future observer must emit no control/context instructions and measure overhead. [Gemini hooks](https://geminicli.com/docs/hooks/reference/) |

Do not infer read-only attachment from the existence of an SDK, ACP transport, MCP server or app-server command. A protocol that creates or resumes runs can make Drishya part of execution. The product boundary remains observation of already running work or explicit imports.

## Competitive evidence

**Agent Flow source inspection.** Queried public repository metadata and inspected source at commit `84cd2fb8c704cefe52e6dd41a375c4069442e206`. The initial tool-detail/transcript reads were from `main` immediately before resolving that SHA; the content renderer was then fetched at the pinned SHA. No package installation, configuration mutation or live session was performed.

| Source | Specific observation | What this does not establish |
|---|---|---|
| [Tool content renderer](https://github.com/patoles/agent-flow/blob/84cd2fb8c704cefe52e6dd41a375c4069442e206/web/components/agent-visualizer/tool-content-renderer.tsx) | Edit previews use old/new strings; write previews use supplied content; 4 or 8 line limits appear in those views | Whether another view exposes full historical content |
| [Tool detail popup](https://github.com/patoles/agent-flow/blob/84cd2fb8c704cefe52e6dd41a375c4069442e206/web/components/agent-visualizer/tool-detail-popup.tsx) | Renders arguments/rich content and a result when present | Whether upstream results are complete |
| [Transcript message](https://github.com/patoles/agent-flow/blob/84cd2fb8c704cefe52e6dd41a375c4069442e206/web/components/agent-visualizer/transcript-message.tsx) | Tool-result display slices text in the inspected component | A product-wide limit or a reliable hands-on comparison |

These observations refute “only labels”. They do not justify “Drishya is uniquely content-complete”. The hands-on comparison remains open: use a synthetic read, multi-hunk edit, shell write, failing test, subagent and missing artifact; compare task completion, not just displayed controls.

Other primary sources:

- [Agent Flow README](https://github.com/patoles/agent-flow): documents Claude/Codex observation, timeline, transcript and replay. No star-count argument is used in this review.
- [AgentFlow extension listing](https://marketplace.visualstudio.com/items?itemName=AgentFlow.agentflow): a separate product by hercieAI advertising live observation and replay controls. Do not conflate the two names. Listing claims are untested here.
- [LangSmith observability](https://docs.langchain.com/langsmith/observability) and [Langfuse observability](https://langfuse.com/docs/observability/overview): established adjacent tracing products with inspection workflows. These are valid benchmarks for evidence navigation.
- [Antigravity models](https://antigravity.google/docs/models): multiple model providers are already offered. This does not establish observation of external harness processes.
- The existing Karna URL, `https://github.com/shailesht003/karna-ai`, was unavailable through both the page lookup and GitHub API (API returned 404). That can mean moved, private or removed; it is not proof the project never existed. Retire it as current proof until relocated.

## Demand research

The [2025 Stack Overflow AI survey](https://survey.stackoverflow.co/2025/ai) supports investigating verification and debugging friction. It is a self-selected respondent survey and predates this review; it does not measure willingness to adopt Drishya or the benefit of this interface.

The [METR July 2025 experiment](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) concerns a specific population, tool period and task setting. The [February 2026 follow-up](https://metr.org/blog/2026-02-24-uplift-update/) describes changing experiment design and substantial interpretive limitations. Use the methodological lesson: perceived speed and measured speed differ. Do not generalize an old estimate into a current marketing claim.

No user interviews, retention trial, willingness-to-pay study or total addressable market estimate were completed in this task. Targets in the product review are proposed go/no-go criteria.

## Technology research

- [PixiJS renderer documentation](https://pixijs.com/8.x/guides/components/renderers): recommends WebGL for production, describes WebGPU caveats, and does not promise a ready Canvas fallback. Choose a separate graph-off fallback.
- [Node release schedule](https://nodejs.org/en/about/previous-releases): Node 24 is LTS at review time. Select and pin a tested Node 24 patch for the first packaging spike rather than promising arbitrary Node/Bun compatibility.
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3): prebuilt binaries are available for major platforms/architectures. Actual supported package/runtime combinations must still be tested. WASM parsing does not eliminate SQLite packaging risk.

Specific claims about compositor behavior, memory ceilings, graph accuracy, installer size and actual frame rates need measurements on the chosen build. This review supplies targets and measurement boundaries, not benchmark results.

## Claims to stop repeating

1. Every harness recorded everything, including every thought and historical file byte.
2. Nobody else combines any of these ideas, or competitors show only labels.
3. Vendors will never offer cross-harness observation.
4. Stars establish retention, willingness to pay or product-market fit.
5. A static call/dependency path establishes actual runtime execution or test coverage.
6. Timestamp proximity proves parallelism or why an edit happened.
7. Async hooks and local processing have literally zero overhead.
8. An uncalibrated 0.6 confidence threshold proves a graph location is trustworthy.
9. A graphics preset can enforce a hard total browser-process memory ceiling.
10. An available name or package establishes trademark clearance.

## Remaining research, ordered by decision impact

| Work | Decision it closes | Done when |
|---|---|---|
| Real capture fixtures from declared Claude/Codex versions | What historical content can be promised | Capability matrix backed by sanitized fixtures and gap cases |
| Agent Flow/native-tool task comparison | Whether the proposed workflow improves review | Same questions, equivalent recordings, time and correctness measured |
| Experience prototype with interruption/overload | Whether cinematic motion aids comprehension | Reading, scrubbing, multi-agent and reduced-motion tasks pass |
| Clean-machine packed install | Whether browser+daemon distribution is dependable | Matrix passes without developer build tools |
| Pilot with target users | Whether there is repeat use beyond curiosity | Voluntary return and concrete benefit evidence |
| Incremental map benchmark on diverse repos | Whether deeper static analysis is worth expanding | Precision and unresolved rates reported by edge type |

Search coverage is not exhaustive. No “first”, “only” or market leadership claim follows from this ledger.

## 30 September refresh — product and integration decisions

Primary documentation/source descriptions were rechecked for the [current product plan](../PRODUCT_DIRECTION.md) and [implementation roadmap](../IMPLEMENTATION_ROADMAP.md). This is desk research, not a hands-on competitor benchmark. It adds no evidence of willingness to pay or market leadership.

| Source | Verified scope | Implication / limit |
|---|---|---|
| [Agent Flow repository](https://github.com/patoles/agent-flow) | Documents Claude Code/Codex visualization, session views, timeline/transcript and log replay | These features alone do not establish differentiation; published capabilities were not benchmarked |
| [Cursor Agent](https://cursor.com/docs/agent/overview) | Documents checkpoints and file preview/restoration | Native tools already address parts of change review; Drishya remains observe-only |
| [Langfuse observability](https://langfuse.com/docs/observability/overview) | Tracing/observability is an existing adjacent category | Focus our utility on captured repository material and developer review |
| [Stack Overflow 2025 AI survey](https://survey.stackoverflow.co/2025/ai) | Reports almost-correct answer and debugging frustrations | Motivation for a user study, not proof people want a visualizer |
| [Claude local directory](https://code.claude.com/docs/en/claude-directory) | Describes local session/data storage | Versioned read-only adapters need fixtures and explicit capture limitations |
| [Codex app-server](https://learn.chatgpt.com/docs/app-server) | `thread/read` reads stored history without resuming the thread | Does not alone establish passive live attachment to arbitrary other Codex processes |
| [OpenAI conversation state](https://developers.openai.com/api/docs/guides/conversation-state) | Conversations API persists state used with Responses | Not evidence that a consumer ChatGPT archive is accessible through that API |

No generic supported live connector to arbitrary consumer ChatGPT/Claude chat archives was verified. Treat those as separate future integrations, with export-format research and capability declarations. Do not confuse tools available to the coding assistant inside its host app with APIs available to Drishya's users.

## 7 October — harness prompting feasibility

Primary sources checked for the builder’s question, not permission to add control:

| Source | Verified scope | Limit for Drishya |
|---|---|---|
| [Claude programmatic CLI](https://code.claude.com/docs/en/headless) | Non-interactive `-p`, structured/stream-json output and continuation options | Does not establish safe prompt injection into arbitrary already-running terminal sessions |
| [Codex app-server protocol](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) | Threads, `turn/start` and progress notifications for a client-controlled session | Does not establish passive attachment/control of every existing Codex process |

A separate supported-interface controller is feasible in principle, with explicit session/workspace ownership, authentication, permissions, approval handling and cancellation. Drishya remains observe-only; no prompt-sending or launch endpoint was added. This is desk research, not tested interoperability. See [24](24-prompt-workspace.md).
