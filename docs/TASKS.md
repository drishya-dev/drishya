# Product checklist

**The single current work list. Restructured 19 October 2026.** Builders and agents update this file in the same increment as the work: tick an item only when its stated scope is implemented and checked on actual sessions; add new feedback here before starting it. STATUS is the session log, CONTINUITY is the handoff, numbered reviews are evidence. They are not competing task lists.

**Claiming.** Before starting an item, claim its ID in the [STATUS](STATUS.md#claimed) table and push that to `main`; `node scripts/claims.ts` shows what is open and what is taken.

**How to read it.** §1 is the **priority order**: one line per item with its ID and tags. §3 holds the **detail** for every ID, grouped by category: problem, what to do, acceptance, where in the code. §4 archives every item completed before this restructure, verbatim.

`[x]` = implemented and locally checked within the stated limits. `[ ]` = unfinished. A checked item does not certify native accounts, every device, visual preference or release readiness.

Evidence for this restructure: [122 developer review](review/122-developer-product-review.md) (with builder corrections), [123 harness data audit](review/123-harness-data-audit.md), [124 Sacred Timeline spec](review/124-sacred-timeline-git-graph.md), [HACKATHON](HACKATHON.md).

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
7. **Choosing a model.**
   - Opus for design specs, ambiguous UI direction and reviews.
   - Sonnet is suitable for executing items here that have explicit **Accept** lines.
   - Either model must verify in the browser on actual sessions before ticking.

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
- `hack` Nebius hackathon

**Priority:**
- **P0:** now, before 30 Oct (the hackathon deadline).
- **P1:** next.
- **P2:** later.
- **P3:** deferred ideas.

---

## 1. Priority order

If the hackathon is not entered (HACK-1), drop the `hack`-only items and move EXPLAIN-1/2 to P1. Everything else keeps its order.

### P0 — now

| # | ID | Item | Tags |
|---|---|---|---|
| 1 | BUG-1 | Wheel scroll trapped over history cards | `bug` `read` |
| 2 | BUG-2 | Git review drawer covers the Git graph button; Escape inconsistent | `bug` `git` `ui` |
| 3 | BUG-3 | Markdown link with bold label and Windows path renders raw | `bug` `read` |
| 4 | BUG-4 | Header islands overlap content at ≤ 900 px width | `bug` `ui` |
| 4a | BUG-7 | Seven browser journeys fail on main | `bug` |
| 5 | HACK-1 | Decide entry; make repo public; confirm track | `hack` |
| 6 | EXPLAIN-4 | Validate Nemotron on Token Factory with a real key and real model ids | `explain` `hack` |
| 7 | DATA-10 | Propose one batched event-schema addition to both builders | `data` |
| 8 | DATA-1 | Codex: consume typed `item_completed` items (commands, file changes, MCP, images, web, sub-agents) | `data` `content` |
| 9 | DATA-2 | Usage: Codex `token_count` and Claude `message.usage`/`cost-state` | `data` `live` |
| 10 | LIVE-1 | "Now" line plus tab title/favicon state | `live` |
| 11 | TURN-1 | Turn chapters with a resolved turn ledger; collapsible finished turns | `turn` `motion` |
| 12 | EXPLAIN-1 | Narrator: generated intent labels for bursts of work, cited to evidence | `explain` `hack` `live` |
| 13 | EXPLAIN-2 | Turn summary and "while you were away" briefing | `explain` `hack` `turn` |
| 14 | READ-1 | Edit/write cards: wide, no-wrap, `+N −M`, real line numbers | `read` |
| 15 | READ-2 | Quiet provenance: one ⓘ per card, inline badge only when meaning changes | `read` `ui` |
| 16 | LIVE-2 | Composer collapses to a pill when idle (done; leftovers in LIVE-2b) | `live` `ui` `motion` |
| 17 | HACK-2 | Hosted demo build with a recorded, labelled Nemotron layer | `hack` |
| 18 | HACK-3 | Demo video < 3 min, README setup, submission text, Token Factory feedback | `hack` |

### P1 — next

| # | ID | Item | Tags |
|---|---|---|---|
| 19 | CONTENT-3 | Agent questions and approvals as first-class interactive cards | `content` `live` |
| 20 | CONTENT-4 | Plans and todos as a living checklist (TodoWrite, TaskCreate/Update, ExitPlanMode, Codex plan) | `content` `turn` |
| 21 | CONTENT-1 | Images the agent viewed, produced or received (finish) | `content` `data` |
| 22 | CONTENT-2 | Browser and web evidence views (finish) | `content` `data` |
| 23 | CONTENT-5 | Sub-agents with real names, model, effort and lineage | `content` `data` |
| 24 | CONTENT-9 | Honest "reasoning not recorded" state | `content` `read` |
| 25 | FILES-1 | Evidence-decorated file tree (edited/created/read/now) | `files` `live` |
| 26 | TURN-2 | Keyboard reading model plus `?` cheat sheet | `turn` |
| 27 | TURN-3 | Prompt rail encodes turn size and failures | `turn` `ui` |
| 28 | UI-1 | Chrome consolidation: session identity, fewer floating islands, clear navigation | `ui` |
| 29 | UI-2 | Typography floor (11 px meta, 12–13 px controls) and secondary-text contrast | `ui` |
| 30 | MOTION-1 | Interaction-motion pass over every control and nested state | `motion` |
| 31 | UI-3 | Uiverse / component-library pass, starting with the Star on GitHub shimmer button | `ui` `motion` |
| 32 | UI-5 | Button density and navigation in Workspace, Git and readers | `ui` `files` |
| 33 | GIT-1 | Sacred Timeline Git graph (fiber light, branches peel and merge, starfield) | `git` `motion` |
| 34 | GIT-3 | Compact commit rows synced with the timeline; ref filter | `git` |
| 35 | READ-4 | Passage layout refinement (keep wrap plus arrows) | `read` `motion` |
| 36 | LIVE-3 | Opt-in notifications: turn finished, approval needed | `live` |
| 37 | HOME-1 | Home rows with harness-reported stats; "running now"; quieter rows | `home` `data` |
| 38 | DATA-3 | Codex session/turn metadata: agent names, lineage, policies, durations | `data` |
| 39 | DATA-4 | Claude extras: AskUserQuestion, TaskCreate/Update, plan mode, isImage, spilled output | `data` `content` |
| 40 | DATA-5 | Claude checkpoints (`file-history-snapshot`) for "before this turn" | `data` `read` |
| 41 | DATA-6 | "Changed outside the agent" marks (`edited_text_file`) | `data` `read` |
| 42 | FILES-2 | Every path in the stream opens in peek | `files` `read` |
| 43 | TURN-4 | Replay transport in Modern (play, pause, speed, next edit/failure) | `turn` `motion` |
| 44 | REVIEW-1 | Review work as a first-class Changes view; group repeated gaps | `review` |
| 45 | REVIEW-2 | Search results with session/turn/tool/time context | `review` |
| 46 | PERF-1 | Import/tail benchmark on 160–564 MB Codex journals | `perf` |
| 46a | TEST-1 | Four browser specs fail or flake on main (found 19 Oct) | `rel` |

### P2 — later

| # | ID | Item | Tags |
|---|---|---|---|
| 47 | READ-5 | Session diff with blame-by-turn (evidence-backed line attribution) | `read` `git` |
| 48 | READ-6 | Read-before-write signal | `read` |
| 49 | READ-7 | Failure → fix chains (same command identity) | `read` `turn` |
| 50 | READ-8 | Promote the per-file timeline | `read` `files` |
| 51 | GIT-2 | Session ↔ commit links | `git` `turn` |
| 52 | GIT-4 | Hunk-level "Recorded work" from Git review | `git` `read` |
| 53 | EXPLAIN-3 | "Explain this hunk", validated live with citations | `explain` |
| 54 | EXPLAIN-5 | Visual language for derived content | `explain` `ui` |
| 55 | READ-3 | Settle older cards into compact ledger rows (prototype first) | `read` `motion` |
| 56 | MOTION-2 | Lift arrivals from the file-tree row | `motion` `files` |
| 57 | MOTION-3 | Live/replay motion evaluation (ten-minute calm) | `motion` |
| 58 | UI-4 | CSS consolidation: one token sheet; freeze Legacy; retire Canvas | `ui` `perf` |
| 59 | UI-6 | Phone density and occlusion | `ui` |
| 60 | UI-7 | Every palette across every surface | `ui` |
| 60a | UI-8 | Whole-product UI pass (header, composer, all action types) | `ui` |
| 61 | CONTENT-6 | Shared adaptive content selector | `content` |
| 62 | CONTENT-7 | Structured data and document views (finish) | `content` |
| 63 | CONTENT-8 | Cross-tool visual parity on actual sessions | `content` |
| 64 | DATA-7 | Codex `plan_update` / `turn_diff` verification | `data` |
| 65 | DATA-8 | Reasoning-persistence settings: verify and document | `data` |
| 66 | DATA-9 | Optional hook/OTel enrichment research | `data` |
| 67 | LIVE-4 | Context-window and plan-limit gauges | `live` `data` |
| 67a | LIVE-2b | Composer: expand by key; real end-padding when expanded | `live` `ui` |
| 68 | FILES-3 | Navigation clarity: Files / Repository / Workspace purposes | `files` `ui` |
| 69 | FILES-4 | Reader and Workspace review (type, tabs, toolbars, long/empty material) | `files` |
| 70 | FILES-5 | Opt-in draft recovery | `files` |
| 71 | REVIEW-3 | Bookmarks/saved moments/commit-PR indicators audit | `review` |
| 72 | REVIEW-4 | Joined investigation route, end to end | `review` `native` |
| 73 | REVIEW-5 | Packet usefulness | `review` |
| 74 | NATIVE-1 | Real signed-in Codex journey | `native` |
| 75 | NATIVE-2 | Real signed-in Claude Code journey | `native` |
| 76 | NATIVE-3 | Genuine multi-agent sessions | `native` |
| 77 | NATIVE-4 | Joined native edit/create conflict path | `native` |
| 78 | REL-1 | Managed-runtime update versus the antivirus conflict | `rel` |
| 79 | REL-2 | Physical lower-resource and platform acceptance | `rel` `perf` |
| 80 | REL-3 | Keyboard, zoom, assistive technology and human freeze/truth/ten-minute acceptance | `rel` |
| 81 | REL-4 | Publishing preparation (on request only) | `rel` |

### P3 — deferred ideas

| ID | Item | Tags |
|---|---|---|
| MAP-1 | Repository map purpose (kept aesthetic for now; ideas recorded) | `map` |
| IDEA-1 | Explicit two-session comparison; measured density option | `turn` `ui` |
| IDEA-2 | Symbol timeline after reliable extraction | `read` |
| IDEA-3 | Multi-repo mission control beyond the Home "running now" strip | `home` |
| IDEA-4 | Additional UI versions or themes after Modern is finished | `ui` |

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

- [ ] **BUG-7 · Seven browser journeys fail on main** · P0 · `bug`
  - **Problem:** on a clean `54f93af` checkout these fail (19 October, Harsh with Claude): `connected-workspace.spec.ts` current source reading (:79) and import neighborhood (:129); `fresh-workspace.spec.ts` composer target (:129, `.modern-composer-location`), chrome fit (:287, `.modern-session-header h1`), Git review (:593, resize handle); `session-segments.spec.ts` (:31). Most look for chrome removed by PR109–123 (central session capsule, composer location, reader resize controls). On `0c52619`, `fresh-workspace.spec.ts` edge actions (:1190) also fails: after PR124 the rightmost navigation action no longer reaches within 30 px of the right edge.
  - **Do:** for each, decide whether the product regressed or the test still expects removed chrome; fix the product or update the journey to the current owner. Do not delete coverage.
  - **Accept:** the full browser suite passes on main except opt-in skips.

- [ ] **BUG-5 · Review work reports 0 tests for Codex sessions that ran tests** · `bug` `review` — fixed by DATA-1 (typed `CommandExecution` with `parsed_cmd` and `exit_code`). Close when DATA-1 lands and the "441 tests pass" session shows its runs.

- [ ] **BUG-6 · Usage shows "Not reported" for Codex although `token_count` is recorded** · `bug` `data` — fixed by DATA-2.

### LIVE — the live loop and "now"

- [ ] **LIVE-1 · "Now" line plus tab title/favicon** · P0 · `live`
  - **Why:** glancing at Drishya must answer "what is it doing right now" faster than the terminal does. Today the screen shows only the last card and Follow.
  - **Do:** one quiet line, top centre (or inside the collapsed composer pill), updated in place with a cross-fade and no pulsing:
    - `agent · verb · target · elapsed`, for example `Codex · running pnpm test · 42 s`, `Claude · editing src/store/index.ts`, `waiting for your approval`, `idle · 3 min`.
    - The state comes only from captured events: open tool call without a result = running; pending native request = waiting; turn end = idle.
    - Show the step count within the turn.
    - When the harness records no state, say "last activity 12 s ago", never a guess.
    - Mirror the state in `document.title` (`● Running · drishya`, `? Approval · drishya`) and with a small favicon dot.
  - **Accept:** correct on live Codex and Claude sessions during reads, long commands, approvals and idle; no layout shift; reduced motion uses no cross-fade.

- [x] **LIVE-2 · Composer collapses when idle** · P0 · `live` `ui` `motion` — **shipped 19 Oct (idle pill).** The composer now defaults to its slim "Ask your agent…" pill (180×38 px) and gives the reading height back. It opens by itself for a draft, attachment, run, approval, question, failure or error, and the person's own open/minimize choice (`composer/choice`: auto / open / closed, saved with the session) always wins. Verified on Claude sessions at 1440 px and 390 px: collapsed by default, click expands and focuses the text box, open and closed both survive a reload, no horizontal overflow. Remaining pieces are split out as LIVE-2b.
  - **Problem it solved:** the floating composer covered the newest card; most sessions are driven from the native terminal.

- [ ] **LIVE-2b · Composer leftovers** · P2 · `live` `ui` — expand with a key (`/` is taken by Search, so pick another or use focus), and give the *expanded* composer real end-padding so an expanded Inspector card is never scrolled under it. Not done in LIVE-2.

- [ ] **LIVE-3 · Opt-in notifications** · P1 · `live`
  - **Do:** in Settings, a browser Notification permission request on explicit opt-in only. Notify for "turn finished" and "approval/question waiting", only while the tab is hidden. The body is the session title and state, never captured content.
  - **Accept:** no prompt until opted in; nothing fires while the tab is visible; works for Codex and Claude live sessions. This supersedes the earlier deferral of OS notifications.

- [ ] **LIVE-4 · Context-window and plan-limit gauges** · P2 · `live` `data`
  - **Do:** after DATA-2, a small ring in the identity bar: context used / `model_context_window` (Codex) or derived from `message.usage` (Claude, labelled as such). Codex `rate_limits` primary/secondary windows appear in Usage. Hide entirely when not reported.

### TURN — turns and navigation

- [ ] **TURN-1 · Turn chapters with ledger** · P0 · `turn` `motion`
  - **Problem:** a user prompt renders as right-aligned prose with the same weight as the agent's text; nothing marks a turn's start, end or output.
  - **Do:**
    - Each prompt becomes a chapter header: prompt text (clamped to 3 lines, expandable), time, and duration (Codex `task_complete.duration_ms`, or Claude turn-end timestamps).
    - When the turn resolves, show a one-line **ledger**: `read 12 · edited 4 files (+86 −23) · 9 commands · tests 41✓ 1✗ · 3m 12s`.
    - Counts come only from captured operations; an unknown is shown as "—".
    - Finished turns collapse to header plus ledger (click to expand); the latest turn stays open.
    - The ledger lands once, as the *Resolve* move, with no count-up animation.
  - **Accept:** correct counts on 3 Codex and 3 Claude sessions, cross-checked against Review work; collapsing preserves scroll anchor and Follow; virtual paging unaffected.

- [ ] **TURN-2 · Keyboard reading model** · P1 · `turn`
  - **Do:** keys:
    - `j`/`k` previous/next operation; `n`/`p` next/previous edit; `f` next failure; `t`/`T` next/previous turn;
    - `e` expand/collapse; `o` open in peek; `y` copy the focused material; `g`/`G` first/last;
    - `?` cheat sheet.

    The focused operation gets a visible focus ring and scrolls into the reading position. Keys are disabled while typing in inputs or the editor.
  - **Accept:** all keys work with Follow on and off; the cheat sheet is listed in Settings → Keyboard.

- [ ] **TURN-3 · Prompt rail encodes turns** · P1 · `turn` `ui`
  - **Do:** tick length ∝ operations in the turn (clamped); red notch if the turn contains a failure; amber dot if it edited files; the current reading position is marked. The hover preview shows the ledger. Keep it as an independent chapter rail.

- [ ] **TURN-4 · Replay transport in Modern** · P1 · `turn` `motion`
  - **Problem:** Settings → Playback contains only "Sequence diagnostics". Play/pause/speed exist in Legacy `components/Viewer.tsx` and in `.history-transport`, but never appeared on real Modern sessions.
  - **Do:** an explicit "Replay" entry (⋯ menu or Ctrl+K) shows a compact transport: play/pause, speed 0.5–4×, next edit, next failure, scrubber with turn ticks. Live history continues independently (constraint 7).
  - **Accept:** replay never stops on hover or scroll; only pause, seek, leaving, completion or failure stop it (review 31).

### READ — reading code, diffs and output

- [ ] **READ-1 · Wide, scannable edit cards** · P0 · `read`
  - **Problem:** at 1440 px, edit cards are about 440 px wide with code soft-wrapped 3–4 times.
  - **Do:**
    - In the wrapping passage layout, edit/write/create cards with a diff may take a **full row** (up to the reading width, about 760–900 px).
    - No-wrap by default with horizontal scroll inside the card; a Wrap toggle.
    - Header shows `path · +12 −3 · ✓ applied`.
    - Real file line numbers where captured (Claude `structuredPatch`/`originalFile`; Codex `FileChange`, after DATA-1).
    - Unchanged runs over 6 lines collapse to "⋯ 14 unchanged lines".
  - **Accept:** a 120-character line is readable without wrapping; counts match the patch; small edits stay compact; the arrows between boxes still point correctly.

- [ ] **READ-2 · Quiet provenance** · P0 · `read` `ui`
  - **Problem:** each card carries several provenance strings in primary position: "derived from exec", "Captured arguments · bounded preview", "Captured changes · scroll to read", "Historical source · recorded result", "Captured use counts".
  - **Do:** remove those default strings from the card body. Add one ⓘ in the card footer whose popover gives the exact provenance and limits. Show an inline badge only when it changes meaning: `truncated`, `derived`, `not captured`, `redacted`, `stale`. Rename the meta "Other · exec" to the decoded tool or "Tool".
  - **Accept:** every provenance fact is still reachable by pointer and keyboard; no captured/derived confusion (constraint 4); the screen-reader name includes the badge.

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
  - **Sources:** Claude `TodoWrite` (mapped), `TaskCreate`/`TaskUpdate` (not mapped), `ExitPlanMode` plan text (not mapped); Codex plan updates (DATA-7).
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

- [ ] **DATA-10 · One batched schema proposal** · P0 · `data`
  - **Do:** draft the additions (usage/context, checkpoint reference, image-view, question/answer, plan/todo revision, sub-agent identity fields, command `exit_code`/`duration`/`parsed_cmd`) in `docs/reference/03-event-schema.md` as a proposal. Both builders agree before code (AGENTS rule). Existing kinds should be reused where they fit.

- [ ] **DATA-1 · Codex typed items** · P0 · `data` `content`
  - **Do:**
    - In `packages/adapter-codex/src/index.ts`, stop ignoring `event_msg:item_completed`. Map `CommandExecution` (command, parsed_cmd, cwd, status, exit_code, duration, outputs), `FileChange`, `McpToolCall` (server, tool, status, duration, error, readOnlyHint), `ImageView`, `Extension`, `SubAgentActivity`, `Reasoning.summary_text` and `AgentMessage.phase/questions`.
    - De-duplicate against `response_item` calls by call/item id. Prefer the typed item for outcome; keep the wrapper as raw source.
    - Declare capabilities per CLI version; unknown shapes stay metadata-only.
    - Add redacted fixtures for each item type.
  - **Accept:** card titles show real commands/tools instead of "exec"/"Other"; tests are recognized from real commands and exit codes (closes BUG-5); no duplicate cards; older rollouts without these items still import identically (golden tests).

- [ ] **DATA-2 · Usage from what is recorded** · P0 · `data` `live`
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

- [ ] **EXPLAIN-4 · Live validation** · P0 · `explain` `hack` — get a Token Factory key; list models (`GET /v1/models`); set real Nano/Super/Ultra ids (defaults in `packages/explain/src/index.ts` are unverified); run explain, briefing and labels on a real session; record latency and cost per call in HACKATHON.

- [ ] **EXPLAIN-1 · Narrator labels** · P0 · `explain` `hack` `live`
  - **Do:**
    - With the narrator on for a session, each burst of consecutive operations (or each passage) gets a one-line generated intent above it, e.g. "Investigating why checkout rejects free orders [E3,E5]", from Nano.
    - Batched, debounced (≥ 10 s or end of passage), cached by evidence hash, cancellable.
    - Shown in the derived style with the model name on hover.
    - The narrator off means zero network calls.
  - **Accept:** works live on a Codex and a Claude session; no call before opt-in; labels cite real operations; cost and latency within the targets recorded in EXPLAIN-4.

- [ ] **EXPLAIN-2 · Turn summary and return briefing** · P0 · `explain` `hack` `turn`
  - **Do:** on request (button in the turn ledger, or "While you were away" after the tab was hidden for more than 2 min), Super writes 3–5 cited bullets: what changed, what was checked, what failed, and what is still open. Each bullet links to its evidence.

- [ ] **EXPLAIN-3 · Explain this hunk (validate)** · P2 · `explain` — the existing Ultra/Super path; validate on real diffs; citations jump to the step.

- [ ] **EXPLAIN-5 · Derived visual language** · P2 · `explain` `ui` — one consistent treatment for generated text (for example an italic secondary tint, a small model glyph and a dotted underline on citations) that can never be mistaken for agent prose or captured output, including in exports.

### GIT — Git review, graph and Sacred Timeline

- [ ] **GIT-1 · Sacred Timeline** · P1 · `git` `motion`
  - Build to the spec in [124](review/124-sacred-timeline-git-graph.md):
    - WebGL/Canvas additive **filaments** with bloom;
    - the main line as a braided luminous river;
    - branches peel off the rim at real forks, rejoin at real merges, and split into lightning tips only at unmerged heads;
    - a starfield backdrop;
    - commit points with DOM buttons, peek and keyboard.
  - Prototype first with the `prototype` skill; builder sign-off on stills before integrating. Topology truth unchanged.
- [ ] **GIT-3 · Commit rows and ref filter** · P1 · `git` — a compact message · author · time · refs row list synced with the timeline; branch list filtered to refs in the loaded window, with an All toggle (today: 183 truncated names).
- [ ] **GIT-2 · Session ↔ commit links** · P2 · `git` `turn` — commits whose hash appears in captured command output, or whose time and paths match a captured commit command exactly, are marked with the session and turn. Evidence-backed only. Uncommitted session work appears as a "working tree · this session" entry.
- [ ] **GIT-4 · Hunk-level Recorded work** · P2 · `git` `read` — from a Git review hunk, jump to the captured operation that wrote those lines, where exact.

### FILES — Explorer, peek and Workspace

- [ ] **FILES-1 · Evidence-decorated tree** · P1 · `files` `live`
  - **Do:**
    - Each file row may show `E` edited / `A` created / `D` deleted (amber/green/red letter), a read eye with a count, and a subtle "now" mark on the file under the current operation.
    - Folders aggregate (dot plus count).
    - A "Touched" filter shows only files with session evidence.
    - Decorations come from captured operations, never current Git status alone; Git status stays in Git review.
  - **Accept:** matches Review work's changed files; updates live; no resident new buttons (the filter goes in the Find field's menu). `modern/ModernFiles.tsx` currently has no decorations.

