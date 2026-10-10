# Developer angles, coverage and the next product plan

10 October 2026 · Builder-requested analysis after the two independent reviews · **Plan, not new implementation**

Read [40](40-independent-product-review.md) for firsthand reviewer findings, [39](39-native-workspace-completeness.md) for native/capture boundaries, and [DEVELOPER_WORKSPACE](../DEVELOPER_WORKSPACE.md) for the existing staged backlog. This document orders product improvements; it does not replace creative doctrine, privacy rules or historical evidence semantics.

## 1. What angle the reviewers actually took

Both reviewed a developer's ability to **return, investigate and judge agent work**, rather than mainly the pleasure of watching an agent. Their repeated question was effectively: “Can I find the exact change, understand it and see what was checked without reconstructing a transcript?” Their strongest praise was for cross-harness historical file evidence, comparison and truthful verification. Their weakest ratings were for map utility, default reading and discoverability.

They also considered whether Drishya could replace native chat, but neither exercised real authenticated native turns, account approvals or attachments. Their negative adoption verdict identifies what still needs earning; it does not establish a native integration failure. Their synthetic demo cannot prove security, large-session performance, physical reliability or market demand.

This was not solely a visual critique. It exposed the difference between **a capability existing**, **a developer finding it**, and **that capability making their job easier**. Several requested utilities already exist in code or older plans. Our recent implementation effort concentrated on arrivals, graph rendering, layout and prompt integration; the useful reading/review journey remained less developed. The remedy is to connect and improve those capabilities, not accumulate another layer of panels.

## 2. Coverage by developer angle

Coverage below combines the reviewers' observed journeys with a source audit. “Partial” means an implementation exists but does not yet satisfy the developer job; “planned” is not a shipped feature. The extra angles in the last rows are our expansion for the next review, not quotations from these reviewers.

| Angle / question | Current coverage | Gap and concrete next step | Basis |
|---|---|---|---|
| Watching live work: what is happening now? | Captured material, dock/map origins, native phase receipts, independent history and Follow | Keep origins understandable during bursts; show exact inputs/outcomes and unavailable reasoning without visual confusion | Existing implementation; reviewers tried synthetic live |
| Return after absence: what matters since I left? | Whole-recording since-mark digest and explicit undoable marks | Entry depends on a mark and lives behind review/overflow navigation; make the first review path useful before a user learns marking | Both reviewers |
| Trust and verification: what changed and what was checked? | File history, patches, provenance, later-run freshness and replay cutoffs | Join change and test evidence into one clear reading journey; avoid implying coverage, final disk success or inferred intent | Both reviewers |
| Reading and comprehension: can I understand this code here? | Syntax/line numbers, captured range reader, current-file pages, comparison, resize | Tiny initial previews hide useful lines; current-file tools are thinner than historical tools; create a coherent focused reader | Both reviewers + source audit |
| Discovery and navigation: where is the useful evidence? | Global captured-work search, folder/map entry, prompt rail, next edit/failure, file action links | Useful features are scattered or hidden; improve contextual entry, search scopes and return position | Both reviewers |
| Repository understanding: how does this file fit? | Current static import graph, spatial clusters, folder alternatives | Crossing strands and sparse labels rarely answer a question; offer a bounded selected-file neighborhood and typed links | Both reviewers |
| Git review: how does this work relate to my branch/commit? | Captured patches and workspace identity; **no integrated Git review service found** | Add separately consented read-only branch/status/diff inspection and revision-bound links to recorded work | Reviewer suggestions; our boundary design |
| Native workspace: can I use my harness from here reliably? | Opt-in native continuation, bounded attachments, exact approval handling, discovered model/effort and scoped usage | Actual-turn acceptance for both accounts, session switching, contention, cancellation, reconnect and unsupported commands | Both reviewers; review 39 limits |
| Review completion/handoff: what have I checked and what should another person see? | Reading marks, one temporary reference, exported evidence bundles; bookmark API exists | Reading marks are not reviewed-hunk marks; durable review queue/notes and a curated privacy-reviewed packet remain planned | Reviewer suggestions + older backlog |
| Learning: why this code, and what else must I understand? | Captured agent prose and file excerpts; qualified evidence comparison | Add source outline/import navigation and linked explanations only when supported; no invented “why” from nearby reads | Our expanded angle |
| Parallel work: who owns a change or overlap? | Captured agent identities, filters and combined evidence | Native worker/ownership and cross-worktree conflict journeys need acceptance; don't infer a collision from a shared filename | Our expanded angle; older plan |
| Accessibility and sustained use: can I read for an hour? | Keyboard controls, reduced motion, map-off, resource options and bounded paging | Audit contrast, selection, focus restoration, zoom, useful widths, resize settling and long session navigation together | Reviewers' layout findings + expanded review |
| Setup, privacy and reliability: will it work on my machine? | Local auth, redaction, packaging/restart checks and capture-health states | Fresh installation/account/platform/antivirus and physical scale gates remain; actionable recovery is part of the product | Expanded review; existing release gates |

