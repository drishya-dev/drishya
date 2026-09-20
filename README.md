# Drishya

**दृश्य** — *"that which is seen."*

A local, cross-harness replay and live view for coding agents. It plays an agent's work as **real content** — the source it read, the output it got, the diff it wrote — on a map of your actual repository, on a timeline you can scrub.

> **Status: pre-alpha. No code yet.** This repository currently holds the design: the problem, the architecture, and the decisions. Building starts at M0.

---

## The problem

Agents now produce work faster than anyone can verify it. A twenty-minute run touches dozens of files, issues hundreds of tool calls, and rewrites code in places you never named. You have two options: watch a transcript scroll past faster than you can read, or look away and review the final diff.

Almost everyone picks the second. And a diff is an answer with its reasoning deleted — you see *what* changed, never *why*, what evidence drove it, or the moment it wandered somewhere it had no business being.

All of that was captured. It is sitting in a JSONL file nobody opens.

**Your agent already recorded everything. You just can't read it.**

## The approach

- **A map of your repository**, not of the agent's call tree — so "it's working in the wrong place" is something you *see*, not something you read.
- **Real captured bytes** at every point — click any moment and get the file, not a label.
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
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) | **Start here.** The source of truth: need, positioning, architecture, performance contract, roadmap |
| [`docs/STATUS.md`](docs/STATUS.md) | Where the project is, what is next, decisions log |
| [`docs/reference/01-evidence-pack.md`](docs/reference/01-evidence-pack.md) | Verified harness formats and competitive research, with sources |
| [`docs/reference/02-motion-catalog.md`](docs/reference/02-motion-catalog.md) | Presentation and motion spec, per agent action type |
| [`docs/reference/03-event-schema.md`](docs/reference/03-event-schema.md) | The normalized event schema and adapter contract |

## Licence

[Apache-2.0](LICENSE).
