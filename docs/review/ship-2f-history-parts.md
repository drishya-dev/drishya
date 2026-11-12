# SHIP-2f: History tells its parts apart

Completed the six history differentiation fixes requested in the 12 Nov Opus review of `SHIP-2b` real-session frames:

1. **Thinking vs Answer** (`apps/ui/src/modern/large-screens.css`)
   - Scoped `.connected-workspace .history .prose.prose-reasoning:not(.reasoning-gap)` above the `atelier` / `history-ink` prose reset so recorded agent thinking renders in `--text-secondary`, `var(--text-sm)` (`13 px`), `line-height: 1.65`, and a `1 px` left rule tinted with `--agent`, with softened heading/bold weight (`--weight-medium`) and muted `--text-muted` toggle label. Agent answers stay full strength (`--text-primary`, `15 px`, `0 px` left rule).
2. **Notices** (`apps/ui/src/components/History.tsx`, `apps/ui/src/modern/conversation.css`, `apps/ui/src/modern/reading-windows.css`)
   - Rendered Modern injected notices (`.turn.turn-notice`) on a single quiet horizontal line with a per-kind stroke `NoticeIcon`, left `1 px` hairline (`--line-2`), and single-line ellipsized text.
   - Replaced unexplained `▸ Text` disclosures with a labelled `12 px` `<summary>Original notice</summary>` toggle shown only via `rawNoticeAddsInfo()` when raw text adds structure beyond the summary (e.g. XML `<task-notification>` / reminder payloads, multiline text, or truncated summaries), suppressing redundant toggles on `[Request interrupted by user]` and plain tag-only command echoes.
3. **Orphan chevrons** (`apps/ui/src/components/History.tsx`)
   - Added `turnBodies` tracking so `.turn-fold` never mounts on body-less prompts (including long prompts with `Show full prompt`) or injected notices. When a body turn folds before ledger summary items exist (`parts.length === 0`), `.turn-fold` includes a `12 px` `.turn-fold-label` (`Show reply` / `Hide reply`) so no icon-only lone `⌄` button appears.
4. **Compaction** (`apps/ui/src/components/ContextEvidence.tsx`, `apps/ui/src/components/context-evidence.css`, `apps/ui/src/components/History.tsx`, `apps/ui/src/modern/conversation.css`)
   - Added `CompactionIcon` beside `Context compacted`, expanded `.context-evidence` across the full reading column (respecting PromptRail clearance) with quiet top/bottom seams, and suppressed the redundant `/compact` notice turn when `useHasVisibleCompaction()` confirms the passage displays the compaction boundary (preserving any `/compact <args>` note inside the compaction seam).
5. **Cards at 600 px** (`apps/ui/src/modern/large-screens.css`)
   - Under `@media (max-width: 720px)`, expanded operation cards and `.browser-strip` to `100%` of the reading column (clearing the narrow PromptRail lane) instead of staying capped at compact `210–370 px` widths.
6. **Plan cards** (`apps/ui/src/components/common.tsx`)
   - Mapped internal `-v1` derivation IDs in `Provenance` via `DERIVED_RULE_MEANING` (e.g. `claude-desktop-update-plan-v1` → `Compared with the previous plan`, `codex-proposed-plan-v1` → `Proposed plan from output`) while preserving the raw rule ID on `title` hover and keeping custom test rule IDs intact.

## Verification

### Automated checks
- `corepack pnpm typecheck` — passed.
- `corepack pnpm exec vitest run apps/ui/test/` — `119` files, `587` passed (`1` existing skip).
- `corepack pnpm ui:build` — passed.
- `tests/browser/ship-2f-history.spec.ts` (Edge, `--retries=0`) — `1` passed across `600 px` & `1440 px` and `jet`, `midnight`, `paper` for both synthetic Claude Code and synthetic Codex sessions.
- Targeted Edge specs (`prompt-capsule.spec.ts`, `product-workspace.spec.ts`, `conversation-chat.spec.ts`, `--retries=0`) — `32/32` passed after updating two outdated assertions in `product-workspace.spec.ts` (the leftover `390 px` narrow-width card limit and querying `.prose` instead of `.prose:not(.prose-reasoning)` for answer font size) and updating `.turn:has(.turn-source)` notice selectors in `prompt-capsule.spec.ts` and `conversation-chat.spec.ts` from `.turn-capsule` to `.turn-notice-main` / `.turn-text`.
- `corepack pnpm check:affected` (`DRISHYA_BROWSER_CHANNEL=msedge`) — `typecheck`, related units (`4/4`, `17` tests), `ui:build`, `799` parallel browser tests and `30` serial browser tests passed (the only remaining failures are the pre-existing `origin/main` failures in `prompt-timeline.spec.ts:22`, `b2-live.spec.ts:63,197`, and `classic-refinement.spec.ts:130`).

### Real local session verification (scratch store; screenshots kept privately in `.local/ship-2f/`)
Verified before and after frames at `600 px` & `1440 px` across `jet`, `midnight`, and `paper`:
- **Claude Code `42a5fd26`** (`7.15 MB`, `16` prompts, `250` passages, compaction step `784`): expanded thinking (`13 px`, `1 px` left rule, `rgb(208, 209, 217)` in Jet) visually distinct from full-strength answer (`15 px`, `0 px` border), full-width `Context compacted` seam (`Before 804,303 -> After 13,916 tokens`, icon + bars + `Read summary`), `0` orphan fold chevrons.
- **Claude Code `a1de5659`** (`rec_4b4e6b7aaab91336`, `54` passages, plan `toolu_01RfA5Tf7eoX3AiRHU8gG7qW`): single-line `Claude Code · reminder` notice with icon + `Original notice`, plan card expanding at full `542 / 542 px` width (`600 px`) and `370–440 / 874 px` (`1440 px`) with `Derived · Compared with the previous plan`.
- **Claude Code `4b71dd98`** (`29` prompts, `206` passages, compaction step `877`): full-width compaction seam, labelled turn fold summary, quiet single-line `Claude Code · command output` notice, `0` orphan chevrons.
- **Codex `34365106`** (`23` prompts, `314` passages, compaction `cmp_obs_35753c9b269bd5d8042a87a0`): full-width `Context compacted` seam (`542 px` at `600 px`, `858 px` at `1440 px`, icon + `Summary encrypted by harness`), quieter `Reasoning summary` with `1 px` left rule, `542 / 542 px` full-column cards at `600 px` and compact `440–520 / 874 px` at `1440 px`, `0` orphan chevrons.
- `corepack pnpm check:real`: `plan-material` matched `36` local Claude Code sessions (`rec_554b9318`, `0` local Codex sessions < 90 MB — Codex proposed-plan provenance verified synthetically in `ship-2f-history.spec.ts`; Codex does not emit Claude injected user notices); `compaction` matched `19` Claude Code sessions & `3` Codex sessions (`rec_7cb1cda1`); `injected-messages` matched `58` Claude Code sessions (`rec_fa9c8f90`).
