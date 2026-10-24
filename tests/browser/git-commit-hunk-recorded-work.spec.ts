import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, id: string, app: App, server: RunningServer, tip: string, handTip: string;
const WRITTEN = ['export function total(cart: Cart) {', '  return cart.items.reduce((sum, item) => sum + item.price, 0);', '}'];
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-git-commit-hunk-')); const root = join(dir, 'repo'); mkdirSync(join(root, 'src'), { recursive: true });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true, encoding: 'utf8' }).trim();
  git('init'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  writeFileSync(join(root, 'src/total.ts'), 'export function total() {\n  return 0;\n}\n'); writeFileSync(join(root, 'src/manual.ts'), 'export const manual = 1;\n');
  git('add', '.'); git('commit', '-m', 'fixture');
  writeFileSync(join(root, 'src/total.ts'), WRITTEN.join('\n') + '\n'); git('add', '.'); git('commit', '-m', 'Agent change to total'); tip = git('rev-parse', 'HEAD');
  writeFileSync(join(root, 'src/manual.ts'), 'export const manual = 2; // changed by hand, not by the agent\n'); git('add', '.'); git('commit', '-m', 'Hand change'); handTip = git('rev-parse', 'HEAD');
  const common = { cwd: root, sessionId: '88888888-8888-4888-8888-888888888888', timestamp: '2026-10-24T10:00:00Z' };
  const rows = [
    { ...common, type: 'user', uuid: 'u1', message: { role: 'user', content: 'Make total sum the cart' } },
    { ...common, type: 'assistant', uuid: 'a1', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'edit-1', name: 'Edit', input: { file_path: join(root, 'src/total.ts'), old_string: 'export function total() {\n  return 0;\n}', new_string: WRITTEN.join('\n') } }] } },
    { ...common, type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'edit-1', content: 'The file has been updated.' }] } },
  ];
  const journal = join(dir, 'session.jsonl'); writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-git-commit-hunk' });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

test('a commit hunk the agent wrote exactly links to its captured edit; a hand-written commit does not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl); await page.locator('.home').waitFor();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await page.getByRole('button', { name: 'Git graph', exact: true }).click();
  const atlas = page.getByRole('dialog', { name: 'Git history', exact: true });
  const approve = atlas.getByRole('button', { name: 'Approve read-only Git history', exact: true });
  await expect(approve.or(atlas.locator('.atlas-layout'))).toBeVisible(); if (await approve.isVisible()) await approve.click();
  const rows = atlas.getByRole('button', { name: /Commits ·/ }); await expect(rows).toBeVisible();
  if (await rows.getAttribute('aria-expanded') !== 'true') await rows.click();
  const open = async (hash: string, file: string) => {
    const row = atlas.locator(`[data-row-hash="${hash}"]`); await row.scrollIntoViewIfNeeded(); await row.click();
    await atlas.locator('.atlas-files>button').filter({ hasText: file }).click();
  };
  await open(handTip, 'manual.ts');
  await expect(atlas.locator('.git-patch-reader')).toContainText('changed by hand');
  await expect(atlas.locator('.hunk-recorded')).toHaveCount(0);
  await open(tip, 'total.ts');
  await expect(atlas.locator('.git-patch-reader')).toContainText('cart.items.reduce');
  const recorded = atlas.locator('.hunk-recorded');
  await expect(recorded).toHaveCount(1);
  await expect(recorded).toHaveText('Recorded work');
  await recorded.press('Enter');
  const work = page.getByRole('dialog', { name: 'Work on src/total.ts' });
  await expect(work).toBeVisible();
  await expect(work).toContainText('cart.items.reduce');
  await expect(work).toContainText('Captured patch');
});
