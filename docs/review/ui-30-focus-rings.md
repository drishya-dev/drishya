# UI-30 — Focus rings only where they help

12 November 2026, Gemini 3.8 Flash (Antigravity), branch `gemini/ui-30`.

## What changed

- [`apps/ui/src/lib/focus-modality.ts`](../../apps/ui/src/lib/focus-modality.ts), [`apps/ui/src/main.tsx`](../../apps/ui/src/main.tsx), [`apps/ui/src/App.tsx`](../../apps/ui/src/App.tsx): tracks the latest input modality (`'pointer' | 'keyboard'`) on `document.documentElement.dataset.inputModality`. Defaults to `'pointer'` before first paint, switches to `'keyboard'` in capture phase for non-modifier `keydown` events (ignoring bare `Shift`, `Control`, `Alt`, `Meta`, `CapsLock`, `NumLock`, `ScrollLock`, `Fn`, `FnLock`), and resets to `'pointer'` in capture phase on `pointerdown` / `mousedown` before programmatic focus restoration (e.g. closing menus/dialogs or toggling disclosures) runs.
- [`apps/ui/src/tokens.css`](../../apps/ui/src/tokens.css): adds `--focus-ring: color-mix(in srgb, var(--t2, #c1c1bd) 82%, transparent)` across Jet Black, Midnight, and Paper/Daylight (`Highlight` under `@media (forced-colors: active)`).
- [`apps/ui/src/modern/finishing.css`](../../apps/ui/src/modern/finishing.css): replaces the `2px solid var(--focus)` blanket ring with:
  1. One low-specificity (`:where(...)`) unified control focus ring (`1px solid var(--focus-ring); outline-offset: 2px;`) shown only when `:not([data-input-modality="pointer"])`.
  2. Explicit pointer suppression (`[data-input-modality="pointer"] ... :focus-visible { outline: none; }`).
  3. Explicit perimeter suppression (`outline: none`) in every modality on scrollable regions, viewports, readers, lists, CodeMirror editors, and hidden checkboxes (`.history`, `[role=region]`, `[role=tabpanel]`, `.diff-scroll`, `.git-raw-scroll`, `.source-reading`, `.source-reading>.code`, `.desk-code`, `.desk-markdown`, `.desk-pane`, `.desk-document`, `.context-summary-reader`, `.pinned-reference`, `.file-heading`, `.current-file-code`, `.browser-excerpt`, `.resource-detail`, `.resource-source`, `.resource-original`, `.document-material`, `.data-viewport`, `.data-original`, `.data-selection>pre`, `.delimited-viewport`, `.atlas-full-message`, `.thread-viewport`, `.network-viewport`, `.original-text`, `.md-table-scroll`, `.mh-workspace-list`, `.mh-session-list`, `.modern-settings-content`, `.md-inventory-list`, `.md-code`, `.cm-content`, `.history-prompt-marks`, `.remember-check>input`).
  4. Quiet inner top-edge focus cue (`box-shadow: inset 0 2px color-mix(in srgb,var(--focus-ring) 70%,transparent)`) for `.desk-pane` headers / empty states when reached by keyboard.
- [`apps/ui/test/focus-modality.test.ts`](../../apps/ui/test/focus-modality.test.ts) & [`tests/browser/focus-rings.spec.ts`](../../tests/browser/focus-rings.spec.ts): unit test for `installFocusModality` and browser spec covering pointer-after-keyboard (type in composer, click `.checkout-picker > summary` and close, click `.history`), keyboard `Tab` neutral 1 px rings across all three palettes (`jet`, `midnight`, `paper`) at `600` and `1440` px, modal `Close` vs `Escape` focus return, and suppressed perimeter outlines on `.history`, `.md-code`, and Workspace `.desk-pane`.

## Complete focus rule audit

### Removed rules (superseded by the unified control ring + region suppression in `modern/finishing.css` and `styles.css`)

