# CONTENT-12 â€” compaction and recorded request context

30 October 2026. Whole-item implementation in PR #301. Both builders approved the exact additive contracts and 22-file scope, then Harsh approved four existing context-ring owners for a wording-only correction (26 files total); the approved claim is in STATUS. No captured-store/envelope migration, native writes, new dependencies or controller action.

## What changes

Claude boundaries retain their captured before/after token counts, trigger and duration. Codex boundaries show the last request before and first request after, explicitly labelled temporal request readings rather than occupied context. Missing readings stay absent. Both use a quiet paired relative scale at the existing boundary position; no invented capacity or elapsed compaction duration. Unlinked Claude summaries stay separate and say the link was not recorded. Only exact known native boundary references attach them. Explicit Codex encrypted compaction entries disclose encrypted availability without persisting ciphertext.

Usage starts with the latest recorded request-input reading and its time. Claude input is explicitly derived from input + cache-read + cache-creation buckets; Codex request input is captured. A ratio to a captured capacity is labelled derived. Output/cumulative tokens never become occupancy. Combined-agent projections omit a single global reading. Captured local stdout with an unambiguous context-report heading and category table renders recorded categories, values, units and percentages in order. Unknown/malformed rows preserve raw access. Categories never change with later request receipts.

## Data, replay and bounds

Adapters retain original observation parts and IDs. Additive part 1 enriches compaction evidence on an explicit **Rescan original journal**; there is no new automatic global backfill. Repeated rescan adds zero. The reducer folds parts of one native record into one boundary, keeps the original timeline positions/IDs, and uses r28 to invalidate old derived caches. Summary artifacts use the existing redact-before-persist content path and bounded captured-artifact reader.

Request receipts own no playback step: a past cursor exposes only readings with `availableAfterStep < step`; a boundary's directly recorded metrics appear with that boundary; later summary artifacts and references remain hidden until their own cutoff. Complete history exposes all evidence. The worker persists context collections in its existing derived item index. Pages carry only loaded-passage boundaries/summaries, their referenced request readings, and one as-of latest reading. A one-passage test over 60 compactions bounds this to at most one boundary, one summary and three readings; cold/warm/restarted pages agree. Live capture and the replay cursor remain independent.

## Verification

- Both TypeScript projects pass. Related units: 566 pass / one existing skip across 88 files before the final same-timestamp guard; the final focused adapter/projection/worker/report/ring checks pass: 36 tests in six files, including that guard. No existing test assertions or premises changed.
- `pnpm check:affected --dry` selects both typechecks, related units and the full browser suite because shared history/contracts/reducer files changed. The equivalent targeted checks ran here; the full gate runs once in the coordinated isolated batch tree.
- `pnpm package:verify` passes isolated offline installation, both synthetic harness imports, bundle export, authenticated API and persisted restart.
- `pnpm check:real -- compaction --pick 7` passes exact internal boundary count/metric/request-time/window/summary-reference comparisons on seven selected Claude sessions and every discovered Codex compaction session. Scanner state resets per native source, including forked journals. It prints only recording prefixes, sizes and counts.

| Harness | Recording prefix | Size | Boundaries | Paired request readings | Missing prior | Linked captured summaries | Unlinked summaries | Encrypted summaries |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Claude | rec_6b23303f | 59.6 MB | 5 | 5 | 0 | 3 | 2 | 0 |
| Claude | rec_2ddd7a77 | 8.5 MB | 3 | 3 | 0 | 3 | 0 | 0 |
| Claude | rec_638ceba6 | 13.1 MB | 2 | 2 | 0 | 2 | 0 | 0 |
| Claude | rec_a7e9af7d | 27.0 MB | 2 | 2 | 0 | 1 | 1 | 0 |
| Claude | rec_17accc13 | 2.5 MB | 1 | 1 | 0 | 1 | 0 | 0 |
| Claude | rec_268cb9c3 | 3.4 MB | 1 | 1 | 0 | 1 | 0 | 0 |
| Claude | rec_3c07fd04 | 3.6 MB | 1 | 1 | 0 | 1 | 0 | 0 |
| Codex | rec_cb864f24 | 18.3 MB | 3 | 3 | 0 | 0 | 0 | 3 |
| Codex | rec_5da1cec3 | 15.8 MB | 2 | 2 | 0 | 0 | 0 | 2 |
| Codex | rec_b8a0ec6b | 31.9 MB | 2 | 2 | 0 | 0 | 0 | 2 |
| Codex | rec_b0db8e34 | 4.7 MB | 2 | 1 | 1 | 0 | 0 | 2 |
| Codex | rec_4085ea06 | 5.0 MB | 2 | 1 | 1 | 0 | 0 | 2 |
| Codex | rec_c9c33a4f | 1.2 MB | 1 | 0 | 1 | 0 | 0 | 1 |
| Codex | rec_3b9ca2ee | 2.4 MB | 1 | 0 | 1 | 0 | 0 | 1 |

