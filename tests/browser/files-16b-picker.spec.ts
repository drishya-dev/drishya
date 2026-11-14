import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string;
let mainRoot: string;
let app: App;
let server: RunningServer;
let recordingId: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });

test.beforeAll(async () => {
  dir = realpathSync.native(mkdtempSync(join(realpathSync.native(tmpdir()), 'drishya-files16b-')));
  mainRoot = join(dir, 'Projects', 'drishya');
  mkdirSync(mainRoot, { recursive: true });
  git(mainRoot, 'init', '-q', '-b', 'main');
  git(mainRoot, 'config', 'user.name', 'Synthetic');
  git(mainRoot, 'config', 'user.email', 'synthetic@example.invalid');
  writeFileSync(join(mainRoot, 'index.ts'), 'export const root = "session";\n');
  writeFileSync(join(mainRoot, 'notes.md'), '# Notes\n');
  git(mainRoot, 'add', '.');
  git(mainRoot, 'commit', '-qm', 'base');

  const worktreesDir = join(dir, '.codex', 'worktrees');
  mkdirSync(worktreesDir, { recursive: true });
  const slots = ['slot-01', 'slot-02', 'slot-03', 'slot-04', 'slot-05', 'slot-06', 'slot-07', 'slot-08', 'slot-removed'];
  const worktreeRoots: string[] = [];
  for (const slot of slots) {
    const wt = join(worktreesDir, slot, 'drishya');
    git(mainRoot, 'worktree', 'add', '-q', '--detach', wt);
    writeFileSync(join(wt, 'index.ts'), `export const root = "${slot}";\n`);
    writeFileSync(join(wt, 'extra.ts'), `export const extra = "${slot}";\n`);
    worktreeRoots.push(wt);
  }

  const rows: object[] = [
    { type: 'session_meta', payload: { id: 'files16b-codex', cwd: mainRoot } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'main-0', arguments: JSON.stringify({ cmd: 'cat index.ts', workdir: mainRoot }) } },
    { type: 'response_item', payload: { type: 'function_call_output', call_id: 'main-0', output: 'export const root = "session";' } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'main-1', arguments: JSON.stringify({ cmd: 'cat notes.md', workdir: mainRoot }) } },
    { type: 'response_item', payload: { type: 'function_call_output', call_id: 'main-1', output: '# Notes' } },
  ];
  for (const [i, wt] of worktreeRoots.entries()) {
    rows.push(
      { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: `wt-${i}`, arguments: JSON.stringify({ cmd: 'cat index.ts', workdir: wt }) } },
      { type: 'response_item', payload: { type: 'function_call_output', call_id: `wt-${i}`, output: `export const root = "${slots[i]}";` } },
    );
  }

  const source = join(dir, 'codex.jsonl');
  writeFileSync(source, rows.map((row, i) => JSON.stringify({ ...row, timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() })).join('\n') + '\n');
  app = new App(join(dir, 'home'));
  recordingId = (await app.ingest.importSource('codex', source)).recordingId;

  // Remove the last worktree on disk after ingest so it appears under the quiet divider.
  rmSync(worktreeRoots.at(-1)!, { recursive: true, force: true });
  server = await startServer({ app, port: 0 });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (!resolve(dir).startsWith(realpathSync.native(tmpdir()) + sep)) throw Error('Unsafe fixture');
  rmSync(dir, { recursive: true, force: true });
});

async function setPalette(page: Page, palette: 'jet' | 'midnight' | 'paper') {
  await page.evaluate(value => {
    document.documentElement.dataset.theme = value === 'paper' ? 'light' : 'dark';
    document.documentElement.dataset.palette = value;
  }, palette);
}

