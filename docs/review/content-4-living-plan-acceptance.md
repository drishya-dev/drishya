# CONTENT-4 — living-checklist acceptance and genuine-source gate

## 27 October integration — current state (supersedes the earlier blocker notes below)

The builder explicitly resumed the whole integration. Draft PR #258 now contains the proposed D10 projection contract and implementation, rebased after DATA-3 and CONTENT-3. **Implementation is complete for the captured forms; merge remains gated on the other builder's contract review.** No History, Claude adapter, question mapping, controller, native policy or paused PERF area was edited. No new native/model calls were made during integration; existing genuine captures were read through normal redaction.

### Proposed D10 contract for review

Observations and their stable IDs remain unchanged. Optional projected plan rows carry native `id`; `scope` is a **derived isolation boundary**, not a claimed native task-list ID. It includes recording/agent/source generation, an explicit result list ID when present, conservative identity discontinuities and the recorded prompt boundary. Internal task facts survive prompts; their per-turn presentation remains separate. Successful duplicate creation of an existing ID starts a new isolated boundary rather than silently replacing a different task. An input-only list ID is not trusted.

TaskCreate/Get use structured result identity/subject, with absent status kept unknown; partial Get preserves known status. TaskUpdate requires success and result-confirmed changes, preserves unrelated fields, and does not fabricate a title for an unresolved task. Rename follows stable ID even with duplicate labels; deletion and full valid list replacement have dedicated adversarial checks. Failed, malformed and text-only results remain generic. Derived snapshots cite current field authority plus their boundary; a 500-update regression bounds provenance instead of accumulating every preceding update in every snapshot. The exact sanitized structured result is also retained as a captured artifact. Two thousand displayed task rows is an explicit bound; omission metadata follows each historical revision and pinned list, with shown-only counts and a disclosure.

`document` carries a bounded Markdown preview and full captured artifact reference. Codex's complete, unique `<proposed_plan>` wrapper becomes one proposal material, without duplicate prose, fabricated checklist progress or approval. Original wrapper bytes remain in its artifact; display trims wrapper whitespace. Ordinary headings, fenced examples, incomplete/nested/repeated wrappers stay prose. A successful Claude Write to the **recorded `.claude/plans/*.md` path convention** displays its existing captured after-snapshot as Markdown, retains its write path and artifacts, and is explicitly labelled **plan-path convention**, not proof of native plan identity or approval. Ordinary Markdown writes remain edits. Other/custom plan paths fall back to their ordinary captured write; no filesystem lookup or heading heuristic is used.

Result-dependent lists/documents and their blobs remain hidden before operation completion. Native task revisions are ordered by completed result, preserve unknown states and use stable identity for comparisons. Paged timeline offsets are recovered from known operation positions; missing prompt context does not combine different native task scopes. Proposal-first partial journals also establish their agent/model.

### Validation

- 895 local tests across 151 files; both TypeScript projects and production build pass on the CONTENT-3 merged baseline.
- Focused native-plan projection and scene guards cover 28 cases, including all prior 13-revision live/replay checks, unknown states, immutable append snapshots, result-boundary rewind, identity isolation, renames/duplicates/failure/deletion/list replacement, bounded metadata/provenance and literal original proposal bytes.
- Browser acceptance includes the existing TodoWrite checklist, thirteen live revisions at 600/1440 px, unfamiliar states, twelve genuine-shaped task updates at both widths, duplicate labels and rename, Markdown file/proposal views, readable document width and overflow containment. Existing Codex question journeys run alongside to guard the merged integration.
- **Real Claude `749f365d`**: 118,711 journal bytes/82 records; redacting import yields 58 observations. Eighteen task revisions, six IDs, final six completed; one pinned list in the full worker scene. All 47 replay boundaries checked for future-result leakage. The captured plan-file snapshot remains 1,883 bytes.
- **Real Claude `ca6027cb`**: 34,705 bytes/23 records; captured 1,115-byte plan-file Write rendered as Markdown.
- **Real Codex `01a17c46`**: 199,990 journal bytes/18 records; import yields 15 observations. One captured explicit proposal, 353 characters after display trimming, with original wrapped bytes preserved and zero fabricated checklist tasks.
- These three recordings pass six browser frames at 600/1440 px, zero page errors or external requests. Real screenshots/content remain ignored/private. A reading frame disables Follow before scrolling to the earlier pinned prompt; initial follow positioning is not treated as missing material.

