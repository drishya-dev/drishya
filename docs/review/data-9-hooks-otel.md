# DATA-9 — Hooks and OpenTelemetry as optional enrichment

**26 October 2026 · Claude Sonnet 5.5.** TASKS DATA-9 asked: can Claude Code and Codex hooks or telemetry exporters add anything the journals do not already hold, as strictly passive, non-blocking, opt-in enrichment, and at what cost? Research and measurement only; no application code.

## Verdict

Of fifteen candidate signals, **one is worth building, two are worth deferring, and the rest are rejected because the journal already holds the same fact** (table in §4). Hooks add very little that the journals lack, and what they add is almost all *moments the journal never sees*: the agent is waiting on you, a permission prompt opened, the session ended.

| Decision | Signal | Why |
|---|---|---|
| **Build (after CONTENT-3)** | "Waiting for you": Claude `Notification` (`permission_prompt`, `idle_prompt`, `agent_needs_input`) and Codex `PermissionRequest`, delivered by an async command hook that appends to a Drishya-owned spool file | Neither journal records that an approval or question is open, or how long it stayed open. This is the one thing a person who looked away needs and cannot get from history |
| **Defer** | Explicit `SessionEnd` / `Stop` liveness (`reason`, `background_tasks`, `session_crons`) | Useful for Home "running now", but file activity probably answers it. Revisit only if HOME-1 measures wrong "running" states |
| **Defer** | Claude OTel `tool_decision` (who approved: `config`, `hook`, `user_permanent`, `user_temporary`, `user_abort`, `user_reject`) | A genuine addition, but it needs an OTLP receiver in the zero-dependency daemon and a restart of every session with new environment variables. Weigh again if the build item above proves valued |
| **Reject** | Everything else: tool pre/post/batch hooks, prompt, subagent, compaction, `notify`, `Interrupt`, `FileChanged`, OTel cost/token/commit counters | Duplicates the journal, carries the heaviest content exposure, and charges a process spawn per event |

Every claim below is tagged **verified** (seen in a primary source or run here) or **unverified**. Nothing here was run against a model: the installed Claude Code CLI's OAuth session had expired, and I did not touch credentials (§5).

## 1. Sources and what could be verified

