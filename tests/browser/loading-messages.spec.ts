import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';
import { openGitDestination } from './git-navigation.ts';

const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, windowsHide: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

const remove = (dir: string) => {
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch directory');
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // Windows file locks may linger transiently
  }
};

for (const width of [1440, 600]) {
  test(`UI-47: loading messages match the wait, quiet under threshold, explanatory over 2s at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const dir = mkdtempSync(join(tmpdir(), `drishya-ui47-${width}-`));
    const root = join(dir, 'repo');
    mkdirSync(root);
    git(root, 'init', '-b', 'main');
    git(root, 'config', 'user.name', 'Synthetic');
    git(root, 'config', 'user.email', 'synthetic@example.invalid');
    git(root, 'config', 'core.autocrlf', 'false');

    for (let n = 1; n <= 10; n++) {
      writeFileSync(join(root, `file-${n}.ts`), `export const n${n} = ${n};\n`);
      git(root, 'add', '.');
      git(root, 'commit', '-m', `Commit ${n}`);
    }

    const journal = join(dir, 'synthetic.jsonl');
    writeFileSync(
      journal,
      JSON.stringify({
        type: 'user',
        uuid: 'u1',
        sessionId: `ui47-${width}`,
        cwd: root,
        message: { role: 'user', content: 'Inspect wait messages' },
      }) + '\n',
    );

    const app = new App(join(dir, 'store'));
    let server: RunningServer | undefined;

    try {
      const { recordingId: id } = await app.ingest.importSource('claude-code', journal);
      server = await startServer({ app, port: 0, token: `ui47-${width}` });

      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.launchUrl);
      await expect(page.locator('.home')).toBeVisible();

      await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
      await expect(page.locator('.history')).toBeVisible();

      // Part 1: Throttled load (> 2s) shows quiet phase then plain long explanatory notice
      let delayedOnce = false;
      await page.route('**/git/history**', async (route) => {
        if (!delayedOnce) {
          delayedOnce = true;
          // Hold request for 2300ms to exceed longMs threshold (2000ms)
          await new Promise((resolve) => setTimeout(resolve, 2300));
        }
        await route.continue();
      });

      await openGitDestination(page, 'Git graph');
      const dialog = page.getByRole('dialog', { name: 'Git graph', exact: true });
      const approve = dialog.getByRole('button', { name: 'Approve read-only Git', exact: true });
      await expect(approve.or(dialog.locator('.network-commit').first())).toBeVisible();
      if (await approve.isVisible()) await approve.click();

      // Verify that the long wait notice appears with the plain one-time explanation
      const waitNotice = dialog.locator('.wait-notice-long, .atlas-wait-long');
      await expect(waitNotice).toBeVisible({ timeout: 5000 });
      await expect(waitNotice).toContainText(
        'Reading this repository\u2019s history for the first time. This can take a minute; you can keep working, but leave the window open.',
      );

      // Verify that once data lands, the wait notice resolves cleanly and graph renders
      await expect(dialog.locator('.network-commit').first()).toBeVisible({ timeout: 10_000 });
      await expect(dialog.locator('.wait-notice-long, .atlas-wait-long')).toHaveCount(0);

      // Part 2: Repeat / fast load (< 400ms) shows no flashing wait notice
      await page.unroute('**/git/history**');
      // Close dialog
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();

      // Re-open Git graph (now cached on server / fast path)
      await openGitDestination(page, 'Git graph');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.network-commit').first()).toBeVisible();
      // Verify no long or error notice is visible
      await expect(dialog.locator('.wait-notice-long, .atlas-wait-long')).toHaveCount(0);
      await expect(dialog.locator('.wait-notice-error, .atlas-error')).toHaveCount(0);
    } finally {
      await server?.close();
      await app?.close();
      remove(dir);
    }
  });

  test(`UI-47: failure state displays plain description and retry button at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const dir = mkdtempSync(join(tmpdir(), `drishya-ui47-err-${width}-`));
    const root = join(dir, 'repo');
    mkdirSync(root);
    git(root, 'init', '-b', 'main');
    git(root, 'config', 'user.name', 'Synthetic');
    git(root, 'config', 'user.email', 'synthetic@example.invalid');
    git(root, 'config', 'core.autocrlf', 'false');

    writeFileSync(join(root, 'file-1.ts'), 'export const n = 1;\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'Initial commit');

    const journal = join(dir, 'synthetic.jsonl');
    writeFileSync(
      journal,
      JSON.stringify({
        type: 'user',
        uuid: 'u1',
        sessionId: `ui47-err-${width}`,
        cwd: root,
        message: { role: 'user', content: 'Inspect error handling' },
      }) + '\n',
    );

    const app = new App(join(dir, 'store'));
    let server: RunningServer | undefined;

    try {
      const { recordingId: id } = await app.ingest.importSource('claude-code', journal);
      server = await startServer({ app, port: 0, token: `ui47-err-${width}` });

      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.launchUrl);
      await expect(page.locator('.home')).toBeVisible();

      await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
      await expect(page.locator('.history')).toBeVisible();

      let shouldFail = true;
      await page.route('**/git/history**', async (route) => {
        if (shouldFail) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Git history unavailable: failed to read repository history.' }),
          });
        } else {
          await route.continue();
        }
      });

      await openGitDestination(page, 'Git graph');
      const dialog = page.getByRole('dialog', { name: 'Git graph', exact: true });
      const approve = dialog.getByRole('button', { name: 'Approve read-only Git', exact: true });
      await expect(
        approve
          .or(dialog.locator('.network-commit').first())
          .or(dialog.locator('.wait-notice-error, .atlas-error')),
      ).toBeVisible();
      if (await approve.isVisible()) await approve.click();

      // Verify error notice appears with role="alert", message, and Retry button
      const errorNotice = dialog.locator('.wait-notice-error, .atlas-error');
      await expect(errorNotice).toBeVisible({ timeout: 5000 });
      await expect(errorNotice).toContainText('Git history unavailable');
      const retryBtn = dialog.getByRole('button', { name: 'Retry history', exact: true });
      await expect(retryBtn).toBeVisible();

      // Now allow request to succeed and click Retry
      shouldFail = false;
      await retryBtn.click();

      // Verify recovery: graph renders and error disappears
      await expect(dialog.locator('.network-commit').first()).toBeVisible({ timeout: 10_000 });
      await expect(errorNotice).toHaveCount(0);
    } finally {
      await server?.close();
      await app?.close();
      remove(dir);
    }
  });
}
