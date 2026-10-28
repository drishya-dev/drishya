# FILES-4 — Reader and Workspace review

26 October 2026. Scope: the current file peek, full Workspace, whole-source reading and their handoffs. The running baseline was built and inspected before editing; the installed `emil-design-eng` skill informed the review. Existing type, composition and finite motion remain appropriate. This is the complete FILES-4 review, following the separate shared-draft/index eligibility work in PR #226.

## Defects repaired

| Before | After | Why |
|---|---|---|
| Go to a line, scroll away, then submit the same line: nothing happens. A single matching search result has the same failure. | Each explicit line/match request has its own reveal revision in both Workspace and peek. Ordinary renders do not issue a request. | The selected line and a deliberate navigation request are different state. A request must still work when the selected line is unchanged. |
| An old Workspace line request remains pending after scrolling; entering a draft and returning to source skips saved scroll restoration and returns to the top. | Consume the line request after that render. Returning from the editor restores the later deliberate reading position. | Editing should not erase where the person was reading or replay an old request. |
| Closing a Workspace tab removes the focused close control and leaves keyboard focus outside the file tabs. | Focus moves to the selected surviving tab, or the active empty pane's file chooser. The target is brought into view. | Closing a file must leave a usable keyboard destination. Drafts remain retained. |
| After refreshing a changed disk file, peek retains the older material correctly but its footer still says “On disk”. | The footer says “Retained snapshot” until the person accepts the latest snapshot. | A current disk sample and a retained sample require different provenance. |

Each regression was reproduced before its corresponding repair. No capture, contracts, projection, History, shared card, native protocol or dependency changes.

## Whole review matrix

| Criterion | Evidence and result |
|---|---|
| Type and line height | Inspected the running source, document, editor and draft-comparison surfaces. Source remains 12px/22px; highlighted rows assert 22px. Readable, selectable DOM text; no presentation rewrite needed. |
| Syntax | TypeScript token colours and source characters verified; Markdown Document/Source and fenced code inspected. Existing document-highlight units pass. |
| Paths and tabs | Duplicate basenames retain distinguishing directories and full-path titles; Home/End, arrow selection, Alt+Shift+Arrow reorder and tab close focus tested. Existing tab-label units cover deeper collisions. |
| Pane sizing | Split at default and 25/75 allocation, with toolbars contained at 1440 and 900px. At 600px the existing single-active-pane presentation is retained. No horizontal Workspace overflow. |
| Toolbars | Find/previous/next, line input/Go, Wrap, file actions, Edit/Read source, compare and return examined. Compact controls remain subordinate to source material. |
| Copy | Complete 7,000-line copy checked against the source, allowing the Windows clipboard's LF→CRLF transport conversion. Both real-source journeys copied the complete 7,120-byte current sample. |
| Find and go-to-line | Far-end lines, one-match navigation, repeated requests after scrolling, retained active location and unchanged ordinary scroll covered. Invalid-line handling remains existing bounded behaviour. |
| Wrap and long lines | A 2,000-character first source line, horizontal reading and pre-wrap verified without clipping the source allocation. |
| Resize | All four peek edges dragged; opposite-edge anchoring/dimension changes and Reset checked. Viewport changes at 1440/900/600 retain bounded content. Split keyboard divider reaches 25%; layout controls remain available. |
| Scrollbars and restoration | Source has its own `overflow-y:auto` viewport. Virtual rows stay bounded under 100 for a 7,000-line file. Go reaches line 6,900 and Markdown fallback reaches line 6,001. Deliberate 1,000px scroll survives draft entry/return. |
| Markdown | Headings, inline code, a table and fenced code inspected in Document; Source preserves Markdown characters. A 6,001-line document explains the rendered limit and offers complete Source. |
| Empty material | An empty current file exposes its empty first source line, can receive a local draft, and returns to empty disk source with “Draft retained”. No fake source or loading state substituted. |
| Peek versus Workspace | Beside-agent peek stays separate from the full multi-pane draft surface. Opening Workspace hides peek; Back to agent restores it. Source and local draft remain distinct. |
| Captured versus current | Real Codex and Claude recorded-material columns opened from current peek, then Read on disk returned to the current sample. Changed temporary fixture refresh retains old material with the corrected footer until Use latest. |

## Validation

- UI typecheck and production build pass.
- Seven dedicated desktop browser journeys in `tests/browser/files-4-reader-review.spec.ts` pass on Edge. Screenshots were visually inspected under `.local/`.
- Twenty-four focused units pass across workspace tab labels, source versions, drafts, memory, Markdown links and document highlighting.
- Retained shared-draft regressions pass for LF, CRLF and CR, preserving selection, local undo, editor identity and disk bytes; these behaviours are not reimplemented here.
- Actual redacted-store acceptance: Codex `rec_b8fa7ef1…` (2,490 observations) and Claude Code `rec_061e5f2d…` (798 observations). Both used a 7,120-byte current Markdown sample, source line navigation, complete copy, a synthetic memory-only draft, draft comparison, source return, 1440/900/600px layouts and beside-agent peek. Captured-material/current-disk handoffs were also checked against genuine recorded reads/edits. Both report zero page errors and byte-identical current disk before/after.

The actual-source run uses a private copy of the existing redacted store. The file-open events are the same product handoffs used by Files; the actual repository's bounded/virtual Files inventory contains many matching worktree paths, so the real check directly addresses an existing relative path after explicit workspace-reading consent. Ordinary Files row selection is covered by the synthetic journeys. No real source/draft text or screenshots are committed or quoted.

The copied Codex store references a native segment journal that is no longer present. Its optional session-segment request logs ENOENT; stored history, current readers and captured-file material remain available and pass. This does not establish native resume, missing-journal recovery, or fresh capture acceptance. No native turn, project-file write, hosted gate, physical-device or human assistive-technology acceptance is claimed. All newly authored checks use desktop widths of at least 600px.

## Combined handoff verification

Root independently reviewed the source and combined this branch with CONTENT-1 owned repairs and the unintegrated CONTENT-2 components: 852 units in 149 files, both TypeScript projects, production build and 17 image/Reader browser checks pass. Seven browser-story checks explicitly wait for Claude’s History integration; they are not counted as passing. An additional independent source review found no actionable issues. No hosted checks.
