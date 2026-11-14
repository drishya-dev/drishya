import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectionDigest, reduce } from '@drishya/projection';
import { Store } from '@drishya/store';
import { Ingestor } from '../src/index.ts';

// LIVE-7b: a followed recording's projection comes from its resident fold, equals a full rebuild at every
// update, and is released when it should be.
let dir: string;
let store: Store;
let ingest: Ingestor;
const previous = process.env.DRISHYA_FOLD_CHECK;

beforeEach(() => {
  process.env.DRISHYA_FOLD_CHECK = '1'; // the developer switch: compare every incremental update with a rebuild
  dir = mkdtempSync(join(tmpdir(), 'drishya-fold-live-'));
  store = new Store(join(dir, 'data'));
  ingest = new Ingestor(store);
});
afterEach(async () => {
  await ingest.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
  if (previous === undefined) delete process.env.DRISHYA_FOLD_CHECK; else process.env.DRISHYA_FOLD_CHECK = previous;
});

const line = (payload: unknown, time = new Date().toISOString()) => JSON.stringify({ timestamp: time, type: 'response_item', payload }) + '\n';
const meta = (cwd: string) => JSON.stringify({ timestamp: '2026-01-01T00:00:00.000Z', type: 'session_meta', payload: { id: 'fold-live', cwd, originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + '\n';

async function followed(name: string) {
  const journal = join(dir, `${name}.jsonl`);
  writeFileSync(journal, meta(join(dir, 'ws')));
  const { recordingId } = await ingest.importSource('codex', journal);
  ingest.startLive(recordingId, 60_000);
  await ingest.liveTurn(recordingId);
  return { journal, recordingId };
}

const rebuild = (id: string) => projectionDigest(reduce(id, [...store.orderedObservations(id)], store.blobs, { adapters: ingest.descriptors, live: true, ordered: true }));

describe('a followed recording is folded, not rebuilt', () => {
  it('equals a full rebuild after every append and counts the appends', async () => {
    const { journal, recordingId } = await followed('grow');
    expect(projectionDigest(ingest.projection(recordingId))).toBe(rebuild(recordingId));
    for (let i = 0; i < 12; i++) {
      const id = `c${i}`;
      appendFileSync(journal, line({ type: 'function_call', name: 'exec_command', call_id: id, arguments: JSON.stringify({ cmd: `echo ${i}` }) }));
      if (i % 2) appendFileSync(journal, line({ type: 'function_call_output', call_id: id, output: `${i}` }));
      await ingest.sync(recordingId);
      expect(projectionDigest(ingest.projection(recordingId))).toBe(rebuild(recordingId));
    }
    expect(ingest.foldStats.appended).toBeGreaterThanOrEqual(10);
    expect(ingest.foldStats.checked).toBeGreaterThanOrEqual(10);
    expect(ingest.foldStats.mismatches).toBe(0);
  });

  it('rebuilds when the journal is replaced, and still equals a rebuild', async () => {
    const { journal, recordingId } = await followed('replace');
    appendFileSync(journal, line({ type: 'function_call', name: 'exec_command', call_id: 'a', arguments: JSON.stringify({ cmd: 'echo a' }) }));
    await ingest.sync(recordingId);
    ingest.projection(recordingId);
    const rebuiltBefore = ingest.foldStats.rebuilt;
    // A shorter, different file at the same path: a new generation, parsed from the start.
    writeFileSync(journal, meta(join(dir, 'ws')));
    await ingest.sync(recordingId);
    expect(projectionDigest(ingest.projection(recordingId))).toBe(rebuild(recordingId));
    expect(ingest.foldStats.rebuilt).toBeGreaterThan(rebuiltBefore);
    expect(ingest.foldStats.mismatches).toBe(0);
  });

  it('keeps at most two folds, and releases them when following stops or the viewer goes', async () => {
    const a = await followed('a'), b = await followed('b'), c = await followed('c');
    for (const r of [a, b, c]) {
      appendFileSync(r.journal, line({ type: 'function_call', name: 'exec_command', call_id: 'x', arguments: JSON.stringify({ cmd: 'echo' }) }));
      await ingest.sync(r.recordingId);
      ingest.projection(r.recordingId);
    }
    const resident = () => (ingest as unknown as { folds: Map<string, unknown> }).folds.size;
    expect(resident()).toBe(2);
    await ingest.stopLive(c.recordingId);
    expect(resident()).toBe(1);
    ingest.releaseFolds();
    expect(resident()).toBe(0);
  });

  it('a recording that is not followed is not folded', async () => {
    const journal = join(dir, 'still.jsonl');
    writeFileSync(journal, meta(join(dir, 'ws')) + line({ type: 'function_call', name: 'exec_command', call_id: 'a', arguments: JSON.stringify({ cmd: 'echo a' }) }));
    const { recordingId } = await ingest.importSource('codex', journal);
    ingest.projection(recordingId);
    expect((ingest as unknown as { folds: Map<string, unknown> }).folds.size).toBe(0);
  });
});
