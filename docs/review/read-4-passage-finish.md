# READ-4 passage layout finish

27 October 2026 · PR #260 · Modern running application · desktop only

## Before | After | Why

| Before | After | Why |
| --- | --- | --- |
| A wide Edit could start between compact cards at 1920 px. | `.op-edit.shape-wide` receives a full flex row in the active Modern reading-window layer. | Wide patches now start a row deterministically; the preceding compact row still packs normally. Full-row allocation avoids a new wrapper or History measurement change. |
| Vertically separated cards tried the shared left gutter before the free vertical gap, producing a bracket down a stack. | Collision-checked bottom-to-top routing is tried first; obstructed cases retain existing side-gutter fallbacks. | Each stack pair has its own directional relationship, while taller neighbouring cards remain protected. |
| Existing goldens described the old choices. | Shared geometry assertions enforce wide-row starts and bottom/top stacked edges, alongside existing greedy packing, exact row shapes, edge endpoints, consecutive-pair coverage and no card crossings. | Tests fail for the observed old behavior rather than merely accepting a new screenshot. |

The running production build was reviewed before editing. Its fixture screenshot showed the wide patch between compact cards. Before repair, the stacked route unit failed with the old left-bracket path; browser checks failed for stacked pairs at 1024 and wide starts at 1920. The active Modern specificity override was used; shared stage CSS is unchanged. Only the stress passage's 1920 row golden changed, from `3/3/4/2` to `1/1/4/4/1/1`.

## Whole criterion matrix

| READ-4 requirement | Evidence | Result |
| --- | --- | --- |
| Keep actions left to right, wrapping when space runs out | Exact visual-row goldens for Claude, Codex and mixed stress passage at 1024/1280/1440/1920 | Pass |
| Wide diffs start a row | Every mounted wide Edit checked as first card of its row; two wide stress patches plus 11 actual visible instances | Pass |
| No tiny orphan when it fits the preceding row | Geometry checks compare preceding row's remaining space with next first card, except an intentional wide-row break | Pass |
| Exit edge to entry edge; unambiguous row order | Edge endpoint, same-row direction, row-major position and bottom/top stacked-edge assertions | Pass |
| No arrow crosses a card; every consecutive visible pair connected | 12 golden frames, pinned-plan fixture, 15 actual frames; geometry checks all mounted card interiors and visible pair coverage | Pass |
| Required golden widths | 12/12 cases, four required widths × three recordings | Pass |
| Three actual sessions, both harnesses | Counts-only inventory below, five supported widths each | Pass |
| Pinned-plan expansion / rapid scroll concern | Synthetic 12-item captured checklist, expand after finite arrival observer expires, check geometry, rapidly scroll history end→start, check geometry and pinned-list intersections | Pass for this bounded reproduction; original reported transient not reproduced |
| Preserve reading and motion | No font, hover, arrival, motion timing, History, anchoring, measurement or card reader changes | Pass |

## Actual evidence

Read-only native evidence had already been redacted into a private Drishya store; this run used that private store only. Session prefixes, sizes and counts are the only recorded native details. Screenshots and operation IDs remain ignored under `.local/`.

| Session prefix | Harness | Observations | Operations | Widths | Measured frames |
| --- | --- | ---: | ---: | --- | ---: |
| `4b5ca5b1` | Codex | 1,530 | 542 | 600/1024/1280/1440/1920 | 5 |
| `c8e5c9c8` | Claude Code | 10,466 | 2,215 | 600/1024/1280/1440/1920 | 5 |
| `024517cd` | Claude Code | 2,112 | 426 | 600/1024/1280/1440/1920 | 5 |

Selected actual passages contain multiple actions and prioritize captured edit evidence. Across the 15 frames: 46 visible card instances, 31 wires and 11 wide Edit instances; zero card crossings, missing visible-pair wires, edge/order violations, page errors or external requests. The large Claude 1024 frame initially detached while paged cards mounted, before geometry measurement; a bounded locator retry measured it successfully. It is not counted as an initial geometry pass. These are selected passage checks, not a claim to exhaust every operation or every scrolling frame in each recording. Actual pinned-plan content was not asserted; the pinned-list case is synthetic.

## Verification and design review

- Own frozen workspace dependencies; no cross-checkout `node_modules` sharing.
- Own production UI build passes; baseline and changed running bundles inspected.
- `pnpm exec vitest run apps/ui/test/flow-route.test.ts`: 5/5.
- `pnpm --filter @drishya/ui typecheck`: passes.
- `DRISHYA_BROWSER_CHANNEL=msedge pnpm exec playwright test tests/browser/passage-layout.spec.ts`: 13/13, including the 12 width goldens and pinned-list reflow/scroll check.
- Three actual recordings: 15/15 measured frames; counts above.
- Emil composition review: wide material gets a calm dedicated row; compact content retains existing allocation; sequence remains row-major.
- Motion review: approve. This changes static allocation and route preference only. Existing finite arrivals, hover reading, bounded connector scheduling, reduced motion and interruption behavior remain unchanged.

No held History/scroll file was edited. No new measurement fix or blocker was needed for the bounded pinned-list reproduction. Root owns the shared TASKS/STATUS completion update.
