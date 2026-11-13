# 123 — What the harnesses actually record, and what Drishya uses

**19 October 2026 · Claude Opus 5.5.** The builder asked: before proposing more visuals, establish what Claude Code and Codex actually give us. That decides what can be shown faithfully and where a model is needed to explain the work.

**Method.** I read the last 120 Claude Code journals (`~/.claude/projects`, 5,110 records) and the last 30 Codex rollouts (`~/.codex/sessions`, 28,596 records) on the builder's machine, counting record types and field **names** only. No content was printed or stored. I then grepped `packages/adapter-claude` and `packages/adapter-codex` for each field. Counts depend on harness versions and on what this one user did; treat them as evidence of shape, not frequency guarantees.

## 1. The headline: reasoning is mostly *not* recorded any more

| Harness | What the journal holds | Measured |
|---|---|---|
| Claude Code | `thinking` content blocks are present but **empty**: signature only, no text | 223 of 225 thinking blocks empty; 2 with text |
| Codex | `reasoning` items carry `encrypted_content`; `summary` is usually empty | 3,624 of 3,624 encrypted; summaries present on 109 (~3%) |

**Consequence.** "Show what it was thinking" cannot come from the journals for current models. Drishya must:

1. show summaries and thinking text whenever they exist (already supported);
2. show an honest quiet state ("Reasoning not recorded by the harness") instead of silence, so absence isn't mistaken for "no thinking";
3. fill the *why* gap with **derived, opt-in, evidence-cited** explanation (the parked explain feature; removed under CLEAN-2). The model must never be presented as the agent's own thoughts.

Separately, investigate whether harness settings can persist more. Codex exposes a reasoning-summary setting (`model_reasoning_summary`) and summaries appear when it applies. Document what users can enable, then verify on a fresh session; do not assume.

## 2. Rich structured data Drishya currently ignores

### Codex

The adapter ignores `item_completed`, `token_count` and several others on purpose (`IGNORED_EVENTS` / `IGNORED_TOP` in `packages/adapter-codex/src/index.ts`). It reconstructs everything from `response_item` and decodes code-mode `exec` wrappers. That is why the UI shows "Edit · exec" / "Other · exec", and why Review work reported **0 test runs** in a session whose prose says 441 tests passed.

| Record | Fields present | What it unlocks | Used now |
|---|---|---|---|
| `event_msg:item_completed` → `CommandExecution` (3,336) | `command`, **`parsed_cmd`**, `cwd`, `status`, **`exit_code`**, **`duration`**, `stdout`, `stderr`, `aggregated_output`, `formatted_output` | Real commands with real exit codes and durations, without decoding wrappers; test/build recognition; failure→fix chains | ✗ |
| … → `FileChange` (556) | `changes`, `status`, `stdout`, `stderr` | Authoritative per-file change sets with apply status | ✗ |
| … → `McpToolCall` (215) | `server`, `tool`, `arguments`, `status`, `result`, `duration`, `error`, `readOnlyHint` | MCP calls emitted from their real server, with duration and read-only hint | ✗ |
| … → `ImageView` (348) | `path` | **Which image the agent looked at**; render the image (with consent) or an honest path card | ✗ |
| … → `Extension` (71) | `kind`, `query`, `action`, `results`, `durationMs`, `revisedPrompt`, `savedPath`, `failure` | Web search queries and results; generated images and where they were saved | ✗ |
| … → `SubAgentActivity` (97) | `agent_thread_id`, `agent_path`, `model`, `reasoning_effort` | Real sub-agent identity, model and effort (fixes six agents all called "subagent") | ✗ |
| … → `AgentMessage` | `phase`, `delivery`, **`questions`** | Distinguish commentary from the final answer; questions the agent asked | partial |
| … → `Reasoning` | `summary_text`, `raw_content` | Summaries when present | partial |
| `event_msg:token_count` (3,648) | `total_token_usage` {input, cached, output, reasoning, total}, `last_token_usage`, **`model_context_window`**, **`rate_limits`** {primary, secondary, plan_type, limit reached} | Context-window fill gauge; per-turn tokens; plan-limit usage. Usage currently says "Not reported" for Codex | ✗ |
| `event_msg:task_complete` | `duration_ms`, `time_to_first_token_ms`, `error`, `last_agent_message` | Turn duration and error for the turn ledger | partial (turn end only) |
| `turn_context` | `model`, `effort`, `approval_policy`, `sandbox_policy`, `permission_profile`, `collaboration_mode`, `summary` | Show the turn's real settings; explain why approvals did or didn't appear | partial (model, cwd) |
| `session_meta` | `agent_nickname`, `agent_path`, `parent_thread_id`, `forked_from_id`, `git`, `context_window` | Agent names, parent/child and fork lineage, branch | partial |
| Response function calls | `spawn_agent`, `send_message`, `followup_task`, `wait`, `request_user_input_async`, `js` | Delegation and questions as first-class content | partial |
| User `input_image` blocks (11) | image content | Show screenshots the user pasted into a prompt | ✗ |

