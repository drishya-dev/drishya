# 122 — Independent developer review of the running product

**19 October 2026 · Claude Opus 5.5, memory-free of earlier reviews.** I read the original brief, VISION, TASKS and README, then used the running app (`main` @ `8de8952`, Modern UI). I opened three real sessions: a 1,100-operation Codex session in this repo, a Claude Code session in AgentGuard, and this conversation's own Claude Code session while it was live. I also opened the synthetic demo. Screens were captured at 1440×900 in headless Edge and in the in-app pane at about 800 px. I did not test signed-in native sending, phone hardware or the Legacy/Canvas versions in depth.

This is a critique, not a task list. Its accepted items are now IDs in [TASKS](../TASKS.md) (19 Oct restructure).

> **Builder corrections, 19 October — these override the text below.**
> 1. **Toolbox→card connectors are hover-only.** My screenshots were taken with the pointer over cards. The "decorative lines" criticism is withdrawn.
> 2. **The passage layout is deliberately wrapped** (fill a row, then continue on the next row with arrows from box to box), because one horizontal lane forces two-axis scrolling on a mouse. "Use one lane" is withdrawn. The accepted refinement is READ-4 (deterministic wrap rules, wide diff cards may take a full row).
> 3. **File peek and Workspace are both intended:** peek reads beside the agent, and Workspace is the full view when you are not watching the agent. "Demote Workspace" is withdrawn. The accepted part is control density (UI-5).
> 4. **The 3D repository map stays as an aesthetic surface for now.** The "change atlas" is recorded as a deferred idea (MAP-1), not a replacement.
> 5. **Git graph direction is the Sacred Timeline:** a fiber-light main strand, branches peeling off and merging, a starfield. See [124](124-sacred-timeline-git-graph.md). It replaces §6.3's "rows instead of ribbon"; a compact synced row list (GIT-3) is kept beside it.
> 6. **Minimalism is a hard rule.** Proposals must not add resident buttons.
> 7. **Harness data matters first.** What the journals actually record (and that reasoning mostly is *not* recorded) is in [123](123-harness-data-audit.md).

---

## 1. What the product is, as I understand it

A local, read-only observer for agent harnesses (Claude Code and Codex today). It shows the agent's work as **real captured material**: the file it read, the diff it wrote, the command and its output, and its prose. The material is laid out as an accumulating history, beside your repository, so you understand the change *while it happens* instead of trusting a final summary. The goal is a window a developer keeps open while the agent works. You should not just vibe-code and later inherit a codebase only the agent understands.

The brief's non-negotiables still hold: visualization is the product; no labelled boxes; live plus replay; observability over control; captured is never confused with derived.

## 2. Headline verdict

| Dimension | Score | One line |
|---|---|---|
| Concept and differentiation | **9/10** | Nobody else shows the agent's real material inline, live, across harnesses. Still true. |
| Capture fidelity and engineering | **8/10** | Live latency about 2 s. A 1,100-op session loads in 2.3 s with about 2.4k DOM nodes, a 15 MB heap and about 7% idle main-thread time. Redaction and provenance are rigorous. |
| The live watching loop (the core job) | **5/10** | Nothing says "what is it doing right now", there is no turn structure, and the composer covers the newest work. |
| Reading code and diffs | **5/10** | Diffs are real but sit in ~440 px cards with soft-wrapped code, under a lot of provenance chrome. |
| Visual polish and coherence | **6/10** | Calm and dark, with good prose typography. But nine floating "islands", 9–10 px labels everywhere, decorative connector lines, and three overlapping UI versions. |
| Developer utility beyond the stream | **6/10** | Git review, file peek, search and Review work are genuinely useful but hidden or gated. The repo map and Git graph currently have no job. |

**Would a developer switch from the Claude Code / Codex terminal to this as the main window? Not yet.** As a second-monitor companion and an after-the-fact reviewer: yes, today. Turning "companion" into "main window" depends less on new features than on fixing the core loop:

1. Show what is happening **now**.
2. Make each turn a readable **chapter**.
3. Make **diffs wide and scannable**.
4. Remove chrome that competes with the material.

### The strategic risk

