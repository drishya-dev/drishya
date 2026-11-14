// LIVE-7b: what following costs while nothing is written, as CPU time over a quiet spell. Compares the tail's
// configurations on N followed journals in one process:
//   node scripts/bench-tail-idle.ts [--recordings 6] [--seconds 20]
// "before LIVE-7" is a 500 ms poll, "LIVE-7" a 100 ms poll, "no viewer" the relaxed poll with file watches, and
// "viewer" the short poll with file watches. Idle must not cost more than before LIVE-7.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Store } from '../packages/store/src/index.ts';
import { Ingestor } from '../packages/ingest/src/index.ts';

const arg = (name: string, fallback: number) => { const at = process.argv.indexOf(`--${name}`); return at < 0 ? fallback : Number(process.argv[at + 1]); };
const N = arg('recordings', 6), seconds = arg('seconds', 20);

async function measure(label: string, watch: boolean, viewer: boolean, pollMs?: number) {
  process.env.DRISHYA_TAIL_WATCH = watch ? '1' : '0';
  const dir = mkdtempSync(join(tmpdir(), 'drishya-idle-'));
  const store = new Store(join(dir, 'data'));
  const ingest = new Ingestor(store);
  ingest.setViewerPresent(viewer);
  for (let i = 0; i < N; i++) {
    const journal = join(dir, `rollout-${i}.jsonl`);
    writeFileSync(journal, JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: `idle-${i}`, cwd: join(dir, 'ws'), originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + '\n');
    const { recordingId } = await ingest.importSource('codex', journal);
    if (pollMs) ingest.startLive(recordingId, pollMs); else ingest.startLive(recordingId);
    await ingest.liveTurn(recordingId);
  }
  await new Promise((ok) => setTimeout(ok, 1000));
  const before = process.cpuUsage();
  await new Promise((ok) => setTimeout(ok, seconds * 1000));
  const used = process.cpuUsage(before);
  console.log(`${label.padEnd(28)} ${((used.user + used.system) / 1000 / seconds).toFixed(2)} ms CPU per second over ${N} journals`);
  await ingest.close();
  store.close();
  const target = resolve(dir);
  if (target.startsWith(resolve(tmpdir()) + sep)) rmSync(target, { recursive: true, force: true });
}

await measure('before LIVE-7 (500 ms poll)', false, true, 500);
await measure('before LIVE-7 (again)', false, true, 500);
await measure('LIVE-7 (100 ms poll)', false, true);
await measure('now, no viewer', true, false);
await measure('now, no viewer (again)', true, false);
await measure('now, viewer connected', true, true);
