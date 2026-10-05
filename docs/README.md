# Drishya documentation — map and precedence

The docs were written in layers: a blueprint (20 Sep), an external review (21 Sep), a working backend draft (25 Sep), and the builder's live-history/backend-first clarification with a baseline audit (30 Sep). Several documents therefore overlap. **This page is the single answer to "which one is right?"**

When two documents disagree, the one higher in its row wins. When a document here conflicts with the [non-negotiable constraints](../AGENTS.md#non-negotiable-constraints), the constraints win.

---

## Precedence by topic

| Topic | Authoritative, in order | Notes |
|---|---|---|
| **Creative direction** — look, feel, motion intent | 1. [`VISION.md`](VISION.md) | The north star. Start every UI/graphics/motion task here |
| **Layout & interaction contract** — places, passages, overlap, scrolling, acceptance | 1. [`reference/04-continuous-canvas.md`](reference/04-continuous-canvas.md) · 2. [`review/02-experience-spec.md`](review/02-experience-spec.md) · 3. [`reference/02-motion-catalog.md`](reference/02-motion-catalog.md) | The motion catalog's per-action recipes remain useful detail but are **superseded** where they fake typing, count up numbers, or imply causality |
| **System architecture** — data, storage, capture, API, performance, privacy | 1. [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md) for current amendments/gates · 2. [`review/03-engineering-plan.md`](review/03-engineering-plan.md) · 3. [`BLUEPRINT.md`](BLUEPRINT.md) §8–§18 | Roadmap adds reliability, live-history and deployment gates; schema amendments remain proposals |
| **Event schema** | 1. [`packages/contracts`](../packages/contracts/src/index.ts) (`0.1.0-draft`, implements engineering plan §3) · 2. [`reference/03-event-schema.md`](reference/03-event-schema.md) | The code is the working draft; the reference doc is the earlier design. **Not frozen** until both builders agree ([§13](review/03-engineering-plan.md#13-what-must-be-settled-before-a-schema-freeze)) |
| **The code as built / verified** | 1. [`review/06-baseline-audit.md`](review/06-baseline-audit.md) for 30 Sep findings · 2. [`CODEBASE.md`](CODEBASE.md) | Audit distinguishes reproduced results, source findings and unverified gates. Plans are not implementation claims |
| **Product, need, positioning, scope** | 1. [`PRODUCT_DIRECTION.md`](PRODUCT_DIRECTION.md) · 2. [`review/01-product-review.md`](review/01-product-review.md) · 3. [`BLUEPRINT.md`](BLUEPRINT.md) Part I | Accumulating live history, backend-first base, content-shaped presentation and evidence-linked utility; no unsupported first/uncopyable claims |
| **Facts** — harness formats, competitors, sources | 1. [`review/04-research-ledger.md`](review/04-research-ledger.md) · 2. [`reference/01-evidence-pack.md`](reference/01-evidence-pack.md) | Ledger is newer and corrects the evidence pack on HTTP hooks, Codex hooks and competitor content |
| **Where we are / what is next / decisions** | [`STATUS.md`](STATUS.md) | State only. The decisions log is append-only |
| **Rules for agents** | [`../AGENTS.md`](../AGENTS.md) | Loaded by Codex directly and by Claude Code via `CLAUDE.md` |

---

## Current B4 amendment

[08: bounded history reader](review/08-b4-history-reader.md) supersedes earlier B4 full-projection/deferral statements for architecture, measurements and limits. STATUS and CONTINUITY carry current execution state; [07](review/07-b4-scale-install.md) retains historical probes. The non-negotiable privacy/evidence/observe-only constraints still win.

## Reading order

**New chat / model switch / compaction** — [`CONTINUITY.md`](CONTINUITY.md) → [`STATUS.md`](STATUS.md) → [`PRODUCT_DIRECTION.md`](PRODUCT_DIRECTION.md) → [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md). Read VISION before any UI work and CODEBASE before code. This is the durable handoff; chat memory is not required.

**Before UI work** — [`VISION.md`](VISION.md) → [`prototype/`](prototype/) → [`reference/04-continuous-canvas.md`](reference/04-continuous-canvas.md) → [`review/02-experience-spec.md`](review/02-experience-spec.md).

**Before capture, store or daemon work** — [`CODEBASE.md`](CODEBASE.md) → [`review/06-baseline-audit.md`](review/06-baseline-audit.md) → [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md) → [`review/03-engineering-plan.md`](review/03-engineering-plan.md). Read the research ledger for harness facts.

**Before frontend work** — [`VISION.md`](VISION.md) → [`CODEBASE.md` § Base UI](CODEBASE.md#base-ui--what-is-placeholder) → the `compose()` goldens in `packages/scene/test/__golden__`.

---

## Everything, by folder

| Path | Contents |
|---|---|
| [`VISION.md`](VISION.md) | Creative direction and the builder's own words |
| [`CONTINUITY.md`](CONTINUITY.md) | Short restart guide for the next model/chat |
| [`PRODUCT_DIRECTION.md`](PRODUCT_DIRECTION.md) | Current product thesis, users, differentiation, detailed visual interaction and pilot criteria |
| [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md) | Ordered backend/base-UI gates, resource targets, session integrations and distribution |
| [`review/06-baseline-audit.md`](review/06-baseline-audit.md) | Executed baseline, real read-only sample, source findings and reproduction commands |
| [`BLUEPRINT.md`](BLUEPRINT.md) | The original end-to-end blueprint (v1.2). Still the fullest single account; partly superseded as mapped above |
| [`STATUS.md`](STATUS.md) | Position, queue, decisions log |
| [`review/09-p1-content-origins.md`](review/09-p1-content-origins.md) | Prototype source audit, first P1 presentation slice, evidence and remaining choreography |
| [`CODEBASE.md`](CODEBASE.md) | The code as built: pipeline, packages, identity, privacy, API, tests |
| [`HACKATHON.md`](HACKATHON.md) | Fit assessment for the Nebius × NVIDIA hackathon, against its official rules |
| [`review/`](review/) | The 21 September external review: product, experience, engineering, research ledger, first storyboard |
| [`reference/`](reference/) | Evidence pack, motion catalog, event schema (draft), continuous canvas |
| [`prototype/`](prototype/) | **The interactive design reference** — the continuous canvas, all five signature moves. Synthetic data only; never presented as a working integration |
| [`Vantage_Base_Prompt.md`](Vantage_Base_Prompt.md) | The original brief, kept for provenance |
