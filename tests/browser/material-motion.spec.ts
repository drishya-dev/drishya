import { randomUUID } from 'node:crypto';
import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string;
let journal: string;
let app: App;
let server: RunningServer;
let recordingId: string;
const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', version: '2.1.0', timestamp: '2026-10-05T12:00:00.000Z' };
const append = (row: object) => appendFileSync(journal, JSON.stringify({ ...base, uuid: randomUUID(), ...row }) + '\n');

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-material-motion-'));
  journal = join(dir, 'session.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  app = new App(join(dir, 'data'));
  recordingId = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-pacing-test' });
  app.ingest.startLive(recordingId);
});

test.afterEach(async () => {
  if (server) await server.close();
  if (app) await app.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('refusing to remove a directory outside temp');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('whole material zoom stays continuous while the captured result changes its allocation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await expect(page.locator('.origins')).toBeAttached();
  await expect.poll(() => page.locator('.history').evaluate(el => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.evaluate(() => {
    const samples: { scale: number; width: number; height: number }[] = [];
    (window as any).zoomSamples = samples;
    const deadline = performance.now() + 4000;
    const sample = () => {
      const card = [...document.querySelectorAll<HTMLElement>('article.op-shell')].find(el => el.textContent?.includes('continuous-zoom-proof'));
      if (card) { const r = card.getBoundingClientRect(); samples.push({ scale: new DOMMatrixReadOnly(getComputedStyle(card).transform).m11, width: r.width, height: r.height }); }
      if (performance.now() < deadline) requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  const id = 'continuous-zoom-proof';
  append({ type: 'assistant', message: { id, role: 'assistant', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: 'printf continuous-zoom-proof' } }] } });
  await app.ingest.sync(recordingId);
  await expect.poll(() => page.evaluate(() => (window as any).zoomSamples.filter((s: any) => s.scale > .2 && s.scale < .7).length)).toBeGreaterThan(2);
  append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: Array.from({ length: 40 }, (_, n) => `captured output line ${n}`).join('\n') }] } });
  await app.ingest.sync(recordingId);
  const card = page.locator('article.op-shell').filter({ hasText: id });
  await expect(card).toContainText('captured output line');
  await expect(page.locator('.origin-material, .origin-tool-transfer, .origin-file-transfer')).toHaveCount(0);
  await expect.poll(() => card.evaluate(el => el.getAnimations().filter(a => a.id.startsWith('surface-')).length)).toBe(0);
  const samples = await page.evaluate(() => (window as any).zoomSamples as { scale: number; width: number; height: number }[]);
  expect(samples.some(s => s.scale > .75 && s.scale < .98)).toBe(true);
  expect(samples.at(-1)!.scale).toBeCloseTo(1, 2);
  const travelling = samples.slice(samples.findIndex(s => s.scale < .9));
  const jumps = travelling.slice(1).map((s, i) => Math.abs(s.width - travelling[i]!.width));
  expect(Math.max(...jumps)).toBeLessThan(70);
});

test('scrolling a result keeps live follow while scrolling history holds the reader', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const id = 'local-scroll-proof';
  append({ type: 'assistant', message: { id, role: 'assistant', content: [{ type: 'tool_use', id, name: 'mcp__context7__get-library-docs', input: { topic: id } }] } });
  append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: Array.from({ length: 60 }, (_, n) => `Captured documentation ${n}`).join('\n') }] } });
  await app.ingest.sync(recordingId);
  const card = page.locator('article.op-mcp').filter({ hasText: id });
  await expect(card).toContainText('Captured documentation');
  const latest = page.getByRole('button', { name: /Back to latest/ });
  if (await latest.isVisible()) await latest.click();
  await expect(latest).toHaveCount(0);
  const body = card.locator('.op-body');
  await expect.poll(() => body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const r = (await body.boundingBox())!;
  const viewport = (await page.locator('.history').boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, Math.min(r.y + 20, viewport.y + viewport.height - 12));
  await page.mouse.wheel(0, 80);
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toHaveCount(0);
  await body.dispatchEvent('pointerdown', { bubbles: true });
  await body.dispatchEvent('pointerup', { bubbles: true });
  await body.evaluate(el => { el.setAttribute('tabindex', '0'); (el as HTMLElement).focus(); });
  await body.press('PageDown');
  await expect(page.getByRole('button', { name: /Back to latest/ })).toHaveCount(0);
  append({ type: 'assistant', message: { id: 'local-scroll-next', role: 'assistant', content: [{ type: 'text', text: 'Live capture continues after local scrolling.' }] } });
  await app.ingest.sync(recordingId);
  await expect(page.locator('.prose').last()).toContainText('continues after local scrolling');
  await expect(page.getByRole('button', { name: /Back to latest/ })).toHaveCount(0);
  await page.locator('.history').dispatchEvent('wheel', { deltaY: -100 });
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
});