Visualization remains a primary angle. It must explain work better than raw text **and** make the reading/review tasks above easier. A rotating map or expensive arrival alone cannot establish repeat use. Conversely, reducing everything to a diff dashboard would discard the builder's defining experience. Keep one chronological world and add task-focused paths into its evidence.

## 3. Source audit: why the reader feels assembled

- `History.tsx` previews begin at bounded source pages and limit edits to fourteen diff lines. This keeps layout controlled but can spend the preview on imports/context and hide the relevant condition or changed hunk.
- `ArtifactReader.tsx` has page-local find/match navigation, stored-range go-to-line, copy and one pinned range, provenance and bounded paging. These capabilities are stronger than their entry/discovery suggests.
- `SessionWorkspace.tsx`'s current-file reader offers syntax-colored source, line numbers, previous/next pages, refresh, copy and a link to recorded work. It does not expose the same find/go-to-line/range workflow. A folder click is functional, but it does not yet create an intentionally composed reading experience.
- `FileHistory.tsx` offers a bounded action trail, resize, historical evidence choices, two-evidence comparison and verification. The reader must choose between several controls before reaching the strongest value. Comparing two captures is not automatically an aligned whole-file diff.
- `common.tsx` uses line-oriented syntax highlighting. It is not a semantic editor, symbol service or complete language parser; colorful tokens alone cannot supply structure/navigation.
- `SinceMark.tsx` and `Verification.tsx` already provide much of the proposed return/review information. Reuse their global services rather than counting only visible history or building duplicate facts.

These are implementation observations, not a fresh visual usability test of every real session. The next slice must inspect actual frames and interactions again.

## 4. A reader that invites reading

### One recognizable reading place

Entering from a file card, folder, search match or graph should open the same **reader conventions**, while retaining the correct content mode. Show a compact file identity, mode (**captured / reconstructed / on disk**), source range and version/capture reference; put explanatory detail behind a deliberate evidence disclosure. Let the code have the useful width. Keep neutral surfaces, vivid restrained syntax, quiet line numbers, clear selection and a small contextual toolbar. Current and captured data must never silently replace one another.

Reuse shared code rendering and bounded data access; do not first import an entire IDE or redesign every action. The reader can be resizable and retain the originating selection. Closing or Back returns to the exact file/action/search/map position while capture continues. At narrow widths use one primary reader, with optional context collapsed, rather than squeezing code between two full rails.

### Arrive at the relevant material

- A read opens at its actual captured range. A search result opens at its exact match. An edit opens at the first relevant changed hunk with nearby context, rather than arbitrary boilerplate. Keep real line numbers and an explicit omitted-range affordance.
- Preview selection based on changed lines or a search match is a **derived UI selection**; it is not evidence that the agent read or considered only those lines. Never replace the original captured excerpt or truncate the only available copy.
- A plain folder open has no evidence-backed “important line.” Start at the file's first stored/current page or a deliberate user location, not an invented significance score.
- Maintain source indentation and predictable wrap behavior; use horizontal scrolling when preserving long code is preferable, and make wrapping selectable. Don't enlarge every action to avoid all scrolling.
- Support find, next/previous match, go-to-line, copy and a selected range consistently. Page-local search must say so. Whole-file search needs its own bounded, redacted query boundary; don't label a 200-line search as searching the entire file.

### Relevant context beside code, on demand

The reader should offer three kinds of related context without permanently showing all three: **recorded actions on this file**, **its captured changes and later test runs**, and **qualified current import neighbors**. The user selects the needed context; it preserves code width and the return trail. Current imports must be visibly current, not historical. Temporal action order is not proof of causal reasoning or test coverage.

Later add a bounded symbol outline/definition navigation for supported languages. Symbol extraction belongs behind a measured parser/indexing boundary with unresolved cases explicit; a regex pretending to resolve every reference is not sufficient. An external-editor link is a useful optional handoff when a task exceeds our reading scope.

### Presentation and motion that serve comprehension

Use one continuous real-material arrival and a finite selection-to-reader transition, preserving selectable text and source coordinates. Keep changed lines, matched lines and selected lines visually distinct. While reading, quiet background strands around the reading area; retain the builder's white-dot spatial map and optional rotation rather than changing themes again. Hover may assist preview, but all reading actions need click/keyboard equivalents. No fake typewriter, generated reasoning or motion delay before evidence becomes available.

## 5. Ordered work, with explicit completion gates

