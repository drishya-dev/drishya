# UI-31 — The sent-prompt capsule

12 November 2026, Gemini 3.8 Flash (Antigravity), [PR #426](https://github.com/drishya-dev/drishya/pull/426).

## What changed

- [`apps/ui/src/modern/conversation.css`](../../apps/ui/src/modern/conversation.css): refined `.turn`, `.turn-capsule`, `.turn-text`, `.turn-more`, `.turn-images`, `.prompt-attachments`, `.attachment-chip`, `.turn-mode`, and `.turn-ledger` using existing surface, hairline, and type tokens only. Replaced the saturated `--palette-active` fill and `20px 20px 6px 20px` tail with `--s2` surface, `1px solid var(--line)` border, symmetric `20px` radius, `line-height: 1.58`, `-0.005em` tracking, `--text-xs` (`12px`) tight-width `Show full prompt` / `Show less` control with reduced-motion-safe active press feedback, removed legacy left padding on `.turn-images`, gave `.attachment-chip` matching `--s2` / `--line` tokens, allowed `.turn-mode` and `.turn-ledger` to wrap cleanly within `600 px`, and preserved quiet unboxed `--text-sm` regular `--t2` styling for `.turn:has(.turn-source) .turn-capsule .turn-text` injected harness notices.
- [`apps/ui/src/components/SessionWorkspace.tsx`](../../apps/ui/src/components/SessionWorkspace.tsx): updated `NativeTurn` so newly submitted Modern prompts render `.turn-capsule` with `.turn-who` and `.turn-mode` matching persisted history before handoff.
- [`tests/browser/prompt-capsule.spec.ts`](../../tests/browser/prompt-capsule.spec.ts): verifies neutral `--s2` contrast (`>= 4.5:1`), `20px` radius, medium weight, `<= 1.65` line-height ratio, `12px` tight disclosure button, quiet `turn-source` notice styling, Codex desktop attachment chips and settings line, and `0` horizontal overflow at `600 px` and `1440 px` across `jet`, `midnight`, and `paper`.

## Verification

- **Checks (`task-3802`, after final code edit):**
  - `corepack pnpm typecheck` — passed.
  - `corepack pnpm ui:build` — passed.
  - `corepack pnpm exec vitest run apps/ui/test` — 116 files, 570 passed, 1 existing skip (`draft-recovery-filesystem.test.ts`), 0 failed.
  - `DRISHYA_BROWSER_CHANNEL=msedge DRISHYA_WORKERS=2 node scripts/test-browser.ts prompt-capsule conversation-chat turn-fold turn-ledger-recorded desktop-prompts image-only-prompt injected-messages session-typography palette-contrast connected-workspace large-screens composer-grows --retries=0` — **56 passed, 0 failed, 0 retries**.
- **Real local sessions (scratch Drishya home; before/after screenshots in `.local/ui-31/` at `600` and `1440` px in `jet`, `midnight`, and `paper`):**
  - Claude Code `rec_69977fa0` (`0.9 MB`, `42` ops, `12` person turns): long clamped turn, expanded full-prompt state, and 3-line image-attached turn.
  - Codex `rec_aca34202` (`0.3 MB`, `11` ops, `7` person turns): short prompt, long prompt, image turns, and multi-field settings metadata line.

## Plainly not checked / known gaps

- No local Claude Code or Codex turn was actively running on disk during capture, so live/running capsule continuity (`NativeTurn`) was verified in Playwright (`connected-workspace.spec.ts:598` — submission visible before native output) rather than an active live daemon stream.
- Full release gate and hosted CI were not run per house rules.
