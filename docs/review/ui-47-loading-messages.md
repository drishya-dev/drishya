# UI-47 · Loading messages that match the wait

**Task:** UI-47 (P0 `ui` `perf`)  
**Specification:** Yash, 14 Nov: *"for somethings like git graph, it takes a lot of time to load the first time, so ask the user to wait and not close the window, similarly other components give proper messages according to the state and how much time they take, if less time than they will wait, but if more than proper message."*

---

## 1. Measured Load Times (First vs Repeat)

Measured on local real sessions of both harnesses across local repositories:
- **Codex real session:** `rec_fa9e37daee9f58c4` (1,735 observations, Drishya root repository)
- **Claude Code real session:** `rec_5ee6b391f452bd9c` (2,400 observations, Drishya worktree repository)

Measurements performed via Node 24 loopback daemon server:

| Surface | First load (uncached) | Repeat load (cached) | Threshold tier |
|---|---|---|---|
| **1. The Git graph** (`GitHistoryReader`) | **3,231 ms** (Codex) / **1,352 ms** (Claude) | **875 ms** (Codex) / **655 ms** (Claude) | Long (>2 s) on cold/uncached; Quiet (400 ms–2 s) on repeat |
| **2. Changes** (`CompareWindow` uncommitted) | **922 ms** | **967 ms** | Quiet (400 ms–2 s) |
| **3. Compare** (`CompareWindow` refs/diff) | **389 ms** | **432 ms** | Immediate (<400 ms) to Quiet (~400 ms) |
| **4. Files & first index** (`FolderExplorer`) | **313 ms** (cold) / **30 ms** (warm) | **6–15 ms** | Immediate (<400 ms); Quiet/Long if cold on giant tree |
| **5. Peek** (`CurrentDocument`) | **18 ms** | **18 ms** | Immediate (<400 ms) |
| **6. Workspace** (`DeveloperWorkspace`) | **17 ms** | **16 ms** | Immediate (<400 ms) |
| **7. Search** (`LibrarySearch` & session search) | **4–8 ms** | **3–7 ms** | Immediate (<400 ms) |
| **8. Opening a large session** (`Viewer` / projection) | **15 ms** (Codex 1.7k) / **6 ms** (Claude 2.4k) | **9 ms** / **6 ms** | Immediate (<400 ms); Quiet/Long on 10k+ observation journals |
| **9. Home session list** (`SessionHome` / discovery) | **252 ms** (discovery) / **21 ms** (recordings) | **245 ms** (discovery) / **1 ms** (recordings) | Immediate (<400 ms) |
| **10. Usage** (`RecordedUsage` / storage) | **5 ms** | **1 ms** | Immediate (<400 ms) |

---

## 2. Threshold Contract

- **Under ~400 ms (`immediate` phase):**
  Show nothing extra. No spinners, no pulsing text, no flickers. Fast loads resolve silently and cleanly.
- **Between 400 ms and 2,000 ms (`quiet` phase):**
  Show the surface's quiet wait state or placeholder (preserving layout structure so nothing jumps).
- **Beyond 2,000 ms (`long` phase):**
  Render one plain line in Drishya's calm voice describing what is occurring, and where true, clearly stating that it is a one-time cost:
  - *Git graph cold load:* `"Reading this repository's history for the first time. This can take a minute; you can keep working, but leave the window open."`
  - *Git graph repeat/refresh:* `"Updating Git history… This can take a moment for large repositories."`
  - *Files cold indexing:* `"Indexing repository files for the first time. This can take a minute; leave the window open."`
  - *Changes / Compare:* `"Reading changes from Git. This can take a moment for large repositories."`
  - *Large session history reconstruction:* `"Opening a large session with many recorded steps. Reconstructing history; leave the window open."`
  - *Library search:* `"Searching session records across journals…"`
- **Error state (`error` phase):**
  Clear, direct failure explanation (no exclamation marks, no "Oops") with an interactive `"Retry"` button calling the surface's retry function.

---

## 3. Shared Mechanism Architecture

Implemented as:
1. `apps/ui/src/lib/use-wait-notice.ts`: Custom hook managing elapsed time, threshold transitions (`immediate` → `quiet` → `long` or `error`), and state tracking.
2. `apps/ui/src/components/WaitNotice.tsx`: Presentational component rendering:
   - quiet placeholder / status text when `isQuiet`
   - detailed explanation and one-time notice when `isLong`
   - error message with Retry button when `isError`
3. `apps/ui/src/components/wait-notice.css`: Styles using official tokens (`--text-xs`, `--text-sm`, `--t2`, `--t3`, `--danger`, `--font-mono`, etc.).

---

## 4. Surfaces Wired

1. **Git graph** (`GitHistoryReader.tsx`):
   - First-time detection via `gitHistoryStore`.
   - Displays one-time notice on cold reads (> 2s).
   - Quiet message on repeat reads (> 400ms).
   - Retry on history error.
2. **Changes** (`CompareWindow.tsx` preset === 'uncommitted'):
   - Tracks working tree git snapshot status.
   - Shows quiet note after 400ms; explanatory note after 2s; retry button on failure.
3. **Compare** (`CompareWindow.tsx` preset === 'branch' | 'pr' | 'session'):
   - Tracks branch/ref comparison calculation.
   - Shows quiet note after 400ms; explanatory note after 2s; retry button on failure.
4. **Files & indexing** (`SessionWorkspace.tsx` FolderExplorer):
   - Tracks `source.graph()` indexing.
   - Suppresses flicker on fast graph loads (< 400ms); shows indexing note after 2s; retry button on error.
5. **Peek** (`SessionWorkspace.tsx` CurrentDocument):
   - Tracks disk file read via `useCurrentSource`.
   - Quiet placeholder after 400ms; disk read note after 2s; retry button on error.
6. **Workspace** (`DeveloperWorkspace.tsx`):
   - Tracks workspace file read and draft operations.
   - Quiet note after 400ms; long read note after 2s; retry button on error.
7. **Search** (`LibrarySearch.tsx` and `Viewer.tsx` search):
   - Quiet note after 400ms; deep journal search note after 2s; retry button on error.
8. **Opening large session** (`Viewer.tsx`):
   - Reconstructing history window / large session projection.
   - Immediate quiet view < 400ms; history loading note after 400ms; long session notice after 2s; retry button on error.
9. **Home session list** (`SessionHome.tsx` / `Home.tsx`):
   - Local journal discovery across workspaces.
   - Silent under 400ms; quiet note after 400ms; discovery explanation after 2s; retry on error.
10. **Usage** (`RecordedUsage.tsx`):
    - Context report reading and journal rescan.
    - Silent under 400ms; quiet note after 400ms; journal reading note after 2s; retry on error.
