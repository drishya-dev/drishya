# 82 — Developer workspace and critical review

16 October 2026 · Yash with Codex · `codex/multi-file-workspace`.

Latest builder direction: restore the pre-breadcrumb centered Modern header; merge and review PRs 66/67; audit padding/readers and unnecessary controls; add Files / Repository / Workspace with multi-file reading before fresh critical developer/product reviews. Keep the shared panel material/logo. Reviewers must judge real agent visualization, readability, interaction, developer usefulness, switching intent and missing functionality, including whether 3D maps help actual tasks.

## Reviewed integration and backlog disposition

- PR 66 merged as `c809a1b`: accept its separation of spatial overview, bounded direct-import focus, chronological captured work and explicit evidence/current-source identity. Retain it as a proposal. Do not adopt React Flow/ELK or a replacement renderer by merging the document. Evaluate usefulness with the existing map first.
- PR 67 merged as `b3184bd`: bounded reading memory, attachment queue/UTF-8 validation/preview/retry, cached-read recovery and complete review pagination. Independent review found one minor queued retry regression, fixed separately in `7cea284`; 387 units and 30 browser journeys plus three post-integration checks pass locally. Both builders’ notes and the header rollback were preserved.
- Review 75’s everyday reliability items are implemented by 67; independent native-account, human/physical/platform acceptance is still open. Review 50’s richer semantic/debugger/IDE workflows remain staged product work, not implied completed by this pass.

## Workspace contract

Use the existing consented current-file API, root isolation, redaction and selected native session. Add a separate Workspace destination to shared Legacy/Modern, not observation Canvas. Files remains a quick reader; Workspace supports bounded tabs and two file panes, search/go-to-line, wrap, useful copy and explicit links to captured work and repository context. Preserve agent history in the background. Current disk is never historical evidence.

Editing is a local memory-only draft, never a direct daemon write. Bound drafts, reject redacted/inconsistent/oversized source and preserve drafts through ordinary Workspace close/reopen. Preparing an edit or command only populates the existing native composer; submission/idle acknowledgement/harness approval still require the normal explicit user flow. Do not start a native turn, attach arbitrary terminals, weaken native policy, or add a shell/PTY endpoint. Default command requests to workspace root, with an explicit selected-file directory option. User arguments remain text passed to the native prompt; Drishya does not interpolate or execute them.

Source bodies/drafts do not enter navigation memory/localStorage. Keep content-shaped reading windows resizable/viewport bounded, use matching padding and useful controls. Remove source-range form controls where ordinary selection/page copy already cover the task; retain exact line numbers and find.

## Validation and review

Implemented on the shared Legacy/Modern foundation. Canvas remains its independent observation experience. The restored centered session header remains unchanged by this workspace work.

| Before | After | Why |
| --- | --- | --- |
| Quick source reading required a separate dialog per file | Files can open a bounded eight-tab Workspace with two resizable panes | Compare real current files without opening an external editor for a small investigation. |
| Returning to a remounted document reset its controls | Per-pane/path page, query, line, wrap and scroll are retained in bounded navigation memory | Leave and return without losing reading context; do not retain source bodies there. |
| Source-range controls duplicated text selection | Keep line numbers, ordinary selection and page copy; collapse import context in the quick reader | Reduce chrome and give content more space. |
| Desktop split became two cramped stacked phone panes | One active pane and a visible pane switch on narrow screens | Prioritize usable reading height over displaying both files at once. |
| No in-product small correction draft | Complete bounded UTF-8 source can become a memory-only local draft | Support a precise correction request without silently changing disk. |
| Hidden draft capacity/lifetime | Eight-draft shelf, explicit discard, lost-on-reload notice and deliberate text download | Never silently evict user work; do not imply durable autosave. |
| Source and relation navigation fragmented | Reuse qualified current-index imports in the desk, with captured-work/map exits | Make existing evidence-backed relationships useful while comparing files. |
| Rootless recording led to an unavailable reading surface | Offer captured files and Back to agent | Retain honest provenance while giving a useful recovery destination. |
| No command-preparation workflow | Command plus arguments and root/selected-file directory prepare the existing native prompt | Keep real execution, policy and approval in the harness. |

### Exact supported limits and ownership

- Current reading reuses the approved indexed-text API: 200 lines/page, up to 2 MiB, root/symlink/protected-path checks and redaction before display. Fatal UTF-8 decoding preserves a genuine BOM and rejects malformed source rather than using replacement characters.
- Draft creation exhausts the complete file, up to **1,000 lines/32 KiB UTF-8**, rejecting redaction, missing/inconsistent pages and observed version changes. CRLF, final newline and BOM are preserved. A slower second pane cannot replace a draft already created/edited by another pane.
- At most **eight source-scoped drafts**, isolated by session/path, with no automatic eviction. They survive ordinary tab/desk close, not page reload/source disposal. Download is an explicit local text export; it is not saving into the repository.
- “Review in native prompt” appends a replacement request and exact-base SHA-256 to the existing composer. **The SHA comparison is an instruction to the native agent, not an enforced atomic patch or guaranteed conflict check.** The source API/daemon still has no write endpoint.
- “Prepare request” for commands does not execute a process. The requested directory and arguments are literal prompt data. No terminal/PTY, arbitrary process launcher or change to native policy was introduced. Submission still uses the selected harness's existing consent, idle-client acknowledgement, approvals and stop lifecycle.
- Workspace holds viewport follow and hides the canvas/composer while reading; capture/history continue. Back to agent restores the shared visualization. This remains an internal mode switch, called out as future integration work in 83.
- Native account and human usability acceptance remain open. This desk is a lightweight source/comparison/correction surface, **not an IDE/terminal replacement**.

### Local verification and limits

Both typechecks, production build and 395-unit full check pass; the subsequent concurrent-draft regression adds one passing test (396 total represented). Final focused browser integration: **45 passed**, including two actual captured sessions; details are recorded in STATUS. Browser journeys check tabs/split/narrow layout, retained wrap/search, local draft/download, command directory, prompt preservation, unchanged disk and **zero native submissions** while preparing requests.

The opt-in `workspace-real-review.spec.ts` reads an existing local redacted store through explicit environment variables. It imports no journals and starts no native turns. Actual Codex and Claude histories must show a visible captured action/prose, not merely an allocated history container, before screenshots. Codex's captured root supports two current files. The older Claude capture has no captured root; the test verifies truthful unavailability and the captured-reading recovery instead of guessing a folder. Private IDs/stores/screenshots are not committed.

Three fresh independent reviewers assessed developer usefulness, UI/readability, workflow, adoption and map value. Their complete prioritized synthesis is [83](83-independent-developer-review.md). Separate code review found incomplete-file loading, reader shortcut interference, malformed UTF-8 and concurrent draft creation issues; all were corrected with regression coverage. Motion feel, assistive technology, real native lifecycle, physical low-resource and other platforms are not certified by these checks. CUA was unavailable; source, repository-owned Playwright journeys and rendered frames are the evidence. No hosted CI or user artwork/package/spreadsheet staging.
