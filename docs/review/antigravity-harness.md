# Antigravity as a third harness (HARNESS-AG research)

Research only, 13 November 2026. No product code. Everything below was measured on this machine from the installed app and its files, opened **read-only** (copies of the conversation databases went to the git-ignored `.local/antigravity-research/`). No conversation content is quoted: only file names, keys, record types, counts and sizes. Public-documentation facts, with links, are in the [research ledger](04-research-ledger.md#antigravity-google-13-november-2026). The build brief is [AG-1 to AG-6 in TASKS](../PRODUCT_WORK_HISTORY.md).

## 1. Verdict

Antigravity can be supported, and live view is feasible. Three findings drive the design:

1. **Each conversation has an append-only JSONL transcript** (`brain/<id>/.system_generated/logs/transcript_full.jsonl`). It is plain text, one record per agent step, and its file is created with the first step and touched within seconds of each later step. It fits Drishya's existing JSONL ingest (byte-offset cursors, generations, tailing) with no new source kind. It also covers 12 of the 21 older conversations whose own file is encrypted.
2. **The per-conversation SQLite database holds what the transcript lacks** (workspace, branch, git origin, model, token usage, typed exit codes, subagent lineage, exact per-step tool identity), but two thirds of its steps are `CLEARED` (results dropped). It is a metadata and enrichment source, not the primary one.
3. **Antigravity records plaintext reasoning** (`thinking`), unlike the current Claude Code and Codex journals ([123](123-harness-data-audit.md)). It needs a labelling decision from Yash before it is shown.

What cannot be shown faithfully: most command exit codes (so pass/fail is unknown for most commands), edit hunks as the harness applied them (only the requested old/new strings), tool-call ids (calls pair to results by position), model names (opaque enum numbers), browser actions and MCP calls (none exist in any local session), and anything inside the 21 encrypted legacy `.pb` files.

## 2. What is installed

| Item | Value |
|---|---|
| App | `%LOCALAPPDATA%\Programs\antigravity\` (Electron, a VS Code fork). Uninstall entry says **2.31.2**; the `version` file says **44.9.1**. Unexplained; record both. |
| Agent backend | `resources\bin\language_server.exe` (198 MB, Go). Embeds its protobuf descriptors (616 `.proto` files; the step schema is `third_party/jetski/cortex_pb/cortex.proto`, package `exa.cortex_pb`). Has an `agentapi` subcommand (`get-conversation-metadata`, `new-conversation`, `send-message`) that needs `ANTIGRAVITY_LS_ADDRESS`, i.e. a live local RPC. **Out of scope:** Drishya stays a passive file reader. |
| Not running at survey time | no `antigravity` or `language_server` process; two `presence/*.lock` files remained. |

## 3. Where everything lives

`<AG>` = `%USERPROFILE%\.gemini\antigravity\` (793 MB, 9,464 files, last write today).

| Path | Format | Written | Use for Drishya |
|---|---|---|---|
| `<AG>\brain\<conversationId>\.system_generated\logs\transcript_full.jsonl` | JSONL, UTF-8, `\n` | appended as steps happen (see §9) | **Primary journal.** Present for 44 of 54 transcript conversations. Full text. |
| `…\logs\transcript.jsonl` | JSONL, same keys | same | Same records but long `content`/`tool_calls`/`thinking` are **truncated** and named in `truncated_fields`. Fallback when `transcript_full` is absent. |
| `…\logs\chunks\transcript[_full]\NNNNNNNN.jsonl` | the same bytes cut into 100 KiB slices (byte-exact, concatenation equals the main file; cuts fall mid-record) | with the main file | Ignore. Never read chunks. |
| `…\logs\media\step_<n>_media_<k>.png/.jpg` | image files | at the step | Screenshots and images a step produced (347 referenced in one session). |
| `<AG>\brain\<id>\.system_generated\steps\<stepIndex>\output.txt` | text | at the step | Full output of a large tool result; the step's `full_output_uri` points here (4,699 files). |
| `…\.system_generated\tasks\task-<n>.log` | text | while a background command runs | Output of background commands (507 files). |
| `…\.system_generated\messages\<id>.json` (+ `undelivered\`) | JSON | per message | Agent-to-agent and system messages: `id, recipient, sender, priority, timestamp, content`, optional `renderDetails.messageTitle`, `hideFromUser`, `sourceMetadata.tool{conversationId, stepIndex, toolCall{id, name, argumentsJson}}` (707 files). |
| `…\.system_generated\subagents\<id>.json` | JSON | at spawn | `conversationId, subagentDescriptor{typeName, role}, state, spawnStepIndex, workspaceUris` (21 files). |
| `<AG>\brain\<id>\{implementation_plan,task,walkthrough}.md` | Markdown | edited by the agent | **Artifacts.** Each has `<name>.metadata.json` (`artifactType?, summary, updatedAt, requestFeedback?, version?, userFacing?`) and numbered versions `<name>.md.resolved[.N]`. |
| `<AG>\brain\<id>\{.user_uploaded,.tempmediaStorage,scratch}\` | images, PDFs, agent-written code | at upload / write | User attachments; agent scratch files. |
| `<AG>\conversations\<id>.db` | **SQLite, WAL mode** | per step | Metadata and enrichment (§6). 42 files, about 270 MB. |
| `<AG>\conversations\<id>.pb` | **encrypted** (entropy 8.000 bits/byte, no structure) | n/a | **Unreadable.** 21 files, 104 MB, last written 17 Sep. |
| `<AG>\conversation_summaries.db` | SQLite + FTS5 | on change | **Session index:** one row per conversation (63 of 63). Columns: `conversation_id, title, preview, step_count, last_modified_time, workspace_uris, status, source, project_id, agent_name, parent_conversation_id, nesting_depth, battle_id, killed, last_user_input_time, last_user_input_step_index, app_data_dir, raw_summary, group_id`. |
| `<AG>\agyhub_summaries_proto.pb` | plaintext protobuf (entropy 6.1) | n/a | Not decoded. Possibly redundant with the summaries DB. |
| `<AG>\browser_recordings\<uuid>\<n>.jpg` + `metadata.json` | JPEG frames | during browser-agent runs | 681 frames in one recording, last written 15 May. |
| `<AG>\annotations\<id>.pbtxt`, `implicit\*.pb`, `antigravity_state.pbtxt`, `installation_id` | small text/protobuf | n/a | Not needed. |
| `<AG>\daemon\hub_<pid>.json` | JSON | per hub process | **Never read.** Holds `pid, httpsPort, httpPort, lsVersion, csrfToken`. |
| `%USERPROFILE%\.gemini\config\projects\<uuid>.json` | JSON | on change | Antigravity "projects": `id, name, projectResources[{folderUri\|gitFolder}], settings{fileAccessPolicy, internetPolicy, autoExecutionPolicy, artifactReviewMode}`. Optional workspace naming. |
| `%USERPROFILE%\.gemini\antigravity-ide\`, `antigravity-backup\` | older layout, byte-identical sizes (1,209 files, 203,540,361 bytes each), dated 20 May | n/a | Legacy IDE-era copies: 10 encrypted `.pb` conversations plus `brain\`. Dedupe by conversation id; low priority. |
| `%USERPROFILE%\.gemini\antigravity-browser-profile\` | a full Chromium profile (326 MB) | n/a | **Never read** (cookies, saved logins). |
| `%APPDATA%\Antigravity\` | VS Code user data (`User\globalStorage\state.vscdb`, caches) | n/a | **Not opened.** Credential-bearing; not needed. |

### Corpus on this machine

63 conversation ids in `conversations\`: 42 `.db` (each with a brain folder and both transcripts) and 21 `.pb`. Of the `.pb`: 12 have a transcript (10 `transcript.jsonl` only, 2 with both), 9 have only artifacts. Two brain folders have no conversation file. So **54 conversations are readable through a transcript** (16,643 steps, 30.6 MB for `transcript.jsonl`, 0 unparsable lines); 9 are unreadable except for their artifacts. `conversation_summaries.db` lists all 63. Of those, **43 are subagent conversations** (a `parent_conversation_id`, nesting depth at most 1), so only 20 are top-level sessions. The largest conversation is 13,371 steps (a 203 MB `.db`, 24.6 MB `transcript.jsonl`, 43.7 MB `transcript_full.jsonl`), still live today.

## 4. The transcript record

One JSON object per line. Across all 54 files the core keys are identical (`step_index, source, type, status, created_at, content, tool_calls, thinking`); `truncated_fields` appears in 44 files (only `transcript.jsonl`), `error` in 10, `media` in 4, token counts in 6.

| Key | Shape | Notes |
|---|---|---|
| `step_index` | int, dense, 0-based | Strictly increasing in file order. Same index appears twice in 10 records across the corpus (`DONE` then `DONE`): treat the later record as a replacement. |
| `source` | `MODEL` 15,455 · `SYSTEM` 997 · `USER_EXPLICIT` 191 | `USER_EXPLICIT` is a person. |
| `type` | `GENERIC` 8,283 · `PLANNER_RESPONSE` 6,377 · `SYSTEM_MESSAGE` 575 · `EPHEMERAL_MESSAGE` 293 · `USER_INPUT` 191 · `VIEW_FILE` 322 · `LIST_DIRECTORY` 142 · `CODE_ACTION` 118 · `RUN_COMMAND` 108 · `CHECKPOINT` 75 · `SEARCH_WEB` 59 · `GREP_SEARCH` 35 · `ERROR_MESSAGE` 28 · `CONVERSATION_HISTORY` 26 · `INVOKE_SUBAGENT` 7 · `READ_URL_CONTENT` 4 | Newer conversations use `GENERIC` for every tool result; older ones use the typed results (`VIEW_FILE`, `CODE_ACTION`, …). The **tool is named on the call**, in either case. |
| `status` | `DONE` 15,860 · `RUNNING` 491 · `ERROR` 292 | `RUNNING` is a snapshot that is **never rewritten** in the transcript (a command that went to the background). |
| `created_at` | `YYYY-MM-DDTHH:MM:SSZ`, UTC, whole seconds | Not monotonic: 8 regressions of up to 12 s in the large session. |
| `content` | text | The user's prompt, the model's prose, or a tool result. Results carry a `Created At:` / `Completed At:` header in **local time with offset** (`+05:30` on all 8,239 here). |
| `thinking` | text | Present on about half of `PLANNER_RESPONSE` records (3,108 of 6,309 reading `transcript_full` where it exists). See §8. |
| `tool_calls` | `[{name, args}]`, only on `PLANNER_RESPONSE` (5,991) | `args` values are **JSON-encoded strings** (a string argument arrives as `"\"x\""`, a number as `"12"`). **No call id.** |
| `error` | text | On the failed result record (283 in the large session). |
| `media` | `[{mime_type, uri}]` | `image/png` 340, `image/jpeg` 10 in the large session. `uri` is a `file:///` path to `logs\media\…`, or an absolute path into `.user_uploaded`/`.tempmediaStorage`. Bytes are **not** in the journal. |
| `input_tokens`, `output_tokens`, `cache_read_tokens` | ints on `PLANNER_RESPONSE` | 6 of 54 files only. |
| `truncated_fields` | `["content","tool_calls","thinking"]` | `transcript.jsonl` only. |

**Which transcript file.** Of the 44 conversations that have both files, 42 hold the same number of records. Two (both legacy, `.pb`) differ: in one `transcript_full.jsonl` has 75 records against 273 in `transcript.jsonl`, in the other 282 against 264. So the rule is not "full wins": read both heads, use the file whose last `step_index` is larger, and mark any truncated field `partial`.

**Call to result pairing.** A `PLANNER_RESPONSE` lists its calls; the `GENERIC` (or typed) records that follow are their results **in call order**. Of 5,991 planner records with calls, 5,557 are followed by exactly as many result records, 434 by fewer (cancelled or never run), none by more. There is no id in the transcript, so pairing is by order, with the tool name checkable against the database (step `metadata.tool_call`) when it is available.

## 5. Tool names and result shapes (22 names in the corpus)

`read_file` 3,059 · `run_command` 2,973 · `manage_task` 960 · `edit_file` 740 · `view_file` 504 · `write_file` 302 · `list_dir` 164 · `write_to_file` 159 · `search_web` 60 · `grep_search` 52 · `send_message` 24 · `replace_file_content` 24 · `multi_replace_file_content` 23 · `schedule` 19 · `invoke_subagent` 14 · `read_url_content` 4 · `find_by_name` 4 · `define_subagent` 2 · `manage_subagents` 2 · `ask_permission` 1 · `search_marketplace` 1 · `ask_question` 1.

All tools are built in (`CORTEX_COMPONENT_SOURCE_BUILTIN` on all 7,961 database steps that record a source). **No MCP call, no browser step and no notify-user step exists in any local session**, although the schema defines about 30 browser step types, `MCP_TOOL`, `ASK_QUESTION` and `NOTIFY_USER`.

Argument keys seen: `Path` / `AbsolutePath` / `TargetFile`, `StartLine`, `EndLine`, `CommandLine`, `Cwd`, `WaitMsBeforeAsync`, `IsDaemon`, `Content` / `CodeContent`, `Overwrite`, `Target` / `Replacement` / `TargetContent` / `ReplacementContent`, `AllowMultiple`, `Instruction`, `Query`, `SearchPath`, `Includes`, `IsRegex`, `MatchPerLine`, `CaseInsensitive`, `DirectoryPath`, `Pattern`, `SearchDirectory`, `Extensions`, `Action` (`status` 857, `kill` 73, `list` 26, `send_input` 4), `TaskId`, `Recipient`, `Message`, `Subagents`, `Prompt`, `DurationSeconds`, `TimerCondition`, `ArtifactMetadata`, `toolSummary`, `toolAction`.

Result shapes (header lines only): reads carry `Created At / Completed At / File Path / Total Lines / Total Bytes / Showing lines a-b of N` then `N: text` rows (2,585 of 3,059 `read_file` results are line-numbered; 347 carry an image). Commands carry `Command output` (2,153 results); an exit code appears in text for only 21 of them. Background-task polls carry `Task / Status / Log / Log output / Last progress`. Edits are short (average 223 characters): **194 of 740 `edit_file` calls failed with "target content not found"** and 71 file-not-found failures in all, so failure handling is the normal case, not the edge.

## 6. The conversation database (SQLite, WAL)

Tables: `trajectory_meta` (1 row: `trajectory_id, cascade_id, trajectory_type 4, source 1`), `steps` (`idx, step_type, status, has_subtrajectory, metadata, error_details, permissions, task_details, render_info, step_payload, step_format`), `gen_metadata` (per model generation, up to 6.8 MB), `executor_metadata`, `trajectory_metadata_blob`, `parent_references`, `battle_mode_infos`. Columns marked blob are **protobuf** (`gemini_coder.Step`, `exa.cortex_pb.CortexStepMetadata`, `CortexTrajectoryMetadata`); the schema was recovered from the descriptors embedded in `language_server.exe` and checked against the data (all 242 steps of two sampled conversations, then all 15,474 steps of 42, with no decode errors).

| Wanted | Where | Coverage |
|---|---|---|
| Workspace folders, git root, branch, git origin URL, project id | `trajectory_metadata_blob` (`workspaces[]`, `workspace_uris`, `project_id`) | `workspace_uris` on all 42; branch, repository and git root on 27 |
| Subagent lineage and role/model | same blob (`parent_conversation_id`, `root_conversation_id`, `subagent_spec`) | 32 of 42 |
| Per-step exact tool call (id, name, args) | `steps.metadata.tool_call` | 8,664 |
| Model per step | `metadata.generator_model`, `model_usage.model` | **opaque**: `MODEL_PLACEHOLDER_M318` (12,842 steps), `…_M16`, `…_M26`, `…_M322`, … The numbers are not names; the mapping is not in the binary's enum. |
| Token usage per step | `metadata.model_usage` (input, output, thinking, cache read/write) | 6,037 steps |
| Step start/finish times with nanosecond resolution | `metadata.created_at, started_at, finished_generating_at, completed_at` | all |
| Typed file edit with a unified diff and counts | `step_payload` → `generic.result.payload` `FileEdit{path, kind EDIT/OVERWRITE/CREATE, diff.unified_diff.lines[type,text], diff_stats}` | 173 non-cleared steps |
| Typed read range | `ReadFile{path, start_line, end_line, file_num_lines, file_num_bytes}` | 280 |
| Typed command | `RunCommand{command_line, cwd, exit_code, shell_name}` | 679, but **exit code on 107** |
| Subagent spawn result | `InvokeSubagent{subagents[], results[{conversation_id, log_absolute_uri, workspace_uris}]}` | 2 non-cleared |

**Step status in the database:** `CLEARED` 10,439 · `DONE` 4,999 · `CANCELED` 22 · `ERROR` 12 · `RUNNING` 2. A `CLEARED` step keeps its metadata and its tool-call arguments but **loses its result and the planner's thinking**. The transcript keeps both, so the transcript is the only complete source of tool results. The database has 23 `CHECKPOINT`, 9 `ERROR_MESSAGE`, 6 `PLANNER_RESPONSE`, 6 `SYSTEM_MESSAGE` and 5 `GENERIC` steps that the transcript lacks (the transcript is missing 5 to 12 trailing steps in 19 of 42 pairs; the types never disagree at a shared index). Step counts equal the summaries' `step_count` for all 42.

**Reading it without touching it.** Opening a WAL database normally creates `-wal` and `-shm` files beside it; in the harness folder that would be a write. In this run the real `conversations\` folder has **no** side files (every one seen in the scratch copies was created by reading the copies). `node:sqlite` opens with `file:<path>?mode=ro&immutable=1` read the copies with no side files, but `immutable` ignores uncommitted WAL pages, so it can lag a running agent. Decision for the build: read databases only with `immutable=1`, only for metadata that does not change often (workspace, lineage), and take live content from the JSONL.

## 7. Conversation to repository

Transcripts carry **no workspace**. It comes from, in order: `conversation_summaries.db` (`workspace_uris`, a JSON array of `file:///` URIs, non-empty on 57 of 63, including conversations whose own file is encrypted), then the conversation database blob (adds branch, git root, origin). Neither is captured text from the agent's own words, but both are harness records, so they can populate `cwd`, `repositoryRoot` and `branchRef` as captured. Paths in tool arguments are absolute. A conversation may list several workspace folders; Drishya needs a rule for which is the session's `cwd` (recommended: the folder that contains the most captured file paths, recorded as derived; the rest become additional roots). Titles are mostly empty (7 of 63); `preview` (50 of 63) is a prefix of the first prompt.

Subagents are separate conversations: `parent_conversation_id` (43 rows), `nesting_depth`, `agent_name`. They map onto `DiscoveredSource.parentSessionId` / `agentName`, as Codex sub-agent threads already do.

## 8. Reasoning

Antigravity stores `thinking` as plain text on `PLANNER_RESPONSE` (about half of the records; the schema also has `raw_thinking`, `thinking_signature` bytes, `thinking_redacted` and `thinking_duration`, none of which appear in transcripts). It appears to be the model-provided thinking summary, not necessarily the raw chain of thought; the files do not say. This differs from the finding in [123](123-harness-data-audit.md) that harnesses mostly no longer record reasoning. **Decision for Yash:** store it as the existing `reasoning` observation and show it only as "thinking recorded by Antigravity", never as the agent's intent and never summarised by Drishya. Until decided, the adapter stores it (so the choice can be made later without re-import) and the UI does not show it.

## 9. Live-tail feasibility: yes, through the JSONL

Evidence, from 54 transcripts: the file's creation time is within 5 minutes of the first step in 11 of the 12 sessions longer than 30 minutes (median 0.0 min); the modification time is a median 0.2 minutes after the last step's `created_at`; the large session's file ends 0.1 minutes after its last step. The 100 KiB chunk files are written alongside, and cuts fall inside records, which proves records are appended, not rewritten. `RUNNING` records are the in-flight state at write time. The database is WAL, and the real folder had no WAL files at survey time, so its timeliness could not be measured and it is **not** the live source.

Not verified: the exact flush cadence (a genuine run observing the file during a step is part of AG-3's acceptance), whether `transcript_full.jsonl` is written for a conversation from its first step (the 10 conversations with only `transcript.jsonl` are older ones), and the behaviour on a crash (several public reports describe corrupted conversation files after unclean shutdown; see the ledger).

Hazards for the tailer: a final line can be partial (existing `readJsonl` already handles this); a `step_index` can repeat; `created_at` can move back by seconds, so order by `step_index`, never by time; a `RUNNING` step may never get a final record in the transcript, so a finished session shows it as "no recorded result", never as a failure.

## 10. Images and media

Images are **files on disk referenced by path** (`media[].uri`), not inline bytes: 340 PNG and 10 JPEG in the large session, 347 attached to `read_file` results (the agent reading a screenshot), 10 under `.user_uploaded`/`.tempmediaStorage` on user prompts. The existing rule ([CONTENT-1 D7](125-event-schema-proposal.md)) keeps image bytes only when the journal already holds them inline. Applied as written, every Antigravity image would be a bare reference. Pixels cannot be pattern-redacted, so reading referenced files is a privacy decision, not a plumbing one (see §14 and AG-4). Browser recordings are a folder of JPEG frames plus `metadata.json`, not a video.

## 11. Anything encrypted or binary

| What | State |
|---|---|
| `conversations\*.pb` (21) | Encrypted; indistinguishable from random (entropy 8.000, no printable structure). Not readable. Public reports reach the same conclusion. The 12 with transcripts are still importable through them. |
| `conversations\*.db` blobs | Protobuf, readable with the recovered schema (the schema can change between app versions: it is an undocumented internal format). |
| `thinking_signature`, `encoded_preprocessed_input` | opaque bytes; ignore. |
| `agyhub_summaries_proto.pb`, `implicit\*.pb`, `annotations\*.pbtxt` | not needed. |

## 12. Mapping to Drishya operations

`ToolIntent` / `ToolOutcome` are in `packages/capture-core/src/intent.ts`. "Display name" is the Antigravity tool name kept for display; the reducer never sees it.

| Antigravity | Drishya operation | Intent | Outcome | Faithful? |
|---|---|---|---|---|
| `read_file`, `view_file` (`VIEW_FILE`) | read | `read {path, offset: StartLine, limit: EndLine-StartLine+1}` | `read {content, startLine, numLines, totalLines, harnessLineNumbers: true}` from the header and `N:` rows | Yes. Binary or image reads carry `media`. |
| `write_file`, `write_to_file` | write | `write {path, content}` | `edit {created}` when the result says "Created file"; overwrite by `Overwrite` | Intent yes; success is "tool reported done", not a confirmed after-state. |
| `edit_file`, `replace_file_content`, `multi_replace_file_content` (`CODE_ACTION`) | edit | `edit {path, edits[{oldString: Target, newString: Replacement, replaceAll: AllowMultiple}]}` | `edit` from the database `FileEdit` unified diff when not cleared (AG-6); otherwise none | Requested change yes; applied hunks only for 173 non-cleared steps; 26% of edits fail, so failure must be explicit. |
| `grep_search` (`GREP_SEARCH`) | search (text) | `search {mode:'text', query, path: SearchPath, glob: Includes}` | `search {lines}` | Yes. |
| `find_by_name` | search (file) | `search {mode:'file', query: Pattern, path: SearchDirectory}` | `search {files}` | Yes (4 seen). |
| `list_dir` (`LIST_DIRECTORY`) | other | `other` (display name kept) | text | Yes. No directory intent exists; do not fake one. |
| `run_command` (`RUN_COMMAND`) | command | `shell {command: CommandLine, cwd: Cwd}` | `shell {stdout, run{backgroundTaskId when RUNNING, persistedOutput from full_output_uri}}` | Command and output yes. **Exit code mostly unknown** (21 in text, 107 in typed payloads): show "no exit status recorded", never pass or fail. Output is one stream, no stdout/stderr split. |
| `manage_task` (`Action` status, kill, list, send_input) | command control | `other` linked by `TaskId` to the command | text | Yes; associates with the command's background task id. |
| `search_web`, `read_url_content` | web | `web {query}` / `web {url}` | `web {text}` | Yes. |
| `invoke_subagent`, `define_subagent`, `manage_subagents` | spawn | `spawn {agentType: type_name, description: role, prompt}` | `spawn {childAgentId: conversation_id}` | Yes, child = another conversation (source link by `subagents\*.json`, `spawnStepIndex`). |
| `send_message` | agent delivery | map to the existing agent-delivery observation (`sender, recipient, type, state`) from `messages\*.json` | n/a | Likely; shape to be confirmed against Codex's `agentDelivery`. |
| `schedule`, `search_marketplace` | other | `other` | text | Yes. |
| `ask_question`, `ask_permission` | question / approval | not yet mapped: 1 sample each, outcomes unseen | | **Generate real sessions first** (AG-5). |
| `implementation_plan.md`, `task.md`, `walkthrough.md` writes (args carry `ArtifactMetadata`) | plan | captured Markdown plan or checklist, not a repo file edit | | Plan text yes. Checklist statuses come from `[ ]/[x]` in the text: label derived. Versions via `.resolved.N`. Must not appear as a write into the user's repository. |
| `CHECKPOINT` | compaction | `compaction` | the agent's own session and code-change summary text | Captured, authored by the model; label it. |
| `USER_INPUT` (`USER_EXPLICIT`) | message.user / turn.start | | | Yes; images as references. |
| `PLANNER_RESPONSE` | message.assistant, reasoning, tool.call | | | Prose and thinking yes. |
| `SYSTEM_MESSAGE`, `EPHEMERAL_MESSAGE`, `CONVERSATION_HISTORY` | bookkeeping | named ignore list, with `capture.gap` only if content matters | | Decide per type in AG-1; keep a named list. |
| `ERROR_MESSAGE` | tool error / gap | | | Yes. |
| browser steps (about 30 types), `MCP_TOOL` | browser, mcp | not mapped | | **Zero local evidence.** Must be generated (AG-5). |

## 13. How this compares with the existing adapters

| | Claude Code | Codex | Antigravity |
|---|---|---|---|
| Journal | one JSONL per session | one `rollout-*.jsonl` | JSONL transcript **plus** SQLite (metadata) and loose files |
| Tool-call id | `tool_use_id` | call ids / exec windows | **none** in the transcript (pair by order; names verifiable in the database) |
| Workspace | `cwd` in the first records | `cwd` in `session_meta` | **not in the journal**: summaries DB or conversation DB |
| Edit result | structured patch | patch text | requested old/new strings; typed diff only on non-cleared steps |
| Exit code | present | present | mostly absent |
| Reasoning | none / encrypted | encrypted | **plaintext thinking** |
| Images | inline base64 | inline | **file paths** |
| Subagents | sidechain files | `spawn_agent` threads | **separate conversations** with parent id |
| Time | millisecond ISO | millisecond ISO | whole-second UTC; nanoseconds only in the database |
| Discovery root | `~/.claude/projects` | `~/.codex/sessions` | `~/.gemini/antigravity` (plus legacy `antigravity-ide`) |

## 14. Redaction and privacy

Everything goes through `seal()` before SQLite, the blob store, previews or search ([non-negotiable 3](../../AGENTS.md)). Specific to Antigravity:

- **Never read:** `daemon\hub_*.json` (CSRF token), `antigravity-browser-profile\` (cookies, logins), `%APPDATA%\Antigravity\` (`state.vscdb`, `credential-user-scope`), `config\mcp_config.json` and `antigravity-*\mcp_config.json` (may hold tokens), `installation_id`, `machineid`. The adapter's file allow-list must make these unreachable by construction, including via `file:///` URIs in `media[].uri` (resolve and require the real path to be inside a conversation's own `brain\<id>\` subfolders).
- **Tool arguments are JSON strings**: sanitize after decoding, per key, so a token inside an argument is found. `CommandLine`, `Content`/`CodeContent`, `Replacement` and `Message` are the likeliest carriers.
- **Protected paths:** `touchesProtectedFile` applies to `Path`/`AbsolutePath`/`TargetFile`, to shell command lines and to patches; reads of `.env` and keys keep metadata only (`denyContent`).
- **Large outputs and logs:** `steps\<n>\output.txt` and `tasks\task-<n>.log` are harness files outside the journal; copy only the bounded part the reader needs, redacted, and only when the path resolves inside the same `brain\<id>\`.
- **Images:** screenshots can show anything on screen. Default is reference only; copying bytes needs Yash's agreement (below).
- **`thinking` and `session_summary`** are model text and may repeat secrets from tool output: same sanitizer.
- **Scratch and user uploads** (`scratch\`, `.user_uploaded\`) are not read by the adapter.

## 15. Event-schema impact

Additive only; the schema changes by agreement of both builders ([DATA-10](125-event-schema-proposal.md)). Minimum needed:

1. `HarnessId` already accepts any string: **no change**, adapter id `antigravity`, harness `antigravity`.
2. `Observation.correlation.basis`: add `'call-order'` (a result paired to a call by position in the same planner response). Pairing confirmed by the database's per-step tool call may use `'source-id'` with the native call id.
3. `ToolResultPayload.images[].omitted` / `ImageOmission` (`packages/privacy/src/image.ts`): add `'referenced-file'` (a path was recorded, the bytes were not copied). If Yash agrees to copying, add an allow-listed read of files inside the same `brain\<id>\` with the existing 4 MiB limit and signature check.
4. `SessionMetaPayload`: no new field is required; model stays the opaque `MODEL_PLACEHOLDER_Mn` text, recorded as captured and labelled unresolved. (Optional later: `modelId`.)
5. A captured-artifact observation for plans and walkthroughs (kind `plan` content with a path and version), unless the existing literal-plan path can carry Markdown text; AG-4 decides with the builders.
6. `DiscoveredSource` needs no change (it already has `cwd`, `repositoryRoot`, `parentSessionId`, `agentName`, `companions`).

`CONTRACT_VERSION` and the reducer version move together if any of 2, 3 or 5 lands; the golden scenes are regenerated.

## 16. Open risks

1. **Undocumented, fast-moving format.** Nothing here is Google-documented. The app shows two version numbers; step types, tool names and the database schema changed between the 12 legacy and 42 current conversations. Pin `testedHarnessVersions`, parse defensively, emit `unknown` for unrecognised types, and keep a named ignore list.
2. **Freeze.** Feature freeze is the end of 13 November and the release ships on 18 November. Yash asked for this as P0; the work is not small (AG-1 to AG-5). It is flagged, not demoted.
3. **No real sessions for browser, MCP, plan review, question or approval.** AGENTS requires a genuine capture of every case before it is claimed. AG-5 owns that and needs a signed-in Antigravity account.
4. **Pairing by order.** If an order assumption fails (434 planner records have fewer results than calls), the adapter must leave the call unmatched and say so, never guess.
5. **Duplicate and out-of-order records** (10 repeated `step_index`, up to 12 s time regressions). Observation ids derive from `step_index`, so a repeat should be idempotent; confirm the store treats an identical id as a no-op.
6. **Exit codes mostly unknown**, so verification and fix-chain views cannot claim pass or fail for most Antigravity commands.
7. **Workspace attribution** for multi-folder conversations and for the 6 conversations with no workspace.
8. **Privacy of images and of `thinking`** (decisions needed).
9. **Version skew of the second app** (2.31.2 vs 44.9.1) and of the older `antigravity-ide` layout.
10. **Observing an Antigravity session that is itself working on Drishya** (the largest local session) is a good acceptance case and also a recursion hazard for tests: use a scratch Drishya home.

## 17. Method (reproducible, nothing committed)

Folder listings with counts and sizes; magic bytes and byte entropy for the `.pb`; copies of the databases opened read-only with `node:sqlite`; the protobuf descriptors extracted from `language_server.exe` by scanning for serialized `FileDescriptorProto`s and used to decode step blobs while printing only field paths, enum names, tool names, argument keys, counts and sizes; transcript surveys for key sets, types, statuses and pairing. Scripts live in `.local/antigravity-research/` and are not committed. No journal content was printed or kept in this document. One survey command echoed a fragment of a repository file (not Antigravity user content) to the local terminal after a JSON parse error; nothing was written to a tracked file.
