# AG-5: genuine native interaction cases

14 November 2026. Work in progress on `codex/ag-5-native-cases`, targeting `codex/harness-antigravity` only. Dependencies #469, #472, #474 and #479 are stacked for local checking; no PR was self-merged. Fable must merge those dependencies first. Own frozen install completed in this worktree.

The whole acceptance contract remains TASKS AG-5. This record is evidence and handoff, not a separate active task queue. No AG-5 mapping or acceptance is claimed yet.

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
