import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '@drishya/store';
import { Ingestor } from '../src/index.ts';

// LIVE-7b soak: with the poll made too slow to matter, the file watch alone must read every append (no missed
// records), and the relaxed poll with no viewer must still follow the journal on its own.
let dir: string;
let store: Store;
let ingest: Ingestor;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-tail-'));
  store = new Store(join(dir, 'data'));
  ingest = new Ingestor(store);
});
afterEach(async () => {
  await ingest.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
const call = (id: string, cmd: string) => JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: id, arguments: JSON.stringify({ cmd }) } }) + '\n';

async function follow(name: string, pollMs: number) {
  const journal = join(dir, `${name}.jsonl`);
  writeFileSync(journal, JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: name, cwd: join(dir, 'ws'), originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + '\n');
  const { recordingId } = await ingest.importSource('codex', journal);
  ingest.startLive(recordingId, pollMs);
  await ingest.liveTurn(recordingId);
  return { journal, recordingId };
}

describe('the file watch reads appends with the poll out of the way', () => {
  it('misses nothing across 1,500 appends in uneven bursts, on three journals at once', async () => {
    // A poll every 10 minutes: only the first look and watch events can read anything during this test.
    const runs = await Promise.all(['a', 'b', 'c'].map((n) => follow(n, 600_000)));
    const written = new Map(runs.map((r) => [r.recordingId, 0]));
    for (let i = 0; i < 500; i++) {
      for (const r of runs) {
        appendFileSync(r.journal, call(`${r.recordingId.slice(-4)}-${i}`, `echo ${i}`));
        written.set(r.recordingId, written.get(r.recordingId)! + 1);
      }
      if (i % 17 === 0) await sleep(1 + (i % 7) * 11);
    }
    // Everything the watch can read arrives promptly after the last write.
    const deadline = Date.now() + 4000;
    const seen = () => runs.map((r) => store.countObservations(r.recordingId) - 1); // minus session.meta
    while (Date.now() < deadline && seen().some((n, i) => n < written.get(runs[i]!.recordingId)!)) await sleep(25);
    runs.forEach((r, i) => expect(seen()[i]).toBe(written.get(r.recordingId)));
    // And a forced read finds nothing the watch left behind.
    for (const r of runs) {
      const before = store.countObservations(r.recordingId);
      await ingest.sync(r.recordingId);
      expect(store.countObservations(r.recordingId)).toBe(before);
    }
  }, 30_000);

  it('with no viewer the relaxed poll still follows (the watch is switched off to prove it)', async () => {
    const previous = process.env.DRISHYA_TAIL_WATCH;
    process.env.DRISHYA_TAIL_WATCH = '0';
    const relaxed = new Ingestor(new Store(join(dir, 'data2')));
    try {
      relaxed.setViewerPresent(false);
      const journal = join(dir, 'relaxed.jsonl');
      writeFileSync(journal, JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: 'r', cwd: join(dir, 'ws'), originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + '\n');
      const { recordingId } = await relaxed.importSource('codex', journal);
      relaxed.startLive(recordingId);
      await relaxed.liveTurn(recordingId);
      for (let i = 0; i < 5; i++) appendFileSync(journal, call(`r${i}`, 'echo'));
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline && relaxed.store.countObservations(recordingId) < 6) await sleep(50);
      expect(relaxed.store.countObservations(recordingId)).toBe(6);
    } finally {
      await relaxed.close();
      relaxed.store.close();
      if (previous === undefined) delete process.env.DRISHYA_TAIL_WATCH; else process.env.DRISHYA_TAIL_WATCH = previous;
    }
  }, 15_000);
});
