import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// UI-7: no visible text on the demo session (cards expanded: code, diff, test, search, shell) falls below 4.5:1 on any of the seven palettes.
let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-palette-contrast-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-palette-contrast' }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir && resolve(dir).startsWith(resolve(tmpdir()) + sep)) rmSync(dir, { recursive: true, force: true }); });

async function measure(page: Page) {
  return page.evaluate(() => {
    const rgba = (value: string) => { const c = document.createElement('canvas').getContext('2d')!; c.clearRect(0, 0, 1, 1); c.fillStyle = value; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); };
    const over = (f: number[], b: number[]) => f.slice(0, 3).map((v, i) => v * f[3]! + b[i]! * (1 - f[3]!)).concat(1);
    const luma = (rgb: number[]) => rgb.slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i]!, 0);
    const out = new Map<string, { ratio: number; n: number; sample: string; size: number }>();
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!el.getClientRects().length || !el.checkVisibility() || el.closest('[aria-hidden=true]') || el.matches('svg *,option,:disabled')) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim())) continue;
      const style = getComputedStyle(el); if (parseFloat(style.opacity) < .05) continue;
      const parents: Element[] = []; for (let p: Element | null = el; p; p = p.parentElement) parents.unshift(p);
      let bg = [255, 255, 255, 1]; for (const p of parents) bg = over(rgba(getComputedStyle(p).backgroundColor), bg);
      const fg = over(rgba(style.color), bg), a = luma(fg), b = luma(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const key = `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}`;
      const prev = out.get(key);
      if (!prev || ratio < prev.ratio) out.set(key, { ratio, n: (prev?.n ?? 0) + 1, sample: (el.textContent ?? '').trim().slice(0, 24), size: parseFloat(style.fontSize) }); else prev.n++;
    }
    return [...out].filter(([, v]) => v.ratio < 4.5).sort((x, y) => x[1].ratio - y[1].ratio).slice(0, 8).map(([k, v]) => `${v.ratio.toFixed(2)} ${v.size}px ${k} ×${v.n} "${v.sample}"`);
  });
}

test('visible text keeps 4.5:1 on every palette on the expanded demo session', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server.url}/?demo&experience=modern&motion=0#token=${server.token}`);
  await expect(page.locator('.viewer')).toBeVisible();
  for (const card of await page.locator('article.op').all().then(a => a.slice(0, 6))) { await card.focus().catch(() => undefined); await page.keyboard.press('Enter').catch(() => undefined); }
  // Expanded cards show captured source: line numbers prove the guard is looking at real material.
  await expect(page.locator('.ln-no').first()).toBeVisible();
  for (const palette of ['jet', 'paper', 'midnight', 'mocha', 'tokyo', 'nord', 'gruvbox']) {
    await page.evaluate(v => { document.documentElement.dataset.palette = v; }, palette);
    await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))), new Promise(d => setTimeout(d, 1500))]));
    expect(await measure(page), palette).toEqual([]);
  }
});
