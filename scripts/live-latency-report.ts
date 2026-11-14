// LIVE-7: pools the JSON files bench-live-latency.ts wrote (`.local/live7/<before|after>-<name><n>-...json`) into the
// before/after table for docs/review/live-7-latency.md. Timings, kinds and counts only.
//   node scripts/live-latency-report.ts [dir]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { percentile } from './lib/live-latency.ts';

interface Row { rank: number; kind: string; t: number; commit?: number; notice?: number; data?: number; paint?: number }
interface Run { journalBytes?: number; observations?: number; importedObservations?: number; timeline?: Row[]; homeAppearAfterFirstWriteMs?: number | null; clickToViewerMs?: number; paintGroups?: { sizes: number[] }; stale?: boolean; clickToFirstPaintMs?: number; clickToCurrentPaintMs?: number; firstPaintObservations?: number; observationsFinal?: number; unpainted?: number }

const dir = process.argv[2] ?? '.local/live7';
const runs = new Map<string, Run[]>();
for (const f of readdirSync(dir)) {
  const m = /^(before|after)-(codexnew|codexresume|codexstale|codexctl|codexplan|claudepick|claudelive|small|40mb|codex39|codex26|claude24|claude157)\d?-(live|synthetic)-.*\.json$/.exec(f);
  if (!m) continue;
  const key = `${m[2]}|${m[1]}`;
  (runs.get(key) ?? runs.set(key, []).get(key)!).push(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Run);
}
const families = [...new Set([...runs.keys()].map(k => k.split('|')[0]!))];
const fmt = (v: number | undefined) => v === undefined ? '–' : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
const pct = (xs: number[], p: number) => fmt(percentile(xs, p));

function liveRows(runsOf: Run[]): Row[] {
  const out: Row[] = [];
  for (const r of runsOf) {
    // Steps written before the viewer opened arrive with the open itself; they are the opening, not live following.
    const opened = (r.homeAppearAfterFirstWriteMs ?? 0) + (r.clickToViewerMs ?? 0);
    for (const row of r.timeline ?? []) if (row.paint !== undefined && (!r.homeAppearAfterFirstWriteMs || row.t >= opened)) out.push(row);
  }
  return out;
}
const KINDS = ['prompt', 'tool-start', 'tool-result', 'prose', 'plan-or-question', 'turn-end', 'subagent-start', 'reasoning'];

console.log('## End to end (journal append → painted), live steps\n');
console.log('| Case | Journal | Steps | before p50 | before p95 | after p50 | after p95 |\n|---|---|---:|---:|---:|---:|---:|');
for (const fam of families) {
  const b = runs.get(`${fam}|before`) ?? [], a = runs.get(`${fam}|after`) ?? [];
  if (b[0]?.stale || a[0]?.stale) continue;
  const rb = liveRows(b).map(r => r.paint!), ra = liveRows(a).map(r => r.paint!);
  const bytes = a[0]?.journalBytes ?? b[0]?.journalBytes;
  console.log(`| ${fam} | ${bytes ? (bytes / 1e6).toFixed(1) + ' MB' : '–'} | ${rb.length} / ${ra.length} | ${pct(rb, 50)} | ${pct(rb, 95)} | ${pct(ra, 50)} | ${pct(ra, 95)} |`);
}
console.log('\n## By step kind (all live cases pooled)\n');
console.log('| Step | before p50 | before p95 | after p50 | after p95 | n before / after |\n|---|---:|---:|---:|---:|---:|');
const allRows = (tree: string, pick: (f: string) => boolean) => families.filter(pick).flatMap(f => liveRows(runs.get(`${f}|${tree}`) ?? []));
for (const kind of KINDS) {
  const b = allRows('before', () => true).filter(r => r.kind === kind).map(r => r.paint!), a = allRows('after', () => true).filter(r => r.kind === kind).map(r => r.paint!);
  if (b.length || a.length) console.log(`| ${kind} | ${pct(b, 50)} | ${pct(b, 95)} | ${pct(a, 50)} | ${pct(a, 95)} | ${b.length} / ${a.length} |`);
}
console.log('\n## Where the time went (p50 / p95, pooled)\n');
console.log('| Stage | before | after |\n|---|---:|---:|');
const stage = (rows: Row[], f: (r: Row) => number | undefined) => rows.map(f).filter((v): v is number => v !== undefined);
const stages: [string, (r: Row) => number | undefined][] = [
  ['append → committed', r => r.commit], ['committed → page notified', r => r.notice === undefined || r.commit === undefined ? undefined : r.notice - r.commit],
  ['notified → data in page', r => r.data === undefined || r.notice === undefined ? undefined : r.data - r.notice], ['data → painted', r => r.paint === undefined || r.data === undefined ? undefined : r.paint - r.data]];
for (const [name, f] of stages) {
  const b = stage(allRows('before', () => true), f), a = stage(allRows('after', () => true), f);
  console.log(`| ${name} | ${pct(b, 50)} / ${pct(b, 95)} | ${pct(a, 50)} / ${pct(a, 95)} |`);
}
console.log('\n## Steps that arrive in one render\n');
console.log('| Case | before (renders, largest group) | after (renders, largest group) |\n|---|---|---|');
for (const fam of families) {
  const g = (t: string) => { const rs = (runs.get(`${fam}|${t}`) ?? []).filter(r => !r.stale); const sizes = rs.flatMap(r => r.paintGroups?.sizes ?? []); return sizes.length ? `${sizes.length}, ${Math.max(...sizes)}` : '–'; };
  if (g('before') !== '–' || g('after') !== '–') console.log(`| ${fam} | ${g('before')} | ${g('after')} |`);
}
console.log('\n## Opening a session\n');
console.log('| Case | before | after |\n|---|---|---|');
for (const fam of families) {
  const one = (t: string) => { const rs = runs.get(`${fam}|${t}`) ?? []; const home = rs.map(r => r.homeAppearAfterFirstWriteMs).filter((v): v is number => typeof v === 'number'), click = rs.map(r => r.clickToViewerMs).filter((v): v is number => typeof v === 'number');
    const stale = rs.filter(r => r.stale); const parts: string[] = [];
    if (home.length) parts.push(`on Home ${pct(home, 50)} after first write`);
    if (click.length) parts.push(`click → viewer ${pct(click, 50)}`);
    if (stale.length) parts.push(`stale open: first paint ${fmt(percentile(stale.map(r => r.clickToFirstPaintMs!), 50))} (${stale[0]!.firstPaintObservations}/${stale[0]!.observationsFinal} steps), current ${fmt(percentile(stale.map(r => r.clickToCurrentPaintMs!), 50))}`);
    return parts.join('; ') || '–'; };
  if (one('before') !== '–' || one('after') !== '–') console.log(`| ${fam} | ${one('before')} | ${one('after')} |`);
}