| Before | After | Why |
| --- | --- | --- |
| Native task structured results stopped before the UI | Result-confirmed, stable-ID checklist revisions | Keeps actual task state and identity visible without parsing prose |
| A pending task could expose a future result snapshot | Result facts/blobs hidden until completion | Replay remains an account of what was known then |
| Plan Markdown used a compact checklist-sized card | Documents receive up to 620 px and restrained heading sizes | Readable plan material; compact revision receipts retain their allocation |
| Each revision still looked like a separate tool box | One pinned list plus borderless, expandable revision receipts | Retains every earlier list without repeating resident card chrome |
| Path convention could imply native plan identity | Explicit convention label, derived classification and retained write path | Distinguishes captured bytes from inferred presentation |

### Remaining acceptance gates — not falsely marked done

D10 optional projection fields require the other builder's review/agreement before merge; the user's resume authorizes the implementation, not an invented Harsh sign-off. Genuine TodoWrite and Codex checklist events were unavailable in the tested current catalogs/local sources; their existing forms are fixture-verified. ExitPlanMode was absent from both tested native inventories: no pending/approved plan interaction or native surface acceptance is claimed. That unavailable native interaction remains a concrete acceptance dependency, not a reason to fabricate an approval or repeat model calls. Synthetic reset/rename/delete/Get/List adversarial coverage is not described as real-session coverage. General physical/human release and ten-minute checks remain separate.


27 October 2026. **The existing TodoWrite checklist passes the expanded synthetic live/replay checks below. Whole CONTENT-4 remains open.** After the initial inventory found no genuine task tools, an explicitly authorized fresh Claude session captured six TaskCreate calls, twelve TaskUpdate calls and one native-plan Markdown Write. Their structured task results survive redacted ingestion but are discarded by the current generic-operation projection. ExitPlanMode was unavailable in that print-mode tool inventory. This report updates the existing task's evidence; it is not a second work queue.

## Source inventory before implementation

All JSONL files in the current local Claude `projects` and Codex `sessions` trees were read to their individual sizes at audit start. This includes large journals excluded by earlier bounded surveys. The existing bounded JSONL reader supplied 4 MiB complete-record batches and a 16 MiB record ceiling. **Zero malformed or oversized records** were encountered. Archived trees, moved/backed-up journals and other machines were not searched; absence here is not a statement that a harness cannot produce these forms.

| Current source tree | Journal files | Snapshot bytes | Parsed records | Genuine plan/task calls or notifications found |
| --- | ---: | ---: | ---: | --- |
| Claude Code | 54 (52 main, 2 subagent) | 857,230,617 | 141,353 | TodoWrite 0; TaskCreate 0; TaskUpdate 0; EnterPlanMode 0; ExitPlanMode 0; TaskList/TaskGet 0 |
| Codex | 24 | 732,071,928 | 39,456 | `update_plan` function calls 0; `plan_update` records 0; `turn/plan/updated` notifications 0; typed completed Plan items 0 |

Only actual Claude assistant `tool_use` blocks and actual Codex `response_item:function_call` / exact event envelopes counted. Tool declarations, source strings, quoted instructions, shell code and documentation mentioning a tool did not count as calls. No journal text, prompt, result, credential, task label or native private path printed or committed. Local audit scripts and private lookup manifests remain ignored under `.local/content4/`; committed evidence is prefixes, sizes and counts.

The source forms were examined separately:

