# DATA-7 — distinguish journal records from App Server notifications

26–27 October 2026. Protocol/source verification plus fresh native CLI and App Server captures. The research now establishes proposed-plan and individual-edit persistence separately from connected aggregate notifications, and records the invocation-specific checklist and headless-approval limitations below. No adapter, contract, projection, controller or UI change; downstream DATA-3 mapping still requires the two-builder schema gate.

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

## Verification method and implementation boundary

The fresh verification below resolves the source checks in this method; downstream adapter/schema work remains separate:

1. With an explicitly controlled fresh native CLI session and a fresh connected App Server turn, retain a genuine checklist update and a genuine file-change turn. Record surface/version, thread/turn/item identity, actual event keys/status spellings and whether each event is also persisted in the journal. Preserve direct tool/item evidence separately from the aggregate.
2. Use only minimal synthetic/redacted fixtures derived from those observed shapes; no invented journal notification. If an event exists only on the connected stream, proposed optional enrichment must not make passive observation depend on an active controller.
3. Coordinate any adapter/contracts/projection work with DATA-3's owner and the two-builder schema gate. Normalize protocol statuses at an explicit seam; keep unresolved identities and missing final text honest. Preserve update order, provenance and exact raw access; do not double-count item file changes plus aggregate diffs.
4. Re-evaluate CONTENT-4 and READ-5 only after that source evidence is available. Their current plan/edit readers are not certified for unobserved notification shapes by this research.

Verification: native version/schema commands succeeded; generated JSON declarations inspected and matched the official event methods. No production or tests changed, so no browser/full-test rerun or hosted CI was launched. No changes in the held History/common/worker/ingest/PERF-2/3 area or DATA-3 files. Generated schemas and raw journals remain uncommitted. OpenAI Docs skill used for official source order; all claims above separate documentation, local declaration, observed absence and pending acceptance.

## 27 October fresh-native verification

The previously missing fresh-turn verification is now claimed as the dependency for CONTENT-4. The installed native binary still reports `0.164.0-alpha.11.1`. New scratch directories outside the repository contain only a neutral six-byte fixture. No existing session was resumed, no project file was edited, and no saved configuration, credential or journal was directly mutated.

A no-model-call App Server initialization plus `config/read` showed configured model `gpt-5.6-terra`, effort `medium`, unset sandbox/approval fields and zero enabled MCP servers after invocation-only MCP disabling. A separate fresh `thread/start`, without policy overrides or any `turn/start`, established the effective defaults: **approval `on-request`; sandbox `{type: readOnly, networkAccess: false}`**. Declared settings and effective thread policy must not be conflated.

