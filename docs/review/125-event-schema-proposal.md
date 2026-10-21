# 125 — Event-schema proposal: close the harness-data gap

**19 October 2026 · Claude Sonnet 5.5 · TASKS DATA-10.** Status: **proposal, nothing implemented.** The event schema changes only by agreement between both builders ([AGENTS](../../AGENTS.md#how-we-work--two-builders-one-repo)). Tick the agreement table in §9, then implementation PRs (label `schema`) may start. Evidence for every field is [123](123-harness-data-audit.md) plus the extra structure probes listed in §10.

## 1. What this changes, in one page

The seam today is `packages/contracts/src/index.ts`: **observations** (immutable, what a journal said, sanitized) feed a **projection** (derived, versioned, rebuilt by `REDUCER_VERSION`, currently `r4`). [123](123-harness-data-audit.md) found that the adapters read about half of what the harnesses record, and that current harnesses mostly do **not** record reasoning. This proposal adds the missing records as **optional fields and new kinds only**: nothing is removed or retyped, and every existing recording keeps rendering.

| Slice | Adds | Unlocks (TASKS) |
|---|---|---|
| **S1 Turns and usage** | turn timing and settings; a `usage` observation; `Projection.turns` and `usage` | TURN-1, LIVE-1, LIVE-4, DATA-2, DATA-3 |
| **S2 Typed Codex items** | `item.completed` observation with commands (real exit codes and durations), file changes (real status), MCP calls, web search, sub-agent activity; correlation to the enclosing call | DATA-1, BUG-5, CONTENT-5, READ-1 line numbers |
| **S3 Reasoning state** | an explicit "reasoning exists but is not recorded" observation | CONTENT-9 (S3 and S5 approved by Yash 2026-10-21; Harsh reviews in the PRs) |
| **S4 Questions, images, web** | question, image and richer web detail | CONTENT-1, CONTENT-2, CONTENT-3 |
| **S5 Claude extras** | checkpoint references, outside-the-agent edits, spilled-output references, `interrupted` | DATA-4, DATA-5, DATA-6 |

**Deferred, for lack of real samples:** plans and tasks beyond the existing `TodoWrite` mapping (§8).

## 2. Rules this proposal obeys

1. **Additive only.** New optional fields, new `ObservationKind` strings, new `Projection` fields. No field removed or made required. By [03 §7](../reference/03-event-schema.md) this is a minor bump: `CONTRACT_VERSION` `0.1.0-draft` → `0.2.0-draft`.
2. **Observations stay immutable and sanitized.** All new text passes ingest redaction before SQLite, blobs, previews, search and export ([AGENTS](../../AGENTS.md) constraint 3). Large text becomes a `TextValue` blob, as now.
3. **Captured is not derived.** Any value we compute (a turn end for Claude, a correlation) carries `basis: 'derived'` or a named rule. No link is invented from timing alone (constraint 5): where a correlation rests on position, it says so.
4. **Unknown stays visible.** Records the adapter does not understand remain `unknown`/`metadata-only`, never dropped, never guessed.
5. **Projection is rebuildable.** Every projection addition is computed from observations, so a reducer bump (`r4` → `r5`) rebuilds old recordings; only the *observations* need a re-import to gain new fields (§6).

## 3. S1 — Turns and usage

**Evidence.** Codex `task_complete` carries `turn_id`, `root_turn_id`, `started_at`, `completed_at`, `duration_ms`, `time_to_first_token_ms`, `error`. `turn_context` carries `model`, `effort`, `approval_policy`, `sandbox_policy`, `permission_profile`, `collaboration_mode`. `token_count` carries `total_token_usage` {input, cached, cache-write, output, reasoning-output, total}, `last_token_usage`, `model_context_window`, `rate_limits`. Claude: every assistant message has `usage` {input, cache read/creation, output, `service_tier`, `speed`}; `cost-state` has `totalCostUSD`, `totalLinesAdded/Removed`, `totalDuration`, `totalAPIDuration`, `totalToolDuration`, `modelUsage`, `hasUnknownModelCost`.

**Observation changes**

```ts
// turn.start / turn.end payloads (today: { turnId, reason? })
interface TurnPayload {
  turnId?: string; rootTurnId?: string;
  durationMs?: number; timeToFirstTokenMs?: number;   // task_complete
  error?: string;                                      // sanitized; present only if the harness recorded one
  settings?: { model?: string; effort?: string; approvalPolicy?: string; sandbox?: string; collaborationMode?: string };
  basis?: 'captured' | 'derived';                      // Claude has no turn records: its turns are derived from prompt boundaries
}

// NEW kind: 'usage'
interface UsagePayload {
  source: 'codex-token-count' | 'claude-message-usage' | 'claude-cost-state';
  model?: string; turnId?: string;
  tokens?: { input?: number; cachedInput?: number; cacheWrite?: number; output?: number; reasoningOutput?: number; total?: number };
  cumulative: boolean;                       // thread/session total vs this request
  contextWindow?: number;                    // Codex model_context_window
  cost?: { usd: number; basis: 'harness-estimate'; modelCostUnknown?: boolean };
  work?: { linesAdded?: number; linesRemoved?: number; durationMs?: number; apiDurationMs?: number; toolDurationMs?: number };
  limits?: { usedPercent: number; windowMinutes: number; resetsAt: number; plan?: string };  // primary window only
}
```

**Projection changes.** `Projection.turns: Turn[]` = `{ id, agentId, startSequence, endSequence?, startTime?, endTime?, durationMs?, timeToFirstTokenMs?, promptProseId?, error?, settings?, basis }`. `Projection.usage?: { latest?: UsagePayload; byTurn: Record<turnId, UsagePayload> }` (last point per turn only, so a 120-point Codex session stays small).

**Notes.** Codex `rate_limits` also contains `credits.balance`, `limit_id` and account-level fields: **not stored** (D6). Cost is the harness's own estimate and is never summed across sessions.

## 4. S2 — Typed Codex items (the central design question)

**Evidence.** Codex writes a typed `event_msg:item_completed` record next to the `response_item` stream. Item types and counts in the sample: `CommandExecution` 241, `FileChange` 37, `McpToolCall` 46, `ImageView` 98, `SubAgentActivity` 15, `Extension` (web search / image generation) 3, `Reasoning` 225, `AgentMessage` 53.

- `CommandExecution`: `command[]`, `parsed_cmd[]` (`read`/`unknown` in the sample), `cwd`, `source`, `status` (completed 218, failed 23), `aggregated_output`, `exit_code`, `duration {secs,nanos}`.
- `FileChange`: `changes` = object keyed by path → `{ type, content }`, `status` (completed 37), `stdout`, `stderr`. This is the missing outcome for patches nested in an `exec` wrapper, which today render as status *unknown* ("Outcome not exposed").
- `McpToolCall`: `server`, `tool`, `arguments`, `status`, `result {content[], isError}`, `error {message}`, `duration`, `readOnlyHint`.
- `SubAgentActivity`: `kind`, `agent_thread_id`, `agent_path`.

**Correlation, measured.** Typed items **cannot be matched to the wrapper call by id**: `CommandExecution` 0 of 241 and `FileChange` 0 of 37 share a `call_id`; `SubAgentActivity` matches 15 of 15; `McpToolCall` 12 of 46. But 237 of 278 command/file items (85%) were recorded **between an `exec` call and its output**, usually exactly one per call (181 of 206 windows), at most five.

So the honest relationship is *recorded inside this call's execution window*, not "this call produced it by id". That is a deterministic positional rule, exactly like a `deterministic-rule` evidence link, and it must say so.

**Observation change**

```ts
// NEW kind: 'item.completed' (harness-neutral names; today only Codex emits it)
interface ItemPayload {
  item: 'command' | 'file-change' | 'mcp-call' | 'image-view' | 'web-search' | 'image-generation' | 'subagent';
  itemId: string;
  status?: 'completed' | 'failed' | string;            // as recorded
  // command
  command?: string; cwd?: string; exitCode?: number; durationMs?: number; output?: TextValue; parsed?: { kind: string; path?: string }[];
  // file-change: one entry per path
  changes?: { path: string; type: 'add' | 'update' | 'delete' | 'move'; content?: TextValue }[];   // update = unified diff, add = full text (confirm on first fixtures)
  // mcp-call
  mcp?: { server: string; tool: string; readOnlyHint?: boolean; isError?: boolean; error?: string; result?: TextValue };
  // image / web
  image?: ImageRef; web?: { query?: string; results?: { title?: string; url: string; domain?: string; snippet?: string }[] };
  // sub-agent
  agent?: { threadId: string; path?: string; kind?: string; model?: string; effort?: string };
}
// On the Observation envelope (new optional field):
correlation?: { operationId: string; basis: 'source-id' | 'enclosing-call' };
```

`source-id` is used when the item id equals a call id (`McpToolCall`, `SubAgentActivity`); `enclosing-call` when the adapter saw the item while exactly one `exec` call was open. Zero or several open calls → no `correlation`, and the item stands alone.

**Projection changes**

- `Operation.parentOperationId?: string`, `Operation.durationMs?: number` (harness-reported, separate from timestamp arithmetic), `Operation.executions?` is **not** added: typed items become child **operations** instead (below).
- A typed `command` inside a wrapper's window becomes an `Operation` of kind `shell`/`test` with the **real command, exit code, duration and output**, `parentOperationId` = the wrapper, `classification` = captured, and a link `{ relation: 'tool-result', basis: 'deterministic-rule', ruleVersion: 'codex-enclosing-call-v1', explanation: 'Recorded between this call and its output.' }`. Test recognition runs on the real command, which fixes BUG-5.
- A typed `file-change` supplies the **status** of the wrapper's nested edit ops, matched by exact path: `unknown` → `ok`/`error`, provenance `captured` with the rule above. If the path set differs, the status stays `unknown`.
- Children **take their parent's timeline position**, not the sequence they were appended at (§6).
- `mcp-call` enriches the existing MCP operation (`durationMs`, `readOnlyHint`, `error`); `subagent` fills `Agent.model/effort/nickname/address` (see agent identity below).

**Agent identity (small, same slice).** `Agent` gains optional `nickname`, `address` (Codex `agent_path`), `effort`, `forkedFromId`. Observation side: `session.meta` payload gains `agentNickname`, `agentPath`, `parentThreadId`, `forkedFromId`, `effort`.

## 5. S3 to S5 (smaller slices)

**S3 Reasoning state.** Today the adapters emit nothing for empty reasoning, so the UI cannot say "not recorded". Add `MessagePayload.exposure: 'full' | 'summary' | 'none'` plus `reason?: 'encrypted' | 'signature-only' | 'empty'`. One observation per reasoning item (3,624 in the sample); the projection folds consecutive `none` items in a turn into one `Prose { role: 'reasoning', exposure: 'none', count }`. Evidence: Claude 223 of 225 thinking blocks empty; Codex 3,624 of 3,624 encrypted, summaries on 109.

**S4 Questions, images, web.**

```ts
interface ImageRef { path?: string; mime?: string; bytes?: number; width?: number; height?: number;
  origin: 'agent-viewed' | 'user-attached' | 'tool-output' | 'generated'; blob?: string /* sha256, only when bytes were in the journal */;
  availability: Availability; revisedPrompt?: TextValue; savedPath?: string }
// Projection detail only: built from the existing tool.call/tool.result of AskUserQuestion (Claude) and request_user_input_async (Codex); no new observation kind.
interface QuestionDetail { questions: { id?: string; header?: string; question: string; multiSelect?: boolean; options?: { label: string; description?: string }[] }[];
  state: 'pending' | 'answered' | 'cancelled' | 'unknown'; answers?: { question: string; answer: string | string[]; note?: string }[] }
```

User-attached images (Codex `input_image` blocks) ride on `MessagePayload.attachments?: ImageRef[]`; agent-viewed and generated images arrive through `item.completed`. Codex `AgentMessage.questions` is not modelled in this batch (the question text is read from the `request_user_input_async` call). Projection: `OperationKind` gains `'image'` and `'question'`; `OperationDetail` gains `{ kind: 'image'; image: ImageRef; artifactId?: string }` and `{ kind: 'question'; … }`; `ArtifactKind` gains `'image'` (with `mime`); `web` detail gains `status?`, `bytes?`, `durationMs?`, `results?`. Evidence: Claude `AskUserQuestion` input/result {questions[{question, header, multiSelect, options[]]}], answers keyed by question text, annotations}; Codex `request_user_input_async` args `questions[{title}]` and `AgentMessage.questions[{title, options}]`; Codex `ImageView {path}`, user `input_image` blocks (11), Claude Bash `isImage`; Claude `WebFetch` {url, code, bytes, durationMs, result}, `WebSearch` {query, results, durationSeconds}; Codex `Extension` {query, results[{title,url,domain,snippet}]}.

**S5 Claude extras.**

- `checkpoint` kind: `{ messageId; at; files: { path; backup?: { name; version; time }; parentDir? }[] }`, **references only** (the backup bytes stay on disk and are read lazily under workspace consent, like current-file reading; retention may have removed them).
- `external.change` kind: `{ path; snippet?: TextValue; basis: 'harness-notice' }` from `attachment:edited_text_file`, shown as "changed outside the agent", never attributed to a person. Projection: `Projection.notices`.
- `ToolResultPayload` gains `interrupted?: boolean`, `persistedOutput?: { path: string; bytes?: number }` (reference only), `exitCode`/`durationMs` already exist.

## 6. Compatibility, versions and re-import

- **Versions.** `CONTRACT_VERSION` → `0.2.0-draft`; `REDUCER_VERSION` `r4` → `r5` (rebuilds projections). The store already records what each recording was written with.
- **Old recordings keep working.** All additions are optional; a recording without them renders exactly as today.
- **Old recordings gain the new data only by re-importing the journal** (observations are stored sanitized, not raw). A re-import appends *new* observations (new ids), after all existing ones, so **`receivedSequence` order is not time order for them**. Therefore: usage and checkpoints are keyed by `sourceTime`/`turnId`; typed items use their `correlation` and children take the parent's timeline position. The reducer must never place an enrichment record by its own sequence. Fixtures must include "original import, then enrichment re-import" and assert an identical timeline for the old records.
- **Unavailable journals.** If the journal is gone, the recording stays as it was; the UI shows nothing extra rather than a promise (D8).
- **Third-party adapters** keep working: nothing they emit changes meaning.

## 7. Privacy

- Typed `aggregated_output`, `stdout`, `stderr`, MCP `result`, file-change `content` and question text are new text surfaces. **All go through ingest redaction like existing tool output**; they are `TextValue` blobs, and identical sanitized bytes dedupe by sha256 against the output already stored from `response_item`.
- Protected-file rule: a typed item for a protected path keeps `denyContent` exactly like the call it belongs to; `changes[].content` is omitted for protected paths.
- **Images:** bytes are captured only when the journal already contains them inline, within a size cap (D7). A bare `path` is stored as a reference and **never opened automatically**; opening needs workspace consent and says the file may differ from what the agent saw.
- **Account data is excluded:** Codex `credits.balance`, `limit_id`, ids that identify an account (D6).
- No new network calls; nothing here sends data anywhere. The explain package (Nemotron) stays opt-in per call.

## 8. Deliberately not proposed, and why

- **Plans and tasks.** The sample journals on this machine contain **no** real `TodoWrite`, `TaskCreate`, `TaskUpdate` or `ExitPlanMode` calls (earlier counts came from tool definitions in system prompts; only `TaskStop` ×2 appears). `TodoWrite` is already mapped. Specify the rest after a real Claude plan-mode session is captured. Codex `plan_update` and `turn_diff` are in the adapter's ignore list but absent from the sample (DATA-7); same rule.
- **Per-request timing** from Claude `iterations`/`speed` beyond what `usage` carries.
- **Raw reasoning content.** `Reasoning.raw_content` is empty in every sample; we model only what exists.
- **A browser-session grouping.** Grouping consecutive browser-MCP calls is presentation, not schema.

## 9. Decisions to agree

Tick when agreed (initial and date). Recommendation first; the alternative is listed so the disagreement is concrete.

| # | Decision | Recommendation | Alternative | Yash | Harsh |
|---|---|---|---|---|---|
| D1 | How typed items attach to the wrapper | Separate observations + `correlation` (`source-id` / `enclosing-call`), children become operations with `parentOperationId` | Attach as nested data on the wrapper op (no child operations) | ☑ YD 2026-10-20 | ☑ HJ 2026-10-20 |
| D2 | What the UI shows when a wrapper has typed children | Children are the cards; the wrapper stays reachable as "script" in details | Show both (duplicates), or wrapper only | ☑ YD 2026-10-20 | ☑ HJ 2026-10-20 |
| D3 | New operation kinds `image`, `question` | Add, after an audit that every `KIND_LABEL`-style lookup has a safe fallback | Reuse `other` with a detail kind | ☑ YD 2026-10-20 (not in 60e4040's list; Yash to confirm) | ☐ |
| D4 | Usage as its own `usage` observation | Yes; projection keeps last point per turn | Fields on `turn.end` only | ☑ YD 2026-10-20 | ☑ HJ 2026-10-20 |
| D5 | Show harness-estimated cost | Yes, labelled "harness estimate", per session, hidden when `hasUnknownModelCost` | Never show cost | ☑ YD 2026-10-20 | ☑ HJ 2026-10-20 |
| D6 | Rate-limit data | Store primary window `usedPercent`, `windowMinutes`, `resetsAt`, `plan`; drop credits balance and ids | Store nothing about limits | ☑ YD 2026-10-20 (per 60e4040) | ☑ HJ 2026-10-20 |
| D7 | Image bytes | Only when inline in the journal, ≤ 1 MiB each, ≤ 32 per recording, redaction/type sniff first; paths are references | References only, never bytes | ☑ YD 2026-10-21 (caps provisional; revisit on real image-heavy sessions) | ☐ |
| D8 | Enriching existing recordings | Re-import appends new observations to the same recording (order-independent, §6); offer it only if the journal still exists | Re-import creates a new recording | ☑ YD 2026-10-20 (per 60e4040) | ☑ HJ 2026-10-20 |
| D9 | Claude turn boundaries | Derive from prompt boundaries, `basis: 'derived'`, labelled | Show no turn durations for Claude | ☐ | ☐ |
| D10 | Plans | Wait for a real captured sample | Specify now from tool definitions | ☐ | ☐ |

**Checked by Yash with Claude, 20 Oct, before ticking D1, D2, D4, D5, D6 and D8** (structure only, 30 real Codex journals and 157 Claude files on this machine; no content read):

- **D1/D2.** Over 30 journals: 0 of 7,034 `CommandExecution` and 0 of 1,520 `FileChange` items share an id with a call, so `correlation` cannot be `source-id` for them. 7,777 of 8,554 (91%) were recorded while exactly one `exec` call was open (calls never overlapped, so the enclosing call is always unique); 4,483 of 5,902 windows hold exactly one item, the rest several, which is why children are separate operations and `FileChange` is matched by exact path. The remaining 9% have no open call and stand alone, as §4 says. `McpToolCall` matches by id in 431 of 587 (73%), the rest fall back to the window. The recommendation holds; the 85% / 181-of-206 figures in §4 were from the smaller first sample.
- **D4.** `appendObservations` skips any observation whose id already exists, so a field added to an *existing* kind (e.g. timing on `turn.end`) can never reach an old recording. Only new ids are appended. That is the strongest argument for a separate `usage` observation: it back-fills; the alternative does not.
- **D5/D6.** `token_count.rate_limits` has `primary { used_percent, window_minutes, resets_at }`, `plan_type` and `credits { has_credits, unlimited, balance }` (7,723 of 7,724 events). Storing the primary window and plan and dropping credits and ids is what the data supports. `cost-state` with `hasUnknownModelCost` appears in 157 Claude files.
- **D8, an implementation requirement.** Today a plain re-import reads nothing: `upsertSource` is `ON CONFLICT DO NOTHING`, so the source cursor stays at the end of the file. DATA-1/DATA-2 must add an explicit *rescan from the start* (reset the cursor, keep the recording); existing ids are then skipped and only new observations are appended, as §6 describes. Offer it only when the journal still exists.
- **For the implementers.** Ids of existing observation kinds must stay stable across adapter versions, otherwise enrichment duplicates old records instead of adding to them. New data goes in new-id observations.

## 10. Fixtures, tests and order of work

**Fixtures** (redacted/synthetic only; `.gitignore` refuses `*.jsonl` elsewhere): one per new record type: Codex `item_completed` ×6 types, a window with 1 and with 3 commands, a nested patch with `FileChange`, `token_count` with `rate_limits`, `task_complete`, empty/encrypted `Reasoning`; Claude `cost-state`, `message.usage`, `file-history-snapshot`, `edited_text_file`, `AskUserQuestion`, spilled output, `isImage`. Plus the "import, then enrichment re-import" pair. **Golden tests** on the projection for each; adapters get a capability declaration per CLI version, and unknown shapes must stay `metadata-only`.

**Probes behind this document** (structure only, no content printed): journal-type counts (123); id correlation between typed items and calls; call-window containment; field-type shapes for `rate_limits`, `McpToolCall`, `Extension`, `ImageView`, `SubAgentActivity`, `task_complete`, `AskUserQuestion`, `file-history-snapshot`, `WebFetch`, `WebSearch`. Scripts are short and can be re-run on any machine.

**Order** (each is its own PR labelled `schema`, with fixtures and golden tests, and bumps `r5` once):

1. **S1** turns and usage → TURN-1, LIVE-1, DATA-2, DATA-3.
2. **S2** typed Codex items → DATA-1 (and BUG-5, CONTENT-5).
3. **S3** reasoning state → CONTENT-9.
4. **S4** questions, images, web → CONTENT-3, CONTENT-1, CONTENT-2 (after D3's fallback audit).
5. **S5** Claude extras → DATA-4/5/6.

DATA-1 is blocked until D1, D2 and D8 are ticked; DATA-2 until D4–D6.
