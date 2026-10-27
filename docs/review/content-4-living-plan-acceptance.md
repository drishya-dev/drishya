# CONTENT-4 — living-checklist acceptance and genuine-source gate

27 October 2026. **The existing TodoWrite checklist passes the expanded synthetic live/replay checks below. Whole CONTENT-4 remains open:** no genuine local TodoWrite, TaskCreate/TaskUpdate, EnterPlanMode/ExitPlanMode or Codex plan update was found. No new native session, prompt or model call was launched for this task. This report updates the existing task's evidence; it is not a second work queue.

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
| TaskCreate/TaskUpdate and ExitPlanMode | External source dependency | Need genuine captured calls/results before mapping/integration; coordinate the held adapter/contracts/projection seam under review 125 D10 |
| Native plan Markdown “Plan” material | External source dependency | Need an actual captured body/artifact and evidence-backed native identity; mode metadata/current-path guesses and generic headings do not establish it |
| Codex plan sources | DATA-7 dependency | Genuine CLI/connected plan-turn capture and journal-vs-stream verification still required |

There is **one pinned checklist plus thirteen compact historical operation articles** containing revision/delta lines and their existing operation chrome. There are not thirteen duplicated full checklists. This report does not claim that operation articles disappeared or redesign held History chrome. If “not ten cards” means further removal of that chrome, it is a remaining presentation interpretation for the builder, not a completed change hidden in this acceptance claim.

## Checks and remaining handoff

- 93 scene tests across 13 files pass, including 19 plan tests (10 existing, 9 new) and the existing scene goldens. The initial unfamiliar-state regression failed on the baseline helper, then passed after the focused repair.
- Both project TypeScript checks and production build pass. Tests import this worktree's fixture and package sources; no dependency on another unmerged Desktop checkout.
- Five focused desktop browser journeys pass using installed Chrome: the existing checklist baseline; existing duplicate-label guard at 1440 px; new live/revision/replay journeys at 600 and 1440 px; new literal-state guard at 1024 px. The first attempt could not find Playwright's bundled browser; installed Chrome was used without an install or download.
- Synthetic screenshots stay under `.local/`; the existing frame and final reading frames were inspected. Follow is explicitly disabled before positioning the pinned list for a reading frame. The post-scroll 13-revision frames show passage connector segments crossing the pinned-list region above the first operation cards. This report does not claim a clean connector/freeze/polish gate; geometry/settlement in held History was not changed or investigated as a second task. No phone/touch check, 14-minute full browser gate, hosted CI, physical/platform acceptance or human ten-minute study was run.
- No History, adapter, contract, projection, capture/store, native controller, schema, dependency, telemetry or animation changes. Native journals/configuration/credentials were read only; only synthetic scratch journals were appended.

**Root handoff for the existing CONTENT-4 entry (leave its checkbox open):** record the 13-revision desktop live/replay acceptance and canonical-state comparison repair, link this report, and retain the exact genuine-source dependencies above. A future real sample must contain actual TodoWrite or TaskCreate/TaskUpdate/ExitPlanMode material and the Codex plan source being claimed, with source version/session-prefix/bytes/counts and as-of behavior checked. The existing DATA-7/D10 seam must be resolved before unverified mappings are added. Do not turn the DATA-8 mode notices or generic Markdown prose into substitute fixtures, and do not claim whole CONTENT-4 done from this synthetic-only plan rendering.