- `apps/ui/src/atelier.css`: `:root :is(button, summary, input, select, textarea):focus-visible` (`2px solid var(--focus); outline-offset: 3px`)
- `apps/ui/src/classic.css`: `.product-dialog :is(input, textarea, select):focus-visible, .home :is(input, select):focus-visible`, `.source-reading > .code:focus-visible`, `.git-raw-scroll:focus-visible`, `.product-dialog :is(input,textarea,select):focus-visible`, `:root[data-ui-press] .product-dialog :is(button,input,textarea,select):focus-visible`
- `apps/ui/src/components/FencedCode.css`: `:root .fenced-material .md-code.md-code:focus-visible` (`.md-code` is a region/scroller and no longer draws a perimeter outline)
- `apps/ui/src/components/browser-evidence.css`: `.browser-scrubber :focus-visible,.browser-url:focus-visible`
- `apps/ui/src/components/captured-content.css`: `.captured-data-choice select:focus-visible`
- `apps/ui/src/components/compare-window.css`: `.compare-window button:focus-visible,.compare-window input:focus-visible,.compare-window summary:focus-visible`, `.compare-note-box textarea:focus-visible,.compare-handoff textarea:focus-visible`
- `apps/ui/src/components/delegation-detail.css`: `.delegation-thread>summary:focus-visible`
- `apps/ui/src/components/file-evidence.css`: `.folder-explorer .tree-evidence-filter summary:focus-visible, .folder-explorer .tree-evidence-filter-menu button:focus-visible`
- `apps/ui/src/components/git-branches.css`: `.atlas-branch-control select:focus-visible`
- `apps/ui/src/components/library-search.css`: `outline`/`outline-offset` removed from `.product-dialog.library-search :is(input,select):focus-visible` (kept `box-shadow:none;border-color:var(--line-3);`)
- `apps/ui/src/components/modern-replay.css`: `.modern-replay-transport :is(button,select,input):focus-visible`
- `apps/ui/src/components/op-images.css`: `.path-image-reader-open:focus-visible`
- `apps/ui/src/components/original-toggle.css`: `.original-toggle:focus-visible`
- `apps/ui/src/components/review-changes.css`: `.review-file-edits button:focus-visible`, `.review-net button:focus-visible`, `:root[data-ui-version=modern] .review-file-more>summary:focus-visible`
- `apps/ui/src/components/review-insights.css`: `outline`/`outline-offset` removed from `.finding-member-intro input:focus-visible`, `.finding-category select:focus-visible`
- `apps/ui/src/components/screen-view.css`: `.screen-view :is(button):focus-visible`
- `apps/ui/src/components/tools-panel.css`: `.tool-trail button:focus-visible`
- `apps/ui/src/components/ui-versions.css`: `.dv-tabs button:focus-visible,.dv-version:focus-visible` (`2px solid var(--focus)`)
- `apps/ui/src/components/web-results.css`: `.web-more:focus-visible,.web-result-pages button:focus-visible`
- `apps/ui/src/developer-workspace.css`: `.folder-explorer .ux-search:focus-within` replaced `outline: 1px solid var(--t3)` with `border-color: var(--line-3)`; removed `.desk-edit-toggle:focus-visible`, `.desk-options>summary:focus-visible`; updated `.desk-pane:focus-visible { outline: none; }`
- `apps/ui/src/ink.css`: `.source-utilities > summary:focus-visible`
- `apps/ui/src/modern/github-star-link.css`: `.home-github-star:focus-visible`
- `apps/ui/src/modern/interaction-polish.css`: `.mh-session-list:focus-visible,.mh-workspace-list:focus-visible` (regions suppressed)
- `apps/ui/src/modern/tool-inventories.css`: `.modern-toolbox .md-inventory-list:focus-visible` (region suppressed)
- `apps/ui/src/p1.css`: `.viewer :focus-visible`
- `apps/ui/src/polish.css`: `:focus-visible`
- `apps/ui/src/product.css`: `.structured-output-controls button:focus-visible`
- `apps/ui/src/stage.css`: `.review-open:focus-visible, .review-files button:focus-visible, .review-item button:focus-visible`
- `apps/ui/src/studio.css`: `:root[data-experience='classic'] button:focus-visible, :root[data-experience='classic'] summary:focus-visible`
- `apps/ui/src/styles.css`: `button.md-path:focus-visible`
- `apps/ui/src/workbench.css`: `:root[data-experience=studio] :is(button,summary):focus-visible`

