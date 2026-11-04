import { openGitDestination } from './git-navigation.ts';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// GIT-6, UI-8: the graph's controls, the plain network layout (main on the top lane), and branch focus.
const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
let dir: string, app: App, server: RunningServer, id: string;
// Each width owns its daemon: a commit read can outlive a page and retain the Git inspection lock.
test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-graph-focus-')); const root = join(dir, 'repo'); mkdirSync(root);
  git(root, 'init', '-b', 'main'); git(root, 'config', 'user.name', 'Synthetic'); git(root, 'config', 'user.email', 'synthetic@example.invalid'); git(root, 'config', 'core.autocrlf', 'false');
  const commit = (name: string, message: string) => { writeFileSync(join(root, name), `${message}\n`); git(root, 'add', '.'); git(root, 'commit', '-m', message); };
  commit('base.ts', 'Base'); commit('main-1.ts', 'Main one');
  git(root, 'checkout', '-b', 'feature/focus'); commit('f1.ts', 'Feature one'); commit('f2.ts', 'Feature two'); commit('f3.ts', 'Feature three');
  git(root, 'checkout', 'main'); commit('main-2.ts', 'Main two'); git(root, 'merge', '--no-ff', 'feature/focus', '-m', 'Merge feature'); commit('main-3.ts', 'Main three');
  const journal = join(dir, 's.jsonl');
  writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'u1', sessionId: '77777777-7777-4777-8777-777777777777', cwd: root, timestamp: '2026-10-31T12:00:00Z', message: { role: 'user', content: 'Graph focus session' } }) + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'graph-focus' });
});
test.afterEach(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch directory'); rmSync(dir, { recursive: true, force: true }); } });

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 }); await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await openGitDestination(page, 'Git graph');
  const dialog = page.getByRole('dialog', { name: 'Git graph', exact: true });
  const approve = dialog.getByRole('button', { name: 'Approve read-only Git', exact: true });
  await expect(approve.or(dialog.locator('.atlas-layout'))).toBeVisible(); if (await approve.isVisible()) await approve.click();
  await expect(dialog.locator('.thread-graph')).toBeVisible({ timeout: 40_000 });
  await expect(dialog.locator('.thread-commit')).toHaveCount(8);
  return dialog;
}

for (const width of [1440, 700]) test(`the graph's controls are one quiet group, and a branch can be focused, stepped and cleared at ${width}px`, async ({ page }) => {
  const dialog = await open(page, width);
  const view = dialog.getByRole('group', { name: 'Git graph view' });
  for (const name of ['Zoom out Git graph', 'Zoom in Git graph', 'Fit graph']) await expect(view.getByRole('button', { name })).toBeVisible();
  const before = await view.getByRole('status').or(view.locator('output')).first().innerText();
  await view.getByRole('button', { name: 'Zoom in Git graph' }).click();
  expect(await view.locator('output').innerText()).not.toBe(before);
  await view.getByRole('button', { name: 'Fit graph' }).click();
  // Main is one straight line on the top lane: base, main one, main two, the merge and main three share a height; the feature runs below it.
  const top = (name: string) => dialog.locator('.thread-commit').and(dialog.getByRole('button', { name: new RegExp(`^${name} · `) })).evaluate((node) => (node as HTMLElement).offsetTop);
  const mainTop = await top('Base');
  for (const name of ['Main one', 'Main two', 'Merge feature', 'Main three']) expect(await top(name)).toBe(mainTop);
  for (const name of ['Feature one', 'Feature two', 'Feature three']) expect(await top(name)).toBeGreaterThan(mainTop);
  // Only real parent links are drawn: one line per parent, eight commits with eight parent links between them.
  await expect(dialog.locator('.network-edge')).toHaveCount(8);
  await expect(dialog.locator('.network-label').filter({ hasText: 'feature/focus' })).toHaveCount(1);
  // B on a commit of the feature branch focuses that branch.
  const chip = dialog.getByRole('group', { name: /Focused branch/ });
  await expect(chip).toHaveCount(0);
  const commits = dialog.locator('.thread-commit'), count = await commits.count();
  for (let i = 0; i < count && (await chip.count()) === 0; i++) { await commits.nth(i).focus(); await page.keyboard.press('b'); }
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('feature/focus'); await expect(chip).toContainText('3 commits');
  await chip.getByRole('button', { name: 'Next commit on this branch' }).click();
  await expect(chip).toContainText('1 of 3');
  await chip.getByRole('button', { name: 'Next commit on this branch' }).click();
  await expect(chip).toContainText('2 of 3');
  await chip.getByRole('button', { name: 'Previous commit on this branch' }).click();
  await expect(chip).toContainText('1 of 3');
  // The focused branch's peek offers its newest commit.
  await expect(dialog.getByRole('button', { name: 'Open newest commit' })).toBeVisible();
  // Escape clears the focus and keeps the dialog open.
  await chip.getByRole('button', { name: 'Next commit on this branch' }).focus(); await page.keyboard.press('Escape');
  await expect(chip).toHaveCount(0); await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
});
