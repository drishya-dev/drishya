# Product checklist

**The single current work list. Updated 18 October 2026.** Builders and agents update this file in the same increment as the work: tick a task only when its stated scope is implemented and checked; add new feedback here before starting it. STATUS is the session log, CONTINUITY is the handoff, and numbered reviews are evidence/history—not competing task lists.

`[x]` means implemented and locally checked within the stated limits. `[ ]` means unfinished. A checked implementation does not certify native accounts, every device, visual preference or release readiness.

**Current answer:** UI/theme finishing is **not complete**. Workspace editing **exists as local drafts**: Workspace → select file → **Edit file** → **Compare draft** → **Review edit with harness**. New file drafts work too. Drafts are memory-only and disk is unchanged until the user explicitly submits a request and the native harness applies it. There is no direct Save-to-disk endpoint.

## Current priorities

- [x] Restore the previous tool boxes after rejecting PR88: original input/output allocation, hover limits, separator and spacing. Keep independent Follow/prose fixes. PR92.
- [x] Consolidate the scattered active queues into this checklist; link it from the repo instructions and docs entry points.
- [x] Make existing Workspace editing easier to find: leading Edit file action with mode icon/context, active-pane editor focus on entry/return from comparison, neutral editor focus. Existing-file/New file, two-pane/narrow and three actual-session checks pass. Native disk application remains a separate unchecked acceptance task below.
- [x] Compact **Review work** pagination: short labeled arrows, separate page count and limits note; no tall wrapped buttons. All70 recorded checks remain reachable;320/390/1440px and actual desktop/phone survey pass. Outcome groups stay top-aligned instead of stretching across the file list.
- [x] Compact the current-file reader: history/actions share a row, labeled Workspace/refresh/evidence access, shorter Find/Go/Wrap controls, optional empty import context and compact footer. Remove the old 48vh source cap so content fills its reader. Legacy/Modern reading and actual desktop/phone navigation checked; whole-file controls remain available.
- [ ] Improve the editable draft surface itself: syntax/line-number/indentation ergonomics, useful keyboard behavior and matching reader presentation; current editing uses a bounded textarea, not a complete IDE editor.
- [ ] Retain an older current-source version when disk changes; provide explicit keep/refresh/compare against the newly read version and disclose stale bases before native edit handoff.
- [ ] Finish the joined investigation: recorded failure/change → exact captured source → current file/draft → anchored question/correction → explicit native submission → actual resulting diff/check → return to original evidence.
- [ ] Finish the whole-product UI pass below, including components that were never called out in screenshots.

## UI, themes and motion — still in progress

- [x] Modern is the new-browser default; saved/explicit Legacy and Canvas choices remain usable. Agent visualization shares the Legacy foundation.
- [x] Seven selectable palettes and semantic syntax tokens: Jet Black, Midnight, Paper, Catppuccin Mocha, Tokyo Night, Nord and Gruvbox Dark. Local solid text-token contrast guard; softer Paper. Reviews86/101.
- [x] Settings categories, native-picker fallback, responsive keyboard orientation, section offset reset and touch input sizing. Review100.
- [x] Measured adjustable Files and Git reading spaces; retained preferences and narrow Files navigation. Reviews96/98/99.
- [x] Composer target/recording/state are visible; compact phone controls clear Send; attachments, native settings and minimized Stop use existing owners. Review102.
- [x] Prose background no longer adds horizontal overflow. Follow accounts for late composer clearance. Reviews103/105.
- [ ] Review **Home**: intro, complete workspace/session inventory, filtering/dropdowns, long names, search, keyboard/empty/loading/failure states, responsive row density.
- [ ] Review **header and edge panels**: title/minimize/menu alignment, hit targets, overflow, tool/MCP/agent disclosures, no duplicate controls or reserved middle blank space.
- [ ] Review **composer**: compact draft/attachments, file/folder/image/paste previews, permissions/model/effort, send/stop/approval/error/reconnect states, professional focus/menus and edge translucency.
- [ ] Review **all readers and Workspace**: type/line height, syntax, paths, Markdown, tab design, pane sizing, toolbars, copy/find/wrap/go-to-line, resize/scrollbars, long and empty material.
- [ ] Review **all action types** on actual Codex and Claude sessions: read/write/edit/search/shell/test/web/MCP/delegation/unknown; input/output size combinations, decoding/raw access, errors, all lines reachable, accurate test rectangles/counts.
- [ ] Review **every interaction**: hover/click/active/focus, Escape/outside dismissal, keyboard navigation, selection/copy feedback, reversible interruption and reduced-motion/resource fallbacks. Apply installed Emil/design/motion skills; use Uiverse selectively for composition, not mismatched decorations.
- [x] Rebuild the six Modern alternatives: Deep Ocean, Porcelain, Orchid, Blueprint, Evergreen and Copper. Preserve Jet Black and stored IDs; complete semantic/status/graph/syntax tokens, selections and accurate swatches. Local text/status contrast guard, Home/session journey and actual desktop/phone Settings/material survey pass. Legacy palettes stay separate.
- [ ] Check **each palette across every surface**, including actual code/diffs/tests/menus/editor, translucent compositing, light-theme balance and semantic status contrast. A palette selector/token test is not the completed theme pass.
- [ ] Evaluate motion with actual live/replay sessions: origin→whole material→settle, hover entry/exit/switching, reflow/scroll, burst/late results and ten-minute calm. No fake typing/reasoning or copied evidence.
- [ ] Repeat independent critical developer/product/design review after the investigation loop: component ratings, switching intent versus native chat/IDE, daily missing tasks, readability, motion, density and useful improvements. Implement selected findings here rather than starting another queue.

## Developer workflows and selected additions