| Source | Status |
|---|---|
| Claude Code hooks reference, [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks), fetched 26 Oct | Read in full except a few events (see below). The page describes versions newer than the installed CLI |
| Claude Code monitoring, [code.claude.com/docs/en/monitoring-usage](https://code.claude.com/docs/en/monitoring-usage), fetched 26 Oct | Read; attribute lists for the last few events not read. Collector-down behaviour is not stated in the part read (**unverified**) |
| Codex [hooks](https://learn.chatgpt.com/docs/hooks), [config-advanced](https://learn.chatgpt.com/docs/config-file/config-advanced), [config reference](https://learn.chatgpt.com/docs/config-file/config-reference) (the `developers.openai.com` URLs redirect here) | Docs only. **No `codex` binary is on this machine's PATH**, so nothing about Codex hooks or OTel was run. I did not read `~/.codex/config.toml` |
| Installed Claude Code **2.1.282**, run in a throwaway directory under the session scratchpad | Hook payload field names captured for four events (§1.1) |
| Local journals, counts of record types and field **names** only: 45 recent Claude Code journals, 7 recent Codex rollouts (CLI `0.160.0` to `0.164.0-alpha`) | No content printed or stored |

### 1.1 Installed-version drift

On 2.1.282 the captured payloads were narrower than the current docs describe:

| Event | Fields seen on 2.1.282 |
|---|---|
| `SessionStart` | `session_id, transcript_path, cwd, hook_event_name, source` |
| `UserPromptSubmit` | `session_id, transcript_path, cwd, prompt_id, permission_mode, hook_event_name, prompt` |
| `StopFailure` | `session_id, transcript_path, cwd, prompt_id, hook_event_name, error, last_assistant_message` |
| `SessionEnd` | `session_id, transcript_path, cwd, prompt_id, hook_event_name, reason` |

The docs list more common fields (`scratchpad_dir`, `effort`, `agent_id`, `agent_type`) and newer features (`onFailure`, v2.1.295+; `OTEL_LOG_RAW_API_BODIES`; `safety_event`, v2.1.307+). A consumer must treat every field as optional and key behaviour on presence, as the adapters already do.

## 2. What each harness offers

### 2.1 Claude Code hooks (docs; payload names partly verified above)

- **33 events.** The relevant ones: `Notification`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `SubagentStart/Stop`, `PreCompact/PostCompact`, `Stop`, `StopFailure`, `SessionStart/End`, `TaskCreated/Completed`, `MessageDisplay`, `FileChanged`, `InstructionsLoaded`, `Elicitation`.
- **Types:** `command`, `http`, `mcp_tool`, `prompt`, `agent`. `async: true` exists **only on `command`**. Everything else blocks until it finishes or times out (default 600 s; `SessionEnd` 1.5 s; `MessageDisplay` 10 s).
- **Async semantics.** An async hook cannot block or decide, and its `timeout` is not enforced. **But** an async hook's JSON `additionalContext` and `systemMessage` are still delivered to the model on the next turn. An observer must therefore print nothing to stdout. In `-p` mode, async hooks still running at teardown are cancelled.
- **Exit codes.** `0` is success. `2` blocks on a long list of events (`PreToolUse`, `UserPromptSubmit`, `Stop`, `PostToolBatch`, `PreCompact`, …). Any other code is a non-blocking error.
- **Config.** `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`, managed policy, plugins. `disableAllHooks` and managed `allowManagedHooksOnly` turn the path off.
- **Sensitive payload fields** (docs): `prompt`; `tool_input` (includes `Write.content`, `Edit.old_string/new_string`, shell commands); `tool_response` and `error`; `delta` (`MessageDisplay`); `last_assistant_message`; `compact_summary`; `task_description`; `message`/`reason` (may echo user or tool text); `transcript_path` and `agent_transcript_path` (point at full history).

### 2.2 Codex hooks and `notify` (docs only; **unverified in practice**)

- **Events:** `SessionStart`, `SessionEnd` (reason is currently always `other`; also fires after 30 min idle), `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact/PostCompact`, `SubagentStart/Stop`, `Stop`, `Interrupt`.
- **Handler types:** `command` and `mcp_tool`; `prompt` and `agent` are parsed but skipped.
- **Async:** `"async": true` on a command handler runs it in the background; it cannot block or modify; output is delivered at the next safe point; up to eight at once per session. `SessionEnd` is always synchronous.
- **Coverage:** `PreToolUse`/`PostToolUse` cover Bash, `apply_patch`, MCP and other local function tools; hosted tools such as web search are not covered. The page itself calls hooks "a useful guardrail, not a complete enforcement boundary".
- **Trust:** non-managed hooks must be reviewed with `/hooks` before they run; changed hooks are skipped until re-trusted; project hooks load only from a trusted `.codex/` layer.
- **`PermissionRequest`** fires "when Codex is about to ask for approval" and not for commands that need none. Payload: `turn_id`, `tool_name`, `tool_input` (optional `description`).
- **`notify`** is a command receiving one JSON argument; the only documented event is `agent-turn-complete` with `type`, `thread-id`, `turn-id`, `cwd`, `input-messages`, `last-assistant-message`. `input-messages` is prompt text.

### 2.3 OpenTelemetry

| | Claude Code | Codex |
|---|---|---|
| Enable | `CLAUDE_CODE_ENABLE_TELEMETRY=1` plus `OTEL_METRICS_EXPORTER` / `OTEL_LOGS_EXPORTER` (`otlp`, `console`, `prometheus`); traces are beta | `[otel]` in `config.toml`: `exporter` = `none`, `otlp-http`, `otlp-grpc`; off by default |
| Where it can be set | Environment, or managed settings `env`. **Repository settings cannot enable telemetry or set destinations** | `config.toml` |
| Protocols | `grpc`, `http/json`, `http/protobuf` | OTLP/HTTP `binary` or `json`; or gRPC |
| Events | `user_prompt`, `assistant_response`, `tool_result`, `tool_decision`, `api_request`, `api_error`, `subagent_completed`, `safety_event` and more | `codex.conversation_starts`, `api_request`, `sse_event`, `websocket_request/event`, `user_prompt`, `tool_decision`, `tool_result`. **Per-event attributes: not found in the docs read (unverified)** |
| Content gates (all default off) | `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_DETAILS`, `OTEL_LOG_TOOL_CONTENT`, `OTEL_LOG_RAW_API_BODIES` (full conversation) | `otel.log_user_prompt` only documented gate |
| Export cadence | logs every 5 s, metrics every 60 s | batched asynchronously, flushed on shutdown |

## 3. What the journals already record about the same moments

Counted on the local samples (shape, not frequency guarantees).

**Claude Code** (45 journals, versions up to 2.1.282): `system:turn_duration` (75), `system:compact_boundary` with `compactMetadata{trigger, preTokens, postTokens, durationMs}` (48), `system:api_error` with `retryInMs, retryAttempt, maxRetries` (98), `permission-mode` (927), `attachment:task_status` (6), `queue-operation` (2,215), `cost-state` (30), and **the harness's own record of hooks that ran**: `system:stop_hook_summary` with `hookCount, hookInfos[{command}], hookErrors, hookAdditionalContext, preventedContinuation, stopReason` (777), `attachment:hook_non_blocking_error` with `hookEvent, exitCode, durationMs, stdout, stderr, command` (3,170), `attachment:hook_additional_context` (122), `attachment:hook_system_message` (1). No record of a permission prompt opening, of a `Notification`, or of a session ending. A rejected tool call shows only as a tool result.

**Codex** (7 rollouts): `task_started`/`task_complete`, `turn_aborted` (6; this is what the `Interrupt` hook would report), `thread_settings_applied`, `token_count`, `compacted`, `item_completed`. No hook record, and **no approval-request record in this sample** (a wider sample could differ).

## 4. Signal by signal

"Journal" is what we already read; "adds" is what only the hook or OTel path carries.

| # | Signal | Journal | Only hook/OTel adds | Exposure (redact) | Verdict |
|---|---|---|---|---|---|
| 1 | Claude `Notification` | Nothing | `notification_type` (`permission_prompt`, `idle_prompt`, `agent_needs_input`, `elicitation_dialog`, …), `title`, `message`, an exact timestamp | `message`/`title` may echo tool text | **Build** (with 2) |
| 2 | Codex `PermissionRequest` | No approval record in sample | `turn_id`, `tool_name`, `tool_input`; the prompt-open moment | `tool_input` is the command or patch | **Build** (with 1); drop `tool_input` at the hook, the journal has the call |
| 3 | Claude `PermissionRequest` | Nothing | `tool_name`, `tool_input`, `permission_suggestions`; no `tool_use_id` | as 2 | Defer: `Notification` already says "waiting"; this one is a control event |
| 4 | `SessionEnd` / `SessionStart` | No end marker | `reason` (`clear`, `resume`, `logout`, `prompt_input_exit`, `other`), `source` | none beyond paths | Defer |
| 5 | `Stop` `background_tasks`, `session_crons` | `task_status`, `queue-operation` partly | "done" versus "paused for background work" | `command` strings (capped 1000 chars) | Defer |
| 6 | `StopFailure.error` | `system:api_error` | A typed category: `rate_limit`, `overloaded`, `authentication_failed`, `billing_error`, `max_output_tokens`, … | `last_assistant_message` is an API error string | Reject: category is derivable from `api_error` |
| 7 | OTel `tool_decision` | The effect only (rejected result) | `decision`, `source` (`user_temporary`, `user_reject`, `hook`, `config`, …), `classifier_verdict`, `tool.blocked_on_user` span (beta) | `tool_parameters` only with `OTEL_LOG_TOOL_DETAILS` | **Defer** |
| 8 | `PreToolUse` / `PostToolUse` / `PostToolBatch` | Full call and result | `duration_ms` (PostToolUse), exact start order | `tool_input`, `tool_response`: whole file bodies and output | Reject |
| 9 | `UserPromptSubmit`, OTel `user_prompt` | The prompt | Nothing | The prompt | Reject |
| 10 | `SubagentStart/Stop` (both harnesses) | Sidechain transcripts; Codex `SubAgentActivity` | `agent_transcript_path`, `last_assistant_message` | final text | Reject |
| 11 | `PreCompact` / `PostCompact` | `compact_boundary` with trigger, tokens, duration | `custom_instructions` (what the person typed to `/compact`), `compact_summary` | summary of the whole conversation | Reject |
| 12 | Codex `Interrupt` | `turn_aborted` | Nothing | none | Reject |
| 13 | Codex `notify` | `task_complete` | Nothing | `input-messages` is prompt text | Reject |
| 14 | `FileChanged`, `CwdChanged`, `InstructionsLoaded` | `edited_text_file` attachment, `cwd` on every record | Nothing material | paths | Reject |
| 15 | OTel cost, token, commit, lines-of-code counters; `api_request` | `cost-state`, `message.usage`, Codex `token_count` | Nothing | none | Reject |

Two consequences worth recording:

1. **Hooks' main use here is the moment, not the content.** The journal is the content. Anything that carries `tool_input`, `tool_response`, `prompt` or `delta` is a second, uncontrolled copy of what we already capture, with worse redaction ordering (see §6).
2. **The harness already logs its own hooks, including noisy ones.** In one user's journals 3,170 non-blocking hook errors (median 63 ms) are recorded. This is a separate, cheap, no-config finding: Drishya could surface "hooks ran, failed or injected context" from `stop_hook_summary` and the `hook_*` attachments today (the audit 123 table marks hook display "not used"). It also means a sloppy observer script that exits non-zero would pollute the person's own journal. Suggested follow-up for the builders, not claimed here.

## 5. Measured overhead

Windows 11, Node v24.14.0, Claude Code 2.1.282, throwaway directory under the session scratchpad, a synthetic observer (`node noop.js`: drain stdin, append one line, print nothing, exit 0). Real harness config untouched: settings were passed with `--settings` and `--setting-sources project`.

**Process-spawn floor** (30 runs each, 10 for PowerShell; stdin payload of about 0.7 KB; no harness):

| Hook command | p50 | p90 |
|---|---|---|
| `cmd /c exit` | 21 ms | 23 ms |
| bare `node -e ""` | 43 ms | 46 ms |
| `node noop.js` (the observer) | **52 ms** | 64 ms |
| `bash -c` | 48 ms | 52 ms |
| `pwsh -NoProfile` | 236 ms | 266 ms |

The observer body itself ran in about 3 ms. Real hooks in the user's journals (3,170 recorded `durationMs`): p50 63 ms, p90 95, p99 149, max 2,345.

**Inside Claude Code** (`claude -p "say ok"`, 12 interleaved runs per condition, one `UserPromptSubmit` hook each). The model was never reached (expired OAuth), so these are harness-side costs only; `duration_ms` is the CLI's own figure:

| Condition | `duration_ms` p50 | min | p90 | Whole-process wall p50 |
|---|---|---|---|---|
| no hook | 191 | 131 | 210 | 5,394 ms |
| blocking command hook | 266 (**+75**) | 213 | 308 | 5,376 ms |
| `async: true` command hook | 209 (**+18**) | 148 | 241 | **6,884 ms (+1,490)** |

- A blocking hook costs about one spawn per event, as expected. An async hook costs about 18 ms on the harness side.
- **Async was not free at process exit in `-p` mode:** all 12 async runs took 6.1–7.2 s against 4.4–5.9 s for the others. The cause is not investigated (the docs say `-p` cancels async hooks at teardown). **Interactive sessions were not measured**, so this may not apply there. It is why the snippet must not be offered for `claude -p` / SDK use without checking.
- All 12 blocking and all 12 async runs invoked the hook exactly once.

**Arithmetic, not measurement:** at these per-event costs, Pre+Post tool hooks on a 100-tool-call turn are 200 events, about 15 s blocking or about 3.6 s async of harness time. That is the main reason to reject the tool-event hooks even though async is allowed.

**Not measured:** a model-backed turn; tool events; `Notification` and `PermissionRequest` firing; any Codex path; OTel exporter overhead or collector-down behaviour; macOS and Linux.

## 6. How the one "build" item could be consumed (design sketch, no code written)

Fit with the standing rules:

- **No config edits by Drishya.** Settings shows a documented snippet the person pastes into their own `~/.claude/settings.json` (Claude) or `~/.codex/hooks.json` / `config.toml` (Codex, which also needs their `/hooks` trust review). Drishya never writes either file. `disableAllHooks` or managed `allowManagedHooksOnly` simply turns the feature off.
- **Non-blocking by construction.** Claude: `type: "command"`, `async: true`, matcher on `Notification` only. Codex: `"async": true` on `PermissionRequest`. Neither is a control event once async (docs: async hooks cannot decide). The script **prints nothing, always exits 0** (catch everything), because stdout JSON from an async hook still reaches the model and exit 2 or 1 would be visible to the person.
- **Independent of Drishya running.** The script appends one JSON line to a spool file in Drishya's own data directory and exits; Drishya tails the spool like any other source. No HTTP hook, because HTTP hooks block and add a network dependency. (HTTP hook latency was not measured.)
- **Redaction before persisting.** The script writes an allow-listed subset only: `hook_event_name`, `session_id`, `prompt_id` or `turn_id`, `notification_type`, `tool_name`, a timestamp. It drops `tool_input`, `tool_response`, `prompt`, `message`, `delta`, `last_assistant_message` and `compact_summary` at source. Whatever remains goes through the normal ingest redaction anyway.
- **Provenance.** Every record is labelled "from hook" and joins the journal by `session_id` (Claude) or `turn_id` (Codex). Time between "waiting" and the next journal record is shown as "waited ~N s", never as a reason.
- **Cost.** Notifications and permission prompts are rare compared with tool calls, so the per-event spawn cost (about 52 ms with Node, avoid PowerShell) lands on human-paced moments.
- **Open before building:** confirm on a real signed-in session that `Notification` fires for a permission prompt on the person's version, that `async` is honoured for it, that Codex `PermissionRequest` runs with `async`, and that the interactive-exit cost of an async hook is negligible. Until then this stays a recommendation.

## 7. Checked against the standing rules

| Rule | Result |
|---|---|
| Passive observation independent | Spool is written by a person-installed script and read by Drishya; Drishya starts and stops nothing |
| Never mutate harness files or config | Snippet is pasted by the person; no write path in Drishya |
| Observer hook never returns control or context | Script prints nothing, exits 0; async only; PreToolUse/Stop-class events not used |
| Redact before persisting | Allow-list at source plus ingest redaction; content-bearing fields rejected |
| Captured ≠ derived | Hook records labelled by source; waiting time shown as elapsed, never as cause |
| No telemetry | OTel is the *person's* export to the person's collector; Drishya sends nothing and enables nothing. The deferred receiver would listen on loopback only |
| Capture independent of presentation | File spool, no daemon dependency |

## Not done

No model-backed measurement, no Codex run, no OTel collector, no interactive timing. The Claude hook docs section for `Elicitation`/`CwdChanged`/`FileChanged` payloads and the tail of the monitoring page were only partly read. Findings in the research ledger (H1, H3, new H8–H9) were updated to match.
