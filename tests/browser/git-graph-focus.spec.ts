import { openGitDestination } from './git-navigation.ts';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// GIT-6: the graph's controls, branch focus, and the cached light that makes panning and hovering cheap.
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
  const dialog = page.getByRole('dialog', { name: 'Git history', exact: true });
  const approve = dialog.getByRole('button', { name: 'Approve read-only Git history', exact: true });
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
  // Panning moves the cached light; it does not rebuild it.
  const viewport = dialog.locator('.thread-viewport'), builds = () => viewport.getAttribute('data-light-builds');
  const built = await builds();
  await viewport.hover(); await page.mouse.wheel(40, 0); await page.mouse.wheel(-40, 0);
  await expect.poll(builds).toBe(built);
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
