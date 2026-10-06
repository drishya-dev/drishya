# 19 — Features a senior developer would pay for

6 October 2026 · Harsh (with Claude Opus 5.5) · **Proposals only. Nothing here is implemented or approved.** Build after the main baseline is finished, in the stage order of [DEVELOPER_WORKSPACE](../DEVELOPER_WORKSPACE.md).

## The question we asked

Imagine you are a senior engineer who runs two or three coding agents every day. Which features would make you pay $1,000 a year for Drishya, without thinking twice?

Such an engineer does not pay for prettier logs. They pay for three things:

1. **Trust.** They need to know, quickly and for sure, what the agent changed and what was checked after it.
2. **Time.** Reviewing a 40-minute agent session should take 3 minutes, not 30.
3. **Control without interfering.** They want to notice early that an agent is stuck, looping or touching something dangerous, without Drishya ever driving the agent.

Every idea below serves at least one of these. Each also keeps the rules that make Drishya trustworthy:

- observe only
- captured vs derived always labelled
- no invented causes
- redact before storing
- no telemetry
- text in the DOM

Ideas that would break a rule are listed at the end, with the reason they were rejected.

Each proposal says **what** it is, **why** someone pays for it, **what is needed** (UI only, or new backend), and the **stage** it belongs to (W1–W6 from DEVELOPER_WORKSPACE, or a new group).

---

## Tier 1 — the features that make it worth paying for

### 1. Agent blame: "who wrote this line, and why?"

**What:** pick any line of a changed file and see:
- which operation wrote it
- which user prompt that work was serving
- what the agent read just before writing it
- whether a later edit replaced it
- which test runs were recorded after it

It is `git blame`, but for the agent session.

**Why pay:** this is the number-one review question. Today you answer it by scrolling a transcript. Here it takes one click.

**Needs:**
- A pure function in `packages/scene` that maps changed lines to the operations that produced them. It is built from the captured patches only.
- Lines with no captured patch show **Unknown**. They are never guessed.
- UI: a gutter in the reader (see 7).

**Stage:** W5. It builds on existing per-file history and P2-C verification freshness.

### 2. Tripwires: rules that flag risky actions

**What:** a local, user-editable list of factual rules checked against captured operations. Built-in examples:
- Edits to CI files, lockfiles, migrations, auth or payment paths, `.env*`, Dockerfiles.
- Deleted or skipped tests (`.skip`, `xit`, `@pytest.mark.skip`) and edited snapshot files.
- An expected value in a test changed in the same turn its assertion failed.
- Commands like:
  - `rm -rf`
  - `git push --force`
  - `git reset --hard`
  - `--no-verify`
  - `curl … | sh`
  - `sudo`
  - `chmod 777`
  - package installs
- New dependencies, judged by a diff of the manifest.

Each hit shows the operation, the exact rule and the captured text that matched.

**Why pay:** a senior dev's real fear is the agent "fixing" a test by weakening it, or touching CI quietly. One glance at a tripwire list answers that.

**Wording:** say "This edit changed an expected value in a test file", never "the agent cheated". Rules are pattern matches on captured evidence and nothing more.

**Needs:**
- A pure rule engine in `packages/scene` over a projection.
- Rules stored locally (JSON in `DRISHYA_HOME`).
- A badge in the crown and a list in Briefing.
- Large recordings evaluate rules in the history worker.

**Stage:** new group **G — Guardrail review**. It covers proposals H/I from PR #2.

### 3. Review packet: the whole session as one pull-request-style diff

**What:** one screen with the net change per file across the session (first captured state to last captured state). Each hunk links to:
- the operations that produced it (agent blame)
- the reads before it
- the tests after it
- the tripwires it hit

The left column lists files with badges: +/− lines, number of edits, "rewritten 3×", "no test after last change". One button copies a deterministic Markdown summary (files, commands, test results, flags) for a real PR description. No model is needed.

**Why pay:** this turns a long session into a five-minute review. It is the screen a senior dev opens every time.

**Needs:**
- The net diff comes from captured patches only.
- Where the chain has gaps (an uncaptured edit), the hunk says **"incomplete chain"** instead of showing a made-up diff.
- Reuses the existing artifact reader and the split-diff code.

**Stage:** W5/W6.

### 4. Stuck and loop detector (live)

**What:** a factual signal while the agent works. Examples:
- "Same failing command run 4 times in 6 minutes"
- "`checkout.ts` edited 5 times this turn"
- "Edit → revert → same edit"
- "No new file touched in 30 tool calls"

