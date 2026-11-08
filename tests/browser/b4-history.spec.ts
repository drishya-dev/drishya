import { pointAtHistory } from './history-gestures.ts';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer } from '../../apps/daemon/src/server.ts';

test('paged history loads earlier work, preserves an anchor during capture, and navigates global search and replay', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-b4-history-'));
  const journal = join(dir, 'rollout.jsonl');
  const app = new App(join(dir, 'data'));
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  const timestamp = '2026-10-05T00:00:00Z';
  const pair = (i: number) => [
    JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'function_call', name: 'functions.exec_command', call_id: `call-${i}`, arguments: JSON.stringify({ cmd: `echo synthetic-${i}` }) } }),
    JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: `call-${i}`, output: `result-${i}` } }),
  ];
  try {
    writeFileSync(journal, [JSON.stringify({ timestamp, type: 'session_meta', payload: { id: 'b4-reader', cwd: '/home/dev/shop' } }), ...Array.from({ length: 6000 }, (_, i) => pair(i)).flat()].join('\n') + '\n');
    const { recordingId } = await app.ingest.importSource('codex', journal);
    server = await startServer({ app, port: 0, token: 'synthetic-b4' });
    await page.addInitScript(() => { localStorage.setItem('drishya.lowResource', '1'); });
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    let latestPage: unknown, superseded = false;
    await page.route('**/history', async route => {
      const query = route.request().postDataJSON() as { start?: number };
      // Model a background refresh winning the first older-page request. The
      // unchanged step/start must not permanently suppress the missing page.
      if (query.start === 0 && latestPage && !superseded) {
        superseded = true;
        await route.fulfill({ json: latestPage });
        return;
      }
      const response = await route.fetch();
      if (query.start === undefined) latestPage = await response.json();
      await route.fulfill({ response });
    });
    await page.goto(server.launchUrl);
    await expect(page.locator('.mh-home')).toBeVisible();
    await page.goto(new URL(`/#/r/${recordingId}`,server.launchUrl).href);
    await expect(page.locator('.reading-status')).toContainText('12000 recorded steps');
    await expect(page.locator('.viewer')).toHaveClass(/still/);
    expect(requests.some((url) => url.endsWith('/projection'))).toBe(false);
    const history = page.locator('.history');
    await pointAtHistory(page, history);
    await page.mouse.wheel(0, -900);
    await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
    await history.evaluate((el) => { el.scrollTop = 0; });
    await expect(page.locator(`[data-op-id="${recordingId}.call-0"]`)).toBeVisible();
    expect(superseded).toBe(true);
    const anchor = await history.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => item.getBoundingClientRect().bottom > rect.top);
      return { id: node?.dataset.passageId, offset: node ? node.getBoundingClientRect().top - rect.top : 0 };
    });
    appendFileSync(journal, pair(6000).join('\n') + '\n');
    await app.ingest.sync(recordingId);
    await expect(page.locator('.reading-status')).toContainText('12002 recorded steps');
    const after = await history.locator(`.passage-slot[data-passage-id="${anchor.id}"]`).evaluate((el) => el.getBoundingClientRect().top - el.closest('.history')!.getBoundingClientRect().top);
    expect(Math.abs(after - anchor.offset)).toBeLessThanOrEqual(1);
    expect(await history.locator('[data-op-id]').count()).toBeLessThan(500);
    await page.keyboard.press('/');
    await page.locator('.search input').fill('synthetic-5999');
    await expect(page.locator('.search-results .search-hit small').first()).toContainText(/Reply|Call|Result|Prompt|Reasoning/, { timeout: 15000 });
    await page.locator('.search-results button').first().click();
    await expect(page.locator(`[data-op-id="${recordingId}.call-5999"]`)).toBeVisible();
    await page.getByLabel('More workspace options',{exact:true}).click();
    await page.getByRole('button', { name: 'Replay this session' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Step forward', exact: true }).click();
    await expect(page.locator('.viewer')).toBeVisible();
    await page.getByRole('button', { name: 'Exit replay', exact: true }).click();
    await expect(page.locator('.reading-status')).toContainText('12002 recorded steps');
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await page.close();
    await server?.close(); await app.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('temp path escaped');
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