Much of the recent work went into a generic IDE and Git client: a Workspace editor with drafts, a branch atlas, JSON/CSV/TSV inspectors, resizable windows and palettes. Developers already have VS Code, GitLens and a terminal for those, and they are better at them. **Drishya wins only on agent-specific context**:
- *why* a line changed;
- *what the agent had read* before changing it;
- *what it ran afterwards*, and whether that passed;
- *which turn and which agent* did it.

Every new feature should pass one question: "does this use the captured agent evidence in a way an IDE cannot?" If it doesn't, defer it.

---

## 3. What is genuinely good — keep it

- **Inline real diffs and real command output** in the stream. This is the product, and it works. Test bars (demo `npm test` → 7 green bars) are exactly the right kind of content-shaped visual.
- **Prose rendering.** Agent text sits directly on the world, unboxed, with good line length and weight. Thinking is shown as "Thinking · collapse", which is honest and quiet.
- **Live freshness.** Live capture keeps running while you read old history; Follow only moves the viewport. My own tool calls appeared within about 2 s.
- **Git review drawer.** A real staged/worktree patch, side by side, hunk navigation, a per-patch "Reviewed" checkbox and a review note. It is close to a good PR-review surface.
- **File peek beside the agent.** It is right-docked, renders Markdown, and leaves the agent view visible. This is the right pattern; it should become the default reading surface.
- **Ctrl+K navigator and cross-session search.** Fast, keyboard-first, honestly scoped.
- **Review work.** "Changed files, failures, recorded checks, capture gaps" is the right post-run summary.
- **Performance discipline.** Paging, virtualization and resource guards are better than most shipped dev tools.
- **Truth discipline.** "Result not captured", "nested outcome not exposed" and redaction markers mean you are never shown a fabricated outcome. Keep the rule; change only how loudly it is presented (§4.3).

---

## 4. The critical problems, ranked

### 4.1 No "now" — the live view never says what the agent is doing
In a live session the screen shows the last card and the Follow toggle. There is no agent state (thinking / running `pnpm test` for 42 s / waiting for approval / idle since 3 min), no elapsed turn time, and no current file. Glancing at the terminal is faster than glancing at Drishya. That is the opposite of the goal.

**Fix:** add one compact status line (top centre, or merged into the composer when collapsed): agent identity · state verb · target · elapsed · step count in turn. It should update in place without flashing. Reflect state in the **tab title and favicon** (`● Running · drishya`, `? Needs approval`). Add an opt-in browser notification for "turn finished" and "approval needed". TASKS defers OS notifications. For "main window" use they are among the highest-value additions, because they are what let a developer look away safely.

### 4.2 Turns are not chapters
A user prompt renders as right-aligned prose ("You …") in nearly the same style as the agent's text. Nothing marks where a turn starts or ends, or what it produced. The prompt rail has 32 identical ticks.

**Fix:** make each prompt a **chapter header**. Show the prompt (clamped, expandable), the time and duration, then a one-line **turn ledger**: `read 12 · edited 4 files (+86 −23) · 9 commands · tests 41✓ 1✗ · 3m 12s`. The ledger fills in when the turn resolves; that is the vision's *Resolve* move, carrying real information. Make finished turns collapsible to header plus ledger. Encode the rail ticks with turn size (length) and failures (red). That turns the rail into a map of the session instead of a ruler.

### 4.3 Diffs are hard to read, and chrome competes with the material
- Edit cards are ~440 px wide at 1440 px, with code **soft-wrapped** three to four times per line, e.g. `snippet(search,0,'','…',20) AS snippet,r.title,r.workspace_root AS`. Wrapped diffs are the slowest way to read code.
- Every card has provenance strings in primary position: "derived from exec", "Captured arguments · bounded preview", "Captured changes · scroll to read", "Historical source · recorded result", "Captured patch input · nested outcome not exposed", "Captured use counts". Each is truthful. Together they make every card look like a forensic form.
- Card meta says "Write · exec", "Other · exec". "Other" tells a developer nothing.
- No `+N −M` per file in the card header and no real file line numbers on Codex patches.

**Fix:**
- Edit/write cards take the full reading width (~760–900 px), use no-wrap with horizontal scroll by default, and show the header `path · +12 −3 · ✓ applied`.
- Collapse unchanged context; show real line numbers where known.
- Move provenance into a single ⓘ affordance with the exact wording on hover/focus. Show an inline badge **only when it changes the meaning**: truncated, derived, missing, redacted.
- Keep the evidence; just stop narrating it on every card.

