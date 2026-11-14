// Opt-in cold-open benchmark (PERF-4). A copy of one real local journal (chosen by id prefix or
// suffix) is imported into a scratch Drishya home, then read by a *fresh* App (a daemon restart: no
// resident fold, no cached view in the history worker). Prints counts and times only; journal text is
// never printed. Never touches port 7878 or the real home.
//   node scripts/bench-cold-open.ts --source <id> [--runs 2] [--append N] [--keep]
import { copyFileSync, mkdtempSync, rmSync, statSync, appendFileSync, readFileSync, openSync, readSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { App } from '../apps/daemon/src/app.ts';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; };
const sourceId = arg('--source');
if (!sourceId) throw new Error('--source <id prefix or suffix> required');
const ms = (t: number) => Math.round(performance.now() - t);
const dir = mkdtempSync(join(tmpdir(), 'drishya-perf4-'));
try {
  const probe = new App(join(dir, 'probe'));
  const found = (await probe.ingest.discover()).find(s => new RegExp(`(^|[\\/])(.*[-_])?${sourceId}[0-9a-f-]*[.]jsonl$`).test(s.path) || s.path.includes(sourceId));
  await probe.close();
  if (!found) throw new Error(`no local journal matches ${sourceId}`);
  const journal = join(dir, basename(found.path));
  copyFileSync(found.path, journal);
  const bytes = statSync(journal).size;
  const data = join(dir, 'data');
  let t = performance.now();
  let app = new App(data);
  const imported = await app.ingest.importSource(found.adapterId, journal);
  const id = imported.recordingId;
  const importMs = ms(t);
  const observations = app.store.countObservations(id);
  const paged = app.paged(id);
  console.log(JSON.stringify({ phase: 'import', harness: found.harness, mb: +(bytes / 1048576).toFixed(1), observations, paged, importMs }));
  await app.close();
  const runs = Number(arg('--runs', '2'));
  for (let run = 1; run <= runs; run++) {
    if (run === 2 && arg('--append')) {
      // The session grew while the daemon was away: append real tail lines (copied from the journal's end).
      const n = Number(arg('--append'));
      // Only the end of the journal is read (a journal can be over 512 MB, too long for one string).
      const size = statSync(journal).size, span = Math.min(size, 4 << 20), buf = Buffer.alloc(span), fd = openSync(journal, 'r');
      try { readSync(fd, buf, 0, span, size - span); } finally { closeSync(fd); }
      const lines = buf.toString('utf8').split('\n').filter(Boolean).slice(-n).map(l => l.replace(/"timestamp":"[^"]+"/, `"timestamp":"${new Date().toISOString()}"`));
      appendFileSync(journal, lines.join('\n') + '\n');
    }
    app = new App(data); // a restart
    t = performance.now();
    if (run === 2 && arg('--append')) { await app.ingest.importSource(found.adapterId, journal); console.log(JSON.stringify({ phase: 'reimport-tail', ms: ms(t) })); t = performance.now(); }
    if (paged && process.argv.includes('--tail')) {
      // PERF-4: recent first. The first reply is the tail; keep asking (as live updates do) until the whole view replaces it.
      const ask = async () => { const t0 = performance.now(); const bytes = await app.history.pageBytes(app.readingId(id), { count: 32, tailFirst: true }); const text = new TextDecoder().decode(bytes); return { ms: performance.now() - t0, partial: /"partial":\{/.test(text.slice(0, 200)) || text.includes('"partial":{"observations"'), size: bytes.byteLength, total: Number(/"total":(\d+)/.exec(text)?.[1]) }; };
      t = performance.now();
      const firstReply = await ask();
      const out: Record<string, unknown> = { phase: 'tail-open', run, restart: true, firstMs: Math.round(performance.now() - t), firstBytes: firstReply.size, partial: firstReply.partial, firstTotal: firstReply.total };
      let worst = 0, polls = 0;
      while (firstReply.partial) {
        await new Promise(r => setTimeout(r, 100));
        const reply = await ask(); polls++; worst = Math.max(worst, reply.ms);
        if (!reply.partial) { out.fullMs = Math.round(performance.now() - t); out.fullTotal = reply.total; break; }
        if (performance.now() - t > 120_000) { out.timeout = true; break; }
      }
      out.polls = polls; out.slowestRequestMs = Math.round(worst);
      console.log(JSON.stringify(out));
      await app.close();
      continue;
    }
    const first = paged ? await app.history.pageBytes(app.readingId(id), { count: 32 }) : JSON.stringify(app.projection(id));
    const firstMs = ms(t);
    t = performance.now();
    const second = paged ? await app.history.pageBytes(app.readingId(id), { count: 32 }) : JSON.stringify(app.projection(id));
    console.log(JSON.stringify({ phase: 'open', run, restart: true, firstMs, repeatMs: ms(t), firstBytes: (first as any).length ?? (first as any).byteLength, repeatBytes: (second as any).length ?? (second as any).byteLength }));
    await app.close();
  }
} finally {
  if (!process.argv.includes('--keep')) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}
process.exit(0);
