# READ-4 passage layout finish

## 27 October PR review follow-up — hover width regression

The review correctly reproduced `product-workspace.spec.ts:71` failing for Modern on this branch while clean main passed. Full-row width exposed an existing target rule, `max(currentWidth, 520)`, that supplies no growth for an already wide card. The assertion was **not** weakened or changed.

Modern wide edits now target 8% width growth, bounded by the history viewport with an 8 px inset; other card types and retained designs keep their existing rule. Full-row resting allocation and bottom-to-top wires remain. The same real article still travels from its measured rectangle, using the existing 400/350 ms interruptible arrive/return and reduced-motion behavior. No History, measurement, timing or transport change.

| Before | After | Why |
| --- | --- | --- |
| A full-row wide Edit rested and hovered at the same width | Bounded deliberate reading width growth | Retains the approved row layout and the accepted two-dimension hover interaction |
| The row regression lacked a hover/return guard | 1024/1440 px guards assert growth, viewport containment, scrolling to the last line and restored width | A layout change must preserve the actual reading interaction |

**Verification after review:** reproduced the unchanged Modern failure before editing. Its unchanged Classic/Studio/Modern cases now pass three consecutive times each (9/9). All passage goldens/pinned reflow plus the two new width/height/bounds/return cases and hover-fit checks pass (17/17). Both TypeScript projects, build and 877 units/149 files pass on current main plus this PR. Original `product-workspace` and `workspace-toolbar` specs are unchanged; the unrelated mixed-suite toolbar flake is not claimed fixed.

Actual stationary layout acceptance was rerun on the three recorded sessions/five desktop widths below: 15 final measured frames pass. One Claude 1024 px locator detached before measurement; its single bounded retry passes. One actual Claude `c8e5c9c8` full replay bundle at 1440 px also entered hover, grew by 69.9 px, stayed bounded and returned; 10,466 observations/2,215 operations, zero page errors/external requests. The chosen earlier Codex `4b5ca5b1` replay frame declined hover on **both clean-main UI and this UI**; it is not counted as successful native hover acceptance and is outside the introduced full-row width regression. Its real layout frame remains covered by the stationary matrix. No native sessions or native files were changed.


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

Root integration gate on independent frozen worktree dependencies: 874 units / 149 files, both TypeScript projects, production build, all twelve fixed-width browser goldens and the final pinned-list/rapid-scroll browser case pass. All gates were repeated on the merged DATA-3 baseline. The actual-session run also repeated: 15/15 measured frames, identical card/wire/diff counts, zero violations or retries. Whole READ-4 checkbox and claim release are included in this PR; no unrelated task is marked complete.
