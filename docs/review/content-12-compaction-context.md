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
