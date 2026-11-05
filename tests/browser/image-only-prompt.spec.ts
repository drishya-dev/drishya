import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-image-prompt-')); app = new App(join(dir, 'store')); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// CONTENT-1: a Claude prompt record that holds an image and no text part is still a turn, shown with its image and no words of its own.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
test('an image-only prompt is a turn with its image and no invented text', async ({ page }) => {
  const session = 'image-only', source = join(dir, session + '.jsonl');
  const base = { cwd: dir, sessionId: session };
  const user = (uuid: string, time: string, content: unknown) => ({ ...base, timestamp: time, type: 'user', uuid, message: { role: 'user', content } });
  const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } };
  const rows = [
    user('p1', '2026-10-28T00:00:00Z', 'Describe the layout'),
    { ...base, timestamp: '2026-10-28T00:00:01Z', type: 'assistant', uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'Which screen?' }] } },
    user('p2', '2026-10-28T00:00:02Z', [image]),
    { ...base, timestamp: '2026-10-28T00:00:03Z', type: 'assistant', uuid: 'a2', message: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'Thanks, I see it.' }] } },
  ];
  writeFileSync(source, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;

  for (const width of [600, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
    const turns = page.locator('.history .turn');
    await expect(turns).toHaveCount(2);
    await expect(turns.first().locator('.turn-text')).toHaveText('Describe the layout');
    // The second turn is the image alone: its picture is shown and it carries no text of its own.
    await expect(turns.nth(1).locator('.turn-images')).toHaveCount(1);
    await expect(turns.nth(1).locator('.turn-text')).toHaveCount(0);
    await expect(page.locator('.history')).toContainText('Thanks, I see it.');
  }
});
