# AG-5: genuine native interaction cases

14 November 2026. AG-5 mapping and available acceptance are complete on `codex/ag-5-native-cases`, targeting `codex/harness-antigravity` only. Cumulative PR #482 contains #469/#472/#474/#479 plus final review fixes, so Fable may review the single cumulative diff. No PR was self-merged. Own frozen installs were used for the source, isolated gate and unchanged-main control worktrees. AG-3 still has one external native-app interruption acceptance line; this is not shipping approval.

The authoritative whole acceptance contract remains TASKS AG-5. This record is evidence and handoff, not another active queue. The final section supersedes the historical work-in-progress notes below; unsupported native states are explicitly not accepted as positive proof.

Yash requested one prompt at a time for cases absent from the latest native captures. Rescan first, then use one genuine conversation per missing case. The runbook is `antigravity-ag5-runbook.md`; model selection and any native approvals stay in Antigravity. Use a low-cost supported model and a throwaway repository. Drishya stays passive and never installs/configures MCP, changes native policies or answers native requests.

AG-4 already proved image prompts/agent-read images and all three artifact documents; it also found six PDF references, kept as explicit unsupported gaps without reading PDF bytes. These findings do not prove interactive plan review or PDF presentation. AG-3 already has genuine background commands/child links but still records its external isolated native-process interruption gap.

Next evidence: counts-only survey of browser/MCP/questions/approvals/plan review/input/kill/delete/move/model cases from allowed transcripts. Never print native conversation content or read credential/config/browser-profile files. Real screenshots remain .local; Yash explicitly requested local visual inspection of actual Antigravity-in-Drishya sessions, with newest captures preferred.

## Latest allowed-corpus scan

56 selected transcripts, 52,971,227 bytes, zero malformed/oversized records in this scan. Exact known-name/structural checks found zero browser, MCP or plan-review calls. One question call (`99ef88f8`, 43,659,730 bytes) and one permission call (`4b39dd4d`, 468,671 bytes) have native DONE receipts, but no checked structured field proves answered/skipped or approved/denied. DONE must not be treated as successful user interaction.

Four send_input calls have DONE receipts. Background/kill categories have 73 calls (64 DONE, eight ERROR, one missing result); these do not prove all individual lifecycle cases. Thirty-seven lexical delete/move command candidates are not confirmed filesystem outcomes. Six PDF media references are present. No native conversation values were printed, committed or copied into fixtures. Counts-only detail remains `.local/ag-4/ag5-corpus-counts.json` in the AG-4 evidence tree.

First requested user capture: a native browser subagent/tool run against a local counter page, with before/after screenshots and a recording when natively available. Explicitly exclude Playwright/Puppeteer/shell screenshots so a successful command cannot be mistaken for native browser evidence. Keep native policies unchanged; one conversation per case. Verify the new capture before requesting MCP setup or another case.

## First requested browser capture: recorded

After Yash reported completion, the newest parent `878c3f31` (28,839 bytes) and browser child `12966ad5` (13,782 bytes) were found. The child records three native `webview_browser` calls with native DONE result receipts, three media entries, and three readable/captured image payloads. The first two calls explicitly record loopback URL arrays. Input shape is `intention`, `observation`, `script`, optional `urls`; result content is text. No conversation values or script bodies were printed.

A scratch import retains all three images. It currently also emits three unknown-tool observations because `webview_browser` has no Antigravity mapping yet. This is genuine capture proof, not completed browser presentation acceptance or independent proof of the counter value/video recording. Do not ask Yash to repeat the capture. Preserve native browser provenance; do not label it as MCP merely to fit an existing UI helper.

