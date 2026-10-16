# 82 — Developer feature audit

16 October 2026 · Harsh with Codex · audit only

## Scope and how to read the results

This is a static audit of repository code, pinned to `b3184bd` on `main`
(`workspace: preserve reading context and harden local recovery (#67)`). The
checkout advanced from the reliability branch during the audit. I checked the
intervening implementation changes; they do not change the classifications below.
Later work by another builder is outside this snapshot.

Read in the requested order: CONTINUITY, STATUS, DEVELOPER_WORKSPACE,
PRODUCT_DELIVERY, CODEBASE, then [proposal 19](19-developer-feature-proposals.md).
Those documents supplied the requirements and context. The evidence below comes
from source and test bodies, not their implementation claims.

- **Built:** the requested user-facing capability works in an active entry, to
  the scope described here. This is not a release or accessibility certificate.
- **Partly built:** there is a usable slice or a limited substitute, with the
  missing parts stated explicitly.
- **Not built:** no implementation of the feature's defining workflow was found.
  Shared data, a filter or a helper alone does not count as that feature.
- Tests named below were **read, not run**. A related test does not prove a
  missing feature exists. No runtime, browser, performance or CI pass is claimed.

The active entry matters: `apps/ui/src/main.tsx` loads shared Classic/Canvas or
`modern/entry.tsx`; `ModernApp` in that entry reuses `classic-entry.tsx` and `App`.
The old `fresh/FreshApp.tsx` and independent Modern library/map are not mounted.
For example, a bookmark button in the retired Fresh screen and Compact spacing
in retired presentation settings do not make those controls available today.

The repository also contains an opt-in native controller. That is real code,
despite older observe-only descriptions. Nothing in this audit invokes it, and
every recommendation below is limited to observation and local review.

## Part 1 — Status of every feature

**Totals: 2 Built, 14 Partly built, 9 Not built — 25 items.**
The 18 numbered proposals account for 0 Built, 11 Partly built and 7 Not built.
The seven polish items account for 2 Built, 3 Partly built and 2 Not built.
Each polish item counts once. Overlap is included in the final column.
In table cells, shortened `components/`, `lib/` and `modern/` paths are relative
to `apps/ui/src/`; shortened `Home.tsx` and `App.tsx` references retain the UI
directory named immediately before them.

