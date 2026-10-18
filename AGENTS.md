# Drishya

**दृश्य** — *"that which is seen."* A local, cross-harness replay and live view for coding agents. It plays an agent's work as real captured content — the source it read, the output it got, the diff it wrote — on a map of the user's own repository, on a timeline they can scrub.

Two builders, both working with coding agents (Claude Code and Codex). **This file is the canonical instruction set for every agent in this repo.** Codex reads it directly; Claude Code loads it through `CLAUDE.md`. Change the rules here, nowhere else.

---

## Read before doing work

| File | What it is | When |
|---|---|---|
| [`docs/VISION.md`](docs/VISION.md) | **Creative direction** — the builder's own words and how the product must look, move and feel | Before *any* UI, graphics, motion or layout work |
| [`docs/README.md`](docs/README.md) | **Precedence map** — which document wins on which topic | Whenever two docs seem to disagree |
| [`docs/TASKS.md`](docs/TASKS.md) | **Single current product checklist** — tick completed scope and add new feedback here; do not create competing active queues | At session start and whenever work lands |
| [`docs/STATUS.md`](docs/STATUS.md) | Where we are, what is next, who did what, decisions log | At the start of every session |
| [`docs/CONTINUITY.md`](docs/CONTINUITY.md) | Compact handoff: latest builder direction, baseline findings and next bounded task | After a model/chat switch or compaction |
| [`docs/PRODUCT_DIRECTION.md`](docs/PRODUCT_DIRECTION.md) | Current product scope, live-history behavior, content-shaped presentation and validation hypotheses | Before product or experience decisions |
| [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) | Backend-first execution gates, integrated base UI, performance and deployment | Before choosing implementation work |
| [`docs/CODEBASE.md`](docs/CODEBASE.md) | The code as built: packages, data flow, identity, privacy, API, tests, how to add a harness | Before changing any code |
| [`docs/review/03-engineering-plan.md`](docs/review/03-engineering-plan.md) | Authoritative architecture: observations, projections, historical artifacts, capture, privacy | Before capture, store, daemon or API work |
| [`docs/reference/04-continuous-canvas.md`](docs/reference/04-continuous-canvas.md) | The layout and interaction contract, with acceptance criteria | Before canvas, history or playback work |
| [`docs/reference/03-event-schema.md`](docs/reference/03-event-schema.md) | The event schema — **draft, not frozen** | Any adapter or store work |
| [`docs/review/04-research-ledger.md`](docs/review/04-research-ledger.md) | Verified facts about harnesses and competitors | Before making any factual claim about a harness |

`docs/BLUEPRINT.md` is the original end-to-end blueprint and is still the fullest single account, but the review and later decisions supersede parts of it — [`docs/README.md`](docs/README.md) maps exactly which. `docs/Vantage_Base_Prompt.md` is the original brief, kept for provenance only.

---

## Creative doctrine — hold this always

The builder's defining requirement: **"Visualization is the main."** Not boxes of `model thinking:` / `tool call:` / `output:`. A $1,000 edit, not a $10 one. Full detail in [`docs/VISION.md`](docs/VISION.md).

1. **Quiet at rest, articulate in motion.** At rest the screen is calm and every frame is readable. In motion, every change is precise and meaningful. Nothing loops, pulses or drifts for attention. The latest 8 October builder correction permits a true spatial map with gentle default rotation, holding the camera for 12 seconds after manual movement before resuming; disable automatic rotation for hidden tabs, reduced motion and low resources, and preserve explicit static preferences. See [37](docs/review/37-spatial-map-composer.md), which supersedes the shallow/static direction in 36.
2. **Motion is spent on relationships and arrivals, never on simulating the reading task.** Content is mounted whole and selectable. Following the builder's 7 October clarification, a finite arrival/reflow may translate and scale the single real DOM material continuously into its final allocation. This is the narrow exception requested in the latest builder correction; never copy captured characters, type text, count up numbers or fake scanning. The later correction in [30](docs/review/30-builder-request-audit.md) also permits the same whole-material zoom for deliberate hover reading; no duplicate captured text. The latest correction removes separately timed SVG plate/glyph arrivals; use one real material transform. See docs/review/28-unified-stage.md.
3. **Everything has one home.** Files come *from the map*. Tool calls come *from the dock*. Words come *from the agent*. Motion always starts at the true origin.
4. **The composition:** agents across the top · the living repository map behind everything, interactive · tool actions arriving **left to right** in passages · the agent's prose **beneath, unboxed, directly on the world** · history continuing downward · native tools then MCP servers on the **right** · reading position at the bottom. Live history accumulates while the user scrolls back; transport belongs to optional sequence replay.
5. **Work accumulates.** Earlier operations settle back and overlap only at their margins, titles and excerpts still readable. Nothing vanishes; selection opens reading space and detaches live follow. Capture/history continue; optional sequence playback holds.
6. **Clean developer-tool theme, no *labelled* boxes.** Graphite base, flat surfaces with 1 px hairlines, one sans + one mono, GitHub-dark syntax, colour only for meaning (agent identity, pass, fail, edited). No glow pools, grain or serif. The latest explicit builder correction permits bounded masked backdrop blur only at the header/composer edges, with a low-resource fallback; see [30](docs/review/30-builder-request-audit.md). The latest builder correction in [29](docs/review/29-centred-neutral-workspace.md) uses shared neutral action surfaces/borders, coloured type icons and error-only thin red contours; it supersedes earlier per-tool coloured chrome. The 7 October builder correction permits a subtle static CSS charcoal lining texture on the black workspace; see `docs/review/25-black-compact-map.md`. Prose is never boxed. Each action type still has its own content-shaped composition. The latest 7 October correction asks for vivid semantic material/syntax colours, compact preview chrome and a centred fading translucent header (now bounded edge veils under the later correction in 30). See `docs/review/28-unified-stage.md` and `docs/VISION.md` §5.
7. **The five signature moves:** **Lift** (content unfolds from its map node) · **Emit** (a tool call leaves its dock instrument; MCP servers open like drawers) · **Settle** (prior work eases back) · **Surface** (prose rises beneath the passage with a focus-pull, never typed) · **Resolve** (an outcome lands once and holds).
8. **Every little thing is crafted** — hovers, selection, copy, focus rings, scrubbing — and every one is reversible and interruptible.
9. **Three tests before anything ships:** *freeze* (any paused frame is readable, origins clear) · *truth* (no motion implies what the evidence cannot support) · *ten-minute* (still calm after ten minutes of real reading).

