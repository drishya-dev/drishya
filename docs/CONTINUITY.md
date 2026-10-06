# Continue here — a compact handoff for the next agent

**Last implementation update: 6 October 2026.** Repository files are memory. Do not rely on a previous chat, model, desktop account or session transcript.

## Read in this order

1. [STATUS](STATUS.md) for active claims and the last completed work.
2. [AGENTS](../AGENTS.md) and [VISION](VISION.md) for constraints and creative intent.
3. [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) for audience, differentiated utility, content-shaped presentation and the builder's latest clarification.
4. [Baseline audit](review/06-baseline-audit.md) for what actually passed and what remains broken/unverified.
5. [IMPLEMENTATION_ROADMAP](IMPLEMENTATION_ROADMAP.md) for the next bounded implementation gate; [CODEBASE](CODEBASE.md) before edits.

## Preserve these decisions

- Live work is an **accumulating conversation/history**. Scrolling back holds the reader's place; capture and history continue. Return to latest is explicit. Default live UI is not a movie player. Optional recorded replay still needs deterministic as-of scenes.
- **5 Oct pacing clarification:** show captured tool input immediately, then resolve captured output in the same passage. Bursts and long text keep the camera at the first new work while the history accumulates below. Do not invent token streaming for final-only results. Optional replay dwells on the visible step; reduced motion does not shorten reading time. See [VISION](VISION.md) §0 and [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md).
- **Backend and infrastructure first, with a usable integrated base UI.** The backend draft is substantial but not complete. Privacy/recovery/history/scale/install gates precede premium expansion.
- `apps/ui` stays the integrated app. `docs/prototype/index.html` supplies interaction ideas, not production data or a final design. Neither current frontend is final.
- Visualization is central: agents top, interactive repo map behind, left-to-right content-shaped actions in the middle, actual agent prose beneath unboxed, native tools/MCP right, history downward. Quiet at rest; precise, interruptible relationship motion.
- Need is earned through faster comprehension/review: since-last-visit, one-file history, verification freshness, and accessible evidence. No fabricated causes, full-file content, internal reasoning or certainty from incomplete capture.
- Observe only; source files read-only; sanitize before every durable/output sink; DOM text; no telemetry. No prompts, approvals, agent launch or rollback controls.
- **Merge discipline (5 Oct):** keep each builder's feature scope in its own PR, integrate latest main and review conflicts semantically. Preserve both builders' work; never force-push/rewrite shared main or fold unrelated changes into another builder's PR. The builder explicitly authorizes reviewed green PR merges by Codex.
- Keep current stack unless a measured gate justifies a scoped change. Schema changes require both builders. No automatic cloud model use or real-data sharing.

## Current evidence

B0–B3 are accepted baseline work; P1's initial input/result and camera pacing slice is merged. **Latest builder direction: merge B4 engineering and proceed to P1, preserving the outstanding physical release checks.** The old long-session deferral is superseded. See [B4 reader evidence](review/08-b4-history-reader.md) for the implementation, APIs, limits, measurements and reproduction commands.

B4 now has a read-only captured-store worker, a separate derived disk index, bounded browser pages and artifact readers, conservative incremental reduction, global search/file/evidence/replay navigation, low-resource settings, explicit store usage/shared cleanup and checksummed offline package verification. Store schema 4 combines the normalized clock and explicit reading boundaries; observation JSON/schema is unchanged. Reducer `r2` copies preview strings and snapshots mutable metadata without duplicating immutable text. Large sessions (>10k observations or >32 MiB committed source offsets) avoid the full-projection browser path.

Local checks: 206 unit tests/typechecks, eight synthetic browser tests, two opted-in real sessions (Claude 292 operations/12 visible gaps; Codex 11 operations/zero gaps), offline worker install/restart and five repeated scroll-anchor checks. Normal map-on/5k-file p95 update 278 ms and peak daemon RSS 403 MiB; five independent 1 GiB shell-output imports peaked below 487 MiB in sampled RSS. Physical 8 GiB/integrated-GPU/lower-core and real macOS/Linux acceptance remain unverified. Full export/projection compatibility paths and arbitrary heavy unique edits are not certified bounded. Do not equate an engineering candidate with broad release readiness.

Harsh PR #21 is merged as `d190586` after all seven exact-head CI checks passed. Integration uses whole-session worker since facts, bounded previews/global counts and migrations from both previous schema-3 layouts. Keep private real-session selections out of commits. Pre-existing pnpm manifest/lock edits remain local and excluded.