| Form | Observed | Interpretation |
| --- | --- | --- |
| Genuine TodoWrite snapshots | 0 | No real evolving-list case for the existing renderer; synthetic-only checklist acceptance must stay explicit |
| TaskCreate/TaskUpdate input/results | 0 | Stable task IDs, partial-update semantics, deletion and statuses remain unverified; do not invent a mapping |
| EnterPlanMode/ExitPlanMode input/results | 0 | No native plan-mode text or approval/result shape is established |
| Claude `attachment:plan_mode` | 6; all `planExists: false`; inline text/content fields 0 | These are the earlier DATA-8 no-tools arithmetic probes, not plans. Fourteen plan-permission metadata receipts across those sessions are mode metadata, not checklist items |
| Native Claude plan directory / captured native-directory Markdown writes/edits | Directory absent; 0 files; 0 matched writes/edits | A `planFilePath` in a mode notice does not supply historical file bytes or permission to substitute current content |
| Explicit `<proposed_plan>` assistant messages | Claude 0; Codex 0 | No evidence-backed proposed-plan Markdown material available |
| Generic assistant Markdown candidates | Claude: 10 headings mentioning plan and 1 checkbox-bearing text block in 5 journals; Codex: 0 | Ordinary captured prose candidates, not native plan identity, task state or completed work. No heading-regex promotion to a Plan operation |

For reproducibility, the six mode-notice sessions are the DATA-8 prefixes `efca7305-c6dc-4142`, `e420428e-ea51-4030`, `02b798e4-d5b6-4549`, `bdcdb372-2b7d-48b9`, `99b38b42-1977-4324`, `4802d78e-fa77-4ca4` (sizes/counts in the [DATA-8 report](data-8-reasoning-persistence.md)). Their attachment envelope has `type`, `reminderType`, `isSubAgent`, `planFilePath`, `planExists`; no captured plan body. They cannot be repurposed as CONTENT-4 acceptance sessions.

The ordinary-prose candidates were counted without printing their headings or checkbox text:

| Claude session prefix | Snapshot bytes | Records | Plan-heading candidates | Checkbox-bearing text blocks |
| --- | ---: | ---: | ---: | ---: |
| `3b3ff01b-8dcf-491a` | 2,183,261 | 620 | 1 | 0 |
| `eff8335b-82b7-4c17` | 39,915,978 | 6,962 | 1 | 0 |
| `e1090031-429f-4372` | 6,292,879 | 2,242 | 0 | 1 |
| `603cc345-720d-4f73` | 14,545,573 | 3,793 | 4 | 0 |
| `cf751266-53e1-4410` | 82,859,509 | 16,482 | 4 | 0 |

The existing [DATA-7 report](data-7-plan-diff-verification.md) distinguishes declared connected notifications from passive journal records. This scan adds an up-to-date larger absence sample; it does not close DATA-7's fresh CLI/App Server plan-turn dependency. The existing `update_plan` tool route remains mapped and is not duplicated by this work.

## Fresh native task and Markdown evidence

The inventory above is the **pre-capture snapshot**, not the current claim that these tools are absent. Claude Code **2.1.282**, authenticated first-party, used its default `claude-opus-5-5` model in one fresh empty temporary workspace and a fresh session/task-list UUID. Session prefix `749f365d-9b5f-4591`: **118,711 journal bytes, 82 records**. A benign design-only prompt requested six checkpoints and twelve genuine status updates; no implementation or code execution was requested. Direct native spawning used an argument array, never a shell-interpolated prompt.

The bounded invocation used `--print --verbose --output-format stream-json --session-id <fresh UUID> --permission-mode plan --permission-prompts none --tools TaskCreate,TaskUpdate,TaskGet,TaskList,Write,ExitPlanMode --strict-mcp-config --mcp-config '{"mcpServers":{}}' --disable-slash-commands --max-budget-usd 1 --settings '{"autoMemoryEnabled":false}'`. These are recorded argument values, **not a PowerShell copy-paste recipe**. The deadline was 180 seconds. A fresh `CLAUDE_CODE_TASK_LIST_ID` isolated native task state. User instructions and hooks remained loaded; no bare mode, hook suppression, native configuration/credential editing or approval response was used. Metadata preflight found zero configured user hook groups and enabled plugins; the managed settings file was absent. Nonessential traffic, telemetry/error reporting, updater/marketplace autoinstall and automatic memory were disabled per invocation. The scratch workspace remained empty; the native harness owned its usual journal, task and permitted plan-file writes.

