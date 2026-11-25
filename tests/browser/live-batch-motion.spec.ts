import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

for (const width of [600, 1440]) test(`batched live arrivals and outcomes survive same-step reading at ${width}`, async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-live6-'));
  const app = new App(join(dir, 'store'));
  let server: RunningServer | undefined;
  try {
    const file = join(dir, 'synthetic.jsonl');
    const base = { sessionId: 'live6-synthetic', cwd: dir };
    const user = (id: string, content: unknown) => ({ ...base, type: 'user', uuid: id, message: { role: 'user', content } });
    const assistant = (id: string, content: unknown) => ({ ...base, type: 'assistant', uuid: id, message: { id, role: 'assistant', content } });
    const rows = Array.from({ length: 80 }, (_, i) => [
      user(`u${i}`, `Synthetic prompt ${i}`),
      assistant(`a${i}`, [{ type: 'text', text: 'Synthetic recorded response. '.repeat(12) }]),
    ]).flat();
    writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    const id = (await app.ingest.importSource('claude-code', file)).recordingId;
    server = await startServer({ app, port: 0 });
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      const observed = window as typeof window & { resolves: string[] };
      observed.resolves = [];
      document.addEventListener('animationstart', event => {
        if (event.animationName !== 'resolve') return;
        const op = (event.target as Element).closest<HTMLElement>('[data-op-id]');
        if (op) observed.resolves.push(op.dataset.opId!);
      }, true);
    });
    await page.goto(server.launchUrl);
    await page.locator('.home').waitFor();
    await page.goto(`${server.url}/?experience=modern#/r/${id}`);
    await page.locator('.history').waitFor();

    // Both calls and both results land in one update, followed by a prose record.
    const calls = ['new-a', 'new-b'].map(id => ({ type: 'tool_use', id, name: 'Bash', input: { command: 'echo synthetic' } }));
    appendFileSync(file, [
      assistant('calls', calls),
      user('results', calls.map(call => ({ type: 'tool_result', tool_use_id: call.id, content: 'Synthetic output' }))),
      assistant('reply', [{ type: 'text', text: 'Synthetic finished response.' }]),
    ].map(row => JSON.stringify(row)).join('\n') + '\n');
    await app.ingest.sync(id);
    await expect(page.locator('.op')).toHaveCount(2);
    await expect(page.locator('.op.ph-arriving')).toHaveCount(2);
    await expect(page.locator('.op.resolving')).toHaveCount(2);
    const resolves = () => page.evaluate(() => (window as typeof window & { resolves: string[] }).resolves);
    await expect.poll(async () => (await resolves()).length).toBe(2);

    // Force a real virtual-window unmount, then return at exactly the same step.
    const history = page.locator('.history');
    await history.evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
    await expect(page.locator('.op')).toHaveCount(0);
    await history.evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
    await expect(page.locator('.op')).toHaveCount(2);
    await page.waitForTimeout(700); // Observe beyond the existing 500 ms Resolve marker animation.
    expect((await resolves()).length).toBe(2);
    expect(new Set(await resolves()).size).toBe(2);

    for (const data of [{ since: -1 }, { since: 1.5 }, { previousSince: 'x' }]) {
      expect((await page.request.post(`${server.url}/v1/recordings/${id}/history`, { data })).status()).toBe(400);
    }
  } finally {
    await server?.close();
    await app.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});
