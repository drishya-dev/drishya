# CONTENT-3 — literal captured answers and conservative selections

25 October2026, PR220. Correctness of the existing Claude AskUserQuestion display only. No new questions, inline answering, native approvals, History/layout or schema capability is added.

## Reproduced problems

Five initial regressions fail on the old parser:

- A typed sentence saying Do not use Docker. Nothing yet. marked both Docker and No chosen, because substring matching found Docker and No inside Nothing.
- Cartography, Cart lost the Cart at the start of the typed word while removing the selected option, displaying ography, Cart.
- Protocol trimming erased the person's leading quotes and trailing periods.
- A null entry in the captured question array threw instead of leaving the other valid question readable.
- A, B could mark A, B and the separate option named A, B all chosen.

Actual Drishya capture also shows a protocol variant: the quoted selected label is followed by selected preview, an offered command/example preview and a harness follow-up sentence. That material was attributed to the person as Wrote, while their actual option was unmarked. The new boundary is recognized only when the answer prefix matches an offered label; arbitrary preview wording inside a typed answer remains literal. The full captured result remains in expanded details.

## Fix

Skip non-object question entries, retain existing question/option bounds, and remove only the protocol's terminal quote/separator rather than stripping arbitrary punctuation. Multi-select matches require complete comma-separated tokens, not substrings. Remove matched tokens as whole tokens so typed words cannot be damaged. Repeated or comma-bearing labels that cannot be identified safely remain literal answer text rather than invented selection marks. Single-choice exact matches still work; question options/descriptions and native pending behavior are unchanged.

| Before | After | Why |
|---|---|---|
| Typed prose could select an option by substring | Complete-label matches only | The person did not select a word just because it occurred in their sentence |
| Removing an option damaged a larger word | Remove only matched whole tokens | Preserve the literal typed answer |
| Quotes/periods stripped with protocol punctuation | Only outer framing removed | Captured words retain their punctuation |
| Offered preview displayed as person's words | Known selected-preview boundary excluded from answer | Harness/option metadata is not user speech; raw result remains available |
| Null question crashed the card | Invalid entry skipped; valid neighbors rendered | Malformed captured data must not blank the session |

## Verification

-12 question-parser units (five retained plus seven guards); five initial new cases reproduced on baseline. Additional guards cover the real selected-preview variant and preview wording inside typed prose.
-Three browser checks: retained actual-shaped question fixture plus1440px/390px journeys with malformed input, typed sentences, real selection plus typed words, punctuation, ambiguous labels and selected-preview metadata.
-An isolated actual Drishya Claude import contains512 observations and one answered question. Before: no option selected, preview/follow-up attributed as typed. After: the correct offered label is selected, no invented typed answer; actual card verified at1440px and390px, phone frame inspected. Native journal remains read-only; real text/images/frames are not committed.
-Both project TypeScript checks and production build pass. 795 integrated units pass. No hosted CI, dependency, native turn or harness settings change.

## Remaining scope and gate

CONTENT-3 stays open for historical/pending/answered Codex sources, exact command/diff approval cards and supported connected inline answering. This helper does not claim an unverified protocol or option identity; ambiguous textual representations remain literal with the original result reachable. The typed answer display continues its existing whitespace normalization.

The builder-paused History/PERF-2 area is untouched. Main's known TEST-2 reading-position regression still prevents a clean whole-browser merge gate; focused review is ready, but do not auto-merge through it. DATA-3 and other active file claims are preserved.