`plan_update` and `turn_diff` are listed in the adapter's ignore set. Neither appeared in this sample, so their presence depends on version and surface (Codex documents them on the App Server stream). Verify on a fresh session before building on them; if present, `turn_diff` is a free per-turn net diff.

### Claude Code

| Record | Fields present | What it unlocks | Used now |
|---|---|---|---|
| `cost-state` (114) | **`totalCostUSD`**, **`totalLinesAdded`**, **`totalLinesRemoved`**, `totalDuration`, `totalAPIDuration`, `totalToolDuration`, `modelUsage` | Session stats on Home rows and in the session header, as harness-reported values | ✗ (ignored) |
| `message.usage` (every assistant message) | `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`, `service_tier`, `speed` | Context-fill gauge and per-turn tokens | ✗ |
| `file-history-snapshot` | `messageId`, **`trackedFileBackups`**, `timestamp` | Pre-edit checkpoints per message: compare a file "before this turn" vs now, within retention | ✗ (ignored) |
| `attachment:edited_text_file` | `filename`, `snippet`, `displayPath` | **"Changed outside the agent"** marks (your edits or a formatter's) between agent operations | ✗ |
| Edit/Write `toolUseResult` | `structuredPatch`, **`originalFile`**, `oldString`, `newString`, `userModified` | Full before/after file text, so real line numbers and edited-line ranges are possible (read-before-write, blame-by-turn) | ✓ |
| Read `toolUseResult.file` | `content`, `startLine`, `numLines`, `totalLines` | Exact read ranges, so "which lines did it read before editing" is answerable | ✓ |
| Bash `toolUseResult` | `stdout`, `stderr`, `interrupted`, **`isImage`**, `persistedOutputPath`, `returnCodeInterpretation` | Image output; spilled full output; interruption | partial |
| WebFetch / WebSearch | `url`, `code`, `bytes`, `durationMs`, `result`; `query`, `results`, `searchCount` | Browser/web cards with status, size and results | partial |
| `AskUserQuestion` | `questions`, `answers`, `annotations` | Question cards with the chosen answer | ✗ (falls to "other") |
| `TodoWrite` (and the newer `TaskCreate`/`TaskUpdate`) | task text and status | A living checklist for the turn | TodoWrite only. **Correction 19 Oct:** no real uses of any of these exist in the local journals (the first counts came from tool definitions), so treat their shapes as unverified |
| `ExitPlanMode` / `EnterPlanMode` | the plan text | The agent's plan as a first-class "Plan" surface | ✗ (unverified: no real uses locally, see correction above) |
| `Agent` / `Task` | `subagent_type`, `description`, `prompt` | Sub-agent identity | ✓ |
| `ai-title`, `custom-title`, `agent-name`, `mode` | titles, agent name, permission mode | Better Home titles; mode changes | titles ✓, rest ✗ |
| `system:stop_hook_summary`, `compact_boundary` | hook and compaction metadata | Capture-gap and hook display | compaction ✓ |

## 3. What this means for the plan

1. **Most of the "what is it doing" story is available without a model.** Typed commands with exit codes and durations, file changes, images viewed, web queries, questions, plans/todos, sub-agent identities, tokens, context fill, cost, lines added/removed, checkpoints and turn durations are all recorded. Drishya uses perhaps half of it. Adapter work (DATA tasks in [TASKS](../TASKS.md)) comes before more visual invention.
2. **The "why" is mostly missing.** Fill it only with clearly labelled, opt-in, evidence-cited derived text (EXPLAIN tasks). This is both honest and the hackathon's load-bearing model use.
3. **Schema.** Several items need new event kinds or payload fields (usage, checkpoints, image view, question, plan). The event schema changes only by agreement between both builders; propose them as one batch.
4. **Version drift.** Codex shapes changed within this sample (`item_completed` items vs `response_item`). Every new field needs a redacted fixture and a capability declaration; unknown records stay "metadata-only", never guessed.
5. **Scale.** One local Codex rollout is 564 MB and two more exceed 160 MB. `capture-core/jsonl.ts` reads in chunks, so there is no whole-file crash, but import and tail time on these files has not been measured. That is PERF-1.

## Not checked

- Signed-in live hook/OTel enrichment paths (documented in [04](04-research-ledger.md) H1–H3) were not exercised.
- Other harnesses (OpenCode, Cursor, Gemini CLI) were not sampled.
- Image byte availability: `ImageView` and `isImage` give a path or flag; whether the image bytes still exist is a per-file question with consent and privacy implications.