It shows a quiet amber chip in the crown, and optionally a local OS notification.

**Why pay:** you catch an agent burning time or money while it is still happening, then step in yourself in your own terminal. Drishya never touches the agent.

**Needs:**
- Pure counters over the projection, with thresholds in Settings.
- Notifications use the browser Notification API locally, opt-in. No telemetry.

**Stage:** new group **L — Live supervision**.

### 5. Mission control: every live agent on one wall

**What:** a home view with one tile per live session across repos and harnesses. Each tile shows:
- state (working / idle / failing / waiting)
- the current action
- files touched
- tripwire count
- time since last activity

It also gives **conflict warnings**: two sessions editing the same file or worktree. Clicking a tile opens the normal canvas.

**Why pay:** people now run agents in parallel. This is the "air-traffic control" screen nobody else offers that is local and private.

**Needs:**
- Discovery and live tailing already exist. Needs a cheap per-session summary endpoint (worker `summary` already exists) and an SSE fan-out.
- "Waiting" is shown only when the harness journal actually records it. Otherwise "idle since 14:02".

**Stage:** L.

### 6. Turn report card

**What:** for each user prompt:
- what was asked
- how long it took
- tool calls by kind
- files changed
- test runs before and after, with outcomes
- tripwires
- whether the turn ended on a failure

A sortable table across the session, and across sessions.

**Why pay:** you learn which prompts work. It also makes the daily "what did the agents do today" review fast.

**Needs:** a pure summary from projection turns, and a view in Briefing.

**Stage:** W6.

---

## Tier 2 — the VS Code-like workspace (Yash's request, in detail)

The builder's ask: clicking a read should open a VS Code-like reader where you can read the whole code; a VS Code-like explorer should sit on the left; the zoomable graph should open the same reader. So you never leave Drishya to understand the agent's work.

### 7. The reader: an editor-grade, read-only code view

**What:** clicking any read, edit or test file opens a reader in the main area, not a modal. It has:
- **Tabs** with a retention budget (for example 8 tabs, least-recently-used eviction, closed tabs restorable).
- **Breadcrumbs** (`src › checkout › guard.ts › checkoutBlock`).
- **Line numbers, syntax colours, sticky scroll for the current function, and a minimap.** The minimap is drawn from captured lines only and can be a canvas, because it is not readable text. The real text stays DOM.
- **Evidence gutter:**
  - a blue bar where the agent read
  - a copper bar where it edited
  - a red dot on lines a captured failure names
  - a green tick where a later recorded run passed
- **Content mode banner:**
  - **Captured at step 12**
  - **Derived reconstruction**
  - **Current workspace** (W3 only, after approval)
  - **Unavailable lines 1–19**

  Gaps render as explicit "not captured" bands, never blank lines.
- **Keyboard:** `Ctrl+P` quick-open, `Ctrl+G` go to line, `Ctrl+F` find, `F8` next evidence mark, `Alt+←` back.
- **"Open in your editor"** button: a `vscode://file/…:line` or `idea://` link. It only opens the user's own editor, which is fine for observe-only.

**Why pay:** this removes the main reason to keep switching to an IDE while reviewing.

