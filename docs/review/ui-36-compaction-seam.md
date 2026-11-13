# UI-36 — A compaction reads as one seam in history

**Task:** Transform compaction evidence in history from a small card/form (with labelled bars, "relative scale", and machine fields) into a hairline seam across the reading column: context shrinking at true proportion, human numbers and durations, summary one click away, and a single Resolve arrival animation.

## Changes

1. **A seam, not a card (`apps/ui/src/components/ContextEvidence.tsx`, `apps/ui/src/components/context-evidence.css`):**
   - Replaced `<article className="context-evidence ...">` card presentation with a quiet hairline seam (`<section className="context-evidence" aria-label="Compaction">`).
   - Boundary header line: `<CompactionIcon />` (`14×14`, stroke 1.5, curved contract arrows), `<strong className="context-seam-title">Context compacted</strong>`, and muted `<small className="context-seam-time">{contextTime(boundary.time)}</small>`.
   - Subtle hairline rule (`border-top: 1px solid var(--line)`), 0 card padding/shadow/background.

2. **One track at true proportion:**
   - Single 180px track (`.context-track`) with rounded pill profile (`4px` height).
   - Solid bar (`.context-track-solid`) represents the remaining after tokens (e.g. `566,666 → 23,219` is `4%` of the track; `80k → 6k` is `7%`). When context window is recorded, faint track (`.context-track-faint`) represents the window proportion.
   - Human numbers: `formatTokens` converts numbers into clean strings (`566.7k`, `23.2k`, `80k`, `6k`, `1M`, `500`).
   - Computed metric string: e.g. `"566.7k → 23.2k tokens · 96% freed"`.

3. **Codex request readings and recorded window:**
   - Codex request-input readings labelled clearly: `"Last request before and first after · 80k → 9k tokens · 89% freed of 100k"`.
   - Full proportion against the model context window when recorded (`"of 272k"`, `"of 475k"`).

4. **Missing numbers:**
   - When token numbers are not recorded (e.g. before or after missing in journal or replay cutoff), no track bar is drawn; renders a single quiet line (`.context-missing-line`):
     - `"Last request before 80k · first after not recorded"`
     - `"Last request before not recorded"`
     - `"Tokens not recorded"`

5. **Words, not fields:**
   - Human durations and phrases (`triggerPhrase`):
     - Trigger and duration combined into one phrase: `"You compacted · 1 min 29 s"`, `"Compacted automatically · 41 s"`, `"Compacted automatically · 43 ms"`.
     - Dropped `"Trigger ·"`, `"Duration ·"`, and `"relative scale"`.

6. **Summary one click away:**
   - Summary button opens in place (`Summary` component) as captured text via `<ArtifactReader id={summary.artifactId} kind="output" provenance />`.
   - Unlinked summary displayed as `<div className="context-evidence context-unlinked">` so Landmark queries stay clean.
   - Encrypted Codex summary displayed as `"Summary encrypted by harness"`.

7. **Motion (Resolve, once):**
   - Arriving live (`state.mode === 'history' && atEnd`) or in replay playback (`state.mode === 'replay' && state.playing`), the solid track smoothly contracts from `beforeWidth%` to `afterWidth%` over 600ms ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`).
   - Static when scrolled back, under `prefers-reduced-motion: reduce`, `motion === false`, or `.viewer.still`.
   - Runs once per boundary ID via `animatedCompactions` set.

## Verification

### Unit tests
- **`apps/ui/test/compaction-seam.test.ts`**: 3 tests covering `formatTokens` (exact formatting, edge cases), `formatDuration` (ms, seconds, minutes and seconds), and `triggerPhrase` (manual, auto, millisecond durations). All pass.

### Browser specs
- **`tests/browser/compaction.spec.ts`**: Updated assertions for:
  - Header text (`"Context compacted"`), human tokens and percentages (`"80k → 6k tokens · 93% freed"`), human trigger phrase (`"You compacted · 3 s"`).
  - Single track assertion (`toHaveCount(1)`), measured track proportion matching `afterTokens / beforeTokens`.
  - Replay cutoff: future compaction stays hidden before its step; step-by-step advance verifies `"Last request before 80k · first after not recorded"` with track count 0, transitioning to full readings after the post-compaction request.
  - Missing before reading state: `"Last request before not recorded"` with track count 0.
- Executed on Edge (`DRISHYA_BROWSER_CHANNEL=msedge --retries=0`): `tests/browser/compaction.spec.ts` & `tests/browser/ship-2f-history.spec.ts`: **6 passed (14.8s)**.

### Real local sessions
Captured in scratch Drishya home, settled frames saved in `.local/ui-36/` at 600×900 and 1440×900 in Jet Black, Midnight, and Paper:
- **Claude manual compaction**: `42a5fd26` (step 787: `"You compacted · 1 min 19 s"`, summary displayed).
- **Claude automatic compaction**: `a1de5659` (step 356: `"Compacted automatically · 43 ms"`, `"221.6k → 14.1k tokens · 94% freed"`).
- **Codex window with readings**: `rollout-2026-11-07` (step 916: `"Last request before and first after · 449.9k → 0 tokens · 100% freed of 475k"`, `"Summary encrypted by harness"`).
- **Codex replay cutoff (missing after reading)**: `rollout-2026-11-07` (step 914: `"Last request before 449.9k · first after not recorded"`).
