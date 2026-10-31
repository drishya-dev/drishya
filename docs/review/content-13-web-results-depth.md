# CONTENT-13 — recorded web results, beyond the preview

Started 30 October; genuine acceptance completed 31 October 2026. Final isolated gate is recorded below before ready review.

| Before | After | Why |
|---|---|---|
| Five rows followed by an inert remainder label; Inspector renders a JSON/text preview. | The remainder opens the captured result reader; Inspector shares its list, query, recorded time and separate response text. | Opening detail should reveal the returned material, not make it harder to read. |
| The projection bounds search results to twenty and fields to short excerpts. | An authenticated, read-only, indexed operation lookup reads only the selected result's sealed observations/blobs. It returns bounded groups with whole-list filtering. | A presentation preview limit must not silently become a limit on what recorded evidence a reader can reach. |
| Claude can return several separate `Links` arrays; titles are shortened. | Complete arrays are parsed in recorded order, including duplicates, full titles, literal addresses and snippets. | No result is invented, merged away or recovered from today's web. |
| Evidence has an unexplained number. | The tab says how many relationships it counts. | That count is not a web-result count. |

## Boundaries

No contracts, reducer, adapter, History, controller or native configuration changes. The reader never follows a URL or opens a native file. Result references must belong to the selected recording, operation, agent, source and generation; the first authoritative result wins. Replay invokes the full reader only once the operation's recorded result is visible. A text-only fetch, explicit empty list, missing result and deleted sealed blob are distinct evidence states.

Tool-result suffixes are labelled captured response text, not the agent's prose or reasoning. The agent's separately recorded prose keeps its own unboxed History home. Parsing removes only complete recognized list spans; the original captured result remains one disclosure away. Original/response excerpts are bounded to 64 KiB with an explicit label; result lists are read in groups of 100, maximum 200 per API request, with filtering across the entire recorded list. Offline bundles retain their available preview and do not pretend to recover absent stored bytes.

## Genuine acceptance

The original running build reproduced the five-result preview and inert remainder through the existing desktop browser check. Fourteen focused browser checks pass: both native formats, 160-result captures, multiple lists, full long titles/snippets, all groups, continuous keyboard filtering, exact original bytes, inert unsafe URLs and explicit click-only HTTP(S) navigation. They also exercise a failed read while retaining the filter, recovery, authentication, malformed/bounded requests and seeking the same held Inspector before and after its result. The original text now uses a literal text node: the normal output formatter adds a display newline and therefore cannot own an exact original.

Seventeen parser/store checks pass, including 10,000 unclosed list starts (linear scan, unchanged original), first-result identity, sealed-blob ownership and deletion, UTF-8 limits and complete arrays. Both typechecks pass. The existing `check:real browser-ops` scanner passes both harnesses with a 20 MB cap: Claude `64d5c199`, 202 native browser/web records, 196 web operations; Codex `a012336b`, 13 native browser/web records and 13 web operations. This inventory is separate from the UI acceptance below.

Five genuine source recordings supply seven cases, checked in History and replay at 600 and 1440 px: **28 accepted journeys**, zero page errors or external requests. Each list's rendered count and literal titles/addresses agree with the sealed result, and its final row is reachable and keyboard-focusable. Original text agrees exactly; no current page is fetched. Redacted source stores were copied with SQLite backup into private scratch homes; native sources and the real Drishya home were unchanged. Screenshots and diagnostics remain private in `.local/`.

| Prefix / harness | Source bytes | Observations | Cases / frames | Recorded list counts | Longest title checked |
|---|---:|---:|---|---|---:|
| `c8e5c9c8` / Claude Code | 82,859,509 | 10,466 | Three-list search / 4 | 28 | 96 characters |
| `4b5ca5b1` / Codex | 44,016,822 | 1,530 | Long-title search / 4 | 27 | 705 characters |
| `64d5c199` / Claude Code | 13,211,006 | 2,288 | Long-title search, text-only fetch, failed fetch / 12 | 8, 0, 0 | 394 characters |
| `a012336b` / Codex | 8,291,460 | 1,466 | Explicit empty-list search / 4 | 0 | — |
| `08d31045` / Codex | 27,919,575 | 1,870 | Beyond-cap search / 4 | 29 | 100 characters |

The Codex empty-list item has an unknown outcome and no captured output text; query metadata is not presented as a captured page or a success. No successful text-only search was found in the selected native corpus; the required no-list case is the genuine explicit empty search, with genuine text-only fetches checked separately. The largest selected native lists contain 28/29 entries; the 160-result regression exercises multiple API groups. No larger native-list acceptance is invented.

## Adjacent depth review

| View | Checked | Finding |
|---|---|---|
| Page fetch | Genuine text-only and failed Claude captures, both widths and modes | Shares the reader, captured metadata, honest absence and literal original. No extra inferred summary. |
| MCP result | Genuine Codex `4b5ca5b1`, 600/1440 px, source plus current Inspector | 47,962 stored characters, 4,000 shown. An output artifact exists, but expanded MCP material and Inspector still use only `resultPreview`. Added whole follow-up CONTENT-14; History remains Harsh's CONTENT-12 lane. |
| Repository search | Genuine Claude `c8e5c9c8`, 600/1440 px | All 61 recorded hits are present and the final Inspector hit is reachable. The short form is bounded at 50 and directs reading to details. No further data loss demonstrated in this sample; broader navigation/default-state review belongs to AUDIT-1/UI-17. |

This is the requested adjacent-view depth check, not the whole-product audit. Captured tool-response text is not attributed to the agent. Unsupported or incomplete list syntax remains literal instead of being reconstructed heuristically.

## Final integration

Frozen source `264b40ae`, isolated checkout with its own frozen install: both typechecks, UI build, package verification and **1,081 units / one skip** pass. The full browser command reports **573 passed, 28 skipped, two failed** (parallel 540/27/two; serial 33/one/zero). This is not a full-green browser claim.

Both failures reproduce on rebuilt clean main `712e0b53`, without this feature:

- `fresh-workspace.spec.ts:1033`, desktop step at line 1050: expected CodeMirror scrollTop 250, received 11. The full clean-main file gives 73 passed / one failed with the same predicate.
- `prompt-rail-evidence.spec.ts:33`, 1440 px step at line 38: the ordinal-one mark is absent after Home instead of focused. Clean-main repeated check gives eight passed / two failed.

The unchanged pair passes alone on this branch (two passed). A subsequent traced clean-main repeated check passes 20/20, so no failure trace is retained; no causal claim is made from the changed timing. These are recorded under reopened TEST-2; neither the production cause nor a test repair is claimed here. No timeout, focus/position assertion or other-owner source was changed. The existing web-title assertion was intentionally strengthened from the 200-character projection excerpt to the full literal title, and its narrow cases now use the supported 600 px minimum.

The earlier validation attempt was deliberately stopped after the malformed-list guard was added; it is not counted as a completed or green gate. Real-session screenshots stay private; synthetic 600/1440 frames were inspected for layout. No hosted CI was requested. Native lifecycle, physical/platform and human preference acceptance remain separate.
