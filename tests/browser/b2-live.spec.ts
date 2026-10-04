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
let callNumber = 0;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-b2-browser-'));
  journal = join(dir, 'session.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  app = new App(join(dir, 'data'));
  recordingId = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-browser-test' });
  app.ingest.startLive(recordingId);
});

test.afterAll(async () => {
  if (server) await server.close();
  if (app) await app.close();
  if (dir) {
    const target = resolve(dir);
    if (!target.startsWith(resolve(tmpdir()) + sep)) throw new Error('refusing to remove a directory outside the temp root');
    rmSync(target, { recursive: true, force: true });
  }
});

function appendSyntheticRecords() {
  const rows: string[] = [];
  for (let i = 0; i < 100; i++) {
    const id = `b2-call-${callNumber++}`;
    const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', version: '2.1.0', timestamp: new Date().toISOString() };
    rows.push(JSON.stringify({ ...base, uuid: randomUUID(), type: 'assistant', message: { id: `msg-${id}`, role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: `Synthetic live review step ${i}.` }, { type: 'tool_use', id, name: 'Read', input: { file_path: '/home/dev/shop/src/checkout/guard.ts' } }] } }));
    rows.push(JSON.stringify({ ...base, uuid: randomUUID(), type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: `     1\t// synthetic result ${i}` }] } }));
  }
  appendFileSync(journal, rows.join('\n') + '\n');
  return app.ingest.sync(recordingId);
}

type Anchor = { id?: string; offset?: number };

test('live history keeps the reader anchored across bursts, sizes, reconnect and map-off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const history = page.locator('.history');
  const latest = page.getByRole('button', { name: /Back to latest/ });
  const steps = page.locator('.reading-status');
  await expect(steps).toContainText('24 recorded steps');
  await expect(page.locator('.viewer')).toHaveClass(/still/);

  await page.locator('.code .ln-tx').first().click({ clickCount: 3 });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().trim().length ?? 0)).toBeGreaterThan(0);
  await expect(latest).toBeVisible(); // selecting source holds the reader, not the capture.
  await latest.click();
  await expect(latest).toHaveCount(0);

  await page.getByRole('button', { name: 'Map on' }).click();
  await expect(page.locator('.map')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore' })).toBeDisabled();

  for (const width of [1440, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await history.hover();
    await page.mouse.wheel(0, -900);
    await expect(latest).toBeVisible();
    const anchor: Anchor = await history.evaluate((el) => {
      const viewport = el.getBoundingClientRect();
      const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => item.getBoundingClientRect().bottom > viewport.top + 1);
      return { id: node?.dataset.passageId, offset: node ? Math.round(node.getBoundingClientRect().top - viewport.top) : undefined };
    });
    expect(anchor.id).toBeTruthy();
    const before = Number((await steps.innerText()).match(/\d+/)?.[0]);
    await appendSyntheticRecords(); // 200 source records become 300 observations/steps.
    await expect(steps).toContainText(`${before + 300} recorded steps`);
    await expect(latest).toContainText('300 new steps');
    const after: Anchor = await history.evaluate((el) => {
      const viewport = el.getBoundingClientRect();
      const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => item.getBoundingClientRect().bottom > viewport.top + 1);
      return { id: node?.dataset.passageId, offset: node ? Math.round(node.getBoundingClientRect().top - viewport.top) : undefined };
    });
    expect(after.id).toBe(anchor.id);
    expect(Math.abs((after.offset ?? Infinity) - (anchor.offset ?? 0))).toBeLessThanOrEqual(1);

    // Reaching the bottom by scrolling is not consent to resume following.
    await history.hover();
    await page.mouse.wheel(0, 100_000);
    await expect(latest).toBeVisible();
    await latest.click();
    await expect(latest).toHaveCount(0);
    await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.spine-file[title="src/checkout/guard.ts"]').click();
  await page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' }).getByRole('button', { name: 'Read Read src/checkout/guard.ts 1–14 read' }).click();
  await expect(page.getByRole('complementary', { name: 'Operation detail' }).getByRole('region', { name: 'Content of src/checkout/guard.ts' })).toContainText("if (!cart.total)");

  await page.reload(); // a new browser connection must reload the same committed history.
  await expect(steps).toContainText('924 recorded steps');
  await expect(page.locator('.map')).toHaveCount(0);
  await expect(page.locator('.viewer')).toHaveClass(/still/);
  expect(app.store.getRecording(recordingId)?.observationCount).toBe(926);
  expect((await app.ingest.sync(recordingId)).added).toBe(0);
});
