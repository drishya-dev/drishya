# 87 — Stable chrome, whole-file reading and component audit

16 October. Latest builder requests, implemented as separate purpose commits. Keep Jet Black and shared Legacy agent visualization. Local tests only; no hosted CI. Branch commits remain separate; repository PR merge normally squashes to one main commit.

## Ordered acceptance list

1. Stable header title on hover/click/focus; remove inherited orange separator. Center settings/menu glyphs and normalize targets. Integrate minimize into composer capsule.
2. Workspace replaces right Workspace/Git launcher group while open; one obvious Back to agent. Raise desk toward header, compact reader chrome and improve file tabs without overlapping Files.
3. Fresh-session folders start closed below root; retain deliberate saved expansion thereafter.
4. Whole-file current-source reading in Files/Workspace with stable version, exact line/find/copy destinations and bounded/virtual display for large files. Never disguise partial content as complete.
5. Discoverable Workspace editing and native-backed apply/create-file requests, explicit submission and native permissions. Preserve current/draft/captured provenance; no silent direct filesystem mutation.
6. Audit every tool-input/output route. Decode valid structured control characters once; keep literal source escapes/raw data exact. Handle nested/mixed MCP data and terminal formatting without executing output.
7. Styled accessible Home filter menus: keyboard, outside dismissal, focus, narrow/short screens and reduced motion.
8. Whole-component route/read/menu/action audit informed by Uiverse; coherent components rather than unrelated decorative snippets. Record inspected surfaces and dispositions.
9. Research maintained developer palettes; retain Jet Black and tune alternatives for this app after real-session checks. Ecosystem presence does not establish universal preference.
10. Long-input/long-output cards: reserve visible result space on resolved operations, bounded input and result regions, no input swallowing the outcome. Test all four short/long combinations across tool families, normal view and hover.
11. Actual own session appears stuck around PR65, including missing later conversation even outside Live. Diagnose discovery/source identity/ingestion/history, rather than assuming a Follow-only bug. Verify the current native journal and captured latest sequence without fabricating missing events.
12. After the above, inspect fresh McAfee detection-log entries (two alerts reported today). Compare the prior mitigation and current trigger/process/timestamps. Do not disable antivirus or add broad exclusions; report what evidence can establish.
13. Latest on-screen feedback: inspect spacing between Workspace and prompt-history rail; remove the residual invisible full-width header effect, not only its orange ornament. Prefer a larger session title, or workspace/title on one line, with deliberate readable typography.
14. Connections disappear when fourth/more cards force wrapping (second→third visible only with spare space). Route and retain connectors across row wraps, scrolling, virtualization and hover; no invented causal links.
15. Scroll jumps still visible. Reproduce dense actual sessions during deferred material/height loading and arrivals/reflows; distinguish measurement/virtualization anchoring from animation before changing motion. Earlier regressions passing is not proof this report is resolved.

## References

