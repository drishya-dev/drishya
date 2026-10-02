# Opus 5.5 — suggested changes and approach

**A revised plan for Drishya, written in plain language.**

2 October 2026 · Written by Claude Opus 5.5 after reading every document in `docs/`.

> **Status: a proposal, not a decision.** Nothing here changes the plan until both builders agree. Once you agree on a point, write it into the decisions log in [`STATUS.md`](STATUS.md). The [non-negotiable rules in `AGENTS.md`](../AGENTS.md#non-negotiable-constraints) still apply to everything below.

---

## The short version

Build the **"why did the AI write this?"** tool first. Make it beautiful second.

Today the plan is mostly about how Drishya looks while an agent is working. But people rarely watch their agent. They start it, do something else, and come back to check the result. **Checking the result** is the moment Drishya should own.

---

## 1. What Drishya is, in one paragraph

When an AI coding agent like Claude Code or Codex works on your project, it reads files, runs commands, edits code and runs tests. All of this is saved in log files on your computer that nobody opens. Most people only look at the final changed code, so they never learn *why* it changed. Drishya reads those logs and shows the work clearly: what the agent read, what it ran, what it changed, what failed, and what it said. Everything stays on your computer.

---

## 2. The big change: from "watching" to "checking"

| | Old focus | New focus |
|---|---|---|
| **Main moment** | While the agent is working (live) | After the agent is done (review) |
| **Main question** | "What is the agent doing right now?" | "Why is this line here, and should I trust it?" |
| **Where the user starts** | At the beginning of the session, moving forward in time | At the changed code, going back to the evidence |
| **What gets the most effort** | Animations, the map, the live canvas | Linking changed lines to evidence, warning flags, a review checklist |
| **Role of the visuals** | The main product | A layer that makes reviewing faster and nicer |

**Why:** Our own product review says live watching attracts people and reviewing keeps them. People have to check AI code every time. They don't have to watch it. A tool used for a must-do task gets opened every day.

**A simple picture:** we were building a beautiful live stream of a chef cooking. Most people never watch the stream. They come home, taste the food, and ask "why is this so salty?" Drishya should answer that question instantly.

---

## 3. What stays exactly the same

These were already right. Keep them.

- **Only watch, never control.** Drishya never sends prompts, approves actions or starts agents.
- **Everything stays on your computer.** No accounts, no cloud, no tracking of any kind.
- **Be honest about what we know.** Recorded facts and our own guesses always look different. Missing information is shown, never hidden. "Happened right after" never becomes "happened because of".
- **Remove secrets before saving anything.** No real session is imported until this works.
- **Replay first, live later.**
- **The clean look.** Dark graphite theme, simple surfaces, colour only where it means something ([`VISION.md` §5](VISION.md#5-theme-a-clean-developer-tool)).
- **The five signature moves** (Lift, Emit, Settle, Surface, Resolve). They are now used mainly for review, see §6.

---

## 4. The main features, in order of importance

### Feature 1 — "Why is this line here?" (the heart of the product)

Click any changed line, or type `drishya why src/checkout.ts:42`, and see:

1. **The moment the agent wrote it**: the exact edit, before and after.
2. **What the agent looked at just before**: the file it read, the search it ran.
3. **The tests around it**: the test result before the change and after.
4. **What the agent said** about it, if it said anything.

Think of it as `git blame` for AI agents.

**How it works, simply:** Claude Code's logs record each edit with the file, the old text and the new text. We compare those edits against the final changed code (the git diff) to find which edit produced each line.

**Honesty rule:** if a line wasn't written by any recorded agent edit (for example, you typed it yourself, or a shell command changed the file), we say so plainly: *"This line was not written by a recorded agent edit."* We never guess.

### Feature 2 — Warning flags ("look here first")

Simple automatic checks that point at the risky parts:

| Flag | What it means |
|---|---|
| **Edited without reading** | The agent changed a file it never opened in this session |
| **Untested change** | The code changed after the last passing test |
| **Tests changed** | Test files were edited, tests deleted, or tests skipped (`.skip`, `xit`, `@pytest.mark.skip`) |
| **Sensitive files** | Config, `.env`, CI files, lockfiles or dependency lists changed |
| **Risky commands** | Commands like `rm -rf`, `git push --force`, `git reset --hard`, `--no-verify` |
| **Outside the ask** | Work happened in folders you didn't mention, worded as "outside the area you named", never "wrong" |
| **Big deletion** | A large amount of code was removed |

**Important:** these are plain rules, **not AI guesses**, so they are always honest and explainable. Each flag says exactly why it appeared and links to the evidence. A flag means "look here", not "this is a bug". **No flag doesn't mean "safe"**: it only means none of these rules matched in what was recorded.

### Feature 3 — Review checklist

A simple list of every change, one by one. Each item shows its evidence and its flags. You tick **Reviewed** when you're happy. It turns "check the AI's work" from a vague job into a clear list that gets finished.

"Opened" and "reviewed" are different. Only your tick counts as reviewed.

### Feature 4 — "While you were away"

When you come back to a session, Drishya shows what happened since you last looked: files changed, tests that failed, flags raised, and anything not yet reviewed. Each item opens its evidence. This is the "return briefing" from [the product review §6.2](review/01-product-review.md#62-return-briefing--the-habit), now a front-line feature.

### Feature 5 — Share a replay with a pull request

When someone reviews a pull request that *your* agent wrote, they have the biggest "why?" problem of anyone, because they weren't there. Let them open a replay of the relevant changes, with secrets removed and private parts excluded. Every shared replay also introduces a new person to Drishya.

Exporting is always an explicit action the user takes, never automatic.

### Feature 6 — The full replay canvas (the visual layer)

The continuous canvas from [`VISION.md`](VISION.md) still gets built: agents at the top, work flowing left to right, the agent's words below, the map behind. But it comes **after** features 1–4 work, and the first animations go where they help reviewing:

- You click a changed line → its evidence **lifts** out of the right file on the map.
- A test outcome **resolves** once, clearly.
- Earlier evidence **settles** back so you keep your place.

These animations carry real information. Pure decoration waits.

---

## 5. Connecting agent sessions to git

**New. This was missing from the old plan.**

Real work is messy: several agent sessions for one feature, your own edits in between, then commits and pull requests. Drishya has to connect them:

- **One commit or pull request → the sessions that contributed to it.**
- **Each changed line → the edit that produced it**, or an honest "unknown".
- **Several sessions on one branch** shown together, in order.

Without this, "why is this line here?" only works for a single session and breaks on real projects.

---

## 6. What we postpone (not cancel)

| Postponed | Why | Bring it back when |
|---|---|---|
| **Live view** | People rarely watch; review is the daily job | Review features work and users ask for live |
| **Custom code-analysis engine built from scratch** | Months of work for two people | Existing tools are proven too slow or wrong for our needs |
| **GPU map renderer (PixiJS)** | Big effort; the prototype already works with a simple canvas | A measured performance test shows the simple canvas is too slow |
| **Codex support** | Get one agent working really well first | Claude Code review loop is solid. Still keep a *small* Codex sample early to check our data design isn't Claude-only |
| **"Pipeline / blast radius" analysis** | Hard to get right, easy to get misleading | The basic map is proven useful |
| **Multi-agent collision view** | Rare situation today | Users actually run agents side by side on one folder |
| **Cursor, OpenCode, Gemini CLI** | Breadth before depth is a trap | Two agents work well and users request more |

---

## 7. Simpler technology choices

Reverse the **"nothing is reused, build everything from scratch"** decision. Use good existing tools first and only replace them when we have a measured reason.

| Job | Old plan | New suggestion |
|---|---|---|
| Finding which files import which | Our own Tree-sitter engine with custom import resolution | The **TypeScript compiler's own resolver**, or **dependency-cruiser / madge**. Python later, the same way |
| Drawing the map | PixiJS (GPU) | **Canvas 2D or SVG**, like the prototype |
| Background service | Full daemon with API, WebSocket, worker threads | **Start as a simple CLI command that imports a session and opens the viewer.** Grow it into a daemon when live mode arrives |
| Storage | SQLite + separate blob store | **SQLite to start**, with the blob store kept simple |
| Showing code and diffs | CodeMirror 6 | Keep, it's a good choice |
| Screen framework | React + Vite + TypeScript | Keep |

The rule: **every big custom piece must earn its place with a measurement**, not a guess.

---

## 8. Build plan, step by step

No dates. Each step is done when its **"done when"** check passes. Don't start the next step until then.

### Step 0 — Clean up and agree (short)

- Both builders read this document and agree or disagree with each point.
- Record the decisions in [`STATUS.md`](STATUS.md).
- **Stop writing new planning docs** until Step 3 is done. Update existing ones only.
- Agree on the minimum data shape: what a "recorded edit", "read", "command" and "test result" look like. Keep it small.

**Done when:** decisions are logged, and the data shape is written down and agreed.

### Step 1 — Read Claude Code logs safely

- Read a Claude Code session file from disk (read-only, never change it).
- **Remove secrets before saving anything** (API keys, tokens, passwords, `.env` values).
- Save the cleaned events.
- Use made-up sample sessions until secret removal works. Real sessions come after.

**Done when:** a planted fake secret never appears anywhere we save (database, files, search, screen), and the same session imported twice gives the same result.

### Step 2 — "Why is this line here?"

- Match each changed line in the git diff to the agent edit that produced it.
- Show unmatched lines honestly ("not written by a recorded agent edit").
- Show the reads and tests just before and after each edit.
- Start with a plain screen: list of changes on the left, evidence on the right.

**Done when:** on 5 real sessions, picking any changed line shows the correct edit and its evidence, or a clear "unknown". Hand-check the results.

### Step 3 — Warning flags and review checklist

- Add the flags from Feature 2, each with its reason and evidence link.
- Add the checklist with a **Reviewed** tick that's saved locally.
- Add "While you were away".

**Done when:** each flag fires correctly on test sessions built to trigger it, and doesn't fire on sessions that shouldn't trigger it. The checklist remembers its state after a restart.

### Step 4 — Try it with real developers

- Find 5–10 developers who use AI agents several times a week **and already review the results**.
- Let them use Drishya on **their own** sessions (on their machine; their code never leaves it).
- Watch, don't explain. Ask: did it save you time? Did you understand the change better? Did anything confuse or mislead you?

**Done when:** you have notes from every session and an honest answer to "does this help?". If it doesn't help, fix the core before adding visuals.

### Step 5 — Connect sessions to git

- Link commits and pull requests to the sessions that produced them.
- Handle several sessions per branch.
- Keep showing your own manual edits as "not from an agent".

**Done when:** for a branch built over several sessions with manual edits in between, every changed line is correctly linked or honestly marked unknown.

### Step 6 — The visual layer

- Bring in the continuous canvas from the [prototype](prototype/), now with real data.
- First animations: Lift (evidence comes from its file on the map), Resolve (test outcome), Settle (keep your place).
- Add the repo map using existing import tools (§7).
- Reduced-motion and map-off modes must keep all the information.

**Done when:** the three tests from [`VISION.md` §8](VISION.md#8-the-standard) pass (freeze, truth, ten-minute), and testers answer review questions at least as well as without the visuals.

### Step 7 — Make it easy to use where people already work

- `drishya why <file>:<line>` from the terminal.
- A small VS Code extension: a "Why?" link above changed code that opens Drishya.
- Exported replay bundles that a reviewer can open from a pull request.

**Done when:** a teammate who wasn't there can open a shared replay and explain a change without asking the original developer.

### Step 8 — Then expand

Only after the steps above work well:
- Live view
- Full Codex support
- Better map analysis
- More agents

---

## 9. How we'll know it's working

Not stars or downloads. These:

| Question | How we check |
|---|---|
| Does it make reviewing faster? | Time how long it takes testers to correctly explain a change, with and without Drishya |
| Does it make understanding more accurate? | Check that answers are correct, not just faster. Feeling confident while being wrong counts as a failure |
| Do people notice missing information? | At least 8 in 10 testers should spot when something wasn't recorded |
| Do people come back? | Testers return on their own on at least 3 different days over two weeks |
| Would they miss it? | Ask: "If Drishya disappeared tomorrow, what would you do instead?" |

These match the go/no-go rules already in [the product review §9](review/01-product-review.md#9-research-plan-and-go-no-go-rules). They just need to actually be run.

---

## 10. Risks, simply

| Risk | What could happen | What we do |
|---|---|---|
| **Too much planning, too little building** | Months of docs, nothing to show | Docs freeze until Step 3 is done |
| **Pretty but not used** | People enjoy it once, then go back to the plain diff | Build review features first; test with real users at Step 4 |
| **Agent log formats change** | An update breaks importing | Support specific versions, show a clear message for unsupported ones, keep sample files for testing |
| **A secret gets saved** | Serious, can't be undone | Secret removal before any real data; tests that plant fake secrets |
| **Wrong line matching** | We blame the wrong edit, which breaks trust | When unsure, say "unknown". A wrong answer is worse than no answer |
| **Big companies copy it** | Claude Code or Codex add their own replay | Win on trust (honest, local, private), a strong review workflow, and working across agents |
| **Agents say very little** | "Thinking" is often hidden or short, so the prose layer is thin | Design for little or no agent text; the evidence (reads, edits, tests) carries the story |

---

## 11. Decisions for both builders to make

1. Do we agree to switch focus from watching to checking?
2. Do we reverse "nothing is reused" and use existing tools for imports and the map?
3. Do we postpone live view and full Codex support until after Step 5?
4. Do we freeze new planning docs until Step 3 is done?
5. Is the warning-flag list in Feature 2 right? What should be added or removed?
6. Who are the first 5–10 testers, and how do we reach them?

Record each answer in the decisions log in [`STATUS.md`](STATUS.md), with the reason.

---

## Words used in this document

| Word | Meaning |
|---|---|
| **Agent** | An AI that writes code for you, like Claude Code or Codex |
| **Session** | One run of an agent, from your request to its final answer |
| **Log / transcript** | The file where the agent's actions are recorded |
| **Diff** | The before-and-after of changed code |
| **Evidence** | Recorded facts: what the agent actually read, ran, changed and said |
| **Replay** | Going back through a finished session, like rewinding a video |
| **Flag** | An automatic "look here" marker based on a simple rule |
| **Redaction** | Removing secrets like passwords and API keys before saving |
| **Map** | A picture of your project's files and how they connect |
