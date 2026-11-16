# Drishya

**दृश्य** — *"that which is seen."* A local, cross-harness replay and live view for coding agents. It plays an agent's work as real captured content — the source it read, the output it got, the diff it wrote — on a map of the user's own repository, on a timeline they can scrub.

Two maintainers and the contributors who join them work with coding agents (Claude Code, Codex and Antigravity). **This file is the canonical instruction set for every agent in this repo.** Codex reads it directly; Claude Code loads it through `CLAUDE.md`. Change the rules here, nowhere else.

---

## North star — read first, every session

**Why Drishya exists.** With agents, the developer prompts and looks away, and only the agent "knows" the change. Drishya makes the developer understand the work **while it happens**: what the agent read, ran, saw fail and edited, shown as the real material, at the moment it happens, beside their repository. The result is that the developer understands the codebase too, instead of blindly vibe-coding.

**What it is (Yash, 11 Nov: from agent visualization to helping developers work).** A place where a developer works in a codebase that agents work in. The live and replayed *visualization* of agent work stays at the centre, and around it the *developer tools* for the whole job: the Files tree and peek with each file's earlier changes, Workspace, Git review, Compare for branches and pull requests, the Git graph, search and review. When planning, writing posts or judging a feature, think developer-first: does it help a developer understand and work in their codebase? Agent evidence is what makes each tool better than an IDE's (who changed this file and why, what the agent read before editing it), so use it wherever it adds something. It is still not a generic IDE or Git client: a tool earns its place by helping that work, not by copying an IDE feature for completeness.

**How it must feel.** Minimal and calm. Visualization first; no labelled boxes; every interaction has purposeful motion; no resident clutter. A surface whose buttons take more space than its content is a bug.

**What the data allows.** Show everything the harness records, faithfully. Harnesses mostly no longer record reasoning ([123](docs/review/123-harness-data-audit.md)), so the *why* may only come from opt-in, clearly labelled, evidence-cited model output. That output is never presented as the agent's thoughts.

**Before changing UI, verify the current behaviour in the running app.** Several "odd" things are deliberate builder decisions:
- toolbox connectors appear on hover;
- passages wrap with arrows;
- peek and Workspace are two modes;
- the 3D map is aesthetic.