- [ ] **FILES-2 · Paths open in peek** · P1 · `files` `read` — any path in prose, card headers, search hits and test output opens in the tabbed peek (captured version by default, with an explicit current-file toggle under consent).

- [ ] **FILES-3 · Navigation clarity** · P2 · `files` `ui` — make the purposes of Files (current tree), peek (read beside the agent), Workspace (full view and drafts) and Repository (map) obvious through one-line hints and destinations, with a joined investigation route, not more resident buttons.
  - **19 October progress (107):** Correction entry/retained origin and explicit Files exit from map mode implemented. New peek/Workspace roles preserved. Broader navigation acceptance remains open.

- [ ] **FILES-4 · Reader and Workspace review** · P2 · `files` — type and line height, syntax, paths, Markdown, tab design, pane sizing, toolbars, copy/find/wrap/go-to-line, resize/scrollbars, long and empty material.
  - **19 October progress (107):** Existing whole-file/current-draft readers retained alongside new compact peek, data/resource readers and Actions menus. Investigation/recovery and desktop/phone regressions added; broad material combinations remain open.

- [ ] **FILES-5 · Opt-in draft recovery** · P2 · `files` — design explicit opt-in persistence before storing edited text; keep download and the unsaved warning until then; never imply volatile drafts survive crashes.
  - **19 October progress (107):** Explicit user-owned encrypted snapshot download, unlock preview and deliberate matching-workspace restore implemented. No autosave or stored key/passphrase; ordinary drafts remain volatile. Protected/secret-pattern text refuses recovery; stale bases and live-draft conflicts retained. Synthetic reload/privacy/limit regressions pass; native writes remain excluded.

