// UI-26: user-run only. No baseline writes are reachable from comparison modes.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { hostname, release } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { captureSurfaces, contract, type GuardCase } from './ui-26-capture.ts';

async function main() {
const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  config: { type: 'string' }, ref: { type: 'string' }, baseline: { type: 'string' }, run: { type: 'string' },
  positive: { type: 'string' }, negative: { type: 'string' },
} });
const mode = positionals[0];
if (!['freeze', 'positive', 'negative', 'compare'].includes(mode ?? '') || !values.config || !values.ref)
  throw new Error('Usage: node scripts/ui-26-guard.ts freeze|positive|negative|compare --config .local/ui26-inputs.json --ref <full SHA> [--baseline <full SHA> --run <unique name>]');
const root = realpathSync(process.cwd());
const privateRoot = join(root, '.local', 'ui26');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const digest = (value: unknown) => hash(JSON.stringify(value));
const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function privatePath(path: string) {
  const full = resolve(path);
  assert(full.startsWith(resolve(root, '.local') + sep), 'Guard inputs/artifacts must live under this worktree .local');
  return full;
}
function sourceIdentity() {
  assert(/^[a-f0-9]{40}$/.test(values.ref!), 'Pin an immutable full 40-character source ref');
  assert(git('rev-parse', 'HEAD') === values.ref, 'Checked-out HEAD differs from --ref');
  assert(!git('status', '--porcelain', '--untracked-files=all'), 'Source checkout must be clean; commit draft source first');
  const files = git('ls-files', '-z').split('\0').filter(Boolean);
  const selected = (prefixes: string[]) => files.filter(p => prefixes.some(prefix => p.startsWith(prefix))).map(p => [p, hash(readFileSync(join(root, p)))]);
  const all = selected(['apps/', 'packages/', 'scripts/ui-26-', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
  return { ref: values.ref!, source: digest(all), styles: digest(selected(['apps/ui/src/']).filter(([p]) => p!.endsWith('.css'))),
    driver: digest(selected(['scripts/ui-26-'])), lock: hash(readFileSync(join(root, 'pnpm-lock.yaml'))) };
}
function tree(path: string): [string, string][] {
  return readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const full = join(path, entry.name);
    assert(!entry.isSymbolicLink(), 'Build artifacts must not contain symlinks');
    return entry.isDirectory() ? tree(full).map(([p, h]) => [join(entry.name, p), h] as [string, string]) : [[entry.name, hash(readFileSync(full))] as [string, string]];
  });
}
function workspaceIdentity(path: string) {
  assert(isAbsolute(path) && existsSync(join(path, '.git')), 'Each genuine case needs its frozen local Git repository');
  const run = (...args: string[]) => execFileSync('git', ['-C', path, ...args], { encoding: 'utf8', windowsHide: true });
  const names = [...new Set(run('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean))].sort();
  const files = names.map(name => { const p = join(path, name); return [name, existsSync(p) ? hash(readFileSync(p)) : 'deleted']; });
  return digest({ head: run('rev-parse', 'HEAD'), refs: run('show-ref'), status: run('status', '--porcelain'), files });
}
type Input = { id: 'claude' | 'codex'; harness: 'claude-code' | 'codex'; journal: string; sha256: string; genuine: true; workspace: string; file: string; operation: string };
const configPath = privatePath(values.config);
const inputs = JSON.parse(readFileSync(configPath, 'utf8')) as { cases: Input[] };
assert(Array.isArray(inputs.cases) && inputs.cases.length === 2, 'Require exactly one genuine Claude and one genuine Codex case');
assert(inputs.cases.some(c => c.id === 'claude' && c.harness === 'claude-code') && inputs.cases.some(c => c.id === 'codex' && c.harness === 'codex'), 'Both native harnesses are mandatory');
for (const c of inputs.cases) {
  assert(c.genuine === true && isAbsolute(c.journal) && typeof c.operation === 'string' && !!c.operation, 'Attest genuine native capture and select a real expanded operation');
  assert(hash(readFileSync(c.journal)) === c.sha256, 'Journal changed or expected SHA-256 is absent');
  assert(c.file && !isAbsolute(c.file) && !relative(c.workspace, resolve(c.workspace, c.file)).startsWith('..'), 'Choose a relative workspace file');
  assert(statSync(resolve(c.workspace, c.file)).isFile(), 'Selected genuine workspace file is absent');
}
const source = sourceIdentity();
const baselineRef = mode === 'freeze' ? source.ref : values.baseline;
assert(baselineRef && /^[a-f0-9]{40}$/.test(baselineRef), 'Pass --baseline <full frozen SHA>');
const baselineDir = join(privateRoot, 'baseline', baselineRef);
const baselineFile = join(baselineDir, 'manifest.json');
type Shot = { name: string; sha256: string; width: number; height: number; kind: string };
type Manifest = { contract: typeof contract; source: ReturnType<typeof sourceIdentity>; config: string; inputs: unknown; environment: unknown; build: unknown; shots: Shot[] };
let baseline: Manifest | undefined;
if (mode !== 'freeze') {
  baseline = JSON.parse(readFileSync(baselineFile, 'utf8')) as Manifest;
  assert(hash(readFileSync(baselineFile)) === readFileSync(join(baselineDir, 'manifest.sha256'), 'utf8'), 'Frozen baseline manifest changed');
  assert(baseline.source.ref === baselineRef, 'Baseline manifest/ref mismatch');
  assert(digest(baseline.contract) === digest(contract), 'Comparison contract changed; do not silently refresh baseline');
  assert(baseline.source.driver === source.driver && baseline.source.lock === source.lock, 'Guard or dependency lock differs from frozen baseline');
  assert(baseline.config === hash(readFileSync(configPath)), 'Case configuration differs from baseline');
  const names = ['demo', 'claude', 'codex'].flatMap(c => contract.palettes.flatMap(p => contract.widths.flatMap(w => contract.surfaces.map(s => c + '-' + p + '-' + w + '-' + s))));
  assert(digest(baseline.shots.map(s => s.name).sort()) === digest(names.sort()), 'Baseline matrix is incomplete or duplicated');
  for (const shot of baseline.shots) assert(hash(readFileSync(join(baselineDir, shot.name + '.png'))) === shot.sha256, 'Frozen baseline PNG changed');
  if (mode === 'compare') assert(source.ref !== baseline.source.ref && source.source !== baseline.source.source, 'Candidate must have distinct committed source; use positive for unchanged-source control');
  else assert(source.source === baseline.source.source, 'Controls must use unchanged product source');
}
if (mode === 'compare') for (const control of ['positive', 'negative'] as const) {
  const name = values[control];
  assert(name && /^[a-zA-Z0-9_-]+$/.test(name), 'Compare needs explicit --positive and --negative control run names');
  const dir = join(privateRoot, 'runs', name);
  const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest;
  assert(report.mode === control && report.success === true && report.baseline === hash(readFileSync(baselineFile)), 'Control evidence is absent, failed or belongs to another baseline');
  assert(manifest.source.source === baseline!.source.source && digest(manifest.inputs) === digest(baseline!.inputs) && digest(manifest.environment) === digest(baseline!.environment), 'Control source/input/environment identity differs');
}
assert(mode === 'freeze' || values.run && /^[a-zA-Z0-9_-]+$/.test(values.run), 'Supply a unique safe --run name');
const output = mode === 'freeze' ? baselineDir : join(privateRoot, 'runs', values.run!);
assert(!existsSync(output), 'Run output already exists; frozen results are never overwritten');
mkdirSync(dirname(output), { recursive: true }); mkdirSync(output);
// The build is always made by this user-invoked command from the clean pinned source.
// No independently supplied/stale dist directory can impersonate the pinned source.
const buildLog = join(output, 'build.log');
try {
  const log = execFileSync(process.platform === 'win32' ? 'corepack.cmd' : 'corepack', ['pnpm', 'ui:build'], { cwd: root, windowsHide: true, encoding: 'utf8', stdio: 'pipe', shell: process.platform === 'win32' });
  writeFileSync(buildLog, log, { flag: 'wx' });
} catch (error) {
  const e = error as { stdout?: Buffer; stderr?: Buffer };
  writeFileSync(buildLog, Buffer.concat([Buffer.from(e.stdout ?? ''), Buffer.from(e.stderr ?? '')]), { flag: 'wx' });
  throw new Error('Pinned UI build failed; inspect private build.log');
}
const build = tree(join(root, 'apps/ui/dist'));
assert(build.some(([p]) => p === 'index.html'), 'UI build is absent');
assert(digest(sourceIdentity()) === digest(source), 'Source identity changed during build');
const workspaceBefore = inputs.cases.map(c => workspaceIdentity(c.workspace));
const inputIdentity = inputs.cases.map((c, index) => ({ id: c.id, harness: c.harness, journal: c.sha256, bytes: statSync(c.journal).size, workspace: workspaceBefore[index] }));
const browser = await chromium.launch({ channel: process.env.DRISHYA_BROWSER_CHANNEL || undefined });
try {
const environment = { machine: hash(hostname()), release: release(), platform: process.platform, arch: process.arch, node: process.version, browser: browser.version(), channel: process.env.DRISHYA_BROWSER_CHANNEL ?? 'bundled', timezone: 'UTC', locale: 'en-US', scale: 1 };
if (baseline) assert(digest(baseline.environment) === digest(environment), 'Machine/browser environment differs from baseline');
// Supported discovery overrides isolate the Home list to the explicitly imported captures.
process.env.DRISHYA_CLAUDE_HOME = join(output, 'empty-claude-home');
process.env.DRISHYA_CODEX_HOME = join(output, 'empty-codex-home');
mkdirSync(process.env.DRISHYA_CLAUDE_HOME); mkdirSync(process.env.DRISHYA_CODEX_HOME);
// Every home is new and under .local. Native journals are only opened by the existing read-only importer.
const { App } = await import(pathToFileURL(join(root, 'apps/daemon/src/app.ts')).href);
const { startServer } = await import(pathToFileURL(join(root, 'apps/daemon/src/server.ts')).href);
const app = new App(join(output, 'scratch-home'));
let server: Awaited<ReturnType<typeof startServer>> | undefined;
const shots: Shot[] = [], outcomes: { name: string; ratio: number; passed: boolean }[] = [];
let success = false;
try {
  const cases: GuardCase[] = [{ id: 'demo' }];
  const projections: unknown[] = [];
  for (const c of inputs.cases) {
    const imported = await app.ingest.importSource(c.harness, c.journal);
    const projection = app.projection(imported.recordingId);
    assert(projection.operations.some((op: { id: string }) => op.id === c.operation), 'Chosen expanded operation is not in the genuine capture');
    assert(typeof projection.workspaceRoot === 'string' && !!projection.workspaceRoot, 'Genuine capture has no single recorded workspace root');
    assert(resolve(projection.workspaceRoot) === resolve(c.workspace), 'Genuine captured repository and configured frozen workspace differ');
    projections.push({ id: c.id, prefix: imported.recordingId.slice(0, 12), observations: projection.observationCount, operations: projection.operations.length, content: digest(projection) });
    cases.push({ id: c.id, recording: imported.recordingId, file: c.file, operation: c.operation });
  }
  const identity = { files: inputIdentity, projections, demo: hash(readFileSync(join(root, 'apps/ui/public/demo/bundle.json'))) };
  if (baseline) assert(digest(baseline.inputs) === digest(identity), 'Captured material/counts or current repository differs from frozen baseline');
  server = await startServer({ app, port: 0, token: 'ui26-private-local-guard', uiDir: join(root, 'apps/ui/dist') });
  const comparator = await browser.newPage();
  // Chromium's PNG decoder avoids a new image dependency. Comparison uses normalized
  // max-channel RGBA distance, not a configurable library default or a text mask.
  const compare = async (expected: Buffer, actual: Buffer) => comparator.evaluate(async ({ expected, actual, threshold }) => {
    const decode = async (value: string) => { const image = new Image(); image.src = 'data:image/png;base64,' + value; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0); return { width: image.width, height: image.height, data: ctx.getImageData(0, 0, image.width, image.height).data }; };
    const a = await decode(expected), b = await decode(actual);
    if (a.width !== b.width || a.height !== b.height) throw new Error('Screenshot dimensions differ');
    const canvas = document.createElement('canvas'); canvas.width = a.width; canvas.height = a.height;
    const ctx = canvas.getContext('2d')!, diff = ctx.createImageData(a.width, a.height); let count = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const changed = Math.max(...[0, 1, 2, 3].map(c => Math.abs(a.data[i + c]! - b.data[i + c]!) / 255)) > threshold;
      if (changed) count++;
      const gray = Math.round((a.data[i]! + a.data[i + 1]! + a.data[i + 2]!) / 6 + 120);
      diff.data.set(changed ? [255, 0, 80, 255] : [gray, gray, gray, 255], i);
    }
    ctx.putImageData(diff, 0, 0);
    return { ratio: count / (a.width * a.height), diff: canvas.toDataURL('image/png').split(',')[1]! };
  }, { expected: expected.toString('base64'), actual: actual.toString('base64'), threshold: contract.threshold });
  await captureSurfaces(browser, server, cases, mode === 'negative', async (name, bytes, kind) => {
    const shot = { name, sha256: hash(bytes), width: name.includes('-600-') ? 600 : 1440, height: contract.height, kind };
    writeFileSync(join(output, name + '.png'), bytes, { flag: 'wx' }); shots.push(shot);
    if (baseline) {
      const expected = baseline.shots.find(s => s.name === name);
      assert(expected, 'Required surface has no frozen baseline');
      const result = await compare(readFileSync(join(baselineDir, name + '.png')), bytes);
      const passed = result.ratio <= contract.maxDiffPixelRatio;
      outcomes.push({ name, ratio: result.ratio, passed });
      if (!passed) writeFileSync(join(output, name + '-diff.png'), Buffer.from(result.diff, 'base64'), { flag: 'wx' });
    }
  });
  assert(shots.length === (mode === 'negative' ? 1 : contract.expectedShots), 'Required surface coverage is incomplete');
  assert(digest(workspaceBefore) === digest(inputs.cases.map(c => workspaceIdentity(c.workspace))), 'A genuine repository changed during capture');
  for (const c of inputs.cases) assert(hash(readFileSync(c.journal)) === c.sha256, 'A native journal changed during capture');
  assert(digest(sourceIdentity()) === digest(source) && digest(tree(join(root, 'apps/ui/dist'))) === digest(build), 'Candidate source/build changed during capture');
  if (baseline) for (const shot of baseline.shots) assert(hash(readFileSync(join(baselineDir, shot.name + '.png'))) === shot.sha256, 'Frozen PNG modified during compare');
  const failures = outcomes.filter(o => !o.passed).length;
  success = mode === 'negative' ? failures === 1 && outcomes[0]?.name === contract.negativeTarget : failures === 0;
  const manifest: Manifest = { contract, source, config: hash(readFileSync(configPath)), inputs: identity, environment, build, shots };
  // A baseline becomes usable only after every required surface was captured successfully.
  if (mode === 'freeze') {
    const bytes = JSON.stringify(manifest, null, 2);
    writeFileSync(baselineFile, bytes, { flag: 'wx' });
    writeFileSync(join(baselineDir, 'manifest.sha256'), hash(bytes), { flag: 'wx' });
  }
  else writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ mode, success, baseline: hash(readFileSync(baselineFile)), shots: shots.length, fullMaterial: shots.filter(s => s.kind === 'material').length, unavailable: shots.filter(s => s.kind === 'unavailable').length, outcomes }, null, 2), { flag: 'wx' });
  console.log(`UI26 ${mode}: ${success ? 'PASS' : 'FAIL'}; ${shots.length} images; ${failures} outside fixed tolerance. Native details and PNGs stay in .local.`);
} catch (error) {
  writeFileSync(join(output, 'failure-private.txt'), String(error instanceof Error ? error.stack : error), { flag: 'wx' });
  writeFileSync(join(output, 'failure.json'), JSON.stringify({ mode, success: false, captured: shots.length, reason: 'Capture/readiness/identity failure. No acceptance result; inspect selectors and private run state locally.' }), { flag: 'wx' });
  throw new Error('UI26 failed closed; no acceptance result. Private run artifacts retained.');
} finally {
  try { await server?.close(); } finally { await app.close(); }
}
if (!success) process.exitCode = 1;
} finally { await browser.close(); }

}
main().catch(() => { console.error('UI26 failed closed. No acceptance result; inspect the private .local/ui26 run.'); process.exitCode = 1; });


