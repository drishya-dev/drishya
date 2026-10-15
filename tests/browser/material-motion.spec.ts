import { randomUUID } from 'node:crypto';
import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
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
    const samples: { scale: number; width: number; height: number; settling: boolean; time: number }[] = [];
    (window as any).zoomSamples = samples;
    const deadline = performance.now() + 4000;
    const sample = () => {
      const card = [...document.querySelectorAll<HTMLElement>('article.op-shell')].find(el => el.textContent?.includes('continuous-zoom-proof'));
      if (card) { const r = card.getBoundingClientRect(); samples.push({ scale: new DOMMatrixReadOnly(getComputedStyle(card).transform).m11, width: r.width, height: r.height, settling: card.hasAttribute('data-material-settling'), time: performance.now() }); }
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
  await expect.poll(() => card.evaluate(el => el.hasAttribute('data-material-settling') || el.getAnimations().some(a => a.id.startsWith('surface-')))).toBe(false);
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


test('hover reading preserves live follow and safely releases when new captured work arrives', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const id = 'live-hover-proof';
  append({ type: 'assistant', message: { id, role: 'assistant', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: 'printf live-hover-proof' } }] } });
  append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'Captured hover output' }] } });
  await app.ingest.sync(recordingId);
  const card = page.locator('article.op-shell').filter({ hasText: id });
  await expect.poll(() => card.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  const latest = page.getByRole('button', { name: /Back to latest/ });
  if (await latest.isVisible()) await latest.click();
  await expect(latest).toHaveCount(0);
  await card.locator('.op-head .op-title').hover();
  await expect(card).toHaveAttribute('data-hover-reading', 'focused');
  await expect(latest).toHaveCount(0);
  append({ type: 'assistant', message: { id: 'hover-follow-next', role: 'assistant', content: [{ type: 'text', text: 'Captured work keeps arriving during hover.' }] } });
  await app.ingest.sync(recordingId);
  await expect(page.locator('.prose').last()).toContainText('during hover');
  await expect(latest).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.op[data-hover-reading]')).toHaveCount(0);
});


