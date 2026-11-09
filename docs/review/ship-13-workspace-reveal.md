# SHIP-13: reveal the active Workspace file

Task acceptance is complete for other-builder review. The full gate has four failures reproduced on clean main, recorded below.

The Explorer follows the active Workspace tab and active split pane, opens the file's exact recorded ancestors, selects one row and brings it into the virtual window. Main-root aliases keep their existing identity; other directories stay under their exact recorded root and unresolved paths remain Unplaced. Local creation drafts have their own tree home. The change uses the existing navigation memory notifications; it adds no global store and does not change current-file permissions.

The reveal clears an old search/Touched filter only when navigation identity changes or late metadata resolves that identity. An explicit manual collapse survives reading updates and closing/reopening Workspace until the active identity changes. Scrolling the Explorer does not take focus or move source/history reading positions. Explicitly choosing Touched still excludes untouched active files and unsent drafts.

## Verification

Implementation `9b21f860` plus fixture/interaction correction `05c1be05`: 25 focused units and UI typecheck/build passed. The corrected new browser spec passes all 12 cases at 600/1440 (one actual worker because this is one spec, zero retries). The integrated compatibility command at source `dba7530a` passes 46 cases / one existing skip / zero failures or retries, using three workers across Workspace, file evidence/routing and queue specs.

Preserved failed runs explain the corrections: the initial fixture requested current inventory from a mixed-root recording whose intentional policy is captured-only (12 failures / 28 compatibility passes / one skip). Separating single-root inventory and mixed-root captured cases leaves the permission boundary intact. Later traces exposed a narrow Files overlay covering tab clicks, virtual folders outside the mounted window, and a desktop test using the narrow-only pane switch. Tests now dismiss the overlay, deliberately scroll to the closed virtual folder, and focus a visible desktop pane. Intermediate runs were 8/12 and 11/12, then all 12 pass. No forced click, relaxed assertion, longer timeout or automatic retry was introduced.

## Genuine acceptance

| Native journal prefix | Bytes | Widths | Measured navigation |
| --- | ---: | --- | --- |
| Claude `c743c426` | 2,019,147 | 600, 1440 | Five captured files; five external navigations and five tab switches per width |
| Codex `01a1be5d` | 206,161 | 600, 1440 | Five genuinely edited files across three recorded roots, including a root file and nested paths; five external navigations and five tab switches per width |

All 40 reveals select exactly one correct visible tree row; five tabs remain open; zero horizontal overflow. Codex used the normal native workspace-write sandbox in a throwaway repository. Both sources were redacted through normal scratch imports, with session-scoped workspace reading approval and no remembered grant. The initial private probe omitted that approval and therefore could not open the tab list; its failure is retained. No journal or native configuration was edited. Screenshots, source paths and numeric receipts remain in the isolated integration checkout's `.local/release-real/`.

The integrated full gate is running on frozen source `b843726` with three parallel workers, one serial worker and zero retries. No clean full-gate, human ten-minute or merge claim is made yet. This PR is stacked on FILES-14 (#379); normal other-builder review remains required.

## Final representative checks

The final four private Workspace frames use Claude `c743c426` (2,019,147 bytes) and Codex `01a1be5d` (206,161 bytes), each at 600/1440: five external opens and five tab switches per width, 40 exact visible-row reveals in total. Claude spans two recorded directories with one root file/four nested files; Codex spans three roots with four root files/one nested file. Each frame has five retained tabs, exactly one selected visible row and zero overflow. The Codex native worktree session was normally resumed to add two synthetic main files; it was not reconstructed from CLI stdout. The earlier `01a1bf72` five-file capture was single-root and is retained as earlier evidence, not worktree acceptance.

All explicit SHIP-13 Accept cases pass. Completion docs are in this stacked PR, preserving FILES-14's completion docs. Main stays claimed until review/merge; merge FILES-14 first. Combining independent completion PRs must retain every tick/claim removal and rerun sync-tasks. The separate baseline renderer failure is now CONTENT-19, not an undisclosed change to these file-reveal semantics.

## Final integrated gate disposition (9 November)

Product source `35e4393`: both typechecks and UI build pass; all 215 unit files pass, **1,315 tests / one existing skip**. Browser run used **three parallel workers plus one serial worker, zero retries**: **696 parallel passes / 27 skips; 28 serial passes / one skip / four failures**. This is not a clean full browser gate.

All four failures reproduce with the same assertions on separately rebuilt, clean main `f93d880b`, one serial worker and zero retries: B2 live :63 opens an unexpected operation detail (expected zero, got one); material-motion :132 loses its hover-reading surface; p1-pacing :40 sees three active animations instead of zero; p1-pacing :266 has no repository tether. These remain TEST-2/MOTION-3 baseline failures, not fixes claimed by this task. The baseline control lives in the coordinator checkout's `.local/release1-baseline-20261109/`.

The first gate `b843726` stopped at three golden mismatches after 1,312 unit passes / one skip. Only the reviewed raw sequence expectations changed (18 to 19, 20 to 21, 22 to 23), reflecting retained Claude completion observations; all other golden fields remain unchanged. Golden/queue checks then passed 46/46. The first independent packaging run also failed its old exact observation count of 34: the fixture now retains three completed-turn rows. The corrected exact assertion is 37, with zero capture gaps. **package:verify passes at integration `70825e6`**, including isolated offline installation, both imports, checksums, demo, authenticated API and persisted restart. Its apps/packages tree is byte-identical to the full-gate product source; the additional change is the verification script, plus docs. No browser assertion, retry or timeout was relaxed.

Private complete gate evidence: `.local/release-gate-20261109-141147/` and `release-gate-20261109-142009/` in the isolated integration checkout. No further full-suite command was run to erase these failures. Other-builder review remains required; no merge or release certification is implied.

