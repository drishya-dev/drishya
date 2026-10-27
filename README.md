# Drishya

**दृश्य** — *"that which is seen."*

A local, cross-harness history and live view for coding agents. Follow **real captured content** — the source it read, the output it got, the diff it wrote — connected to your repository. The intended live experience keeps accumulating while you scroll back and read; sequence replay is optional.

> **Status: working local product candidate.** Claude Code/Codex discovery, import/watch, bounded accumulating history, source/diff/result readers, repository exploration, agent ownership, file evidence comparison, reading marks and verification freshness are integrated. Shared charcoal/light/system themes and resource settings are included. [Product delivery](docs/PRODUCT_DELIVERY.md) describes what works and how to run it. Physical/platform release acceptance, a human comprehension pilot and optional live model-provider validation remain open; final colours and animations can evolve on this baseline.

## Run it

Requires a developer checkout, **Node 24** and **pnpm 10.34.5** (or prefix commands with `npx pnpm@10.34.5`). There is no published `npx drishya` installation yet. The isolated offline package/install is verified with `pnpm package:verify`. Imports redact before storage; pattern detection is best effort. Review exports before sharing and re-import recordings flagged with an older privacy policy.

```bash
pnpm install
pnpm ui:build
pnpm serve
```

`pnpm serve` starts the local app on `127.0.0.1:7878` and opens it with a per-launch authentication link. The home screen lists local Claude Code/Codex sessions; **Import** opens recorded work, **Watch live** tails the selected journal. Drishya reads those source files without changing them. Scroll back to read while capture continues; **Back to latest** resumes following. Tailing status does not prove an agent is running.

| Command | What it does |
|---|---|
| `pnpm serve` | Start the local app |
| `pnpm dev` + `pnpm ui:dev` | Daemon with the Vite dev server on `127.0.0.1:5173` (hot reload) |
| `pnpm drishya sources` | List harness sessions on this machine |
| `pnpm drishya import <file>` | Import a journal; add `--live` to keep following until Ctrl+C |
| `pnpm drishya export <recording> --out f.json` | Write a sanitized replay bundle; review before sharing |
| `pnpm drishya list` / `pnpm drishya storage` | List recordings / inspect the local advisory storage budget |
| `pnpm package:verify` | Build and test a checksummed isolated offline package |
| `pnpm test:browser` | Build and exercise integrated synthetic browser journeys |
| `pnpm demo:bundle` | Rebuild the synthetic demo from `fixtures/synthetic/` |
| `pnpm check` | Typecheck and run every test |
| `node scripts/validate-baseline.ts` | Synthetic persistence/API/live diagnostics and known privacy probes |
| `node scripts/validate-baseline.ts --real-read-only` | Also sample local journals in memory, printing only aggregate results |

**Demo with no install:** the built UI with no daemon (or `?demo`) plays the synthetic replay bundle. Deep links: `?demo&at=26` (the edit), `&motion=0` (reduced motion).

**Explanations with NVIDIA Nemotron (optional, experimental).** The implementation accepts `NEBIUS_API_KEY` and configurable model/endpoint variables. Generated explanations are user-triggered and require consent to the exact previewed payload. A changed payload invalidates consent. Live-provider validation remains open. Core capture/review needs no model key.

Data lives in `~/.drishya` (override with `DRISHYA_HOME`). The code map is [`docs/CODEBASE.md`](docs/CODEBASE.md).

### Recorded reasoning summaries

Drishya shows exposed summaries or thinking text only when the harness records them. Encrypted content and signature-only blocks cannot supply readable reasoning; these settings do not reveal private reasoning or recover missing text from old sessions.

**Codex CLI: tested on 0.164.0-alpha.11.1 with `gpt-5.6-terra`, medium effort.** For a new one-run session, opt in with:

```bash
codex exec -c 'model_reasoning_summary="auto"' "your task"
```

Fresh local sessions used a read-only sandbox and a no-tools prompt. They retained a summary with `auto`, `concise` and `detailed`; two `none` runs retained none. This is a small, model-specific verification, not a guarantee for every turn or Codex surface. `detailed` also worked, but did not establish a longer summary. Keep your normal sandbox and approval policy. See the [official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference#model_reasoning_summary) and [tested conditions and counts](docs/review/data-8-reasoning-persistence.md). Drishya never changes the setting for you.

**Claude Code interactive CLI: tested on 2.1.282 with `claude-opus-5-5`.** Opt in for a new interactive session with:

```bash
claude --settings '{"showThinkingSummaries":true}'
```

Two fresh interactive opt-in runs retained exposed summary text in the native journals; two default runs retained signature-only blocks. Both headless `-p` comparisons retained signature-only blocks, including with this setting, so this is **interactive guidance**. Tests used plan mode with tools disabled. This follows the documented [`showThinkingSummaries` scope](https://code.claude.com/docs/en/settings-reference#showthinkingsummaries); it does not make effort or thinking budgets persistence controls. See the report for versions, isolation and limits.

---

## The problem

Agents now produce work faster than anyone can verify it. A twenty-minute run touches dozens of files, issues hundreds of tool calls, and rewrites code in places you never named. You have two options: watch a transcript scroll past faster than you can read, or look away and review the final diff.

Reviewing only the final diff can leave useful context scattered across the transcript: what was read, which commands ran, what failed, and which explanations the agent actually emitted. Drishya aims to make that evidence easier to inspect alongside the changes.

Much of that work may be available in harness transcripts, tool results and snapshots. What is available depends on the harness, version and recording; missing evidence must stay visible.

**Keep up with what your agents change.**

## The approach

- **A map of your repository**, not of the agent's call tree — so "it's working in the wrong place" is something you *see*, not something you read.
- **Captured content with provenance** — inspect available source regions, results and diffs, with historical versions and gaps distinguished from current files.
- **An accumulating work history** that keeps your reading position while new work arrives, with optional sequence replay.
- **Cross-harness.** Claude Code and Codex first. Your agents keep running in their own harness; Drishya only watches.

## Principles

- **Passive capture, optional native continuation.** Viewing stays independent. An explicitly enabled composer can resume a selected local native session with conservative permissions; no arbitrary terminal attachment or observer-hook steering. See [connected workspace](docs/review/26-connected-workspace.md).
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
