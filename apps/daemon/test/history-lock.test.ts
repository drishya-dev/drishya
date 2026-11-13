import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app.ts';
import { startServer, type RunningServer } from '../src/server.ts';

let app: App | undefined;
let server: RunningServer | undefined;
let dir: string | undefined;

afterEach(async () => {
  await server?.close();
  await app?.close();
  server = undefined;
  app = undefined;
  if (dir) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // transient Windows cleanup
    }
    dir = undefined;
  }
});

function createSyntheticJournal(dir: string, id: string): string {
  const journal = join(dir, `${id}.jsonl`);
  const rows = [
    { timestamp: '2026-11-13T00:00:00Z', type: 'session_meta', payload: { id, cwd: dir } },
    { timestamp: '2026-11-13T00:00:01Z', type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Hello lock test' }] } },
  ];
  writeFileSync(journal, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return journal;
}

describe('history worker lock resilience (DATA-14)', () => {
  it('holds a write lock on index.db while worker starts, and worker waits then succeeds', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-history-lock-'));
    const dataDir = join(dir, 'data');
    app = new App(dataDir);
    const journal = createSyntheticJournal(dir, 'lock-test-1');
    const { recordingId } = await app.ingest.importSource('codex', journal);

    // Prepare history directory and hold an exclusive lock on history/index.db
    const historyDir = join(dataDir, 'history');
    mkdirSync(historyDir, { recursive: true });
    const dbPath = join(historyDir, 'index.db');
    const locker = new DatabaseSync(dbPath);
    locker.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS lock_probe(id TEXT PRIMARY KEY);');
    locker.exec('BEGIN EXCLUSIVE;');
    locker.exec("INSERT INTO lock_probe VALUES ('lock-held');");

    const start = Date.now();
    // Worker starts now while locker holds the write lock
    const pagePromise = app.history.page(recordingId, { count: 1 });

    // Release the lock after 400ms
    setTimeout(() => {
      locker.exec('COMMIT;');
      locker.close();
    }, 400);

    const page = await pagePromise;
    const elapsed = Date.now() - start;

    expect(page.projection.recordingId).toBe(recordingId);
    expect(page.scene.passages.length).toBeGreaterThan(0);
    expect(elapsed).toBeGreaterThanOrEqual(350);
  }, 15000);

  it('spawns a replacement worker only after the previous worker has fully exited', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-history-replace-'));
    const dataDir = join(dir, 'data');
    app = new App(dataDir);
    const journal = createSyntheticJournal(dir, 'replace-test-1');
    const { recordingId } = await app.ingest.importSource('codex', journal);

    // Initial request spins up the first worker
    const facts1 = await app.history.now(recordingId);
    expect(facts1).toBeDefined();

    const heap1 = await app.history.diagnosticHeap();
    expect(heap1?.threadId).toBeDefined();

    // Access the worker to trigger an error/exit
    const worker = (app.history as unknown as { worker?: import('node:worker_threads').Worker }).worker;
    expect(worker).toBeDefined();

    let worker1Exited = false;
    worker?.on('exit', () => {
      worker1Exited = true;
    });

    // Terminate worker 1 to simulate a crash/exit
    await worker?.terminate();
    expect(worker1Exited).toBe(true);

    // Immediately dispatch next request; it must await worker 1 exit and spawn replacement cleanly
    const facts2 = await app.history.now(recordingId);
    expect(facts2).toBeDefined();

    const heap2 = await app.history.diagnosticHeap();
    expect(heap2?.threadId).toBeDefined();
    expect(heap2?.threadId).not.toBe(heap1?.threadId);
  });

  it('logs one clear line if the lock is still held after the wait', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-history-timeout-'));
    const dataDir = join(dir, 'data');
    app = new App(dataDir);
    const journal = createSyntheticJournal(dir, 'timeout-test-1');
    const { recordingId } = await app.ingest.importSource('codex', journal);

    const historyDir = join(dataDir, 'history');
    mkdirSync(historyDir, { recursive: true });
    const dbPath = join(historyDir, 'index.db');
    const locker = new DatabaseSync(dbPath);
    locker.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS lock_probe(id TEXT PRIMARY KEY);');
    locker.exec('BEGIN EXCLUSIVE;');
    locker.exec("INSERT INTO lock_probe VALUES ('locked-forever');");

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(app.history.page(recordingId, { count: 1 })).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/history: cache database .* remained locked after 5s wait/)
      );
    } finally {
      errorSpy.mockRestore();
      locker.exec('COMMIT;');
      locker.close();
    }
  }, 15000);

  it('starts two server daemons in succession on the same directory without database lock errors', async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-history-serve-'));
    const dataDir = join(dir, 'data');
    const journal = createSyntheticJournal(dir, 'serve-test-1');

    // Daemon 1
    const app1 = new App(dataDir);
    const { recordingId } = await app1.ingest.importSource('codex', journal);
    server = await startServer({ app: app1, port: 0 });
    const res1 = await fetch(`${server.url}/v1/recordings/${recordingId}/history`, {
      method: 'POST',
      headers: { authorization: `Bearer ${server.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ count: 10 }),
    });
    expect(res1.status).toBe(200);

    // Close daemon 1
    await server.close();
    await app1.close();
    server = undefined;

    // Daemon 2 starts immediately on the exact same dataDir
    const app2 = new App(dataDir);
    app = app2;
    server = await startServer({ app: app2, port: 0 });
    const res2 = await fetch(`${server.url}/v1/recordings/${recordingId}/history`, {
      method: 'POST',
      headers: { authorization: `Bearer ${server.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ count: 10 }),
    });
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { projection?: { recordingId?: string } };
    expect(body2.projection?.recordingId).toBe(recordingId);
  });
});
