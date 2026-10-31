import { openGitDestination, gitEntry } from './git-navigation.ts';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, root: string, id: string, app: App, server: RunningServer;
const WRITTEN = ['export function total(cart: Cart) {', '  return cart.items.reduce((sum, item) => sum + item.price, 0);', '}'];
const DOUBLED = ['export function double(values: number[]) {', '  return values.map(value => value * 2);', '}'];
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-git-hunk-')); root = join(dir, 'repo'); mkdirSync(join(root, 'src'), { recursive: true });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true });
  git('init'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  writeFileSync(join(root, 'src/total.ts'), 'export function total() {\n  return 0;\n}\n');
  writeFileSync(join(root, 'src/manual.ts'), 'export const manual = 1;\n');
  writeFileSync(join(root, 'src/twice.ts'), 'export function double() {\n  return [];\n}\n');
  git('add', '.'); git('commit', '-m', 'fixture');
  // The agent's edit and the working tree agree for total.ts; manual.ts changed by hand, with no captured edit.
  writeFileSync(join(root, 'src/total.ts'), WRITTEN.join('\n') + '\n');
  writeFileSync(join(root, 'src/twice.ts'), DOUBLED.join('\n') + '\n');
  writeFileSync(join(root, 'src/manual.ts'), 'export const manual = 2; // changed by hand, not by the agent\n');
  const common = { cwd: root, sessionId: '77777777-7777-4777-8777-777777777777', timestamp: '2026-10-23T10:00:00Z' };
  const rows = [
    { ...common, type: 'user', uuid: 'u1', message: { role: 'user', content: 'Make total sum the cart' } },
    { ...common, type: 'assistant', uuid: 'a1', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'edit-1', name: 'Edit', input: { file_path: join(root, 'src/total.ts'), old_string: 'export function total() {\n  return 0;\n}', new_string: WRITTEN.join('\n') } }] } },
    { ...common, type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'edit-1', content: 'The file has been updated.' }] } },
    { ...common, type: 'user', uuid: 'u2', message: { role: 'user', content: 'Add a double helper' } },
    { ...common, type: 'assistant', uuid: 'a2', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'edit-2', name: 'Edit', input: { file_path: join(root, 'src/twice.ts'), old_string: 'export function double() {\n  return [];\n}', new_string: ['// first pass', ...DOUBLED].join('\n') } }] } },
    { ...common, type: 'user', uuid: 'r2', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'edit-2', content: 'The file has been updated.' }] } },
    { ...common, type: 'user', uuid: 'u3', message: { role: 'user', content: 'Apply it again' } },
    { ...common, type: 'assistant', uuid: 'a3', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'edit-3', name: 'Edit', input: { file_path: join(root, 'src/twice.ts'), old_string: 'export function double() {\n  return [];\n}', new_string: ['// second pass', ...DOUBLED].join('\n') } }] } },
    { ...common, type: 'user', uuid: 'r3', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'edit-3', content: 'The file has been updated.' }] } },
  ];
  const journal = join(dir, 'session.jsonl'); writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-git-hunk' });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

/** The daemon restores the file panel an earlier test left open; the next test starts from the session, not from it. */
async function closeRestoredWork(page: Page) {
  const work = page.getByRole('dialog', { name: /^Work on / });
  if (await work.count()) { await page.keyboard.press('Escape'); await expect(work).toHaveCount(0); }
}

async function openReview(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server.url}/?experience=modern&motion=0#token=${server.token}`);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(gitEntry(page, 'Git review')).toBeVisible();
  await closeRestoredWork(page);
  await openGitDestination(page, 'Git review');
  const review = page.getByRole('dialog', { name: 'Git review', exact: true });
  await expect(review).toBeVisible();
  const workspaceConsent = review.getByRole('button', { name: 'Approve current workspace' });
  const gitConsent = review.getByRole('button', { name: 'Approve read-only Git' });
  const refresh = review.getByRole('button', { name: 'Refresh changes' });
  await expect(workspaceConsent.or(gitConsent).or(refresh)).toBeVisible();
  if (await workspaceConsent.isVisible()) await workspaceConsent.click();
  await expect(gitConsent.or(refresh)).toBeVisible();
  if (await gitConsent.isVisible()) await gitConsent.click(); else await refresh.click();
  return review;
}