Targeted browser acceptance: eight pass / one existing opt-in skip across compaction, context ring and recorded usage. The final five compaction cases pass again after screenshot review corrected theme tokens and metadata spacing; assertions verify visible bar colors. The summary reader owns only focus lost from its removed/disabled paging control, restores it locally for Escape, and preserves deliberate outside focus (a delayed-response negative browser case). The context ring retains its values, geometry and high-ratio threshold; its label now says last recorded request input/window and labels the ratio derived. All screenshots stay in ignored `.local/`; native content is never printed, committed or shared.

## Real browser acceptance — 31 October

Real scratch-home imports were checked at **600 and 1440 px**. Every checked compaction matches its captured token values (or request receipts for Codex), linked Claude summaries open through the bounded reader, Codex encrypted summaries say so, and seeking before the boundary hides it. Four final private receipt frames (one session per harness, both widths) were inspected for visible bars, readable metadata and viewport fit. There were zero page errors and no document overflow. The ordinary no-compaction sessions add no boundary/report material. No native source was changed.

| Harness | Recording prefix | Bytes | Boundaries | Summary descriptors | Request readings | Widths |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Claude | rec_2ddd7a77 | 8,453,779 | 3 | 3 | 292 | 600 / 1440 |
| Claude | rec_6b23303f | 59,594,944 | 5 | 5 | 3,045 | 600 / 1440 |
| Codex | rec_cb864f24 | 18,288,301 | 3 | 3 | 630 | 600 / 1440 |
| Codex | rec_b0db8e34 | 4,681,372 | 2 | 2 | 61 | 600 / 1440 |
| Claude | rec_c091a575 | 206,993 | 0 | 0 | 10 | 600 / 1440 |
| Codex | rec_d74de6fd | 333,424 | 0 | 0 | 10 | 600 / 1440 |

The private driver initially assumed every recording could display one global request reading and blindly toggled an already-open Usage menu. These driver premises were corrected: multiple-agent projections omit a global reading, and the driver opens Usage only when needed. The repeated no-compaction checks pass at both widths. The fixture additionally covers manual metrics, unlinked summaries, unknown category rows, missing readings, late summary visibility, live append at a past replay cursor, summary pagination/Escape and deliberate outside focus. Genuine category acceptance remains blocked below; the fixture does not satisfy it.

## Gate follow-up — 31 October

The coordinated candidate exposed two CONTENT-12 causes. The existing Classic Usage spec failed at its first 1440 px iteration because the new footer removed its truthful “Only reported values” premise; all preceding geometry checks passed. The footer now says “Only reported values are shown as captured; derived request input is labelled”, preserving that premise and the captured/derived distinction. The existing spec is unchanged, including its geometry, copy, font and focus assertions.

The new compaction spec reused a before-all scratch daemon/recording across cases. Working recovery correctly persisted the 600 px case’s final reader page; the 1440 px case restored lines 201–350 while expecting its initial page. Every test now owns a fresh scratch daemon/store/recordings through beforeEach/afterEach. No product recovery behavior or page/count/focus assertion changed.

After rebuilding, **all six targeted cases pass**: all five compaction cases plus the unchanged Classic Usage case (its existing 1440/900/390 loop). The UI typecheck passes. No layout or phone-specific change was made. This bounded rerun resolves those two causes; it is not a claim that the coordinated full browser suite is green, and the remaining shared-gate findings stay with the batch owner.

## External acceptance blocker

