# FLOW-1 — real, visible connector endpoints

7 November 2026 · `codex/flow-1` · PR #363

## Finding

The affected owner is `FlowConnections`, the screen-space SVG joining consecutive operation cards. This is the order connector, not a claim of causality and not the Toolbox's origin animation. No hard-coded fallback corner exists in this owner; the audit's exact historical screenshot was not reconstructed.

Two current defects were reproduced: a card body could intersect History while its selected header anchor was outside the viewport; and the fixed-size History/initial-card ResizeObservers missed position-only reflow and replacement virtual cards. Paths could remain after their actual endpoint elements left the DOM. Genuine live tests also caught a 2–5 px lag while Follow moved cards between measurements.

## Behaviour

- Existing route candidates, order, arrow, stroke, color and evidence labels remain unchanged.
- A route is eligible only when both actual endpoint coordinates are inside History and the browser viewport. Invalid/empty rectangles produce no route.
- Current resident cards are observed, bounded to 64. Position changes and virtual replacement schedule fresh measurement; old observers are removed.
- Stale paths are pruned immediately. Coordinates must hold across two measurements before a route is published, so moving material keeps its own existing motion without a detached screen-space wire. Measurement remains bounded to the existing finite window and 32 ms cadence.
- No History, Origins, Toolbox, styles, tokens, Clarity or captured data changes. Presentation beyond truthful endpoints remains FINISH-6.

## Acceptance: real sessions, both harnesses

All imports used scratch Drishya homes. No real journal content, source paths or screenshots are committed. Screenshots and private source manifests stay in `.local/`. The native test turns used an existing synthetic-only throwaway repository, explicit workspace consent and idle-other-client acknowledgement. Each genuine harness ran three separate harmless echo calls. Native policy and saved settings were unchanged; no shell-interpolated prompts.

| Harness / session | Width | Journal bytes | Live connector samples | Post-scroll samples | Bad endpoints |
|---|---:|---:|---:|---:|---:|
| Codex `rec_13949e17` | 600 | 807,324 | 34 | 6 | 0 |
| Codex `rec_13949e17` | 1440 | 825,746 | 26 | 8 | 0 |
| Claude Code `rec_69977fa0` | 600 | 813,776 | 9 | 4 | 0 |
| Claude Code `rec_69977fa0` | 1440 | 860,142 | 14 | 12 | 0 |

A sample checks every drawn wire against the actual two mounted card elements and viewport, rather than counting an empty SVG as acceptance. Every row has nonzero valid connectors during live work and after deliberate scrolling.

Dense pre-fix reproduction: Codex `rec_7afaca02` (11,984,727 bytes / 156 operations), 1440 px: 66 sampled wires, 12 off-screen endpoints; Claude `rec_c8e5c9c8` (83,716,730 bytes / 2,695 operations): four stale paths at 600 and 13 at 1440 had no mounted endpoint pair. After the initial fix, Codex had 54/62 valid samples at 600/1440 with zero missing/off-screen/detached endpoints. Claude's dense traversal produced zero wires, so it was explicitly not counted as positive acceptance; the fresh live matrix above supplies that control. Earlier live runs caught remaining lag, which the final stability guard fixes.

## Regression and verification

- Four new route units cover clipped header/body intersection, a valid partial-card bottom-to-top route, normal endpoints and invalid geometry; the two clipping/invalid cases failed before the fix. Nine route units pass.
- Two browser regressions, at 600/1440, use the actual component beyond its old one-off timer: position-only movement outside the viewport, restoration, moving-card geometry and a clipped header. Both pass, including per-frame checks during motion.
- The existing passage helper now distinguishes an intersecting body from a visible anchor. Fully visible neighbors still require their original wires; every drawn wire is checked for on-screen endpoints. All wrap/order goldens remain unchanged. All 17 targeted browser cases pass after a rebuild with Edge, requested three workers, zero retries.
- `pnpm check:affected`: both project typechecks, ten related units, UI build and 17 browser cases pass. The final added moving-card assertions also pass in a separate focused run.
- `pnpm check:real -- content-parity`: read-only scan and scratch import pass for both harnesses; this verifies source availability/counts, not SVG geometry. Geometry acceptance is the live matrix above.
- Full isolated gate on `c33278a6`, with its own frozen install and three browser workers plus the existing serial pass: running; result to be recorded before readiness.
