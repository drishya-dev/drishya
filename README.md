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

Start with **[`docs/VISION.md`](docs/VISION.md)** — what Drishya should look and feel like, in the builders' own words. The **[documentation map](docs/README.md)** lists every document and resolves which one wins where they overlap.

| Document | What it is |
|---|---|
| [`docs/VISION.md`](docs/VISION.md) | Creative direction: the composition, signature moves, materials and the standard |
| [`docs/review/01-product-review.md`](docs/review/01-product-review.md) | Product, need, differentiation, validation and scope |
| [`docs/review/03-engineering-plan.md`](docs/review/03-engineering-plan.md) | Architecture: capture, historical content, storage, privacy, performance, packaging |
| [`docs/STATUS.md`](docs/STATUS.md) | Where the project is, what is next, decisions log |
| [`AGENTS.md`](AGENTS.md) | Rules for coding agents working in this repository |

## Licence

[Apache-2.0](LICENSE).
