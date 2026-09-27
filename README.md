# Drishya

**दृश्य** — *"that which is seen."*

A local, cross-harness replay and live view for coding agents. It plays an agent's work as **real content** — the source it read, the output it got, the diff it wrote — on a map of your actual repository, on a timeline you can scrub.

> **Status: pre-alpha, working draft.** The backend is built and tested: Claude Code and Codex capture, redaction, the local store, projection, repository map, scene composer, local API and model explanations. A base UI exercises all of it. The final frontend design (Pixi map, full motion) is next. Tested on Windows 11 with Node 24.

## Run it

Requires **Node 24** and **pnpm** (`npm i -g pnpm`, or prefix commands with `npx pnpm@10`).

```bash
pnpm install
pnpm ui:build
pnpm serve
```

`pnpm serve` starts the local app on `127.0.0.1:7878` and opens it with a one-time launch link. The home screen lists your Claude Code and Codex sessions; **Import** replays one, **Watch live** follows a running agent. Drishya only reads those files and never changes them.

| Command | What it does |
|---|---|
| `pnpm serve` | Start the local app |
| `pnpm dev` + `pnpm ui:dev` | Daemon with the Vite dev server on `127.0.0.1:5173` (hot reload) |
| `pnpm drishya sources` | List harness sessions on this machine |
| `pnpm drishya import <file> [--live]` | Import a session journal (the harness is detected) |
| `pnpm drishya export <recording> --out f.json` | Write a sanitized replay bundle, with no local paths |
| `pnpm demo:bundle` | Rebuild the synthetic demo from `fixtures/synthetic/` |
| `pnpm check` | Typecheck and run every test |

**Demo with no install:** the built UI with no daemon (or `?demo`) plays the synthetic replay bundle. Deep links: `?demo&at=26` (the edit), `&motion=0` (reduced motion).

**Explanations with NVIDIA Nemotron (optional).** Set `NEBIUS_API_KEY` (Nebius Token Factory) before `pnpm serve`. Nothing is ever sent automatically. Each explanation is an explicit action that first shows exactly what would be sent, sends only redacted evidence, keeps only claims that cite that evidence, and is labelled as generated. Models are configurable with `DRISHYA_MODEL_NANO`, `DRISHYA_MODEL_SUPER`, `DRISHYA_MODEL_ULTRA` and `DRISHYA_LLM_BASE_URL`.

Data lives in `~/.drishya` (override with `DRISHYA_HOME`). The code map is [`docs/CODEBASE.md`](docs/CODEBASE.md).

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
| [`docs/CODEBASE.md`](docs/CODEBASE.md) | The code as built: packages, data flow, how to add a harness, what is draft |
| [`docs/STATUS.md`](docs/STATUS.md) | Where the project is, what is next, decisions log |
| [`AGENTS.md`](AGENTS.md) | Rules for coding agents working in this repository |

## Licence

[Apache-2.0](LICENSE).