test('hover result boundaries scroll history without dismissing the same reading surface', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const id = 'hover-boundary-proof';
  append({ type: 'assistant', message: { id, role: 'assistant', content: [{ type: 'tool_use', id, name: 'mcp__context7__get-library-docs', input: { topic: id } }] } });
  append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: Array.from({ length: 100 }, (_, n) => `Captured documentation ${n}`).join('\n') }] } });
  await app.ingest.sync(recordingId);
  const card = page.locator('article.op-mcp').filter({ hasText: id });
  const history = page.locator('.history');
  await expect(card).toContainText('Captured documentation');
  await expect.poll(() => card.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  await card.locator('.op-head .op-title').hover();
  await expect(card).toHaveAttribute('data-hover-reading', 'focused');
  await expect.poll(() => card.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  const focusedBounds = (await card.boundingBox())!;
  const focusScroll = await history.evaluate(el => el.scrollTop);
  const body = card.locator('.op-body');
  await expect.poll(() => body.evaluate(el => el.scrollHeight > el.clientHeight + 1)).toBe(true);
  await body.hover();
  await page.mouse.wheel(0, 80);
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(card).toHaveAttribute('data-hover-reading', 'focused');
  await card.evaluate(el => { for (const node of [el, ...el.querySelectorAll<HTMLElement>('*')]) node.scrollTop = 0; });
  const before = await history.evaluate(el => el.scrollTop);
  await page.mouse.wheel(0, -140);
  await expect.poll(() => history.evaluate(el => el.scrollTop)).toBeLessThan(before);
  await expect(card).toHaveAttribute('data-hover-reading', 'focused');
  await expect(page.getByRole('switch', { name: 'Automatically follow new work' })).toHaveAttribute('aria-checked', 'false');
  await card.evaluate(el => { for (const node of [el, ...el.querySelectorAll<HTMLElement>('*')]) node.scrollTop = node.scrollHeight; });
  const above = await history.evaluate(el => el.scrollTop);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => history.evaluate(el => el.scrollTop)).toBeGreaterThan(above);
  await expect(card).toHaveAttribute('data-hover-reading', 'focused');
  const afterScroll = (await card.boundingBox())!;
  const scrollDelta = await history.evaluate(el => el.scrollTop) - focusScroll;
  expect(Math.abs(afterScroll.y - (focusedBounds.y - scrollDelta))).toBeLessThan(1);
  for (const dimension of ['x', 'width', 'height'] as const) expect(Math.abs(afterScroll[dimension] - focusedBounds[dimension])).toBeLessThan(1);
  // Coordinates inside its new, scrolled bounds keep the reader even when the
  // browser retargets the event to underlying history.
  await history.dispatchEvent('pointermove', { pointerType: 'mouse', clientX: afterScroll.x + 20, clientY: afterScroll.y + 20, buttons: 0 });
  await page.waitForTimeout(400);
  await expect(card).toHaveAttribute('data-hover-reading', 'focused');
  // The same enlarged material passes under chrome, not over its inputs.
  // Add trailing layout room so this last captured action can reach both edges.
  await history.evaluate(el => { (el.querySelector('.history-inner') as HTMLElement).style.paddingBottom = '2000px'; });
  for (const edge of ['composer', 'header'] as const) {
    await card.evaluate((el, edge) => {
      const root = document.querySelector('.history')!;
      const chrome = document.querySelector(edge === 'composer' ? '.prompt-composer.open' : '.workspace-header')!;
      const r = el.getBoundingClientRect(), c = chrome.getBoundingClientRect();
      const targetTop = edge === 'composer' ? c.top - r.height + 40 : c.bottom - 40;
      root.scrollTop += r.top - targetTop;
      // Keep the pointer in the visible portion of the moving reader.
      root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: r.left + r.width / 2, clientY: edge === 'composer' ? targetTop + 20 : c.bottom + 20 }));
    }, edge);
    await page.waitForTimeout(60);
    await expect(card).toHaveAttribute('data-hover-reading', 'focused');
    const overlap = await card.evaluate((el, edge) => {
      const chrome = document.querySelector(edge === 'composer' ? '.prompt-composer.open' : '.workspace-header')!;
      const r = el.getBoundingClientRect(), c = chrome.getBoundingClientRect();
      const x = Math.max(r.left, c.left) + Math.min(r.right - Math.max(r.left, c.left), c.right - Math.max(r.left, c.left)) / 2;
      const y = edge === 'composer' ? c.top + 10 : c.bottom - 10;
      const hit = document.elementFromPoint(x, y);
      return { overlaps: y > r.top && y < r.bottom, chromeOwnsHit: !!hit && chrome.contains(hit), blur: getComputedStyle(chrome, '::after').backdropFilter };
    }, edge);
    expect(overlap.overlaps).toBe(true);
    expect(overlap.chromeOwnsHit).toBe(true);
    expect(overlap.blur).toBe('blur(8px)');
    if (process.env.DRISHYA_REVIEW_SHOTS) await page.screenshot({ path: `.local/hover-under-${edge}.png` });
  }
  const movingBounds = (await card.boundingBox())!;
  await page.mouse.move(movingBounds.x + 20, movingBounds.y + movingBounds.height - 20);
  await card.evaluate(el => { for (const node of [el, ...el.querySelectorAll<HTMLElement>('*')]) node.scrollTop = 0; });
  // A stationary cursor can leave the moving rectangle through scrolling alone.
  await page.mouse.wheel(0, -10000);
  await expect.poll(() => history.evaluate(el => el.scrollTop)).toBe(0);
  await expect(page.locator('article[data-hover-reading=focused]')).toHaveCount(0);
  await expect(page.locator('.hover-reading-slot')).toHaveCount(0);
});
