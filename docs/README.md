# Drishya documentation — map and precedence

The docs were written in layers: a blueprint (20 Sep), a researched external review that corrected it (21 Sep), and then user-directed design refinements. Several documents therefore overlap. **This page is the single answer to "which one is right?"**

When two documents disagree, the one higher in its row wins. When a document here conflicts with the [non-negotiable constraints](../AGENTS.md#non-negotiable-constraints), the constraints win.

---

## Precedence by topic

| Topic | Authoritative, in order | Notes |
|---|---|---|
| **Creative direction** — look, feel, motion intent | 1. [`VISION.md`](VISION.md) | The north star. Start every UI/graphics/motion task here |
| **Layout & interaction contract** — places, passages, overlap, scrolling, acceptance | 1. [`reference/04-continuous-canvas.md`](reference/04-continuous-canvas.md) · 2. [`review/02-experience-spec.md`](review/02-experience-spec.md) · 3. [`reference/02-motion-catalog.md`](reference/02-motion-catalog.md) | The motion catalog's per-action recipes remain useful detail but are **superseded** where they fake typing, count up numbers, or imply causality |
| **System architecture** — data, storage, capture, API, performance, privacy | 1. [`review/03-engineering-plan.md`](review/03-engineering-plan.md) · 2. [`BLUEPRINT.md`](BLUEPRINT.md) §8–§18 | Engineering plan wins on observations/projections, historical artifacts, hook overhead and first-import privacy |
| **Event schema** | [`reference/03-event-schema.md`](reference/03-event-schema.md) — **draft** | [Engineering plan §3](review/03-engineering-plan.md#3-replace-one-overloaded-event-with-observations-and-projections) proposes amendments. **Not frozen** until both builders agree ([§13](review/03-engineering-plan.md#13-what-must-be-settled-before-a-schema-freeze)) |
| **Product, need, positioning, scope** | 1. [`review/01-product-review.md`](review/01-product-review.md) · 2. [`BLUEPRINT.md`](BLUEPRINT.md) Part I | The review retires unsupported claims (see "claims to stop repeating") |
| **Facts** — harness formats, competitors, sources | 1. [`review/04-research-ledger.md`](review/04-research-ledger.md) · 2. [`reference/01-evidence-pack.md`](reference/01-evidence-pack.md) | Ledger is newer and corrects the evidence pack on HTTP hooks, Codex hooks and competitor content |
| **Where we are / what is next / decisions** | [`STATUS.md`](STATUS.md) | State only. The decisions log is append-only |
| **Rules for agents** | [`../AGENTS.md`](../AGENTS.md) | Loaded by Codex directly and by Claude Code via `CLAUDE.md` |

---

## Reading order

**New to the project** — [`VISION.md`](VISION.md) → [`review/01-product-review.md`](review/01-product-review.md) → [`STATUS.md`](STATUS.md). Half an hour, and you know what it is, why, and where it stands.

**Before UI work** — [`VISION.md`](VISION.md) → [`prototype/`](prototype/) → [`reference/04-continuous-canvas.md`](reference/04-continuous-canvas.md) → [`review/02-experience-spec.md`](review/02-experience-spec.md).

**Before capture, store or daemon work** — [`review/03-engineering-plan.md`](review/03-engineering-plan.md) → [`reference/03-event-schema.md`](reference/03-event-schema.md) → [`review/04-research-ledger.md`](review/04-research-ledger.md).

---

## Everything, by folder

| Path | Contents |
|---|---|
| [`VISION.md`](VISION.md) | Creative direction and the builder's own words |
| [`BLUEPRINT.md`](BLUEPRINT.md) | The original end-to-end blueprint (v1.2). Still the fullest single account; partly superseded as mapped above |
| [`STATUS.md`](STATUS.md) | Position, queue, decisions log |
| [`HACKATHON.md`](HACKATHON.md) | Fit assessment for the Nebius × NVIDIA hackathon, against its official rules |
| [`review/`](review/) | The 21 September external review: product, experience, engineering, research ledger, first storyboard |
| [`reference/`](reference/) | Evidence pack, motion catalog, event schema (draft), continuous canvas |
| [`prototype/`](prototype/) | **The interactive design reference** — the continuous canvas, all five signature moves. Synthetic data only; never presented as a working integration |

| [`Vantage_Base_Prompt.md`](Vantage_Base_Prompt.md) | The original brief, kept for provenance |