| Slice | Deliverable | Completion gate |
|---|---|---|
| R1 — useful evidence entry | Reuse since-mark/global summary to provide an understandable changed/failed/checks/gaps entry and file-oriented review links; improve changed-hunk/failure/search previews | New user finds the exact change and its recorded check without replaying the session or discovering a hidden mark first; correct on paged history, late results and replay cutoff |
| R2 — coherent source reading | Shared reader conventions and useful width; current-file find/line/range parity where supported; exact range/match/hunk opening; linked file evidence and return position | Reader can inspect relevant source, compare evidence, open the test and return; live append does not lose selection or position; narrow/keyboard/reduced-motion parity |
| R3 — useful repository focus | Stable selected-file framing, bounded import neighborhood, clear relationship types, smoothly revealed labels/density, quieter background competition | Small and large maps answer “what is connected to this file?” without needing a lucky camera angle; folder alternative remains complete; no current graph presented as historical |
| R4 — native workflow proof | Real Claude/Codex turn acceptance and session/ownership/settings/attachments/error recovery matrix | Publish actual tested harness/version/account scope, including unsupported cases; do not equate mock transport or catalog discovery with end-to-end execution |
| R5 — Git and review progress | Read-only Git status/base/head/diff, snapshot-bound evidence links, local reviewed/unreviewed queue and labeled notes | Stale branch/worktree/file changes are explicit; unrelated manual changes are not attributed to an agent; review progress survives reopen without auto-marking new work reviewed |
| R6 — handoff and wider developer utility | Curated privacy-reviewed evidence packet, supported symbols, diagnostic locations, external-editor handoff and multi-agent overlap review | Recipient can answer a review question from selected evidence; unknown coverage/ownership stays unknown; privacy and performance acceptance precede sharing |

R1/R2 are the next product implementation, in bounded PRs. R4's real-turn acceptance can proceed alongside them where account access exists; it is a release prerequisite, not something to postpone behind visual polish. R3 is navigation utility, not another graph engine rewrite. R5/R6 are proposed product work and need their own design/security/performance review before code.

### Git boundary for R5

Read the approved root/worktree through fixed-argument, bounded, read-only commands. Do not checkout, stage, commit, reset, execute hooks or modify repository configuration. Handle untracked, staged, unstaged, rename/delete, binary, submodule and unavailable-base cases explicitly. Redact diff content before cache/persistence/screen, honor protected paths and payload limits, and bind results to base/head plus relevant workspace fingerprints. Today's diff is **current Git evidence**, not the session's historical end state.

Only link an agent edit to a Git hunk when path/revision/content evidence supports it. Otherwise show a possible related captured action as such, or leave attribution unresolved. Reviewer marks attach to exact hunk/content identity and become stale when it changes. No “AI blame explains why” unless a captured statement actually supports the claim.

## 6. Wider next critical review

Run it after a useful R1/R2 candidate, then again after real native acceptance and Git integration. Keep the first reviewer prompt neutral and give no chat history or preferred verdict. Do not instruct reviewers which features they must praise. Use additional dedicated passes for angles that one broad review cannot adequately cover.

**Fresh whole-product brief:**

> You are a developer considering Drishya for your own coding-agent workflow. Inspect and use the product firsthand. Assess the whole experience, explain which jobs it helps or obstructs, whether and when you would adopt it, what still sends you back to your harness/editor, and what changes would most improve it. Rate the dimensions you find meaningful. Give concrete reproducible observations and the evidence behind each criticism. Distinguish tested behavior from assumptions and untested claims. You have no obligation to recommend it. Do not modify user work or native settings, submit real prompts, or send anything externally without the task's explicit test authorization.

Follow with dedicated passes across: live visualization/learning; returning/reviewing/trust; source reading/repository/Git; native continuation/ownership; multi-agent work; accessibility/long reading; setup/privacy/reliability; and onboarding/discoverability. Use different realistic task journeys, not eight reviewers all replaying the same polished fixture.

The corpus should include a successful multi-file fix, a failed/unverified edit, an unresolved bug despite passing tests, stale current files, missing/protected artifacts, a late result, a long paged session and conflicting worktree identities. Use synthetic/redacted fixtures. Real local native-turn journeys require explicit test consent and must record harness versions without committing real journals or secrets.

Ask for missing developer capabilities **after** the firsthand baseline verdict, then ask why each request matters and how often they would use it. Rank observed friction separately from speculative features. Record conflicting findings rather than averaging them into a fictitious universal truth. Theme variants are a later preference experiment, not the explanation for every usability problem.

## 7. Measure comprehension, not viewing time

For the same task, compare raw harness history with Drishya: locate the exact hunk, identify the recorded failure, find the later test run, distinguish current from captured code, explain an unresolved risk, and return to the original reading point. Record correctness, elapsed task time, navigation steps, unsuccessful searches and optional confidence. Establish a baseline before setting improvement targets. Human developers must validate comprehension and voluntary return; agent reviews are useful critics, not market validation.

Keep freeze/truth/ten-minute checks, long-session memory/latency gates, keyboard/reduced-motion acceptance and publishing-only hosted CI. Success is a developer completing these jobs correctly with less reconstruction effort while still enjoying the live visual experience—not a larger feature count or longer time watching animation.