| Actual native shape | Count | Evidence boundary |
| --- | ---: | --- |
| TaskCreate input `subject`, `description`, `activeForm`; structured result `task: {id, subject}` | 6 | Six distinct native task IDs; **no result status**, so creation alone does not prove a captured pending state |
| TaskUpdate input `taskId`, `status`; result `success`, `taskId`, `updatedFields`, `statusChange: {from,to}` | 12 | Six `in_progress`, six `completed`; authoritative result-confirmed identity/state rather than input-only success assumptions |
| Native plan Write input `file_path`, `content`; structured result includes `filePath`, `content`, `type` | 1 | Captured body: 1,883 UTF-8 bytes, eight headings; exact bytes match the native-owned plan file at audit time |
| ExitPlanMode | 0 | Explicitly requested in `--tools`, but omitted from actual initialized tools; no approval or completion claimed |
| Errors, permission denials, unexpected tools | 0 | Successful native result and exit 0, within bound; no retries |

Current [Claude tool documentation](https://code.claude.com/docs/en/tools-reference) distinguishes task tools from approval-requiring ExitPlanMode. The captured tool inventory, rather than requested flags alone, establishes what this particular invocation exposed. [Plan permission rules](https://code.claude.com/docs/en/permission-modes) allow the native plan file; this did not authorize arbitrary workspace writes.

An initialize-only preflight then tested the **existing connected controller's** supported stream protocol, not an invented interactive flag: `-p --input-format stream-json --output-format stream-json --verbose --permission-mode plan --permission-prompts host`, with a new UUID, the same isolation/settings restrictions, `--tools Write,ExitPlanMode` and a USD 0.50 / 120-second bound. The native `initialize` control response confirmed effective mode `plan` before any user turn. `hooks: null` was the same SDK callback registration used by `apps/daemon/src/native-settings.ts` and `controller.ts`; no native hook configuration was changed. The observer was prepared to record a `can_use_tool` request's safe shape and send only an interrupt for its own turn, never an allow/deny answer.

One authorized fresh host-protocol model turn followed: prefix `ca6027cb-54fe-43fe`, **34,705 journal bytes / 23 records**, same CLI/model. Its actual initialized tools contained **only Write**, again excluding ExitPlanMode. It captured one native-plan Write, **1,115 bytes / four headings**, matching the native-owned file exactly. Exit 0, zero errors/denials/control approval requests, zero scratch entries, no interrupt needed. No pending approval or accepted plan was fabricated. Both noninteractive surfaces have now been tested; further native model calls were stopped rather than blindly retrying. Capturing ExitPlanMode requires a native surface that actually exposes it (potentially an interactive session and any required human trust/import consent); this report does not establish that surface or answer its approvals. It does not claim that ExitPlanMode is generally unsupported by Claude.

### Confirmed projection loss and minimal D10 handoff

The fresh journal was imported read-only through the normal redacting ingest path into a separate ignored private store, recording prefix `rec_c9284887`. **58 observations, 19 operations, zero projected plans**. All 18 task operations have native origins, successful operation status and an end sequence. All 18 sanitized `tool.result` observations retain `payload.structured`; all 18 generic operations expose only human-text result previews. None has structured run data or a result artifact containing the task IDs/statuses. The Write has one captured artifact. Counts were inspected in memory; neither native task labels nor plan prose was printed or committed.

Both fresh Writes were also checked **after redaction and projection**. Each is currently a `write` operation with `edit` detail, native origin, one `snapshot` artifact of `complete` availability, captured provenance and observation references. Their retained blob sizes are respectively **1,883 and 1,115 bytes**, each exactly equal to the captured native plan body. The normalized operation paths match the respective native plan paths outside the scratch workspace. Thus historical Markdown bytes and source-file identity **are available**; no current-workspace-file lookup or path-to-content substitution is needed. They are not yet typed Plan operations: a native plan file Write remains ordinary captured edit material until an agreed mapping establishes Plan semantics.

This is a measured mapping blocker, not an absent-source blocker. `packages/adapter-claude/src/index.ts` already preserves the structured native result and needs no speculative rewrite. `packages/projection/src/reduce.ts` (`completeOp`, `other` branch) keeps only `resultPreview`; `packages/contracts/src/index.ts` defines `OperationDetail.other` with input/preview only, and plan rows contain only text/status. An owned scene helper cannot recover successful result-confirmed IDs and changes from that public projection. Parsing “Task #…” prose or assuming a requested update succeeded would violate captured/derived truth.

Minimal proposal for the two-builder D10/DATA-3 owner: agree either (a) a bounded, sanitized structured-result field on generic detail with result observation provenance/sequence, or (b) typed task detail carrying native task ID, result-confirmed partial changes and list/session identity. Expose the agreed field in `completeOp`. Option (a) is the smallest preservation change; option (b) defines the task contract explicitly rather than making every consumer interpret opaque JSON. Then the CONTENT-4 helper can reconstruct an as-of ID-keyed task list, apply only confirmed updates, preserve literal unknown/missing states, support subject changes without treating them as new tasks, and retain every revision. List identity/reset boundaries are also necessary to avoid combining reused task IDs across native task lists; ID alone is not a global identity. Neither input text nor a human result preview establishes successful partial mutation, rename identity or a list reset.

`packages/contracts` and `packages/projection` are explicitly held by Claude's **DATA-3** claim; event-schema agreement requires **both builders** under AGENTS and review 125 **D10**. Required production seams are `packages/contracts/src/index.ts` and `packages/projection/src/reduce.ts` plus their focused tests; only change `packages/adapter-claude/src/index.ts` if a separately demonstrated gap requires it. These held files were not edited. Deletion, rename, failure, dependency updates and list resets were **not** exercised by this bounded capture and must not be reported as real-session verified. Whole CONTENT-4 is blocked on this concrete owner/schema decision, not solely on missing native source; PR 258 remains draft with its scoped helper fix preserved.

## Reproduced comparison repair

Before changing code, the existing built app's three-revision pinned checklist was run and its synthetic frame inspected. The installed Emil design engineering skill was applied within Drishya's evidence and composition rules. The existing pinned list, operation history, buttons and motion remain intact.

The new acceptance test exposed a concrete defect: one exact task label changed from captured `waiting-for-review` to `pending`, and the comparison claimed it **started**. The root agent approved a focused repair in the claimed `plan-threads.ts` helper before production editing.

| Before | After | Why |
| --- | --- | --- |
| An unfamiliar state changing to `pending` could be labelled “started” | Literal `pending` remains, with no derived transition | An unfamiliar previous state supplies no canonical ordering evidence |
| An empty/unfamiliar state on either side could produce started/completed/reopened commentary | Transitions require recognized `pending`, `in_progress` or `completed` on both sides | Unknown strings are not translated or ranked as pending |
| Unknown checklist states already had a neutral `·` mark and literal accessible text | Same component behavior, now checked at 1024 px | No UI repair or new canonical-status inference is necessary |

Exact labels, every literal row/status, totals, completed counts, genuinely new items and the [existing duplicate-label rules](content-4-ambiguous-plan-labels.md) remain unchanged. A captured `completed` still counts as done even if no transition can be inferred from its prior unfamiliar state.

The contract's item status is a **string**. Existing Claude/Codex adapters convert an omitted/null native status to `''` with `String(status ?? '')`; the new boundary regression verifies that behavior without editing either adapter. The empty-string cases cover that supported boundary. This is not a claim to support a malformed projection containing `undefined` as a status.

## Acceptance results

The shared synthetic fixture contains twelve literal task rows and thirteen whole-list TodoWrite snapshots in one turn: the initial list plus twelve updates. It deliberately uses only the already mapped TodoWrite form, not invented TaskCreate/TaskUpdate/ExitPlanMode fixtures.

| Existing CONTENT-4 criterion | Result | Evidence / limit |
| --- | --- | --- |
| One evolving per-turn checklist across 10+ updates | Pass, synthetic | At 600 and 1440 px, twelve separately ingested appends update the same pinned DOM list from revision 1 through 13; one checklist group throughout |
| Compact long list and completed state | Pass, synthetic | Eight-row window retains the in-progress item; keyboard Show all reveals all twelve; Show fewer restores the window; completed text has the quiet strike |
| Every revision remains accessible | Pass, synthetic | All thirteen full snapshots navigated backward and forward by keyboard; exact per-revision completed counts, twelve rows, disabled first/last boundaries |
| Truthful replay and rewind | Pass, synthetic | Unit oracle checks every revision boundary and rewind after all final data exists; browser seeks initial/middle/final/earlier and step 0, then returns to full history without leaking the final list |
| Agent/turn isolation and duplicate-label honesty | Existing behavior retained | Existing plan-thread tests and scene golden suite pass; no new native multi-agent/list evidence claimed |
| Empty/unfamiliar statuses | Pass, synthetic | Six comparison regressions; neutral `·` rather than pending `○`; unfamiliar string remains accessible; no invented transition in the operation summary or expanded list |
| Real TodoWrite acceptance in both harnesses | Unavailable | Zero genuine local snapshots; no claim that the synthetic cases are real-session checked |
| TaskCreate/TaskUpdate and ExitPlanMode | Native task evidence captured; mapping blocked | Six creates/twelve updates verified above; structured authority is lost at held projection/contracts seam under review 125 D10. ExitPlanMode absent from actual tools in both tested print/host surfaces; no approval-envelope acceptance claimed |
| Native plan Markdown “Plan” material | Captured, integration open | One native-plan Write with captured bytes/artifact; native Plan identity/presentation remains to be integrated through the agreed seam, not inferred from a heading |
| Codex plan sources | DATA-7 dependency | Genuine CLI/connected plan-turn capture and journal-vs-stream verification still required |

There is **one pinned checklist plus thirteen compact historical operation articles** containing revision/delta lines and their existing operation chrome. There are not thirteen duplicated full checklists. This report does not claim that operation articles disappeared or redesign held History chrome. If “not ten cards” means further removal of that chrome, it is a remaining presentation interpretation for the builder, not a completed change hidden in this acceptance claim.

## Checks and remaining handoff

- 93 scene tests across 13 files pass, including 19 plan tests (10 existing, 9 new) and the existing scene goldens. The initial unfamiliar-state regression failed on the baseline helper, then passed after the focused repair.
- Both project TypeScript checks and production build pass. Tests import this worktree's fixture and package sources; no dependency on another unmerged Desktop checkout.
- Five focused desktop browser journeys pass using installed Chrome: the existing checklist baseline; existing duplicate-label guard at 1440 px; new live/revision/replay journeys at 600 and 1440 px; new literal-state guard at 1024 px. The first attempt could not find Playwright's bundled browser; installed Chrome was used without an install or download.
- Synthetic screenshots stay under `.local/`; the existing frame and final reading frames were inspected. Follow is explicitly disabled before positioning the pinned list for a reading frame. The post-scroll 13-revision frames show passage connector segments crossing the pinned-list region above the first operation cards. This report does not claim a clean connector/freeze/polish gate; geometry/settlement in held History was not changed or investigated as a second task. No phone/touch check, 14-minute full browser gate, hosted CI, physical/platform acceptance or human ten-minute study was run.
- No History, adapter, contract, projection, capture/store, native controller, schema, dependency, telemetry or animation changes. Our code opened native journals/configuration/credentials read-only; the explicitly authorized fresh native harness owned its normal journal/task/plan writes.

**Root handoff for the existing CONTENT-4 entry (leave its checkbox open):** retain the 13-revision desktop live/replay acceptance and canonical-state repair; add the genuine six-create/twelve-update/native-Markdown capture and exact structured-result loss above. Resolve the held D10 projection/contracts seam before ID-based native task integration. DATA-7 is being investigated separately. TodoWrite real-session coverage and ExitPlanMode approval-envelope coverage remain unverified. Do not turn DATA-8 mode notices, generic Markdown headings or requested-but-unavailable tools into substitute evidence, and do not claim whole CONTENT-4 done from synthetic-only rendering.
