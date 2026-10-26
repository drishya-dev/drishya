import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// READ-8 slice 2. Synthetic only: one read and thirty edits of one file, so the action list has two pages (24 + 7).
let dir: string, root: string, id: string, app: App, server: RunningServer;
const EDITS = 30;
const file = () => join(root, 'src', 'total.ts');
const stamp = (n: number) => `2026-10-25T10:${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}Z`;
const line = (n: number) => `export const total = ${n}; // v${n}`;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-file-pages-')); root = join(dir, 'repo'); mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(file(), line(EDITS) + '\n');
  const base = (n: number) => ({ cwd: root, sessionId: '77777777-7777-4777-8777-777777777777', timestamp: stamp(n) });
  const rows: unknown[] = [
    { ...base(0), type: 'user', uuid: 'u0', message: { role: 'user', content: 'Raise the total thirty times' } },
    { ...base(1), type: 'assistant', uuid: 'a-read', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: file() } }] } },
    { ...base(1), type: 'user', uuid: 'r-read', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read-1', content: `1\t${line(0)}` }] } },
  ];
  for (let n = 1; n <= EDITS; n++) {
    rows.push(
      { ...base(n + 1), type: 'assistant', uuid: `a-edit-${n}`, message: { role: 'assistant', content: [{ type: 'tool_use', id: `edit-${n}`, name: 'Edit', input: { file_path: file(), old_string: line(n - 1), new_string: line(n) } }] } },
      { ...base(n + 1), type: 'user', uuid: `r-edit-${n}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `edit-${n}`, content: 'The file has been updated.' }] } },
    );
  }
  const journal = join(dir, 'session.jsonl'); writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-file-pages' });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

async function openWork(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue());
  await page.goto(`${server.url}/?experience=modern&motion=0#token=${server.token}`);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.locator('.viewer')).toBeVisible();
  if (!await page.locator('.folder-explorer').isVisible()) await page.getByRole('button', { name: 'Show files', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find repository files', exact: true }).fill('src/total.ts');
  await page.locator('[data-spine-path="src/total.ts"]').first().click();
  const disk = page.getByRole('dialog', { name: 'src/total.ts', exact: true });
  if (await disk.isVisible()) await disk.getByRole('button', { name: 'Recorded work on this file' }).click();
  const work = page.getByRole('dialog', { name: 'Work on src/total.ts', exact: true });
  await expect(work).toBeVisible();
  return work;
}

test('Next and Previous change continue across the two pages of the action list', async ({ page }) => {
  const work = await openWork(page);
  const steps = work.getByRole('group', { name: /Step through captured reads and edits/ });
  const previous = steps.getByRole('button', { name: 'Previous change', exact: true }), next = steps.getByRole('button', { name: 'Next change', exact: true });
  const label = steps.getByRole('status');
  await expect(label).toHaveText(/ of 24 · page 1 of 2/);
  // Walk back to the very first recorded step, the read.
  while (await previous.isEnabled()) await previous.click();
  await expect(label).toHaveText('1 of 24 · page 1 of 2');
  await expect(previous).toBeDisabled();
  for (let n = 2; n <= 24; n++) await next.click();
  await expect(label).toHaveText('24 of 24 · page 1 of 2');
  await expect(work).toContainText(line(23));
  // The last step on page 1 still has a next change: the first edit on page 2.
  await expect(next).toBeEnabled();
  await next.click();
  await expect(label).toHaveText('1 of 7 · page 2 of 2');
  await expect(work).toContainText(line(24));
  await expect(work.locator('.file-op[aria-pressed="true"]')).toHaveCount(1);
  // And the first step on page 2 goes back to the last step on page 1.
  await expect(previous).toBeEnabled();
  await previous.click();
  await expect(label).toHaveText('24 of 24 · page 1 of 2');
  await expect(work).toContainText(line(23));
  await next.click();
  for (let n = 2; n <= 7; n++) await next.click();
  await expect(label).toHaveText('7 of 7 · page 2 of 2');
  await expect(work).toContainText(line(30));
  await expect(next).toBeDisabled();
  await expect(previous).toBeEnabled();
  await expect(previous).toBeFocused();
});

test('the page label keeps the type floor and explains the page crossing', async ({ page }) => {
  const work = await openWork(page);
  const steps = work.getByRole('group', { name: /Step through captured reads and edits/ });
  const size = await steps.getByRole('status').evaluate(el => getComputedStyle(el).fontSize);
  expect(size).toBe('11px');
  await expect(steps.getByRole('status')).toHaveAttribute('title', /neighbouring page/);
});
