# TURN-3 — evidence-bearing prompt rail

20 October 2026 · PR #147. Encoding implemented; TASKS keeps the discovered chapter-coverage follow-up open.

| Before | After | Why |
|---|---|---|
| Equal tick sizes depend only on pointer proximity | Captured operation count sets a linear4–20px base, with the existing proximity lift | Larger turns are recognizable without expanding the canvas |
| No outcome marks on the rail | Red notch for captured operation/test failures, edited dot from the existing patch ledger | See significant turns without opening every chapter |
| Hover/focus shows only prompt/time | Adds captured operation total and the existing full-turn ledger, including pending-result count | Reading uses the same accounting as turn headers |
| Hover can be the only bright mark | Independent reading-position point and retained aria-current | Pointer exploration does not erase the reading position |

Chapter `turnStep` joins the existing `useTurns` store. Paged captures use the whole-recording turn ledger, not counts from the resident material window. Missing ledger has neutral size and no invented counters/statuses. The marker transform and existing finite proximity transition are reused; no text animation, extra request, shared layout change or schema mutation. Hover/focus preview is bounded to the viewport and uses the existing ledger provenance explanation. Selection/navigation and the bottom-anchored independent rail are unchanged.

## Local verification

- Running actual Drishya Codex rail inspected before changes and after. Then actual Drishya Codex, Skeletongraph Codex and Skeletongraph Claude displayed marks were compared to their `/turns` response: operation counts and failure/edit marks match exactly. Verified38,48 and48 currently mounted marks respectively, using full ledgers with41,48 and287 entries. A mounted count is not a claim that the whole virtualized rail is in the DOM.
- Two new browser journeys:75 completed synthetic prompt chapters; captured2/12/80-operation turns, command failure, actual captured Write patch, varying mark sizes, exact ledger preview, keyboard first/last, virtualized rows,1440/390/320px preview containment.
- Two existing prompt-timeline regressions pass: bottom anchor, independent rail scrolling, main scrollbar placement, short and narrow layouts.
- Eight focused tests pass: three mark helpers plus five existing turn-ledger tests. UI typecheck and production build pass. Local screenshots inspected; no hosted CI or native prompt execution.

## Unfinished coverage discovered during acceptance

The Drishya capture has41 turn ledgers but38 materialized prompt chapters; three ledgers have zero operations. Existing scene chapter generation supplies the rail. This increment does not manufacture labels or silently claim those turns are addressable. TASKS TURN-3 remains open with a specific coverage follow-up: audit the missing steps and the prompt/scene mapping, including user-only, empty and captionless turns. The75-turn fixture uses recorded assistant responses for otherwise tool-free turns; it is not a substitute for that audit. An initial fixture made consecutive user-only messages and correctly failed the assumption that all75 produced passages; the fixture was corrected rather than changing capture outside this claim.

Old Skeletongraph native-journal ENOENT remains pre-existing, and imported evidence still reads. This is not signed-in native, physical-device, full-theme or broad ten-minute acceptance. Existing map, agent material, replay and follow behavior are retained.
