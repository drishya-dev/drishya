# CONTENT-13 — recorded web results, beyond the preview

30 October 2026. Whole-task work in progress; genuine acceptance and final gate must finish before ready review.

| Before | After | Why |
|---|---|---|
| Five rows followed by an inert remainder label; Inspector renders a JSON/text preview. | The remainder opens the captured result reader; Inspector shares its list, query, recorded time and separate response text. | Opening detail should reveal the returned material, not make it harder to read. |
| The projection bounds search results to twenty and fields to short excerpts. | An authenticated, read-only, indexed operation lookup reads only the selected result's sealed observations/blobs. It returns bounded groups with whole-list filtering. | A presentation preview limit must not silently become a limit on what recorded evidence a reader can reach. |
| Claude can return several separate `Links` arrays; titles are shortened. | Complete arrays are parsed in recorded order, including duplicates, full titles, literal addresses and snippets. | No result is invented, merged away or recovered from today's web. |
| Evidence has an unexplained number. | The tab says how many relationships it counts. | That count is not a web-result count. |

## Boundaries

No contracts, reducer, adapter, History, controller or native configuration changes. The reader never follows a URL or opens a native file. Result references must belong to the selected recording, operation, agent, source and generation; the first authoritative result wins. Replay invokes the full reader only once the operation's recorded result is visible. A text-only fetch, explicit empty list, missing result and deleted sealed blob are distinct evidence states.

Tool-result suffixes are labelled captured response text, not the agent's prose or reasoning. The agent's separately recorded prose keeps its own unboxed History home. Parsing removes only complete recognized list spans; the original captured result remains one disclosure away. Original/response excerpts are bounded to 64 KiB with an explicit label; result lists are read in groups of 100, maximum 200 per API request, with filtering across the entire recorded list. Offline bundles retain their available preview and do not pretend to recover absent stored bytes.

## Validation in progress

The original running build reproduced the five-result preview and inert remainder through the existing desktop browser check. Current focused checks pass for both native formats: 160-result captures, multiple lists, full long titles/snippets, all groups, continuous keyboard filtering, exact original material, inert unsafe URLs and explicit click-only HTTP(S) navigation. Parser/store tests and both types pass. Genuine checks and adjacent-depth findings will be added before completion.
