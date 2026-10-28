import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { test, expect, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

function raster(width: number, height: number) {
  const chunk = (name: string, data: Buffer) => {
    const bytes = Buffer.concat([Buffer.from(name), data]); let crc = 0xffffffff;
    for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); bytes.copy(out, 4); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4); return out;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
}
let dir: string, app: App, server: RunningServer, id: string;
const timestamp = '2026-10-26T00:00:00Z';
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-image-desktop-'));
  const root = join(dir, 'repo'); mkdirSync(root); mkdirSync(join(root, '.local'));
  const data = raster(1600, 1200); writeFileSync(join(root, 'space # image.png'), data); writeFileSync(join(root, '.local', 'protected.png'), data);
  app = new App(join(dir, 'store')); server = await startServer({ app, port: 0 });
  const paths = [pathToFileURL(join(root, 'space # image.png')).href, pathToFileURL(join(root, '.local', 'protected.png')).href,
    pathToFileURL(join(root, 'gone.png')).href, 'https://example.invalid/remote.png'];
  const source = join(dir, 'session.jsonl');
  writeFileSync(source, [{ timestamp, type: 'session_meta', payload: { id: 'image-desktop', cwd: root } },
    { timestamp, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Compare the supplied image' }, { type: 'input_image', image_url: `data:image/png;base64,${data.toString('base64')}` }, { type: 'input_image', image_url: 'https://example.invalid/prompt.png?credential=must-not-persist' }] } },
    { timestamp, type: 'response_item', payload: { type: 'function_call', name: 'mcp__browser__screenshot', call_id: 'mixed', arguments: JSON.stringify({ path: join(root, 'mixed.png') }) } },
    { timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: 'mixed', output: [{ type: 'input_text', text: 'Exact supplied image caption' }, { type: 'input_image', image_url: `data:image/png;base64,${data.toString('base64')}` }, { type: 'input_image', image_url: 'https://example.invalid/result.png' }] } },
    { timestamp, type: 'event_msg', payload: { type: 'item_completed', item: { type: 'Extension', id: 'generated', kind: 'image_gen.generation', savedPath: pathToFileURL(join(root, 'space # image.png')).href, revisedPrompt: 'A synthetic diagram' } } },
    { timestamp, type: 'response_item', payload: { type: 'function_call', name: 'exec', call_id: 'parent', arguments: JSON.stringify({ code: 'text(await tools.exec_command({cmd:"first"})); text(await tools.exec_command({cmd:"second"}));' }) } },
    ...['first', 'second'].map(command => ({ timestamp, type: 'event_msg', payload: { type: 'item_completed', item: { type: 'CommandExecution', id: command, command, cwd: root, status: 'completed', exit_code: 0, aggregated_output: 'Child output' } } })),
    { timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: 'parent', output: [{ type: 'input_text', text: 'Parent image result' }, ...[data, raster(2, 1)].map(bytes => ({ type: 'input_image', image_url: `data:image/png;base64,${bytes.toString('base64')}` }))] } },
    ...paths.map((path, i) => ({ timestamp, type: 'event_msg', payload: { type: 'item_completed', item: { type: 'ImageView', id: `image-${i}`, path } } }))].map(r => JSON.stringify(r)).join('\n') + '\n');
  id = (await app.ingest.importSource('codex', source)).recordingId;
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });
async function open(page: Page) {
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
}
async function approve(page: Page) {
  const response = await page.request.post(`${server.url}/v1/recordings/${id}/workspace/approve`, { headers: { authorization: `Bearer ${server.token}`, 'content-type': 'application/json' }, data: {} }); expect(response.ok()).toBe(true);
}
for (const width of [600, 1440]) test(`native ImageView file URL recovers with current provenance and whole-image reading at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await open(page); await approve(page);
  const card = page.locator('.path-image').filter({ hasText: 'space%20%23%20image.png' }).first();
  await card.getByRole('button', { name: 'Open current file', exact: true }).click();
  await expect.poll(() => card.locator('figure img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
  await expect(card).toContainText('image bytes not captured'); await expect(card.locator('figcaption')).toContainText('It may differ from what the agent saw.');
  const opener = card.getByRole('button', { name: 'Open current image reader' }); await opener.focus(); await opener.press('Enter');
  const reader = page.getByRole('dialog', { name: 'Current image reader' }); await expect(reader).toBeVisible(); await expect(reader).toContainText('It may differ from what the agent saw.');
  const box = (await reader.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  const stage = reader.locator('.image-reader-stage'); await reader.getByRole('button', { name: 'Actual size', exact: true }).click();
  expect(await stage.evaluate(e => e.scrollWidth - e.clientWidth)).toBeGreaterThan(10); expect(await stage.evaluate(e => e.scrollHeight - e.clientHeight)).toBeGreaterThan(10);
  await stage.evaluate(e => { e.scrollLeft = e.scrollWidth; e.scrollTop = e.scrollHeight; });
  const edges = await stage.evaluate(e => { const s = e.getBoundingClientRect(), i = e.querySelector('img')!.getBoundingClientRect(); return { right: i.right - s.right, bottom: i.bottom - s.bottom }; });
  expect(edges.right).toBeLessThanOrEqual(1); expect(edges.bottom).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape'); await expect(reader).toHaveCount(0); await expect(opener).toBeFocused();
});
test('missing, protected and remote paths remain explicit without a remote request', async ({ page }) => {
  const remote: string[] = []; page.on('request', r => { if (r.url().includes('example.invalid')) remote.push(r.url()); });
  await open(page); await approve(page);
  for (const [name, reason] of [['protected.png', 'outside the readable workspace or protected'], ['gone.png', 'no longer there']]) {
    const card = page.locator('.path-image').filter({ hasText: name }).first(); await card.getByRole('button', { name: 'Open current file', exact: true }).click(); await expect(card.getByRole('status')).toContainText(reason);
  }
  const card = page.locator('.path-image').filter({ hasText: 'example.invalid' }).first(); await expect(card).toContainText('Remote image reference'); await expect(card.locator('button')).toHaveCount(0); expect(remote).toEqual([]);
});

test('mixed captured text/images and remote omissions keep their provenance without external loads', async ({ page }) => {
  const remote: string[] = []; page.on('request', r => { if (r.url().includes('example.invalid')) remote.push(r.url()); });
  await open(page);
  await expect(page.locator('.turn-images')).toContainText('a remote reference; never fetched automatically');
  await expect(page.locator('.turn-images .op-image')).toHaveCount(1);
  const mixed = page.locator(`article[data-op-id="${id}.mixed"]`); await expect(mixed).toContainText('Exact supplied image caption');
  await mixed.getByRole('button', { name: /^Expand/ }).click(); await expect(mixed).toContainText('a remote reference; never fetched automatically');
  const thumb = mixed.locator('.op-image').first(); await thumb.click();
  const reader = page.getByRole('dialog', { name: 'Captured image reader' }); await expect(reader).toContainText('Captured image'); await expect(reader).not.toContainText('Current file');
  await page.keyboard.press('Escape'); expect(remote).toEqual([]); await expect(page.locator('body')).not.toContainText('must-not-persist');
});

test('the genuine generation alias retains a current-file fallback with no invented captured pixels', async ({ page }) => {
  await open(page); await approve(page);
  const card = page.locator('article.op').filter({ hasText: 'Generated image' }).first();
  await expect(card).toContainText('image bytes not captured'); await expect(card.locator('.op-image')).toHaveCount(0);
  await card.getByRole('button', { name: 'Open current file', exact: true }).click();
  await expect.poll(() => card.locator('figure img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
  await expect(card.locator('figcaption')).toContainText('It may differ from what the agent saw.');
});

test('all script-result images stay at their exact parent when reading different children', async ({ page }) => {
  await open(page);
  const children = app.projection(id).operations.filter(o => o.parentOperationId === `${id}.parent`);
  expect(children).toHaveLength(2); let urls: string[] | undefined;
  for (const child of children) {
    const card = page.locator(`article[data-op-id="${child.id}"]`); await card.getByRole('button', { name: /^Expand/ }).click();
    const script = card.locator('details.captured-script'); await script.locator(':scope > summary').click();
    await expect(script).toContainText('does not assert which instruction caused the work'); await expect(script).toContainText('Parent image result');
    await expect(script.locator('.op-image')).toHaveCount(2);
    const current = await script.locator('.op-image img').evaluateAll(imgs => imgs.map(img => img.getAttribute('src')!));
    if (urls) expect(current).toEqual(urls); else urls = current;
    await script.locator('.op-image').last().click(); const reader = page.getByRole('dialog', { name: 'Captured image reader' });
    await expect.poll(() => reader.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2); await page.keyboard.press('Escape');
    await expect(card.locator(':scope > .op-body > .op-images')).toHaveCount(0);
  }
});


for (const failure of ['expired', 'corrupt', 'network']) test(`captured ${failure} bytes explain failure and recover only on request`, async ({ page }) => {
  let available = false, requests = 0;
  await page.route('**/images/**', async route => {
    requests++;
    if (available) await route.continue();
    else if (failure === 'network') await route.abort('failed');
    else await route.fulfill({ status: failure === 'expired' ? 404 : 200, contentType: 'image/png', body: 'unavailable bytes' });
  });
  await open(page); const thumb = page.locator('.turn-images .op-image').first(); await expect(thumb).toContainText('could not be loaded'); await thumb.click();
  const reader = page.getByRole('dialog', { name: 'Captured image reader' }); await expect(reader.getByRole('status')).toContainText('may no longer be available');
  const before = requests; await page.waitForTimeout(100); expect(requests).toBe(before);
  available = true; await reader.getByRole('button', { name: 'Retry image', exact: true }).click();
  await expect.poll(() => reader.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1600);
});

test('a current file that disappears after its access probe explains failure and retries deliberately', async ({ page }) => {
  let available = false, requests = 0;
  await page.route('**/workspace/image?*', async route => {
    requests++; if (route.request().resourceType() === 'image' && !available) await route.fulfill({ status: 404, body: '' }); else await route.continue();
  });
  await open(page); await approve(page);
  const card = page.locator('.path-image').filter({ hasText: 'space%20%23%20image.png' }).first(); await card.getByRole('button', { name: 'Open current file', exact: true }).click();
  await expect(card.getByRole('status')).toContainText('could not be loaded'); const before = requests; await page.waitForTimeout(100); expect(requests).toBe(before);
  available = true; await card.getByRole('button', { name: 'Retry current file', exact: true }).click();
  await expect.poll(() => card.locator('figure img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1600);
  await expect(card.locator('figcaption')).toContainText('It may differ from what the agent saw.');
});