### Unified & modality-gated component rules (converted from `--t2`/`--t3`/`--focus` to `1px solid var(--focus-ring)` and `:root:not([data-input-modality="pointer"])`)

- `apps/ui/src/styles.css`: `:root:where(:not([data-input-modality="pointer"])) :focus-visible` (`1px solid var(--focus-ring); outline-offset: 2px; border-radius: var(--round-xs)`)
- `apps/ui/src/modern/finishing.css`: `:root:where([data-ui-version=modern]:not([data-input-modality="pointer"])) :where(...):focus-visible` (`1px solid var(--focus-ring); outline-offset: 2px`) + pointer suppression + region/scroller `outline: none`
- Inset/tight/custom overrides preserved with `var(--focus-ring)` and keyboard-modality gate where elements live inside clipping scrollers, compact headers, graph dots, resize dividers, or custom focus rings:
  - `apps/ui/src/atelier.css`: `.home-search:focus-within` (`1px solid var(--focus-ring); outline-offset: 1px`)
  - `apps/ui/src/components/FencedCode.css`: `.fenced-material > .fenced-header .fenced-actions button:focus-visible`
  - `apps/ui/src/components/captured-file-path.css`: `.history .op-title.captured-file-path:focus-visible` (`outline-offset: -1px`)
  - `apps/ui/src/components/captured-outcomes.css`: `.captured-outcomes .case-bar:focus-visible` (`outline-offset: 1px`)
  - `apps/ui/src/components/captured-resources.css`: `:is(.resource-list>button,.resource-actions :is(a,button),.resource-modes button):focus-visible` (`outline-offset: -2px`)
  - `apps/ui/src/components/commit-rows.css`: `.commit-row:focus-visible` (`outline-offset: -2px`)
  - `apps/ui/src/components/git-history.css`: `.git-atlas :is(button,input,select):focus-visible` (`outline-offset: -2px`)
  - `apps/ui/src/components/git-network-graph.css`: `.thread-graph.network-graph .network-commit:focus-visible` (`outline-offset: 1px`)
  - `apps/ui/src/components/git-thread-graph.css`: `.thread-stage.lit .thread-commit:focus-visible`, `.thread-zoom>button:focus-visible` (`-2px`), `.thread-branch-chip>button:focus-visible` (`-1px`)
  - `apps/ui/src/components/link-card.css`: `.link-card-anchor[data-link-kind="commit"|"branch"]:focus-visible` (`outline-offset: 1px`)
  - `apps/ui/src/components/queued-inputs.css`: `.queue-row:focus-visible` (`outline-offset: 1px`)
  - `apps/ui/src/components/source-reader-compact.css`: `.current-reader-options>summary:focus-visible` (`outline-offset: -2px`)
  - `apps/ui/src/components/structured-data.css`: `:is(.data-reader-toolbar button,.data-selection button,.data-inspection>button,.data-tree-row):focus-visible`, `.delimited-viewport button:focus-visible` (`outline-offset: -2px`)
  - `apps/ui/src/components/tools-panel.css`: `.tool-search:focus-visible` (`1px`), `.tool-row:focus-visible` (`-2px`)
  - `apps/ui/src/developer-workspace.css`: `.desk-divider:focus-visible` (`-1px`), `.desk-options-body>.btn:focus-visible` (`-2px`)
  - `apps/ui/src/modern/composer.css`: `.composer-menu-trigger:focus-visible` (`1px`)
  - `apps/ui/src/modern/interaction-polish.css`: `.workspace-utilities :is(button,a,summary):focus-visible` (`-2px`), `.mh-session-open:focus-visible` (`2px`)
  - `apps/ui/src/modern/quiet-scrollbars.css`: `.reading-resize:focus-visible` (`-1px`)
  - `apps/ui/src/modern/reading-windows.css`: `.reading-window-edge:focus-visible` (`-2px`), `.reading-window-height:focus-visible` (`-2px`), `.file-peek-tab button:focus-visible` (`-2px`), `:is(.file-peek-reader>header,.file-peek-reader>.reading-window-tabs):focus-visible` (`-2px`), `.op-info:focus-visible` (`1px`), `.history :is(.turn-more,.turn-fold):focus-visible` (`border-radius: var(--round-xs)`)
  - `apps/ui/src/modern/remember.css`: `.remember-check>input:focus-visible+.remember-box` (`1px solid var(--focus-ring); outline-offset: 2px`)
  - `apps/ui/src/stage.css`: `.dock :is(.instrument,.server-tool):focus-visible` (`-1px`)

