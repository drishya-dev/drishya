import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// Synthetic only: one read and three edits of the same file, recorded in this order.
let dir: string, root: string, id: string, app: App, server: RunningServer;
const common = () => ({ cwd: root, sessionId: '88888888-8888-4888-8888-888888888888' });
const at = (n: number) => ({ ...common(), timestamp: `2026-10-25T10:00:0${n}Z` });
const file = () => join(root, 'src', 'total.ts');
const edits = [
  ['export const total = 0;', 'export const total = 1; // first'],
  ['export const total = 1; // first', 'export const total = 2; // second'],
  ['export const total = 2; // second', 'export const total = 3; // third'],
];
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-file-steps-')); root = join(dir, 'repo'); mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(file(), 'export const total = 3; // third\n');
  const rows: unknown[] = [
    { ...at(0), type: 'user', uuid: 'u0', message: { role: 'user', content: 'Raise the total in three steps' } },
    { ...at(1), type: 'assistant', uuid: 'a-read', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: file() } }] } },
    { ...at(1), type: 'user', uuid: 'r-read', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read-1', content: '1\texport const total = 0;' }] } },
  ];
  edits.forEach(([from, to], index) => {
    rows.push(
      { ...at(index + 2), type: 'assistant', uuid: `a-edit-${index}`, message: { role: 'assistant', content: [{ type: 'tool_use', id: `edit-${index}`, name: 'Edit', input: { file_path: file(), old_string: from, new_string: to } }] } },
      { ...at(index + 2), type: 'user', uuid: `r-edit-${index}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `edit-${index}`, content: 'The file has been updated.' }] } },
    );
  });
  const journal = join(dir, 'session.jsonl'); writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-file-steps' });
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
  // Depending on workspace consent, the row opens the disk reader first; follow its captured destination.
  const disk = page.getByRole('dialog', { name: 'src/total.ts', exact: true });
  if (await disk.isVisible()) await disk.getByRole('button', { name: 'Recorded work on this file' }).click();
  const work = page.getByRole('dialog', { name: 'Work on src/total.ts', exact: true });
  await expect(work).toBeVisible();
  return work;
}

test('Previous and Next change step through every captured read and edit with its version', async ({ page }) => {
  const work = await openWork(page);
  const steps = work.getByRole('group', { name: /Step through captured reads and edits/ });
  const previous = steps.getByRole('button', { name: 'Previous change', exact: true }), next = steps.getByRole('button', { name: 'Next change', exact: true });
  const label = steps.getByRole('status');
  const choice = work.getByRole('combobox', { name: 'First evidence', exact: true });
  await expect(label).toHaveText(/\d of 4/);
  // Land on the first captured step whichever evidence the panel opened with.
  while (await previous.isEnabled()) await previous.click();
  await expect(label).toHaveText('1 of 4');
  await expect(previous).toBeDisabled();
  await expect(choice).toHaveValue(/\/read$/);
  await expect(work).toContainText('export const total = 0;');
  await work.screenshot({ path: resolve('.local/file-timeline-first.png') });

  await next.click();
  await expect(label).toHaveText('2 of 4');
  await expect(previous).toBeEnabled();
  await expect(choice).toHaveValue(/\/patch$/);
  await expect(work).toContainText('first');
  await expect(work.locator('.file-op[aria-pressed="true"]')).toHaveCount(1);
  await next.click();
  await expect(label).toHaveText('3 of 4');
  await expect(work).toContainText('second');
  await next.click();
  await expect(label).toHaveText('4 of 4');
  await expect(work).toContainText('third');
  await expect(next).toBeDisabled();
  await expect(previous).toBeEnabled();
  await work.screenshot({ path: resolve('.local/file-timeline-last.png') });

  await previous.click();
  await expect(label).toHaveText('3 of 4');
  await expect(work).toContainText('second');
  await expect(next).toBeEnabled();
});

test('the stepper works from the keyboard and keeps focus on a button that still works', async ({ page }) => {
  const work = await openWork(page);
  const steps = work.getByRole('group', { name: /Step through captured reads and edits/ });
  const previous = steps.getByRole('button', { name: 'Previous change', exact: true }), next = steps.getByRole('button', { name: 'Next change', exact: true });
  const label = steps.getByRole('status');
  while (await previous.isEnabled()) await previous.click();
  await expect(label).toHaveText('1 of 4');
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(label).toHaveText('2 of 4');
  await expect(next).toBeFocused();
  await page.keyboard.press('Space');
  await expect(label).toHaveText('3 of 4');
  await page.keyboard.press('Enter');
  await expect(label).toHaveText('4 of 4');
  await expect(next).toBeDisabled();
  // The pressed button is now disabled; focus moves to the opposite step instead of falling to the page.
  await expect(previous).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(label).toHaveText('3 of 4');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(label).toHaveText('1 of 4');
  await expect(previous).toBeDisabled();
  await expect(next).toBeFocused();
});

test('the stepper keeps the type floor and hides while two versions are compared', async ({ page }) => {
  const work = await openWork(page);
  const steps = work.getByRole('group', { name: /Step through captured reads and edits/ });
  const sizes = await steps.evaluate(el => ({ control: getComputedStyle(el.querySelector('button')!).fontSize, meta: getComputedStyle(el.querySelector('[role=status]')!).fontSize }));
  expect(sizes).toEqual({ control: '12px', meta: '11px' });
  await work.getByRole('button', { name: 'Compare evidence', exact: true }).click();
  await expect(steps).toHaveCount(0);
  await work.getByRole('button', { name: 'Single evidence', exact: true }).click();
  await expect(steps).toBeVisible();
});
