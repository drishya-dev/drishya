// Opt-in browser/resource probe against invented Codex records; requires local Chromium.
// Run after pnpm ui:build: node scripts/bench-browser.ts
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';
import { App } from '../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../apps/daemon/src/server.ts';
import { sampleRss } from './resource-probe.ts';

const dir = mkdtempSync(join(tmpdir(), 'drishya-browser-b4-'));
const journal = join(dir, 'rollout-b4.jsonl');
const app = new App(join(dir, 'data'));
let server: RunningServer | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const arg = (name: string, fallback: number) => { const at = process.argv.indexOf(`--${name}`); return at < 0 ? fallback : Number(process.argv[at + 1]); };
const initial = arg('observations', 10_000);
const burst = arg('burst-size', 200);
const repetitions = arg('repetitions', 5);
const intervalMs = arg('interval-ms', 0);
const live = process.argv.includes('--live');
const lowResource = process.argv.includes('--low-resource');
const fileCount = arg('files', 0);
const map = process.argv.includes('--map') && !lowResource;
const workspace = join(dir, 'workspace');
const finishPeak = sampleRss();
if (!Number.isSafeInteger(initial) || initial < 1 || !Number.isSafeInteger(burst) || burst < 1 || !Number.isSafeInteger(repetitions) || repetitions < 0 || !Number.isSafeInteger(intervalMs) || intervalMs < 0 || !Number.isSafeInteger(fileCount) || fileCount < 0 || fileCount > 10000) throw new Error('invalid benchmark workload');
let nextRecord = 0;
const timestamp = '2026-09-21T10:20:00.000Z';

function records(n: number): string {
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const index = nextRecord++;
    const callId = `b4-${Math.floor(index / 2)}`;
    const file = fileCount ? Math.floor(index / 2) % fileCount : 0;
    const payload = index % 2 === 0
      ? { type: 'function_call', name: 'functions.exec_command', call_id: callId, arguments: JSON.stringify({ cmd: fileCount ? `cat file-${file}.ts` : `echo synthetic-${index}` }) }
      : { type: 'function_call_output', call_id: callId, output: fileCount ? `export const value${file} = ${file};` : `synthetic-${index}` };
    lines.push(JSON.stringify({ timestamp, type: 'response_item', payload }));
    if (index % 100 === 99) lines.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: `Synthetic progress after ${index + 1} records.` }] } }));
  }
  return lines.join('\n') + '\n';
}

try {
  if (fileCount) { mkdirSync(workspace); for (let i = 0; i < fileCount; i++) writeFileSync(join(workspace, `file-${i}.ts`), `export const value${i} = ${i};\n`); }
  writeFileSync(journal, JSON.stringify({ timestamp, type: 'session_meta', payload: { id: 'b4-browser', cwd: fileCount ? workspace : '/home/dev/shop', originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + '\n' + records(initial));
  const imported = await app.ingest.importSource('codex', journal);
  assert.equal(imported.added, initial + Math.floor(initial / 100) + 1);
  if (fileCount) app.store.updateRecordingMeta(imported.recordingId, { graphRoot: workspace });
  server = await startServer({ app, port: 0, token: 'synthetic-b4-browser' });
  if (live) app.ingest.startLive(imported.recordingId);
  browser = await chromium.launch({ channel: process.env.DRISHYA_BROWSER_CHANNEL || undefined, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript((visible) => localStorage.setItem('drishya.mapVisible', visible ? '1' : '0'), map);
  if (lowResource) await context.addInitScript(() => localStorage.setItem('drishya.lowResource', '1'));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Runtime.enable');
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/v1/session') && response.status() === 200),
    page.goto(server.launchUrl),
  ]);
  await page.locator('.home .row-main.link').first().waitFor({ timeout: 30_000 });
  const openAt = performance.now();
  await page.locator('.home .row-main.link').first().click();
  await page.locator('.reading-status').waitFor({ timeout: 30_000 });
  if (map) await page.locator('.map canvas').waitFor({ timeout: 30_000 });
  const openMs = performance.now() - openAt;
  const timings: number[] = [];
  for (let i = 0; i < repetitions; i++) {
    const before = Number((await page.locator('.reading-status').innerText()).match(/\d+/)?.[0]);
    const t0 = performance.now();
    const previousRecord = nextRecord;
    appendFileSync(journal, records(burst));
    if (!live) {
      const synced = await app.ingest.sync(imported.recordingId);
      assert.equal(synced.added, burst + Math.floor(nextRecord / 100) - Math.floor(previousRecord / 100));
    }
    await page.waitForFunction((old) => {
      const text = document.querySelector('.reading-status')?.textContent ?? '';
      return Number(text.match(/\d+/)?.[0]) > old;
    }, before, { timeout: 30_000 });
    timings.push(performance.now() - t0);
    if (intervalMs > 0) await new Promise((r) => setTimeout(r, Math.max(0, intervalMs - timings.at(-1)!)));
  }
  assert.equal(app.store.getRecording(imported.recordingId)?.observationCount, imported.added + repetitions * burst + Math.floor((initial + repetitions * burst) / 100) - Math.floor(initial / 100));
  const heap = await cdp.send('Runtime.getHeapUsage') as { usedSize: number; totalSize: number };
  const domNodes = await page.evaluate(() => document.querySelectorAll('*').length);
  if (fileCount >= 5000) {
    assert.ok(await page.locator('.spine-file').count() < 100, 'file spine must remain bounded');
    await page.locator('.spine-file').first().click();
    await page.locator('.file-panel .file-op').first().waitFor();
    assert.ok(await page.locator('.file-panel .file-op').count() <= 100, 'file actions must remain paged');
    await page.locator('.file-panel').getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.locator('.history').hover();
  await page.mouse.wheel(0, -300);
  const frames = await page.evaluate(async () => {
    const el = document.querySelector('.history')!;
    const samples: number[] = [];
    for (let i = 0; i < 50; i++) {
      const started = performance.now();
      el.scrollTop += i % 2 ? 30 : -30;
      await new Promise<void>((resolve) => requestAnimationFrame(() => { void el.getBoundingClientRect(); samples.push(performance.now() - started); resolve(); }));
    }
    return samples.sort((a, b) => a - b);
  });
  const sorted = [...timings].sort((a, b) => a - b);
  console.log(JSON.stringify({
    workload: { initialObservations: imported.added, burstSourceRecords: burst, repetitions, intervalMs, live, lowResource, files: fileCount, browser: process.env.DRISHYA_BROWSER_CHANNEL || 'playwright chromium', viewport: '1440x900', map: map ? 'on' : 'off' },
    openMs,
    sourceAppendToSettledDomMs: { samples: timings, p50: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * 0.95) - 1] },
    browserJsHeapMiB: heap.usedSize / 1048576,
    browserJsHeapAllocatedMiB: heap.totalSize / 1048576,
    domNodes,
    daemonRssMiB: process.memoryUsage().rss / 1048576,
    viewportNextFrameMs: { samples: frames.length, p50: frames[25], p95: frames[47] },
  }));
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  await app.close();
  console.log(JSON.stringify({ daemonPeakRssMiB: await finishPeak() }));
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('browser benchmark directory escaped system temp');
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