**NOT VERIFIED on a genuine capture: Claude `/context` category output.** The approved design scan found zero actual context reports or exact `/context` echoes in 41 Claude journals (313,005,991 bytes; 20 boundaries, 13 automatic, seven manual, 20 summaries, seven unlinked). The official repository-local Claude Code 2.1.314 runtime is installed and its auth status reports `loggedIn: false`. This is an account blocker: no login, credential/configuration change or fabricated native journal was attempted, as the builder explicitly directed. A working signed-in Claude CLI or a supplied genuine `/context` capture is needed. The Codex scan covered 73 journals (163,317,603 bytes; 20 compacted rows, 16 bracketed request pairs, 18 encrypted replacement entries). Synthetic category tests establish regression behavior only. The UI does not manufacture the screenshot's categories, memory/skill/MCP inventories or a Compact button. No Codex plaintext summary is available in the checked compaction captures; encrypted states are verified instead.


## Completion takeover â€” 31 October

The builder authorized completion takeover of the inactive draft; the claim was transferred on main (`b7928e20`). Harsh's implementation and previously approved scope are preserved. No production correction was indicated by the acceptance review.

Fresh checks in the independent completion worktree pass both TypeScript projects and 41 focused units across adapters, projection, paged worker, context reports and the existing ring. A fresh bounded `check:real -- compaction --pick 1 --max-mb 20` passes exact native boundary/metric/request-neighbour comparisons for Claude `rec_024517cd` (6.3 MB, 426 operations, four boundaries, four paired readings, four linked summaries) and Codex `rec_428a053a` (7.3 MB, 424 operations, one boundary, one paired reading, one encrypted summary). These are new local-source checks, separate from the prior acceptance matrix above; no journal text or paths were printed.

A fresh read-only native `auth status` check still reports `loggedIn: false`, `authMethod: none`. Genuine Claude `/context` category acceptance remains externally account-blocked. No login/configuration or credential change was attempted. This does not establish genuine category rendering; synthetic category checks remain labelled regression guards.

| Acceptance line | Evidence / remaining |
| --- | --- |
| Every real compaction preserves captured metrics or explicit missing values | Both-harness exact scanner comparison passes; original real browser matrix above covers 600/1440. |
| Summary reachable with captured/encrypted/missing provenance | Original real browser matrix and focused worker/projection guards; no plaintext invented for encrypted Codex summaries. |
| Genuine Claude `/context` categories | **External account blocker**, unchanged after fresh auth check. |
| No-compaction session adds no boundary/report | Both-harness original genuine 600/1440 matrix above. |
| Live/replay cutoff and bounded worker paging | Focused units pass; prior delayed/live/replay browser guards recorded above. |
| Finished-task batch integration | Pending the coordinating root's one isolated combined gate; this PR remains draft until that gate is recorded. |

## Authoritative handback and integration assessment - 31 October

The takeover section above records a historical handoff. Authoritative main `dbf3804` subsequently hands the whole CONTENT-12 item and this existing branch back to **Harsh + Codex**, after the builder confirmed Harsh is active. The current claim retains the approved 26-path scope and explicit genuine-Claude-context account blocker. This branch now merges that main, including its CONTENT-13 web-result implementation, without conflicts. Yash's separate CONTENT-14 and TEST-2 WIP/holds remain untouched; this handback is not permission to change their isolated result rendering or reliability work.

The earlier local-only ownership uncertainty is resolved by the refreshed canonical STATUS row at `dbf3804`; the historical takeover is preserved rather than rewritten as current ownership. No claim removal, parent-task completion tick, PR readiness change or merge is applied here.

### Named verification phases