### 4.4 The composer covers the newest work
The prompt composer floats bottom-centre over the history. It covers the end of the latest card and covers **expanded** diffs (verified: expanding a write card puts its lines under the composer). In the common case the session is driven from the native terminal, and the composer is idle chrome over the most important pixels.

**Fix:**
- When the session is not connected for sending, collapse the composer to a slim pill ("Continue in Drishya…"); expand it on focus or `/`.
- Reserve its height as real end-padding, not overlay.
- Never let Expand/Inspector content sit beneath it.

### 4.5 Scattered floating chrome and missing identity
At 1440 px there are nine separate floating clusters: logo, Files|Repository, the search/settings/menu trio, Git review|Git graph, Workspace, Toolbox, prompt rail, Follow live, and the composer. Each has its own border and radius. There is **no session identity**: no title, branch, harness or model in view (the capsule was removed). At ~800 px the islands overlap prose (Workspace sits over a paragraph; Files|Repository sits over a card).

**Fix:** one slim top bar holding the session identity (title · repo@branch · harness/model · live state) plus the navigation (Files, Changes, Git, Map, Search, ⋯). Keep the side panels (Files, Toolbox) docked rather than floating. Fewer edges is calmer, and calm is the doctrine.

### 4.6 Mouse-wheel scrolling is trapped over cards (bug)
With the pointer over a centred card, the wheel does **not** scroll the history, even when the card's own content cannot scroll further. Measured: `history.scrollTop` stayed at 71627 for two wheel events over a Read card, then moved only when the pointer was over empty space. Cards cover most of the centre column, so this happens constantly. Local scroll should chain to the history at its boundary, or the card should only capture the wheel after a deliberate click or focus.

### 4.7 Three separate consents for one local repository
Files reading, Git review and Git history each ask for approval separately, per workspace. In a tool the developer launched against their own repo, this is friction without added safety. **Fix:** one per-workspace "Trust this folder (read-only files and Git)" decision, remembered, revocable in Settings → Privacy. Drafts and native handoff can keep their own explicit steps.

### 4.8 Repository map and Git graph have no job (yet)
- **Repo map:** 618 files / 899 imports collapse into one vertical spike of crossing white lines. The nodes are labelled "Mixed files 47", "Mixed files 21" and so on. It is unreadable and answers no question.
- **Git graph:** a beautiful spectral ribbon, but it carries no commit messages, authors or times, clicking the ribbon does not select a commit, the main navigation is an `Open a commit…` `<select>`, and the branch list is 183 truncated `codex/…` names.

Concrete jobs are proposed in §6.

---

## 5. Surface-by-surface notes

**Home**
- Session titles are raw first prompts, including URLs and "This session is being continued from a previous conversation…".
- Every row carries a blue "Available locally", which is noise.
- There is no live indicator until a session has been imported once.
- There are no per-row stats: duration, files changed, last outcome, or "running now".
- Workspace paths are truncated mid-path.
- "Star on GitHub" sits in the primary header of a daily tool.
- Suggestions: a **Running now** strip at the top across all repos; per-row `12 files · +340 −81 · 2 failures · 43 min`; titles cleaned (strip "continued from…", use a harness-provided title or summary when one is captured); move GitHub to About.

**History cards**
- Zig-zag placement (left card, right card, centred card) makes reading order ambiguous; use one lane with consistent left edges.
- The background fan of thin lines converging behind cards and the long diagonal lines to the Toolbox read as noise. Draw a connector only on hover/focus, from the hovered card to its true origin (file row or tool), and fade it out.
- Six Codex sub-agents all appear as "subagent". Use the spawn description or role.
- Screenshot/image results show the file path text, not the image (already open in TASKS).

**Prose and Markdown**
- A Markdown link whose label is bold and whose target is a Windows path renders raw: `[92-feature-value-and-placement.md](/C:/Users/...)`. Repro: the final message of the Codex "well now continue…" session.

**Files tree**
- Shows the current disk only. There are **no agent decorations**: no edited/created/read marks, counts or recency. This is the cheapest, highest-value visual in the product (§6.1).

