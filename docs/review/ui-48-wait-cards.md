# UI-48 · Wait Cards: Shaped Placeholders with Zero Layout Shift

**Task:** UI-48 (P0 `ui` `motion`)  
**Specification:** Yash, 14 Nov: *"proper wait cards, i heard that wait cards also impact the user experience ... no idea how on current ui."*  
**Doctrine 1 & 10:** Quiet at rest, articulate in motion; clean and premium in the smallest things; no shimmer loop or pulsing glow; replaced in place so nothing jumps when content lands.

---

## 1. Design & Timing Integration

UI-48 builds directly upon the timing contract established and verified in **UI-47**:
1. **< 400 ms (Silent):** Fast loads (<400 ms) show nothing; content mounts instantly without any visual flash.
2. **400 ms – 2,000 ms (Quiet Wait Card):** Surfaces show a shaped placeholder (`WaitCard`) matching the exact geometry of the incoming content.
3. **> 2,000 ms (Wait Card + Explanation):** The wait card remains stable and adds a single plain explanation beneath it (e.g., explaining one-time history discovery).
4. **Failure:** Replaced with an error notice and interactive retry button.

---

## 2. Shaped Placeholders Across Surfaces

Each surface that waits has a bespoke skeleton tailored to its domain:

| Surface | Component | Geometry & Shape | Replaces In Place |
|---|---|---|---|
| **Git Network Graph** | `GitGraphWaitCard` | Title bar, zoom controls (`− 100% + Fit`), 6 horizontal branch lanes with node dots, commit drawer rows | Replaced by `GitNetworkGraph` + `CommitRows` |
| **History Passages** | `HistoryWaitCard` | Card header, tool operation rows, unboxed prose lines matching measured passage height (`minHeight`) | Replaced by passage operations & prose |
| **Files Explorer** | `FilesWaitCard` | 32px directory tree rows with folder/file icon boxes and filename bars | Replaced by `FolderExplorer` file items |
| **Source Reader** | `ReaderWaitCard` | Source code viewer with 42px gutter line-number bars and monospace code lines | Replaced by `WholeSource` code editor |
| **Home Sessions** | `HomeWaitCard` | Session list cards matching `.mh-session` (64px desktop / 84px mobile) with harness icon, title, subtitle, and badge | Replaced by session cards |

---

## 3. Zero Layout Shift (CLS = 0)

Layout shift was measured via `PerformanceObserver({ type: 'layout-shift' })` during automated Playwright browser test runs across both desktop viewports:

- **1440 px Desktop:** `Cumulative Layout Shift = 0.0000`
- **600 px Narrow Desktop:** `Cumulative Layout Shift = 0.0000`

### Engineering solutions ensuring zero layout shift:
1. **Branch Toolbar Facts Height:** `.atlas-branch-facts` occupies 1 line (18px) at 1440px and wraps to 2 lines (39px) at 600px. The skeleton placeholder renders matching 3-span bars with responsive `min-height: 18px` / `@media (max-width: 820px) { min-height: 39px }`, ensuring `.atlas-toolbar` never shifts `atlas-layout`.
2. **Header Commit Rows Toggle:** During loading, an invisible placeholder button (`visibility: hidden`) with identical 30px height is rendered in the header, preventing `Parent topology` from shifting when the `Commits · N` button mounts.
3. **Commit Rows Drawer:** When `rowsOpen` is true during loading, `.atlas-rows` renders skeleton commit rows (`.wait-card-commit-rows`) matching the drawer height (`min(30%, 210px)`), eliminating drawer mounting shifts.

---

## 4. Paint Policy & Reduced Motion

1. **Tokens-Only Paint:** Every background, border, surface, and line uses tokens from `apps/ui/src/tokens.css` (`var(--bg)`, `var(--s1)`, `var(--s2)`, `var(--s3)`, `var(--line)`, `var(--line-2)`). Verified by `palette-paint-policy.test.ts`.
2. **No Attention-Grabbing Shimmers:** Conforms strictly to Creative Doctrine 1. No continuous shimmer loops, glow pools, or pulsing animations. Skeletons render with a single, calm 160 ms entrance fade (`wc-fade-in 160ms ease both`).
3. **Static for Reduced Motion & Low Resource:** Under `@media (prefers-reduced-motion: reduce)`, `body.low-resource`, or `[data-motion="0"]`, all animations are disabled (`animation: none !important; opacity: 1 !important;`). Verified by automated tests.

---

## 5. Verification on Real Sessions

Checked against real local sessions of both harnesses across local repositories using `pnpm check:real`:
- **`local-branches`:**
  - Claude Code: 232 sessions, 73,437 hits (e.g. `rec_c8e5c9c8` · 83.7 MB · 2,695 operations · 13,538 observations)
  - Codex: 63 sessions (e.g. `rec_60715088` · 0.2 MB · 11 observations)
- **`wide-passages`:**
  - Claude Code: 71 sessions, 479 hits (e.g. `rec_c8e5c9c8` · 1,539 passages, 31 with 8+ cards)
  - Codex: 8 sessions, 17 hits (e.g. `rec_af2cd202` · 3.3 MB · 21 passages, 9 with 8+ cards)
- **`workspace-files`:**
  - Claude Code: 117 sessions, 5,722 hits (e.g. `rec_c8e5c9c8` · 637 file/shell calls)
  - Codex: 4 sessions (e.g. `rec_372f6b61` · 25.6 MB · 9 file/shell calls)

---

## 6. Test Suite Status

- `tests/browser/wait-cards.spec.ts`: **4 passed** (1440px and 600px layout shift CLS = 0; reduced motion static placeholder checks).
- `tests/browser/loading-messages.spec.ts`: **4 passed** (UI-47 timing and retry regression guard).
- `apps/ui/test/wait-card.test.ts`: **6 passed** (Unit tests for all wait card components and wrappers).
- `apps/ui/test/palette-paint-policy.test.ts`: **2 passed** (Palette token compliance).
- `corepack pnpm ui:build`: **clean build** (< 500 ms).
