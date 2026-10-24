import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-session-type-')); app = new App(dir); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-2: metadata reaches 11 px and controls 12 px on the Modern session surface. The turn ledger's fold line is quiet
// mono metadata that happens to be the fold control, so it keeps 11 px; SVG icon glyphs are not text.
const EXEMPT = '.turn-fold, svg *';
// The rules this slice raised: their text must also keep 4.5:1 on the composited background in every palette.
const RAISED = ['.captured-time', '.prompt-rail-preview time', '.verification-basis', '.material-context', '.case-peek', '.structured-output-controls', '.result-original summary', '.op-expand', '.terminal-fold', '.captured-range', '.prose-label', '.crown-actions .btn', '.sample-watch'].join(',');

test('the Modern session surface keeps metadata at 11 px, controls at 12 px and the raised text at 4.5:1 on every palette', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL('/?demo&experience=modern&motion=0', server.launchUrl).href);
  const history = page.locator('.history'); await expect(history).toBeVisible();
  // Keyboard, not a pointer: a resting pointer can start hover reading and move the card.
  for (const expand of await page.locator('button.op-expand').all()) await expand.press('Enter').catch(() => {});
  await page.getByRole('navigation', { name: 'Prompt positions in history' }).getByRole('button').first().hover();
  for (const palette of ['jet', 'paper', 'midnight', 'mocha', 'tokyo', 'nord', 'gruvbox']) {
    await page.evaluate(value => { document.documentElement.dataset.palette = value; }, palette);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))));
    const failures = await page.evaluate(({ exempt, raised }) => {
      const result: string[] = [];
      const rgba = (value: string) => { const c = document.createElement('canvas').getContext('2d')!; c.clearRect(0, 0, 1, 1); c.fillStyle = value; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); };
      const over = (front: number[], back: number[]) => front.slice(0, 3).map((v, i) => v * front[3]! + back[i]! * (1 - front[3]!)).concat(1);
      const luma = (rgb: number[]) => rgb.slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i]!, 0);
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        if (!el.getClientRects().length || !el.checkVisibility() || el.closest('[aria-hidden=true]') || el.matches(exempt) || el.matches('option,:disabled')) continue;
        const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim());
        if (!own) continue;
        const style = getComputedStyle(el), label = `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} "${el.textContent?.trim().slice(0, 28)}"`;
        const floor = el.matches('button, summary, select, input, textarea') ? 12 : 11;
        if (parseFloat(style.fontSize) < floor) result.push(`${label}: ${style.fontSize} < ${floor}px`);
        if (el.matches(raised)) {
          const parents: Element[] = []; for (let p: Element | null = el; p; p = p.parentElement) parents.unshift(p);
          let background = [255, 255, 255, 1]; for (const p of parents) background = over(rgba(getComputedStyle(p).backgroundColor), background);
          const a = luma(over(rgba(style.color), background)), b = luma(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
          if (ratio < 4.5) result.push(`${label}: contrast ${ratio.toFixed(2)}`);
        }
      }
      return result;
    }, { exempt: EXEMPT, raised: RAISED });
    expect(failures, palette).toEqual([]);
  }
});