On 30 Sep, typechecks, 96 tests and Vite 8 build passed. Synthetic persistence/restart/API/viewerless live checks passed. Discovery saw 603 local sources. Four real journals were parsed/reduced/composed **in memory only**, zero parser exceptions; Claude exposed compaction and unsupported-record gaps. Two new synthetic sanitation probes failed. These results are scoped, not production certification.

The 30 Sep audit is historical evidence, not the current code status. B0/B1 fixes and the history-first integrated base UI were merged by 3 Oct. B2 history correctness now has synthetic tests for stable passage IDs, reader anchor logic, mixed-worktree paths and export, isolated reconstruction, late-result scene/renderer masking and explanation evidence. No new real journal was persisted or exported for this work.

## Next bounded task

B4 PR #22 is merged as `445786f`. P1 PR #23 is merged as `5c487af`: content-shaped reading, a real repository lens, measured background/overview origins, adaptive patch columns, reversible terminal folding, parsed verification strips and all five finite signature cues. Read [09](review/09-p1-content-origins.md) for exact behavior and acceptance evidence. Typechecks/223 unit tests, 14 browser journeys, five repeated live cue journeys, the ten-minute synthetic reader and offline package verification passed; all seven exact-head CI jobs passed before merge. Local main is updated.

Latest builder emphasis: a transcript on another background and animated cards are insufficient. Presentation is the core product, including palette, hierarchy, useful spatial relationships and semantic motion. The P1 candidate does not freeze the design. Review the actual UI after substantial changes; do not claim it is market-first or that users prefer it from technical tests.

**6 October supersedes the earlier next-task queue:** P2-C PR #24 merged as `b6ac8b4`, credited only to its original authors Harsh/Claude; all seven main CI jobs passed. The separate P1 follow-up refreshes verification on live revisions and hides its whole-recording facts during optional replay. Do not rewrite Harsh's merge or add our attribution to it.

The builder requested a fresh visual exploration and explicitly clarified that developer essentials should stay visible. Native/MCP identities are persistent, the working agent/content is central, and **the left panel is not fixed**. Three interactive prototypes are retained under `apps/ui/public/concepts/`; serve `/concepts/index.html`. Read [10](review/10-p1-design-directions.md) before more UI work. Studio is the recommended default (combined chronology and reading width); Relay is an optional agent-comparison idea; Atlas is an expanded repository/light-theme study. These use the committed synthetic bundle, not live capture, and their passage sampler is not an as-of engine.

**Latest follow-up:** the builder proposed all three as ways to explore the same product. Accept Studio / Follow as default, Relay / Compare agents and Atlas / Explore repository as optional task views of one recording. Share worker/pages/artifacts/composer; preserve selection, per-view reading anchors, held/follow intent and replay cutoff across switches. Mount only the active heavy view. The synthetic prototypes do not yet implement this production switching contract; see [10](review/10-p1-design-directions.md).

**Visual follow-up:** the builder rejected dull colour/framing. The current candidate is petrol ink/jade, copper changes and lilac MCP identity; Relay is blue ink and Atlas sage paper. See VISION §5 and [10] for tokens, open material boundaries, finite instrument/file arrivals, contrast and interruption checks. PR #25 is merged as `c40657c`; its post-merge Linux browser job exposed a long-history end-measurement test assumption. The follow-up strengthens deliberate scrolling to the actual measured end (<2 px) instead of assuming ten wheels/32 px. Do not call the older main run green; the follow-up's exact-head and merged-main CI must pass. Preserve every prototype; production view switching is still next-stage implementation.

Next bounded implementation: carry Studio's hierarchy into the existing React reader, keeping its worker/pages, immediate input/late result, provenance and as-of semantics. Preserve all prototypes, then integrate Relay/Atlas in bounded stages. Do not freeze the present left list or replace the history with prototype DOM code. Follow with matched comprehension/preference tasks against the terminal transcript; P2-B file-centred comparison and physical B4 release acceptance remain separate work. No human preference or market-moat claim follows from technical tests.
## End each session

Remove your claim; update your last-session block and relevant docs. Record decisions with reasons. Commit with the agent Co-Authored-By trailer. State exactly which checks ran and which remain unverified. The builder explicitly authorizes Codex to verify and merge green PRs; retain each builder's original attribution and separate scope. Do not repeat the old claim that the next step is only a cosmetic frontend pass.