| Phase / candidate | Actual outcome | Limit |
| --- | --- | --- |
| Initial complete combined gate, `1fe9d6c` | UI build and both typechecks pass; package passes. Default-worker units: 1,104 pass / one skip / one selected-branch timeout. Full browsers: 583 pass / 28 skip / five failures. | Initial failures remain recorded, not overwritten by isolated passes. |
| Initial serial browser phase, same candidate | 33 pass / one skip / zero failures. | Separate evidence for unchanged serial scope, not a second corrected full-suite run. |
| Capped-unit follow-up, same combined source | 1,105 pass / one skip, all 183 files, with four maximum workers. | Does not erase the earlier unconstrained-worker timeout. |
| CONTENT-12 repair, `55c5f45`, then feature `3966f29` | UI rebuild and UI typecheck pass; all six targeted browser cases pass (five compaction cases plus the unchanged Classic Usage case). | Exact existing assertions preserved; per-test scratch fixtures isolate persisted reader positions. |
| User-run corrected parallel project, `91496c75` | **553 pass / 27 skip / two failures**. All five previously failing browser cases pass in this corrected parallel run. | The two different failures concern reader recovery and a blocked Inspect click. Root is diagnosing them against clean current main; neither is classified as a baseline failure yet. |
| User-run corrected package, `91496c75` | Pass, 14.48 seconds. | This phase is green; corrected parallel browser project is not yet green. |
| This authoritative-main alignment | `dbf3804` merged without conflicts; canonical handback and CONTENT-13 source preserved. | No build, test or browser run during root's exclusive diagnostic lease. Earlier candidate counts are not retroactive verification of newly merged main source. |

The corrected parallel results and prior serial results are reported as separate phases. They are not added together to imply a new single green full-suite run. The current gate assessment remains with the coordinating root; its clean-current-main diagnosis is still in progress.

## Genuine `/context` acceptance, resolved 31 October (Yash with Claude)

The blocker above is closed by a genuine capture made with the real harness, which also found two defects the synthetic fixtures could not.

- **Capture.** Claude Code 2.1.316 was signed in for the builder, so a headless `/context` run on a throwaway repository wrote journal `26c6990a` (7,230 bytes, one report). A second, organic report already existed in journal `cf751266` (82.9 MB), written by an interactive run; the earlier scan did not count it because it is a `system` row, not a user-role one. Of 151 local journals, 2 contain a `/context` report. Nothing was changed in the native configuration or credentials, and the journals were only read.
- **Defect 1, found by the capture:** current Claude Code records the report as a `system` row (subtype `local_command`, with a structured `contextUsage` object as well), which the adapter dropped as bookkeeping. It is now kept as the same exact captured command output older versions wrote in the user role. Existing imports need Rescan to show it.
- **Defect 2, found by the capture:** a report prints several tables (categories, then Skills); the parser merged them into one list. The category table now stays apart and each further table is its own named list. A third shape, the interactive terminal report (a colour grid with one legend line per category and `Title · /command` blocks), is read as well, with the same rules: nothing is added or computed, and the exact text stays one click away.
- **Checked on the real reports:** the headless report shows 7 category rows with bars and a 38-row Skills list; the interactive report shows 7 categories and 3 lists (1 row each). Rendered in the running app at 600 and 1440 px: no overflow, zero page errors (the headless one; the interactive one was checked through the adapter and parser over the whole 16,482-row journal, not in the browser). Units: 7 for the report parser, 1 for the adapter row.
- **Not verified:** a genuine report with MCP tool lists or memory-file lists beyond the one-row summaries above, and a Codex equivalent (Codex has no `/context` command).

### Exact proposed review-ready external exception (not activated)

> **Superseded 31 October:** the exception below is no longer needed; the genuine `/context` acceptance line is met (see the section above). Kept as the record of what was reported before the capture.
> External acceptance exception: genuine Claude Code `/context` category rendering remains **ACCOUNT BLOCKED and NOT VERIFIED on a genuine capture**. The official local Claude Code 2.1.314 runtime is installed but signed out; the user explicitly directed that no login, credential/configuration change or fabricated native capture be attempted. Existing parser/category fixtures are regression guards only. Compaction/no-compaction evidence for both harnesses at 600 and 1440 px is recorded above. The unmet genuine category line requires a working signed-in native runtime supplied by a builder, or a genuine captured `/context` result, before it can be checked. The parent CONTENT-12 TASKS checkbox remains unchecked for this case. Any review-ready change must first follow root's recorded assessment of the actual integration gate and must retain this exception verbatim in substance.

This wording is prepared for the confirmed owner/coordinator; PR #301 remains **draft**, the claim remains active, and no whole-task acceptance or release readiness is claimed. No native auth/configuration action was performed in this closeout.
