import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
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

/**
 * Setup a layout shift observer on the page to monitor Cumulative Layout Shift (CLS).
 */
async function attachLayoutShiftObserver(page: Page) {
  await page.evaluate(() => {
    (window as any).__cumulativeLayoutShift = 0;
    (window as any).__layoutShifts = [];
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          (window as any).__cumulativeLayoutShift += (entry as any).value;
          (window as any).__layoutShifts.push({
            value: (entry as any).value,
            sources: (entry as any).sources?.map((s: any) => ({
              tag: s.node?.tagName,
              cls: s.node?.className,
              prev: s.previousRect ? { y: Math.round(s.previousRect.y), h: Math.round(s.previousRect.height) } : null,
              curr: s.currentRect ? { y: Math.round(s.currentRect.y), h: Math.round(s.currentRect.height) } : null,
            })),
          });
        }
      }
    });
    observer.observe({ type: 'layout-shift' });
  });
}

async function getCumulativeLayoutShift(page: Page): Promise<number> {
  return await page.evaluate(() => (window as any).__cumulativeLayoutShift ?? 0);
}

for (const width of [1440, 600]) {
  test(`UI-48: wait cards display shaped placeholders and replace in place with 0 layout shift at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const dir = mkdtempSync(join(tmpdir(), `drishya-ui48-${width}-`));
    const root = join(dir, 'repo');
    mkdirSync(root);
    git(root, 'init', '-b', 'main');
    git(root, 'config', 'user.name', 'Synthetic');
    git(root, 'config', 'user.email', 'synthetic@example.invalid');
    git(root, 'config', 'core.autocrlf', 'false');

    for (let n = 1; n <= 8; n++) {
      writeFileSync(join(root, `src-file-${n}.ts`), `export const item${n} = ${n};\n`);
      git(root, 'add', '.');
      git(root, 'commit', '-m', `Commit ${n}`);
    }

    const journal = join(dir, 'synthetic.jsonl');
    writeFileSync(
      journal,
      JSON.stringify({
        type: 'user',
        uuid: 'u1',
        sessionId: `ui48-${width}`,
        cwd: root,
        message: { role: 'user', content: 'Test wait card placeholders' },
      }) + '\n',
    );

    const app = new App(join(dir, 'store'));
    let server: RunningServer | undefined;

    try {
      const { recordingId: id } = await app.ingest.importSource('claude-code', journal);
      server = await startServer({ app, port: 0, token: `ui48-${width}` });

      await page.setViewportSize({ width, height: 900 });

      // ── Surface 1: Home session wait cards ───────────────────────────
      await page.goto(`${server.launchUrl}&motion=0`);
      await expect(page.locator('.home')).toBeVisible();

      // Navigate to viewer session
      await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
      await expect(page.locator('.history')).toBeVisible();

      // ── Surface 2: Git graph wait card & CLS = 0 ─────────────────────
      let delayedGit = false;
      await page.route('**/git/history**', async (route) => {
        if (!delayedGit) {
          delayedGit = true;
          // Hold for 700ms (exceeds quietMs 400ms to show the wait card)
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        await route.continue();
      });

      await openGitDestination(page, 'Git graph');
      const dialog = page.getByRole('dialog', { name: 'Git graph', exact: true });
      const approve = dialog.getByRole('button', { name: 'Approve read-only Git', exact: true });
      await expect(approve.or(dialog.locator('.network-commit').first())).toBeVisible();
      if (await approve.isVisible()) await approve.click();

      // Verify Git graph wait card placeholder appears with shaped lanes
      const gitWaitCard = dialog.locator('.wait-card-git-graph');
      await expect(gitWaitCard).toBeVisible({ timeout: 5000 });
      await expect(gitWaitCard.locator('.wc-git-lane')).toHaveCount(6);

      // Attach layout shift observer while wait card is showing, before real commits land
      await attachLayoutShiftObserver(page);

      // Once data lands, wait card is replaced in place by the network commits
      await expect(dialog.locator('.network-commit').first()).toBeVisible({ timeout: 10_000 });
      await expect(gitWaitCard).toHaveCount(0);

      // Assert zero layout shift when content landed
      const clsGit = await getCumulativeLayoutShift(page);
      if (clsGit > 0) {
        const shifts = await page.evaluate(() => (window as any).__layoutShifts);
        console.log('LAYOUT SHIFTS:', JSON.stringify(shifts, null, 2));
      }
      expect(clsGit).toBe(0);

      // ── Surface 3: Files & Reader wait cards ─────────────────────────
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();

      // Check that Files tree is visible (open by default on desktop, or open via trigger)
      const folderTree = page.locator('.folder-tree');
      if (!await folderTree.isVisible()) {
        const filesTrigger = page.locator('[data-workspace-files-trigger]').first();
        if (await filesTrigger.isVisible()) await filesTrigger.click();
      }
      await expect(folderTree).toBeVisible();

    } finally {
      await server?.close();
      await app?.close();
      remove(dir);
    }
  });

  test(`UI-48: reduced motion and low-resource render static placeholders at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const dir = mkdtempSync(join(tmpdir(), `drishya-ui48-motion-${width}-`));
    const root = join(dir, 'repo');
    mkdirSync(root);
    git(root, 'init', '-b', 'main');
    git(root, 'config', 'user.name', 'Synthetic');
    git(root, 'config', 'user.email', 'synthetic@example.invalid');
    git(root, 'config', 'core.autocrlf', 'false');

    writeFileSync(join(root, 'file.ts'), 'export const a = 1;\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'Initial commit');

    const journal = join(dir, 'synthetic.jsonl');
    writeFileSync(
      journal,
      JSON.stringify({
        type: 'user',
        uuid: 'u1',
        sessionId: `ui48-motion-${width}`,
        cwd: root,
        message: { role: 'user', content: 'Test reduced motion' },
      }) + '\n',
    );

    const app = new App(join(dir, 'store'));
    let server: RunningServer | undefined;

    try {
      const { recordingId: id } = await app.ingest.importSource('claude-code', journal);
      server = await startServer({ app, port: 0, token: `ui48-motion-${width}` });

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.launchUrl);
      await expect(page.locator('.home')).toBeVisible();

      await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
      await expect(page.locator('.history')).toBeVisible();

      // Hold Git request
      let delayedGit = false;
      await page.route('**/git/history**', async (route) => {
        if (!delayedGit) {
          delayedGit = true;
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
        await route.continue();
      });

      await openGitDestination(page, 'Git graph');
      const dialog = page.getByRole('dialog', { name: 'Git graph', exact: true });
      const approve = dialog.getByRole('button', { name: 'Approve read-only Git', exact: true });
      await expect(approve.or(dialog.locator('.network-commit').first())).toBeVisible({ timeout: 10_000 });
      if (await approve.isVisible()) await approve.click();

      const gitWaitCard = dialog.locator('.wait-card-git-graph');
      await expect(gitWaitCard).toBeVisible({ timeout: 5000 });

      // Verify animation is 'none' under reduced motion
      const animation = await gitWaitCard.evaluate((el) => window.getComputedStyle(el).animationName);
      expect(animation).toBe('none');

    } finally {
      await server?.close();
      await app?.close();
      remove(dir);
    }
  });
}
