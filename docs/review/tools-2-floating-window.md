# TOOLS-2 — centred floating Toolbox

Draft [PR #349](https://github.com/drishya-dev/drishya/pull/349), branch `codex/tools-2`, claim `895fde2`. Updated 7 November 2026. Implementation and targeted checks are verified; the genuine-session matrix is in progress and the finished-task full gate has not started. **TOOLS-2 remains open.** Harsh subsequently authorized agent-run tests/builds/acceptance, superseding the original user-run-only plan. UI-26 is paused with Yash and is not part of this batch.

## Behavior and ownership

The dock retains its instruments and evidence-backed origins. Its heading, an MCP server, Agents, Run tools or the recorded inventory opens a closable, modeless native-popover reader at the stage centre, below the header and above the composer and its raised controls. History remains visible around it. Stable portal hosts move the single existing material between dock and reader; inventories, query/filter state, provenance and tool-trail data remain owned by their existing shared components. Legacy ToolList defaults are preserved. Modern distinguishes Run tools, Available tools · recorded and Tools used · recorded.

Pointer entry/return uses transform and opacity, the shared MOTION-1 curve and 160/120 ms durations. Reversal starts from the current visual rectangle. Keyboard opening is immediate; reduced motion and low resource use the existing immediate/fade fallback. Session change, removed origins, inert/unavailable viewers and navigation to Workspace, map or file peek dismiss the reader. Narrow-window dock hiding preserves it through resize. Geometry/resource changes and hidden pages cancel or settle motion. Closing restores the same material and appropriate origin focus; deliberate navigation keeps its new focus.

Allocation measures layout, excluding the composer's temporary scale, and reserves raised approval/queue/options controls even when hover-quiet. Integer offset metrics leave one CSS pixel of rounding clearance so fractional native layouts retain the full reserved gap. Long names wrap in bounded local scrollers. There are no new inventory APIs, dependencies, schema/controller changes or captured-text copies.

## Scope and review

Harsh approved **17 files** on 7 November: the original 13 authored paths, palette-contrast and plan-living-acceptance updates, and coordinator STATUS/TASKS. Dedicated component CSS remains separate; shared styles and other claims' components are unchanged. Main `7a84b02baf4c60ad73024e79f1e0c87cee822134` is integrated, including TEST-2, HOME-3 and CONNECT-2. No direct path conflicts.

Independent review identified unavailable-owner dismissal gaps. Workspace, responsive resize and pointer-free file navigation now have focused coverage. The latter failed at both widths before its fix and passed afterward. No other confirmed source blocker was reported. Native screenshots and diagnostics stay in `.local/`, never committed or published.

Applied the installed [Emil design skill](C:/Users/Harsh%20Jain/.codex/skills/emil-design-eng/SKILL.md), official source pinned at `c8a79627b59d72d764d6ab6f2c87c09a48169833`.

| Before | After | Why |
| --- | --- | --- |
| Expanded groups compete with history at the dock edge | A content-sized central reader | Give material readable space while retaining history |
| A disclosure expands in a narrow dock | The same material lifts from its actual summary | Explain origin and preserve selectable content/state |
| Runtime and recorded inventories share a label | Run tools and separately labelled recorded lists | State which evidence supplied each list |
| Long names truncate | Wrapping and bounded local scrolling | Keep complete names reachable at 600 px |
| Composer transforms and fractional metrics can distort clearance | Layout-based raised-control bounds with rounding headroom | Preserve the real reading and interaction area |
| A sibling top-layer reader can outlive the hidden dock | Explicit owner-navigation dismissal; resize remains supported | Preserve view ownership and Escape/focus behavior |

## Verification so far

All commands use this isolated worktree's own frozen install. Retries are zero; no timeout increases, new skips or relaxed content/geometry/contrast assertions.

- Both project typechecks, 6 geometry units and the UI build passed after main integration.
- Initial named suite: 25/25 at 3 workers; affected fresh-Workspace cases: 3/3 at 1 worker.
- Integrated Toolbox/inventory/trail/composer suite: 32/32 at 3 workers, including the new fractional-boundary regression.
- Final owner fix: 26/26 Toolbox/composer cases, 2 actual workers (3 requested; two spec files).
- Updated existing palette/persistence cases: 3/3 at 2 workers. Contrast remains 4.5:1 across all seven palettes; plan content, expansion, replay, reload and keyboard assertions remain.
- `check:affected --dry` correctly selects both types, related units and the full browser suite because component CSS changed. Its full-browser selection is deferred to the single finished-task gate.
- `check:real -- tools-available --pick 2`: Claude 44 qualifying sessions / 278 list rows; Codex 111 / 122. Two imports per harness passed exact list/trail checks (Claude 248/250 listed tools; Codex 13/14; forward/backward trails 2211/381 and 729/128 uses).

Private named receipts: `.local/tools-2/named-final-check.json`, `fresh-final-check.json`, `integrated-named-check.json`, `review-fixed-check.json`, `legacy-reader-fixed.json`. Native matrix receipts/frames: `.local/tools-2/real-screens/`.

### Genuine cases (counts verified; final screen matrix in progress)

| Harness / session prefix | Native bytes | Observations | Operations | Agents | MCP operations | Inventory / listed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Claude `43745e02` | 5,007,911 | 3,908 | 790 | 12 | 10 | 250 / 250 |
| Codex `01a17b65` | 15,795,654 uncompressed; 4,885,516 compressed | 5,465 | 1,308 | 3 | 13 | 22 / 14 |
| Codex `01a15a18` | 18,288,301 uncompressed; 6,947,841 compressed | 5,687 | 1,253 | 1 | 30 | 75 / 71 |

The second Codex case checks the long inventory; sub-agent acceptance belongs to the first. Existing genuine Claude capture avoids requiring a new signed-in account. Sources remain read-only; imports use scratch Drishya homes. No real journal content is printed.

## Failures retained and resolved

1. First named run: 8 passes / 7 observed failures before interruption. Direct normalized fixture calls omitted intent, so the reducer correctly treated them as other-kind operations. Added actual read/MCP intent and exact projection-count preconditions.
2. The private/input checks then exposed an empty header's intentional pointer passthrough and a pre-mount visibility probe. Used a real outside gutter and waited for the recording Viewer before selecting wide/narrow controls. Assertions remain.
3. A diagnostic run had 4 passes / 1 failure / 12 unrun: responsive dock hiding dismissed the reader. Fixed owner navigation independently from viewport hiding; unchanged motion/resize and four Workspace cases passed (5/5).
4. Native screen diagnostics first omitted raised-control clearance in the helper. Correcting that measurement exposed a real fractional-metric gap: the regression failed at 672 versus 671.75 px before rounding clearance, then passed.
5. Final review's file-peek case failed at both widths before owner dismissal was fixed, then passed with material identity intact.
6. Two older specs still queried expanded content inside the dock / asserted its former disclosure state. Their diagnosed red run had 2 failures / 1 unrun under fail-fast. Approved updates follow the central reader and preserve contrast, content and persistence requirements; all 3 passed.
7. Private genuine-helper setup failures are retained: daemon reading memory required its supported reset (and JSON content type); motion preferences must enable motion; already-open disclosure attributes are empty strings; only relevant finite API loads gate Toolbox readiness (Home storage statistics remain independent). A trace also showed motion cancelling on a layout mutation; real motion is checked separately before tool-filter/trail selection. No product assertions were removed.

## Remaining gates

Finish and inspect the 600/1440 genuine matrix, then run the single frozen finished-task full gate (both types, all units, UI build, full parallel/serial browser command, package verification). Record actual worker count and every failure. Yash's separately claimed MOTION-3 must include the final Toolbox in its ten-minute live/replay evaluation. Other-builder review is required before merge; no merge is authorized by an agent's source review.