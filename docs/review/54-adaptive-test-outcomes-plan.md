# Adaptive test outcomes and full UI craft audit

12 October 2026 builder addition. Planned implementation; current sample rendering is not evidence of real-world runner coverage. Complements [52](52-composer-interactions-recordings-plan.md) and the exhaustive review in 50. Keep changes in separately verified commits and use installed UI/motion skills.

## Concrete captured failure to address

The builder supplied an outer `Shell · exec` operation containing a `functions.exec` orchestration script, then a JSON-encoded tool result whose `output` contains Vitest output: individual suite lines, warnings, truncation markers and final **Test Files 46 passed (46)** / **Tests 324 passed (324)**. A second result is a TypeScript command with empty output. The visualization must identify the supported nested Vitest facts without treating TypeScript success, warnings or the outer command's exit code as additional test results. The fixture must be synthetic/redacted; never commit this private captured transcript or filesystem paths.

## Implementation acceptance

- Inspect existing adapter/tool-wrapper extraction, projection classification and test-summary renderer before choosing the seam. Derive bounded result facts from captured output with explicit parser provenance; do not turn an arbitrary orchestration script into a single invented test execution.
- Support multiple supported runner summaries independently. Keep child output/result identity when available and label separate checks; do not silently add duplicate suite/test summaries or conflate concurrent child runs. A mixed tool can stay Shell while surfacing recognized test outcome material inside it if that preserves truthful classification.
- Handle supported Vitest/Jest, Node TAP, pytest and other repository-relevant patterns through explicit fixtures. Normalize ANSI/control sequences for parsing without replacing raw stored/displayed output. Keep runner/test/suite counts separate and represent passed/failed/skipped/cancelled/unknown when actually reported.
- Render the builder's discrete outcome tiles/bars adaptively: grouped counts when totals alone are available; actual ordered runner cases only when names/index/order are exposed. Large counts use bounded rendering and truthful grouping, not hundreds of unbounded DOM elements. Never invent which numbered test failed.
- Truncated/partial output, warnings, contradictory summaries, progress-only output, no totals and ambiguous patterns retain readable captured output plus any verified partial facts. Arbitrary output cannot be universally parsed; expanding coverage needs fixtures and regression checks.
- Check live pending→result, replay cutoff, wrapped multiple outputs, same runner repeated, non-test zero exit codes, failure messages, long names and narrow screens. Raw output remains inspectable/selectable regardless of visualization.

## Whole-product polish requirement

After functional increments, perform the line-by-line all-page/component craft sweep specified in 52. Include click/press, hover, selection, keyboard focus, menu placement/dismissal, dimensions, bounds, typography, icons, material states and meaningful interruptible motion. Apply relevant design and motion skills; keyboard/reduced-motion paths must remain immediate. A pleasing demo or a few screenshot checks cannot substitute for reviewing actual session output and every product surface.
