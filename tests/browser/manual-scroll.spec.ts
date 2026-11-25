import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer } from './browser-server.ts';
import { pointAtHistory, beginReadingSamples, finishReadingSamples } from './history-gestures.ts';

test('upward scrolling keeps visible material steady across delayed, variable-height pages', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-manual-scroll-'));
  const journal = join(dir, 'rollout.jsonl');
  const app = new App(join(dir, 'data'));
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  const timestamp = '2026-10-17T00:00:00Z';
  const row = (payload: object) => JSON.stringify({ timestamp, type: 'response_item', payload });
  try {
    writeFileSync(journal, [JSON.stringify({ timestamp, type: 'session_meta', payload: { id: 'manual-scroll', cwd: '/home/dev/scroll' } }), ...Array.from({ length: 180 }, (_, i) => [
      row({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: Array.from({ length: 2 + i % 9 }, (_, n) => `Synthetic reading context ${i}.${n}: earlier material remains in place as this page loads.`).join('\n\n') }] }),
      row({ type: 'function_call', name: 'functions.exec_command', call_id: `call-${i}`, arguments: JSON.stringify({ cmd: `echo synthetic-scroll-${i}` }) }),
      row({ type: 'function_call_output', call_id: `call-${i}`, output: Array.from({ length: 1 + i % 15 }, (_, n) => `Synthetic output ${i}.${n}`).join('\n') }),
    ]).flat()].join('\n') + '\n');
    const { recordingId } = await app.ingest.importSource('codex', journal);
    server = await startServer({ app, port: 0 });
    // Exercise the same paged reader used for long native recordings without a
    // committed private journal or a 32MiB synthetic fixture.
    await page.route('**/v1/recordings', async route => {
      const response = await route.fetch(), body = await response.json();
      for (const recording of body.recordings) recording.sourceBytes = 34 * 1024 * 1024;
      await route.fulfill({ response, json: body });
    });
    let pages = 0;
    await page.route('**/history', async route => {
      pages++;
      await new Promise(resolve => setTimeout(resolve, pages % 2 ? 85 : 25));
      await route.continue();
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern#/r/${recordingId}`);
    const history = page.locator('.history');
    await expect(history).toBeVisible();
    await expect.poll(() => history.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(2);
    await page.waitForTimeout(400);
    await pointAtHistory(page, history);
    await beginReadingSamples(page);
    for (let n = 0; n < 95; n++) {
      await page.mouse.wheel(0, -145);
      // Include pauses beyond the old two-RAF stability check: page responses and
      // ResizeObserver were otherwise absent from the assertion window.
      await page.waitForTimeout(n % 7 === 0 ? 240 : 35);
    }
    await page.waitForTimeout(300);
    const samples = await finishReadingSamples(page);
    expect(pages).toBeGreaterThan(2);
    expect(samples.frames).toBeGreaterThan(100);
    expect(samples.jumps, 'Mounted material must move with the wheel, never jump out and back after paging').toEqual([]);
    await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
    await page.getByRole('button', { name: /Back to latest/ }).click();
    await expect.poll(() => history.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(2);
  } finally {
    await server?.close(); await app.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('temp path escaped');
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
