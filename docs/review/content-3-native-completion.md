# CONTENT-3 — native questions and exact approvals

Completed locally on 29 October 2026. PR #288; the shared P1 batch gate is reported separately.

The connected Claude launch now explicitly requests stdio permission callbacks. Codex resumes without sandbox or approval overrides, preserving the native client's effective settings; no config write is made. Cancelled native permission requests are removed along with cancelled questions, and stale replies cannot act on them.

Historical Codex `request_user_input` joins the existing desktop `request_user_input_async` and Claude `AskUserQuestion` card. Native keyed answer arrays match only their captured question ID; an accepted acknowledgement still never becomes an answer. Projection r24 keeps object-shaped native options in existing imports. Missing options no longer imply a captured answer.

| Before | After | Why |
| --- | --- | --- |
| Approval shown only as request JSON | Exact command or proposed old/new replacement, with original request available | The person can read the actual action before deciding |
| File-change permission metadata could look like a supplied patch | Explicit missing-diff message; Allow once disabled in this view | A grant root is not evidence of the proposed changes |
| Title-only question footer claimed an answer existed | Only states that no offered options were captured | Captured and unavailable evidence remain distinct |

## Genuine native acceptance

All journals were produced/read by the real installed harnesses and imported into scratch Drishya homes; no journal was fabricated or edited. Screenshots, drivers and full results remain ignored in `.local/`. Real content is not included here.

- Claude `1a691710`: 209,800 bytes, 36 observations. Codex `71a376d0`: 375,432 bytes, 80 observations. Both have genuine questions answered through the running UI, a second question cancelled with Stop turn, and a genuine proposed action declined through the UI. Native defaults were preserved (Codex on-request/readOnly; Claude owned manual one-time callbacks). The synthetic file remained unchanged; no permission was granted and no project/config write was performed by either harness.
- At 600 and 1440 px for both harnesses: pending question/options, exact answer delivery, completion, question cancellation/clearing, and pending approval/decline/completion passed without page errors or document overflow. Claude's approval showed the genuine Edit old/new replacement; Codex's showed the genuine exact command. The answer and decline were explicit synthetic acceptance choices, never answers on behalf of an actual user question.
- Historical/replay checks at both widths covered those genuine recordings plus original Codex `4b5ca5b1` (44,016,822 bytes/1,530 observations) and `4d842553` (57,913,276 bytes/2,284 observations). Before the result boundary there are no chosen options; after it the native answers show once, while desktop accepted-only results show no invented answer. Eight journeys passed, zero page errors. These are the two actual sources previously reported as generic material under CONTENT-8.
- Existing r23 scratch imports were reopened under r24: the genuine Codex native question changed from generic/no readable object options to one dedicated card with two options and one captured chosen answer. Existing desktop forms remained dedicated cards; no journal reimport/mutation was needed.
- Read-only scan: 43 Codex journals/839,680,530 bytes contained 11 `AgentMessage.questions` entries across two native sources. All 11 exactly duplicated a captured `request_user_input_async` call's questions. Their call owns the single card; duplicate typed metadata is not displayed as another question. No independent typed-only question was found, so no invented standalone typed capture/schema was added.
- `check:real questions` checked Claude `024517cd` (9 native questions, 17 options, 5 literal answers) and fresh Codex `71a376d0` (2 questions, 4 options, 1 literal answer). Unknown protocols and protected/oversized input retain explicit native-harness errors; historical records never confer authority to answer another client's request.

## Checks and limits

42 focused units, both typechecks, UI build and 11 question/approval browser checks pass. Fixtures cover malformed/unknown input, exact request IDs, stale decisions, cancellation/resolution, retry, multi-select/free text, missing-diff fallback and original request access. No full gate was run per increment; the parent runs one finished P1 batch gate.

Passive journals do not contain every native permission exchange. Pending approvals were therefore verified on the genuine owned controller connection rather than fabricated into history. A native file-change approval that supplies only permission metadata and no proposed diff is explicitly unsupported for inline allowing; decline and continue in the native harness. Broad joined native workflows/platform release acceptance remain their existing NATIVE/REL tasks, not unfinished question-card work.
