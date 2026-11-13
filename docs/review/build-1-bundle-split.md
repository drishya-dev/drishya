# BUILD-1 — Split the UI bundle

**Task:** `ui:build` warned "Some chunks are larger than 800 kB" (`index` 1,213.55 kB, 366.05 kB compressed). Load heavy, rarely first surfaces on demand (Git graph, Changes, Workspace editor) with dynamic `import()`, give vendor code its own chunk via `manualChunks`, and ensure no chunk exceeds 800 kB while preserving immediate first paint and responsive UX.

## Changes

1. **Vendor chunking (`apps/ui/vite.config.ts`):**
   - Configured `build.rollupOptions.output.manualChunks` to split non-editor `node_modules` (React 19, ReactDOM, Zustand) into a distinct `vendor.js` chunk.
   - CodeMirror and Lezer remain co-located with the `DraftEditor` lazy chunk so the main application payload does not carry editor syntax trees on first load.

2. **Changes window code splitting (`apps/ui/src/components/CompareButton.tsx`, `apps/ui/src/components/CompareWindow.tsx`, `apps/ui/src/components/Viewer.tsx`):**
   - Extracted `CompareButton` into a dedicated lightweight component (`apps/ui/src/components/CompareButton.tsx`).
   - Lazy-loaded `CompareWindow` via `lazy(() => import('./CompareWindow.tsx'))` inside `Viewer.tsx`, wrapped in `<Suspense fallback={null}>` when `compareOpen` is active.
   - Re-exported `CompareButton` from `CompareWindow.tsx` for backwards compatibility.

3. **Git graph code splitting (`apps/ui/src/components/GitHistoryReader.tsx`, `apps/ui/src/components/GitHistory.tsx`):**
   - Extracted the heavy commit graph viewer, branch headers, and topology network into `apps/ui/src/components/GitHistoryReader.tsx`.
   - In `apps/ui/src/components/GitHistory.tsx`:
     - Retained the modeless `ReadingDialog` shell, focus trapping, and `GitAccess` ("Approve read-only Git") synchronously so access prompts mount without async layout shift or test timing glitches.
     - Lazy-loaded `GitHistoryReader` on demand when approved and opened.

4. **Workspace draft editor handling (`apps/ui/src/components/DeveloperWorkspace.tsx`):**
   - Added module-level event staging for `drishya-open-workspace-file` so rapid navigation events are preserved across mounting lifecycles.

## Measurements

### Before (origin/main baseline)
- `dist/assets/index-DdxdomM9.js`: **1,213.55 kB** (gzip: 366.05 kB) — [Vite warning: Some chunks are larger than 800 kB]
- `dist/assets/DraftEditor-BiM9dA22.js`: 563.06 kB (gzip: 200.75 kB)
- Initial entry payload: **1,213.55 kB** (gzip: 366.05 kB)

### After (BUILD-1)
- `dist/assets/index-BY7lBdzb.js`: **490.12 kB** (gzip: 147.19 kB) — **~60% reduction in entry chunk size**
- `dist/assets/vendor-D1Q-0Fgd.js`: **225.39 kB** (gzip: 71.44 kB)
- `dist/assets/GitAccess-YgWmHQ2S.js`: 434.54 kB (gzip: 131.02 kB)
- `dist/assets/CompareWindow-XNUWe9GG.js`: 30.81 kB (gzip: 10.04 kB)
- `dist/assets/GitHistoryReader-BV7M1Rhb.js`: 32.23 kB (gzip: 10.61 kB)
- `dist/assets/GitPatchReader-DpTeP9rQ.js`: 5.11 kB (gzip: 2.29 kB)
- `dist/assets/workspace-drafts-CHVtsX1i.js`: 3.57 kB (gzip: 1.72 kB)
- `dist/assets/DraftEditor-BtU5kyRF.js`: 557.12 kB (gzip: 197.98 kB)
- `dist/assets/rolldown-runtime-WkwZ5CU-.js`: 0.59 kB (gzip: 0.36 kB)
- **Warning limit (800 kB): ZERO chunks exceed 800 kB.** Vite emits zero warnings.
- Largest chunk across the build is `DraftEditor` at 557.12 kB (only fetched when editing files in Workspace).

## Verification

- `pnpm typecheck`: passed with 0 errors across `@drishya/ui` and all workspace packages.
- `pnpm ui:build`: succeeded in 432 ms with zero chunk-size warnings.
- Browser test coverage:
  - `git-access.spec.ts`: 3/3 passed.
  - `git-history-cache.spec.ts`: 2/2 passed.
  - `git-changes.spec.ts`: 4/4 passed.
  - `git-compare.spec.ts`: 9/9 passed.
  - `git-branches.spec.ts`: 2/2 passed.
  - `workspace-source-controls.spec.ts`: 1/1 passed.
  - `workspace-toolbar.spec.ts`: 4/4 passed.
  - `fresh-workspace.spec.ts`: verified Git timeline scrolls, Workspace editor indents and preserves line endings, large draft comparison, and source refresh.
