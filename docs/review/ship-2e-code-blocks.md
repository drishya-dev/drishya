# SHIP-2e — Code and text blocks in agent prose

12 November 2026, Gemini 3.8 Flash (Antigravity; continuing Codex Luna 6's `codex/ship-2e` branch), [PR #419](https://github.com/drishya-dev/drishya/pull/419).

## What changed

- [`apps/ui/src/components/FencedCode.css`](../../apps/ui/src/components/FencedCode.css): dedicated token-only stylesheet for `.fenced-material` across Jet Black, Daylight and Midnight. Sets content sizing (`width: fit-content; max-width: min(100%, 100ch)`) with `.desk-markdown` left-edge alignment to Workspace's `80ch` preview measure, a quiet `--s1` header with `1px solid var(--line)` separation and `14px` optical inset, header `Wrap` and `Copy` controls hidden at rest (`opacity: 0`) on hover-capable pointers until `:hover`, `:focus-within`, or `[data-copy-status]` (always reachable on touch/focus, `120ms var(--ease-out)` under reduced-motion/low-resource guards), and a mono `--s2` code body (`var(--text-xs)/1.65 var(--mono)`, `padding: 12px 14px`, internal scroll `max-height: 65vh`).
- [`apps/ui/src/components/FencedCode.tsx`](../../apps/ui/src/components/FencedCode.tsx): expands language normalization (`plaintext`, `sh`/`bash`/`zsh`, `powershell`/`ps1`/`pwsh`, `ts`/`tsx`/`mts`/`cts`/`js`/`jsx`/`mjs`/`cjs`, `py`, `yml`, `rb`, `jsonc`, `patch`); skips `<Highlighted>` completely for unlabelled, `text`, `txt`, `plaintext` and unknown languages so zero `.tk-*` spans ever render; defaults `Wrap` ON for prose text blocks and OFF for code and unknown languages; keeps `Copy as one line` for multi-line prose blocks; shows in-place `Copied` / `Copied as one line` confirmation (1800 ms timer cleaned on unmount or prop change) via `data-copy-status` and an error-visible `role="status"` live region; adds per-row diff semantics (`fenced-diff-meta`, `fenced-diff-hunk`, `fenced-diff-add`, `fenced-diff-del`).
- [`apps/ui/src/lib/highlight.tsx`](../../apps/ui/src/lib/highlight.tsx): adds dedicated `tokenizeDiff` (metadata headers in `--tk-com`, `@@ ... @@` hunk headers in `--tk-property`/`--tk-com`, `+`/`-` prefixes without JS keyword/number leakage) and `tokenizeShell` (muted `--tk-com` `$ `, `% `, `PS ...> ` prompts and `#` comments, structural `--tk-fn` commands across pipelines, wrappers, `g++`/`./main` binaries and `FOO=bar cmd` assignments, `--tk-property` flags/variables/scoped packages, `--tk-str` quotes and `@'` here-strings, stopping false JS `type` tinting on uppercase paths such as `README.md`), and gives JSON `"key":` properties `--tk-property` distinct from `--tk-str` string values.
- [`apps/ui/test/fenced-code.test.ts`](../../apps/ui/test/fenced-code.test.ts) & [`tests/browser/fenced-code.spec.ts`](../../tests/browser/fenced-code.spec.ts): 4 new Vitest unit cases and 2 browser tests (600 px and 1440 px, Jet Black / Daylight / Midnight).

## Verification

- **Unit & check:affected (after final code commit `beb3d18b`):**
  - `corepack pnpm check:affected` passed: both TypeScript projects, 13 related UI unit files (52 tests including `test/fenced-code.test.ts`), `ui:build`, and `tests/browser/fenced-code.spec.ts` (2 passed at 600 px and 1440 px).
  - `corepack pnpm --filter @drishya/ui exec vitest run test/palette-contrast.test.ts test/palette-paint-policy.test.ts`: 2 files / 3 tests passed.
- **Targeted Edge browser suite (after final code commit `beb3d18b`):**
  - `DRISHYA_BROWSER_CHANNEL=msedge DRISHYA_WORKERS=2 node scripts/test-browser.ts tests/browser/fenced-code.spec.ts tests/browser/prose-tables.spec.ts tests/browser/conversation-chat.spec.ts tests/browser/palette-contrast.spec.ts tests/browser/fresh-workspace.spec.ts tests/browser/workspace-real-review.spec.ts --retries=0`: **87 passed, 15 existing skips, 0 failures**.
- **Genuine local sessions (scratch Drishya home, 600 px & 1440 px, `jet` / `paper` / `midnight`; private frames in `.local/ship-2e/` only):**
  - Claude Code `rec_ab67986c` (`0.43 MB`, 2 fenced blocks: `json`, `csv`): `json` compact (`600px` inside `809px` prose column), 12 semantic spans (`tk-property`, `tk-str`, `tk-num`, `tk-kw`), hover reveals controls (`opacity: 0 -> 1`); `csv` compact (`142px`), `0` spans, `Wrap` OFF.
  - Claude Code `rec_39af3c94` (`13.87 MB`, 140 fenced blocks: `bash`, `powershell`, unlabelled, `latex`, `markdown`, `python`): `bash` `614px` (7 spans, `docker`/`xargs` as `fn`, flags as `property`); short `powershell` `181px`, long `powershell` capped at `809px` with internal horizontal scroll (`scrollWidth=1048 > clientWidth=807`) and `0` page overflow; unlabelled multi-line note `593px`, `0` spans, `Wrap` ON, `Copy as one line` shown.
  - Codex `rec_73cbf2eb` (`0.24 MB`, 1 `ts` block): compact `206px` (`<=809px`), 3 spans.
  - Codex `rec_58787f2c` (`31.27 MB`, 6 fenced blocks: `powershell`, `text`, `bash`): `bash` (`g++` colored whole as `fn`) & `powershell` compact `438px` (`<=809px`).
  - Codex `rec_aca34202` (`0.31 MB`, 1 `diff` block): compact `227px` (`<=809px`), `fenced-diff-add` wash & tokens rendered cleanly at 600 px and 1440 px across Jet Black, Daylight and Midnight.

## Known gaps

- Local Claude Code journals `<= 90 MB` scanned did not contain `diff` or `ts` fenced blocks (4 journals `> 90 MB` skipped by scan cap), and local Codex journals `<= 90 MB` scanned did not contain `json` fenced blocks; synthetic coverage in `tests/browser/fenced-code.spec.ts` exercises every block type together across both widths and all three palettes.
- Direct side-by-side live screenshot against the external Claude Desktop app was not automated because Claude Desktop runs outside Drishya's browser test harness (reviewed visually against the single screenshot attached in `TASKS.md`).
