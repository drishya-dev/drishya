// CLARITY-1 pixel guard (user-run, private). Captures the same surfaces from three builds in one scratch Drishya home and compares them:
//   base    = Modern before the change (a build of origin/main, --base <its apps/ui/dist>)
//   modern  = Modern after the change  (this worktree's apps/ui/dist, ?experience=modern)
//   clarity = Clarity                  (this worktree's apps/ui/dist, ?experience=clarity)
// plus `base2`, a second capture of the base build, so renderer noise is measured rather than assumed.
// Screenshots stay under .local; only names, counts and ratios are printed. Capture and readiness waits are Harsh's UI-26 driver (PR #350).
//   node scripts/clarity-guard.ts --config .local/clarity-guard/inputs.json --base <dist> --out .local/clarity-guard/run-1
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { App } from '../apps/daemon/src/app.ts';
import { startServer } from '../apps/daemon/src/server.ts';
import { captureSurfaces, type GuardCase } from './clarity-capture.ts';

const { values } = parseArgs({ options: { config: { type: 'string' }, base: { type: 'string' }, out: { type: 'string' }, palettes: { type: 'string' }, widths: { type: 'string' }, surfaces: { type: 'string' }, cases: { type: 'string' }, variants: { type: 'string' } } });
const local = resolve('.local') + sep;
const priv = (p: string | undefined) => { if (!p || !resolve(p).startsWith(local)) throw new Error('Pass --config/--out under .local'); return resolve(p); };
const config = priv(values.config), out = priv(values.out);
if (!values.base || !existsSync(join(resolve(values.base), 'index.html'))) throw new Error('--base must be a built apps/ui/dist of origin/main');
if (existsSync(out)) throw new Error('Run output exists; use a new --out');
const baseDist = resolve(values.base), newDist = resolve('apps/ui/dist');
const only = { palettes: values.palettes?.split(','), widths: values.widths?.split(',').map(Number), surfaces: values.surfaces?.split(',') };
const wanted = new Set((values.cases ?? 'demo,claude,codex').split(','));
const variantList = (values.variants ?? 'base,base2,modern,clarity').split(',');

type Input = { id: 'claude' | 'codex'; harness: 'claude-code' | 'codex'; journal: string; workspace: string; file: string; operation?: string };
const inputs = JSON.parse(readFileSync(config, 'utf8')).cases as Input[];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.DRISHYA_BROWSER_CHANNEL || undefined });
const closers: (() => Promise<void>)[] = [];
// Each variant gets its own daemon and scratch home: the app keeps per-recording state (open Workspace, Git review, consent) between
// page loads, so variants must not share it. Every variant then replays the same sequence from the same empty state.
async function openVariant(v: string, uiDir: string) {
  const app = new App(join(out, 'home-' + v));
  const server = await startServer({ app, port: 0, token: 'clarity-guard-' + v, uiDir });
  closers.push(async () => { await server.close(); await app.close(); });
  const cases: GuardCase[] = [{ id: 'demo' }];
  for (const c of inputs) {
    const imported = await app.ingest.importSource(c.harness, c.journal);
    if (v === variantList[0]) { const projection = app.projection(imported.recordingId); console.log(`case ${c.id}: ${imported.recordingId.slice(0, 12)} · ${projection.operations.length} operations · ${projection.observationCount} observations`); }
    cases.push({ id: c.id, recording: imported.recordingId, file: c.file, operation: c.operation });
  }
  return { server, cases: cases.filter(c => wanted.has(c.id)) };
}
try {
  const kinds: Record<string, ['modern' | 'clarity', string]> = { base: ['modern', baseDist], base2: ['modern', baseDist], modern: ['modern', newDist], clarity: ['clarity', newDist] };
  const files: Record<string, Map<string, Buffer>> = {};
  for (const v of variantList) {
    // Daemon discovery overrides isolate the Home list to the explicitly imported captures.
    process.env.DRISHYA_CLAUDE_HOME = join(out, 'empty-claude-home-' + v); process.env.DRISHYA_CODEX_HOME = join(out, 'empty-codex-home-' + v);
    mkdirSync(process.env.DRISHYA_CLAUDE_HOME, { recursive: true }); mkdirSync(process.env.DRISHYA_CODEX_HOME, { recursive: true });
  }
  const run = async (v: string) => {
    const [experience, dist] = kinds[v]!;
    const { server, cases } = await openVariant(v, dist);
    const dir = join(out, v); mkdirSync(dir); files[v] = new Map();
    await captureSurfaces(browser, server, cases, experience, async (name, bytes) => { writeFileSync(join(dir, name + '.png'), bytes); files[v]!.set(name, bytes); }, only);
    console.log(`captured ${v}: ${files[v]!.size}`);
  };
  // Four browsers rendering at once starve the daemon's API answers on this machine: run the variants in small groups.
  const group = Number(process.env.GUARD_PARALLEL || 2);
  for (let i = 0; i < variantList.length; i += group) await Promise.all(variantList.slice(i, i + group).map(run));

  const comparator = await browser.newPage();
  const compare = (a: Buffer, b: Buffer) => comparator.evaluate(async ({ a, b }) => {
    const decode = async (value: string) => { const image = new Image(); image.src = 'data:image/png;base64,' + value; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0); return { width: image.width, height: image.height, data: ctx.getImageData(0, 0, image.width, image.height).data }; };
    const x = await decode(a), y = await decode(b);
    if (x.width !== y.width || x.height !== y.height) return { size: false, exact: -1, loose: -1, total: 0, maxDelta: 0 };
    let exact = 0, loose = 0, maxDelta = 0;
    for (let i = 0; i < x.data.length; i += 4) {
      let d = 0; for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(x.data[i + c]! - y.data[i + c]!));
      if (d > 0) exact++; if (d / 255 > 0.1) loose++; if (d > maxDelta) maxDelta = d;
    }
    return { size: true, exact, loose, total: x.width * x.height, maxDelta };
  }, { a: a.toString('base64'), b: b.toString('base64') });

  const pairs = ([['base', 'base2'], ['base', 'modern'], ['base', 'clarity'], ['modern', 'clarity']] as [string, string][]).filter(([x, y]) => variantList.includes(x) && variantList.includes(y));
  const report: Record<string, { name: string; exact: number; loose: number; maxDelta: number; size: boolean }[]> = {};
  for (const [x, y] of pairs) {
    const rows = [];
    for (const [name, bytes] of files[x]!) { const other = files[y]!.get(name); if (!other) continue; const r = await compare(bytes, other); rows.push({ name, exact: r.exact, loose: r.loose, maxDelta: r.maxDelta, size: r.size }); }
    report[`${x}-vs-${y}`] = rows;
    const bad = rows.filter(r => r.exact !== 0);
    console.log(`${x} vs ${y}: ${rows.length} shots, ${rows.length - bad.length} identical, ${bad.length} differ (${rows.reduce((n, r) => n + Math.max(r.exact, 0), 0)} differing pixels, ${rows.reduce((n, r) => n + Math.max(r.loose, 0), 0)} beyond 10% channel distance)`);
    for (const r of bad.sort((a, b) => b.exact - a.exact).slice(0, 40)) console.log(`   ${r.name}: ${r.exact} px differ (${r.loose} >10%), max channel delta ${r.maxDelta}${r.size ? '' : ' SIZE MISMATCH'}`);
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
} finally {
  for (const close of closers) await close();
  await browser.close();
}