for (const width of [600, 1440]) {
  test(`checkout picker names worktrees, filters, orders unavailable last and stays bounded at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.route('**/v1/working-locations', r => (r.request().method() === 'GET' ? r.fulfill({ json: { version: 1, sessions: [] } }) : r.continue()));
    await page.goto(server.launchUrl);
    await page.locator('.home').waitFor();
    await page.goto(`${server.url}/?motion=0#/r/${recordingId}`);

    const show = page.getByRole('button', { name: 'Show files', exact: true });
    if ((await show.getAttribute('aria-pressed')) !== 'true') await show.click();

    const files = page.getByRole('complementary', { name: 'Repository files' });
    const summary = files.getByLabel('Choose browsing checkout', { exact: true });
    await expect(summary).toHaveText('drishya');

    // Open via keyboard and verify filter input takes focus cleanly.
    await summary.focus();
    await page.keyboard.press('Enter');
    const filter = files.getByRole('textbox', { name: 'Filter recorded checkouts' });
    await expect(filter).toBeVisible();
    await expect(filter).toBeFocused();

    const menuBody = files.locator('.checkout-picker > .desk-options-body');
    const list = files.locator('.checkout-picker-list');
    await expect(menuBody).toBeVisible();

    // Verify all visible titles are unique without hovering (not repeating "drishya"), Session names its folder, and removed goes last under divider.
    const names = await list.locator('.checkout-option-name').allInnerTexts();
    expect(names.length).toBe(10);
    expect(new Set(names).size).toBe(10);
    expect(names[0]).toBe('drishya');
    expect(names).toContain('slot-01');
    expect(names.at(-1)).toBe('slot-removed');

    const sessionRow = list.getByRole('button', { name: 'Session checkout', exact: true });
    await expect(sessionRow).toContainText('drishya');
    await expect(sessionRow).toContainText('Session checkout');
    await expect(sessionRow).toContainText('2 files');

    const removedRow = list.getByRole('button', { name: 'slot-removed', exact: true });
    await expect(removedRow).toBeDisabled();
    await expect(removedRow).toContainText('Removed');

    const divider = list.getByRole('separator', { name: 'Removed and unavailable checkouts' });
    await expect(divider).toBeAttached();
    const orderOk = await list.evaluate(node => {
      const children = [...node.children];
      const sepIdx = children.findIndex(el => el.getAttribute('role') === 'separator');
      const remIdx = children.findIndex(el => el.getAttribute('aria-label') === 'slot-removed');
      return sepIdx > 0 && remIdx > sepIdx;
    });
    expect(orderOk).toBe(true);

    // Check strict bounding across all 3 palettes (never runs past window or overlaps bottom composer).
    for (const palette of ['jet', 'midnight', 'paper'] as const) {
      await setPalette(page, palette);
      const bounds = await page.evaluate(() => {
        const menu = document.querySelector<HTMLElement>('.checkout-picker > .desk-options-body')!;
        const scroller = document.querySelector<HTMLElement>('.checkout-picker-list')!;
        const menuRect = menu.getBoundingClientRect();
        const composer = document.querySelector<HTMLElement>('.prompt-composer')?.getBoundingClientRect();
        const label = document.querySelector<HTMLElement>('.checkout-picker-label')!;
        const items = [...scroller.querySelectorAll<HTMLElement>(':scope > *')].map(node => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, clipped: node.scrollHeight > node.clientHeight + 2 };
        });
        const overlaps = items.some((item, i) => i > 0 && item.top < items[i - 1]!.bottom - 0.5) || items.some(item => item.clipped);
        const searchInput = document.querySelector<HTMLInputElement>('.checkout-picker-search input');
        const inputBoxShadow = searchInput ? getComputedStyle(searchInput).boxShadow : 'none';
        return {
          menu: { left: menuRect.left, right: menuRect.right, top: menuRect.top, bottom: menuRect.bottom },
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          composerTop: composer && composer.height > 0 ? composer.top : undefined,
          scrollsInside: scroller.scrollHeight > scroller.clientHeight,
          summaryTruncated: label.scrollWidth > label.clientWidth + 1,
          overlaps,
          inputBoxShadow,
        };
      });
      expect(bounds.menu.left, `${width}/${palette}`).toBeGreaterThanOrEqual(0);
      expect(bounds.menu.right, `${width}/${palette}`).toBeLessThanOrEqual(bounds.innerWidth - 8);
      expect(bounds.menu.bottom, `${width}/${palette}`).toBeLessThanOrEqual(bounds.innerHeight - 8);
      if (bounds.composerTop !== undefined) {
        expect(bounds.menu.bottom, `${width}/${palette} above composer`).toBeLessThanOrEqual(bounds.composerTop - 4);
      }
      expect(bounds.scrollsInside, `${width}/${palette}`).toBe(true);
      expect(bounds.summaryTruncated, `${width}/${palette} short summary untruncated`).toBe(false);
      expect(bounds.overlaps, `${width}/${palette} rows do not overlap or squish`).toBe(false);
      expect(bounds.inputBoxShadow, `${width}/${palette} single search input border`).toBe('none');
    }

    // Filter with keyboard, navigate into the option, select with Enter, and check <summary> updates to the chosen row's name.
    await filter.fill('slot-03');
    await expect(list.locator('.checkout-option')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    const slot3 = list.getByRole('button', { name: 'slot-03', exact: true });
    await expect(slot3).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(summary).toHaveText('slot-03');

    // Escape closes an open menu cleanly and returns focus to <summary>.
    await summary.click();
    await expect(menuBody).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menuBody).toBeHidden();
    await expect(summary).toBeFocused();
  });
}