### UI — visual system, chrome and minimalism

- [ ] **UI-1 · Chrome consolidation and session identity** · P1 · `ui`
  - **19 October progress (107):** Session details in existing utilities shows exact title/harness/recording/root and journal-watch qualification. Modern central capsule remains absent under latest builder correction; proposed unified bar is not adopted here.
  - **Problem:** nine floating clusters (logo, Files|Repository, search/settings/menu, Git review|Git graph, Workspace, Toolbox, rail, Follow, composer), each with its own border. The session's title, repo, branch, harness and live state are invisible.
  - **Do:**
    - One slim top bar: identity (title · repo@branch · harness/model · live dot · LIVE-1 status), then navigation (Files · Git · Map · Workspace · Search · ⋯).
    - Toolbox and Files stay docked panels.
    - Retain the builder's header-capsule comparison decision by showing it to them before merging.
  - **Accept:** fewer outlines on screen; identity visible at all widths; nothing overlaps, including the bottom-corner Tools/Follow pills at narrow widths (residual from BUG-4).

- [ ] **UI-2 · Typography floor** · P1 · `ui` — 280 CSS declarations are ≤ 10 px (14 at 7 px, 53 at 8 px, 84 at 9 px). Set a floor of 11 px for meta and 12–13 px for controls and labels; raise secondary-text contrast to ≥ 4.5:1 on every palette. Check with the existing contrast guard.

