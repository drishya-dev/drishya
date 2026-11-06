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
