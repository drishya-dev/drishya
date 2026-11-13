# DATA-14 — The history worker waits for its cache lock

**Task:** Ensure the history worker sets `busy_timeout` (5 s) as its first statement on `history/index.db`, ensure replacement workers are spawned only after the previous worker has fully exited, and log a clear single line if the lock remains held after the wait.

## Changes

1. **`apps/daemon/src/history-worker.ts`:**
   - Set `db.exec('PRAGMA busy_timeout = 5000;')` immediately after opening `index.db` as the very first statement before `PRAGMA journal_mode=WAL` and `CREATE TABLE`.
   - Added try/catch logging: `console.error(\`history: cache database ${dbPath} remained locked after 5s wait\`)` if a database lock or busy condition is encountered after the wait.
   - Wrapped message request error handler to also log the clear line if an unhandled SQLite lock/busy error occurs.

2. **`apps/daemon/src/history.ts`:**
   - Replaced immediate unconstrained worker recreation with sequential worker lifecycle:
     - `private exitPromise?: Promise<void>` tracks the lifecycle of the active worker.
     - `private startingWorker?: Promise<Worker>` deduplicates concurrent worker start requests.
     - `ensureWorker()` awaits `this.exitPromise` before instantiating a replacement `Worker`, guaranteeing that the previous worker's thread and SQLite handles have fully closed.
     - When worker errors or exits, `worker.terminate()` is initiated and `resolveExit()` resolves `exitPromise`.
     - `close()` cleanly awaits `request('close', {})`, worker termination, and exit completion.

3. **`apps/daemon/test/history-lock.test.ts`:**
   - Dedicated unit tests covering:
     1. An external connection holding an exclusive transaction on `history/index.db` while the history worker starts: the worker waits via `busy_timeout` and succeeds once the transaction commits.
     2. Replacement worker lifecycle: terminating worker 1 and verifying worker 2 is spawned cleanly only after worker 1 has exited.
     3. Logging verification: an indefinite lock on `index.db` logs the clear error line `history: cache database ... remained locked after 5s wait`.
     4. Successive server startups on the same home directory: starting, hitting history, closing, and immediately restarting a second daemon without lock errors.

## Verification

- `corepack pnpm typecheck`: passed with 0 errors across all projects.
- `corepack pnpm exec vitest run apps/daemon/test/history-lock.test.ts`: all 4 tests passed.
- `corepack pnpm exec vitest run apps/daemon/test/history.test.ts apps/daemon/test/history-response.test.ts apps/daemon/test/history-ownership.test.ts`: all 17 tests passed.
- `drishya serve --port 0 --no-open`: started twice in immediate succession on a real home directory without database lock errors.
