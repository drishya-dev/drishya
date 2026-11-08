import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-injected-')); app = new App(join(dir, 'store')); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// CONTENT-11: Claude Code writes notices in the user role. History names them as Claude Code's, never "You", and keeps the captured text.
const NOTICE = '<task-notification>\n<task-id>bg42</task-id>\n<status>completed</status>\n<summary>Background command "Run tests" completed (exit code 0)</summary>\n</task-notification>';
test('a background-task notice is Claude Code\'s, not a prompt from the person', async ({ page }) => {
  const session = 'injected', source = join(dir, session + '.jsonl');
  const base = { cwd: dir, sessionId: session };
  const user = (uuid: string, time: string, content: unknown) => ({ ...base, timestamp: time, type: 'user', uuid, message: { role: 'user', content } });
  const assistant = (uuid: string, time: string, text: string) => ({ ...base, timestamp: time, type: 'assistant', uuid, message: { id: `m-${uuid}`, role: 'assistant', content: [{ type: 'text', text }] } });
  const rows = [
    user('p1', '2026-10-28T00:00:00Z', 'Run the tests in the background'),
    assistant('a1', '2026-10-28T00:00:01Z', 'Started them.'),
    user('n1', '2026-10-28T00:00:02Z', NOTICE),
    assistant('a2', '2026-10-28T00:00:03Z', 'The tests passed.'),
    user('p2', '2026-10-28T00:00:04Z', 'Why does <task-notification> appear in my history?'),
    assistant('a3', '2026-10-28T00:00:05Z', 'It is a notice.'),
  ];
  writeFileSync(source, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;

  for (const width of [600, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
    const rail = page.getByRole('navigation', { name: 'Prompt positions in history' });
    await expect(rail.getByRole('button')).toHaveCount(2);
    await expect(rail.getByRole('button', { name: /background task/ })).toHaveCount(0);
    await rail.getByRole('button').last().hover();
    await expect(page.locator('.prompt-rail-preview small').first()).toHaveText('Prompt 2 of 2');
    const response = await page.request.get(`${server.url}/v1/recordings/${id}/review-insights`);
    expect(response.ok()).toBe(true);
    expect((await response.json()).promptCount).toBe(2);
    await page.mouse.move(0, 0);
    const turns = page.locator('.history .turn');
    await expect(turns).toHaveCount(3);
    // The typed prompts stay "You"; a prompt that only mentions the tag is still a prompt.
    await expect(turns.nth(0).locator('.turn-who')).toHaveText('You');
    await expect(turns.nth(2).locator('.turn-who')).toHaveText('You');
    await expect(turns.nth(2).locator('.turn-text')).toContainText('Why does <task-notification> appear');
    // The notice names its source and status, shows the recorded summary, and keeps the exact captured text one click away.
    const notice = turns.nth(1);
    await expect(notice.locator('.turn-who')).toHaveText('Claude Code · background task completed');
    await expect(notice.locator('.turn-who')).toHaveAttribute('title', /not typed by you · Task bg42/);
    await expect(notice.locator('.turn-text')).toHaveText('Background command "Run tests" completed (exit code 0)');
    await expect(notice).not.toContainText('You');
    const captured = notice.locator('.turn-captured');
    await expect(captured.locator('pre')).toBeHidden();
    await captured.locator('summary').click();
    await expect(captured.locator('pre')).toHaveText(NOTICE);
  }
});
