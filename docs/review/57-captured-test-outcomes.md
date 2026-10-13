# Adaptive captured test outcomes

13 October 2026. Implements a bounded presentation increment from review 54.

| Before | After | Why |
| --- | --- | --- |
| Supported JSON-wrapped runner output stays an opaque shell preview | Outcome counts within the original Shell material, expansion and Inspector | Mixed commands keep their real identity while useful facts become visible |
| One runner summary | Up to eight separate supported output summaries | Do not add independent or repeated executions together |
| Suite counts can be mistaken for test counts | Separate literal suite summary and parsed test counters | Never manufacture tests from suite totals |
| Huge counts risk huge materials | At most 32 grouped tiles per reported state, full numeric counts | Bounded DOM; no invented test indices |
| Unsupported/partial/contradictory patterns | Raw output and explicit parser limits/qualification | Recognisable evidence only; no success inferred from exit codes |

Supports complete Vitest/Jest totals, pytest categories, Cargo result counters and Node TAP totals in direct output or supported JSON result envelopes. Cancelled, errors, unknown, deselected and expected/unexpected failures remain distinct. Complete flat TAP cases retain real indices through the existing strict tile rule; nested/partial TAP uses grouped totals. Raw captured output stays selectable through preview/expansion/Inspector.

Named `runner-summary-v1` is a presentation derivation over already-redacted captured previews. No adapter/reducer/schema/API change, no wrapper evaluation, no operation reclassification, no effect on test verification/coverage claims. Results are absent before the existing as-of result boundary. Limits: 128 KiB raw input, 64 KiB per extracted child, eight child outputs/summaries, depth six and 256 visited values. This does not promise parsing every runner or recovering summaries beyond stored preview cuts. Unsupported direct runners retain the existing summary/rendering fallback.

Local unit/browser checks cover the builder's synthetic mixed wrapped Vitest/typecheck example, multiple runner outputs, ANSI, warnings, contradictory/partial summaries, six-figure counts, raw expansion and 390 px geometry. Existing failure assertion navigation passes. Complete candidate verification follows in STATUS; real-account/platform acceptance remains separate.
