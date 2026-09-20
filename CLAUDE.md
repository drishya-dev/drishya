# Drishya

A local, cross-harness replay and live view for coding agents. It plays an agent's work as real content — the source it read, the output it got, the diff it wrote — on a map of the user's actual repository, on a timeline they can scrub.

Two builders. Both use coding agents. This file keeps every agent working from the same architecture.

---

## Read these before doing work

| File | What it is | When |
|---|---|---|
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) | **The source of truth.** Concept, need, positioning, architecture, decisions, performance contract, roadmap | Always. Skim the table of contents; read the sections your task touches |
| [`docs/STATUS.md`](docs/STATUS.md) | Where we are, what is next, who did what, decisions log | Always, at the start of a session |
| [`docs/reference/03-event-schema.md`](docs/reference/03-event-schema.md) | The normalized event schema — the seam between capture and rendering | Any adapter, daemon or store work |
| [`docs/reference/02-motion-catalog.md`](docs/reference/02-motion-catalog.md) | Per-action-type presentation and motion specs | Any renderer or animation work |
| [`docs/reference/01-evidence-pack.md`](docs/reference/01-evidence-pack.md) | Verified harness formats, competitor research, sources | Any capture work, or before making a factual claim about a harness |

`docs/Vantage_Base_Prompt.md` is the original brief, kept for provenance. **It is superseded by the blueprint wherever they disagree** — including the product name.

---

## Non-negotiable constraints

Violating any of these is a bug, not a tradeoff. They are argued for in the blueprint; do not re-derive them.

1. **Observe only.** Drishya never sends a prompt, approves a tool call, or launches an agent. The moment it does, it is a harness and it loses. (§5.4)
2. **Never mutate a harness's files.** All harness paths are read-only, always. Copy what we need into our own store.
3. **Redact before persisting.** Secrets are scrubbed in the ingest path, before SQLite, before the blob store, before the screen. Never after. (§13.1)
4. **Captured ≠ derived.** Every rendered string carries provenance. Never present a heuristic summary as if the agent said it. (§12)
5. **Never invent a location.** If an action cannot be resolved to a graph node above 0.6 confidence, the Terrain stays quiet. A wrong light destroys trust in every other light.
6. **The composer is a pure function.** No wall-clock reads inside it; time is injected. Determinism cannot be retrofitted and golden tests depend on it. (§9.6)
7. **Everything is interruptible.** Any pointer or key event cancels in-flight animation synchronously. Nobody waits for a transition. (§9.7)
8. **Text is never rendered in WebGL.** Pixi draws the Terrain; DOM draws every character. (§14.3)
9. **No telemetry. None.** No opt-out, because there is nothing to opt out of.
10. **The agent must never slow down.** Hooks are async with short timeouts; indexing is niced and capped at half the cores.

---

## Stack

TypeScript everywhere · Node 22+/Bun · Fastify or Hono · `ws` · `better-sqlite3` (WAL) · `web-tree-sitter` · React 19 · Vite · Zustand · PixiJS v8 (WebGL2) · graphology · CodeMirror 6 · `motion`

Decisions and the rejected alternatives are in blueprint §14. If you think one is wrong, say so — but read the rejection first, because it is probably already addressed.

---

## Working agreements

There is **no ownership split** — both builders work anywhere, review each other, and take the next item from the queue in `STATUS.md`.

- **Claim work in `docs/STATUS.md` before starting.** One row in the *Claimed* table. This is the entire concurrency protocol; its only job is that two people never edit the same file at once.
- **Update `docs/STATUS.md` when you finish**, not when you start. Overwrite your "Last session" block; append to the decisions log if something was settled.
- **Decisions go in the log with a reason.** This is what stops four agents re-litigating the same argument next week.
- **The event schema changes only by agreement between both builders.** It is the seam between capture and rendering; unilateral changes to a seam cost more than they save.
- **Golden tests from the first composer commit.** (§17.1)
- **No new feature while a performance gate is red.** Performance is a product promise, not an optimization phase. (§15)
- **Fixtures are the decoupling mechanism.** If rendering work is blocked waiting on capture work, the fixture corpus is too small — grow it.

## Durability — read this once

**Chat history is not project memory.** It does not survive a folder rename, an account switch in the desktop app, or the 30-day retention sweep on `~/.claude/projects/`. These files do.

So: if something learned in a session would be expensive to lose, **write it into `BLUEPRINT.md` or `STATUS.md` before the session ends.** An agent reads them in thirty seconds and is fully caught up. Blueprint Appendix A2 has the details, and `scripts/Rename-Project.ps1` (Windows) or `scripts/rename-project.sh` (macOS/Linux) migrates Claude Code history if the folder is ever moved.

## Style

Match the surrounding code. Prefer clarity over cleverness in the indexer and the composer specifically — those two are where subtle bugs are most expensive and hardest to see. Comment *why*, not *what*, and only where the reason is not obvious from the code.
