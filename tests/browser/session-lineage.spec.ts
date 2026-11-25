import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';
let dir: string, app: App, server: RunningServer;
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = (n: number, text: string) => ({ type: 'user', uuid: uuid(n), timestamp: `2026-01-01T00:00:${String(n).padStart(2, '0')}Z`, message: { content: text } });
const boundary = (n: number, parent: number) => ({ type: 'system', subtype: 'compact_boundary', uuid: uuid(n), logicalParentUuid: uuid(parent), timestamp: '2026-01-01T00:00:02Z', compactMetadata: { trigger: 'auto', preTokens: 20 } });
async function create(name: string, rows: unknown[]) { const path = join(dir, `${name}.jsonl`); writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n'); return path; }
async function linked() {
  const parent = await create('parent', [user(1, 'Synthetic earlier chapter')]);
  const child = await create('child', [boundary(2, 1), user(1, 'Synthetic earlier chapter'), user(3, 'Synthetic later chapter')]);
  const { recordingId } = await app.ingest.importSource('claude-code', child, { lineageSources: [parent, child] });
  return { id: recordingId, child, parent: app.store.lineageView(recordingId)!.recordingIds[0]! };
}
async function open(page: Page, id: string, step?: number) { await page.goto(server.launchUrl); await page.locator('.home').waitFor(); await page.goto(`${server.url}/?experience=modern&motion=0${step === undefined ? '' : `&at=${step}`}#/r/${id}`); await page.locator('.viewer').waitFor(); }
test.beforeEach(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-lineage-browser-')); app = new App(join(dir, 'home')); server = await startServer({ app, port: 0 }); });
test.afterEach(async () => { await server?.close(); await app?.close(); if (resolve(dir).startsWith(resolve(tmpdir()) + sep)) rmSync(dir, { recursive: true, force: true }); });
for (const width of [600, 1440]) {
  test(`whole linked history and independent earlier part at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 }); const item = await linked(); await open(page, item.id);
    await expect(page.locator('.turn-text').filter({ hasText: 'Synthetic earlier chapter' })).toHaveCount(1);
    await expect(page.locator('.turn-text').filter({ hasText: 'Synthetic later chapter' })).toHaveCount(1);
    const receipt = page.getByRole('complementary', { name: 'Session file continuation' });
    await expect(receipt).toContainText('Continued from an earlier session file');
    await receipt.locator('summary').click();
    await expect(receipt).toContainText('Native controls, current Files and Git use the selected file');
    await receipt.getByRole('button', { name: 'Open earlier part', exact: true }).click();
    await expect(page.locator('.turn-text').filter({ hasText: 'Synthetic earlier chapter' })).toHaveCount(1);
    await expect(page.locator('.turn-text').filter({ hasText: 'Synthetic later chapter' })).toHaveCount(0);
    await expect(page.locator('.session-lineage')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
  test(`replay reveals the exact continuation boundary at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 }); const item = await linked();
    const transition = app.projection(item.id).lineage!.transitions!.find(t => t.recordingId === item.id)!;
    await open(page, item.id, transition.step);
    await expect(page.locator('.session-lineage')).toHaveCount(0);
    await expect(page.locator('.turn-text').filter({ hasText: 'Synthetic later chapter' })).toHaveCount(0);
    await open(page, item.id, transition.step + 1);
    await expect(page.locator('.session-lineage')).toContainText('Continued from an earlier session file');
    await expect(page.locator('.turn-text').filter({ hasText: 'Synthetic later chapter' })).toHaveCount(0);
  });
  test(`missing or ambiguous parent is honest and read-only at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const child = await create('missing', [boundary(2, 1), user(3, 'Synthetic retained chapter')]);
    const missing = await app.ingest.importSource('claude-code', child, { lineageSources: [child] });
    await open(page, missing.recordingId);
    await expect(page.locator('.session-lineage')).toContainText('Earlier session file is unavailable');
    await expect(page.locator('.session-lineage').getByRole('button')).toHaveCount(0);
    const first = await create('owner', [user(1, 'Synthetic earlier chapter')]), copy = await create('copied', [user(1, 'Synthetic earlier chapter')]);
    const ambiguous = await app.ingest.importSource('claude-code', child, { lineageSources: [child, first, copy] });
    await open(page, ambiguous.recordingId);
    await expect(page.locator('.session-lineage')).toContainText('could not be identified uniquely');
    await expect(page.locator('.session-lineage').getByRole('button')).toHaveCount(0);
    await expect(page.locator('.turn-text').filter({ hasText: 'Synthetic retained chapter' })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
test('live append remains joined while current physical control identity stays selected', async ({ page }) => {
  const item = await linked(); await open(page, item.id);
  appendFileSync(item.child, JSON.stringify(user(4, 'Synthetic newly chapter')) + '\n'); await app.ingest.sync(item.id);
  await expect(page.locator('.turn-text').filter({ hasText: 'Synthetic newly chapter' })).toHaveCount(1);
  await expect(page.locator('.turn-text').filter({ hasText: 'Synthetic earlier chapter' })).toHaveCount(1);
  const projection = await (await page.request.get(`${server.url}/v1/recordings/${item.id}/projection`)).json();
  expect(projection.recordingId).toBe(item.id); expect(projection.lineage.recordingIds).toEqual([item.parent, item.id]);
});

