# Product checklist

**The single current work list. Restructured 19 October 2026.** Builders and agents update this file in the same increment as the work: tick an item only when its stated scope is implemented and checked on actual sessions; add new feedback here before starting it. STATUS is the session log, CONTINUITY is the handoff, numbered reviews are evidence. They are not competing task lists.

**Claiming.** Before starting an item, claim its ID in the [STATUS](STATUS.md#claimed) table and push that to `main`; `node scripts/claims.ts` shows what is open and what is taken.

**How to read it.** §1 is the **priority order**: one line per item with its ID and tags. §3 holds the **detail** for every ID, grouped by category: problem, what to do, acceptance, where in the code. §4 archives every item completed before this restructure, verbatim.

`[x]` = implemented and locally checked within the stated limits. `[ ]` = unfinished. A checked item does not certify native accounts, every device, visual preference or release readiness.

Evidence for this restructure: [122 developer review](review/122-developer-product-review.md) (with builder corrections), [123 harness data audit](review/123-harness-data-audit.md), [124 Sacred Timeline spec](review/124-sacred-timeline-git-graph.md).

**19 October investigation candidate:** [107](review/107-investigation-finishing.md) records the bounded workflow/recovery/control increment reconciled with main54f93af. New P0-P3 direction is retained. Signed-in native checks remain builder-owned; broad UI/motion/platform items are not certified by a synthetic matrix.

---

## 0. Rules for every item

1. **Product north star.** Drishya is the best *visualization of agent work* plus the *developer tools needed to understand it while it happens*. A developer should understand the change as it is made, not only after. Every item must serve that.
2. **Minimal by default.** The builder's design rule: the UI stays minimalistic and calm.
   - Do **not** add resident buttons or panels for a new feature. Put it in an existing owner (contextual hover, the ⋯ menu, Ctrl+K, a reader toolbar) unless it *replaces* something.
   - Any surface whose controls take more space than its content is a bug (see UI-5).
3. **Verify before changing.** Use the running app on actual Codex and Claude sessions and read the code before "fixing" anything. Several things that look wrong are deliberate (builder corrections, 19 Oct):
   - Toolbox→card connectors appear **on hover only**.
   - The passage layout **wraps** actions onto the next row with arrows from box to box. This is intentional; one infinite horizontal lane is rejected.
   - **File peek** (beside the agent) and **Workspace** (full view when not watching the agent) are two intended modes.
   - The **3D repository map** stays as an aesthetic surface for now.
4. **Truth.** Captured ≠ derived. A model's output is always labelled as generated and cites captured evidence. Missing data stays visibly missing. No invented links or locations ([AGENTS](../AGENTS.md) constraints).
5. **Every interaction has purposeful motion.** Every click, toggle, open and close gets a suitable, interruptible transition tied to its true origin, with reduced-motion and low-resource fallbacks (MOTION-1). Use the installed `emil-design-eng`, `animate`, `review-animations` and `animation-performance` skills.
6. **One coherent, verified increment per commit,** so either builder can backtrack. Schema changes need both builders' agreement (DATA-10).
7. **Tick, then sync.** Tick the item's own checkbox in §3, then run `node scripts/sync-tasks.ts`: it sets the ☑/☐ marks and counts in the priority tables below (`--check` verifies them).
8. **Choosing a model.**
   - Opus for design specs, ambiguous UI direction and reviews.
   - Sonnet is suitable for executing items here that have explicit **Accept** lines.
   - Either model must verify in the browser on actual sessions before ticking.

### Dependency gates and retest triggers

Keep dependent work here **and** under its own item; this is a cross-reference within the single checklist, not a second queue. “Free” in `claims.ts` means unclaimed, not necessarily ready. When a dependency merges/becomes available, the next agent checks this table, claims the affected item, reruns its stated acceptance on fresh/redacted real data and records the result. A merged dependency alone does not tick the dependent item. Keep the row until the retest passes; add newly discovered gates as work proceeds.

| Dependent item / remaining scope | Required evidence or dependency | Retest when available |
| --- | --- | --- |
| FILES-1: deletion badges; enrichment of old Codex captures | DATA-1 with an explicit retained deletion discriminator; original journal available for enrichment. Supported A/E/read/tree work merged in #139; only explicit deletion/enrichment acceptance remains. | Rescan an existing recording without duplicating operations; verify A/E/D against exact captured changes, failed/running writes stay unmarked, folder/Touched totals and live/replay agree. If deletion is still not retained, keep this gate open. |
| READ-1 and TURN-1: Codex edit line numbers and tests hidden inside wrappers | DATA-1 typed FileChange / CommandExecution items | Re-import dense Codex session; inspect true hunk line numbers and runner outcomes, ensure wrapper/child deduplication and turn counts match captured evidence. Existing checked scope remains bounded. |
| CONTENT-9: explicit missing-reasoning state | Reasoning-state slice S3 in review125; shared contract work DATA-1/DATA-2 must be coordinated first | One quiet missing-text line for encrypted/signature-only blocks; genuine summaries/text remain visible, no line when no reasoning block was recorded; live, replay and both harnesses. |
| CONTENT-3 / CONTENT-1 / CONTENT-2: historical questions, images and web evidence | DATA-1 typed items plus review125 S4 / DATA-4; inline-image byte policy D7 needs both builders' decision | Verify pending → answered/cancelled historical states and supported native replies; mixed image/text and browser results retain exact raw access. Use a fresh sample, not tool definitions. |
| CONTENT-4: additional plan/task sources | DATA-7 and a real Claude TaskCreate/TaskUpdate/ExitPlanMode sample (review125 D10) | Ten or more captured updates show one evolving per-turn checklist, revisions remain reachable, no invented task statuses. Existing TodoWrite can be tested separately. |
| CONTENT-5: native sub-agent identities | DATA-1 / DATA-3 retained names, model, effort and lineage | Actual Codex and Claude parent/child sessions; distinguish source-linked from enclosing-call correlation, retain unresolved lineage honestly. |
| HOME-1 stats / LIVE-4 context and limits | DATA-2 usage plus DATA-3 metadata where required | Fresh real sessions and enrichment; reported vs derived labels, missing data hidden, context denominators/limit resets correct, no current-page totals mistaken for full history. |
| EXPLAIN-1 / EXPLAIN-2 / EXPLAIN-3 / EXPLAIN-5 live acceptance | EXPLAIN-4 real endpoint/key, verified model IDs and explicit exact-payload opt-in | Run explain/labels/briefing on Codex and Claude evidence; validate citations, visible generated provenance, latency and cost; no call before consent. |
| NATIVE-1..4 and REL-2/REL-3 broad acceptance | Real signed-in native harnesses, multi-agent/conflict samples, physical lower-resource/phone/accessibility environment | Repeat the corresponding end-to-end and freeze/truth/ten-minute checks. Synthetic transports and viewport emulation do not close these gates. |


**Tags:**
- `bug` defect
- `live` live loop / "now"
- `turn` turns and navigation
- `read` reading diffs, code and output
- `content` content-shaped presentation per action type
- `data` harness capture/adapters
- `explain` model-derived explanation
- `git` Git review, graph and timeline
- `files` Explorer, peek and Workspace
- `ui` visual system, chrome, navigation and minimalism
- `motion` interaction motion
- `home` Home and session discovery
- `review` Review work, search and packets
- `map` repository map
- `native` native controller acceptance
- `perf` performance and scale
- `rel` release and platform

**Priority:**
- **P0:** now.
- **P1:** next.
- **P2:** later.
- **P3:** deferred ideas.

---

## 1. Priority order

**Overall: 25 of 93 done.** Marks are generated by `node scripts/sync-tasks.ts` from each item's checkbox below; tick the item, then run it.

### P0 — now

**10 of 12 done**

| Done | # | ID | Item | Tags |
|---|---|---|---|---|
| ☑ | 1 | BUG-1 | Wheel scroll trapped over history cards | `bug` `read` |
| ☑ | 2 | BUG-2 | Git review drawer covers the Git graph button; Escape inconsistent | `bug` `git` `ui` |
| ☑ | 3 | BUG-3 | Markdown link with bold label and Windows path renders raw | `bug` `read` |
| ☑ | 4 | BUG-4 | Header islands overlap content at ≤ 900 px width | `bug` `ui` |
| ☑ | 5 | DATA-10 | Propose one batched event-schema addition to both builders | `data` |
| ☐ | 6 | DATA-1 | Codex: consume typed `item_completed` items (commands, file changes, MCP, images, web, sub-agents) | `data` `content` |
| ☐ | 7 | DATA-2 | Usage: Codex `token_count` and Claude `message.usage`/`cost-state` | `data` `live` |
| ☑ | 8 | LIVE-1 | "Now" line plus tab title/favicon state | `live` |
| ☑ | 9 | TURN-1 | Turn chapters with a resolved turn ledger (collapse is TURN-1b) | `turn` `motion` |
| ☑ | 10 | READ-1 | Edit/write cards: wide, no-wrap, `+N −M` (Codex line numbers wait on DATA-1) | `read` |
| ☑ | 11 | READ-2 | Quiet provenance: one ⓘ per card (history cards) | `read` `ui` |
| ☑ | 12 | LIVE-2 | Composer collapses to a pill when idle (leftovers in LIVE-2b) | `live` `ui` `motion` |

### P1 — next

**11 of 36 done**

| Done | # | ID | Item | Tags |
|---|---|---|---|---|
| ☐ | 13 | EXPLAIN-4 | Validate Nemotron on Token Factory with a real key and real model ids | `explain` |
| ☐ | 14 | EXPLAIN-1 | Narrator: generated intent labels for bursts of work, cited to evidence | `explain` `live` |
| ☐ | 15 | EXPLAIN-2 | Turn summary and "while you were away" briefing | `explain` `turn` |
| ☐ | 16 | CONTENT-3 | Agent questions and approvals as first-class interactive cards | `content` `live` |
| ☐ | 17 | CONTENT-4 | Plans and todos as a living checklist (TodoWrite, TaskCreate/Update, ExitPlanMode, Codex plan) | `content` `turn` |
| ☐ | 18 | CONTENT-1 | Images the agent viewed, produced or received (finish) | `content` `data` |
| ☐ | 19 | CONTENT-2 | Browser and web evidence views (finish) | `content` `data` |
| ☐ | 20 | CONTENT-5 | Sub-agents with real names, model, effort and lineage | `content` `data` |
| ☐ | 21 | CONTENT-9 | Honest "reasoning not recorded" state | `content` `read` |
| ☐ | 22 | FILES-1 | Evidence-decorated file tree (edited/created/read/now) | `files` `live` |
| ☑ | 23 | TURN-2 | Keyboard reading model plus `?` cheat sheet | `turn` |
| ☑ | 24 | TURN-3 | Prompt rail encodes turn size and failures | `turn` `ui` |
| ☐ | 25 | UI-1 | Chrome consolidation: session identity, fewer floating islands, clear navigation | `ui` |
| ☐ | 26 | UI-2 | Typography floor (11 px meta, 12–13 px controls) and secondary-text contrast | `ui` |
| ☐ | 27 | MOTION-1 | Interaction-motion pass over every control and nested state | `motion` |
| ☐ | 28 | UI-3 | Uiverse / component-library pass, starting with the Star on GitHub shimmer button | `ui` `motion` |
| ☐ | 29 | UI-5 | Button density and navigation in Workspace, Git and readers | `ui` `files` |
| ☑ | 29a | UI-9 | Hover-reading cards fit their content (max height, never padded) | `ui` |
| ☐ | 29a | UI-10 | Count-dependent surfaces: small and large states (show all when few, page or scroll when many) | `ui` |
| ☑ | 30 | GIT-1 | Sacred Timeline Git graph (fiber light, branches peel and merge, starfield) | `git` `motion` |
| ☑ | 31 | GIT-3 | Compact commit rows synced with the timeline; ref filter | `git` |
| ☐ | 32 | READ-4 | Passage layout refinement (keep wrap plus arrows) | `read` `motion` |
| ☑ | 33 | LIVE-3 | Opt-in notifications: turn finished, approval needed | `live` |
| ☐ | 34 | HOME-1 | Home rows with harness-reported stats; "running now"; quieter rows | `home` `data` |
| ☐ | 35 | DATA-3 | Codex session/turn metadata: agent names, lineage, policies, durations | `data` |
| ☐ | 36 | DATA-4 | Claude extras: AskUserQuestion, TaskCreate/Update, plan mode, isImage, spilled output | `data` `content` |
| ☐ | 37 | DATA-5 | Claude checkpoints (`file-history-snapshot`) for "before this turn" | `data` `read` |
| ☐ | 38 | DATA-6 | "Changed outside the agent" marks (`edited_text_file`) | `data` `read` |
| ☐ | 39 | FILES-2 | Every path in the stream opens in peek | `files` `read` |
| ☑ | 40 | TURN-4 | Replay transport in Modern (play, pause, speed, next edit/failure) | `turn` `motion` |
| ☐ | 41 | REVIEW-1 | Review work as a first-class Changes view; group repeated gaps | `review` |
| ☑ | 42 | REVIEW-2 | Search results with session/turn/tool/time context | `review` |
| ☐ | 43 | PERF-1 | Import/tail benchmark on 160–564 MB Codex journals | `perf` |
| ☑ | 44 | BUG-7 | Live refresh during session open drops the restored reader | `bug` `live` |
| ☑ | 45 | TURN-1b | Collapse finished turns (virtual-list work; Opus-sized) | `turn` `motion` |
| ☑ | 46 | TEST-1 | Four browser specs fail or flake on main (found 19 Oct) | `rel` |

### P2 — later

**4 of 38 done**

| Done | # | ID | Item | Tags |
|---|---|---|---|---|
| ☐ | 47 | READ-5 | Session diff with blame-by-turn (evidence-backed line attribution) | `read` `git` |
| ☐ | 48 | READ-6 | Read-before-write signal | `read` |
| ☐ | 49 | READ-7 | Failure → fix chains (same command identity) | `read` `turn` |
| ☐ | 50 | READ-8 | Promote the per-file timeline | `read` `files` |
| ☑ | 50a | READ-9 | Source reader on phones: find controls take over 40% of the window | `read` `ui` |
| ☐ | 51 | GIT-2 | Session ↔ commit links | `git` `turn` |
| ☐ | 52 | GIT-4 | Hunk-level "Recorded work" from Git review | `git` `read` |
| ☐ | 53 | EXPLAIN-3 | "Explain this hunk", validated live with citations | `explain` |
| ☐ | 54 | EXPLAIN-5 | Visual language for derived content | `explain` `ui` |
| ☐ | 55 | READ-3 | Settle older cards into compact ledger rows (prototype first) | `read` `motion` |
| ☐ | 56 | MOTION-2 | Lift arrivals from the file-tree row | `motion` `files` |
| ☐ | 57 | MOTION-3 | Live/replay motion evaluation (ten-minute calm) | `motion` |
| ☐ | 58 | UI-4 | CSS consolidation: one token sheet; freeze Legacy; retire Canvas | `ui` `perf` |
| ☐ | 59 | UI-6 | Phone density and occlusion | `ui` |
| ☐ | 60 | UI-7 | Every palette across every surface | `ui` |
| ☐ | 61 | UI-8 | Whole-product UI pass (header, composer, all action types) | `ui` |
| ☐ | 62 | CONTENT-6 | Shared adaptive content selector | `content` |
| ☐ | 63 | CONTENT-7 | Structured data and document views (finish) | `content` |
| ☐ | 64 | CONTENT-8 | Cross-tool visual parity on actual sessions | `content` |
| ☐ | 65 | DATA-7 | Codex `plan_update` / `turn_diff` verification | `data` |
| ☐ | 66 | DATA-8 | Reasoning-persistence settings: verify and document | `data` |
| ☐ | 67 | DATA-9 | Optional hook/OTel enrichment research | `data` |
| ☐ | 68 | LIVE-4 | Context-window and plan-limit gauges | `live` `data` |
| ☑ | 69 | LIVE-2b | Composer: expand by key; real end-padding when expanded | `live` `ui` |
| ☐ | 70 | FILES-3 | Navigation clarity: Files / Repository / Workspace purposes | `files` `ui` |
| ☐ | 71 | FILES-4 | Reader and Workspace review (type, tabs, toolbars, long/empty material) | `files` |
| ☐ | 72 | FILES-5 | Opt-in draft recovery | `files` |
| ☑ | 73 | REVIEW-3 | Bookmarks/saved moments/commit-PR indicators audit | `review` |
| ☐ | 74 | REVIEW-4 | Joined investigation route, end to end | `review` `native` |
| ☑ | 75 | REVIEW-5 | Packet usefulness | `review` |
| ☐ | 76 | NATIVE-1 | Real signed-in Codex journey | `native` |
| ☐ | 77 | NATIVE-2 | Real signed-in Claude Code journey | `native` |
| ☐ | 78 | NATIVE-3 | Genuine multi-agent sessions | `native` |
| ☐ | 79 | NATIVE-4 | Joined native edit/create conflict path | `native` |
| ☐ | 80 | REL-1 | Managed-runtime update versus the antivirus conflict | `rel` |
| ☐ | 81 | REL-2 | Physical lower-resource and platform acceptance | `rel` `perf` |
| ☐ | 82 | REL-3 | Keyboard, zoom, assistive technology and human freeze/truth/ten-minute acceptance | `rel` |
| ☐ | 83 | REL-4 | Publishing preparation (on request only) | `rel` |

### P3 — deferred ideas

**0 of 7 done**

| Done | ID | Item | Tags |
|---|---|---|---|
| ☐ | MAP-1 | Repository map purpose (kept aesthetic for now; ideas recorded) | `map` |
| ☐ | IDEA-1 | Explicit two-session comparison; measured density option | `turn` `ui` |
| ☐ | IDEA-2 | Symbol timeline after reliable extraction | `read` |
| ☐ | IDEA-3 | Multi-repo mission control beyond the Home "running now" strip | `home` |
| ☐ | IDEA-4 | Additional UI versions or themes after Modern is finished | `ui` |
| ☐ | IDEA-5 | From closed PR110: explicit keyword findings and copying selected captured commands, built on the existing Commands/ReviewInsights owners, not a second review panel | `review` |
| ☐ | TESTS-1 | Tests view: every run, every failing case, tracked across runs (deferred) | `review` `read` |

---

## 2. Status snapshot

- **Workspace editing:** Workspace → select file → **Edit file** → **Compare draft** → **Review edit with harness**. Drafts are memory-only; disk changes only when the user submits a request and the native harness applies it. There is no direct save-to-disk.
- **Works today:** live capture and history; real diffs, outputs and test bars; file peek; Workspace drafts; Git review; Git branch atlas; cross-session search; Review work; Ctrl+K; seven palettes; native controller (local fixtures).
- **Measured on a 1,100-operation Codex session:** 2.3 s load, about 2.4k DOM nodes, 15 MB heap, about 7% idle main-thread time. Live latency is about 2 s.
- **Biggest gaps:** no "now"; no turn chapters; narrow wrapped diffs; half the harness data unused ([123](review/123-harness-data-audit.md)); reasoning mostly unrecorded by the harnesses themselves; the Git graph is art without information.

---

## 3. Detail by category

### BUG — defects

- [x] **BUG-1 · Wheel scroll trapped over history cards** · P0 · `bug` `read` — **fixed 19 Oct.** Cause: `overscroll-behavior: contain` on `.op-body`/`.result-area` (`ink.css`) blocked native chaining to `.history` at a card's edge. Vertical is now `auto` (horizontal stays contained). Verified on Codex and Claude sessions: at a card's top edge the wheel scrolls the history 300 px per step; mid-card scrolling stays local with the history unchanged.
  - **Problem:** with the pointer over a centred card, the wheel does not scroll the history, even when the card's own content cannot scroll further. Measured on the AgentGuard Claude session: `.history.scrollTop` stayed at 71627 for two wheel events over a Read card. Cards cover most of the centre, so this happens constantly.
  - **Do:** keep local result scrolling (constraint 7). At the inner scroll boundary, chain the remaining delta to `.history`; if the card has no overflow, never capture the wheel. Check the hover-reading and zoom handlers in `lib/hover-reading.ts` and `modern/local-scroll.ts` for `preventDefault` on wheel.
  - **Accept:** wheel over any card at its top or bottom boundary scrolls history; mid-content still scrolls locally; Follow detaches only on main-history scroll. Check Codex and Claude sessions with a trackpad and a mouse wheel.

- [x] **BUG-2 · Git review drawer covers the Git graph button; Escape inconsistent** · P0 · `bug` `git` `ui` — **fixed 19 Oct.** The right-docked Git drawer now starts below the measured navigation (`--drawer-top`, `ReadingWindow.tsx`), so Review ⇄ Graph is one click. Escape closes the newest open modeless reader from anywhere (menus close first; typing fields and modal dialogs are left alone). Verified on the Codex session at 1440 px: drawer top 187 px vs nav bottom 175 px; Review → Graph one click; Esc closes graph; menu then drawer in two presses.
  - **Problem:** with Git review open, its drawer overlays the Git graph button, so you cannot switch Review → Graph without closing first. Escape closes Settings and Ctrl+K but not Git review or the ⋯ session menu.
  - **Do:** make Review ⇄ Graph a tab switch inside the same Git surface, or keep the right navigation above the drawer. Escape closes the top-most transient surface (menu → drawer → reader) and returns focus to its opener.
  - **Accept:** from either Git surface, one click reaches the other; Escape order verified for menu, Git review, Git graph, peek and Settings; focus returns to the trigger.

- [x] **BUG-3 · Markdown link with bold label and Windows path renders raw** · P0 · `bug` `read` — **fixed 19 Oct.** The bold/italic rule emitted its contents as text, so an inner link was never parsed; bold and italic now render through the same inline parser, and a link target may hold one level of parentheses. Links stay display-only (`md-link`); opening local paths in peek remains FILES-2. Three unit tests (`apps/ui/test/markdown-links.test.ts`) and the real Codex message verified.
  - **Problem:** `**[92-feature….md](/C:/Users/…/92-feature….md)**` in agent prose renders as literal brackets and the URL (final message of the Codex "well now continue…" session).
  - **Do:** fix the link parser in `lib/markdown.tsx` for emphasis-wrapped links and `/C:/…` or `C:\…` targets. Local paths open in peek (FILES-2) rather than navigating the browser.
  - **Accept:** unit cases for bold/italic-wrapped links, Windows drive paths, spaces and parentheses in paths; the real message renders as a link.

- [x] **BUG-4 · Header islands overlap content at ≤ 900 px** · P0 · `bug` `ui` — **fixed for the top controls, 19 Oct.** From 601 to 1100 px the right controls share one row and the history starts below the measured controls (`reading-windows.css`, using the existing `--workspace-tools-bottom`), so cards and prose no longer scroll under Files|Repository or Git/Workspace. Measured 0 overlaps at 640/768/820/853/900/1024/1100 px (853 and 1024 stand in for 150% and 125% zoom of a 1280 window); unchanged at 1280+ and ≤ 600 px. **Residual (moved to UI-1):** the small bottom-corner pills (collapsed Tools, Follow live) still float over the edge of prose at narrow widths, and the phone layout was not re-audited. Cost: about 134 px of reading height at these widths.
  - **Problem:** at about 800 px, the Workspace button sits over prose and Files|Repository sits over a card.
  - **Do:** below a measured width, reserve header space (content top padding equals the measured header height) or collapse the islands into a single compact bar (feeds UI-1).
  - **Accept:** no overlap at 768/800/900/1024 px, nor at 125% and 150% browser zoom.

- [ ] **BUG-5 · Review work reports 0 tests for Codex sessions that ran tests** · `bug` `review` — fixed by DATA-1 (typed `CommandExecution` with `parsed_cmd` and `exit_code`). Close when DATA-1 lands and the "441 tests pass" session shows its runs.

- [ ] **BUG-6 · Usage shows "Not reported" for Codex although `token_count` is recorded** · `bug` `data` — fixed by DATA-2.

- [x] **BUG-7 · Live refresh during session open drops the restored reader** · P1 · `bug` `live` — **fixed 19 Oct.** `reloadProjection` now waits for an in-flight open of the same recording before taking its token; the open settles once its location is applied, so its own live-start reload cannot wait on itself. New `open-refresh-race.test.ts` failed before and passes; "session detours" passes 10/10 at 150 ms and 10/10 with coalescing forced to 25 ms.
  - **Problem:** `openRecording` (`apps/ui/src/state.ts`) clears the reading location, awaits recordings and projection, then applies the saved location. A live refresh that starts meanwhile (`useLiveUpdates` → `reloadProjection`) takes the newest projection token, so `openRecording` discards its result and the saved reader is never restored. Reproduced every time with 25 ms coalescing; PR128 restored 150 ms, which only makes it unlikely.
  - **Accept:** a unit test reproduces it; `fresh-workspace.spec.ts` "session detours" passes 10/10 alone, also with coalescing temporarily at 25 ms.

### LIVE — the live loop and "now"

- [x] **LIVE-1 · "Now" line plus tab title/favicon** · P0 · `live` — **shipped 19 Oct.** While a recording is being watched, the composer pill (and the expanded composer's status) shows one quiet line from captured evidence only: `Claude · running pnpm test · 42 s +1`, `Codex · reading index.ts · 3 s`, `Claude · waiting for your answer · 12 s`, `Codex · working`, `Claude · replied 2 m 05 s ago`, `… · no activity for 40 s`. A status dot colours it (green running, amber asking, indigo working). The tooltip gives the exact basis ("A call is open: the harness recorded it … and no result yet", "This turn so far: 7 operations."). The tab title becomes `● Running · <repo>`, `? Needs you · <repo>` or `◐ Working · <repo>` and the favicon gets a matching dot only while the agent is active; both restore on reply, quiet or leaving the session. No line at all for a session whose newest event is over two hours old. New `GET /v1/recordings/:id/now` (via the history worker, no schema change) returns facts from the **tail** of the recording, so the line stays right while the person is reading older history. Pure logic with an injected clock: `packages/scene/src/now.ts` and `apps/ui/src/lib/now-state.ts` (21 tests). Verified on this very conversation's live Claude session (running → working → running as my own calls opened and closed), on an old session (no line), Home (title and favicon restored), and the expanded composer.
  - **Placement decision:** the pill and composer header rather than a new top-centre element, to avoid another resident control (the TASKS note allowed either). The pill widens to a constant 340 px only while active, so changing text does not jitter.
  - **Not done:** browser notifications (LIVE-3); a "waiting for approval" state for permission prompts the harness never writes to its journal; Codex-specific states beyond what the journal records.

- [x] **LIVE-2 · Composer collapses when idle** · P0 · `live` `ui` `motion` — **shipped 19 Oct (idle pill).** The composer now defaults to its slim "Ask your agent…" pill (180×38 px) and gives the reading height back. It opens by itself for a draft, attachment, run, approval, question, failure or error, and the person's own open/minimize choice (`composer/choice`: auto / open / closed, saved with the session) always wins. Verified on Claude sessions at 1440 px and 390 px: collapsed by default, click expands and focuses the text box, open and closed both survive a reload, no horizontal overflow. Remaining pieces are split out as LIVE-2b.
  - **Problem it solved:** the floating composer covered the newest card; most sessions are driven from the native terminal.

- [x] **LIVE-2b · Composer leftovers** · P2 · `live` `ui` —20 October, PR #153: Ctrl/Cmd+Shift+Enter expands and focuses the visible live prompt without submitting; ARIA and Settings → Keyboard expose it. Other fields/editors, IME, dialogs/menus and hidden replay/Workspace/map surfaces retain input ownership. Existing measured composer gap/end-padding passes final expanded-card clearance at1440/900/390/320px, including a long draft, so no duplicate CSS override was added. Three new browser journeys, retained composer consent/scroll regression, both typechecks/build and actual Drishya Codex focus check pass. [Evidence and limits](review/live-2b-composer-access.md).

- [x] **LIVE-3 · Opt-in notifications** · P1 · `live`
  - **20 October, done:** Settings › Reading has an opt-in switch; the browser permission is requested only when it is turned on (blocked/unsupported browsers show why and the switch stays off). While the tab is hidden, the open session notifies once when the agent starts waiting for you and once when a running turn ends in a reply, from the same "now" state as the composer pill and tab title. The body is the session title and state only. Limits: only the open session is watched (not other live sessions on Home); a visible-tab run and a real hidden-tab notification were checked by unit tests and the permission journey, not by a human on a real desktop.
  - **Do:** in Settings, a browser Notification permission request on explicit opt-in only. Notify for "turn finished" and "approval/question waiting", only while the tab is hidden. The body is the session title and state, never captured content.
  - **Accept:** no prompt until opted in; nothing fires while the tab is visible; works for Codex and Claude live sessions. This supersedes the earlier deferral of OS notifications.

- [ ] **LIVE-4 · Context-window and plan-limit gauges** · P2 · `live` `data`
  - **Do:** after DATA-2, a small ring in the identity bar: context used / `model_context_window` (Codex) or derived from `message.usage` (Claude, labelled as such). Codex `rate_limits` primary/secondary windows appear in Usage. Hide entirely when not reported.

### TURN — turns and navigation

- [x] **TURN-1 · Turn chapters with ledger** · P0 · `turn` — **shipped 19 Oct (header and ledger; collapse split out as TURN-1b).** Each prompt is a chapter: its words clamped to three lines with "Show full prompt" only when it actually overflows, and, once the turn is over, one quiet mono line of what it did, e.g. `edited 28 files (+374 −46) · 31 commands · 18 m 18 s` (parts shown only when non-zero: read, searched, edited files with +/−, commands, tests `41✓ 1✗`, web, MCP, delegated, `N failed` in red). The tooltip says it is counted from captured operations and that the duration runs to the last captured time in the turn (derived; not every harness records where a turn ends). The newest turn shows no ledger while the agent is active (the Now line is live), and replay shows none, so nothing tells the future. Counts come from a new `GET /v1/recordings/:id/turns` (whole recording, so paged sessions are right; small sessions are counted in the browser) built on the pure `packages/scene/src/turns.ts`; passages carry `turnStep` to find their ledger (goldens updated: only the new field). Verified on the 41-turn Codex session (28-file, 18-minute turn) and this live session; clamp 123 px ↔ 345 px expanded. Tests: scene 6, ledger wording 5, daemon route 1.
  - **No schema change.** Codex's recorded `duration_ms` (review 125 S1) would replace the derived duration later. Tests inside Codex `exec` wrappers show as `0` runs until DATA-1.

- [x] **TURN-1b · Collapse finished turns** · P1 · `turn` `motion` — **shipped 20 Oct (Modern only).** The turn's ledger line is the fold control (a chevron turns; no new chrome). A folded turn keeps its prompt and ledger; the rest of its passages become zero-height slots. The composer now marks every passage with `inTurn` (goldens: only the new field), so paged-out members fold too and a paged-out opener still shows as a header. Folds are stored by the opening passage's id (stable while live work arrives) in working locations (`history/folded-turns`, persisted across reloads); the open height is kept separately from the folded one, so unfolding lands where it was. The header never moves: the reading anchor holds, and when folding near the end would shorten the document under the reader, the old extent is held and shrinks as they scroll back. The selected/expanded operation's turn and any prompt-rail jump unfold it (and it stays open); the newest turn cannot fold while the agent is active; replay never folds. Motion: work below the header travels from where it was (260 ms), unfolded work eases in (220 ms); finishes on wheel, off for reduced motion/low resource. Verified on the 38-turn Codex session (header moved 0 px folding and unfolding; 18 → 10 cards on screen). Tests: `apps/ui/test/turn-fold.test.ts` 3, scene membership 1, `tests/browser/turn-fold.spec.ts` 3 (the clamp case failed before the extent hold). Bulk fold/unfold keys shipped with TURN-2 (`c` folds other finished turns, `C` unfolds all); the ten-minute live run is still a MOTION-3 check.
  - Original brief: the history is a custom virtual list (`History.tsx`: measured passage heights, run-based layout, scroll anchors, paged windows with unloaded placeholders), and only the passage that opens a turn knows its turn. Collapsing must keep: scroll anchoring when a header above the viewport collapses; prompt-rail and search jumps into a collapsed turn (auto-expand); selection/expanded operations inside it; Follow and the newest turn (never collapsible while the agent is active); windows that start mid-turn (membership unknown); persisted height estimates. Suggested shape: turn membership computed in the scene composer (as `turnStep` was), collapse state in workspace memory by `turnStep`, collapsed passages rendered as zero-height slots with the header and ledger still visible, plus golden and manual-scroll tests. Accept: collapse/expand never moves the reading position, every jump target auto-expands, ten-minute live run stays calm.

- [x] **TURN-2 · Keyboard reading model** · P1 · `turn`
  - **Do:** keys:
    - `j`/`k` next/previous operation (down/up); `n`/`p` next/previous edit; `f` next failure; `t`/`T` next/previous turn;
    - `e` expand/collapse; `o` open in peek; `y` copy the focused material; `g`/`G` first/last;
    - `?` cheat sheet.

    The focused operation gets a visible focus ring and scrolls into the reading position. Keys are disabled while typing in inputs or the editor.
  - **Accept:** all keys work with Follow on and off; the cheat sheet is listed in Settings → Keyboard.
  - **20 October implementation:** Modern history uses a quiet real-card focus ring, without selecting/opening the inspector. Bounded worker cursors navigate the whole recording (not only resident pages), honor operation filters, and use captured turn identity across revisions. `c` folds other finished turns while preserving the reading anchor; `C` unfolds all, completing TURN-1b's deferred bulk shortcut. `o` uses the existing peek/consent route; `y` copies a selection or the material's existing copy action, otherwise the card preview (never claims to copy an unavailable full artifact). `?` and Settings → Keyboard open the same guide, including from Home. Typing/editors/menu/reader contexts retain their keys; explicit replay keeps its transport and clock. See [TURN-2 verification](review/turn-2-keyboard-reading.md).


- [x] **TURN-3 · Prompt rail encodes turns** · P1 · `turn` `ui`
  - [x] **20 October, encoding (PR #147):** full-history ledger drives clamped size ticks, failure notches, edit dots and hover/focus ledger. Active reading and nearest-row growth retained. Four local browser journeys, eight focused unit cases and three actual Codex/Claude captures verified. [Evidence](review/turn-3-evidence-rail.md).
  - [x] **Coverage follow-up, PR #147:** scene composition retains captured prompt-only turns as reading stops; late operation results cannot suppress the next chapter. Paged prompt targeting uses scene chapters. Actual Drishya now41/41, Skeletongraph Codex48/48 and Claude287/287 chapters/ledgers.75 consecutive synthetic prompts remain navigable without invented responses; historical step boundaries and bounded page loading verified. No adapter/schema/projection changes.
  - **Do:** tick length ∝ operations in the turn (clamped); red notch if the turn contains a failure; amber dot if it edited files; the current reading position is marked. The hover preview shows the ledger. Keep it as an independent chapter rail.

- [x] **TURN-4 · Replay transport in Modern** · P1 · `turn` `motion`
  - **20 October, PR #148:** explicit workspace-menu Replay entry; compact Play/Pause, steps,0.5–4×, edit/failure jumps, native slider with supplied turn ticks and Exit. Existing clock/seek/marker API and Settings entry reused. Three focused browser checks and actual Drishya Codex / Skeletongraph Codex / Claude records verified; hover/up-scroll do not pause; captured history grows during paused replay. [Evidence and limits](review/turn-4-modern-replay.md).
  - **Problem:** Settings → Playback contains only "Sequence diagnostics". Play/pause/speed exist in Legacy `components/Viewer.tsx` and in `.history-transport`, but never appeared on real Modern sessions.
  - **Do:** an explicit "Replay" entry (⋯ menu or Ctrl+K) shows a compact transport: play/pause, speed 0.5–4×, next edit, next failure, scrubber with turn ticks. Live history continues independently (constraint 7).
  - **Accept:** replay never stops on hover or scroll; only pause, seek, leaving, completion or failure stop it (review 31).

### READ — reading code, diffs and output

- [x] **READ-1 · Wide, scannable edit cards** · P0 · `read` — **shipped 19 Oct (core).** A diff card with a long line or more than 24 lines now takes the width its longest line needs, up to the passage (860 px at 1440 px; 738 px at 1280 px; the full row on phones), instead of a fixed 440 px. Code diffs do not wrap and scroll sideways inside the card, with the added/removed backgrounds spanning the longest line; Markdown/text files stay wrapped. The header shows `+N −M` counted from the captured patch. Small edits keep their compact card. Verified on the Codex session at 1440/1280/1024/390 px (no page overflow, card inside its row). Helpers and tests: `lib/card-evidence.ts`, `apps/ui/test/card-evidence.test.ts`.
  - **Not done, on purpose or blocked:** a per-card Wrap toggle (it would add a button to every card; Expand → Wrap lines already exists); folding unchanged runs over 6 lines (rare in real patches); real file line numbers for Codex edits (they need DATA-1, Claude patches already carry them); a `✓ applied` word (the existing state mark stays).

- [x] **READ-2 · Quiet provenance** · P0 · `read` `ui` — **shipped 19 Oct (history cards).** Removed the always-on strings "Captured changes · scroll to read", "Captured arguments · bounded preview", "Historical source · recorded result", the "Captured patch · reconstructed from captured base" line, the "derived from exec" footer, the Toolbox footer "Captured use counts" (now a tooltip) and "Captured" in the arguments label. Each card has one ⓘ (hover, focus or touch; a native popover, Escape closes it) that gives the exact wording: the patch is captured, not the current file; whether the after-state is verified; whether the harness exposed the outcome; whether the type is captured, derived (with its rule) or generated. Inline text remains only where it changes the meaning: `Outcome not exposed`, `After-state not verified`, `Patch request · awaiting recorded outcome`, `Captured input preview · expand for full text` and `Command argument · decoded`. Verified popover position, keyboard and Escape on real sessions.
  - **Not done:** other surfaces still carry their own provenance text (Inspector, Canvas "derived label", file evidence readers, Legacy); renaming the "Other · exec" meta needs the typed tool names from DATA-1.

- [ ] **READ-3 · Settle into ledger rows** · P2 · `read` `motion`
  - **Idea:** once an operation is N steps old, its card compresses into one row (`✎ src/store/index.ts +12 −3 ✓`), still inside the wrap layout; hover or `e` re-expands it in place.
  - **Prototype first** (`prototype` skill) and get builder sign-off; the current overlap/settle behaviour is liked.

- [ ] **READ-4 · Passage layout refinement (keep the design)** · P1 · `read` `motion`
  - **Keep:** pack actions left→right in a row; wrap to the next row when the width runs out; arrows show box → box order.
  - **Do:**
    - Deterministic wrap rules: wide diff cards (READ-1) start a row; never orphan a single tiny card when it fits the previous row.
    - Arrows always run from the previous box's exit edge to the next box's entry edge, without crossing a card.
    - Row order is unambiguous at every width.
  - **Accept:** golden layout tests at 1024/1280/1440/1920 px; no crossing arrows on 3 actual sessions.

- [ ] **READ-5 · Session diff with blame-by-turn** · P2 · `read` `git`
  - **Do:** a PR-style net diff for the whole session per file, where each hunk carries the turn/operation that produced it and the next check that ran. Only exact evidence-backed attribution; unknown stays "unattributed". This was previously deferred; it is the core "why is this line here" feature.

- [ ] **READ-6 · Read-before-write signal** · P2 · `read`
  - **Do:** for each edit, whether and which ranges of the file were read earlier in the session (Claude Read `startLine`/`numLines`; Codex reads after DATA-1). Facts only: "edited without reading this file", "edited lines 40–58; read 1–30". It is a fact, not a judgement or a risk score.

- [ ] **READ-7 · Failure → fix chains** · P2 · `read` `turn`
  - **Do:** link a failed command to the next run of the same command identity, and show the edits between them: `✗ pnpm test → 3 edits → ✓ pnpm test`. Label it a "same command, later run" relationship, never a cause.

- [ ] **READ-8 · Promote the per-file timeline** · P2 · `read` `files`
  - **Do:** from any path, open every read and edit of that file in order, stepping diff by diff with the captured version at each step (`components/FileHistory.tsx` exists).
- [x] **READ-9 · Source reader density on phones** · P2 · `read` `ui` — **20 Oct, merged in PR136 after Claude review.** Current-file peek uses one compact find row with inline match arrows/count on narrow viewports; line jump, wrap, copy, source provenance and existing file handoffs live in a single header Reading options disclosure. Match count keeps its full accessible description. Desktop and Legacy retain their existing controls. Escape closes only the menu, outside click dismisses, and touch uses16px input text/44px menu targets. Restored390/320px source-allocation assertions: reproduced0.463 before; actual Codex/Claude imported sessions measured0.690 with mouse and0.635 with emulated touch, above0.62. Both TS/build,10 focused units,18 connected-workspace browser journeys and two real-session matrix journeys pass. Scope and integration notes: [READ-9 evidence](review/read-9-phone-source.md). Physical keyboard/device acceptance remains REL-3, not certified here.

### CONTENT — content-shaped presentation per action type

- [ ] **CONTENT-1 · Images (finish)** · P1 · `content` `data`
  - **Sources:** Codex `ImageView.path` (348 in sample) and user `input_image` blocks; Claude Read of image files, Bash `isImage`, screenshot tools (browser MCP `computer` screenshot results); Codex `Extension` image generation (`savedPath`, `revisedPrompt`).
  - **Do:**
    - Captured bytes present → bounded preview with fit/zoom/pan reader.
    - Path only → an honest card ("image at path, not captured") with an explicit, consented "Open current file" that says the current file may differ from what the agent saw.
    - Never auto-load remote images; never dump base64.
  - **Accept:** each source verified on actual sessions; missing, expired and remote states are explicit; the phone sheet works.

- [ ] **CONTENT-2 · Browser and web evidence (finish)** · P1 · `content` `data`
  - **Do:**
    - WebFetch → URL, status code, bytes, duration, result excerpt as a readable page summary.
    - WebSearch / Codex `Extension` search → query plus result list (title · domain · snippet) with safe external links.
    - Browser MCP (`navigate`, `computer`, `read_page`, `find`) → a compact "browser strip": URL bar, action (click/type/scroll), screenshot thumbnail when captured, and the page-text excerpt.
    - Consecutive browser steps group into one strip with a step scrubber.
  - **Accept:** a browser-heavy Claude session (like this review's own session) reads as a browsing story, not 40 identical `Claude_Browser · computer` cards.

- [ ] **CONTENT-3 · Questions and approvals as first-class cards** · P1 · `content` `live`
  - **Sources:** Claude `AskUserQuestion` (questions/answers/annotations); Codex `request_user_input_async` and `AgentMessage.questions`; native pending approvals (already wired for the controller).
  - **Do:**
    - The question card shows each question with its options; the chosen answer is highlighted once answered.
    - While pending in a connected session, answer inline (existing native question protocol).
    - Approval cards show the exact command or diff being approved.
    - The pending state drives LIVE-1 ("waiting for you") and LIVE-3.
  - **Accept:** historical, pending and answered states for both harnesses; never answer for the user; unsupported → explicit message.

- [ ] **CONTENT-4 · Plans and todos as a living checklist** · P1 · `content` `turn`
  - **Sources:** Claude `TodoWrite` (already mapped); `TaskCreate`/`TaskUpdate`/`ExitPlanMode` are **unverified: the journals on this machine contain no real uses** (the earlier counts came from tool definitions), so specify them only after a real plan-mode session is captured (review 125 §8, D10); Codex plan updates (DATA-7).
  - **Do:**
    - One checklist per turn, pinned under the turn header, updated in place as items change state; a done item gets a quiet strike.
    - The plan text from plan mode renders as Markdown "Plan" material.
    - History keeps each revision; the latest is shown.
  - **Accept:** a session with 10+ todo updates shows one evolving list, not 10 cards.

- [ ] **CONTENT-5 · Sub-agents with identity** · P1 · `content` `data`
  - **Do:** name agents from Claude `Agent.description`/`subagent_type` and Codex `session_meta.agent_nickname`/`agent_path` and `SubAgentActivity` (model, effort). Spawn → child → result shown as one delegation thread, collapsible. Fixes "subagent" ×6 in the Codex session.

- [ ] **CONTENT-6 · Shared adaptive content selector** · P2 · `content` — sealed MIME, content blocks, structured fields and artifact evidence first; native, MCP and wrapped tools share readers. Preserve mixed siblings, exact raw access, limits and unavailable states. No dispatch on exact command only, no regex fabrication, no execution to regenerate content. Covers live, replay and Legacy-backed Modern.

- [ ] **CONTENT-7 · Structured data and document views (finish)** · P2 · `content` — safe result/resource-link cards and Markdown/document/artifact handoffs; extend existing readers; complete raw access; explicit current-vs-captured. Charts only from selected numeric evidence.

- [ ] **CONTENT-8 · Cross-tool visual parity** · P2 · `content` — content-shaped previews for read/edit/search/tests/plans/delegation/questions/process progress, including unknown MCP and orchestration results. Acceptance: mixed, large, truncated and missing cases on actual sessions, phone, live and replay (audit [111](review/111-adaptive-content-and-pr110.md)).

- [ ] **CONTENT-9 · "Reasoning not recorded" state** · P1 · `content` `read`
  - **Do:** where a turn has thinking/reasoning blocks with no text (Claude signature-only; Codex encrypted), show one quiet line per turn: "Reasoning not recorded by Claude Code", with an ⓘ explaining why. Show summaries and text when present. This is never filled by a model unless EXPLAIN output is explicitly requested and labelled.

### DATA — harness capture ([123](review/123-harness-data-audit.md))

- [x] **DATA-10 · One batched schema proposal** · P0 · `data` — **drafted 19 Oct:** [review 125](review/125-event-schema-proposal.md): five slices (turns+usage, typed Codex items, reasoning state, questions/images/web, Claude extras), all additive (`CONTRACT_VERSION` 0.2.0-draft, `REDUCER_VERSION` r5), with measured evidence, privacy rules, fixtures and an order of work. **Agreement is still needed:** both builders tick D1–D10 in §9 of that doc before any slice starts.

- [ ] **DATA-1 · Codex typed items** · P0 · `data` `content` — **blocked on D1, D2, D8 in [review 125](review/125-event-schema-proposal.md).** Measured there: typed items cannot be matched to the wrapper call by id; 85% sit inside the `exec` call's window, so correlation is by enclosing call and says so.
  - **Do:**
    - In `packages/adapter-codex/src/index.ts`, stop ignoring `event_msg:item_completed`. Map `CommandExecution` (command, parsed_cmd, cwd, status, exit_code, duration, outputs), `FileChange`, `McpToolCall` (server, tool, status, duration, error, readOnlyHint), `ImageView`, `Extension`, `SubAgentActivity`, `Reasoning.summary_text` and `AgentMessage.phase/questions`.
    - De-duplicate against `response_item` calls by call/item id. Prefer the typed item for outcome; keep the wrapper as raw source.
    - Declare capabilities per CLI version; unknown shapes stay metadata-only.
    - Add redacted fixtures for each item type.
  - **Accept:** card titles show real commands/tools instead of "exec"/"Other"; tests are recognized from real commands and exit codes (closes BUG-5); no duplicate cards; older rollouts without these items still import identically (golden tests).

- [ ] **DATA-2 · Usage from what is recorded** · P0 · `data` `live` — **blocked on D4–D6 in [review 125](review/125-event-schema-proposal.md)** (usage observation, cost label, rate-limit fields; credits balance is excluded).
  - **Do:**
    - Codex: `token_count.info` (total/last usage, `model_context_window`) and `rate_limits`.
    - Claude: `message.usage` per assistant message and `cost-state` (`totalCostUSD`, `totalLinesAdded/Removed`, durations, `modelUsage`).
    - Show harness-reported values only, labelled with their source. Cost is the harness's own estimate, so say so.
    - Hide rows that are not reported instead of listing four "Not reported" rows.
  - **Accept:** Usage populated for both harnesses on actual sessions; no invented totals (existing rule).

- [ ] **DATA-3 · Codex session and turn metadata** · P1 · `data` — `session_meta` (agent_nickname, agent_path, parent_thread_id, forked_from_id, git), `turn_context` (approval_policy, sandbox_policy, permission_profile, effort, collaboration_mode), `task_complete` (duration_ms, time_to_first_token_ms, error). Feeds TURN-1, CONTENT-5 and the connection details.

- [ ] **DATA-4 · Claude extras** · P1 · `data` `content` — map `AskUserQuestion`, `TaskCreate`/`TaskUpdate`, `ExitPlanMode`/`EnterPlanMode`, `NotebookEdit`, Bash `isImage`/`interrupted`/`persistedOutputPath` (read spilled full output with existing artifact limits), `agent-name`, `mode`/permission-mode changes, WebFetch `code`/`bytes`/`durationMs`.

- [ ] **DATA-5 · Claude checkpoints** · P1 · `data` `read` — read `file-history-snapshot.trackedFileBackups` to offer "file before this turn" comparisons where backups still exist; say plainly when retention removed them. Read-only; never restore files.

- [ ] **DATA-6 · Changed outside the agent** · P1 · `data` `read` — `attachment:edited_text_file` → a small mark in history and on the file row: "changed outside the agent (you or a tool)", with the captured snippet. Never attribute it to a person.

- [ ] **DATA-7 · Codex `plan_update` / `turn_diff` verification** · P2 · `data` — both are in the adapter's ignore list but absent from the local sample. Verify on a fresh CLI and app-server session; if present, `turn_diff` is a free per-turn net diff (TURN-1, READ-5) and `plan_update` feeds CONTENT-4.

- [ ] **DATA-8 · Reasoning persistence** · P2 · `data` — verify which harness settings persist reasoning summaries (e.g. Codex `model_reasoning_summary`), test on fresh sessions, and document in README what users can enable. No claims until tested.

- [ ] **DATA-9 · Hook/OTel enrichment research** · P2 · `data` — evaluate Claude Code/Codex hooks and telemetry exporters as optional, non-blocking enrichment (research ledger H1–H3). Measure overhead; observer hooks never return control or context.

### EXPLAIN — model-derived explanation (Nemotron, opt-in)

Rules: opt-in per call or per session; preview the exact payload; content redacted at ingest and again before sending; output labelled "Generated by <model>" in a distinct derived style; every claim cites captured evidence IDs (`E1…En`); uncited claims are dropped and counted. This fills the *why* that harnesses no longer record ([123](review/123-harness-data-audit.md) §1). It never replaces captured text and is never presented as the agent's thinking.

- [ ] **EXPLAIN-4 · Live validation** · P1 · `explain` — get a Token Factory key; list models (`GET /v1/models`); set real Nano/Super/Ultra ids (defaults in `packages/explain/src/index.ts` are unverified); run explain, briefing and labels on a real session; record latency and cost per call in a short note under docs/review.

- [ ] **EXPLAIN-1 · Narrator labels** · P1 · `explain` `live`
  - **Do:**
    - With the narrator on for a session, each burst of consecutive operations (or each passage) gets a one-line generated intent above it, e.g. "Investigating why checkout rejects free orders [E3,E5]", from Nano.
    - Batched, debounced (≥ 10 s or end of passage), cached by evidence hash, cancellable.
    - Shown in the derived style with the model name on hover.
    - The narrator off means zero network calls.
  - **Accept:** works live on a Codex and a Claude session; no call before opt-in; labels cite real operations; cost and latency within the targets recorded in EXPLAIN-4.

- [ ] **EXPLAIN-2 · Turn summary and return briefing** · P1 · `explain` `turn`
  - **Do:** on request (button in the turn ledger, or "While you were away" after the tab was hidden for more than 2 min), Super writes 3–5 cited bullets: what changed, what was checked, what failed, and what is still open. Each bullet links to its evidence.

- [ ] **EXPLAIN-3 · Explain this hunk (validate)** · P2 · `explain` — the existing Ultra/Super path; validate on real diffs; citations jump to the step.

- [ ] **EXPLAIN-5 · Derived visual language** · P2 · `explain` `ui` — one consistent treatment for generated text (for example an italic secondary tint, a small model glyph and a dotted underline on citations) that can never be mistaken for agent prose or captured output, including in exports.

### GIT — Git review, graph and Sacred Timeline

- [x] **GIT-1 · Sacred Timeline** · P1 · `git` `motion` — **finished 20 Oct at the builder's request** (no longer a prototype).
  - **20 October, finished:** branches are grouped into real runs (first-parent walk), each on a seeded side and the nearest free tier, just outside the river's rim (or outside the branch it left), with a slow seeded drift; the river meanders and fades in from older history and out past the newest commit. A strand starts thin and gains width at every commit (new filaments fade in at that commit), never past half the river. Space is black with white stars. Hovering a strand between commits names the branch (its ref), whether and where it merged, where it left, authors, time span and its commits; clicking it opens the newest commit; a commit peek says which commit of its branch it is. Zoom keeps the point under the pointer (buttons: the middle) in the same commit as the new scale, with room added at either end when needed; pinch and Ctrl/⌘ + wheel zoom the graph instead of the page; `+`/`−` keys; buttons step ×1.4 and disable at the limits. Labels of branches below the river sit below it. Tests: `git-light.test.ts` 8; Git atlas spec checks Ctrl + wheel anchoring (< 12 px) and the branch peek. **Not measured:** 60 fps with 500 commits on the reference machine (PERF-1/REL-2); the octopus/shallow/detached matrix is covered by the unchanged topology layout's tests, not re-run visually.
  - **20 October, builder follow-up:** (1) Zoom now magnifies: the river, branch distances and lightning scale with zoom (river 56 px × scale, 14–120 px), where before only the commit spacing grew, so "zoom in" looked like a sideways stretch. (2) Squash merges are shown merging: Git keeps no parent link for a squash, so the daemon now returns content signatures (`git-history.ts` `squashEvidence`: sorted path + written blob, hashed) for each non-merge commit's own change and for each branch head's whole change since it left the primary line; the UI joins them across loaded pages, and a branch whose change a newer primary commit wrote exactly flows into that commit to the right ("squash-merged into main at …" in its peek, with the commit named). No match, no line. On this repository 42 of 65 graph-unmerged branches match. Forks rise early and merges drop late, so a branch travels beside the river and flows in at its merge. Squash-merged heads get no lightning. Tests: daemon squash evidence 1, `git-light.test.ts` 10.
  - **20 October progress:** step 1 prototype landed as [`docs/prototype/sacred-timeline.html`](prototype/sacred-timeline.html) (synthetic topology; WebGL2 additive filaments, half-float bloom, starfield, DOM commits/refs/peek/keyboard; variants River, Ice, Storm; `?lite=1`). Builder looked at the stills and asked to integrate directly and keep iterating toward the reference.
  - **20 October, integrated:** `GitThreadGraph` now draws the light (`lib/git-light.ts` geometry, `lib/light-renderer.ts` WebGL2) under the unchanged DOM commits, labels, peek, paging and keyboard; the SVG ribbon and Orbit remain only without WebGL2. Screen-space and view-bounded: redraws on pan/zoom/hover only (idle 0), ≤ 40k segments (8k and no bloom in low resource). Real-repo fixes: branch commits keep a screen-space clearance from the river at every zoom (buttons use the same positions); lightning size follows the branch's loaded width and only opens forward (builder: flow must read left → right); white-hot core with magenta/violet rims. Verified on this repository (82 refs, squash-merge history). Tests: `git-light.test.ts` 5, Git atlas spec updated for the lit path. **Remaining:** 60 fps measurement with 500 commits, the fork/merge acceptance matrix (octopus, shallow, detached), optional flow motion; the row list is GIT-3. Squash-merged PRs leave no merge edge in Git, so those branches end at their head; GIT-2 is where a session/PR link could show that.
  - Build to the spec in [124](review/124-sacred-timeline-git-graph.md):
    - WebGL/Canvas additive **filaments** with bloom;
    - the main line as a braided luminous river;
    - branches peel off the rim at real forks, rejoin at real merges, and split into lightning tips only at unmerged heads;
    - a starfield backdrop;
    - commit points with DOM buttons, peek and keyboard.
  - Prototype first with the `prototype` skill; builder sign-off on stills before integrating. Topology truth unchanged.
- [x] **GIT-3 · Commit rows and ref filter** · P1 · `git` — a compact message · author · time · refs row list synced with the timeline; branch list filtered to refs in the loaded window, with an All toggle (today: 183 truncated names).
  - **20 October, done:** `CommitRows` under the timeline (a toggle in the graph header, remembered): hash · message · refs · author · age, newest first. Hover and selection mirror both ways; a row pick brings an off-screen commit into view (smooth, instant under reduced motion or low resource). The reference list starts as the refs named by loaded commits (plus checked-out and picked), with an "In view / All N" scope; searching or All restores the paged server list. Also fixed the reference column clipping its bottom controls (`::details-content`). Tests: `git-commit-rows.test.ts`, the Git atlas spec; verified on the real repo (50 rows, 18 of 86 refs in view).
- [ ] **GIT-2 · Session ↔ commit links** · P2 · `git` `turn` — commits whose hash appears in captured command output, or whose time and paths match a captured commit command exactly, are marked with the session and turn. Evidence-backed only. Uncommitted session work appears as a "working tree · this session" entry.
  - [x] **20 October, hash-in-output links:** the Git history response carries `sessionLinks`: a commit whose full hash or 7-character abbreviation appears in a captured tool result gets the first such result and its turn (turns count `turn.start`, or prompts for harnesses that record none). Shown as a quiet `turn N` in the commit rows, a line in the commit peek ("Hash seen in this session's output"), and a **Seen in turn N** button in the detail that opens that operation. Wording says the hash appears in output, never that the session made the commit (`git log` lists others' commits too). Verified on this very session (commits from turns 39–41).
  - [ ] **Remaining:** match by commit time plus paths against a captured commit command, and the "working tree · this session" entry.
- [ ] **GIT-4 · Hunk-level Recorded work** · P2 · `git` `read` — from a Git review hunk, jump to the captured operation that wrote those lines, where exact.

### FILES — Explorer, peek and Workspace

- [ ] **FILES-1 · Evidence-decorated tree** · P1 · `files` `live`
  - **Do:**
    - Each file row may show `E` edited / `A` created / `D` deleted (amber/green/red letter), a read eye with a count, and a subtle "now" mark on the file under the current operation.
    - Folders aggregate (dot plus count).
    - A "Touched" filter shows only files with session evidence.
    - Decorations come from captured operations, never current Git status alone; Git status stays in Git review.
  - **Accept:** matches Review work's changed files; updates live; no resident new buttons (the filter goes in the Find field's menu). Active implementation is shared `FolderExplorer` in `SessionWorkspace.tsx`; the older standalone `ModernFiles.tsx` is not the active Modern tree.

  - [x] **20 October supported-evidence increment:** read-call eye/count, recorded creation (`A`) and edit/write (`E`) marks, open captured-call `now` in live history, distinct touched-file counts on folders, and Touched in Find's menu. Counts use a bounded whole-history worker query; file opening and virtual-tree keyboard names remain intact. See [FILES-1 evidence](review/files-1-evidence-tree.md).
  - [ ] **Remaining, DATA-1 dependent:** deletion (`D`) requires a retained explicit deletion discriminator; current `OperationDetail.edit` has `created` but no deleted field. Do not infer deletion from empty replacements, absent current files or Git status. Recheck typed Codex changes and Claude deletion evidence after DATA-1; also re-import/rescan legacy captures missing those items. FILES-1 stays open for this scope.

- [ ] **FILES-2 · Paths open in peek** · P1 · `files` `read` — any path in prose, card headers, search hits and test output opens in the tabbed peek (captured version by default, with an explicit current-file toggle under consent).
  - [x] **20 October, prose and typed History paths (PR #157):** workspace-contained Markdown/inline-code file links open captured work with line anchors; read/edit/write card titles select their exact read/patch, and both preview/expanded search hits select the exact match and line. Relative/Windows/POSIX paths normalized without IO; external/outside/traversal targets stay inert and version/IP code stays code. Actual Codex/Claude checks,13 units and two browser journeys pass. [Evidence](review/files-2-prose-links.md).
  - [ ] **Remaining:** test/output paths and search-result surfaces outside History, with the same captured-first route and explicit current-file consent. Keep unresolved paths honest; do not infer a location from arbitrary command text.

- [ ] **FILES-3 · Navigation clarity** · P2 · `files` `ui` — make the purposes of Files (current tree), peek (read beside the agent), Workspace (full view and drafts) and Repository (map) obvious through one-line hints and destinations, with a joined investigation route, not more resident buttons.
  - **19 October progress (107):** Correction entry/retained origin and explicit Files exit from map mode implemented. New peek/Workspace roles preserved. Broader navigation acceptance remains open.

- [ ] **FILES-4 · Reader and Workspace review** · P2 · `files` — type and line height, syntax, paths, Markdown, tab design, pane sizing, toolbars, copy/find/wrap/go-to-line, resize/scrollbars, long and empty material.
  - **19 October progress (107):** Existing whole-file/current-draft readers retained alongside new compact peek, data/resource readers and Actions menus. Investigation/recovery and desktop/phone regressions added; broad material combinations remain open.

- [ ] **FILES-5 · Opt-in draft recovery** · P2 · `files` — design explicit opt-in persistence before storing edited text; keep download and the unsaved warning until then; never imply volatile drafts survive crashes.
  - **19 October progress (107):** Explicit user-owned encrypted snapshot download, unlock preview and deliberate matching-workspace restore implemented. No autosave or stored key/passphrase; ordinary drafts remain volatile. Protected/secret-pattern text refuses recovery; stale bases and live-draft conflicts retained. Synthetic reload/privacy/limit regressions pass; native writes remain excluded.

### UI — visual system, chrome and minimalism

- [ ] **UI-1 · Chrome consolidation and session identity** · P1 · `ui`
  - **19 October progress (107):** Session details in existing utilities shows exact title/harness/recording/root and journal-watch qualification. Modern central capsule remains absent under latest builder correction; proposed unified bar is not adopted here.
  - **20 October, identity shipped (#137, builder approved):** the brand pill holds the session title and one quiet `repo · harness · model` line with a dot (journal watched; green while the agent works); phones show mark + title; the phone rule that had hidden the brand mark is fixed. No capsule, no new outline. **Still open:** branch in the identity line (needs the projection to keep `session-meta.branch`), fewer floating islands (Files|Repository, Git review|Git graph, Workspace), and the bottom-corner Tools/Follow overlap at narrow widths.
  - **Problem:** nine floating clusters (logo, Files|Repository, search/settings/menu, Git review|Git graph, Workspace, Toolbox, rail, Follow, composer), each with its own border. The session's title, repo, branch, harness and live state are invisible.
  - **Do:**
    - One slim top bar: identity (title · repo@branch · harness/model · live dot · LIVE-1 status), then navigation (Files · Git · Map · Workspace · Search · ⋯).
    - Toolbox and Files stay docked panels.
    - Retain the builder's header-capsule comparison decision by showing it to them before merging.
  - **Accept:** fewer outlines on screen; identity visible at all widths; nothing overlaps, including the bottom-corner Tools/Follow pills at narrow widths (residual from BUG-4).

- [ ] **UI-2 · Typography floor** · P1 · `ui` — 280 CSS declarations are ≤ 10 px (14 at 7 px, 53 at 8 px, 84 at 9 px). Set a floor of 11 px for meta and 12–13 px for controls and labels; raise secondary-text contrast to ≥ 4.5:1 on every palette. Check with the existing contrast guard.
  - [x] **20 October, Home (PR #145):** 9–10px metadata raised to11px; About/refresh/filter controls meet12px. Theme-aware Claude Home mark replaces a fixed pale tint. Existing contrast guard plus seven-palette mark checks; real-session Home and300-session keyboard/320px layouts verified. [Evidence](review/ui-2-home-typography.md). Other surfaces remain open.
  - [x] **20 October, Settings/Git graph (PR #155):** Settings metadata and palette captions reach11px; controls/shortcut rows reach12px, with visible phone palette notes and wrapping keys. Git reference/commit/hover metadata reaches11px and controls12px, without graph geometry/motion changes. Seven-palette actual-composited Settings contrast and phone/short-window checks; real Codex/Claude sessions and existing Git navigation regressions pass. [Evidence](review/ui-2-settings-git-typography.md). Other surfaces remain open.
  - [x] **20 October, Toolbox (PR #159):** counts, MCP labels and agent states reach11px; disclosure/filter controls12px. Both3/300-tool browser cases cover seven palettes, Agents/Clear focus and desktop/phone bounds; actual Codex/Claude checked. [Evidence](review/ui-2-toolbox-typography.md). Other surfaces remain open.

- [ ] **UI-3 · Uiverse / component-library pass** · P1 · `ui` `motion`
  - **19 October progress (107):** Switch/minimal-input/hover references assessed; original token-based controls/focus/fields with motion/resource/forced-color fallbacks implemented. No copied library/runtime dependency. New shimmer/prototype-choice scope remains separate.
  - [x] **First (20 October, PR #142):** the builder's reference [Star on GitHub shimmer button](https://uiverse.io/elijahgummer/bright-chicken-11) (MIT): black pill, a diagonal light sweep on hover (1 s ease-out), ring-offset on hover, and a star icon that tints on hover.
    - [x] Ported to our tokens (no Tailwind dependency); reduced-motion, low-resource and motion-off fallbacks.
    - [x] **No live star count** or automatic GitHub request; normal external link only.
    - [x] Moved from the primary header to Home's footer. [Attribution and local checks](review/ui-3-home-github.md). Broader UI-3 component selection remains open.
  - **Then** survey Uiverse and similar libraries (shadcn/ui, Origin UI, Magic UI, Aceternity UI, motion-primitives, React Bits) per component: toggles, segmented controls, inputs, search fields, menus, tooltips, tabs, checkboxes, dialogs, loaders/empty states.
    - Selection rules: fits the dark flat hairline theme; no glow pools; CSS-first; MIT or compatible licence with attribution; accessible (focus, keyboard, forced colours); reduced-motion fallback.
    - Use the `prototype` skill to show 2–3 candidates per component behind a switcher; the builder picks.
  - **Accept:** each adopted component is listed in a short attribution note.

- [ ] **UI-5 · Button density and navigation** · P1 · `ui` `files`
  - [x] **20 October, Git review chrome (PR #144):** Modern repository/branch/current-Git context and Files/refresh/Actions share one row; handoff, recorded work and Git graph move into the existing dismissible keyboard menu. Selected-file path and Open on disk stay together. Legacy and shared patch controls unchanged. [Validation](review/ui-5-git-review-controls.md). Related Workspace/reader increments are recorded below.
  - [x] **20 October, Workspace source toolbar (PR #144):** Find/Go/Wrap remain visible; Copy uses file Actions. Compact match count retains its full accessible description.320px toolbar110→83px with controls12px minimum; whole-file10,000-line navigation retained. Shared patch/source completion is recorded below; broader Workspace chrome remains open.
  - [x] **20 October, shared patch toolbar (PR #144):** Modern layout choice, wrap icon and compact whole-patch search share a wrapping row; hunk jump is in Patch options only for multi-hunk patches. Actual current-Git control allocation109→48px desktop and137→86px at320px. Captured edit/current Git/native draft/source-comparison consumers retain state, exact evidence and Legacy controls;13 focused browser journeys and both typechecks/build pass. Historical-source completion is recorded below; broader Workspace header review remains open.
  - [x] **20 October, historical source toolbar (PR #144):** Modern Find/Wrap and exact loaded-page scope remain visible; Copy, stored-line jump and range/pin actions share Stored source options. Validation and copy feedback stay visible inside the open menu. New Modern stored-search/exact-copy/keyboard/mobile journey plus retained Legacy distant-search/range/provenance regressions pass; actual Skeletongraph Claude source inspected before/after. No artifact loading or source-boundary change. Remaining UI-5 scope: broader Workspace headers and whole-reader combinations; parent stays open.
  - **Problem:** in Workspace, Git review and readers, rows of controls ("Changes · Side by side · Wrap lines · Hunk [1] of 1", "Working tree · Raw patch", "Open on disk · Recorded work", "Hide files · Refresh changes · Preview handoff") take more space than the content.
  - **Do:** per surface, keep at most 3 primary visible actions. Move secondary actions into one ⋯ menu or a reader toolbar that appears on hover/focus. Use icon buttons with tooltips for frequent toggles (wrap, side-by-side). Use one consistent header layout for every reader.
  - **Accept:** before/after screenshots of each surface; every action is still reachable by keyboard; no lost features.

- [ ] **UI-4 · CSS consolidation** · P2 · `ui` `perf` — 39 CSS files (~600 KB source) and 241 `!important`, layered from successive redesigns. Freeze Legacy, retire Canvas (with builder agreement), move Modern onto one token sheet, delete dead overrides. Visual regression screenshots before and after.

- [ ] **UI-6 · Phone density and occlusion** · P2 · `ui` — Files overlay, map import drawer and composer ownership on phones; compact returning-user Home.
  - **19 October progress (107):** Files/composer clearance, wrapped Workspace navigation and bounded menus checked at320/390/900/1440px. Compact main Home/peek retained; real devices and other header/map-drawer cases remain open.

- [ ] **UI-7 · Every palette across every surface** · P2 · `ui` — actual code/diffs/tests/menus/editor, translucent compositing, light-theme balance and semantic status contrast. A palette selector or token test is not the completed theme pass.
  - **19 October progress (107):** Ten synthetic material kinds across seven palettes, draft comparisons/Git/Home/review readers and existing redacted Codex/Claude material checked. Current Codex source succeeds; old Claude current index unavailable and explicitly qualified. Every real artifact/state is not certified.

- [ ] **UI-8 · Whole-product UI pass** · P2 · `ui` — header and edge panels (alignment, hit targets, overflow, disclosures, no duplicate controls); composer (draft, attachments, file/folder/image/paste previews, permissions/model/effort, send/stop/approval/error/reconnect, focus/menus); all action types on actual Codex and Claude sessions (read/write/edit/search/shell/test/web/MCP/delegation/unknown; size combinations; decoding/raw access; errors; all lines reachable; accurate test bars). Includes components never called out in screenshots.
  - **19 October progress (107):** Shared focus/native-select/dialog ownership, quiet keyboard switches, true Jet Black and bounded edge surfaces implemented. Broad suite and recorded-material audit in107 do not close all real native/material combinations.
- [x] **UI-9 · Hover-reading cards fit their content** · P1 · `ui` — **fixed 20 Oct.** Yash's screenshot: a Shell card with a long command and a one-word result opened as a tall box that was mostly empty. Cause in `lib/hover-reading.ts`: the height added the hidden depth of the clamped command box and was floored at 112% of the resting height. Now the card is laid out at its natural height with the most room it may take (`--hover-room`), measured, and allocated exactly that, up to the viewport cap; a longer result scrolls inside the cap. New `tests/browser/hover-fit.spec.ts` measures the empty band under the last visible text of every hovered card (fails at 86 and 167 px before, ≤ 30 px after).
- [ ] **UI-10 · Count-dependent surfaces: small and large states** · P1 · `ui` — Yash, 20 Oct: when the number of items is small, show all of them; when it grows, the surface must switch behaviour instead of growing without limit or squeezing every item to one line. Decide the threshold and the large-state behaviour per surface (hover card with long output, prompt rail, tool dock, file tree, ledger chips, import list, changed-files lists, search results) and share one helper for "fit up to a cap, then page or scroll". **Do:** list the surfaces with a count- or length-dependent layout, give each a documented small and large state, test both with a fixture of 3 and of 300 items. **Accept:** no surface shows an empty band at 3 items or a clipped, unscrollable list at 300.
  - [x] **20 October, MCP/runtime inventories (PR #146):** shared `collectionBounds` policy; natural short lists, six-row/216px budget for long lists with36dvh fallback, no omitted entries. Disclosure stays outside the local scroller. Fixtures3/300 for both lists, Home/End and1440/390/320px checked; actual-session context inspected. [Evidence](review/ui-10-tool-inventories.md). Other listed surfaces remain open.
  - [x] **20 October, recorded Agents (PR #160):** reuse the shared natural-height/216px/36dvh list, retaining family nesting and filter/clear. Normalized synthetic3/300-agent cases, long names, End navigation and desktop/phone/short viewport checks pass; actual seven-agent Codex list retains its last row and outer disclosure. [Evidence](review/ui-10-agent-inventory.md). Native lineage/physical gates and other collections remain open.

### MOTION — interaction motion

- [ ] **MOTION-1 · Every control has purposeful motion** · P1 · `motion`
  - **19 October progress (107):** Short state changes and keyboard/reduced-motion/resource/forced-color checks added; keyboard map focus holds orbit. Modal Escape dismisses immediately with native select behavior. Main prompt/Toolbox/reader motion retained. Full per-control design pass remains open.
  - **Scope:** every clickable control and nested state on every page:
    - prompt minimize/expand, Explorer open/close, Toolbox minimize, folder expand/collapse;
    - Files ⇄ Repository ⇄ Workspace entry and return; menus, popovers, tooltips, settings sections;
    - reading windows and peek tabs; Git drawers; disclosures, toggles and segmented controls;
    - press states; copy feedback; selection.
  - **Rules:**
    - Motion is tied to the true origin and the final state: scale/opacity from the trigger for popovers, translate from the docking edge for panels, a height-free transform for disclosures.
    - Durations are about 120–240 ms with ease-out on enter and a faster exit.
    - Reversals and rapid repeated clicks are interruptible from the current state.
    - No animated virtual-row layout, no delayed or faked content.
    - Reduced-motion and low-resource variants.
  - **Method:** run `find-animation-opportunities` read-only, then `improve-animations` for a plan, implement in small commits, and finish with `review-animations`.
  - **Accept:** an inventory table (control → motion → duration → fallback) committed in a review doc; actual-session desktop/phone checks.

- [ ] **MOTION-2 · Lift from the tree row** · P2 · `motion` `files` — new read/edit cards grow from the file's row in the visible Files tree (the true, visible origin); fall back to the existing origin when the tree is hidden.

- [ ] **MOTION-3 · Live/replay motion evaluation** · P2 · `motion` — origin → whole material → settle; hover entry, exit and switching; reflow/scroll; burst and late results; ten-minute calm. No fake typing, reasoning or copied evidence.

### HOME — sessions

- [ ] **HOME-1 · Useful rows, quieter chrome** · P1 · `home` `data`
  - **20 October, UI-only slice done:** rows no longer carry "Available locally" (health or journal-updated tags remain); titles drop continuation boilerplate and bare links for display; an "Active now" line above the library lists sessions whose journals are being followed with recent events (labelled so, since Drishya cannot tell whether the agent is alive). **Open:** harness-reported duration, files, `+/-` lines and last outcome (needs DATA-2), `custom-title` > `ai-title` preference (adapter side), moving Star on GitHub is already done (UI-3). Item stays unchecked.
  - **Do:**
    - Per row, harness-reported stats where recorded: duration · files changed · `+lines −lines` (Claude `cost-state`) · last outcome · live dot.
    - Remove the blue "Available locally" from every row (show only exceptions such as "missing journal").
    - Titles: prefer `custom-title` > `ai-title` > cleaned first prompt (strip "This session is being continued…" boilerplate and bare URLs).
    - Add a "Running now" strip across repositories at the top when any session is live.
    - Move "Star on GitHub" out of the primary header (UI-3).
  - **Accept:** 300+ session inventory stays virtual and fast.

### REVIEW — Review work, search and packets

- [ ] **REVIEW-1 · Review work as Changes** · P1 · `review`
  - **Do:** make it reachable from the top bar as **Changes**, not only from the ⋯ menu. Group repeated capture gaps ("9 compactions" with a disclosure). Show `+N −M` per file and the turn that last changed each file. Recognize tests via DATA-1.
  - **20 October progress:** Modern header has a **Changes** button (the dialog is still titled "Review work"); each changed file shows captured `+N −M` and the prompt turn of its last captured edit (0 when a patch was not captured); repeated capture gaps collapse to one line with a count (real session: "compaction × 9"). **Open:** test recognition (DATA-1) and renaming the dialog/menu entry, which 33 specs reference.

- [x] **REVIEW-2 · Search result context** · P1 · `review` — each hit shows session · turn · tool · file · time; the jump keeps the hit highlighted; results are grouped by turn.
  - **20 October, done:** in-recording search returns each hit with its turn (turn.start count for that agent), kind (prompt, reply, reasoning, call, result), tool, path or command and time, in capture order; the panel groups by turn with a quiet header and a one-line context under each snippet; the operation a result jumped to keeps a thin marker. Not done: grouping across several sessions; Codex wrapper tools still show as `exec` until DATA-1 types them.
- [ ] **TESTS-1 · Tests view: every run, every failing case** · P3 · `review` `read` — **Deferred 20 Oct (Yash: nobody is likely to open it first; decide later whether it is effective).** Data layer and dialog are parked, unpushed, on local branch `yash/tests-1-parked`. Yash, 20 Oct: the failure notch on the prompt rail is the wrong place and one or the last test is not enough; a run has n cases and a session has many runs. **Do:** a Tests view (Review tools menu) from the whole recording: failing cases now first (name, file:line, message, failed in k of n runs), cleared cases collapsed (cleared only with evidence: a later run of the same command with no failures, or the case listed passing), then every run in order with counts. Remove the rail failure notch. **Accept:** 1, 12 and 300 failing cases and 1 and 100 runs read calmly; every row opens its captured run; no fixed claim without evidence.

- [x] **REVIEW-3 · Bookmarks and indicators audit** · P2 · `review` — audit existing bookmarks/saved moments and commit/PR/capture-gap indicators; surface only evidence-backed, useful actions; no empty panels for feature count.
  - **19 October progress (107):** Explicit50-reference Saved moments and redacted local notes; old daemon notes use25-row pages with qualified legacy timeline positions. Both isolated redacted histories exercised saving. Gaps stay distinct from current Git/PR; no resident panel or fabricated attribution.

- [ ] **REVIEW-4 · Joined investigation** · P2 · `review` `native` — recorded failure/change → exact captured source → current file/draft → anchored question/correction → explicit native submission → actual resulting diff/check → return to the original evidence.
  - **19 October progress (107):** Retain exact origin through source/draft/question preparation and explicit controller receipt, then chronological captured follow-up and return. Fixed observation/timeline coordinates; newly appended synthetic check reachable. Genuine edit/diff/conflict acceptance remains NATIVE-4 and builder-owned.

- [x] **REVIEW-5 · Packet usefulness** · P2 · `review` — deliberate evidence selection and useful portable references; no auto-sharing; no private current-work inclusion.
  - **19 October progress (107):** Choose samples, open questions and up to20 saved actions; re-read evidence with four requests maximum in flight, qualify unavailable references and export portable recording/operation/observation IDs. Both isolated Codex/Claude histories exercised packets. No current Git/disk/drafts or automatic sharing.

### MAP — repository map

- [ ] **MAP-1 · Purpose (deferred)** · P3 · `map` — keep the 3D map as an aesthetic, optional surface (builder decision, 19 Oct). Ideas for later, not commitments:
  - a flat "change atlas" treemap painted by session activity;
  - a blast-radius ring of importers around edited files;
  - "where is it working now" heat.

  Revisit after FILES-1 shows how much the decorated tree already covers.

### NATIVE — native controller acceptance

- [ ] **NATIVE-1 · Real signed-in Codex journey** · P2 — text/files/folders/image/pasted screenshot, model/effort/supported permissions, exact approval, edit/create result, stop, reconnect and competing-client acknowledgement.
- [ ] **NATIVE-2 · Real signed-in Claude Code journey** · P2 — the same, plus confirming that observed reads/edits/creations/MCP/output/exposed reasoning appear faithfully.
- [ ] **NATIVE-3 · Genuine multi-agent sessions** · P2 — identities, parent/child menus, concurrency, windows, origins, overlaps, tools/MCP/files, reading, and live/replay independence.
- [ ] **NATIVE-4 · Joined native edit/create conflict path** · P2 — validate end to end with the subsequent recorded checks; a prepared attachment/hash instruction is not an atomic write transaction.

### PERF and REL — scale, platform and release

- [ ] **PERF-1 · Very large journals** · P1 · `perf` — import and tail the local 564 MB, 232 MB and 166 MB Codex rollouts. Measure time, peak RSS and UI responsiveness; reading is already chunked (`capture-core/jsonl.ts`). Record the results in IMPLEMENTATION_ROADMAP §7.
- [ ] **REL-1 · Managed-runtime update vs antivirus** · P2 — verify that a supported idle-time update resolves the recurring AV conflict; never interrupt active work or change antivirus protection (review 38).
- [ ] **REL-2 · Physical platform acceptance** · P2 — lower-resource and lower-core machines; Windows, macOS and Linux; memory, large-repo and long-session performance; real phones and input devices; GPU fallback.
  - **19 October progress (107):** Windows reference-machine synthetic/resource/package checks in107. Emulated low-resource/4x CPU does not certify physical low-RAM/lower-core or other platforms.
- [ ] **REL-3 · Human acceptance** · P2 — keyboard, browser zoom, assistive technology; human freeze/truth/ten-minute reading; preference and adoption.
  - **19 October progress (107):** Local keyboard/focus/forced-color/reduced-motion and synthetic ten-minute reading checks added. Human comprehension, screen reader, touch and zoom remain open.
- [ ] **REL-4 · Publishing preparation (on request only)** · P2 — final full local checks, selected manual GitHub CI, packaging/install/setup guidance and release checks. No automatic hosted CI for ordinary commits or PRs.

- [x] **TEST-1 · Browser specs failing or flaky on `main`** · P1 · `rel` — **fixed 20 Oct (full suite: 212 passed, 21 failed → the 21 are fixed; the product-workspace flakes did not recur).** Causes: the idle composer now rests as a pill (specs call `openComposer`), the modern header lost its title and the composer its id code, Git review and source reader resize from window edges, the right-hand navigation group moves at ≤ 1100 px. Phone-width reader density is READ-9. Original notes: found 19 Oct while verifying LIVE-2 and LIVE-1; each reproduces on the code from before PR #124, so none is from recent work. `DRISHYA_BROWSER_CHANNEL=msedge npx playwright test <file>:<line>`:
  - `connected-workspace.spec.ts:79` **modern** variant ("current source reading finds, navigates and wraps…") — times out waiting on a Read-current-file button in the dialog; classic variant passes.
  - `connected-workspace.spec.ts:129` ("source reading links qualified current imports…") — times out waiting for `Read current file src/actual.ts` inside the `src/other.ts` dialog.
  - `product-workspace.spec.ts:158` ("first-visit evidence review…") — Playwright strict-mode violation: the Review dialog's `src/checkout/guard.ts` button matches two elements.
  - `product-workspace.spec.ts:65` ("map file labels are keyboard reading targets…") — flaky, about 50%: the "Work on …" dialog sometimes isn't visible after Enter on a map label.
  - ~~`live-sync.spec.ts:8`~~ — fixed by PR #128 (its journey was rewritten and passes).
  - `prompt-timeline.spec.ts:22` ("bottom-anchored prompt timeline scrolls independently…") — fails every time (`toHaveAttribute`) on main and before PR #124.
  - `product-workspace.spec.ts:772` ("paged prompt rail spans the full session…") — rare flake under load (failed twice in about 16 runs while the whole suite ran; 20 of 20 passes when run alone): `.turn` first does not contain `Rail prompt 0`.
  - Also failing on clean main (19 Oct, Harsh with Claude, while verifying `codex/investigation-finishing`): `fresh-workspace.spec.ts` composer target (:129, `.modern-composer-location`), chrome fit (:287, `.modern-session-header h1`), Git review (:593, resize handle), edge actions (:1190, since PR124 the rightmost navigation action no longer reaches the right edge); `session-segments.spec.ts:31`.
  - Fail on main `b66f160` since PR125 (idle composer collapses by default), passing before it: `fresh-workspace.spec.ts` :16, :313, :331, :397, :657 (both harnesses), :792, :1135, :1344, :1723, :1791, :1809, :1828. Most expect the composer expanded or a prompt control visible.
  - Flaky: `workspace-toolbar.spec.ts:88` (exposed-gutter scroll) passes and fails across runs of `codex/investigation-finishing`.
  - **Do:** decide per spec whether the product or the test is wrong, fix, and re-run each 10× for flakiness. **Accept:** all four pass 10 of 10 on a clean build.
  - **20 October, later:** the two `classic-refinement` explorer specs that had been red since FILES-1 (#139) now clear the demo's captured paths from their synthetic trees (#164); #162 restored hover reading from file-title buttons after FILES-2 and updated one stale head click; the rail specs expect uniform ticks. **Still load-flaky when a whole file runs, passing alone:** `product-workspace` (paged prompt rail, studio hover reading) and `fresh-workspace` Home. Not yet diagnosed.

---

## 4. Completed before the 19 October restructure (verbatim archive)

These were checked in the previous list. Their open follow-ups are now IDs above.

- [x] **Right-docked Explorer preview (builder screenshot):** default width28vw bounded360–720px, right edge48px from screen, below navigation and above composer; saved custom layouts retained and Reset applies the default. Desktop fine-pointer passage contents compact to90% only while preview is open; scrolling/virtual slots remain in screen coordinates. Move icon removed; title/tab-bar drag, keyboard title movement, four-edge resize and reset retained. Five focused browser journeys,543units/99files and actual three-session preview/scroll/phone journey checked. Review121; human visual preference and physical/platform acceptance remain open.
- [x] **Shared captured-result view choices:** one bounded text-content selector and one control group across native/MCP/structured/Inspector outputs. Plain shell JSON now has the same data view; folded/error excerpts inspect the whole supplied preview, without duplicate controls. Open JSON/CSV/resource readers retain their explicit snapshot across output props changing.542units/98files, ten focused browser journeys and actual three-session regression checked. Review120; binary/artifact transport and broader selector acceptance remain below.
- [x] **Captured resource references:** on-demand structured MCP/native resource links and embedded text, explicit current HTTP(S) URL opening, Markdown/source and JSON/CSV handoff, bounded mixed content and nested-dialog Escape/focus ownership. No automatic remote loads or local-path resolution. Seven structured/resource browser journeys and actual three-session regression pass; image/PDF bytes and general selector remain separate. Review119.
- [x] **Explorer preview overlap correction (builder screenshot):** old saved modal geometry is clamped into the adjacent right reading lane, below navigation and above the logical composer bounds; the independent prompt rail moves to the free right edge. All four resize edges and movement obey the same bounds. Desktop/laptop/phone, reload, prompt collapse/expand, and actual long Blueprint/Codex/Claude previews checked. Full Workspace hides right navigation and starts alongside Files rather than below the Git stack. Review118. Resource-reference continuation is recorded below; physical browser-zoom/device acceptance remains open.
- [x] **Right navigation and compact file-peek presentation (builder correction):** Workspace below Git review/Git graph; measure the portal reader top from those controls, avoid Toolbox/full-Workspace conflicts, and remove oversized duplicate reader toolbar rows while keeping source truth and useful actions.
- [x] **Last-action/prompt gap (builder correction):** keep one measured composer clearance in full-height history end padding, reduce the extra70px to8px and the final passage margin; expanded/minimized prompt, real long sessions and phone verified.
- [x] **Pause the session-name capsule (builder correction):** remove the Modern central header capsule for now, retaining Home/search/settings/session-menu controls and reconnect status; let the builder compare the extra visual space.
- [x] **Tabbed file peek beside the agent (builder addition):** single-click replaces a preview, double-click keeps a tab; closing/switching/restoring tabs retains references/geometry and reading metadata within the existing eight-visit trail, without storing source bodies. Keep the agent visualization visible in a measured adjacent area rather than entering full Workspace, with bounded phone fallback and clear Workspace handoff. Drag the non-interactive title/tab-bar area, not only a move button. Resize from all four edges with the grabbed/opposite edges behaving correctly, persisted/clamped geometry, keyboard equivalents and reset. Preserve captured/current evidence and workspace consent; Real Drishya/Skeletongraph Codex/Claude, reload/fresh consent, desktop/phone overflow, rapid actions and all edge directions verified. See review116 for exact bounds.
- [x] **Simplify Workspace controls (builder addition):** frequent New/edit/compare/harness-review controls remain visible; layout/reset and file navigation/download/discard move into compact owner-scoped Actions menus. Outside click, Escape/focus return, keyboard rows, bounded short-phone menus and a two-row phone header checked. Editing/drafts, source truth and split-pane use retained. Actual Codex/Claude multi-file journeys pass. This is the first bounded simplification; broad nested-control/UI acceptance remains in the motion pass below.
- [x] **Prompt and Toolbox toggles:** one200ms transform from the actual measured surface; translation/scale move together, interrupted reversal uses current bounds, compact labels keep their size. No animated layout height, typing/capture listeners or duplicate content. Keyboard/reduced-motion/low-resource bypass; resize/session changes cancel. Composer clearance uses logical border-box height. Fixed inherited phone dock stacking that covered Minimize. Desktop/phone and actual three-session checks pass.
- [x] **Ambiguous Workspace tabs:** duplicate basenames show only the shortest distinguishing parent folder; unique filenames remain compact. Exact paths remain the selection/recovery identity. Pure tests and actual Claude duplicate-README journey checked.
- [x] **Reading-window and folder-state motion:** Modern shared modal readers/settings have a140ms pointer exit from the actual in-flight entrance geometry; keyboard/reduced-motion/low-resource and modeless/frequent navigation stay immediate. Cancellation and focus restoration retained. Files disclosure rotates continuously without animating virtual row layout; keyboard folder movement stays instant. Browser reversal/close/focus/settings/reduced-motion/folder-state checks pass. This is one bounded part of the whole-product pass above, not completion of prompt/view/menu motion.
- [x] **Explicit captured CSV/TSV inspection:** on-demand delimiter choice, virtual grid, optional first-record names, all-record search, original record positions, keyboard cell navigation and exact selected-cell/original copy. Preserve quoted multiline cells, duplicate names, empty versus absent cells and literal formulas. Plain/native/MCP recognized text fields share the reader; unknown siblings remain in the original result. Limits:256 KiB,5000 records,32columns,50000cells,8candidate text fields. Malformed/oversized inputs keep original text without a partial grid. Supplied captured text may itself be incomplete. Desktop/phone and actual history/editor regression checked; full-artifact, document/media and general selector work remain open. Review117.
- [x] **Structured JSON inspection:** on-demand tree/table/original reader for complete valid captured preview JSON within256 KiB/fewer than25000 values/80 levels. Virtual scrolling retains all supported rows/fields; wider-than32-field tables use the complete tree. Search, literal selection/copy, exact original access and keyboard navigation; no remote loading. Invalid/truncated/oversized tree data keeps raw access. Browser1200-row/late-field/320px and real-session regression checks pass. Full-artifact recovery, CSV/document/media transport remain separate.
- [x] **Exact small history windows:** a one-passage selection must contain the requested operation instead of the preceding passage; preserve bounded paging and historical step. Found during real-session test-bar validation.
- [x] **Prompt identity layout correction:** symbol and workspace name must share a single horizontal line with a small gap at320/390/desktop widths; truncate long names, never stack them. Git graph work is deferred at the builder’s request.
- [x] **Loki reference material / composer correction:** replace the rejected individual-thread treatment with one flowing luminous spectral ribbon, broader curves and softly layered material; retain actual forks, consistent thickness and depth. Prompt identity should show the original symbol plus workspace name only, no Codex/Claude label.
- [x] **Spatial Git ribbon correction:** branches peel from the main ribbon’s outer rim at their actual fork/merge positions. Replace flat translated lines with sampled3D fiber geometry, depth ordering, nearly uniform32px volumetric bundle diameter (no zero-width/DNA pinches) and restrained spectral shading; preserve truthful topology and bounded work. Search further original visual references and document PR110 selective integration clearly.
- [x] **Compact test-case bars:** small semantic pass/fail/skip bars in tool cards, hover/focus detail and selection to assertion output. Individual names/indices/order only when captured; runner-summary totals remain explicitly grouped. Preserve complete output and accessible counts; verify actual Codex/Claude/wrapped/mixed-runner and missing/truncated cases, not only the demo.
- [x] **Git thread graph:** continuous scrollable history without commit-range pagination; one32px spectral fiber main strand with thinner shared-palette fork/merge strands (branch width proportional to observed commit counts, capped at half main), then graph-first horizontal parent topology with actual fork/merge threads, hover/focus commit details, selection → changed files/patches, pan/zoom/fit and bounded responsive reading. Direct right-side Git graph entry; preserve exact local refs/paging/shallow truth, no decorative invented branches.
- [x] **Compact composer identity:** original symbol and workspace basename share one horizontal line with9px spacing and long-name ellipsis, including320/390px. No harness name, Continue with or recording suffix in the primary row; native identity stays in connection details. Supersedes the earlier stacked identity implementation.
- [x] **Tool status marks:** shared unknown-result presentation uses a neutral dash and accessible explanation. Edit/creation requests decoded from exec wrappers say Change unverified; other missing results say Result not captured. Confirmed success/error/running remain distinct; projection status is unchanged. Units and shared DOM checks cover editing/creation; native-account acceptance remains separate.
- [x] **Local Git branch atlas:** searchable local/remote-tracking branches and tags,50-commit/100-ref pages of actual parent topology, complete bounded commit messages and protected/redacted commit patches with merge-parent choice. Root/merge/shallow/detached/empty states checked; shallow missing parents stay unavailable, never root diffs. On-demand Git review/Ctrl+K entry, existing consent, no network fetch or writes, adjustable readers and320/390px use. Both TS/build,488-unit suite, final shallow regression and two focused browser journeys pass; three actual Codex/Claude histories checked and desktop/phone frames inspected. Refs are local, including already-fetched remote-tracking refs; this is not all remote or unreachable Git objects.
- [x] **Adaptive visual-content audit:** inspected actual Codex/Claude call inventories, text/media capture seams and existing specialized readers; recorded a content-first presentation matrix and privacy/acceptance boundaries in [audit111](review/111-adaptive-content-and-pr110.md). This completes the investigation, not the views below.
- [x] **Review Harsh PR110:** left open/unmerged because review/source workflows overlap current owners and its source-version exports conflict. Distinct candidates retained below; branch tests do not certify merged behavior. [Disposition](review/111-adaptive-content-and-pr110.md#pr110-disposition).
- [x] **Selective PR110 value:** integrated captured-range-to-approved-current-disk comparison using the current reader/version owner, exact positions, stale-request guards, consent and a moved-code disclaimer. Ported narrow full-map-approval → Files navigation/fit repair plus up to40 explicit importer→dependency arrows and focused regression journeys. Retained newer palette, label/occlusion and review/editor owners. Comparison helper and desktop/phone UI checks pass; no direct writes or schema change.
- [x] **18 October builder addition — user-adjustable work surfaces:** Git/current/captured file windows have desktop movement, width/height resizing and reset, with keyboard equivalents and bounded session geometry recovery. Smaller viewports ignore saved desktop geometry and use normal readers. Files/action detail retain docked full-height roles, width/collapse controls and resize-edge reset (double-click/Enter). Workspace retains an IDE layout, resizable/balanceable split panes, reorderable tabs (drag or Alt+Shift+Arrow) and reset without closing files or discarding drafts. Only numeric geometry/tab references persist. Local geometry/privacy, reload/shrink/phone/reset/pane/tab tests and actual Codex/Claude reading checked; broad device/assistive-tech acceptance remains below.
- [x] Independent-review repair: persist exact file-evidence keys only, re-fetch references before rendering and handle legacy/missing selections without crashing. A failed screen resets on session navigation. Unit/persistence, reload/unavailable and injected-reader-failure browser checks plus the originally failing actual Claude session pass.
- [x] Independent-review repair: unreported process exits stay null; neutral Tool returned distinguishes wrapper receipts from command success in history/Inspector/Commands/Canvas. Quote-aware test classification rejects runner names in patterns/scripts; direct Node runner paths are recognized. Actual false-Test and nested Git-failure examples rechecked. No regex-based failure inference.
- [x] Findings: category selection plus every exact matching operation through25-row worker-backed pages and title/path/command-preview filtering. Complete-input identity matches summary grouping; gap detail links only to next captured activity.70-member/API bounds/desktop-phone and actual271-unknown membership/navigation checked. Search is explicitly preview-scoped.
- [x] Command scanning: complete single literal execution requests show the decoded command in Modern headings/material, with exact raw request/copy access. Whole-wrapper validation retains multi-call, dynamic, truncated or trailing source intact; no execution or nested-outcome inference. Local parser/type/build and browser copy/highlight checks pass. Unsupported orchestration remains source.
- [x] Navigation handovers: Repository and latest-activity destinations leave Workspace/readers instead of opening behind them; Files clears competing readers and focuses the explorer. Compact help distinguishes current files, local drafts, import relationships and captured evidence. Joined native investigation still remains separate below.
- [x] Returning-user Home: compact sessions-first heading/resume, retained optional introduction and compact phone workspace chooser. Outside click/Escape/focus return, deep virtual workspace selection and responsive session reading checked; desktop navigation remains available. No demo or extra resident panel added.
- [x] Reading consistency: Files Markdown shares readable Document/Source, separate mode scroll/query recovery, safe256KiB/5000-line document limit with complete Source fallback, and unchanged raw copy. CodeMirror line-height/type matches desktop source reading; coarse input stays16px. Local6000-line/reload/editor and actual Codex/Claude reader-to-Workspace checked.
- [x] Reader recovery/navigation: restored current files wait for fresh consent and offer it directly; approval supersedes stale status polls. Normalize legacy overlapping reader owners. Inspector clears measured Workspace controls, hides while Workspace is active and retains the original action for return.
- [x] Auto-hide native scrollbars after inactivity, restoring them on scroll/nearby pointer use without changing layout or the independent prompt timeline. Keep resizing functional with a cursor-only edge rather than a visible Explorer/reader resize bar; retain keyboard resizing and forced-colors focus visibility.
- [x] Repair live session freshness: live observation/history is the default, independent of Follow. Incoming content must update while reading older work, with Follow controlling only the viewport; replay is explicitly selected. Both journal formats update with Follow off; visibility/reconnection rechecks revisions. Real-account/platform acceptance remains below.
- [x] Implement connected native requests for user input: visible pending question/options, supported reply delivery, cancellation/reconnect and exact request identity. Never replace an answer with a guessed prompt or silently bypass native approvals; unsupported reply protocols have an explicit error. Local protocol/controller/HTTP and phone fixtures checked; signed-in native-account acceptance remains below.
- [x] Restore the previous tool boxes after rejecting PR88: original input/output allocation, hover limits, separator and spacing. Keep independent Follow/prose fixes. PR92.
- [x] Consolidate the scattered active queues into this checklist; link it from the repo instructions and docs entry points.
- [x] Make existing Workspace editing easier to find: leading Edit file action with mode icon/context, active-pane editor focus on entry/return from comparison, neutral editor focus. Existing-file/New file, two-pane/narrow and three actual-session checks pass. Native disk application remains a separate unchecked acceptance task below.
- [x] Compact **Review work** pagination: short labeled arrows, separate page count and limits note; no tall wrapped buttons. All70 recorded checks remain reachable;320/390/1440px and actual desktop/phone survey pass. Outcome groups stay top-aligned instead of stretching across the file list.
- [x] Compact the current-file reader: history/actions share a row, labeled Workspace/refresh/evidence access, shorter Find/Go/Wrap controls, optional empty import context and compact footer. Remove the old 48vh source cap so content fills its reader. Legacy/Modern reading and actual desktop/phone navigation checked; whole-file controls remain available.
- [x] Replace the draft textarea with a lazy-loaded CodeMirror editor: line numbers, theme syntax (JS/TS/JSX/TSX/Python/JSON/Markdown; plain text fallback), inferred indentation, undo/redo, bracket matching, wrap and cursor/line-ending status. Retain selection/undo while comparing, preserve CRLF/mixed text and reject over-limit changes without losing work. Four focused journeys and three actual-session edit-entry journeys pass. Still a local draft editor, not a language-server IDE or direct disk writer.
- [x] Retain an older current-source version when disk changes; provide explicit keep/refresh/compare against the newly read version and disclose stale bases before native edit handoff.
- [x] Preserve a bounded metadata-only return to the originating reader/Workspace after preparing a native request; utilities offer chronological captured activity after a completed turn. No inferred attribution or persisted source/draft bodies.
- [x] Modern is the new-browser default; saved/explicit Legacy and Canvas choices remain usable. Agent visualization shares the Legacy foundation.
- [x] Seven selectable palette slots and semantic syntax tokens; the six Modern alternatives were subsequently replaced below. Legacy keeps its separate palette names. Local solid text-token contrast guard; softer Paper. Reviews86/101.
- [x] Settings categories, native-picker fallback, responsive keyboard orientation, section offset reset and touch input sizing. Review100.
- [x] Measured adjustable Files and Git reading spaces; retained preferences and narrow Files navigation. Reviews96/98/99.
- [x] Composer target/recording/state are visible; compact phone controls clear Send; attachments, native settings and minimized Stop use existing owners. Review102.
- [x] Prose background no longer adds horizontal overflow. Follow accounts for late composer clearance. Reviews103/105.
- [x] Home navigation polish: retain selected workspace when filters have no matches; clear-search/Escape and clear-filters actions, refresh feedback, Arrow/Page/Home/End access to all virtual rows, grouped utilities with visible-row keyboard navigation. Desktop/phone and actual-session surface checks; broader Home/visual acceptance remains below.
- [x] Review **Home** within local desktop/phone bounds: compact/expanded intro, workspace/session inventory, filter/dropdown dismissal, long titles, search, keyboard/empty/discovery-failure states and responsive virtual rows.160-session synthetic and actual612-session/323-workspace inventory checked at desktop/phone/short sizes; full palette/device/assistive-tech acceptance remains below.
- [x] Rebuild the six Modern alternatives: Deep Ocean, Porcelain, Orchid, Blueprint, Evergreen and Copper. Preserve Jet Black and stored IDs; complete semantic/status/graph/syntax tokens, selections and accurate swatches. Local text/status contrast guard, Home/session journey and actual desktop/phone Settings/material survey pass. Legacy palettes stay separate.
- [x] Repeat independent critical developer/product/design review: three memory-free reviewers used actual redacted Codex/Claude histories and rated adoption, utility, UI and workflows. They prefer a review companion today, not a sole IDE/native replacement. Review-time design polish6.3/10, utility6/10; one reviewer replacement2/10 vs companion7/10. Critical crash/outcome/map-overlap findings repaired; selected remaining improvements are priorities above. Signed-in native, ten-minute/physical/all-theme acceptance were not tested.
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
- [x] Keep repository file-search controls above spatial labels at all densities; real-session obstruction reproduced and deterministic overlapping-label click regression checked.
- [x] Bounded map investigation: Review work change path → typed direct imports/importers → captured work or explicitly approved current-file reading; All/Observed/Changes scopes, retained choice and an honest unavailable-index fallback. Desktop/phone controls use measured navigation clearance. Local regression and actual Codex/Claude indexed/unavailable paths checked; broader large-repo usefulness and adoption remain part of the critical review.
- [x] Optional **Captured commands** inside Review/Ctrl+K: whole-session worker query, 25-row stable cursor pages, preview/tool/outcome filtering, exact bounded command copy, complete long-input artifact reading and exact captured-activity return. No resident panel or runner. Local worker/API/cursor/browser checks and three actual Codex/Claude histories at desktop/phone pass. Preview search is labelled; it does not scan unseen full-input blobs.
- [x] On-demand **Review findings**: proven exact command repetitions (complete artifact identity for clipped inputs), unknown outcomes, unavailable change material and captured gaps. Exact first/latest references; polling-only wrappers excluded after actual-session review. No risk/stuck score or inferred cause. Broader semantic tripwire detectors are not implemented.
- [x] On-demand **Prompt overview** in Review/Ctrl+K: all captured prompts via20-row whole-session pages, exact navigation and counts of operations started between prompt observations. Latest outcomes are labelled; temporal windows do not imply attribution.
- [x] **Review packet** preview/copy/Markdown download: complete counts with explicitly bounded samples of captured change paths/checks/failures/gaps/findings/prompts, exact references and open local reviewer questions. Export redacts again; current Git/disk/drafts remain excluded. No automated sharing. Whole evidence export stays separate.
- [x] Native Codex/Claude controller contracts, permission/consent boundary, attachments/options/approval/stop lifecycle and early genuine thinking-state handling have local automated coverage. Native settings are supported values, not fabricated synchronization.
- [x] CLI discovery/setup errors and explicit newer-session journal navigation are implemented; passive capture remains independent. Newer work lookup does not silently stitch sessions.
- [x] Reproduced black-screen/render-loop and delayed upward-scroll anchor issues have bounded fixes/regressions; actual long histories from both harnesses exercised. Broad platform acceptance remains open.
- [x] Functional baseline: typechecks/build and456 unit tests pass after PR99. Broad browser run:174 passed/6 skipped/4 failed; all four repaired cases pass together on targeted rerun. Review103 records this honestly; no second full-green-run claim.
- [x] McAfee recurrence investigated: fresh trace attributes the matching script wrapper to the signed managed Codex updater, not Drishya/pnpm. Blocked payload is unavailable; no certified false-positive/safety claim or antivirus bypass. Review38.