### Intentionally kept rules

- Inner input borderless suppressions where the parent container renders the focus cue: `.search .search-field input`, `.mh-search input`, `.ux-search input`, `.prompt-composer textarea`, `.workspace-navigation-query`, `.commands-toolbar input:focus`, `.web-result-filter input:focus-visible` (`outline: none`), and `.viewer .cm-content:focus-visible { outline: none; }` (`draft-editor.css`).
- `.history article[data-reading-focus]` (`reading-keys.css`): updated from `var(--focus)` `outline-offset: 3px` to `1px solid var(--focus-ring); outline-offset: 2px;` so `r`/`j`/`k` keyboard reading navigation keeps its neutral cursor cue.
- `.desk-pane.active .desk-document>header` (`developer-workspace.css`): existing 1 px top accent hairline inside the active Workspace pane header (and `--focus` on checkbox checked fill, `::selection`, and `button.held` status pill — none are focus rings).

## Verification

- **Typecheck & UI unit suite:** `corepack pnpm typecheck` passed; `corepack pnpm exec vitest run apps/ui/test` passed (**117 test files, 571 passed, 1 pre-existing skip**, including `apps/ui/test/focus-modality.test.ts`).
- **Targeted Edge browser specs (`DRISHYA_BROWSER_CHANNEL=msedge`, `DRISHYA_WORKERS=2`, `--retries=0`):**
  - Batch 1 (`focus-rings.spec.ts`, `interface-craft.spec.ts`, `ui-recovery.spec.ts`, `header-cluster.spec.ts`, `reading-keys.spec.ts`, `fenced-code.spec.ts`, `files-16-picker.spec.ts`, `git-graph-focus.spec.ts`, `palette-contrast.spec.ts`, `product-workspace.spec.ts`): **76 passed, 1 existing skip, 0 failures**.
  - Batch 2 after final `styles.css` specificity refinement (`focus-rings.spec.ts`, `interface-craft.spec.ts`, `reading-keys.spec.ts`, `ui-recovery.spec.ts`): **14 passed, 1 existing skip, 0 failures**.
- **Genuine local sessions (scratch Drishya home; 600×900 & 1440×900; `jet`, `midnight`, `paper`; screenshots inspected in `.local/ui-30/` only):**
  - Claude Code `rec_ebc58aff` (`11.4 MB`, `528` ops) and Codex `rec_73cbf2eb` (`0.2 MB`, `10` ops): across all 12 `(harness × width × palette)` combinations, typing in the prompt composer switched `data-input-modality` to `keyboard`, clicking `.checkout-picker > summary` and closing it returned `pointer` with `outlineStyle: none` (no lavender ring), clicking into `.history` left `outlineStyle: none` (no vertical edge ring), pressing `Tab` restored `keyboard` with `1px solid var(--focus-ring)` on `.checkout-picker > summary` and header buttons, and focusing `.history` under `keyboard` kept `outlineStyle: none`.
