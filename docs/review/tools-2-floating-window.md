# TOOLS-2 — centred floating Toolbox

[PR #349](https://github.com/drishya-dev/drishya/pull/349), branch `codex/tools-2`, claim `895fde2`. Updated 7 November 2026. Implementation, fixture acceptance, genuine Claude/Codex readers and the genuine Codex connected-turn names are verified. All required check types pass on frozen runtime source `7bd9ea87e5d0429eb4f2140f1fc76c63be237ac7` with **3 unit workers, 3 parallel browser workers and 1 serial browser worker**. The original 4-unit-worker gate remains failed and preserved; see the exact results below. **TOOLS-2 stays open/claimed for Yash's external acceptance**, not further source work. UI-26 remains paused with Yash.

Harsh authorized agent-run tests/builds/acceptance, superseding the original user-run-only plan. Current main's later changes were documentation-only and were merged without changing any tested runtime file.

## Behavior and ownership

The dock retains its instruments and evidence-backed origins. Its heading, an MCP server, Agents, Run tools or the recorded inventory opens a closable, modeless native-popover reader at the stage centre, below the header and above the composer and its raised controls. History remains visible around it. Stable portal hosts move the single existing material between dock and reader; inventories, query/filter state, provenance and tool-trail data remain owned by their existing shared components. Legacy ToolList defaults are preserved. Modern distinguishes Run tools, Available tools · recorded and Tools used · recorded.

Pointer entry/return uses transform and opacity, the shared MOTION-1 curve and 160/120 ms durations. Reversal starts from the current visual rectangle. Keyboard opening is immediate; reduced motion and low resource use the existing immediate/fade fallback. Session change, removed origins, inert/unavailable viewers and navigation to Workspace, map or file peek dismiss the reader. Narrow-window dock hiding preserves it through resize. Geometry/resource changes and hidden pages cancel or settle motion. Closing restores the same material and appropriate origin focus; deliberate navigation keeps its new focus.

Allocation measures layout, excluding the composer's temporary scale, and reserves raised approval/queue/options controls even when hover-quiet. Integer offset metrics leave one CSS pixel of rounding clearance so fractional native layouts retain the full reserved gap. Long names wrap in bounded local scrollers. There are no new inventory APIs, dependencies, schema/controller changes or captured-text copies.

## Scope and review

Harsh approved **17 files** for this whole task: the original 13 authored paths, palette-contrast and plan-living-acceptance updates, and coordinator STATUS/TASKS. Dedicated component CSS remains separate; shared styles and other claims' components are unchanged. Main `7a84b02baf4c60ad73024e79f1e0c87cee822134` is integrated, including TEST-2, HOME-3 and CONNECT-2. No direct path conflicts.

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

## Targeted verification

All commands use this isolated worktree's own frozen install. Retries are zero; no timeout increases, new skips or relaxed content/geometry/contrast assertions.

- Both project typechecks, 6 geometry units and the UI build passed after main integration.
- Initial named suite: 25/25 at 3 workers; affected fresh-Workspace cases: 3/3 at 1 worker.
- Integrated Toolbox/inventory/trail/composer suite: 32/32 at 3 workers, including the new fractional-boundary regression.
- Final owner fix: 26/26 Toolbox/composer cases, 2 actual workers (3 requested; two spec files).
- Updated existing palette/persistence cases: 3/3 at 2 workers. Contrast remains 4.5:1 across all seven palettes; plan content, expansion, replay, reload and keyboard assertions remain.
- `check:affected --dry` correctly selects both types, related units and the full browser suite because component CSS changed. Its full-browser selection is deferred to the single finished-task gate.
- `check:real -- tools-available --pick 2`: Claude 44 qualifying sessions / 278 list rows; Codex 111 / 122. Two imports per harness passed exact list/trail checks (Claude 248/250 listed tools; Codex 13/14; forward/backward trails 2211/381 and 729/128 uses).

Private named receipts: `.local/tools-2/named-final-check.json`, `fresh-final-check.json`, `integrated-named-check.json`, `review-fixed-check.json`, `legacy-reader-fixed.json`. Native matrix receipts/frames: `.local/tools-2/real-screens/`.

### Genuine cases — final 600/1440 screens and checks passed

| Harness / session prefix | Native bytes | Observations | Operations | Agents | MCP operations | Inventory / listed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Claude `43745e02` | 5,007,911 | 3,908 | 790 | 12 | 10 | 250 / 250 |
| Codex `01a17b65` | 15,795,654 uncompressed; 4,885,516 compressed | 5,465 | 1,308 | 3 | 13 | 22 / 14 |
| Codex `01a15a18` | 18,288,301 uncompressed; 6,947,841 compressed | 5,687 | 1,253 | 1 | 30 | 75 / 71 |

The second Codex case checks the long inventory; sub-agent acceptance belongs to the first. Existing genuine Claude capture avoids requiring a new signed-in account. Sources remain read-only; imports use scratch Drishya homes. No real journal content is printed.


All six reader cases passed with exact inventory/agent/server counts, safe centring, no horizontal clipping, local scroll reachability, returned focus, all four trail controls and measured real-origin/same-material reversal. Private frames were inspected. Claude's selected trail had 287 uses; Codex's combined case 600; its long-list companion 574. Final receipt: `.local/tools-2/real-screens/complete-receipt.json`.

A further **genuine Codex connected turn** passed at 600/1440: native session `01a1b0f9`, 304,395 bytes, 73 observed records / 14 operations, **73 actual runtime tools**. Run tools and the separately labelled recorded inventory were visible together; both native frames were inspected. The selected stopped throwaway session was resumed through Drishya's normal UI, including workspace consent and the idle-other-clients acknowledgement. It read the synthetic file, waited ten seconds and completed; the existing tracked patch stayed byte-identical. No native policy/settings/credential override or direct journal write was used. Private receipt/frames: `.local/tools-2/runtime-naming/`. A new Claude connected turn could not be run because its CLI is signed out; Harsh explicitly left that account-dependent case to Yash. The Claude runtime-list shape/naming has fixture coverage, not a new genuine connected-turn claim.

## Finished-task check record

Frozen runtime candidate `7bd9ea87e5d0429eb4f2140f1fc76c63be237ac7`, own isolated install, zero retries. Browser selection is exactly the parallel/serial split of `scripts/test-browser.ts`; the passes were invoked separately solely to preserve distinct JSON and traces. The original results are never overwritten by later measurements.

| Check | Workers | Result |
| --- | ---: | --- |
| Both project typechecks | — | Pass |
| Original all-unit run | 4 | **1,210 passed / 2 timed out / 1 existing skip** |
| UI build | — | Pass |
| Complete parallel browsers | 3 | **650 passed / 27 existing skips / 0 failures**, 784.92 s |
| Complete serial browsers | 1 | **33 passed / 1 existing skip / 0 failures**, 123.10 s |
| Package verification | — | Pass: isolated offline install, both harness imports, demo, authenticated API, persisted restart |
| Clean-main all units at `7a84b02` | 4 | **1,206 passed / 1 existing skip** |
| Clean-main history file alone | 1 actual file worker | **11 passed** |
| Candidate history file alone | 1 actual file worker | **11 passed** |
| Additional candidate all-unit configuration | 3 | **1,212 passed / 1 existing skip**, 64.03 s |

The original failures were the unchanged daemon history tests for bounded historical material and append/out-of-order parity, each at the original 5,000 ms limit. Their backend/test/configuration source matches main. They did **not** reproduce on clean main, so they are not labelled a proven main flake. Their exact original cause remains unproven; no assertion or timeout was changed. This establishes the measured three-worker configuration only, not a clean four-worker candidate gate or a new three-run TEST-2 streak.

Raw record: `.local/tools-2/full-gate-20261107-041305/`, including `results.json`, separate browser JSON/traces, original unit log, `candidate-history-isolated.log`, `candidate-units-3.log` and `unit-configuration-measurement.json`. Clean-main comparison: the existing paused UI-26 checkout's private `.local/tools2-main-diagnostic/`; its original `codex/ui-26` branch and exact `ab00b1d` head were restored afterward. No new worktree was created; the managed creation request did not return and was stopped before reusing that clean checkout.
## Observed failures and what changed

1. First named run: 8 passes / 7 observed failures before interruption. Direct normalized fixture calls omitted intent, so the reducer correctly treated them as other-kind operations. Added actual read/MCP intent and exact projection-count preconditions.
2. The private/input checks then exposed an empty header's intentional pointer passthrough and a pre-mount visibility probe. Used a real outside gutter and waited for the recording Viewer before selecting wide/narrow controls. Assertions remain.
3. A diagnostic run had 4 passes / 1 failure / 12 unrun: responsive dock hiding dismissed the reader. Fixed owner navigation independently from viewport hiding; unchanged motion/resize and four Workspace cases passed (5/5).
4. Native screen diagnostics first omitted raised-control clearance in the helper. Correcting that measurement exposed a real fractional-metric gap: the regression failed at 672 versus 671.75 px before rounding clearance, then passed.
5. Final review's file-peek case failed at both widths before owner dismissal was fixed, then passed with material identity intact.
6. Two older specs still queried expanded content inside the dock / asserted its former disclosure state. Their diagnosed red run had 2 failures / 1 unrun under fail-fast. Approved updates follow the central reader and preserve contrast, content and persistence requirements; all 3 passed.
7. Private genuine-helper setup failures are retained: daemon reading memory required its supported reset (and JSON content type); motion preferences must enable motion; already-open disclosure attributes are empty strings; only relevant finite API loads gate Toolbox readiness (Home storage statistics remain independent). A trace also showed motion cancelling on a layout mutation; real motion is checked separately before tool-filter/trail selection. No product assertions were removed.

8. The full gate's first all-unit run timed out twice at four workers. Main and isolated diagnostics passed; one explicitly recorded three-worker configuration measurement passed all candidate units. The failed original gate remains failed in its raw results. No full browser command was retried.
9. Private wrapper output-stream and final aggregation mistakes were corrected in the retained scripts. Per-step logs/exit codes remained intact; completed checks were not repeated because of those wrapper errors.

## External acceptance and review still required

The local checks and genuine reader matrix are complete as measured above. Yash must run the signed-in Claude connected-turn naming case and include this final Toolbox in his separately claimed MOTION-3 ten-minute live/replay evaluation. Those are person/account-dependent acceptance lines outside this task's remaining local capability. They are explicit blockers, not demo-checked completion claims. Keep TOOLS-2 open/claimed pending that acceptance. The PR is ready for the other builder's review under AGENTS.md's external-blocker exception; no merge has occurred.