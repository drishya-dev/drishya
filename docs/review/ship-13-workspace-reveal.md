# SHIP-13: reveal the active Workspace file

The Explorer follows the active Workspace tab and active split pane, opens the file's exact recorded ancestors, selects one row and brings it into the virtual window. Main-root aliases keep their existing identity; other directories stay under their exact recorded root and unresolved paths remain Unplaced. Local creation drafts have their own tree home. The change uses the existing navigation memory notifications; it adds no global store and does not change current-file permissions.

The reveal clears an old search/Touched filter only when navigation identity changes or late metadata resolves that identity. An explicit manual collapse survives reading updates and closing/reopening Workspace until the active identity changes. Scrolling the Explorer does not take focus or move source/history reading positions. Explicitly choosing Touched still excludes untouched active files and unsent drafts.

## Verification

Implementation `9b21f860` plus fixture/interaction correction `05c1be05`: 25 focused units and UI typecheck/build passed. The corrected new browser spec passes all 12 cases at 600/1440 (one actual worker because this is one spec, zero retries). The integrated compatibility command at source `dba7530a` passes 46 cases / one existing skip / zero failures or retries, using three workers across Workspace, file evidence/routing and queue specs.

Preserved failed runs explain the corrections: the initial fixture requested current inventory from a mixed-root recording whose intentional policy is captured-only (12 failures / 28 compatibility passes / one skip). Separating single-root inventory and mixed-root captured cases leaves the permission boundary intact. Later traces exposed a narrow Files overlay covering tab clicks, virtual folders outside the mounted window, and a desktop test using the narrow-only pane switch. Tests now dismiss the overlay, deliberately scroll to the closed virtual folder, and focus a visible desktop pane. Intermediate runs were 8/12 and 11/12, then all 12 pass. No forced click, relaxed assertion, longer timeout or automatic retry was introduced.

## Genuine acceptance

| Native journal prefix | Bytes | Widths | Measured navigation |
| --- | ---: | --- | --- |
| Claude `c743c426` | 2,019,147 | 600, 1440 | Five captured files; five external navigations and five tab switches per width |
| Codex `01a1bf72` | 183,060 | 600, 1440 | Five genuinely edited files, including nested paths; five external navigations and five tab switches per width |

All 40 reveals select exactly one correct visible tree row; five tabs remain open; zero horizontal overflow. Codex used the normal native workspace-write sandbox in a throwaway repository. Both sources were redacted through normal scratch imports, with session-scoped workspace reading approval and no remembered grant. The initial private probe omitted that approval and therefore could not open the tab list; its failure is retained. No journal or native configuration was edited. Screenshots, source paths and numeric receipts remain in the isolated integration checkout's `.local/release-real/`.

The integrated full gate is running on frozen source `b843726` with three parallel workers, one serial worker and zero retries. No clean full-gate, human ten-minute or merge claim is made yet. This PR is stacked on FILES-14 (#379); normal other-builder review remains required.