test('a Git hunk the agent wrote exactly links to that captured edit; a hand change does not', async ({ page }) => {
  const review = await openReview(page);
  const files = review.getByRole('complementary', { name: 'Git changed files' });
  await files.getByRole('button', { name: /manual\.ts/ }).click();
  await expect(review.locator('.git-patch')).toContainText('changed by hand');
  await expect(review.locator('.hunk-recorded')).toHaveCount(0);
  await files.getByRole('button', { name: /total\.ts/ }).click();
  await expect(review.locator('.git-patch')).toContainText('cart.items.reduce');
  const recorded = review.locator('.hunk-recorded');
  await expect(recorded).toHaveCount(1);
  await expect(recorded).toHaveText('Recorded work');
  await expect(recorded).toHaveAttribute('title', /exactly these added lines/);
  await review.screenshot({ path: resolve('.local/git-hunk-recorded.png') });
  await recorded.press('Enter');
  const work = page.getByRole('dialog', { name: 'Work on src/total.ts' });
  await expect(work).toBeVisible();
  await expect(work).toContainText('cart.items.reduce');
  await expect(work).toContainText('Captured patch');
});

test('several captured edits wrote a hunk: Recorded work is a keyboard menu, newest first, inside a phone viewport', async ({ page }) => {
  const review = await openReview(page);
  await review.getByRole('complementary', { name: 'Git changed files' }).getByRole('button', { name: /twice\.ts/ }).click();
  await expect(review.locator('.git-patch')).toContainText('values.map');
  const trigger = review.locator('.recorded-work-menu > summary');
  await expect(trigger).toHaveText('Recorded work · 2 edits');
  const items = review.locator('.recorded-work-menu .desk-options-body button');
  await expect(items.first()).toBeHidden();
  await trigger.focus(); await page.keyboard.press('Enter');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveAccessibleName(/^Turn 3 · /);
  await expect(items.nth(1)).toHaveAccessibleName(/^Turn 2 · /);
  await review.screenshot({ path: resolve('.local/git-hunk-recorded-menu.png') });
  // Type floor: controls 12 px, metadata 11 px.
  const size = (locator: ReturnType<Page['locator']>) => locator.evaluate(el => getComputedStyle(el).fontSize);
  expect(await size(trigger)).toBe('12px');
  expect(await size(items.nth(0))).toBe('12px');
  expect(await size(items.nth(0).locator('.recorded-turn'))).toBe('11px');
  // Arrows move, Escape closes and returns focus, outside click dismisses.
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(items.first()).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(review).toBeVisible();
  await page.keyboard.press('Space');
  await expect(items.first()).toBeVisible();
  await review.getByRole('heading').first().click({ force: true });
  await expect(items.first()).toBeHidden();
  // 390 px: the opened list stays inside the viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.scrollIntoViewIfNeeded(); await trigger.click();
  await expect(items.first()).toBeVisible();
  for (const box of [await review.locator('.recorded-work-menu .desk-options-body').boundingBox(), await trigger.boundingBox()]) {
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: resolve('.local/git-hunk-recorded-menu-390.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  // Choosing the older edit opens that edit's captured patch, not the latest.
  await items.nth(1).focus(); await page.keyboard.press('Enter');
  const work = page.getByRole('dialog', { name: 'Work on src/twice.ts' });
  await expect(work).toBeVisible();
  await expect(work).toContainText('Captured patch');
  await expect(work).toContainText('first pass');
  await expect(work).not.toContainText('second pass');
});
