# DATA-7 — distinguish journal records from App Server notifications

26 October 2026. Read-only protocol/source verification; DATA-7 remains open for a fresh CLI and App Server turn with genuine plan/diff events. No adapter, contract, projection, controller or UI change.

## What is established

[Official App Server documentation](https://learn.chatgpt.com/docs/app-server#turn-events) documents separate plan and aggregate-diff notifications. It also describes proposed-plan Markdown as an item; this is distinct from the checklist update. [Version-specific schema generation](https://learn.chatgpt.com/docs/app-server#message-schema) provides the installed binary's exact protocol declarations. These establish declared protocol shapes, not that passive journals persist them.

The installed native `codex.exe` reports **0.164.0-alpha.11.1**. Running its schema generator wrote only ignored `.local/data7-schema`; it did not start a turn or modify configuration. Generated schemas verify:

| Surface | Required fields / exact local declaration | Consequence |
| --- | --- | --- |
| `turn/plan/updated` | `threadId`, `turnId`, `plan`; entries require `step`, `status`; status enum `pending`, `inProgress`, `completed`; optional nullable `explanation` | Bind to the exact thread/turn. This camel-case protocol enum must not be guessed from older tool-call spelling. |
| `turn/diff/updated` | `threadId`, `turnId`, `diff` string | It is a turn-level aggregate update, not an additional individual edit. Do not count repeated aggregates as new file writes. |
| `item/plan/delta` | `threadId`, `turnId`, `itemId`, `delta`; locally marked experimental | Proposed-plan text is not the checklist. Final item reading needs its own captured final evidence; never manufacture it from assumed delta equivalence. |

## Local sample and limits

- Scan requested the 40 most recently modified JSONL files under the current local Codex `sessions` tree; **only four files exist there**. They were read to their sizes at scan start: **620,978,553 bytes, 30,561 parsed records**, zero malformed or over-16-MiB records. No raw line, prompt, tool output, credential or source body printed or copied to a report. Ignored local artifacts contain counts and private source paths only.
- Metadata reports three files from `0.163.0-alpha.10.2` and one from `0.160.0`. These are journal metadata versions, not proof of which binary currently runs every client.
- **Zero** parsed top-level journal `plan_update` / `turn_diff` payload types, corresponding RPC notification method names, or `response_item:function_call` calls named `update_plan` / `functions.update_plan` in this sample. Matches inside prompt prose or tool definitions do not count.
- This is a snapshot of existing journals, **not a fresh CLI or App Server plan/diff test**. No current native session was resumed, prompted, interrupted or reconfigured. No claim that the events never exist or that schema support proves journal persistence.
- Existing adapter inspection: snake-case `plan_update` and `turn_diff` remain explicitly ignored. A separately captured `update_plan` function call already maps to a plan intent. Do not implement a second parser for that existing tool route just because the notification has a different name.

## Retest and implementation boundary

Under DATA-7, retain these pending checks in TASKS rather than a competing queue:

1. With an explicitly controlled fresh native CLI session and a fresh connected App Server turn, retain a genuine checklist update and a genuine file-change turn. Record surface/version, thread/turn/item identity, actual event keys/status spellings and whether each event is also persisted in the journal. Preserve direct tool/item evidence separately from the aggregate.
2. Use only minimal synthetic/redacted fixtures derived from those observed shapes; no invented journal notification. If an event exists only on the connected stream, proposed optional enrichment must not make passive observation depend on an active controller.
3. Coordinate any adapter/contracts/projection work with DATA-3's owner and the two-builder schema gate. Normalize protocol statuses at an explicit seam; keep unresolved identities and missing final text honest. Preserve update order, provenance and exact raw access; do not double-count item file changes plus aggregate diffs.
4. Re-evaluate CONTENT-4 and READ-5 only after that source evidence is available. Their current plan/edit readers are not certified for unobserved notification shapes by this research.

Verification: native version/schema commands succeeded; generated JSON declarations inspected and matched the official event methods. No production or tests changed, so no browser/full-test rerun or hosted CI was launched. No changes in the held History/common/worker/ingest/PERF-2/3 area or DATA-3 files. Generated schemas and raw journals remain uncommitted. OpenAI Docs skill used for official source order; all claims above separate documentation, local declaration, observed absence and pending acceptance.

## 27 October fresh-native verification (file-change policy selection pending)

The previously missing fresh-turn verification is now claimed as the dependency for CONTENT-4. The installed native binary still reports `0.164.0-alpha.11.1`. New scratch directories outside the repository contain only a neutral six-byte fixture. No existing session was resumed, no project file was edited, and no saved configuration, credential or journal was directly mutated.

A no-model-call App Server initialization plus `config/read` showed configured model `gpt-5.6-terra`, effort `medium`, unset sandbox/approval fields and zero enabled MCP servers after invocation-only MCP disabling. A separate fresh `thread/start`, without policy overrides or any `turn/start`, established the effective defaults: **approval `on-request`; sandbox `{type: readOnly, networkAccess: false}`**. Declared settings and effective thread policy must not be conflated.

Both bounded read-only plan probes below preserved those policies and normal hooks/rules. A successful native-owned file edit and aggregate diff still require an explicit permitted sandbox/approval selection. No bypass, forced sandbox change or approval answer has been made. Raw source and protocol payloads remain ignored/private.

### Fresh observations

| Surface | Actual capture | Persistence / limit |
| --- | --- | --- |
| Native CLI `exec --json`, prefix `01a17c40-897f-7490` | One completed turn; one 61-character agent message; zero tool calls, checklist events or file changes. Requested a native checklist without terminal commands or file access. | Journal: 168,511 bytes, 20 records. The response reports tool unavailability; that response alone is not proof of global absence. Its restrictive prompt is an additional interpretation limit. |
| Native App Server Plan-mode turn, prefix `01a17c46-6193-7663` | One completed `plan` item, 354 characters; 76 `item/plan/delta` notifications. Zero `turn/plan/updated`, `turn/diff/updated`, file-change items, shell calls or approval requests. | Journal: 199,990 bytes, 18 records. `thread/read(includeTurns:true)` returns the same final plan item ID and text. The journal instead stores an assistant `response_item` message with a `<proposed_plan>` wrapper (386 characters); the trimmed inner text equals the connected final plan. |

All 76 deltas carry the final item's thread/turn/item identity, and their concatenation equals its final text in this capture. This equality is an observed result, not an assumption for future turns. Both six-byte scratch fixtures remain unchanged.

The first App Server `turn/start` was rejected **before a model turn** with protocol error `-32600`, `turn/start.collaborationMode requires experimentalApi capability`. Initializing with `experimentalApi:true` allowed the one authorized Plan turn; this changed the protocol capability, not sandbox or approval policy. No approval was answered.

The actual initialized `additional_tools` record exposes `functions.exec` for code-mode orchestration. Its declared nested catalog includes `apply_patch` and `exec_command` but has **zero `update_plan` declarations or occurrences**. The configured model's bundled catalog declares `tool_mode: code_mode_only`. These facts establish this invocation's tool surface, not that every Codex model/client lacks a checklist tool. Code-mode orchestration must not be confused with terminal execution; future narrowly authorized patch prompts can permit orchestration while forbidding shell commands.

### Minimal observed shapes

The following bodies use neutral placeholder text and IDs. They reproduce observed field names, not private content. The proposed plan and checklist must remain distinct.

```json
{"method":"item/plan/delta","params":{"threadId":"thread","turnId":"turn","itemId":"item","delta":"neutral plan fragment"}}
{"method":"item/completed","params":{"item":{"type":"plan","id":"item","text":"neutral final plan"},"threadId":"thread","turnId":"turn","completedAtMs":0}}
{"type":"response_item","payload":{"type":"message","status":"completed","id":"message","role":"assistant","content":[{"type":"output_text","text":"<proposed_plan>\nneutral final plan\n</proposed_plan>"}],"phase":"final_answer","internal_chat_message_metadata_passthrough":{}}}
```

The journal example's opaque metadata value is redacted; consumers must not depend on its contents. No synthetic `plan_update` or `turn_diff` journal record was created. File-change and aggregate-diff shapes remain unverified by a fresh turn until the pending scratch-only writable-policy choice is resolved. DATA-7 is therefore not complete yet. Adapter/schema changes remain behind the separate DATA-3/two-builder gate.
