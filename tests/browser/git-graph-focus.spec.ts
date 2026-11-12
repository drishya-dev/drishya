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

test.describe('squash-merged branches join main in the Git graph', () => {
  let sDir: string, sApp: App, sServer: RunningServer, sId: string;
  let pHead: string, pSquash: string, openHead: string, ghHead: string, ghSquash: string;
  test.beforeEach(async () => {
    sDir = mkdtempSync(join(tmpdir(), 'drishya-squash-ui-'));
    const root = join(sDir, 'repo'); mkdirSync(root);
    git(root, 'init', '-b', 'main'); git(root, 'config', 'user.name', 'Synthetic'); git(root, 'config', 'user.email', 'synthetic@example.invalid'); git(root, 'config', 'core.autocrlf', 'false');
    git(root, 'remote', 'add', 'origin', 'https://github.com/example/demo.git');
    writeFileSync(join(root, 'shared.ts'), Array.from({ length: 20 }, (_, i) => `export const s${i} = ${i};`).join('\n') + '\n');
    git(root, 'add', '.'); git(root, 'commit', '-m', 'Base');
    git(root, 'switch', '-c', 'feature/patch');
    writeFileSync(join(root, 'shared.ts'), Array.from({ length: 20 }, (_, i) => i === 19 ? 'export const s19 = 999;' : `export const s${i} = ${i};`).join('\n') + '\n');
    git(root, 'add', '.'); git(root, 'commit', '-m', 'Patch edit'); pHead = git(root, 'rev-parse', 'HEAD');
    git(root, 'switch', 'main');
    writeFileSync(join(root, 'shared.ts'), Array.from({ length: 20 }, (_, i) => i === 0 ? 'export const s0 = 100;' : `export const s${i} = ${i};`).join('\n') + '\n');
    git(root, 'add', '.'); git(root, 'commit', '-m', 'Main drift');
    git(root, 'merge', '--squash', 'feature/patch'); git(root, 'commit', '-m', 'Patch branch (#10)'); pSquash = git(root, 'rev-parse', 'HEAD');
    git(root, 'switch', '-c', 'open-wip');
    writeFileSync(join(root, 'open.ts'), 'export const openWip = true;\n');
    git(root, 'add', '.'); git(root, 'commit', '-m', 'Unmerged WIP'); openHead = git(root, 'rev-parse', 'HEAD');
    git(root, 'switch', 'main');
    git(root, 'switch', '-c', 'feature/gh-only');
    writeFileSync(join(root, 'gh.ts'), 'export const gh = 1;\n');
    git(root, 'add', '.'); git(root, 'commit', '-m', 'GH branch commit'); ghHead = git(root, 'rev-parse', 'HEAD');
    git(root, 'switch', 'main');
    writeFileSync(join(root, 'gh.ts'), 'export const gh = 2;\n');
    git(root, 'add', '.'); git(root, 'commit', '-m', 'PR feature (#99)'); ghSquash = git(root, 'rev-parse', 'HEAD');

    const journal = join(sDir, 's.jsonl');
    writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'u1', sessionId: '88888888-8888-4888-8888-888888888888', cwd: root, timestamp: '2026-11-12T12:00:00Z', message: { role: 'user', content: 'Squash graph session' } }) + '\n');
    sApp = new App(join(sDir, 'store')); sId = (await sApp.ingest.importSource('claude-code', journal)).recordingId;
    sServer = await startServer({
      app: sApp,
      port: 0,
      token: 'squash-focus',
      gh: async (args) => {
        if (args[0] === '--version') return 'gh version 2.0.0';
        if (args[1]?.startsWith('repos/example/demo/pulls?')) {
          return JSON.stringify([{ number: 99, merged_at: '2026-11-12T12:10:00Z', head: { ref: 'feature/gh-only', sha: ghHead }, merge_commit_sha: ghSquash }]);
        }
        if (args[1] === 'repos/example/demo/pulls/10') return '';
        if (args[1] === 'repos/example/demo/pulls/99') {
          return JSON.stringify({ number: 99, merged_at: '2026-11-12T12:10:00Z', head: { ref: 'feature/gh-only', sha: ghHead }, merge_commit_sha: ghSquash });
        }
        return '';
      },
    });
  });
  test.afterEach(async () => {
    await sServer?.close(); await sApp?.close();
    if (sDir) { if (!resolve(sDir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch directory'); rmSync(sDir, { recursive: true, force: true }); }
  });

  for (const [width, palette] of [[1440, 'jet'], [600, 'midnight'], [1440, 'light']] as const) {
    test(`joins patch-matched branch offline, joins PR branch when GitHub opt-in is on, keeps WIP unjoined at ${width}px (${palette})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(sServer.launchUrl);
      await expect(page.locator('.home')).toBeVisible();
      await page.evaluate((theme) => localStorage.setItem('drishya.theme', theme), palette);
      await page.goto(`${sServer.url}/?experience=modern&motion=0#/r/${sId}`);
      await openGitDestination(page, 'Git graph');
      const dialog = page.getByRole('dialog', { name: 'Git graph', exact: true });
      const approve = dialog.getByRole('button', { name: 'Approve read-only Git', exact: true });
      await expect(approve.or(dialog.locator('.atlas-layout'))).toBeVisible();
      if (await approve.isVisible()) await approve.click();
      await expect(dialog.locator('.network-commit').first()).toBeVisible({ timeout: 40_000 });

      // Rule 1 (patch-id) joins feature/patch with GitHub lookups off; GH-only and unmerged WIP do not join.
      await expect(dialog.locator(`.network-edge[data-squash="true"][data-edge="${pHead}>${pSquash}"]`)).toHaveCount(1);
      await expect(dialog.locator(`.network-edge[data-squash="true"][data-edge^="${openHead}>"]`)).toHaveCount(0);
      await expect(dialog.locator(`.network-edge[data-squash="true"][data-edge^="${ghHead}>"]`)).toHaveCount(0);

      // Focusing the patch-matched branch explains the patch-id join honestly.
      await dialog.locator(`.thread-commit[data-commit-hash="${pHead}"]`).focus();
      await page.keyboard.press('b');
      await dialog.getByRole('group', { name: /Focused branch/ }).getByRole('button', { name: 'Next commit on this branch' }).focus();
      await expect(dialog.locator('.thread-branch-peek')).toContainText(`squash-merged into main at ${pSquash.slice(0, 7)}`);
      await expect(dialog.locator('.thread-branch-peek')).toContainText('matches this branch');
      await page.keyboard.press('Escape');

      // Opting into GitHub links clears cached Git history and joins PR #99 too, keeping open-wip unjoined.
      await dialog.getByRole('button', { name: 'Close Git graph', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
      const settings = page.getByRole('dialog', { name: 'Workspace settings', exact: true });
      await settings.getByRole('tab', { name: 'Links', exact: true }).click();
      const toggle = settings.getByRole('checkbox', { name: 'GitHub pull request and issue cards' });
      await expect(toggle).toBeEnabled();
      const toggled = page.waitForResponse((res) => res.url().includes('/v1/github/optin') && res.status() === 200);
      await toggle.click();
      await toggled;
      await expect(toggle).toBeChecked();
      await settings.getByRole('button', { name: 'Close Workspace settings', exact: true }).click();

      await openGitDestination(page, 'Git graph');
      const dialogOn = page.getByRole('dialog', { name: 'Git graph', exact: true });
      await expect(dialogOn.locator(`.network-edge[data-squash="true"][data-edge="${pHead}>${pSquash}"]`)).toHaveCount(1, { timeout: 20_000 });
      await expect(dialogOn.locator(`.network-edge[data-squash="true"][data-edge="${ghHead}>${ghSquash}"]`)).toHaveCount(1);
      await expect(dialogOn.locator(`.network-edge[data-squash="true"][data-edge^="${openHead}>"]`)).toHaveCount(0);

      await dialogOn.locator(`.thread-commit[data-commit-hash="${ghHead}"]`).focus();
      await page.keyboard.press('b');
      await dialogOn.getByRole('group', { name: /Focused branch/ }).getByRole('button', { name: 'Next commit on this branch' }).focus();
      await expect(dialogOn.locator('.thread-branch-peek')).toContainText('#99');
      await expect(dialogOn.locator('.thread-branch-peek')).toContainText('PR #99');
      expect(await dialogOn.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    });
  }
});
