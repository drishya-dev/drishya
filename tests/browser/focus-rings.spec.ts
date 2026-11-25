import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, main: string, worker: string, app: App, server: RunningServer, recordingId: string;
const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });

test.beforeAll(async () => {
  dir = realpathSync.native(mkdtempSync(join(realpathSync.native(tmpdir()), 'drishya-ui30-focus-')));
  main = join(dir, 'main');
  worker = join(dir, 'worker');
  mkdirSync(main);
  git(main, 'init', '-q', '-b', 'main');
  git(main, 'config', 'user.name', 'Synthetic');
  git(main, 'config', 'user.email', 'synthetic@example.invalid');
  writeFileSync(join(main, 'index.ts'), 'export const focusCheck = 1;\n');
  git(main, 'add', '.');
  git(main, 'commit', '-qm', 'Synthetic base');
  git(main, 'worktree', 'add', '-q', '-b', 'feature/worker', worker);
  writeFileSync(join(worker, 'worker.ts'), 'export const workerCheck = 2;\n');

  app = new App(join(dir, 'home'));
  const rows = [
    { type: 'user', uuid: 'u1', sessionId: 'ui30-claude', cwd: main, message: { content: 'Inspect the worktree setup' } },
    { type: 'assistant', uuid: 'a1', sessionId: 'ui30-claude', cwd: main, gitBranch: 'main', message: { content: [{ type: 'tool_use', id: 'read1', name: 'Read', input: { file_path: join(main, 'index.ts') } }] } },
    { type: 'user', uuid: 'r1', sessionId: 'ui30-claude', cwd: main, message: { content: [{ type: 'tool_result', tool_use_id: 'read1', content: '     1\texport const focusCheck = 1;' }] } },
    { type: 'assistant', uuid: 'a2', sessionId: 'ui30-claude', cwd: worker, gitBranch: 'feature/worker', message: { content: [{ type: 'tool_use', id: 'read2', name: 'Read', input: { file_path: join(worker, 'worker.ts') } }] } },
    { type: 'user', uuid: 'r2', sessionId: 'ui30-claude', cwd: worker, message: { content: [{ type: 'tool_result', tool_use_id: 'read2', content: '     1\texport const workerCheck = 2;' }] } },
    { type: 'assistant', uuid: 'a3', sessionId: 'ui30-claude', cwd: main, gitBranch: 'main', message: { content: [{ type: 'text', text: 'Checked both checkouts:\n\n```ts\nconst ok = true;\n```' }] } },
  ];
  const source = join(dir, 'claude.jsonl');
  writeFileSync(source, rows.map((row, i) => JSON.stringify({ ...row, timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() })).join('\n') + '\n');
  recordingId = (await app.ingest.importSource('claude-code', source)).recordingId;
  server = await startServer({ app, port: 0 });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (!resolve(dir).startsWith(realpathSync.native(tmpdir()) + sep)) throw new Error('Unsafe fixture');
  rmSync(dir, { recursive: true, force: true });
});

async function ensureFilesOpen(page: Page) {
  const show = page.getByRole('button', { name: 'Show files', exact: true });
  if ((await show.getAttribute('aria-pressed')) !== 'true') await show.click();
  await expect(page.locator('.checkout-picker > summary')).toBeVisible();
}

