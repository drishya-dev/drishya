# CONTENT-2 — integrated browser and web evidence acceptance

29 October 2026 · completes the implementation and integration from #250.

The live product now mounts the browser strip and web evidence views. This check uses that committed integration, without the earlier temporary History patch. No browser rendering, History, adapter, schema or image transport changes were needed. The real-case command now scans both harnesses, counts actual typed Codex web records/search calls and Claude invocations, and fails when none survives projection. Tool definitions and quoted output do not count.

| Earlier gap | Verified result | Why |
| --- | --- | --- |
| Codex web acceptance was missing from the integration handoff. | Current native Codex capture and a retained genuine import show supplied result lists, full expanded material and keyboard navigation at 600/1440 px. | The typed search path is checked independently of Claude's WebSearch format. |
| Screenshot bytes had only fixture coverage. | Eleven genuine Claude browser operations have captured image bytes; two images open and close through the captured image reader at both widths. | The thumbnails and reader use sealed bytes, with no current-file substitution or remote image fetch. |
| The component was tested behind a temporary History patch. | Current main integration passes browser grouping/scrubbing, fetch/search, exact selected operation and captured-image journeys. | Acceptance applies to the running integrated product. |

## Genuine source matrix

All imports are scratch copies. Existing retained sealed stores were backed up through read-only SQLite before use; current native sources were imported separately through the normal privacy boundary. Content, paths and screenshots remain private under `.local/`.

| Harness / recording prefix | Source bytes | Observations | Checked at 600 and 1440 px |
| --- | ---: | ---: | --- |
| Codex `a012336b` | 8,291,460 | 1,466 | 13 web operations; two captured result-list operations per width. |
| Codex `4d842553` | 57,913,276 | 2,284 | 14 web operations, 13 with result lists; two expanded operations per width. Retained genuine import, not a newly available native journal. |
| Claude Code `64d5c199` | 13,211,006 | 2,288 | 196 web operations and six recognized browser operations; two consecutive strips and two web operations, seven selected steps per width. |
| Claude Code `061e5f2d` | 7,150,502 | 1,138 | 17 browser operations, five consecutive strips; ten selected steps per width. Captured fetch facts and search results each checked. Eleven browser operations retain 12 images; two genuine images open per width. |
| Claude Code `c8e5c9c8` | 82,859,509 | 6,946 | Nine browser operations, two consecutive strips; five selected steps per width. This older sealed capture has no retained screenshot bytes and is not used for image acceptance. |

The earlier browser-only import of `061e5f2d` has 798 observations and no image bytes; the newer full-source import above supplies the genuine image acceptance. These are not treated as two independent sessions.

The checked browser actions stay in captured order inside their original passages. Scrubbing mounts the original operation, keeps selected IDs and input/result ownership, and does not carry an earlier URL into a later call lacking one. Search results remain safe click-only HTTP(S) references. Fetch status/bytes/duration are shown only when captured. Browser result text is a captured excerpt, never a generated summary. A missing URL, text, image or metadata remains explicit or omitted as appropriate; scripts and unknown tool shapes are not interpreted into invented browser actions.

No real Codex journal in this check contains a recognized browser MCP story or browser screenshot. Codex acceptance therefore covers its genuine native web-search form, not a claimed screenshot/browser-MCP sample. The shared browser/image renderer is checked against genuine Claude bytes plus the regression fixture; unsupported/missing Codex browser bytes are not fabricated.

## Verification

- Both TypeScript projects and the production UI build pass.
- Eight focused helper/real-case units pass.
- Ten named browser journeys pass, none skipped: browser evidence, web results and expanded web-result acceptance. Supported desktop widths only.
- Real integrated checks pass: original browser groups/web sources, current Codex/Claude imports and genuine image opening. Zero page errors, remote requests or horizontal overflow in these checks.
- Private screenshots of browser composition and the genuine captured-image reader were inspected locally.
- `pnpm check:real -- browser-ops --harness codex --max-mb 90 --pick 1`: three current native sessions, 22 matching records; the selected capture has 13 web operations. Native definitions/quoted output do not count.
- A full gate is run once for the finished P1 batch; its result is recorded in the PR. This report does not replace TEST-2 or certify its outstanding scroll failures.

Reproduce the regression checks with the installed browser channel:

```powershell
$env:DRISHYA_BROWSER_CHANNEL='msedge'
node node_modules/@playwright/test/cli.js test tests/browser/browser-evidence.spec.ts tests/browser/web-results.spec.ts tests/browser/web-result-acceptance.spec.ts --grep-invert '320px|390px' --workers=1
node node_modules/vitest/vitest.mjs run apps/ui/test/browser-evidence.test.ts apps/ui/test/browser-real-case.test.ts
pnpm check:real -- browser-ops
```

## Finished P1 batch gate

The combined P1 tree at 46bebde5 passed three consecutive complete browser commands: each 505 passed, 26 skipped and zero failed (396.7 / 412.4 / 441.0 seconds). Both typechecks, production build, 1,031 units/one skip and package verification also pass. TEST-2 records the earlier failures and their corrections in PR #294; the failed commands are not counted in this streak. No browser/web runtime work or Claude History integration remains for CONTENT-2. Other-builder review and squash remain.
