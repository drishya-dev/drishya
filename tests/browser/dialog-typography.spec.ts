import { openGitDestination } from './git-navigation.ts';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, id: string, app: App, server: RunningServer;
// A fresh app per test: workspace and Git grants persist on the server and would change what the next test opens.
test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-dialog-type-')); const root = join(dir, 'repo'); mkdirSync(join(root, 'src'), { recursive: true });
  const git = (...a: string[]) => execFileSync('git', a, { cwd: root, windowsHide: true, encoding: 'utf8' }).trim();
  git('init'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  writeFileSync(join(root, 'src/a.ts'), 'export const a = 1;\nexport const b = 2;\n'); git('add', '.'); git('commit', '-m', 'first'); git('tag', 'v1');
  writeFileSync(join(root, 'src/a.ts'), 'export const a = 2;\nexport const b = 3;\n'); git('add', '.'); git('commit', '-m', 'second change');
  writeFileSync(join(root, 'src/a.ts'), 'export const a = 3;\n'); writeFileSync(join(root, 'src/new.ts'), 'export const n = 1;\n');
  const journal = join(dir, 'session.jsonl'); writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'u', sessionId: '99999999-9999-4999-8999-999999999999', cwd: root, message: { role: 'user', content: 'Typography' } }) + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-dialog-type' });
});
test.afterEach(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-2: metadata 11 px and controls 12 px inside the Modern dialogs. The turn ledger fold line stays 11 px (see
// session-typography.spec.ts); SVG glyphs are not text; icon-only buttons hide their label at 0 px.
const EXEMPT = '.turn-fold, svg *';
// Rules this slice raised: their text must also keep 4.5:1 on the composited background on every palette.
const RAISED = '.modern-git-context small, .git-file-name small, .git-review-layout aside small, .desk-header small';

async function press(page: Page, name: string | RegExp) {
  if (name === 'Git review' || name === 'Git graph') { await openGitDestination(page, name); return; }
  const direct = page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  if (await direct.isVisible().catch(() => false)) { await direct.click(); return; }
  await page.getByLabel('More workspace options', { exact: true }).click();
  await page.locator('.workspace-menu[open]').getByRole('button', { name }).first().click();
}
async function approve(page: Page, name: RegExp) { const b = page.getByRole('button', { name }).first(); if (await b.isVisible().catch(() => false)) await b.click(); }
async function failures(page: Page) {
  return page.evaluate(({ exempt, raised }) => {
    const result: string[] = [];
    const rgba = (value: string) => { const c = document.createElement('canvas').getContext('2d')!; c.clearRect(0, 0, 1, 1); c.fillStyle = value; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); };
    const over = (front: number[], back: number[]) => front.slice(0, 3).map((v, i) => v * front[3]! + back[i]! * (1 - front[3]!)).concat(1);
    const luma = (rgb: number[]) => rgb.slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i]!, 0);
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!el.getClientRects().length || !el.checkVisibility() || el.closest('[aria-hidden=true]') || el.matches(exempt) || el.matches('option,:disabled')) continue;
      const control = el.matches('button, summary, select, input, textarea');
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()) || (control && !!(el as HTMLInputElement).placeholder);
      if (!own) continue;
      const style = getComputedStyle(el), size = parseFloat(style.fontSize), label = `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} "${(el.textContent || (el as HTMLInputElement).placeholder || '').trim().slice(0, 28)}"`;
      if (size === 0) continue;
      const floor = control ? 12 : 11;
      if (size < floor) result.push(`${label}: ${style.fontSize} < ${floor}px`);
      if (el.matches(raised)) {
        const parents: Element[] = []; for (let p: Element | null = el; p; p = p.parentElement) parents.unshift(p);
        let background = [255, 255, 255, 1]; for (const p of parents) background = over(rgba(getComputedStyle(p).backgroundColor), background);
        const a = luma(over(rgba(style.color), background)), b = luma(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (ratio < 4.5) result.push(`${label}: contrast ${ratio.toFixed(2)}`);
      }
    }
    return result;
  }, { exempt: EXEMPT, raised: RAISED });
}
async function everyPalette(page: Page, state: string) {
  for (const palette of ['jet', 'paper', 'midnight']) {
    await page.evaluate(value => { document.documentElement.dataset.palette = value; }, palette);
    // Colour transitions must settle before measuring, but a looping or paused animation never finishes: bound the wait.
    await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))), new Promise(done => setTimeout(done, 1500))]));
    expect(await failures(page), `${state} / ${palette}`).toEqual([]);
  }
}
async function openSession(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(`${server.url}/?experience=modern&motion=0#token=${server.token}`); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`); await expect(page.locator('.workspace-header')).toBeVisible();
}

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`Git review and Workspace keep metadata at 11 px, controls at 12 px and the raised text at 4.5:1 at ${width}px`, async ({ page }) => {
    await openSession(page, width, height);
    await press(page, 'Git review');
    await expect(page.getByRole('button', { name: /Approve read-only Git|Refresh changes/ }).first()).toBeVisible();
    await everyPalette(page, `${width} Git review (consent)`);
    await approve(page, /Approve read-only Git/);
    await expect(page.locator('.git-review-layout')).toBeVisible();
    await everyPalette(page, `${width} Git review (changes)`);
    await page.keyboard.press('Escape');
    await press(page, /Open developer workspace|^Workspace$/);
    await approve(page, /Approve workspace reading/);
    await expect(page.locator('.developer-workspace')).toBeVisible();
    await everyPalette(page, `${width} Workspace`);
  });
}
test('Git graph keeps metadata at 11 px and controls at 12 px on every palette', async ({ page }) => {
  await openSession(page, 1440, 900);
  await press(page, 'Git graph');
  await expect(page.getByRole('button', { name: /Approve read-only Git|Commits ·/ }).first()).toBeVisible();
  await approve(page, /Approve read-only Git/);
  const rows = page.getByRole('button', { name: /Commits ·/ }); await expect(rows).toBeVisible();
  if (await rows.getAttribute('aria-expanded') !== 'true') await rows.click();
  await page.locator('.commit-row').first().click();
  await everyPalette(page, 'Git graph');
});