- [Uiverse](https://uiverse.io/), Buttons/Inputs/Tooltips: composition/feedback inspiration; no code adopted yet.
- [Catppuccin palette](https://catppuccin.com/palette/) and [project](https://github.com/catppuccin/catppuccin): pastel palette family and integrations.
- [Nord](https://www.nordtheme.com/docs/): cool low-saturation design system.
- [Tokyo Night](https://github.com/folke/tokyonight.nvim): dark editor/terminal palette family.

## Disposition

84 remains the overall queue,85 the independent critique.87 supersedes86's broken title expansion, detached minimize placement, page-only current reading and32KiB draft limit.

| Before | After | Why |
|---|---|---|
| Title grew out of its header on hover and disappeared behind inherited chrome | Stable ellipsized15px session title; inherited orange line and full-width veil removed; utility glyphs centered | A title must remain readable and preserve hit targets.43e3898,2ba7fc4. |
| Minimize floated outside the prompt; folders auto-opened | Minimize sits inside the capsule; fresh folders closed below root, saved expansion retained | Consistent boundaries and deliberate navigation.43e3898. |
| Current-source reading/find limited to200-line pages | Approved/redacted stable whole-file endpoint,2MiB cap, virtual source rows and full-file Find/Go/Copy | Complete reading without mounting10,000 DOM rows.83ca88e;10k-line browser regression. |
| Desk launched under duplicated controls with large chrome | Higher desk, compact tabs/readers, one Back to agent in place of right launchers | Give code the available space; retain Files navigation.83ca88e. |
| Small edit drafts; no new-file entry | Edit file and New file prepare explicit native requests with attached draft content, up to256KiB/5000lines | Reuse native permissions and submission; no direct file writes.073425d. Blank creation is valid; private drafts remain volatile/exportable. |
| Wrapped second→third edge vanished when a fourth card filled the next row | Gutter routing can leave a row vertically or use its outer margin | Never draw through another card. e0c0523; five router cases including unequal heights. |
| Encoded command wrappers showed literal escapes; nested MCP envelopes stayed opaque | Known command arguments and nested/array text envelopes decode once, with exact raw access/copy; unrelated literals remain unchanged | Display formatting must not corrupt evidence.910f1fa. Mixed unknown/image content is preserved raw rather than silently discarded. |
| Long input pushed outcomes beneath the normal preview | Input/result regions have separate bounded scroll allocations; hover increases both; local wheel remains local | Short/long input × short/long result verified for Shell/MCP/Other,12 combinations.910f1fa. |
| Opening an imported session only loaded its old SQLite snapshot | Bounded16MiB passive catch-up turns on opening history, independent of Follow/replay; retries visible | Pull appended native data without starting a permanent watch or sealing unfinished records.717edcb. |
| Home hid discovered changes behind an already-imported row | Uncaptured bytes produce Journal updated and current journal time; native filter picker gets matched surfaces | Make the active local continuation discoverable; retain browser keyboard/outside dismissal.1ef8087. |
| Measurement correction ran both before paint and in an untracked later RAF | Remove the duplicate delayed restore; preserve the prepaint correction | A stale callback can override a newer wheel delta. Broad scroll/motion acceptance below. |
| Prompt rail began immediately below Workspace | Increase top clearance and bound its height independently | Preserve all prompts without crowding the destination buttons. |

## Actual sessions and remaining diagnosis

The original store was inspected read-only. An older Drishya journal is fully captured but no longer growing; a newer imported journal had roughly97MB beyond its stopped cursor. The newer journal also carries native `history_base` metadata, indicating segmented native history. Its newest bytes were imported through the existing redaction pipeline into an ignored review store; the screen now shows this turn's real edits/commands. Four real-recording history/Workspace journeys pass. The normal daemon was not silently restarted or its native clients terminated.

**Do not claim automatic segment stitching is implemented.** Opening the newer imported recording now catches up. Automatically following an older segment to a newer one needs evidence-backed native segment identity/boundary handling and duplicate-safe correlation, not title/workspace guesses. This is the next focused capture PR after68, alongside showing the current continuation clearly. No schema agreement is implied.

## Remaining ordered acceptance

1. Finish broad local validation for this batch; merge/push68 at builder's explicit request. Later PRs should have one coherent commit each, while68 squashes its existing purpose increments into one main commit.
2. Reproduce/measure remaining scroll reports on current segmented sessions with deferred content, not only synthetic minimal output. The duplicate delayed correction is removed; passing automated checks are not human motion acceptance.
3. Complete the joined evidence→source→native correction→resulting check workflow, richer draft comparison/version conflict handling, native signed-in lifecycle and accessibility/platform acceptance from84/85.
4. Whole-component Uiverse/skills audit and alternative-palette refinement remain open. Existing seven presets are retained, Jet Black unchanged; maintained palette references above are not evidence of universal user preference. Home native picker is refined without adopting third-party code. Inspect all readers/dialogs/menus at narrow/short sizes before calling this whole-product polish complete.
5. McAfee recurrence is documented in38: four new in-memory PowerShell detections match the prior wrapper timing; fresh parent/payload evidence remains incomplete. No protection policy change or external submission. This is not a fixed/verified-clean claim.

## Local validation for the merge checkpoint

Both typechecks and production build pass. Full unit run: **426 tests/71files pass**. The105-case selected browser sweep finished103passing/two failures: the hover test still targeted the old outer scroller, and the local-preview navigation overlapped a production rebuild deleting/replacing `dist`. Hover allocation was corrected to include nested input/result overflow and its test targets the actual result viewport; both failures pass their focused rerun, along with local-scroll Follow. Thus105 distinct selected journeys have passing final results across the sweep/reruns, **not a single all-green105-case run**. Three repetitions of the shared-material parity test pass after freezing the reading destination and reading geometry atomically. Four actual redacted recordings pass history/manual-scroll/current-Workspace checks in an ignored store. No native account turn, hosted CI, human motion/accessibility or platform certification.

Fresh-folder fixtures now search/expand deliberately. Legacy acceptance checks scoped Modern chrome does not apply, rather than assuming shared reader CSS can contain no Modern selectors. Captured content/width/type parity assertions remain. New hover sizing considers nested reading regions; the boundary regression verifies local wheel, history wheel at limits, retention/movement and passage under header/composer chrome.