**File peek**
- Good. Make it the default target for every path in the stream (click a path in a card or in prose → peek at the captured version, with a toggle for the current one).

**Workspace**
- It replaces the agent view entirely. An empty Workspace says "A place for the code you are reading". Developers already have an editor. Recommend demoting Workspace to a **split mode** (agent column at about 40% + code at about 60%) and freezing editor features.

**Git review**
- Strong.
- It overlays the Git graph button, so you cannot switch Review → Graph without closing first (bug).
- Escape does not close it, while Escape closes Settings and Ctrl+K (inconsistent).
- Add "**Recorded work**" at the hunk level: for a hunk, jump to the captured operation that wrote it. The button exists per file; take it to hunk precision.

**Git graph**
- See §6.3.

**Toolbox**
- The counts (Edit 271 · Shell 834 · Other 23) are trivia unless they act as **filters**. Clicking Shell should filter the history to shell operations, with a clear chip to undo.
- "Other" should be broken down or named.

**Review work**
- The right idea, hidden in the ⋯ menu.
- It reported "0 test runs" for a Codex session whose prose says "441 local tests pass": tests run through wrapped `exec`/js were not recognized.
- Nine identical "Capture gap: compaction" rows take half the panel; group them as "9 compactions" with a disclosure.
- Make Review work a first-class tab: **Changes**.

**Search**
- Results are bare snippets. Add session/turn, tool, file and time to each row, and keep the hit highlighted after jumping.

**Settings**
- Clear categories.
- **Playback** contains only "Sequence diagnostics". I could not find play/pause/speed in Modern on real sessions; the transport exists in the Legacy `Viewer`. Replay was a core promise of the brief (play, pause, speed, jump to next edit/failure). Either surface it in Modern or remove the empty category.

**Usage**
- For Codex every value is "Not reported". When nothing is reported, show one line instead of four rows.

**Typography and CSS**
- 280 declarations set `font-size` ≤10 px (84 at 9 px, 53 at 8 px, 14 at 7 px). On black, 9–10 px grey labels fail comfortable reading at a normal viewing distance. Set an 11 px floor for meta text and 12–13 px for controls.
- The UI ships 39 CSS files (~600 KB source) with 241 `!important` declarations. They are layered from successive redesigns (`p1`, `stage`, `studio`, `atelier`, `ink`, `workbench`, `polish`, `reliability`, `modern/*`, `classic`, `canvas`). This is now the main reason small UI fixes regress elsewhere.
- Recommend one consolidation pass: freeze Legacy, retire Canvas, and move Modern onto a single token sheet before more polish.

---

## 6. What a developer would actually want — proposals

Ordered by value ÷ effort. All are evidence-backed and use only captured data.

### 6.1 Now — make the core loop excellent

1. **Now bar plus tab title/favicon state plus opt-in notifications** (§4.1).
2. **Turn chapters with a ledger; collapsible finished turns** (§4.2).
3. **Wide, scannable diffs and quiet provenance** (§4.3).
4. **Evidence-decorated file tree.** Each file row shows:
   - an edited/created/deleted letter;
   - a read eye with a count;
   - recency (the row fades from accent to neutral over the session);
   - a "now" marker on the file the agent is touching.

   A "Touched only" filter turns the tree into the session's change list. Arrivals can **Lift from the tree row**, which is visible and true, so the origin doctrine is honoured without the 3D map.
5. **Keyboard reading.**
   - `j`/`k` next/previous operation; `n`/`p` next/previous edit; `f` next failure; `t` next turn;
   - `e` expand; `o` open the file in peek; `y` copy;
   - `?` opens a cheat sheet.

   This is how developers move through GitHub PRs and Gerrit. Today only `/` and Ctrl+K exist.
6. **Fix the bugs in §4.6, §5** (wheel trap, Git drawer overlap, Escape consistency, Markdown link, narrow-width overlap).

### 6.2 Next — agent-specific insight no IDE has