Use [GitHub Issues](https://github.com/drishya-dev/drishya/issues) for current work. Check related issues, pull requests, and [Product Work History](docs/PRODUCT_WORK_HISTORY.md) before starting so earlier experiments and overlapping work are visible.

---

## Read before doing work

| File | What it is | When |
|---|---|---|
| [`docs/VISION.md`](docs/VISION.md) | **Creative direction** — the builder's own words and how the product must look, move and feel | Before *any* UI, graphics, motion or layout work |
| [`docs/README.md`](docs/README.md) | **Precedence map** — which document wins on which topic | Whenever two docs seem to disagree |
| [`docs/PRODUCT_WORK_HISTORY.md`](docs/PRODUCT_WORK_HISTORY.md) | Dated task entries, experiments, findings, and prior decisions | Before proposing work that may have been tried before |
| [`ROADMAP.md`](ROADMAP.md) | What is planned: the next release, harnesses being explored | Before choosing what to work on |
| [`docs/decisions/log.md`](docs/decisions/log.md) | Every standing decision with its reason | Before changing capture, privacy, the schema or the interface's direction |
| [`docs/CODEBASE.md`](docs/CODEBASE.md) | The code as built: packages, data flow, identity, privacy, API, tests, how to add a harness | Before changing any code |
| [`docs/review/03-engineering-plan.md`](docs/review/03-engineering-plan.md) | Authoritative architecture: observations, projections, historical artifacts, capture, privacy | Before capture, store, daemon or API work |
| [`docs/reference/04-continuous-canvas.md`](docs/reference/04-continuous-canvas.md) | The layout and interaction contract, with acceptance criteria | Before canvas, history or playback work |
| [`docs/reference/03-event-schema.md`](docs/reference/03-event-schema.md) | The event schema — **draft, not frozen** | Any adapter or store work |
| [`docs/review/04-research-ledger.md`](docs/review/04-research-ledger.md) | Verified facts about harnesses and competitors | Before making any factual claim about a harness |

The original blueprint, the first brief and the early product and roadmap documents are summarised in the [review notes](docs/PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#planning-documents); the decisions log and the documents above supersede them.

---

## Creative doctrine — hold this always

The builder's defining requirement: **"Visualization is the main."** Not boxes of `model thinking:` / `tool call:` / `output:`. A $1,000 edit, not a $10 one. Full detail in [`docs/VISION.md`](docs/VISION.md).

1. **Quiet at rest, articulate in motion.** At rest the screen is calm and every frame is readable. In motion, every change is precise and meaningful. Nothing loops, pulses or drifts for attention. The latest 8 October builder correction permits a true spatial map with gentle default rotation, holding the camera for 12 seconds after manual movement before resuming; disable automatic rotation for hidden tabs, reduced motion and low resources, and preserve explicit static preferences. See [37](docs/PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#37-spatial-map-composer), which supersedes the shallow/static direction in 36.
2. **Motion is spent on relationships and arrivals, never on simulating the reading task.** Content is mounted whole and selectable. Following the builder's 7 October clarification, a finite arrival/reflow may translate and scale the single real DOM material continuously into its final allocation. This is the narrow exception requested in the latest builder correction; never copy captured characters, type text, count up numbers or fake scanning. The later correction in [30](docs/PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#30-builder-request-audit) also permits the same whole-material zoom for deliberate hover reading; no duplicate captured text. The latest correction removes separately timed SVG plate/glyph arrivals; use one real material transform. See docs/review/28-unified-stage.md.
3. **Everything has one home.** Files come *from the map*. Tool calls come *from the dock*. Words come *from the agent*. Motion always starts at the true origin.
4. **The composition:** agents across the top · the living repository map behind everything, interactive · tool actions arriving **left to right** in passages · the agent's prose **beneath, unboxed, directly on the world** · history continuing downward · native tools then MCP servers on the **right** · reading position at the bottom. Live history accumulates while the user scrolls back; transport belongs to optional sequence replay.
5. **Work accumulates.** Earlier operations settle back and overlap only at their margins, titles and excerpts still readable. Nothing vanishes; selection opens reading space and detaches live follow. Capture/history continue; optional sequence playback holds.
6. **Clean developer-tool theme, no *labelled* boxes.** Graphite base, flat surfaces with 1 px hairlines, one sans + one mono, GitHub-dark syntax, colour only for meaning (agent identity, pass, fail, edited). No glow pools, grain or serif. The latest explicit builder correction permits bounded masked backdrop blur only at the header/composer edges, with a low-resource fallback; see [30](docs/PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#30-builder-request-audit). The latest builder correction in [29](docs/PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#29-centred-neutral-workspace) uses shared neutral action surfaces/borders, coloured type icons and error-only thin red contours; it supersedes earlier per-tool coloured chrome. The 7 October builder correction permits a subtle static CSS charcoal lining texture on the black workspace; see `docs/review/25-black-compact-map.md`. Prose is never boxed. Each action type still has its own content-shaped composition. The latest 7 October correction asks for vivid semantic material/syntax colours, compact preview chrome and a centred fading translucent header (now bounded edge veils under the later correction in 30). See `docs/review/28-unified-stage.md` and `docs/VISION.md` §5.
7. **The five signature moves:** **Lift** (content unfolds from its map node) · **Emit** (a tool call leaves its dock instrument; MCP servers open like drawers) · **Settle** (prior work eases back) · **Surface** (prose rises beneath the passage with a focus-pull, never typed) · **Resolve** (an outcome lands once and holds).
8. **Every little thing is crafted** — hovers, selection, copy, focus rings, scrubbing — and every one is reversible and interruptible.
9. **Three tests before anything ships:** *freeze* (any paused frame is readable, origins clear) · *truth* (no motion implies what the evidence cannot support) · *ten-minute* (still calm after ten minutes of real reading).
10. **Clean and premium in the smallest things (builder, 29 Oct).** Even the smallest detail (alignment, spacing, truncation, empty and failure states, labels that say what they are) looks clean and premium; information reaches the user with ease, not item by item. Target: a $10,000 end-to-end product for millions of people who today only read an agent's text. Binding on every UI change and every pass: [`docs/VISION.md`](docs/VISION.md) §8, *The premium bar*.

If an animation carries no information about where something came from, what it connects to, or what changed — cut it.

---

## Scope: desktop only

Drishya runs on a laptop or PC against local sessions; it is not a cloud or mobile product. **Do not design, fix, measure or write tests for phone widths, landscape phones or touch input.** The narrowest supported window is 600 px (a half-width laptop window); do not open items for anything smaller. Builder decision, 26 October.

---

## Verify on real sessions, not only the demo

The demo and the synthetic fixtures have one shape. Real sessions bring cases they never do: images arrive as a user prompt attachment, as an agent tool's result (Read, a screenshot, a browser or MCP tool), as a file a shell command wrote, or as a path with no bytes; plans, questions and approvals take different forms per harness; outputs can be huge, encrypted or missing; sub-agents, gaps and very large diffs appear. **Before a change that affects what a card, reader, header, list or projection shows is called done**, check it against real local sessions of both harnesses (Claude Code and Codex), picking sessions that actually contain the case, **plus** the fixture. Record what was checked as session id prefixes, sizes and counts only. Screenshots of real sessions stay in `.local/` (never committed, quoted or sent anywhere), and real journal content is never printed. In the PR, say which real sessions and which cases were checked and what could not be: if no real session contains the case, say so and do not claim it. A change checked only on the demo is *demo-checked*, not done. Builder decision, 26 October.

## Definition of done — whole tasks, proven on real sessions

Maintainers' decision, 28 October. This is the main rule for every agent, Codex and Claude alike. It replaces "slice", "foundation" and "ready for review with leftovers".

1. **Review against the agreed acceptance criteria.** A substantive change must have a bounded scope and a way to verify it. Use a draft PR while work is in progress. When you request review, record the checks and any acceptance criteria blocked by an external dependency.
2. **The demo is not a test.** The demo bundle and synthetic fixtures are regression guards; they never count as acceptance. Acceptance is on real local sessions of both harnesses: find sessions that contain each case (count them; id prefixes and sizes only), import them into a scratch Drishya home, and check the counts and the screen at 600 and 1440 px. **If no real session contains the case, make one.** Run the real harness (Claude Code, Codex) until it records the case (plan mode, a question, a literal `git commit -- path`, a browser call, an image-only prompt, a sub-agent) on a throwaway repository, then check that genuine capture. This is how CONTENT-4b's plan mode and GIT-2's commit link were verified. Say in the PR which cases, which session prefixes and what could not be run (a harness or account you do not have).
3. **Checks come in three tiers; the full gate runs once per finished task or batch, never per slice.**
   - *While working:* typecheck of the touched projects, units of the touched packages, the named specs for the area. Seconds to minutes; run them as often as you like.
   - *When the task is done:* all of its acceptance, the real-session checks above, the targeted browser specs, and `package:verify` if ingest, store or packaging changed.
   - *Full gate* (typecheck, all units, `ui:build`, full browser suite, `package:verify`): once per batch of finished tasks, in an isolated worktree with its own install, in the background while others keep working; always rebuild the UI first. A failure that reproduces on clean main is a TEST-2 flake: record it, re-run it alone, do not block on it. Never run the full gate for drafts, partial work or docs-only changes.
4. **Do not stop at the first green.** Before calling an item done, read its *Accept* list line by line and check each line on a real session. Finishing fast means finishing once.
5. **Use the commands.** `pnpm check:affected` (typecheck, related units, the specs that name your changed files; seconds to a few minutes), `pnpm check:real -- <case>` (real-session scan, import and counts; `--list` shows the cases; add one in `scripts/real-cases/` when your feature needs a case that is not there), and `pnpm test:browser` (the full browser suite defaults to 4 workers plus a serial pass for six timing-sensitive specs; set `DRISHYA_WORKERS` for a measured local configuration). Do not run or print journal content, and never import into your real Drishya home: `check:real` uses a scratch home.

   **Measured Windows gate, 5 November (TEST-2 #331):** `DRISHYA_WORKERS=3` plus the existing one-worker serial pass, frozen 6009c09, three consecutive complete commands each **654 passed / 28 existing skips / zero failures/retries** (810.10 / 765.74 / 745.42 seconds), UI rebuilt each time and failure tracing enabled. The default remains four workers; this certifies only the measured three-worker configuration, not a four-worker streak. Record the actual worker count when reporting a gate. See [the full record](docs/review/test-2-live-anchor.md).

---

## Non-negotiable constraints

Violating any of these is a bug, not a tradeoff.

1. **Passive observation stays independent.** On 7 October the builder explicitly requested a real prompt input, superseding the earlier observe-only product boundary. An opt-in controller may resume a selected local native session, send an explicitly submitted prompt, interrupt its own turn and answer an exact one-time approval through supported harness protocols. It must never attach to arbitrary terminals, weaken sandbox/approval policy, run shell-interpolated prompts, or steer from observer hooks. Workspace consent and an idle-other-clients acknowledgement are mandatory; unsupported requests fail explicitly. Offline bundles remain read-only. See `docs/review/26-connected-workspace.md`.
2. **Never directly mutate harness files.** Observer/controller code opens harness journals read-only; copy what is needed into our own store. An explicitly resumed native harness owns its normal journal writes. Drishya never fabricates journal events, edits native configuration or credentials, or edits project files itself.
3. **Redact before persisting.** Secrets are scrubbed in the ingest path — before SQLite, the blob store, previews, search indexes, exports and the screen. Never after. **No real recording is imported before redaction exists.**
4. **Captured ≠ derived.** Every rendered string carries provenance. Never present a heuristic or model-generated summary as if the agent said it.
5. **Never invent a location or causal link.** Use evidence-backed mappings and typed relationships. Temporal proximity is "nearby activity", never "reason". Unresolved locations stay explicitly unresolved.
6. **The composer is a pure function.** No wall-clock reads inside it; time is injected. Determinism cannot be retrofitted and golden tests depend on it.
7. **Everything is interruptible.** Deliberate navigation, selection and reading stop viewport following. The latest builder correction keeps an explicitly playing replay clock advancing during hover/scroll/reading; only explicit transport pause/seek, leaving replay, completion or failure stops it. See docs/review/31-independent-replay-reading.md. Capture and live history continue independently. Scrolling inside a scrollable action result is local and does not detach live follow; main-history scrolling still does. The 8 October correction keeps live/replay camera following active across bursts and late results, with an explicit Follow switch; see docs/review/33-smooth-follow-map.md. Pointer movement alone does not. Nobody waits for a transition.
8. **Text is never rendered in WebGL.** The GPU draws the map; the DOM draws every character.
9. **No telemetry. None.** No opt-out, because there is nothing to opt out of.
10. **Capture must not depend on presentation.** Prefer passive observation and measure overhead. HTTP hooks are *not* automatically asynchronous. Never block an agent on rendering, and never return control or context instructions from an observer hook.

---

## Stack

**Built (draft backend):** TypeScript run directly on Node 24 (type stripping, no backend build; erasable syntax only) · pnpm workspaces · `node:sqlite` (WAL, FTS5) · `node:http` + Server-Sent Events · React 19 · Vite · Zustand · Vitest. The daemon has **zero runtime dependencies**.

**Still to come (frontend and indexer):** PixiJS v8 map · CodeMirror 6 · `web-tree-sitter` import extraction · graphology for bounded working sets · Motion/CSS choreography · Playwright. The deviations from the original proposal (`better-sqlite3`, Fastify, `ws`) and their reasons are in [`docs/CODEBASE.md`](docs/CODEBASE.md#deliberate-deviations-from-the-proposed-stack-see-the-decisions-log) and the STATUS decisions log.

Rationale and rejected alternatives: [engineering plan §1](docs/review/03-engineering-plan.md#1-application-form-and-stack), [blueprint §14](docs/PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#blueprint). If you think a choice is wrong, say so — but read the rejection first.

---

## How we work

1. **Start from an issue for substantive work.** Describe the problem, scope, and acceptance criteria. Check related issues, PRs and prior experiments. Coordinate overlapping changes in the issue. Small documentation fixes can go straight to a PR.
2. **Open a focused PR into `main`.** Link the issue when one exists. Explain what changed and record how you verified each acceptance criterion. Use a draft for work in progress. Keep unrelated changes in separate PRs.
3. **Review before merge.** A maintainer checks the linked scope, evidence and relevant project constraints. Record any external blocker in the PR. Squash-merge with a title in the form `area: what changed`. CODEOWNERS routes review.
4. **Record durable decisions.** Keep the rationale in the relevant architecture or contributor docs, link it from the issue or PR, and add experiment findings to Product Work History when they can prevent repeated work.

Label PRs by area. Changes to the event schema use `schema`. Use `decision` for work awaiting a recorded decision.

**Rules of the codebase**
- **UI work uses the installed design skills.** Apply `emil-design-eng` for interface composition and polish, and the relevant animation/review skill when changing motion. Preserve this repo's evidence/creative doctrine when generic skill guidance conflicts. Commit each coherent, verified increment separately so the builders can backtrack; do not combine unrelated UI tasks into one commit. Builder direction, 12 October.
- **The event schema changes only by agreement between both builders.** It is the seam between capture and rendering.
- **Golden tests from the first composer commit.**
- **No new feature while a performance gate is red unless a maintainer records a narrower supported range.** Physical low-resource, lower-core and platform acceptance remain release checks. Preserve the paged projection and data-source boundary. See the [history reader record](docs/review/08-b4-history-reader.md) and [implementation roadmap summary](docs/PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#implementation-roadmap).
- **Never share `node_modules` between checkouts or worktrees** (no junction, symlink or copy); each runs its own `corepack pnpm install --frozen-lockfile`. Shared links made `@drishya/*` resolve to another tree and broke verification, 27 October.
- **Fixtures decouple the work.** If rendering is blocked on capture, the fixture corpus is too small — grow it. Only synthetic or redacted fixtures are committed; `.gitignore` refuses `*.jsonl` outside `fixtures/redacted/`.

**Commits by agents** end with a `Co-Authored-By:` trailer naming the agent, so the history shows who wrote what.

---

## Durability — read this once

**Chat history is not project memory.** It does not survive a folder rename, a desktop-app account switch, or the 30-day retention sweep of `~/.claude/projects/`. **This repository does.**

If something learned in a session would be expensive to lose — a decision, a design insight, a gotcha — **write it into `docs/` before the session ends.** Creative direction goes in `docs/VISION.md`; decisions in `docs/decisions/log.md`; architecture in the engineering plan. The next agent, on any contributor's machine, reads them in minutes and is fully caught up.


## Style

Match the surrounding code. Prefer clarity over cleverness — especially in the indexer, the projection reducer and the scene composer, where subtle bugs are most expensive and hardest to see. Comment *why*, not *what*, and only where the reason is not obvious from the code.
