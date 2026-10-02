# Drishya

**दृश्य** — *"that which is seen."*

A local, cross-harness history and live view for coding agents. Follow **real captured content** — the source it read, the output it got, the diff it wrote — connected to your repository. The intended live experience keeps accumulating while you scroll back and read; sequence replay is optional.

> **Status: pre-alpha, working draft.** Claude Code/Codex adapters, storage, projections, local API and a base UI exist. The [30 September audit](docs/review/06-baseline-audit.md) passed 96 tests and found privacy, recovery and live-history gaps. Backend hardening and a usable integrated history are next; the premium frontend is not finalized. Optional remote explanations and release packaging remain unverified.

## Run it

Requires a developer checkout, **Node 24** and **pnpm 10.34.5** (or prefix commands with `npx pnpm@10.34.5`). There is no verified published `npx drishya` installation yet. Use the synthetic demo while the known privacy bypasses are being closed; see the audit before importing sensitive recordings.

```bash
pnpm install
pnpm ui:build
pnpm serve
```

`pnpm serve` starts the local app on `127.0.0.1:7878` and opens it with a per-launch authentication link. The home screen lists local Claude Code/Codex sessions; **Import** opens recorded work, **Watch live** tails the selected journal. Drishya reads those source files without changing them. Live-history interaction is still being revised; tailing status does not prove an agent is running.

| Command | What it does |
|---|---|
| `pnpm serve` | Start the local app |
| `pnpm dev` + `pnpm ui:dev` | Daemon with the Vite dev server on `127.0.0.1:5173` (hot reload) |
| `pnpm drishya sources` | List harness sessions on this machine |
| `pnpm drishya import <file>` | Import a session journal; the advertised `--live` CLI flag currently has no effect |
| `pnpm drishya export <recording> --out f.json` | Write a replay bundle; export privacy coverage needs hardening before sharing real recordings |
| `pnpm demo:bundle` | Rebuild the synthetic demo from `fixtures/synthetic/` |
| `pnpm check` | Typecheck and run every test |
| `node scripts/validate-baseline.ts` | Synthetic persistence/API/live diagnostics and known privacy probes |
| `node scripts/validate-baseline.ts --real-read-only` | Also sample local journals in memory, printing only aggregate results |

**Demo with no install:** the built UI with no daemon (or `?demo`) plays the synthetic replay bundle. Deep links: `?demo&at=26` (the edit), `&motion=0` (reduced motion).

**Explanations with NVIDIA Nemotron (optional, experimental).** The implementation accepts `NEBIUS_API_KEY` and configurable model/endpoint variables. Evidence-based explanations are labelled generated and are user-triggered. Live API validation and binding consent to an exact immutable preview are still open; use synthetic evidence until those gates pass. Core capture/review needs no model key.

Data lives in `~/.drishya` (override with `DRISHYA_HOME`). The code map is [`docs/CODEBASE.md`](docs/CODEBASE.md).

---

## The problem

Agents now produce work faster than anyone can verify it. A twenty-minute run touches dozens of files, issues hundreds of tool calls, and rewrites code in places you never named. You have two options: watch a transcript scroll past faster than you can read, or look away and review the final diff.

Reviewing only the final diff can leave useful context scattered across the transcript: what was read, which commands ran, what failed, and which explanations the agent actually emitted. Drishya aims to make that evidence easier to inspect alongside the changes.

Much of that work may be available in harness transcripts, tool results and snapshots. What is available depends on the harness, version and recording; missing evidence must stay visible.

**Keep up with what your agents change.**

## The approach

- **A map of your repository**, not of the agent's call tree — so "it's working in the wrong place" is something you *see*, not something you read.
- **Captured content with provenance** — inspect available source regions, results and diffs, with historical versions and gaps distinguished from current files.
- **An accumulating work history** that keeps your reading position while new work arrives, with optional sequence replay. This is the target interaction; the draft currently exposes a playback-led interface.
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
| [`docs/CONTINUITY.md`](docs/CONTINUITY.md) | Start here after a model/chat change |
| [`docs/PRODUCT_DIRECTION.md`](docs/PRODUCT_DIRECTION.md) | Current product plan, target users, content-shaped experience and differentiation |
| [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) | Backend-first gates, base UI, performance, integrations and deployment |
| [`docs/review/06-baseline-audit.md`](docs/review/06-baseline-audit.md) | Reproducible results, findings and limitations |
| [`docs/review/01-product-review.md`](docs/review/01-product-review.md) | Product, need, differentiation, validation and scope |
| [`docs/review/03-engineering-plan.md`](docs/review/03-engineering-plan.md) | Architecture: capture, historical content, storage, privacy, performance, packaging |
| [`docs/CODEBASE.md`](docs/CODEBASE.md) | The code as built: packages, data flow, how to add a harness, what is draft |
| [`docs/STATUS.md`](docs/STATUS.md) | Where the project is, what is next, decisions log |
| [`AGENTS.md`](AGENTS.md) | Rules for coding agents working in this repository |

## Licence

[Apache-2.0](LICENSE).