7. **Session diff, with blame-by-turn.** A PR-style net diff of the whole session per file, where each hunk carries the turn/operation that produced it and its follow-up check. TASKS defers "changed-line attribution". I would move it up: it is the single feature that answers "why is this line here?", and no editor can answer that.
8. **Read-before-write signal.** For each edit, show whether, and which ranges of, the file were read earlier in the session. Flag "edited without reading this file" and "edited lines it never read". This is a factual trust signal, not a judgement.
9. **Failure → fix chains.** Link a failed command to the next run of the *same* command and show the edits made in between: `✗ pnpm test → 3 edits → ✓ pnpm test`. This is a typed relationship (same command identity plus temporal order), not a causal claim, and can be labelled exactly that way.
10. **Per-file timeline.** Click a file → every read and edit on it in order, stepping diff by diff, with the captured version at each step (`FileHistory` exists; promote it).
11. **Approval inbox.** When a native approval is pending, show one prominent card with the exact command or diff, plus Approve/Deny where the controller supports it. This is the moment a developer most needs to see content, not text.
12. **Running-now strip on Home** for people running several agents at once. A light version of the deferred mission control.

### 6.3 Give the map and the Git graph a job

**Repository map → "Change atlas".** Replace the default 3D force graph with a flat, stable **treemap or icicle** of the repository: area is file size or line count; folders are nested. Agent activity paints it:
- read = cool tint;
- edited = amber;
- created = green;
- failed check touching the file = red outline;
- current file = gentle highlight.

Questions it answers at a glance:
- *Where is it working?*
- *How wide is the blast radius?*
- *Did it touch areas I didn't ask about?*

Show importers of edited files as a second ring on hover ("blast radius"). Keep the 3D spatial map as an optional ambient background and an aesthetic mode. It is lovely as atmosphere, but it is not an instrument.

**Git graph → "Session ↔ commits lens".**
- Rows, not only ribbon: message · author · relative time · refs.
- Commits made **during** a captured session are linked to the turn that produced them.
- Uncommitted session work appears as a pseudo-commit at the top ("Working tree · this session · 12 files").
- Turn checkpoints ("repo after turn 7", where captured content allows) can be compared to HEAD.

The spectral ribbon can stay as a compact header strip over the rows, which keeps the art direction and adds information. Filter branches to "branches touched by agents" by default instead of listing all 183.

### 6.4 Later

- Explicit two-session comparison and a multi-agent swimlane view for genuinely parallel sub-agents.
- A shareable read-only session replay bundle with redaction preview (Export exists; make it a first-class "share this run" with the packet).
- Evidence-scoped, user-triggered "explain this hunk", always labelled as generated (the Nemotron path exists).

---

## 7. Motion — where to spend it

The doctrine is right. The current problem is motion spent on decoration (connector fans, long diagonal emission lines) instead of meaning. Concrete moves, each ~160–240 ms, interruptible, with reduced-motion fallbacks:

- **Lift from the tree row.** A new edit/read card grows from the file's row in the visible Files tree. That row is the true origin a developer can see.
- **Settle into the ledger.** Once an operation is N steps old, its card compresses into a one-line ledger row (`✎ src/store/index.ts  +12 −3  ✓`). Hover or `e` re-expands it in place. This delivers "work accumulates" and solves density at once.
- **Resolve once.** Test bars fill to their final pass/fail state once; the turn ledger lands when the turn ends; a failure outlines once in red and holds. Nothing loops.
- **Now marker.** The current file row and the Now bar update in place with a cross-fade. No pulsing.
- **Hover connectors only.** Hovering a card draws one short line to its origin (tree row or Toolbox entry) and fades it out on leave.

---

## 8. Suggested order of work

1. Fix: wheel trap, Git drawer overlap and Escape, Markdown link, narrow-width header overlap.
2. Now bar plus tab title/favicon state plus opt-in notifications.
3. Turn chapters with ledger; collapsible turns; information-bearing prompt rail.
4. Wide no-wrap diff cards; quiet provenance (ⓘ); `+N −M` headers.
5. Composer collapses when idle or unconnected; never overlays content.
6. Evidence-decorated file tree plus Lift from tree.
7. Keyboard reading model.
8. A single trust decision per workspace.
9. One top bar with session identity; consolidate the floating islands.
10. CSS consolidation (freeze Legacy, retire Canvas, single token sheet, 11 px floor).
11. Session diff with blame-by-turn, read-before-write, failure→fix chains.
12. Change atlas; Session ↔ commits lens.

Items 1–7 are what turn Drishya from "a good thing to review afterwards" into "the window I watch my agent in".
