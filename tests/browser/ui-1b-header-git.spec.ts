import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { openChanges, openGitDestination } from './git-navigation.ts';

let dir: string, app: App, server: RunningServer, id: string, absentId: string;
const branch = 'feature/' + 'captured-branch-with-readable-full-name/'.repeat(5) + 'finish';
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ui1b-')); const root = join(dir, 'repository-with-a-long-captured-identity-name'); mkdirSync(root);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true });
  git('init', '-b', 'current-filesystem-branch'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  writeFileSync(join(root, 'source.ts'), 'export const value = 1;\n'); git('add', '.'); git('commit', '-m', 'fixture');
  app = new App(join(dir, 'store'));
  for (const withBranch of [true, false]) {
    const journal = join(dir, withBranch ? 'branch.jsonl' : 'absent.jsonl');
    writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'user', sessionId: withBranch ? '66666666-6666-4666-8666-666666666666' : '77777777-7777-4777-8777-777777777777', cwd: root, ...(withBranch ? { gitBranch: branch } : {}), message: { role: 'user', content: 'Synthetic recorded identity and Git navigation' } }) + '\n');
    const recording = (await app.ingest.importSource('claude-code', journal)).recordingId;
    if (withBranch) id = recording; else absentId = recording;
  }
  server = await startServer({ app, port: 0, token: 'synthetic-ui1b' });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });
async function open(page: Page, selection = id, suffix = '') {
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(server.url + '/?experience=modern&motion=0' + suffix + '#/r/' + selection);
  await expect(page.locator('.session-line-title')).toBeVisible();
}
for (const width of [600, 1440]) {
  test('captured identity, keyboard disclosure and one Git entry at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    const identity = page.locator('.session-line-branch');
    await expect(identity).toBeVisible(); await expect(identity).toHaveText(branch);
    await expect(identity).toHaveAccessibleName('Branch: ' + branch + '. Last branch in session metadata; not current Git');
    const restingWidth = (await identity.boundingBox())!.width; await identity.hover();
    await expect.poll(async () => Math.abs((await identity.boundingBox())!.width - restingWidth)).toBeLessThan(1);
    await expect(identity.locator('.session-branch-name')).toHaveCount(1);
    await identity.focus();
    const name = identity.locator('.session-branch-name');
    expect(await name.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await name.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    const box = (await name.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    const git = page.getByRole('button', { name: 'Git', exact: true }); await expect(git).toHaveCount(1);
    // GIT-9: no Git review and no popover; the Git icon opens Git graph in one click, and Changes is the header's own button.
    await expect(page.getByText('Git review')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Git graph', exact: true })).toHaveCount(0);
    await git.focus(); await git.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Git graph', exact: true })).toBeVisible(); await expect(page.getByRole('menu')).toHaveCount(0);
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'Git graph', exact: true })).toHaveCount(0); await expect(git).toBeFocused();
    const changes = await openChanges(page, 'Uncommitted'); await expect(changes).toBeVisible();
    await expect(changes.getByRole('button', { name: 'Approve read-only Git', exact: true })).toBeVisible();
    await changes.getByRole('button', { name: 'Back to agent', exact: true }).click(); await expect(page.locator('.modern-session-header').getByRole('button', { name: 'Changes', exact: true })).toBeFocused();
    await openGitDestination(page); const atlas = page.getByRole('dialog', { name: 'Git graph', exact: true }); await expect(atlas).toBeVisible();
    await expect(atlas.getByRole('button', { name: 'Approve read-only Git', exact: true })).toBeVisible();
    await page.setViewportSize({ width: width === 600 ? 1440 : 600, height: 900 }); await expect(atlas).toHaveCount(1); await expect(atlas).toBeVisible();
    await atlas.getByRole('button', { name: 'Close Git graph', exact: true }).click(); await expect(git).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
  test('replay, combined sessions, absent metadata and offline evidence at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, absentId); await expect(page.locator('.session-line-branch')).toHaveCount(0);
    await open(page, id, '&at=end'); await expect(page.locator('.session-line-branch')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Git', exact: true })).toBeDisabled();
    await open(page, id + '+' + absentId); await expect(page.locator('.session-line-branch')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Git', exact: true })).toBeDisabled();
    await page.goto(server.url + '/?demo&experience=modern&motion=0'); const git = page.getByRole('button', { name: 'Git', exact: true }); await expect(git).toBeVisible(); await expect(git).toBeDisabled(); await expect(git).toHaveAccessibleDescription('Git needs a single local session in history');
  });
}
test('privacy-outdated and root-mismatched identities stay absent', async ({ page }) => {
  await page.route('**/v1/recordings', async route => { const response = await route.fetch(); const json = await response.json(); for (const recording of json.recordings) recording.privacyOutdated = true; await route.fulfill({ response, json }); });
  await open(page); await expect(page.locator('.session-line-branch')).toHaveCount(0);
  await page.unroute('**/v1/recordings');
  await page.route('**/projection', async route => { const response = await route.fetch(); const json = await response.json(); if (json.recordedBranch) json.recordedBranch.workspaceRoot += '/another'; await route.fulfill({ response, json }); });
  await open(page); await expect(page.locator('.session-line-branch')).toHaveCount(0);
});
test('the two readers retain loading, empty, failure and command-palette behavior', async ({ page }) => {
  await open(page); await page.keyboard.press('Control+k'); await page.getByRole('combobox').fill('Review current Git changes'); await page.getByRole('combobox').press('Enter');
  const reader = page.getByRole('region', { name: 'Changes', exact: true }); await expect(reader).toBeVisible();
  await expect(reader.getByRole('button', { name: 'Uncommitted', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.route('**/git/snapshot*', async route => { await new Promise(resolve => setTimeout(resolve, 500)); await route.continue(); });
  await reader.getByRole('button', { name: 'Approve read-only Git', exact: true }).click(); await expect(reader.getByRole('button', { name: 'Refresh changes' })).toBeDisabled();
  await expect(reader.getByText('No uncommitted changes.', { exact: true })).toBeVisible();
  await page.unroute('**/git/snapshot*'); await page.route('**/git/snapshot*', route => route.fulfill({ status: 409, json: { error: 'Synthetic inspection conflict. Refresh before reviewing.' } }));
  await reader.getByRole('button', { name: 'Refresh changes' }).click(); await expect(reader).toContainText('Synthetic inspection conflict.');
  await reader.getByRole('button', { name: 'Back to agent', exact: true }).click();
  await page.route('**/git/history?*', route => route.fulfill({ status: 500, json: { error: 'Synthetic history unavailable.' } }));
  await openGitDestination(page); const atlas = page.getByRole('dialog', { name: 'Git graph', exact: true });
  const approve = atlas.getByRole('button', { name: 'Approve read-only Git', exact: true }); if (await approve.isVisible()) await approve.click();
  await expect(atlas.getByRole('alert')).toContainText('Synthetic history unavailable.');
});

test('Changes and Git graph switch without leaving the other open', async ({ page }) => {
  await open(page);
  const changes = await openChanges(page, 'Uncommitted');
  const graph = page.getByRole('dialog', { name: 'Git graph', exact: true });
  await expect(changes).toBeVisible();
  await openGitDestination(page);
  await expect(graph).toBeVisible(); await expect(changes).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(graph).toHaveCount(0);
  await openChanges(page, 'Uncommitted');
  await expect(changes).toBeVisible(); await expect(graph).toHaveCount(0);
});
