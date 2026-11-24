# Drishya documentation

Start with the [README](../README.md) for what Drishya is and how to run it, and [CONTRIBUTING](../CONTRIBUTING.md) for how to change it. This page says which document answers which question.

**Current work:** [ROADMAP](../ROADMAP.md) and [GitHub Issues](https://github.com/drishya-dev/drishya/issues). **Earlier work and findings:** [Product Work History](PRODUCT_WORK_HISTORY.md).

When two documents disagree, the one higher in its row below wins. When a document conflicts with the [non-negotiable constraints](../AGENTS.md#non-negotiable-constraints), the constraints win.

## Which document answers what

| Question | Read, in order | Notes |
|---|---|---|
| What should Drishya look, move and feel like? | 1. [`VISION.md`](VISION.md) | The creative north star. Start every interface, graphics or motion task here |
| How do the layout, interaction and motion behave? | 1. [`reference/04-continuous-canvas.md`](reference/04-continuous-canvas.md) 2. [`reference/02-motion-catalog.md`](reference/02-motion-catalog.md) 3. [`review/motion-4-paired-surfaces.md`](review/motion-4-paired-surfaces.md) | The contract and its acceptance criteria |
| How is it built? | 1. [`CODEBASE.md`](CODEBASE.md) 2. [`review/03-engineering-plan.md`](review/03-engineering-plan.md) | Packages, data flow, identity, privacy, API, tests, how to add a harness |
| What is the event schema? | 1. [`packages/contracts`](../packages/contracts/src/index.ts) 2. [`reference/03-event-schema.md`](reference/03-event-schema.md) 3. [`review/125-event-schema-proposal.md`](review/125-event-schema-proposal.md) | The code is the working contract. Schema changes need both maintainers' agreement |
| What is planned for Hermes and T3 Code? | [`review/hermes-t3-integration-proposal.md`](review/hermes-t3-integration-proposal.md) | Reviewed planning direction, evidence limits and gated feasibility; integrations remain unimplemented |
| What do the harnesses actually record? | 1. [`review/04-research-ledger.md`](review/04-research-ledger.md) 2. [`review/123-harness-data-audit.md`](review/123-harness-data-audit.md) 3. the `antigravity-*` notes in [`review/`](review/) | Verified facts about formats and competitors; cite these before claiming anything about a harness |
| Is it secure, and how is that tested? | 1. [`../SECURITY.md`](../SECURITY.md) 2. [`review/sec-3-threat-model.md`](review/sec-3-threat-model.md) 3. [`review/sec-4-pentest.md`](review/sec-4-pentest.md) 4. [`review/sec-1-dependency-verification.md`](review/sec-1-dependency-verification.md), [`sec-2-token-redaction`](review/sec-2-token-redaction.md), [`sec-5-history-scan`](review/sec-5-history-scan.md) | `pnpm test:security` runs the suite |
| How fast is it, and what were the gates? | [`review/perf-1-large-journals.md`](review/perf-1-large-journals.md), [`perf-2-*`](review/), [`perf-4-cold-open`](review/perf-4-cold-open.md), [`live-7-latency`](review/live-7-latency.md), [`08-b4-history-reader`](review/08-b4-history-reader.md) | Measurements and the method used |
| How is a release made? | [`release-checklist.md`](release-checklist.md), [`CI_POLICY.md`](CI_POLICY.md), [`review/rel-4-release-preparation.md`](review/rel-4-release-preparation.md) | |
| Which decisions are settled, and why? | [`decisions/README.md`](decisions/README.md), then [`decisions/log.md`](decisions/log.md) | Read before changing capture, privacy, the schema or the interface's direction |
| Has this been tried before? | [`PRODUCT_WORK_HISTORY.md`](PRODUCT_WORK_HISTORY.md), [its review notes](PRODUCT_WORK_HISTORY_REVIEW_NOTES.md) | Search by feature name or task ID; the index at the top lists every entry |
| What is Workspace and how does it differ from the file peek? | [`DEVELOPER_WORKSPACE.md`](DEVELOPER_WORKSPACE.md) | |
| How do rules for coding agents work here? | [`../AGENTS.md`](../AGENTS.md) | Loaded by Codex directly and by Claude Code through `CLAUDE.md` |

## Everything, by folder

| Path | Contents |
|---|---|
| [`VISION.md`](VISION.md) | Creative direction, in the builders' own words |
| [`CODEBASE.md`](CODEBASE.md) | The code as built |
| [`DEVELOPER_WORKSPACE.md`](DEVELOPER_WORKSPACE.md) | The developer tools around the visualization |
| [`CI_POLICY.md`](CI_POLICY.md), [`release-checklist.md`](release-checklist.md) | Verification and release |
| [`decisions/`](decisions/) | Contributor decisions and the decisions log |
| [`prototype/`](prototype/) | The interactive design reference for the continuous canvas (synthetic data only) |
| [`reference/`](reference/) | Motion catalog, event schema (draft) and the continuous canvas contract |
| [`review/`](review/) | The notes that stayed useful as references: engineering plan, research ledger, security, performance, release and harness notes |
| [`PRODUCT_WORK_HISTORY.md`](PRODUCT_WORK_HISTORY.md) and [its review notes](PRODUCT_WORK_HISTORY_REVIEW_NOTES.md) | The full task record and summaries of every earlier design note, audit and plan |
| [`readme/`](readme/) | Screenshots and icons used by the README |
| [`../assets/brand/`](../assets/brand/README.md) | The logo and brand files |

The original blueprint, the first brief and the early planning documents are summarised in the [review notes](PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#planning-documents).