| # | Feature | Status | Evidence (files/tests) | What's missing |
| --- | --- | --- | --- | --- |
| 1 | Agent blame | Not built | Overlap only: `packages/projection/src/reduce.ts` — `completeOp`, `crossLinks` produce patches, before/after artifacts, same-file and nearby-prose links; `apps/ui/src/lib/file-evidence.ts` — `fileEvidence`; `packages/scene/src/verification.ts` — `verificationFor`. Related tests: `apps/ui/test/file-evidence.test.ts`, `packages/scene/test/verification.test.ts`. No line-to-writer function or blame gutter found. | No changed-line attribution across patch chains, replacement tracking, or line → operation → prompt journey. File history and P2-C cover file-level evidence and later checks. Nearby reads/prose cannot answer “why” as a captured cause. |
| 2 | Tripwires | Not built | No rule evaluator, local rule configuration, hit model or tripwire UI/tests found in `apps`, `packages` or `tests`. `packages/projection/src/shell.ts` — `classifyShell` classifies commands; `packages/privacy/src/index.ts` redacts content. These are not tripwire implementations. | Need evidence-linked rule matches and configuration. Failed-operation review and verification freshness overlap review needs, but neither flags sensitive edits, skipped tests or dangerous command text. |
| 3 | Review packet | Partly built | `apps/ui/src/components/EvidenceReview.tsx` — `EvidenceReview`, `ReviewContent`; `packages/scene/src/since.ts` — `sinceSnapshot`; `apps/ui/src/components/GitReview.tsx` — `GitReader`, its `handoff`; `apps/daemon/src/git-review.ts` — `GitReview`; `apps/daemon/src/app.ts` — `App.exportBundle`. Tests: `tests/browser/product-workspace.spec.ts` (“first-visit evidence review…”), `tests/browser/git-review.spec.ts`, `apps/daemon/test/git-review.test.ts`, `apps/daemon/test/export.test.ts`. | Review work lists captured changed files/checks; Git handoff previews/saves explicitly reviewed **current Git patches on one page**. Neither is doc 19's net captured-session diff with chain-gap, blame, read, check and tripwire links. Replay bundle export is a different format. P2-A and file comparison already cover parts of catch-up/review. |
| 4 | Stuck/loop detector | Not built | No repetition/window counter, loop threshold settings or detector UI/tests found. `packages/scene/src/since.ts` — `sinceBoundary` lists unfinished work; `packages/projection/src/reduce.ts` — `crossLinks` can connect changed test outcomes. Neither counts loops. | No repeated-command, repeated-edit, revert-cycle or no-new-file signal. Pending status and capture idle are not proof of a stuck agent. The existing activity timeline is navigation, not detection. |
| 5 | Mission control | Partly built | `apps/ui/src/components/Home.tsx` — `Home`, `RecordingRow`, `HealthTag`; `components/SessionGroups.tsx` — `SessionGroups`; `modern/ModernSessions.tsx` — `ModernSessions`; `App.tsx` — `useLiveUpdates`; `apps/daemon/src/server.ts` — `startServer` SSE/recordings routes; `apps/daemon/src/history.ts` — `HistoryService.summary`. Tests: `tests/browser/home-groups.spec.ts`, `tests/browser/fresh-workspace.spec.ts` (“Modern home has one sessions list…”), `apps/daemon/test/server.test.ts` (“reports each recording's capture state”). | There is a live-updating session inventory, project/date grouping, source time and capture health. No all-session wall of current action/files/tripwires, reliable agent working/waiting states or cross-worktree conflict warnings. `reduce.ts:crossLinks` emits `observed-write-overlap` inside a projection; it is not a live global conflict service. |
| 6 | Turn report card | Not built | Overlap only: `apps/ui/src/components/Viewer.tsx` — `PromptNavigation`, `Briefing`, `summarize`; `components/PromptRail.tsx` — `PromptRail`; `packages/scene/src/history.ts` — `historySummary`; `packages/projection/src/reduce.ts` — `buildPassages`. Tests: `tests/browser/product-workspace.spec.ts` (“paged prompt rail spans the full session…”), `apps/daemon/test/history.test.ts`. | No per-prompt report rows, per-kind counts/duration/checks/last-failure calculation, sortable table or cross-session turn comparison. Whole-recording/since-step facts and prompt chapters are useful prerequisites, not report cards. |
| 7 | Editor-grade reader | Partly built | `apps/ui/src/components/ArtifactReader.tsx` — `ArtifactReader`, `DiffReader`; `components/common.tsx` — `CodeView`, `ProvenanceBadge`, `useArtifact`; `components/SourceFind.tsx` — `SourceFind`; `components/ReadingReference.tsx` — `ReadingReferenceProvider`; `components/SessionWorkspace.tsx` — `CurrentFileReader`, `CurrentDocument`; `components/EvidenceNavigation.tsx` — `EvidenceNavigationProvider`; `apps/daemon/src/workspace.ts` — `WorkspaceAccess.read`. Tests: `tests/browser/stored-find.spec.ts`, `tests/browser/connected-workspace.spec.ts` (“current source reading finds…”), `tests/browser/product-workspace.spec.ts` (“source preview opens the exact stored range…”), `apps/ui/test/evidence-navigation.test.ts`. | Bounded captured/current source, DOM syntax/line numbers, paging, find, go-to-line, copy/pin range, resizable reading and Back/Forward exist. Missing editor-style multi-file tabs/restore, symbol breadcrumbs/sticky function, minimap, evidence gutter, full shortcut set and editor deep links. Some readers remain dialogs. Source navigation and the temporary range reference cover substantial W1 work. |
| 8 | Explorer tree | Partly built | `apps/ui/src/components/SessionWorkspace.tsx` — `FolderExplorer` builds/discloses folders, virtualizes rows, handles arrow/Home/End keys and opens current/captured readers; `components/FileIcon.tsx` — `FileIcon`; `components/Origins.tsx` — `Origins` can use visible `[data-spine-path]` rows as origins. Tests: `tests/browser/connected-workspace.spec.ts` (“selected workspace folders read current files…”), `tests/browser/fresh-workspace.spec.ts` (“Modern map camera and folder keyboard state survive a session detour”). | The real bounded tree and reading route exist. Missing R/E/T/failure badges and folder rollups, touched/edited/failing filters, and a fully shared selected-file highlight across tree/map/reader. `WorkbenchSources` supplies separate loaded-window read/change counts; those are not whole-session tree badges. |
| 9 | Flow graph with semantic zoom | Partly built | `apps/ui/src/components/MapCanvas.tsx` — `MapCanvas`, local `zoomGroup`, `fitWorld`, `zoomCamera`; `lib/map-detail.ts` — `mapDetail`; `lib/map-focus.ts` — `observedGraph`, `importConnections`, `neighborhoodGraph`; `components/FlowConnections.tsx` — `FlowConnections`; `lib/canvas-layout.ts` — `canvasLayout`, `connectorPath`. Tests: `apps/ui/test/map-detail.test.ts`, `apps/ui/test/map-focus.test.ts`, `tests/browser/connected-workspace.spec.ts` (“a large repository groups spatial density…”), `tests/browser/map-fit.spec.ts`. | Zoom reveals spatial-density groups/files, heat, real imports and DOM readers. Groups deliberately cross directories; they are not doc 19's folder clusters. Order connectors are on action surfaces, not a session route across the repository. Missing that route, a unified typed-link legend and the complete fit-working-set/navigation set. Existing graph exploration is real; the React Flow proposal is not implementation. |
| 10 | Single-file time travel | Partly built | `apps/ui/src/components/FileHistory.tsx` — `FileHistory`, `FileWorkspace`, `EvidenceColumn`; `lib/file-evidence.ts` — `fileEvidence`; `apps/daemon/src/history-worker.ts` — `file`; `apps/daemon/src/history.ts` — `HistoryService.file`; `packages/projection/src/patch.ts` — `applyHunks`, `diffTexts`. Tests: `tests/browser/product-workspace.spec.ts` (“file comparison reads real daemon artifacts…” and “distant file moments compare…”), `apps/ui/test/file-evidence.test.ts`. | Global 24-action file-history pages and two retained captured evidence choices work, with replay cutoffs and provisional state labels. Missing a state slider/previous-next state journey and automatic successive-state diff. Patch reconstruction is qualified; missing bases cannot become complete file history. |
| 11 | Symbol timeline | Not built | `packages/indexer/src/index.ts` — `jsImports`, `pythonImports`, `resolveJs`, `resolvePython`, `buildGraph` extract/resolve **imports**, not declarations/references. `apps/ui/src/components/ImportContext.tsx` — `ImportContext` exposes file imports. `packages/indexer/test/indexer.test.ts` tests import indexing; no symbol extractor, symbol-history query or symbol UI/tests found. | Need supported-language symbol extraction, revision/range identity and evidence-qualified matching to reads/edits/failures. File import navigation and filename history do not supply function history. |
| 12 | Cross-session search | Partly built | `packages/store/src/index.ts` — `Store.search`, `searchableText`, FTS5 creation in `Store`; `apps/daemon/src/server.ts` — search handler in `startServer` searches the selected ID or `+` selection; `apps/ui/src/components/Viewer.tsx` — `Search`; `Home.tsx` — metadata-only `matches`. Tests: `apps/daemon/test/server.test.ts` (“serves the projection, artifacts, graph and search”), `tests/browser/product-workspace.spec.ts` (“recording search separates captured work…”). | Search spans an explicitly combined selection, but there is no all-local-recordings search destination, recording-qualified result DTO/paging or structured failed-command/path filters. Home searches title/root, not evidence. FTS indexes bounded selected fields, not every artifact or output, so it cannot promise exhaustive test-failure searches. |
| 13 | Bookmarks and notes | Partly built | `apps/ui/src/components/ReviewQuestions.tsx` — `ReviewQuestionEditor`, `ReviewQuestionsEntry`; `lib/review-questions.ts` — `readQuestions`, `saveQuestion`; `components/ReadingReference.tsx` — `ReadingReferenceProvider`; `lib/workspace-memory.ts` — `WorkspaceMemory`, `workspaceMemory`; `packages/store/src/index.ts` — `Store.addBookmark`, `Store.bookmarks`; bookmark GET/POST handlers in `apps/daemon/src/server.ts:startServer`. Tests: `tests/browser/review-questions.spec.ts`, `apps/ui/test/review-questions.test.ts`, `apps/ui/test/workspace-memory.test.ts`, `apps/daemon/test/server.test.ts` (“redacts bookmark notes before storing them”). | Operation-anchored local questions survive reload, resolve explicitly and reopen evidence; one source range can be pinned temporarily. Store bookmarks are step/note records, but active `DataSource`/UI has no bookmark browser/create journey. Missing durable arbitrary range bookmarks and restart-safe resume. P2-A seen marks remain separate and explicit; they are not bookmarks. |
| 14 | Command ledger | Not built | Overlap only: `apps/ui/src/components/History.tsx` — `OpCard`, `ExpandedOperation`; `components/TerminalPreview.tsx` — `TerminalPreview`; `components/Inspector.tsx` — `Detail` shell/test cases; `lib/compound-focus.ts` — `focusKind`. `packages/adapter-codex/src/index.ts:parseShellOutput` captures duration when available, but `OperationDetail` in `packages/contracts/src/index.ts` has no shell cwd/duration fields. Related test: `tests/browser/product-workspace.spec.ts` (“failed shell preview surfaces buried captured errors…”). | Commands, exits, input/output artifacts and filtering exist, but no whole-session command table, cwd/duration columns, tripwire column or copy-as-script. A shell filter is not a ledger; recognized test commands also live under kind `test`. |
| 15 | Session compare | Partly built | `apps/ui/src/components/Workspace.tsx` — `AgentOverview`; `components/Home.tsx` — combined-selection `openRecording(picked.join('+'))`; `packages/projection/src/reduce.ts` — combined `reduce`/`crossLinks` and per-recording file identity handling; `apps/daemon/src/app.ts` — `App.exportBundle`. Tests: `tests/browser/product-workspace.spec.ts` (“agent ownership shares one history…”), `apps/daemon/test/export.test.ts`. | Bounded agent ownership cards compare shown actions/changes/failures/files, and selected sessions can share a chronology. No two-session side-by-side task comparison, complete independent totals, elapsed/tool/test comparison or task-equivalence selection. “Shown” counts correctly avoid claiming a resident page is the full session. |
| 16 | Cost and usage, only if captured | Partly built | `apps/ui/src/components/Viewer.tsx` — `UsagePeek`; `apps/daemon/src/controller.ts` — `HarnessController.message`, including Claude result usage and Codex `thread/tokenUsage/updated`; `apps/daemon/src/native-types.ts` — `NativeUsage`. The passive Codex adapter's ignored record sets in `packages/adapter-codex/src/index.ts` include `token_usage_record`/`token_count`; no usage projection in `packages/projection/src/reduce.ts`. Native transport tests: `apps/daemon/test/controller.test.ts`; no historical usage-accounting test found. | The connected runtime can report tokens/cache/context/thread totals and reported Claude cost, with “Not reported” fallbacks. No imported-journal per-turn/session usage ledger or “cost of this fix.” This is an ephemeral native receipt, not historical captured accounting. No silent price estimate was found. |
| 17 | Commit/PR links | Not built | No extractor or operation → commit/PR model/UI/tests found. `apps/ui/src/lib/markdown.tsx` — `inline` renders Markdown links as a text `span`; `components/ToolOutput.tsx` — `ToolOutput` formats output without commit/PR extraction. `apps/daemon/src/git-review.ts:GitReview` reads **current** branch/HEAD/patches; it does not attribute them to a captured command. | Need validated hashes/URLs from actual captured commit/PR output, linked to that operation. Raw visible text and current HEAD are not this feature, and current HEAD cannot stand in for missing historical output. |
| 18 | Capture completeness meter | Partly built | `apps/ui/src/components/Home.tsx` — `HealthTag`; `components/Inspector.tsx` — `Inspector`, `Detail` unknown-outcome states; `components/common.tsx` — `viewOf`, `ProvenanceBadge`; `components/EvidenceReview.tsx` — `ReviewContent` capture-gap group; `components/SinceMark.tsx` — `SinceMarkSection`; `packages/scene/src/since.ts` — `sinceSnapshot`; `packages/ingest/src/index.ts` — `Ingestor`; observations retain redaction notes in `packages/store/src/index.ts:Store.appendObservations`. Tests: `apps/daemon/test/server.test.ts` (“reports each recording's capture state”), `packages/scene/test/since.test.ts`, `apps/ui/test/artifact-cache.test.ts`. | Health, gaps, missing results, redacted/partial/unavailable artifacts are disclosed in different places. Missing a per-session summary with result-bearing/total-operation denominator and redaction counts. Any percentage must describe available evidence, never unknown activity outside capture. |
| P1 | Command palette | Partly built | `apps/ui/src/components/WorkspaceNavigation.tsx` — `WorkspaceNavigation` handles Ctrl/Command-K, keyboard selection, up to 40 file/session/destination matches; `App.tsx` — `useKeyboard`. Test: `tests/browser/workspace-navigation.spec.ts` (“keyboard navigation opens exact captured file work…”). | Real navigation palette exists, including Review work/questions, current Git and settings. No unified turn jump, direct tool filtering, theme command or map toggle set; map entry currently opens exploration. Search and prompt navigation cover separate parts. |
| P2 | Keyboard-first plus cheat sheet | Partly built | `apps/ui/src/App.tsx` — `useKeyboard`; `components/WorkspaceNavigation.tsx` — `WorkspaceNavigation`; `components/SessionWorkspace.tsx` — `FolderExplorer` keyboard tree; `components/ProductShell.tsx` — `ReadingDialog`, `Settings`, `CanvasSettings` shortcut lists; `components/ReadingResize.tsx` — `ReadingResize`. Tests: `tests/browser/interface-craft.spec.ts`, `tests/browser/workspace-navigation.spec.ts`, `tests/browser/fresh-workspace.spec.ts` (folder keyboard state). | Important controls, focus return, Escape, navigation and resizing work. No `?` cheat-sheet handler/overlay or complete doc 19 Ctrl-P/G/F, F8 and Alt-Left reader workflow. Settings shortcut text is useful but does not establish keyboard-first coverage everywhere. |
| P3 | Density setting | Not built | Active `apps/ui/src/components/ProductShell.tsx:Settings` and `state.ts` expose resources, motion, map, hover and themes, not comfortable/compact density. `apps/ui/src/modern/presentation.tsx:PresentationSettings` has `compact`, but its consumer is the retired `fresh/FreshApp.tsx`; active `modern/entry.tsx` does not mount it. No active density test found. | Need one persisted density preference and readable layout tokens across active presentations. Low resource mode changes cache/overscan and map/motion; it is not a density setting. Existing compact styling is not a selectable preference. |
| P4 | Activity timeline | Built | `apps/ui/src/components/Viewer.tsx` — `ActivityTimeline`; `lib/activity.ts` — `sampleActivity`; `packages/scene/src/index.ts` — `markers`, `nextMarker`; `components/CanvasWorkspace.tsx` — `CanvasWorkspace` bottom tick/navigation composition. Tests: `apps/ui/test/activity.test.ts`; `tests/browser/product-workspace.spec.ts` (“history activity timeline opens recorded failures and edits…”); `tests/browser/canvas-workspace.spec.ts`. | Requested edits/failures/passes and click-to-open exist. The strip is deliberately bounded to 400 marks and disclosed as sampled for long histories; it is not an exhaustive index. Shared Classic/Modern places it under Navigate history rather than permanently along the bottom. |
| P5 | Theme set | Built | `apps/ui/src/components/ProductShell.tsx` — `THEMES`, `Settings`, `ProductShell`; `apps/ui/src/state.ts` — `setTheme`, `storedTheme`; `lib/theme.ts` — `mapPalette`, `useResolvedTheme`; palette rules in `apps/ui/src/product.css`, `atelier.css`, `canvas.css` and `modern/surroundings.css`. Tests: `tests/browser/product-workspace.spec.ts` (“explicit themes persist independently of the OS…”), `tests/browser/fresh-workspace.spec.ts` (“Modern colour and UI versions remain separate…”). | Jet Black, Midnight and Paper/Light are working named alternatives in shared Legacy/Modern, with syntax/semantic colors; Canvas offers Dark/Light/System. Palette details differ from the old champagne-gold proposal. This is implementation, not a full contrast/accessibility certification. |
| P6 | Instant open | Partly built | `apps/ui/src/state.ts` — `openRecording` saves/restores a session location; `lib/workspace-memory.ts` — `WorkspaceMemory`; `components/History.tsx` — `History` anchor memory; `App.tsx` — boot/hash handling; `lib/local-preview.ts` — `localPreviewId`. Tests: `apps/ui/test/workspace-memory.test.ts`; `tests/browser/fresh-workspace.spec.ts` (“Modern keeps file evidence, search controls and reading position across session detours”); `tests/browser/product-workspace.spec.ts` (“local preview reopens actual imported evidence…”). | Returning during the current app lifetime restores bounded reading context. Memory is a WeakMap, not durable storage. No general last-session auto-open plus exact position after browser restart. A recording URL or explicit saved local-preview ID is not full instant resume. |
| P7 | Quiet notifications | Not built | No browser `Notification` permission/request/dispatch, event sound, selected-event preferences or notification deduplication found in active UI or tests. `components/CanvasWorkspace.tsx:CanvasWorkspace` has an in-app notice/status banner; `App.tsx:ConnectionNotice` has recovery messages. | In-app error/copy/recovery feedback does not implement opt-in failure/stuck/tripwire/turn-finished notifications. The activity timeline is the existing quiet way to find those recorded outcomes. |

### Important differences from the documents

1. Doc 19's “Nothing here is implemented” is an old proposal disclaimer, not a
   current inventory. Several slices and two polish capabilities now exist.
2. PRODUCT_DELIVERY's themes, activity timeline, source navigation, pinning and
   file comparison have real implementation. Its older complete-project counts
   and descriptions must not be treated as current test results.
3. The developer-workspace docs still describe richer tabs, symbol navigation and
   durable bookmarks as future work. I found no active implementation completing
   them. `EvidenceTrail` is bounded Back/Forward memory, not editor tabs.
4. Historical Modern docs mention compact-spacing settings and an independent
   reader/map. Those modules remain in source but the active entry does not use
   them. Counting every exported component would overstate shipped capability.
5. P2-C already answers which runs were recorded after a change and whether a later
   edit made that ordering stale. It does not establish test coverage. P2-A already
   supplies explicit-mark catch-up. Neither should be rebuilt under a new name.
6. The repository-map/React Flow proposal is a document. No React Flow focus view
   or renderer migration is counted as built by this audit.

## Part 2 — Five next features with the best value for effort

Sizes are estimates for a bounded first useful version, including local tests,
not delivery promises. “Small” means a few days; “medium” means about a week;
“large” means more. Full doc 19 scope can be larger than its first version.

All new global queries must operate behind the existing worker/store boundary.
The resident browser projection is sometimes only one history window. Never
report window counts as full-session counts or fetch every session into the UI.

### 1. Tripwires — factual review flags, with a small first rule set

**Why:** a reviewer should be able to find a CI/auth/lockfile edit or a captured
force-push command without reading every action. This directly reduces review
work and draws attention to evidence that deserves a human decision.

**Size:** medium, about a week for paths, selected command patterns and explicit
added/removed skip markers. The expected-value/failing-assertion example and a
general custom-rule language are larger and should not be promised in that slice.

**Reuse:** `Operation.paths`, captured shell/test command text and edit hunks;
`HistoryService`/history worker; `EvidenceReview`, existing operation selection,
artifact paging and shared privacy functions.

**New work:** a pure, versioned matcher returning rule ID, operation/observation
identity, matched text/range and limitations; worker evaluation; a bounded
read-only hits endpoint; a review section. A small validated local JSON rule file
and local settings API are configuration, not captured observations. Bound rule
count/input size; avoid arbitrary executable rules or unbounded user regexes.
No event schema or SQLite migration is needed for that design.

**Rules check:** observe-only; evaluate already-redacted evidence and disclose
that redaction can hide matches. Label hits as derived pattern matches. “This
patch added a skip marker” is supported; “the agent cheated” is not. Do not call a
no-hit result safe. No automatic model calls, telemetry, command execution or
agent steering; matched text stays DOM. Pass, to this limited scope.

### 2. Command ledger — a paged command review, not a runner

**Why:** developers often need the exact failed command, output and available
execution context. A table with filters is faster than hunting through shell
cards and also lets them copy a command into their own terminal deliberately.

**Size:** small for a command/status/output ledger; medium if including truthful
cwd/duration columns and export across long sessions.

**Reuse:** captured tool calls/results; `parseShellOutput`; shell **and test**
operations; output/input artifacts; `HistoryService`, `ArtifactReader` and
`TerminalPreview`. Existing captured input artifacts matter when command previews
are truncated.

**New work:** a pure paged row projection and worker/read-only endpoint, plus a
table and copy control. The current `OperationDetail` drops cwd/duration. Join
existing sanitized observation fields where actually available rather than guess
from the repository root. A later optional derived DTO can expose those values
without changing the observation schema. Distinguish a captured duration from a
derived source-time interval. Show unavailable for both when absent.

Copy-as-script must be restricted to deliberately selected complete commands;
warn about different cwd/missing commands and unknown outcomes. Do not join
truncated command previews into something that looks runnable. No store/schema
migration is needed for the first version.

**Rules check:** observe-only, no Run button. Preserve exact command text and
captured/derived/unknown labels; no claim that an exit code verifies the change.
No causes, safe badge, telemetry or remote export. Table/output text stays DOM.
Pass.

### 3. Cross-session search — search the local evidence you already imported

**Why:** “where did we touch this path last week?” is a daily senior-developer
question. The FTS index is already paid for, but the current search starts inside
one selected recording or combined selection.

**Size:** small for all-recordings text search with recording-qualified results;
medium for structured “this command failed” and complete file-touch queries.

**Reuse:** Store's sanitized FTS5 rows, recording metadata, search snippets,
operation/observation identities, existing history-window navigation and the
Search component's stale-response handling.

**New work:** a bounded read-only all-recordings query/API returning recording ID,
observation ID and result position/cursor; project/date/harness scope and an entry
on Home. Include a usable result cap and continuation. Structured failure queries
need derived operation/status indexing or worker work; plain FTS text is not an
exit-status database. Do not silently search raw harness files or promise to
search complete artifacts using `searchableText`'s bounded index.

The first slice needs no observation schema change and can reuse the current
store schema. Any later derived index/migration should be reviewed separately.

**Rules check:** searches redacted local evidence only. A hit is a match, not a
cause; show recording identity and open the exact captured point. Search metadata
must not leak later evidence into replay. No telemetry, model calls or automatic
sharing. Results and snippets stay DOM. Pass.

### 4. Repeated-work signals — start narrower than a “stuck detector”

**Why:** repeated failed commands are worth a human glance while work continues.
A reviewer can intervene in their own harness; Drishya need not control it.

**Size:** small for exact repeated commands and repeated file edits; medium for
threshold settings, a worker summary and a quiet live signal. Reliable revert
cycles need complete matching patch/state evidence and are later work.

**Reuse:** command text/status, agent identity, source timestamps when present,
file write references, committed revision updates and the history worker.

**New work:** a pure function with injected time/cutoff, thresholds and stable hit
IDs, a bounded read-only worker response, and an opt-in in-app chip/list. Scope
comparisons to recording/agent/turn/worktree, preserve exact text or disclose any
normalization, and avoid equating different cwd invocations. If timestamps are
missing or incomparable, report an operation count, not “in six minutes.” Cache
by revision/rule version; do not rescan the whole browser projection on each paint.
No observation/store schema change is needed. OS toasts are a separate opt-in
polish task, not part of this first slice.

**Rules check:** label “same captured command failed four times,” not “agent is
stuck,” “wasting money,” or “no progress.” Do not count capture gaps as inactivity
or infer causes from repetition. No intervention, safe claims or telemetry; DOM
text and static/reduced-motion states. Pass in this factual form; drop autonomous
intervention or claims about intent.

### 5. Turn report cards — a factual index of prompts and outcomes

**Why:** it gives the reviewer an entry point for “what did this request produce?”
without replaying the session. It also creates reusable turn summaries for future
mission control and review packets.

**Size:** medium for a single-session paged table; cross-session sorting is a
later medium-sized extension. It is not a prompt-quality scoring system.

**Reuse:** existing `TimelineItem` turns, operation start/end sequences, agents,
paths, test outcomes, `historySummary`, verification freshness and prompt-jump
navigation. Use global worker data, not the loaded passage window.

**New work:** a pure per-agent turn summarizer with a documented boundary rule,
worker query/API and sortable bounded rows. Handle overlapping turns/helpers and
operations finishing after the next prompt explicitly; uncertain assignment
stays unassigned. Show observed start-to-end intervals only when both boundaries
exist. Add tripwire counts only once their matcher exists. No observation or
store schema change is required for this derived view.

**Rules check:** report counts and ordering, not prompt effectiveness, causal
credit, code safety or test coverage. Keep the exact prompt reference and derived
metrics distinct. Read-only and local, no model calls/telemetry, all text in DOM.
Pass.

### Schema and scope summary

The five bounded versions above need UI plus pure derived functions and bounded
API/worker integration. **None requires changing the observation schema.** A
derived response type or optional derived index is not a new captured fact.
Historical token accounting, new captured symbol/diagnostic fields, or previously
uncaptured terminal facts must not be slipped into those tasks: any observation
schema change still needs both builders to agree.

### Does doc 19's suggested order still fit?

Only partly. It assumes the reader, explorer and basic review foundation are
mostly absent. Those foundations now do useful work. Rebuilding them first would
delay the genuinely missing review tools. Conversely, line blame and a net
captured-session packet remain more involved than a current Git export.

My corrected order is:

1. Fix any concrete reading/recovery defects found in real use; preserve the
   already-built reader, tree, themes and activity timeline. This is maintenance,
   not a fresh feature rebuild.
2. Tripwire first slice, command ledger and all-recordings text search. Each is an
   independently reviewable task; none needs a new renderer.
3. Repeated-work signals, then single-session turn cards using those derived facts.
4. Finish durable bookmarks/resume and a simpler previous/next file-state journey.
   Complete palette/keyboard coverage and density as small supporting work.
5. Build the captured-session review packet with complete-chain checks. Add line
   blame only for demonstrably captured patch chains; show unknown elsewhere.
6. Add mission-control summaries and fuller session comparison once shared summary
   DTOs exist. Prototype further graph changes only against a concrete navigation
   problem and the existing map; keep proposal review separate from adoption.
7. Supported-language symbol navigation/timelines and historical token accounting
   follow explicit evidence/contract design. Notifications come after reliable
   events and opt-in/deduplication behavior, not before them.

The top five are a value/effort recommendation, not permission to implement them
or to supersede the current visual direction.

## Part 3 — Two ideas outside doc 19

These are additional proposals, not claims of existing features. Neither replaces
or relabels a missing item above.

### A. Compare captured evidence with the current file

**Developer value:** “is the code I am reviewing still the code on disk?” A senior
reviewer should not need another editor just to see that a file changed after the
recorded action. Doc 19's time travel compares historical moments; this compares
one explicitly chosen historical reference with an explicitly current read.

**Size:** medium. Reuse `FileHistory`, `WorkspaceAccess.read`, existing current-file
consent, `ArtifactReader`, and `packages/projection/src/patch.ts:diffTexts`. Current
code offers a button to leave history for disk and two historical comparison
columns, but no captured-versus-current comparison in the same view.

**New work:** an explicit comparison mode, bounded sanitized input gathering and
in-memory diff. Compare only matching verified ranges or complete available
snapshots within a stated byte/line budget. A 200-line source page is not a whole
file. Keep current freshness metadata, recheck before refresh and reject stale
async results. Existing read APIs can supply the first bounded slice; no
observation or store schema change is needed.

**Rules check:** read-only after existing workspace consent; captured and current
remain separately labelled, including while replaying. Differences are not
automatically attributed to the agent and never imply a safe/currently-tested
version. No telemetry/cloud calls, source text stays DOM. Pass. Missing captured
bases produce “comparison unavailable,” never a reconstructed guess.

### B. Review progress that becomes stale when its captured evidence changes

**Developer value:** a reviewer can see which already-reviewed captured changes
need another look after later activity. Bookmarks remember a place; this remembers
the exact evidence reviewed and whether that same evidence is still the selected
review target.

**Size:** medium. Reuse the exact-fingerprint/previous-note pattern in
`apps/ui/src/lib/git-review-marks.ts` (`readReviewMarks`, `previousReviewNote`,
`updateReviewMark`), existing review questions, file trails and artifact identities.
That pattern currently covers **current Git patches**, not captured-action review
progress.

**New work:** a bounded local review-progress model scoped to recording, operation,
artifact/range and evidence fingerprint, plus explicit reviewed/stale/unavailable
states. Later recorded edits can say “later change recorded” while retaining the
older reviewed reference. Keep notes when material changes; do not silently carry
the reviewed state forward. A first version can use redacted browser-local metadata;
portable/restart-safe storage needs a separate local metadata design. No new
captured observation or observation schema change is required.

**Rules check:** marking reviewed is a user action, distinct from P2-A seen marks
and test coverage. Staleness describes identity/order, not a regression or cause.
No automatic resolution, agent control, telemetry or sharing; labels and evidence
stay DOM. Pass. A “reviewed” mark must never become “safe to merge.”

## Audit limits and delivery

No source code, configuration, dependencies, other documentation, native session
or recording was changed by this audit. The only deliverable is this uncommitted
file. No tests, CI, Git commit, push or PR action was run for it. Source/tests were
inspected; the report does not inherit old pass counts from STATUS.

For absent features, negative evidence means no implementing path was found in
the inspected active entry graph, packages and feature-related tests. It does
not mean a useful helper cannot be reused. Follow-up acceptance still needs the
actual human reviewing workflow, supported harness evidence and existing
performance, privacy and accessibility checks.