for (const width of [600, 1440]) {
  for (const palette of ['jet', 'midnight', 'paper'] as const) {
    test(`suppresses rings after pointer clicks and keeps thin neutral rings on Tab at ${width} (${palette})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => {
        try {
          localStorage.setItem('drishya.theme', value);
        } catch {
          /* ignore */
        }
      }, palette === 'paper' ? 'light' : palette === 'midnight' ? 'midnight' : 'dark');
      await page.goto(server.launchUrl);
      await page.locator('.home').waitFor();
      await page.goto(`${server.url}/?motion=0#/r/${recordingId}`);
      await expect(page.locator('.viewer')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-palette', palette);

      const summary = page.locator('.checkout-picker > summary');
      const history = page.locator('.history');

      // Type in the composer first -> switches modality to keyboard.
      const expandPrompt = page.locator('.composer-minimize');
      if ((await expandPrompt.getAttribute('aria-expanded')) === 'false') await expandPrompt.click();
      const composerInput = page.locator('.prompt-composer textarea');
      await expect(composerInput).toBeVisible();
      await composerInput.click();
      await page.keyboard.type('check');
      await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'keyboard');

      // Click checkout picker summary and close it -> pointer modality suppresses any ring.
      await ensureFilesOpen(page);
      await summary.click();
      await expect(page.locator('.checkout-picker')).toHaveAttribute('open', '');
      await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'pointer');
      await summary.click();
      await expect(page.locator('.checkout-picker')).not.toHaveAttribute('open', '');
      expect(await summary.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');

      // Close Files at 600px if it overlays history, or click directly into .history at 1440px.
      if (width === 600) {
        await page.getByRole('button', { name: 'Minimize files', exact: true }).click();
      }
      await history.click({ position: { x: Math.round(width / 2), y: 260 } });
      await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'pointer');
      expect(await history.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');

      // Keyboard Tab restores unified 1px neutral ring from --focus-ring (not azure/accent --focus).
      await ensureFilesOpen(page);
      await page.keyboard.press('Tab');
      await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'keyboard');
      await summary.focus();
      const summaryOutline = await summary.evaluate(el => {
        const probe = document.createElement('span');
        probe.style.outline = '1px solid var(--focus-ring)';
        document.body.appendChild(probe);
        const expectedColor = getComputedStyle(probe).outlineColor;
        probe.remove();
        const style = getComputedStyle(el);
        return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor, expectedColor };
      });
      expect(summaryOutline.style).toBe('solid');
      expect(summaryOutline.width).toBe('1px');
      expect(summaryOutline.color).toBe(summaryOutline.expectedColor);

      if (width === 600) {
        await page.getByRole('button', { name: 'Minimize files', exact: true }).click();
      }
      // Regions and scrollers keep outline: none even when focused under keyboard modality.
      await page.keyboard.press('Tab');
      for (const locator of [history, page.locator('.md-code').first()]) {
        await expect(locator).toBeVisible();
        await locator.focus();
        expect(await locator.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
      }

      // Pointer open + Close returns focus without ring; keyboard open + Escape returns focus with ring.
      const settingsBtn = page.getByRole('button', { name: 'Workspace settings', exact: true });
      await settingsBtn.click();
      const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: /^Close / }).click();
      await expect(dialog).toHaveCount(0);
      await expect(settingsBtn).toBeFocused();
      expect(await settingsBtn.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');

      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(settingsBtn).toBeFocused();
      expect(await settingsBtn.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
      expect(await settingsBtn.evaluate(el => getComputedStyle(el).outlineWidth)).toBe('1px');
    });
  }
}

test('Workspace split panes show an inset top cue rather than a perimeter outline on keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(server.launchUrl);
  await page.locator('.home').waitFor();
  await page.goto(`${server.url}/?motion=0#/r/${recordingId}`);
  await expect(page.locator('.viewer')).toBeVisible();
  await page.getByRole('button', { name: 'Open developer workspace', exact: true }).click();
  await expect(page.locator('.developer-workspace')).toBeVisible();
  const approve = page.getByRole('button', { name: 'Approve workspace reading', exact: true });
  if (await approve.isVisible()) {
    await approve.click();
    await expect(approve).toHaveCount(0);
  }
  await page.locator('summary[aria-label="Workspace layout actions"]').click();
  await page.getByRole('button', { name: 'Split view', exact: true }).click();
  const pane = page.locator('.desk-pane[tabindex="0"]').first();
  await expect(pane).toBeVisible();
  await page.keyboard.press('Tab');
  await pane.focus();
  const cue = await pane.evaluate(el => ({
    outline: getComputedStyle(el).outlineStyle,
    emptyShadow: getComputedStyle(el.querySelector('.desk-empty')!).boxShadow,
  }));
  expect(cue.outline).toBe('none');
  expect(cue.emptyShadow).not.toBe('none');
});