If an animation carries no information about where something came from, what it connects to, or what changed — cut it.

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

**Still to come (frontend and indexer):** PixiJS v8 map · CodeMirror 6 · `web-tree-sitter` import extraction · graphology for bounded working sets · Motion/CSS choreography · Playwright. The deviations from the original proposal (`better-sqlite3`, Fastify, `ws`) and their reasons are in [`docs/CODEBASE.md`](docs/CODEBASE.md#deliberate-deviations-from-the-proposed-stack-see-status-decisions) and the STATUS decisions log.

Rationale and rejected alternatives: [engineering plan §1](docs/review/03-engineering-plan.md#1-application-form-and-stack), [blueprint §14](docs/BLUEPRINT.md). If you think a choice is wrong, say so — but read the rejection first.

---

## How we work — two builders, one repo

The repo is [`drishya-dev/drishya`](https://github.com/drishya-dev/drishya). There is **no ownership split**: both builders work anywhere and review each other.

**Branches and pull requests**
- `main` always works. Never push broken code to it.
- Make documentation and other small, low-risk changes directly on `main` after checking them. Use a short-lived branch for major changes: `<handle>/<topic>` — e.g. `yash/canvas-lift`, `harsh/claude-adapter`.
- Open a PR into `main` for major branch work. **The other builder reviews it** before merge — this is how we check each other's work.
- Squash-merge. The PR title becomes the commit: `area: what changed` (e.g. `canvas: lift surfaces from map origins`). The repo allows squash merges only and deletes branches on merge.
- `CODEOWNERS` requests review from the other builder automatically. The PR template's checklist is the non-negotiables — tick it honestly.
- Label issues and PRs by area: `area: capture`, `area: canvas`, `area: map`, `area: privacy`. Anything touching the event schema gets `schema`; anything awaiting a recorded decision gets `decision`.

**Claiming and state**
- **Claim before starting** — one row in the *Claimed* table in [`docs/STATUS.md`](docs/STATUS.md). Its only job is that two people never edit the same file at once.
- **Update `docs/STATUS.md` when you finish**, not when you start. Overwrite your "Last session" block.
- **Settled decisions go in the decisions log, with the reason.** This is what stops four agents re-litigating the same argument next week.

**Rules of the codebase**
- **UI work uses the installed design skills.** Apply `emil-design-eng` for interface composition and polish, and the relevant animation/review skill when changing motion. Preserve this repo's evidence/creative doctrine when generic skill guidance conflicts. Commit each coherent, verified increment separately so the builders can backtrack; do not combine unrelated UI tasks into one commit. Builder direction, 12 October.
- **The event schema changes only by agreement between both builders.** It is the seam between capture and rendering.
- **Golden tests from the first composer commit.**
- **No new feature while a performance gate is red, unless the builder explicitly narrows the supported range and records the decision.** Current status: the builder resumed B4 and reference-machine long-session probes now pass their measured gates. Physical low-resource/lower-core and platform acceptance remain release checks. Preserve the paged projection/data-source boundary; do not claim broad release or unmeasured workload readiness. See `docs/review/08-b4-history-reader.md`, [`docs/STATUS.md`](docs/STATUS.md) and [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) §7.
- **Fixtures decouple the work.** If rendering is blocked on capture, the fixture corpus is too small — grow it. Only synthetic or redacted fixtures are committed; `.gitignore` refuses `*.jsonl` outside `fixtures/redacted/`.

**Commits by agents** end with a `Co-Authored-By:` trailer naming the agent, so the history shows who wrote what.

---

## Durability — read this once

**Chat history is not project memory.** It does not survive a folder rename, a desktop-app account switch, or the 30-day retention sweep of `~/.claude/projects/`. **This repository does.**

If something learned in a session would be expensive to lose — a decision, a design insight, a gotcha — **write it into `docs/` before the session ends.** Creative direction goes in `docs/VISION.md`; decisions in `docs/STATUS.md`; architecture in the engineering plan. The next agent, on either builder's machine, reads them in minutes and is fully caught up.

`scripts/Rename-Project.ps1` (Windows) and `scripts/rename-project.sh` (macOS/Linux) migrate Claude Code session history if the project folder is ever moved.

## Style

Match the surrounding code. Prefer clarity over cleverness — especially in the indexer, the projection reducer and the scene composer, where subtle bugs are most expensive and hardest to see. Comment *why*, not *what*, and only where the reason is not obvious from the code.
