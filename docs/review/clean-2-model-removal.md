# CLEAN-2 — Remove parked Nebius/Nemotron model feature

**Task:** Remove every trace of the parked Nebius/Nemotron model feature from the product, server, UI, CLI, and current docs.

## Changes

1. **Deleted `packages/explain` (`packages/explain/package.json`, `packages/explain/src/index.ts`, `packages/explain/test/explain.test.ts`):**
   - Removed the unused explain package and removed `"@drishya/explain": "workspace:*"` from `apps/daemon/package.json`.

2. **CLI startup cleanly stripped (`apps/daemon/src/commands.ts`):**
   - Removed `Model features are off unless NEBIUS_API_KEY is set...` and the `Model:` status line from `drishya serve` startup log.

3. **Daemon API routes removed (`apps/daemon/src/server.ts`, `apps/daemon/src/history-worker.ts`, `apps/daemon/src/history.ts`):**
   - Removed `@drishya/explain` imports, `opts.model`, and `opts.complete`.
   - Removed `/v1/models` route and `llm` from `/v1/config`.
   - Removed `/v1/recordings/:id/explain`, `/v1/recordings/:id/briefing`, and `/v1/recordings/:id/labels` routes.
   - Removed `prepareBriefing`, `prepareExplain`, and `prepareLabels` from `apps/daemon/src/history-worker.ts`.
   - Removed `ModelConfig` and `prepare(...)` from `apps/daemon/src/history.ts`.
   - Updated `apps/daemon/test/server.test.ts` to remove model consent tests and model completions.

4. **UI components and data source cleaned (`apps/ui/src/api.ts`, `apps/ui/src/components/Viewer.tsx`, `apps/ui/src/components/ExplanationView.tsx`):**
   - Deleted `ExplanationView.tsx`.
   - Cleaned `api.ts`: removed `ExplainClaim`, `Explanation`, `ModelPreview`, `changedPreview`, `llm` from `Config`, and `explain`/`briefing` from `DataSource`, `daemonSource`, and `bundleSource`.
   - Updated `Viewer.tsx`: removed `ExplanationView` and `changedPreview` imports; removed generated briefing panel and `NEBIUS_API_KEY` hints while preserving the session summary metrics and the `SinceMarkSection` (which opens cleanly on the SinceMark pill).
   - Updated `apps/ui/test/card-evidence.test.ts` generator fixture to generic mock generator name.

5. **Docs and lockfile cleaned (`docs/`, `pnpm-lock.yaml`):**
   - Deleted `docs/HACKATHON.md`.
   - Removed `HACKATHON.md` and `packages/explain` entries from `docs/README.md` and `docs/CODEBASE.md`.
   - Updated historical notes in `docs/IMPLEMENTATION_ROADMAP.md`, `docs/review/123-harness-data-audit.md`, and `docs/TASKS.md`.
   - Ran `corepack pnpm install` to update `pnpm-lock.yaml`.

## Verification

### Grep verification
- Executed `git grep -i -E "nebius|nemotron|tokenfactory|NEBIUS_API_KEY"` across the entire repository.
- 0 matches outside dated history (`docs/STATUS.md` decisions log, `docs/TASKS.md` task description, and archived review documents 06, 122, 125).

### Typecheck and UI build
- `corepack pnpm typecheck`: 0 errors across all 14 projects.
- `corepack pnpm ui:build`: succeeded in 445ms with zero warnings.

### CLI startup
- Verified `apps/daemon/src/cli.ts serve`: starts cleanly with only version, open URL, data path, and no `Model:` line.

### Unit and browser tests
- Vitest daemon unit tests (`server.test.ts`, `git-branches.test.ts`, `git-compare.test.ts`, `git-compare-service.test.ts`): **54 passed (54)**.
- Playwright browser tests (`tests/browser/fresh-workspace.spec.ts`, `tests/browser/git-access.spec.ts`, `tests/browser/history-reader.spec.ts`): **78 passed (78)**.
