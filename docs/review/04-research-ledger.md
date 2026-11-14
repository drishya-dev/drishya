# Research ledger and evidence limits

## Antigravity (Google), 13 November 2026

Source for the [Antigravity harness review](antigravity-harness.md) and TASKS AG-1 to AG-6. Public documentation says what the product does; it does **not** document where or how it stores sessions. Storage facts below are either measured on this machine (the review) or user reports, and are labelled so.

| Fact | Source | Kind | Limit for Drishya |
|---|---|---|---|
| Antigravity is an agentic development platform (public preview announced 20 November 2025) with an Editor view, a Manager surface for several agents, and a browser the agent can drive; runs on macOS, Windows and Linux | [Google Developers blog](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/) | documented | Product description only |
| Agents produce *artifacts*: task lists, implementation plans, screenshots, browser recordings; users can comment on them and the agent incorporates feedback | same | documented | Matches the `brain\<id>\*.md`, `.metadata.json` and `logs\media` files measured locally |
| Artifact types include implementation plans (Markdown), code diffs, diagrams, images and browser recordings; the page does not say where artifacts are stored | [Antigravity docs: Artifacts](https://www.antigravity.google/docs/artifacts) | documented | No storage contract: layout is undocumented and may change |
| The implementation plan is reviewed by the user before work starts; comments send it back for revision | [Antigravity docs: Implementation plan](https://www.antigravity.google/docs/implementation-plan) | documented | A plan-approval case exists in the product; no local session records one (AG-5) |
| Walkthrough, task list and implementation plan are the three standard artifacts | [Google codelab: Building with Google Antigravity](https://codelabs.developers.google.com/building-with-google-antigravity) | documented | Matches `walkthrough.md`, `task.md`, `implementation_plan.md` |
| Terminal commands run either automatically (with a deny list) or after user review, per policy; third-party guides disagree on policy names | same codelab; [Smartscope architecture note](https://smartscope.blog/en/generative-ai/google-gemini/antigravity-architecture-deep-dive/) | documented / third party | Approval cases exist; none recorded locally; names unverified |
| Conversations live under `~/.gemini/antigravity/` as `conversations/<uuid>.pb`, with a matching `brain/<uuid>/` folder; the IDE variant used `~/.gemini/antigravity-ide/` | user reports, e.g. [Google AI developers forum: data loss after unclean shutdown](https://discuss.ai.google.dev/t/data-loss-session-history-permanently-destroyed-after-unclean-shutdown-no-self-recovery-mechanism/141266.md), [corrupted conversation file](https://discuss.ai.google.dev/t/corrupted-conversation-file-causes-silent-chat-failure-history-loss/142054); third-party reader code [devboy-core `antigravity.rs`](https://docs.rs/crate/devboy-core/0.28.1/source/src/agents/antigravity.rs) | user reports, not Google documentation | **Superseded on this machine:** current conversations are `.db` SQLite, only legacy ones are `.pb` |
| The `.pb` files appear fully encrypted | same forum reports | user reports | **Confirmed locally** (entropy 8.000 bits per byte on four files, 21 files unreadable) |
| Reports of corrupted or "missing" history after crashes, updates or reinstalls, with files still on disk (the UI index, not the files, is lost) | forum threads above | user reports | Expect partial files; the reader must tolerate a missing final record and a stale index |
| Models include Gemini 3 Pro, Claude Sonnet 4.5 and GPT-OSS (at announcement) | Google Developers blog | documented | Local records name models only as opaque `MODEL_PLACEHOLDER_Mn` ids, so no model name can be claimed |

Measured locally on 13 November 2026 (not from documentation): the SQLite conversation format with protobuf blobs, the JSONL transcripts under `brain\<id>\.system_generated\logs\`, `conversation_summaries.db` as a complete session index with workspace and parent ids, plaintext `thinking`, whole-second UTC timestamps, image files referenced by path, no MCP, browser, question or approval case in any local session. Details and counts: [antigravity-harness.md](antigravity-harness.md). Treat every storage fact as an undocumented internal format of an app that updated recently (uninstall entry 2.31.2, `version` file 44.9.1).

## 18 October native question protocol check

Claude's [user-input documentation](https://code.claude.com/docs/en/agent-sdk/user-input) documents `AskUserQuestion` interception via `canUseTool` and returned `updatedInput.answers`. Codex request/answer/cancellation shapes were checked against the locally generated app-server protocol types (`ToolRequestUserInput*`, `ServerRequestResolvedNotification`), kept privately under `.local`. Implementation accepts only the owned controller turn and exact pending wire request. Local fake-native protocol fixtures cover both harnesses and a browser/HTTP Claude round trip; real signed-in accounts/version/platform acceptance remains open. Passive historical questions do not grant authority to answer another client's turn.


Checked 21 September 2026. Primary documentation and selected public source only. Source pages can change. “Documented” means the source describes the capability; it does not mean Drishya has tested it. Proposed mechanisms elsewhere in this review are engineering recommendations, not claims of working implementations.

## Integration findings

| ID | Evidence | Consequence for Drishya |
|---|---|---|
| H1 | Claude Code documents 33 hook events, including `PostToolBatch`, `Notification` and `PermissionRequest`. `async: true` exists only on `command` hooks (re-checked 26 Oct). HTTP, `mcp_tool`, `prompt` and `agent` hooks block. An async hook's `additionalContext` and `systemMessage` are still delivered to the model, so an observer must print nothing and exit 0. Measured on 2.1.282 (Windows): a blocking command hook adds about 75 ms per event, an async one about 18 ms, and an async hook added about 1.5 s to `claude -p` exit (interactive not measured). | Do not equate HTTP delivery with nonblocking observation. Batch membership alone is not enough to assert exact execution overlap. Only the moment-type signals (waiting for the person) are worth a hook; see [data-9-hooks-otel](data-9-hooks-otel.md). [Hooks reference](https://code.claude.com/docs/en/hooks) |
| H2 | Claude documents subagent transcripts, spilled tool outputs and pre-edit checkpoint snapshots. Retention and checkpoint limits apply. | These are useful capture inputs, not a guarantee that every historical file version exists. [Directory reference](https://code.claude.com/docs/en/claude-directory) |
| H3 | Codex documents hooks (`SessionStart/End`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact/PostCompact`, `SubagentStart/Stop`, `Stop`, `Interrupt`) in `hooks.json` or `config.toml`; `command` handlers accept `"async": true` (cannot block or modify; `SessionEnd` always synchronous); non-managed hooks need `/hooks` trust review. `notify` supports only `agent-turn-complete`. Unified exec completion can arrive on a later polling call. **Docs only: no `codex` binary was available to run any of it (26 Oct).** The sampled rollouts (0.160–0.164-alpha) contain no hook records and no approval-request records. | The old rollout-only assessment is incomplete, but the one signal the rollouts lack is the approval prompt opening. Preserve source tool identity across asynchronous completion. [Codex hooks](https://learn.chatgpt.com/docs/hooks), [config](https://learn.chatgpt.com/docs/config-file/config-advanced) |
| H4 | Codex App Server documents streamed items, command output, file changes and reasoning summaries; raw reasoning text is conditional on model support. | This is a potential integration surface, not proof that a passive client can attach to any independently running app session. Never promise all internal thinking. [App Server](https://learn.chatgpt.com/docs/app-server) |
| H5 | OpenCode documents a server API, session reads and an SSE event endpoint. | Prefer an explicitly selected existing server and read-only routes over immediate private-database polling. Connectivity, authentication and gap recovery still need a fixture test. [Server API](https://opencode.ai/docs/server/) |
| H6 | Cursor documents hooks, including file/tool lifecycle events. | Private SQLite is not the only route. Verify desktop/CLI/version parity and returned content rather than assuming every hook exposes everything. [Cursor hooks](https://cursor.com/docs/hooks) |
| H7 | Gemini CLI documents `BeforeTool`/`AfterTool` and tool responses, with hooks capable of altering agent behavior. | A future observer must emit no control/context instructions and measure overhead. [Gemini hooks](https://geminicli.com/docs/hooks/reference/) |
| H8 | Claude Code exports OpenTelemetry metrics, logs and (beta) traces when `CLAUDE_CODE_ENABLE_TELEMETRY=1`; protocols `grpc`, `http/json`, `http/protobuf`; repository settings cannot enable it. Content (prompts, tool details, tool content, raw API bodies) is behind separate default-off `OTEL_LOG_*` gates. `tool_decision` carries `decision` and `source` (`config`, `hook`, `user_permanent`, `user_temporary`, `user_abort`, `user_reject`). Collector-down behaviour: not stated in the part read (unverified). | The only OTel fact the journal lacks is who approved a tool call; cost, tokens and commits duplicate it. A receiver is deferred. [Monitoring](https://code.claude.com/docs/en/monitoring-usage) |
| H9 | Codex `[otel]` is off by default; exporters `otlp-http` (`binary` or `json`) and `otlp-grpc`; documented events `codex.conversation_starts`, `api_request`, `sse_event`, `websocket_request`, `websocket_event`, `user_prompt`, `tool_decision`, `tool_result`; only `otel.log_user_prompt` is a documented content gate. Per-event attribute names were not found in the docs read (unverified). | Do not design a Codex OTel consumer from the event names alone. [Config](https://learn.chatgpt.com/docs/config-file/config-advanced) |

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