- [x] Multi-file Workspace: eight tabs, two resizable panes, Alt+W close and bounded metadata recovery. Browser Ctrl+W remains browser-owned. Reviews82/87.
- [x] Whole supported current-file reading/find/go-to-line and Markdown Document/Source. Complete file API limit2MiB; editable drafts256KiB/5000 lines with explicit limits. Review87.
- [x] Local existing-file/New file drafts, download/discard, native request preparation with complete text attachment and base hash/conflict instructions. The harness owns actual writes; no direct terminal/project-write API.
- [x] Compare local draft with its retained base: Changes/Side by side, independent reading state and complete-text fallback. Review95.
- [x] Git staged/worktree review, bounded parsed/raw patches, resize/file rail and freshly validated handoff. Current Git stays distinct from recorded work.
- [x] Recorded source versions/diffs, exact file/line references, anchored review questions and return navigation. Unknown/unavailable historical content remains explicit.
- [x] Cross-session captured evidence search with filters/paging/exact destinations; command navigation and shortcuts. Review93.
- [x] Complete independent bottom-anchored prompt/time navigation; main scrollbar at viewport edge. Review89 and105.
- [x] Usage displays captured/reported values and honest missing states; no invented cost/token totals.
- [x] Bounded recovery of tabs/panes/readers/history/map/Git/Home; re-fetch/reapprove after reload. Source/draft/prompt/attachment bodies and grants are not navigation metadata.
- [x] Repository map has true3D orbit/pan/zoom, manual hold, semantic grouping, observed/all scope, exact file lookup and typed direct imports/importers. Automatic orbit has visibility/resource/reduced-motion guards.
- [ ] Make the Repository map useful for a concrete investigation: changed/observed/import neighborhoods, clear typed relationships and exact evidence/current-file destinations without graph overload. Existing import lookup is implemented; developer-task usability is unfinished.
- [ ] Add optional **Commands** inside Review/command navigation: factual captured command ledger/filter/copy, no resident main panel or direct runner. T1 foundation before dependent findings.
- [ ] Add quiet factual **Review findings**: exact evidence-backed tripwires and repetitions, without safety/stuck scores or inferred causality. T2/T4.
- [ ] Add an on-demand factual **prompt overview** to existing prompt navigation/Review; no scored report cards or another dashboard. T5.
- [ ] Finish a useful factual **review packet/export**, preserving changes/check gaps/questions and current-versus-captured provenance.
- [ ] Audit existing bookmarks/saved moments and commit/PR/capture-gap indicators; surface only evidence-backed, useful actions in Review/utilities. Do not add empty panels for feature count.
- [ ] Design explicit opt-in draft recovery before persisting edited text; retain download and unsaved warning until then. Never imply current volatile drafts survive crashes.

## Native integration and acceptance

- [x] Native Codex/Claude controller contracts, permission/consent boundary, attachments/options/approval/stop lifecycle and early genuine thinking-state handling have local automated coverage. Native settings are supported values, not fabricated synchronization.
- [x] CLI discovery/setup errors and explicit newer-session journal navigation are implemented; passive capture remains independent. Newer work lookup does not silently stitch sessions.
- [ ] Complete real signed-in **Codex** journey: text/files/folders/image/pasted screenshot, model/effort/supported permissions, exact approval, edit/create result, stop, reconnect and competing-client acknowledgement.
- [ ] Complete the equivalent real signed-in **Claude Code** journey; confirm observed reads/edits/creations/MCP/output/exposed reasoning appear faithfully.
- [ ] Exercise genuine multi-agent sessions: identities/parent-child menus, concurrency/windows, origins, overlaps, tools/MCP/files, reading and live/replay independence.
- [ ] Validate the joined native edit/create conflict path and subsequent recorded checks end to end; a prepared attachment/hash instruction is not an enforced atomic write transaction.

## Reliability and release

- [x] Reproduced black-screen/render-loop and delayed upward-scroll anchor issues have bounded fixes/regressions; actual long histories from both harnesses exercised. Broad platform acceptance remains open.
- [x] Latest functional typechecks/build and447 unit tests pass. Broad browser run:174 passed/6 skipped/4 failed; all four repaired cases pass together on targeted rerun. Review103 records this honestly; no second full-green-run claim.
- [x] McAfee recurrence investigated: fresh trace attributes the matching script wrapper to the signed managed Codex updater, not Drishya/pnpm. Blocked payload is unavailable; no certified false-positive/safety claim or antivirus bypass. Review38.
- [ ] Verify a supported idle-time managed-runtime update resolves the recurring AV conflict; do not interrupt active work or change antivirus protection.
- [ ] Physical lower-resource/lower-core/Windows/macOS/Linux acceptance; memory/large-repo/long-session performance, actual phone/input devices and GPU fallback where supported.
- [ ] Keyboard/browser zoom/assistive technology, human freeze/truth/ten-minute reading and preference/adoption acceptance.
- [ ] Publishing preparation only when requested: final full local checks, selected manual GitHub CI, packaging/install/setup guidance and release checks. **No automatic hosted CI for ordinary commits/PRs.**

## Explicitly deferred — not promised for this finishing pass

- [ ] Evidence-backed changed-line agent attribution, explicit two-session comparison and a measured density option after the core investigation workflow.
- [ ] Symbol timeline after reliable extraction/identity; separate mission-control dashboard and OS notifications remain deferred. Keep session inventory on Home and quiet findings in Review.
- [ ] Additional visual UI versions/themes after the current Modern baseline is finished. Keep Legacy; avoid another redesign replacing the useful visualization.

Historical rationale/verification: reviews82–105, especially83/85 (critic findings),84 (old queue),92 (feature selection),95–105 (delivered increments). When new work lands, update the checkboxes here and link its evidence; do not create a new active list.
