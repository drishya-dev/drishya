# Continue here — a compact handoff for the next agent

**Last implementation update: 5 October 2026.** Repository files are memory. Do not rely on a previous chat, model, desktop account or session transcript.

## Read in this order

1. [STATUS](STATUS.md) for active claims and the last completed work.
2. [AGENTS](../AGENTS.md) and [VISION](VISION.md) for constraints and creative intent.
3. [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) for audience, differentiated utility, content-shaped presentation and the builder's latest clarification.
4. [Baseline audit](review/06-baseline-audit.md) for what actually passed and what remains broken/unverified.
5. [IMPLEMENTATION_ROADMAP](IMPLEMENTATION_ROADMAP.md) for the next bounded implementation gate; [CODEBASE](CODEBASE.md) before edits.

## Preserve these decisions

- Live work is an **accumulating conversation/history**. Scrolling back holds the reader's place; capture and history continue. Return to latest is explicit. Default live UI is not a movie player. Optional recorded replay still needs deterministic as-of scenes.
- **Backend and infrastructure first, with a usable integrated base UI.** The backend draft is substantial but not complete. Privacy/recovery/history/scale/install gates precede premium expansion.
- `apps/ui` stays the integrated app. `docs/prototype/index.html` supplies interaction ideas, not production data or a final design. Neither current frontend is final.
- Visualization is central: agents top, interactive repo map behind, left-to-right content-shaped actions in the middle, actual agent prose beneath unboxed, native tools/MCP right, history downward. Quiet at rest; precise, interruptible relationship motion.
- Need is earned through faster comprehension/review: since-last-visit, one-file history, verification freshness, and accessible evidence. No fabricated causes, full-file content, internal reasoning or certainty from incomplete capture.
- Observe only; source files read-only; sanitize before every durable/output sink; DOM text; no telemetry. No prompts, approvals, agent launch or rollback controls.
- Keep current stack unless a measured gate justifies a scoped change. Schema changes require both builders. No automatic cloud model use or real-data sharing.

## Current evidence

B3 integrated reader/navigation work merged as PR #15 (`6346339`) after Windows/Linux CI. B4's first slice merged as PR #16 (`8df0a5d`). Its isolated CLI tarball passed clean offline install, synthetic imports/launch/API and CI on Windows, Linux and macOS. The repeatable normal synthetic backend/index probe is recorded in [B4 findings](review/07-b4-scale-install.md). A 100k-observation probe exposed quadratic reducer work, now fixed, but still uses ~764 MiB RSS and the browser still loads full projection. **B4 remains red/incomplete**; prioritize bounded history/worker/browser measurement over new visuals.

On 30 Sep, typechecks, 96 tests and Vite 8 build passed. Synthetic persistence/restart/API/viewerless live checks passed. Discovery saw 603 local sources. Four real journals were parsed/reduced/composed **in memory only**, zero parser exceptions; Claude exposed compaction and unsupported-record gaps. Two new synthetic sanitation probes failed. These results are scoped, not production certification.

The 30 Sep audit is historical evidence, not the current code status. B0/B1 fixes and the history-first integrated base UI were merged by 3 Oct. B2 history correctness now has synthetic tests for stable passage IDs, reader anchor logic, mixed-worktree paths and export, isolated reconstruction, late-result scene/renderer masking and explanation evidence. No new real journal was persisted or exported for this work.

## Next bounded task

B0–B2 are complete in the accepted baseline. B2 includes opted-in real Claude Code and Codex browser acceptance (`tests/browser/b2-real.spec.ts`, counts-only reporting). B3's integrated base UI is in the current branch with independent reader position, content-shaped expansion, paged material and bounded browser caches, session choice, file/tool navigation, and synthetic browser coverage. Merge B3 after CI; then measure and address B4 scale/install gates. Do not proceed straight to Pixi, new themes or model features.

After B0, prove real persisted baseline; then capture/reconnect lifecycle and stable live history. Bring the prototype's useful navigation into the integrated app. See roadmap B1–B4 for acceptance tests. The first premium feature is a useful return-to-work view, paired with the content-shaped visual system.

## End each session

Remove your claim; update your last-session block and relevant docs. Record decisions with reasons. Commit with the agent Co-Authored-By trailer. State exactly which checks ran and which remain unverified. Do not merge without the other builder's review. Do not repeat the old claim that the next step is only a cosmetic frontend pass.
