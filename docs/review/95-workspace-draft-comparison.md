# 95 — Review a local draft before handing it to the harness

17 October 2026. A focused slice of84/92's developer reading workflow, after the scroll repair merged as PR79 (`8235360`). Uses the installed Emil design-engineering guidance: add the action at the point of editing, reuse the established reader, keep meaning explicit and avoid another resident panel.

| Before | After | Why |
|---|---|---|
| Edit text or prepare a request, with no local comparison | Compare draft inside the existing draft toolbar; Edit draft returns to the same editor | Inspect the intended change without leaving Workspace |
| Reusing a captured/Git diff would misidentify its provenance | Explicit local-draft scope, Draft base / Local draft columns and “not applied to disk” context | A local intention is neither captured agent work nor a current Git patch |
| Large unrelated files can make a browser diff expensive | At most one million LCS interior cells and5,000 lines per text; complete read-only text views outside that budget | Bound computation while keeping both complete supported drafts accessible |
| Global workspace edits can reset another pane's comparison | Per-draft source-local revision, unique even after discard/recreate | Editing an unrelated file does not clear the reader's layout/find state |
| Swapping editor and comparison could lose the insertion point | Keep the editor mounted but hidden during comparison | Preserve text selection and scroll position on return |

The comparison uses the draft's retained `base`, not a new disk read. Refreshing or changing the real file elsewhere does not silently replace this base. The underlying exact source text, modified-time receipt and base hash used by native request preparation remain unchanged. This increment does **not** implement comparison against a refreshed disk version, automatic conflict merging, arbitrary captured-version comparisons or the complete evidence→correction→recorded-check workflow.

The existing pure bounded `diffTexts` routine creates a display comparison only; this is not a patch executor. The shared reader supplies Changes / Side by side, syntax highlighting, Find, hunk navigation, Wrap and explicit120-line patch pages. No hidden “more lines” truncation. Large fallback readers contain complete base/draft text and stack vertically on narrow screens. Drafts retain the existing256KiB per-text limit, source isolation, eight-draft cap, volatile lifetime and download/native-preparation options. No new observation schema, endpoint, dependency, native policy, direct disk write or persisted draft body.

Comparison changes are immediate; no repeated decorative transition or simulated typing. Captured/Git reader labels remain unchanged. The main canvas and Legacy visualization are untouched.

## Local checks

- Pure regression cases cover exact reconstruction with Unicode/tabs/CRLF/final-newline changes, multiple edits, changed/context counts, unchanged text, small edits in long files and bounded unrelated/too-many-line fallback.
- Draft-store regression covers independent versions and non-reuse after discard/recreate, retaining existing slow-second-pane, exact-text, cap and byte-limit checks.
- Workspace journey compares a real temporary file, reads both columns, edits another pane without resetting comparison state, returns to the retained editor, downloads exact draft text and prepares the existing native request without submission or disk mutation.
- Large comparison journey checks complete1,500-line texts, desktop/390-pixel phone bounds and selection/scroll preservation. Desktop normal/fallback and phone fallback screenshots were inspected locally. The existing phone Files overlay can still cover workspace header controls while expanded; this is retained as a broader navigation/audit item, not claimed fixed by this comparison.
- Both type checks/build and 445 unit tests across 76 files pass. All six focused Workspace/Git/Markdown/whole-file/new-file browser journeys pass together. Genuine native-account submission remains separate acceptance; these journeys deliberately do not submit a native turn. No hosted CI/private content/user package or artwork edits.

Continue84's remaining UI/skills/Uiverse/palette and source-version/joined-workflow queue.95 completes local base/draft comparison only. Optional Commands/findings/repetitions/turn overviews remain under the planned quiet Review/navigation placement in92.