- [ ] **UI-3 · Uiverse / component-library pass** · P1 · `ui` `motion`
  - **19 October progress (107):** Switch/minimal-input/hover references assessed; original token-based controls/focus/fields with motion/resource/forced-color fallbacks implemented. No copied library/runtime dependency. New shimmer/prototype-choice scope remains separate.
  - **First:** the builder's reference [Star on GitHub shimmer button](https://uiverse.io/elijahgummer/bright-chicken-11) (MIT): black pill, a diagonal light sweep on hover (1 s ease-out), ring-offset on hover, and a star icon that tints on hover.
    - Port it to our tokens (no Tailwind dependency); respect reduced motion.
    - Show **no live star count**: a GitHub API call would be an automatic external request.
    - Move it from the primary header to About or Home's footer.
  - **Then** survey Uiverse and similar libraries (shadcn/ui, Origin UI, Magic UI, Aceternity UI, motion-primitives, React Bits) per component: toggles, segmented controls, inputs, search fields, menus, tooltips, tabs, checkboxes, dialogs, loaders/empty states.
    - Selection rules: fits the dark flat hairline theme; no glow pools; CSS-first; MIT or compatible licence with attribution; accessible (focus, keyboard, forced colours); reduced-motion fallback.
    - Use the `prototype` skill to show 2–3 candidates per component behind a switcher; the builder picks.
  - **Accept:** each adopted component is listed in a short attribution note.

