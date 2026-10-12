# Classic disclosures and comprehensive developer review

11 October 2026. Continues [48](48-classic-evidence-workspace.md). Classic remains the active product; no new theme, backend policy or event schema. Hosted CI remains publishing-only.

## Delivered corrections

| Before | After | Why |
| --- | --- | --- |
| Usage opens an absolutely positioned flyout inside the scrolling overflow menu | Usage expands inline; bounded menu width, wrapping labels and values, one outer scroll | The old flyout's left edge was clipped by its parent. The information must be fully readable on desktop and narrow screens |
| All captured agents permanently occupy the right rail | Collapsed Agents disclosure, nested Subagents disclosures beneath their captured parent | Keep the tools available; reveal ownership like an explorer tree when needed |
| Narrow header combines literal Settings gear and a CSS gear; Search text collides with its icon | One Settings glyph and one labelled Search control; menu Usage keeps its text | Existing mobile pseudo-elements must not duplicate the Classic control's actual content |
| A clicked captured search match can open a no-source file-history dead end | File evidence includes individual exact captured search lines; the clicked match is selected, even before its global trail page loads | Search output is useful evidence even when a whole source snapshot was never captured |
| Opening another recording retains the previously selected disk path | Session opening clears disk-file selection and captured search selection | A path from another workspace must not silently reopen under the new root |
| Modified keyboard shortcuts can toggle motion or map exploration | Global shortcuts ignore Ctrl/Meta/Alt and already-handled events | Do not hijack browser, OS or developer shortcuts |
| Paging the file-action list replaces a single selected source with the next page's first item | Retain one selected evidence reference, or two in comparison mode | Navigating the list is separate from changing the material being read |

Agent disclosure uses actual captured parent IDs. Independent roots stay independent. Missing parents remain roots; cycles cannot recurse indefinitely or hide an identity. Filtering remains explicit, with a focused indication on the collapsed header and Show all agents inside. Descriptions remain on hover. Closed identities cannot supply visible relationship origins; no invented origin is introduced. Capture and optional replay remain independent of the menu.

Captured search results are **individual excerpts**, never joined into an invented continuous file. The original path/line/text and action are retained. A missing line number is explicitly unavailable; the renderer does not invent a source line. Surrounding file bytes are not claimed. The clicked reference is selected only from the current as-of projection, keeping future replay output hidden; at most that one reference supplements a bounded global file-action page. Current disk reading remains separately consented. This fixes search reading, not general Back/Forward evidence navigation.

## Verification and limits

319 unit tests pass; both TypeScript checks and production build pass. Eleven distinct affected browser journeys pass across complete/focused runs: five Classic refinements, connected flow, synthetic live history, file comparison, replay ownership boundary, distant evidence comparison and anchored appearance changes. Usage is checked at 1440×900, 900×500 and 390×844; Classic composition has five aspect-ratio checks. Screenshot proof: local `.local/classic-usage-fixed.png` (not committed). No hosted CI. Root package-manager edits remain unrelated and uncommitted.

These are implementation checks, not real native-account, physical-resource, assistive-technology or ten-minute acceptance. Remaining primary-workspace work is recorded below; do not call this a finished native-client replacement merely because a synthetic journey passes.

## Comprehensive independent review

The builder explicitly requests an experienced developer, daily user and frontend designer to point out as many substantiated issues and useful features as possible, across the entire product. The fresh reviewer is given no artificial finding-count cap. Concrete firsthand defects are repaired during this pass; longer-term work and acceptance gaps remain a prioritized backlog rather than silently disappearing.

The full report is [50](50-comprehensive-developer-review.md): **49 numbered findings/acceptance gaps plus a visual craft table**, with firsthand, source-confirmed, feature-gap and acceptance distinctions. Latest firsthand recheck confirms Usage containment, exact search-hit reading and single mobile icons. Search-hit dead end, mobile duplication, disk selection leakage and modified-key interception are fixed regressions; single-evidence paging retention was also fixed after the report. The review is not a list of 49 outstanding bugs. Continuous source/change/check Back/Forward, current-index versus historical navigation, real native recovery/ownership and larger developer utilities remain separate work.

### Next bounded implementation

Start with evidence location/history that retains artifact or patch identity, selected line, mode and scroll through source → dependency → check → Back. Make current-index targets explicitly choose current disk versus captured work. Then close native account acceptance with visible session/worktree target, policy freshness, controller ownership and recovery. Before current-Git release acceptance, strengthen content consistency checks: the present status+HEAD recheck does not detect a content-only edit that remains modified during sequential patch reads. The report's race finding is source-based; this pass does not falsely claim it has been repaired. Review notes/queue, whole-artifact find, diff navigation, typed diagnostics, semantic navigation, tree keyboard parity and responsive/map/accessibility craft follow. Do not replace this backlog with another palette prototype.