Next user capture is the official Everything MCP test server, through actual native MCP calls. Current official feature names are `echo`, `get-sum` and `get-tiny-image` (the older runbook's `add` name is stale): https://github.com/modelcontextprotocol/servers/blob/main/src/everything/docs/features.md . Any installation/configuration is through the user's native client workflow; Drishya does not read or edit MCP configuration or credentials.

## MCP capture: recorded and initial adapter mapping

Yash's next run produced parent `4085ec97` (175,465 bytes) and MCP child `7d67461b` (10,349 bytes). The child records three `call_mcp_tool` invocations: expected tool identities echo, get-sum and get-tiny-image, each with native DONE result, no recorded error; the synthetic echo marker occurs in its corresponding returned text, and one image is readable. These are actual native MCP calls, not inferred shell commands. No native MCP configuration, credentials or environment values were read by Drishya.

Observed wrapper fields are `ServerName` (string), `ToolName` (string), `Arguments` (object). The adapter now maps exactly those explicit identities to the existing MCP intent. Missing identities stay literal/unknown, never guessed from argument text. Parallel calls retain call-order correlation. Focused tools/native-shape tests (7) and backend typecheck pass; scratch import unknown-tool observations drop from three to zero. This is initial mapping, not whole-item UI/regression acceptance. Browser mapping and the remaining genuine interaction cases are still pending in draft #482.

Next capture: the native implementation-plan review workflow, with a user comment/revision followed by explicit approval. Keep model/permissions unchanged except selecting the native Planning/review mode when required; do not infer approval merely from the agent saying it was approved.

## Recorded follow-up cases and main reconciliation (14 November)

AG-5 remains in progress, not accepted. Native browser input now retains a captured full-input artifact; the browser reader uses existing artifact/result readers. The adapter recognises explicitly recorded same-conversation Markdown artifacts without assuming every document is a plan. Native questions decode only the recorded timestamp/A-number receipt shape, including an explicit skip; ambiguous or clipped receipts remain unresolved.

- Plan/artifact capture: `cbb29ec1`, 13,617 bytes. A metadata-bearing Markdown artifact and later implementation writes/edits are recorded. The sequence does not prove a revised plan before approval or a typed native approval state.
- Answered question: `00c5ee91`, 2,072 bytes; one native question and one recorded answer.
- Skipped question: `78dd1e85`, 2,013 bytes; one native question and one native skip receipt.
- Permission-tool attempt: `79f24c42`, 1,855 bytes; no native approval call. The assistant's availability report is not proof about all native settings.
- Command-review attempt: `b510d82d`, 2,409 bytes; both commands executed. No approval/denial acceptance is claimed, and command output containing a denial marker must never be interpreted as refusal.

Before reconciliation, 44 focused units pass across the native decoder, browser evidence and artifact readers. Real-session acceptance and the final regression checks are still pending. Screenshots and scratch imports remain local.

Yash requested preservation of current main's performance and presentation improvements and one final integration review. Merge current main into this item branch rather than replacing shared files. In particular, preserve SHIP-5's question card/controllers, UI-50 formatting, UI-49 clearance, UI-47 loading and LIVE-7 capture scheduling. Antigravity adds only passive recorded-data handling. Item PRs remain internal dependencies targeting `codex/harness-antigravity`; the final review is one PR from that integration branch into main, never independent item merges into main.

### Current-main merge record

Reconciled main through `fb642882` (including SHIP-5 #487, UI-50 #483, UI-49 #484, UI-41d #485, UI-47 #488 and LIVE-7 #489). Six conflicts were resolved explicitly:

- `QuestionCard.tsx`: retain main's complete interactive/read-only/sent/stopped card and controls. Add only native receipt labels, skip display and an Antigravity passive guard. A supplied live request must not make an Antigravity card interactive.
- `SessionHome.tsx`: retain main's delayed discovery notice and existing layout; retain Antigravity identity/filter additions.
- `ask-question.test.ts`: keep both controller-receipt/stop tests and native ordinal/skip tests.
- ingest `index.ts`: retain main's SourceWatch export, timing and initial follow wake; add Antigravity alongside the two original adapters. No main latency setting was rolled back.
- `STATUS.md`: retain both builders' handoffs and current claims.
- `TASKS.md`: retain main's new items/status and regenerate counts from the stacked item checkboxes. No new AG-5 completion mark.

Validation after reconciliation: both TypeScript projects and UI build pass; 121 focused units pass, plus the new passive-card regression (34 tests in its final focused rerun). Eleven Edge browser checks pass with two workers and no retries, covering main's Claude/Codex question display, connected question answer/stop at 600/1440, Antigravity read-only identity and exact child links at 600/1440. These are regression checks, not a claim that all AG-5 real-session acceptance is finished. No full gate or hosted CI was run.

## Paused at Yash's request, 14 November

Saved in-progress native-case units, synthetic corpus, check-real cases and browser spec. AG-5 is not finished and stays draft/unticked. No integration/item PR merged.

New checks: genuine browser (3 calls), MCP (3 calls), questions (3 sessions), PDFs (6 references across `cc6901cc` / 104,590 bytes and `9b23834b` / 291,123 bytes), and permission (`4b39dd4d` / 468,671 bytes) scratch checks pass their counts/provenance checks. PDF bytes are never opened. Native permission outcome remains unknown with a recorded-data gap; command output is never a refusal. Projection version r44 invalidates previous derived caches without an event schema change.

New lifecycle capture `6ec2c1a4` / 39,646 bytes / 61 steps records synthetic file writes, move/delete shell requests, exact task send_input/status/kill/list calls, and a previously unseen native swarm tool. It has three explicit requested model values and three child metadata records. This proves requested identities, not that every requested model actually ran. `swarm`, `read_board`, `post_message` remain unknown pending exact mapping. No child ownership is guessed by time or name.

Six native-case unit tests pass. The new 600/1440 browser spec currently fails: the PDF/permission details are present in projection gaps but are not inline History text. Do not claim those are visible acceptance yet. The artifact assertion now explicitly chooses captured call input when today's referenced file is absent. Next: use existing gap disclosure or add only an agreed narrow native notice path, map evidence-backed swarm ownership (including parallel calls), finish real frames and remaining regression/full gate. Preserve main SHIP-5/UI-50/UI-49/UI-47/LIVE-7.

User paused before further implementation. No background browser suite is running. All real capture diagnostics and screenshots remain under .local; only synthetic data is committed.

## Final native mapping increment (14 November)

- Native `swarm` add is a delegation request; models/title/status/kill remain literal control calls, not new child spawns. `read_board`/`post_message` retain native input/result identity. Child opening still uses only explicit conversationId + spawnStepIndex metadata. The two parallel add results share the native step-34 child receipts; this is preserved as recorded, never matched by name or requested model. Requested model values are not runtime identity: an explicit gap says so.
- A feedback-request artifact gets an explicit unresolved-review gap. Permission DONE receipts stay unknown approval/denial, even with completed tool output.
- PDF references use existing Review findings → Capture gaps, with recorded URI and MIME; no PDF bytes read or PDF viewer claimed. This reuses existing navigation rather than adding UI chrome.
- Genuine browser screenshots exposed a shared image disclosure click issue. Yash reserved the single History image-original click handler on main d31ea4b9: stop propagation for native webview_browser only. Existing harness behavior, layout and motion remain unchanged. Synthetic screenshots now cover the same branch.
- `antigravity-media.ts`'s candidate scan is narrowed to explicit brain-folder Markdown paths, avoiding outside repository metadata writes being counted as native artifacts. This existing Antigravity-only real-case scanner occupies the planned README slot in the approved 26-path scope; no README change is needed.

Nine targeted Edge browser checks pass, two workers, zero retries, including native screenshot script/result reading and main's existing question answer/stop behavior at 600/1440. The focused native suite has nine tests. Both typechecks pass. Full units: 1,628 pass / one existing skip / one Git comparison timeout under full parallel load; its isolated 11-test rerun passes. Real acceptance frames and isolated combined gate follow this source checkpoint; no task tick yet.

## Completed real frame matrix and final review correction

Twenty real Antigravity frames pass at 600/1440, no page errors or page overflow, covering native browser with screenshots/full script+result, MCP, answered/skipped questions, recorded review artifact, both PDF captures, unresolved permission, task lifecycle and image prompt. Four fresh Claude/Codex frames pass at the same widths; existing-harness question imports also retain 9/9 Claude and 1/1 Codex question cards. Local evidence: `.local/ag-5/acceptance/results.json` and the PNG files in that directory. No real content or screenshots are committed.

Review correction: native swarm parallel add requests share result-step child metadata. That identifies the planner group, not a unique individual request. Those two child receipts now remain explicit gaps rather than assigning both children to the last positional call. The later single add has an exact child link; all three conversations remain separate importable sessions. Model requests remain visible only as requests, not proof of runtime identity. The regression uses unrelated names to prevent name-based joins. This supersedes the earlier implementation note describing the step-34 receipts as individual call links.

The final AG-3 reopen additionally pins output/child file handles and versions late child evidence (review/antigravity-ag3-live.md). Main's latest claims are preserved; source integration remains isolated. No production code or PR has been merged into main.

## Final acceptance and reviewer handoff

### Native-case matrix

| TASKS case | Genuine evidence | Presentation and limits |
|---|---|---|
| Browser | `12966ad5`, 13,782 bytes; 3 calls / 3 images | Full recorded script/result and screenshots at both widths. No video output was produced; the recorded run reports no available video capability. Not a video support claim. |
| MCP | `7d67461b`, 10,349 bytes; 3 calls / 1 image | Explicit native server/tool identity, captured results/image; no shell substitution or fake MCP browser. |
| Plan/review | `cbb29ec1`, 13,617 bytes; 1 metadata-bearing review artifact | Artifact, follow-up and implementation retained. The allow-listed metadata file contains requestFeedback=true but no typed approval/rejection receipt. Visible unresolved-review gap; no inferred decision. |
| Answer/skip | `00c5ee91`, 2,072 bytes; `78dd1e85`, 2,013 bytes | One question each, literal native answer/skip receipts. Both widths; no native controls in Drishya. |
| Approval/denial | `4b39dd4d`, 468,671 bytes; 1 native request | Unknown outcome plus visible gap. `79f24c42` (1,855 bytes) reported no dedicated permission tool; `b510d82d` (2,409 bytes) executed both test commands. Neither proves an approval/denial pair. Further forcing would require native setup/policy changes; no policy was weakened. |
| Prompt image/PDF | `c452ce98`, 210,089 bytes; 1 image. `cc6901cc`, 104,590 bytes / 4 PDF refs; `9b23834b`, 291,123 bytes / 2 PDF refs | Image bytes displayed. Recorded PDF URI/MIME visible in Review findings → Capture gaps; bytes not opened, no PDF rendering/OCR claim. |
| Input/kill | `6ec2c1a4`, 39,646 bytes / 61 steps | Exact native manage_task send_input/status/kill/list retained, including results. This kills a background task, not the native application. |
| Delete/move | Same controlled lifecycle capture; 2 recorded command candidates | Commands and returned text shown as shell evidence. No invented applied diff or filesystem snapshot. New antigravity-file-commands check and synthetic rename/unlink requests cover this boundary. |
| Different models | Same capture; 3 requested model values / 3 child receipts | Requests are not runtime identity. Visible model-identity gap. Shared-step parallel ownership remains unresolved; unique single-request child linking stays supported. All children remain separate sessions. |

Twenty actual Antigravity frames and four fresh old-harness frames pass at 600/1440, zero page errors/overflow. The corpus includes synthetic native browser, screenshot branch, MCP, answer/skip, unknown permission/review, task control, model requests and file commands. Eight new check:real groups plus existing adapter/live/media checks run only in scratch homes. No native content or screenshots are committed.

### Final validation (local only)

- Final source `db6c9bb7`: both TypeScript projects pass; **261 unit files, 1,633 tests pass, one existing skip** with two unit workers (103.76 s). The subsequent test-only file-command fixture/check addition passes its nine focused units, typecheck and both native browsers; it changes no runtime code.
- Final delta isolated worktree, UI rebuilt: **34 Edge browser checks pass**, two workers, zero retries: antigravity-native, antigravity-harness, antigravity-live, question-card, library-search, home-opening, home-current, home-groups and search-position. Final extended native fixture: another two-width pass.
- Package verification passes, including isolated offline install, both existing-harness imports, authenticated API and persisted restart.
- Combined check:affected gate at frozen `c04947e4` before the final read/replay-only delta: types/build/package pass; **937 parallel + 32 serial browsers pass, 28 skip, 10 fail** (three parallel workers, serial one). Initial default-pool units had one 5 s Git comparison timeout (1,629 pass / one skip / one fail). Its isolated 11-test rerun and the final whole-unit run with two workers pass. Baseline full-pool unit reproduction was not run; do not label that timeout a proven main flake.
- The broad gate is **not green**. All ten browser failures reproduce on unchanged main `e9a0ccab` (own install/build, no Antigravity code). Eight parallel failures were rechecked with two workers and a 20 s per-test ceiling for missing controls; the same assertions/selectors fail. Paged replay was checked alone at the normal timeout. Material-motion fails all three isolated main repeats. This is baseline classification, not a fix or release waiver.

| Broad browser failure | Unchanged-main result / cause observed |
|---|---|
| approval-clearance:30 @600 | Same missing Send prompt selector |
| approval-clearance:65 @600 | Same missing Send prompt selector |
| approval-clearance:82 @600 and @1440 | Same missing Expand prompt selector |
| composer-typography:107 @390 | Same missing Attach selector; historical below-supported-width test left untouched |
| fresh-workspace:153 | Same prompt/control intersection assertion |
| fresh-workspace:1444 | Same stale label expectation: Answer requested vs Needs an answer |
| toolbox-window:172 | Same missing Tools selector |
| material-motion:71 | Same non-overflowing result-body predicate, 3/3 main repeats |
| p1-pacing:722 | Same Loading history status expectation |

Private logs: source `.local/ag-5/`; gate worktree `.local/ag-final/`; unchanged-main control `.local/ag-control/`. No hosted CI, telemetry, native settings or real-home imports.

### Merge and remaining external acceptance

Main's UI/performance code is preserved; all modifications to shared owners are the documented native-only sections. The final AG-3 review fixes are part of this cumulative branch, not missing from an older internal PR. The integration branch is refreshed with main. No PR was merged by Codex. After Fable's integration review, one integration-to-main PR and the builders' manual release decision remain.

**The only AG-3 acceptance line still open is a safely isolated, signed-in native-application crash/interruption.** No isolated authenticated profile exists here, and the shared native application is in use by the builders. Do not force-crash it. Existing partial-line/restart tests, live output checks and background-task kills do not falsely substitute for that case. Source is complete; this external check/release decision is explicitly carried forward.

Home discovery retains main's existing fallback polling for Antigravity; the new main SourceWatch fast-birth optimisation currently names the two existing harnesses only. No one-second new-session birth claim is made for Antigravity. Already-open native sessions use the measured tail and bounded side-file refresh. No layout or timing constants were changed to add this harness.
