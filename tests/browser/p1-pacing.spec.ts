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

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-p1-pacing-'));
  journal = join(dir, 'session.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  app = new App(join(dir, 'data'));
  recordingId = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-pacing-test' });
  app.ingest.startLive(recordingId);
});

test.afterAll(async () => {
  if (server) await server.close();
  if (app) await app.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('refusing to remove a directory outside temp');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the tool request is visible before its result and remains beside it', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const id = 'p1-separate-result';
  append({ type: 'assistant', message: { id: `msg-${id}`, role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: 'printf drishya-live-input' } }] } });
  await app.ingest.sync(recordingId);
  const operation = page.locator('article.op-shell').filter({ hasText: 'drishya-live-input' }).last();
  await expect(operation).toBeVisible();
  await expect(operation).toContainText('Waiting for output');
  await expect(operation.locator('.state-running')).toHaveCount(1);

  append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'drishya-live-output' }] } });
  await app.ingest.sync(recordingId);
  await expect(operation).toContainText('drishya-live-output');
  await expect(operation).toContainText('drishya-live-input');
  await expect(operation.locator('.state-running')).toHaveCount(0);
});

test('MCP input and captured result can be read in the history passage', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('get-library-docs');
  await page.locator('.search-results button').first().click();
  const operation = page.locator('article.op-mcp').filter({ hasText: 'get-library-docs' });
  await operation.getByRole('button', { name: /Expand/ }).click();
  await expect(operation).toContainText('context7CompatibleLibraryID');
  await expect(operation).toContainText('Captured result preview');
  await expect(operation.locator('.op-expanded .output')).not.toBeEmpty();
});

test('a burst is captured immediately without fast-forwarding the reading camera', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const steps = page.locator('.reading-status');
  const before = Number((await steps.innerText()).match(/\d+/)?.[0]);
  for (let i = 0; i < 8; i++) {
    append({ type: 'assistant', message: { id: `p1-burst-${i}`, role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: `Burst explanation ${i}: ${'captured detail '.repeat(25)}` }] } });
  }
  await app.ingest.sync(recordingId);
  await expect(steps).toContainText(`${before + 8} recorded steps`);
  await expect(page.getByRole('button', { name: /8 new steps · Back to latest/ })).toBeVisible();
  const history = page.locator('.history');
  await expect.poll(() => history.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeGreaterThan(2);
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
});

test('content gets reading width and origin tethers use the visible instrument', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  const edit = page.locator('article.op-edit').last();
  const verification = page.locator('article.op-test').last();
  await expect(edit).toBeVisible();
  const sourceWidth = (await edit.boundingBox())!.width;
  expect(sourceWidth).toBeGreaterThan(420);
  expect(sourceWidth).toBeGreaterThan((await verification.boundingBox())!.width);
  await verification.hover();
  const tether = page.locator('.origin-thread[data-origin-type="Tool instrument"]');
  await expect(tether).toHaveCount(1);
  const instrument = (await page.locator('.instrument.k-test').boundingBox())!;
  const coordinates = (await tether.getAttribute('d'))!.match(/^M([\d.-]+),([\d.-]+)/)!;
  expect(Number(coordinates[1])).toBeCloseTo(instrument.x, 0);
  expect(Number(coordinates[2])).toBeCloseTo(instrument.y + instrument.height / 2, 0);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: '.local/p1-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(edit).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('.origin-thread')).toHaveCount(0);
});
