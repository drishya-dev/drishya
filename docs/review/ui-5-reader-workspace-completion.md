# UI-5 — reader and Workspace completion

20 October 2026 · PR #165 · continues the merged [Git/patch/source work](ui-5-git-review-controls.md).

The remaining scope was whole-reader combinations and Workspace headers. Inspected the running app against isolated copies of already-redacted Drishya Codex and Skeletongraph Claude sessions before changing controls. Used the installed `emil-design-eng` skill; no new motion or menu system.

| Before | After | Why |
| --- | --- | --- |
| Captured file navigation, context, import disclosure, evidence label/selector and duplicated excerpt label stacked above code | Navigation/context share a row; selector keeps its accessible name; provenance and exact scope remain visible | Reclaim reading space without hiding what was captured |
| Reading space and import connections occupy resident rows | One existing Actions menu owns both; import navigation stays open for pagination/errors | Secondary controls stay with their reader |
| Captured/disk comparison takes a separate row | Compact Compare with disk beside the selected evidence | Keep its consent, exact-position warning and independent comparison dialog |
| Phone readers spend215px on action history before source | New phone readers start in Reading space; Show actions restores all history/filter/paging | Prioritize the selected material while preserving saved choices |
| Workspace import context adds49px before source | Import connections in existing File actions | Return space to source and preserve current-index qualifiers |
| Phone Workspace shows Files/New file/Actions/Back | Files/Actions/Back; New file in layout Actions | Keep at most three primary actions at this level |
| Current-file peek already has compact header and phone Reading options | Retained after real-session mouse/touch verification | Avoid replacing a working owner for visual uniformity |

## Measurements and visual inspection

Private screenshots remain under ignored `.local/`, because they contain real captured project material; do not commit them. Baselines and results inspected at1440/900/390/320px:

- `ui5-file-before-*` / `ui5-file-after-*`: actual Skeletongraph captured source begins at y557→390 desktop. Resizing the desktop reader to390px retains its visible trail and moves source y834→656.
- `ui5-file-phone-after-*`: a fresh390px phone reader starts source at y441 (393px earlier than baseline);320px at y470. The history menu remains reachable. No document overflow.
- `ui5-workspace-before-*` / `ui5-workspace-after-*`: actual Drishya current source toolbar begins y331→281 desktop, y349→300 at390px. Source toolbar retains its49px desktop/83px phone allocation. No document overflow.
- `ui5-diff-after-*`: retained current-Git patch controls48px desktop/86px at320px. Earlier before/after baseline is recorded in the #144 review.
- `read9-actual-*`: actual Codex and Claude current-file peek, mouse and touch emulation at390/320px. Source occupies69% of reader height with mouse and64% with touch; no reader overflow. Desktop controls were inspected in the same journey before narrowing.

## Verification and truth boundaries

- 648 local unit tests passed before integrating main #166. Both TypeScript projects and production build passed.
- New captured-reader keyboard journey: Show actions, exact First/Second evidence selection, compare/single view, Escape/focus return, mobile/desktop containment. Existing prose/read/edit/write/search links still open exact captured material without current-file IO.
- Workspace coverage: New file menu, split/reset, edit/compare/read source, distant line navigation, Back to agent; retained Legacy Copy/search wording. Existing native edit/create requests are prepared only, never submitted.
- Existing regression journeys passed for two-file drafts, large comparison, creation attachment, source conflict/stale handoff blocking, restored captured references/current-reader consent, Markdown and10,000-line reading. Git handoff validation, patch hunk/search/wrap/layout and historical-source range/copy remain with their existing owners.
- Actual copied-store reader journeys pass with mouse and touch emulation for both harnesses. The sampled Codex recording still lacks typed historical Read artifacts; it validates current reading, not adapter completeness (DATA-1).

UI-5 is complete across the #144 and #165 increments. This does not certify physical-device, screen-reader or human ten-minute acceptance; those remain REL-3. Wider palette/component redesign and map behavior are separate TASKS IDs. Legacy visualization, capture, backend, policy and project files are unchanged by this PR.

Final integration with main #166 is conflict-free. Both typechecks and production build pass after integration; six affected Git-control, captured-reader and Workspace/Legacy browser journeys pass again. PR #165 is ready for Claude to review and squash; no self-merge.
