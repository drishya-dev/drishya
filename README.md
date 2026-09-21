# Drishya

**दृश्य** — *"that which is seen."*

A local, cross-harness replay and live view for coding agents. It plays an agent's work as **real content** — the source it read, the output it got, the diff it wrote — on a map of your actual repository, on a timeline you can scrub.

> **Status: pre-alpha. No application yet.** This repository holds the design, a researched product review and a synthetic interaction storyboard. Capture, live replay and performance remain unimplemented and unmeasured.

---

## The problem

Agents now produce work faster than anyone can verify it. A twenty-minute run touches dozens of files, issues hundreds of tool calls, and rewrites code in places you never named. You have two options: watch a transcript scroll past faster than you can read, or look away and review the final diff.

Almost everyone picks the second. And a diff is an answer with its reasoning deleted — you see *what* changed, never *why*, what evidence drove it, or the moment it wandered somewhere it had no business being.

Much of that work may be available in harness transcripts, tool results and snapshots. What is available depends on the harness, version and recording; missing evidence must stay visible.

**Keep up with what your agents change.**

## The approach

- **A map of your repository**, not of the agent's call tree — so "it's working in the wrong place" is something you *see*, not something you read.
- **Captured content with provenance** — inspect available source regions, results and diffs, with historical versions and gaps distinguished from current files.
- **A scrubbable timeline** where the map and the content move together.
- **Cross-harness.** Claude Code and Codex first. Your agents keep running in their own harness; Drishya only watches.

## Principles

- **Observe only.** Drishya never sends a prompt, approves a tool call, or launches an agent.
- **Local-first. Zero telemetry.** Not opt-out — there is nothing to opt out of.
- **Captured is never confused with derived.** Everything shown carries its provenance.

---

## Documentation

| Document | What it is |
|---|---|
| [`docs/review/01-product-review.md`](docs/review/01-product-review.md) | **Latest review:** scope corrections, competitive findings, user need, differentiation, validation and launch |
| [`docs/review/02-experience-spec.md`](docs/review/02-experience-spec.md) | Premium visual direction, scene choreography, pacing, interaction and accessibility |
| [`docs/reference/04-continuous-canvas.md`](docs/reference/04-continuous-canvas.md) | **Latest visual direction:** accumulating tool passages, open agent prose, top agents and right-side MCP origins |
| [`docs/review/03-engineering-plan.md`](docs/review/03-engineering-plan.md) | Architecture amendments, historical content, integrations, performance, privacy and deployment |
| [`docs/review/04-research-ledger.md`](docs/review/04-research-ledger.md) | Primary sources, inspected competitor code and explicit research limits |
| [`docs/review/05-experience-storyboard.html`](docs/review/05-experience-storyboard.html) | Interactive synthetic storyboard; a design probe, not a functioning collector |
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) | **Start here.** The source of truth: need, positioning, architecture, performance contract, roadmap |
| [`docs/STATUS.md`](docs/STATUS.md) | Where the project is, what is next, decisions log |
| [`docs/reference/01-evidence-pack.md`](docs/reference/01-evidence-pack.md) | Verified harness formats and competitive research, with sources |
| [`docs/reference/02-motion-catalog.md`](docs/reference/02-motion-catalog.md) | Presentation and motion spec, per agent action type |
| [`docs/reference/03-event-schema.md`](docs/reference/03-event-schema.md) | The normalized event schema and adapter contract |

## Licence

[Apache-2.0](LICENSE).
