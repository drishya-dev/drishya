# CONTENT-10 — direct readings, exact originals and keyboard alternatives

29 October 2026. Whole acceptance of the implementation already delivered in #265. PR #291 adds acceptance guards and genuine capture evidence; it changes no production reader, capture, schema, native policy or stylesheet.

## Decision and current behavior

| Before the original #265 change | Current accepted behavior | Why |
|---|---|---|
| Each result reserved a chooser row before its material | Reading alternatives occupy an absolute hover/focus corner and reserve no row | Captured material keeps its allocation; keyboard focus reveals the same controls |
| Complete JSON required a separate inspection step | Complete supported JSON reads directly as the existing compact field/table layout or inline tree/table | The whole result is available immediately, with exact Original and larger reading alternatives |
| A generic automatic-format rule could force a grid/tree | Shell and decoded MCP envelopes keep their captured text; CSV/TSV requires explicit selection | Preserve builder decisions and readable sibling text; never infer delimiters |

Baseline inspection on the running app confirmed these behaviors before any UI edit. There is no new production UI edit: changing a working reader merely to create a code delta would regress the explicit builder exceptions. Raw/incomplete/unsupported text remains literal, and heuristic reading choices are never labelled as the harness's own statements.

## Acceptance, line by line

| TASKS acceptance | Real and regression proof |
|---|---|
| Actual Claude Code and Codex sessions include shell output, JSON, delimited text, logs and errors | Existing JSON captures plus genuine native CSV/TSV captures and existing log/error cases, listed below. CSV/TSV shell reads also establish ordinary shell output. |
| Detected reading appears immediately without wasted resident chooser row | Real direct JSON shows its reader immediately at both widths; text defaults remain visible. Every result-reading group in the checked cards is absolutely positioned, so it contributes zero standing-row height. The row reduction belongs to #265; this acceptance PR does not claim a further height reduction against current main. |
| Alternative reading reachable by keyboard | All 20 final case/width checks focus a reader control, press Enter, open the alternative, compare exact Original against stored supplied text and close with Escape. JSON additionally opens its larger reader. Delimited cases remain Original until CSV/TSV is explicitly selected by keyboard. |
| Unrecognised output falls back to captured text | Actual logs and errors preserve their existing text body; explicit JSON inspection still offers the exact original when parsing is unavailable. Fixture incomplete JSON and unrecognised logs/errors cover the same boundary. |
| No `session-typography` or CONTENT-6 regression | All 11 named inline-JSON, adaptive-content and session-typography browser cases pass. Existing mixed native/MCP/wrapped siblings, exact derived formatting labels, resource/document alternatives, live arrival and replay cutoff remain intact. |
| Freeze test | At 600 and 1440 px, visible real material intersects its card allocation, text is selectable and no repeated animation or typed text is introduced. Paused screenshots were inspected privately; final snapshots stay under ignored `.local/`. |

## Genuine evidence

Only id prefixes, sizes and counts are recorded. Real journals were imported into this task's scratch home; native journal contents and real DOM assertion dumps were never printed. Final browser drivers suppress native live/refresh calls so checks use a stable imported snapshot.

| Recording prefix | Harness | Size / observations | Checked cases at 600 and 1440 px |
|---|---|---|---|
| `rec_7d8b3224` | Codex | 12,542,301 bytes / 449 observations | Complete 60-character JSON tool result; direct reading, exact Original, larger reader, keyboard return |
| `rec_3f724826` | Claude Code | 1,569,783 bytes / 361 observations | Complete 757-character JSON tool result; direct reading, exact Original, larger reader, keyboard return |
| `rec_4b5ca5b1` | Codex | 44,016,822 bytes / 1,530 observations | Logs and errors, exact supplied originals; text defaults and keyboard alternatives |
| `rec_cc002c1f` | Claude Code | 24,039,894 bytes / 3,311 observations | Logs and errors, exact supplied originals; text defaults and keyboard alternatives |
| `rec_a15b7865` | Codex | 197,638 bytes / 29 observations | Fresh real command capture of known CSV and TSV files; two completed command items, exact original, explicit CSV/TSV grid choice |
| `rec_8caeef7a` | Claude Code | 145,559 bytes / 11 observations | Fresh real command capture of the same CSV and TSV fixtures; two operations, exact original, explicit CSV/TSV grid choice |

The fresh recordings came from a new throwaway Git repository containing two synthetic dataset files. Codex App Server retained `on-request` approval and effective `readOnly` sandbox policy; two native command calls only, no file writes/network. Claude used its manual host permission flow and normal read permission, two Bash `cat` calls; zero permission exceptions were approved or denied. No native configuration or fabricated journal was written. Both harness turns completed. Only the native harness wrote its own normal session journal.

An initial syntax-only scan also found rectangular comma-bearing pytest output. Those candidates were not counted as genuine datasets. The fresh recordings remove that ambiguity. Codex stores both wrapper and canonical typed command observations; final browser checks select the canonical rendered typed child rather than a hidden duplicate wrapper.

## Checks

- Five new focused desktop browser guards pass: direct JSON and keyboard originals/larger view at both widths, explicit delimited choice at both widths, and terminal JSON/MCP envelope/log/error fallback preservation.
- `pnpm check:affected` passes with the installed Edge channel: both TypeScript projects, five related browser cases. Initial invocation lacked the browser channel and failed because default Chromium was not installed; the corrected run passes.
- Named regression gate: `inline-json-reading`, `adaptive-content`, `session-typography`: 11 passed.
- Captured-content and structured-data units: 26 passed. Production UI build passes.
- `node scripts/check-real.ts complete-json --pick 1`: Claude 66 sessions / 246 hits, Codex five sessions / ten hits within the default 90 MB bound. Scratch imports `rec_8baf1b3f` and `rec_428a053a` verify bounded complete JSON previews. Actual direct JSON UI proof above uses the separately identified rendered cases.
- New `reading-delimited` real-case scanner is supplied for root registration in the shared `check-real.ts` registry. It recognises strict rectangular candidates only, reports that syntax is not dataset provenance, and never chooses a product delimiter. The fresh native journals each produce two matches, one TSV. Registration is coordinated with the root agent to avoid simultaneous registry edits.
- The root agent owns the once-per-batch full gate and central TASKS/STATUS completion. No duplicate full browser/packaging gate was started here.

No task-specific external blocker remains. This report does not certify physical accessibility, every platform or ten-minute human preference release gates.