- [ ] **UI-5 · Button density and navigation** · P1 · `ui` `files`
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

- [ ] **REVIEW-2 · Search result context** · P1 · `review` — each hit shows session · turn · tool · file · time; the jump keeps the hit highlighted; results are grouped by turn.

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

- [ ] **TEST-1 · Browser specs failing or flaky on `main`** · P1 · `rel` — found 19 Oct while verifying LIVE-2; all four reproduce on the code from before PR #124, so they are not from recent work. `DRISHYA_BROWSER_CHANNEL=msedge npx playwright test <file>:<line>`:
  - `connected-workspace.spec.ts:79` **modern** variant ("current source reading finds, navigates and wraps…") — times out waiting on a Read-current-file button in the dialog; classic variant passes.
  - `connected-workspace.spec.ts:129` ("source reading links qualified current imports…") — times out waiting for `Read current file src/actual.ts` inside the `src/other.ts` dialog.
  - `product-workspace.spec.ts:158` ("first-visit evidence review…") — Playwright strict-mode violation: the Review dialog's `src/checkout/guard.ts` button matches two elements.
  - `product-workspace.spec.ts:65` ("map file labels are keyboard reading targets…") — flaky, about 50%: the "Work on …" dialog sometimes isn't visible after Enter on a map label.
  - **Do:** decide per spec whether the product or the test is wrong, fix, and re-run each 10× for flakiness. **Accept:** all four pass 10 of 10 on a clean build.

### HACK — Nebius × NVIDIA Global AI Hackathon

Deadline **30 Oct 2026, 10:00 PT (22:30 IST)**. See [HACKATHON](HACKATHON.md) for fit, track and odds.

- [ ] **HACK-1 · Decide and prepare** · P0 · by 24 Oct — both builders agree to enter; make `drishya-dev/drishya` public (check the history for secrets first; Apache-2.0 must show at the top of the repo page); pick the track (recommendation in HACKATHON).
- [ ] **HACK-2 · Hosted demo** · P0 — a static build of the synthetic demo (`?demo`) hosted publicly, with precomputed, labelled Nemotron outputs (narrator labels and turn summary) generated once via Token Factory, so judges see the model layer without a key. Local setup is in the README for the full product.
- [ ] **HACK-3 · Submission package** · P0 — video under 3 min (the problem in 15 s → live session → narrator labels → turn ledger → explain a hunk → Git review), README setup, a description of what was significantly updated during the window (repo started 20 Sep, inside the window), Token Factory feedback, Nemotron usage section.

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
