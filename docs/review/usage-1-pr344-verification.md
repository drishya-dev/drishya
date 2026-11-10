# USAGE-1 — PR #344 review revision

6 November, Codex verification of Claude's revision `7282ec95`. The builder requested #344 first and excluded #346 from this continuation. The existing proposed optional field is unchanged; no new schema decision is made here. The PR remains draft pending explicit agreement from both builders and its final gate.

## Requested correction

| Before | After | Why |
|---|---|---|
| A valid secondary window was parsed only if primary parsing succeeded. | Both windows are parsed independently. | An absent or invalid primary must not discard a valid recorded secondary. |
| Usage emission required tokens, primary limits or a context window. | A valid secondary also permits the usage observation. | A secondary-only observation must survive the adapter. |
| The secondary share was nested inside the primary's rendering branch. | Either independently valid window renders, with its own provenance title. | The screen must not invent a primary or hide recorded data. |

Claude had already implemented this correction before the takeover. Codex did not duplicate that implementation. Added regression coverage at both supported widths for primary-only, secondary-only with null/missing/invalid primary, and both windows, checking the share count, secondary provenance title and horizontal containment. Existing adapter regressions also cover malformed secondary data without hiding a valid primary, and absence of both windows.

## Local checks

- Both project typechecks and `ui:build` passed.
- Adapter Codex, capture-core and projection units: **159 passed, 28 files**, three workers.
- `recorded-usage.spec.ts`: **3 passed, 1 skipped**, configured three workers (one file executes on one worker), no retries. The skip is the pre-existing opt-in store-copy check; the direct genuine-source scratch import below ran separately.
- `check:affected --dry` identifies both typechecks, related units and the whole browser suite because the existing proposal touches contracts. The full gate is deferred while this schema PR is blocked, in accordance with the no-full-gate-for-incomplete-drafts rule. No full-gate success is claimed.

## Genuine acceptance

Read-only discovery scanned 19 Codex and 166 Claude journals under the private runner's 100 MiB ceiling. Sixteen Codex journals contain both windows; none in that scanned set contains a secondary-only snapshot. Two Claude journals contain a report accepted by the existing context-report parser. These are bounded scan results, not claims about every local journal.

Only selected sources were imported, into a scratch Drishya home under `.local/`, with complete ingest catch-up before checking the screen. No native turn, configuration edit or journal modification was used. Private paths, raw records and screenshots remain in `.local/`.

| Genuine case | Prefix | Bytes | Observations | 600 and 1440 px |
|---|---|---:|---:|---|
| Codex primary + secondary | `rec_f696d8c1` | 176,796 | 15 | Two limit shares, both provenance titles, one context share, no horizontal overflow |
| Claude `/context` report | `rec_da884068` | 7,230 | 6 | Seven context category shares, no fabricated plan limits, no horizontal overflow |

The first candidate scan selected a journal that had both windows earlier but a primary-only latest reading. Its single latest share was correct and did not establish the required two-window screen acceptance. Selection was corrected to a genuine source whose latest reading contains both. Similarly, a broad text match for `/context` can occur inside an API request wrapper; the final selection uses the report parser on actual captured command content. Neither initial candidate result was called a passing case.

**Secondary-only limitation:** no genuine local case in the bounded scan. It is fixture-checked through adapter, persistence/projection and the browser, not claimed as genuine-session acceptance. This field comes from the harness; the runner does not fabricate a native journal to force that account state.

## Still required

1. Both builders' explicit agreement to the optional `UsagePayload.secondaryLimits` field. Harsh's change request is a correctness review, not evidence of schema approval.
2. Final-source isolated full gate once the schema decision permits finishing the item, reporting actual worker counts and any clean-main failures honestly.
3. Review and merge by the builders. USAGE-1 remains unchecked; #344 remains draft. This continuation does not modify #346 or any FINISH/Clarity surface.

---

# 10 November: USAGE-1 finished (Claude Sonnet 5.5, taken over from Codex)

The whole item: Context, Limits and live context, on recorded data only. Modern only; colours stay on existing tokens.

## Why a session with a `/context` report said "window not recorded"

Two causes, both fixed.

1. **Claude Code's journal records no context window**, so the Context row could never draw a share. But the report itself prints the window ("`293k/1M tokens (29%)`", or "`**Tokens:** 28.1k / 1m (3%)`"), and the journal's structured `contextUsage` agrees (28,117 of 1,000,000 in the genuine session checked). `contextReport()` now keeps that printed line as `total` (as printed, never recomputed) and the Context section leads with it.
2. **Large recordings are paged**: the UI's projection is a header with an empty timeline, so the report was never found in exactly the sessions that matter. A new read-only route, `GET /v1/recordings/:id/context-report`, returns up to three captured `<local-command-stdout>` candidates (newest first, as captured); the UI parses them with the same `contextReport()`. Until the answer arrives Usage says "Reading the context report…", never "no report recorded".

## What the panel shows now

- **Context:** one segmented bar of Claude Code's categories from the newest report (messages, system tools, MCP tools, system prompt, memory files, skills, autocompact buffer, free space as the report prints them), a legend keyed to the segments, the report's own "293k of 1M tokens · 29% used", and "From /context · read &lt;time&gt;". Without a report: the last request's tokens plus "No context report is recorded. Run /context in Claude Code to record one." Categories are never estimated. Codex (window recorded) keeps its last-request share.
- **Limits:** Codex's 5-hour and 7-day windows as bars with reset times (the secondary window is PR #344's one optional field); Claude Code: one plain line.
- **Live context:** the session-line ring (LIVE-4) already showed Codex's recorded window. For Claude Code it now shows the last request's input (input + cache read + cache write, computed) against the window the newest `/context` report printed; its label says so. No report, no ring.

## Schema

Exactly one optional field, unchanged from the earlier draft: `UsagePayload.secondaryLimits { usedPercent, windowMinutes, resetsAt }`. Nothing else in `packages/contracts` changes. The new route is an API addition, not an event-schema change.

## Genuine acceptance (scratch home under `.local/`; prefixes, sizes and counts only)

| Case | Prefix | Size | 600 px | 1440 px |
|---|---|---:|---|---|
| Claude, `/context` report, no requests recorded | `rec_da884068` | 7 KB | 7-segment bar, 7 legend rows, no limits invented | same |
| Claude, report plus 2,617 request readings (paged) | `rec_c8e5c9c8` | 83.7 MB | bar and ring appear about 6 s after a cold open | bar, ring |
| Claude, no report (3 sessions) | `rec_7baa719e`, `rec_d9a02318`, `rec_f230ca48` | 383 to 545 KB | last request plus the plain "no context report" line, no ring | same |
| Codex, both windows in the latest record (4 sessions) | `rec_275b92f0` (6 MB), `rec_033468dc`, `rec_7b3a6bdc`, `rec_2be6ea63` | 222 KB to 6 MB | two bars with reset times, context share, ring | same |

No horizontal overflow in any of them. `pnpm check:real -- usage-context`: Claude 2 sessions with a report under 90 MB (both print their window), Codex 20 sessions, 156 records with both windows. A journal with the words "Context Usage" that is not a report (`rec_5e2feb95`) correctly shows no report. Not checked: a Claude session whose latest report is older than a model change (the ring would divide by the old window, and its label names the report as the source).