**Needs:**
- The existing artifact reader (200-line pages) and source navigation (#34–#36) are the base.
- Tabs and the gutter are UI work.
- Whole current files need W3 (separately approved root, read-only, sanitised, fingerprinted).

**Stage:** W1 → W3.

### 8. Explorer: the familiar folder tree, with agent activity

**What:** a collapsible tree on the left. It is a mode of the left panel, not a fixed sidebar. Features:
- **Activity badges** per file: `R` read, `E` edited, `T` test, `!` failure, with counts.
- **Filters:** "touched this session", "edited", "failing".
- Folders roll up their children's activity.
- Selecting a file opens the reader (7) and highlights the same file on the map.

**Motion (honest):** when the agent reads a file and that file's row is visible, the row lifts out of the tree and the content unfolds into the passage (a "Lift" from a real origin). If the row is collapsed or scrolled away, use the labelled fallback. The tree is our navigation projection; it does not mean the agent browsed folders.

**Needs:**
- Tree from the existing graph index (approved root) plus the recorded working set.
- Bounded virtualised rows.

**Stage:** W2.

### 9. Flow graph with semantic zoom

**What:** the repository map becomes the zoomable "flow":
- **far:** folder clusters with heat (where work happened)
- **mid:** files with typed links (static import / captured reference / recorded order)
- **close:** the selected file opens the reader anchored to the evidence

Plus:
- **Session path playback:** the agent's route draws across the graph as a dotted trail, in recorded order, labelled as order, not causality.
- **Fit working set**, keyboard zoom, and Escape back to reading.

**Needs:** existing `MapCanvas` plus graph index. A legend for link types is required.

**Stage:** W2.

### 10. Single-file time travel

**What:** a slider over one file's captured states, like `git log -p` for one file inside the session. Each stop shows the diff from the previous captured state and the operation that made it. Derived reconstructions are labelled.

**Why pay:** "how did this file evolve during the session" in ten seconds.

**Stage:** W5. It extends the existing comparison in FileHistory.

### 11. Symbol timeline

**What:** pick a function and see "read at step 4, edited at 9, named in failure at 12, edited at 14, test run passed at 15". Locations come from static extraction and are labelled as such. Unresolved symbols are shown as unresolved.

**Stage:** W4.

---

## Tier 3 — memory, search and handoff

### 12. Cross-session search
Questions like "every session that touched `refund.ts`", "every time `npm test` failed", or "sessions that ran migrations". Searches across all recordings in the local store, which already has FTS. Results open at the operation.

### 13. Bookmarks and notes
Pin any operation or line range with a note. Notes are clearly labelled **user-authored**. "Resume where I left off" restores the reading place. Bookmarks never mark work as seen automatically (W6).

### 14. Command ledger
Every shell command from the session in one table:
- cwd
- exit code
- duration
- captured output
- tripwire flags

"Copy as script" copies the command text only; Drishya never runs it.

### 15. Session compare
Two sessions or agents doing the same task (for example Claude vs Codex) side by side: files read, edits, test outcomes, time and tool counts. Useful for choosing which agent to trust with which kind of work.

### 16. Cost and usage, only if captured
If the harness journal records token usage, show it per turn and per session, plus "the cost of this fix". If it is not recorded, show nothing. Never estimate it silently.

### 17. Commit and PR links
If a captured command made a commit or opened a PR (`git commit`, `gh pr create`), link that operation to the commit hash or PR URL found in the captured output.

### 18. Capture completeness meter
A small indicator per session: share of operations with captured results, visible gaps, redaction count. It tells the reviewer how complete the evidence on screen is. It builds trust because it admits limits.

---

## Polish that makes it feel like a $1,000 tool

- **Command palette (`Ctrl+K`)** for everything: open a file, jump to a turn, filter by tool, switch theme, toggle map.
- **Keyboard-first everywhere**, with a `?` cheat-sheet overlay.
- **Density setting:** comfortable / compact. Senior devs want compact.
- **Activity timeline** at the bottom (edits, failures, passes as ticks; click to jump). *This pass adds a first version.*
- **Theme set:** Jet (matte black and champagne gold, signature), Midnight, Light. Each tuned for syntax contrast, not just background colour. *This pass adds Jet and Midnight.*
- **Instant open:** the last session opens straight to where you stopped.
- **Quiet notifications:** one sound or OS toast only for the events you chose (failure, stuck, tripwire, turn finished).

---

## Considered and rejected (they break a rule)

| Idea | Why not |
|---|---|
| "Approve / reject this change" buttons that talk to the agent | Drishya would control the harness. Observe only. |
| Re-run a test from Drishya | Executes commands. Copy the command instead. |
| Auto-fix or "ask the AI why it failed" by default | An unattended cloud call. Explanations stay optional, previewed and user-triggered. |
| A "safe to merge" badge | Implies coverage and certainty that the capture cannot prove. Use tripwires plus verification freshness wording. |
| Live LSP diagnostics shown as if the agent saw them | Invents evidence. Only captured diagnostics, labelled. |
| Cloud sync of sessions across machines | Sends private code off the machine. Export bundles stay manual and sanitised. |

## Suggested order after the baseline

1. **Reader tabs + evidence gutter (7)** and **explorer (8)**: the builder's direct ask, and the base for everything else.
2. **Tripwires (2)** and **stuck detector (4)**: the biggest jump in trust per line of code; mostly pure functions plus small UI.
3. **Review packet (3)** with **agent blame (1)**: the screen people will pay for.
4. **Mission control (5)** and **turn report card (6)**.
5. Flow graph semantic zoom (9), time travel (10), then tier 3.

Each needs its own claim in STATUS, tests written failing first, and the local checks in [CI_POLICY](../CI_POLICY.md) before merging.