The plan probes used the read-only sandbox. The user subsequently authorized isolated scratch-write tests, restricted to the two new scratch folders and the single fixture replacement, with no saved-setting change or approval answer. Invocation-only writable configuration was read back before the patch probes: exact singleton scratch root, network disabled, both temporary-directory exclusions enabled. `thread/start` normalizes an explicit root equal to its working directory to no **additional** writable roots; its working directory was asserted to be the respective scratch folder. This is consistent with the [native workspace-write policy](https://github.com/openai/codex/blob/main/codex-rs/prompts/templates/permissions/sandbox_mode/workspace_write.md), which includes the working directory. The App Server patch request also supplied the full explicit per-turn `workspaceWrite` policy. A headless CLI approval discrepancy discovered in its actual journal is recorded below; configuration preflight alone did not certify that CLI's eventual approval policy. Raw source and protocol payloads remain ignored/private.

### Fresh observations

| Surface | Actual capture | Persistence / limit |
| --- | --- | --- |
| Native CLI `exec --json`, prefix `01a17c40-897f-7490` | One completed turn; one 61-character agent message; zero tool calls, checklist events or file changes. Requested a native checklist without terminal commands or file access. | Journal: 168,511 bytes, 20 records. The response reports tool unavailability; that response alone is not proof of global absence. Its restrictive prompt is an additional interpretation limit. |
| Native App Server Plan-mode turn, prefix `01a17c46-6193-7663` | One completed `plan` item, 354 characters; 76 `item/plan/delta` notifications. Zero `turn/plan/updated`, `turn/diff/updated`, file-change items, shell calls or approval requests. | Journal: 199,990 bytes, 18 records. `thread/read(includeTurns:true)` returns the same final plan item ID and text. The journal instead stores an assistant `response_item` message with a `<proposed_plan>` wrapper (386 characters); the trimmed inner text equals the connected final plan. |

All 76 deltas carry the final item's thread/turn/item identity, and their concatenation equals its final text in this capture. This equality is an observed result, not an assumption for future turns. Both six-byte scratch fixtures remain unchanged.

The first App Server `turn/start` was rejected **before a model turn** with protocol error `-32600`, `turn/start.collaborationMode requires experimentalApi capability`. Initializing with `experimentalApi:true` allowed the one authorized Plan turn; this changed the protocol capability, not sandbox or approval policy. No approval was answered.

The actual initialized `additional_tools` records on both surfaces expose `functions.exec` for code-mode orchestration. Their declared nested catalogs include `apply_patch` and `exec_command` but have **zero `update_plan` declarations or occurrences**. The configured model's bundled catalog declares `tool_mode: code_mode_only`. These facts establish these invocations' tool surface, not that every Codex model/client lacks a checklist tool. Code-mode orchestration must not be confused with terminal execution; the patch prompts explicitly permitted only native `apply_patch` orchestration and prohibited shell commands.

### Minimal observed shapes

The following bodies use neutral placeholder text and IDs. They reproduce observed field names, not private content. The proposed plan and checklist must remain distinct.

```json
{"method":"item/plan/delta","params":{"threadId":"thread","turnId":"turn","itemId":"item","delta":"neutral plan fragment"}}
{"method":"item/completed","params":{"item":{"type":"plan","id":"item","text":"neutral final plan"},"threadId":"thread","turnId":"turn","completedAtMs":0}}
{"type":"response_item","payload":{"type":"message","status":"completed","id":"message","role":"assistant","content":[{"type":"output_text","text":"<proposed_plan>\nneutral final plan\n</proposed_plan>"}],"phase":"final_answer","internal_chat_message_metadata_passthrough":{}}}
```

The journal example's opaque metadata value is redacted; consumers must not depend on its contents. No synthetic `plan_update` or `turn_diff` journal record was created.

### Genuine native patch turns

Exactly one bounded patch turn ran per surface after the user's authorization. Each native harness changed its own neutral fixture from `alpha` plus newline to `beta` plus newline. Each final scratch directory contains only that five-byte fixture. Both journals contain exactly one code-mode `custom_tool_call` named `exec`, whose input invokes `tools.apply_patch` once and invokes no terminal/shell API. No terminal commands or scripts, network tool calls, delegation, approval requests or fallback editing tools occurred. The probes used a 120-second deadline; neither timed out.

| Surface | Observed events | Journal / exact comparison |
| --- | --- | --- |
| CLI `exec --json`, prefix `01a17c58-252e-7d73` | One `file_change` item lifecycle, status `in_progress` then `completed`; one changed path with kind `update`. JSONL provides path/kind but no individual diff body. | 177,761 bytes, 27 records. Native `event_msg:item_completed` retains `FileChange` with the exact 25-character individual diff. Actual approval is `never`, despite requested invocation config `on-request`; see limitation below. |
| App Server, prefix `01a17c58-7164-7f23` | One completed `fileChange`, status `completed`, one changed path, `kind:{type:update,move_path:null}`, 25-character individual diff. Three `turn/diff/updated` notifications, each 189 characters. | 183,940 bytes, 27 records. Journal and `thread/read` retain the same completed individual item ID and exact changes. Journal thread/turn identity matches the stream. Actual approval is `on-request`. |

The individual and aggregate diffs each contain exactly one removed and one added line. All three aggregate notifications are identical and belong to the completed item's thread/turn; each arrives after that item's completion. Count these as repeated views of one edit, not three additional writes. Neither fresh journal contains a `turn_diff`/`turn/diff/updated` record, and `thread/read` has no turn aggregate-diff field. Passive replay can retain the captured individual patch; this capture does not support treating the connected aggregate notification as journal data.

The journal's `FileChange.changes` is a **path-keyed map**, unlike the connected item's array. Both journals retain the individual unified diff with the same update shape. Actual turn-context filesystem policy is `restricted`; its two write entries both resolve to the same respective scratch directory, with no additional writable directory. Sandbox remains workspace-write with network disabled and both temporary-directory exclusions enabled.

Neutral excerpts of the observed shapes (IDs, paths, timestamps and text replaced; not full records):

```json
{"type":"item.completed","item":{"id":"item","type":"file_change","changes":[{"path":"/scratch/fixture.txt","kind":"update"}],"status":"completed"}}
{"method":"item/completed","params":{"item":{"type":"fileChange","id":"item","changes":[{"path":"/scratch/fixture.txt","kind":{"type":"update","move_path":null},"diff":"@@ -1 +1 @@\n-alpha\n+beta\n"}],"status":"completed"},"threadId":"thread","turnId":"turn","completedAtMs":0}}
{"method":"turn/diff/updated","params":{"threadId":"thread","turnId":"turn","diff":"neutral aggregate unified diff"}}
{"type":"event_msg","payload":{"type":"item_completed","thread_id":"thread","turn_id":"turn","item":{"type":"FileChange","id":"item","changes":{"/scratch/fixture.txt":{"type":"update","unified_diff":"@@ -1 +1 @@\n-alpha\n+beta\n","move_path":null}},"status":"completed","stdout":"redacted native result","stderr":""},"started_at_ms":0,"completed_at_ms":0}}
```

### Headless approval boundary and completion scope

The CLI patch invocation requested `-c approval_policy="on-request"`; no `never` option, bypass, hook bypass or automatic-review option was supplied. Metadata-only App Server preflight with the identical configuration returned `on-request`, but the actual headless CLI `turn_context` records **`approval_policy: never`**. The earlier read-only CLI plan probe's journal also records `never`. Installed `exec --help` exposes no approval-selection option. The [official headless implementation](https://github.com/openai/codex/blob/main/codex-rs/exec/src/lib.rs) explicitly overrides approval to `Never`; that current upstream source explains the observed behavior, but is not a version-pinned proof for every installed build. The native invocation changed this policy; the probe did not request it. No further CLI model call or attempted workaround followed discovery. Do not claim that `config/read` or a separate `thread/start` certifies effective headless-turn approval, or that this test validates an on-request CLI controller. The App Server's actual journal does retain `on-request`.

DATA-7's fresh-source research is complete with explicit surface limits: genuine proposed-plan text and file-change evidence were obtained and compared across live/native persistence; genuine aggregate notifications were captured on the connected surface and verified absent from these journals. A checklist update was not fabricated when this invocation's actual catalog lacked `update_plan`. Any downstream mapping must handle journal `FileChange` separately from the stream representation, preserve exact individual patches, and treat optional connected aggregates as enrichment without double-counting or making passive capture depend on control. Adapter/schema implementation and CONTENT-4 certification remain separate work behind DATA-3 and the two-builder gate.

Validation: four fresh model turns total (one read-only plan probe and one authorized patch probe per surface), one rejected pre-model Plan request, metadata-only preflights, native JSONL/RPC captures, `thread/read`, exact native-journal comparisons and final scratch-file assertions. No production source or tests changed; no browser/full-suite/hosted gate was run for this research-only report. Raw content, scratch paths, screenshots and private protocol files were not committed.
