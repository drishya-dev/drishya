import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
// A fresh app per test: grants, saved reading locations and layout state persist on the server.
test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-home-floor-')); app = new App(join(dir, 'store'));
  const timestamp = '2026-10-17T00:00:00Z';
  for (const name of ['first', 'second', 'third']) {
    const path = join(dir, `${name}.jsonl`), text = (i: number) => name === 'third' && i === 0 ? `FAIL src/a.ts:12 sharedneedle ${name}` : `FINDME_${name}_${i} sharedneedle captured evidence`;
    writeFileSync(path, [{ type: 'session_meta', timestamp, payload: { id: name, cwd: join(dir, name) } }, ...Array.from({ length: name === 'first' ? 60 : 4 }, (_, i) => ({ type: 'response_item', timestamp, payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: text(i) }] } }))].map(r => JSON.stringify(r)).join('\n') + '\n');
    await app.ingest.importSource('codex', path);
  }
  server = await startServer({ app, port: 0, token: 'synthetic-home-floor' });
});
test.afterEach(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-2 Home slice: metadata 11 px and controls 12 px on Home and the Search evidence dialog. Home itself already met the
// floor after #145; this guard keeps it there in every state, and covers the dialog this slice raised.
const EXEMPT = '.turn-fold, svg *';
// Rules this slice raised: their text must also keep 4.5:1 on the composited background on every palette.
const RAISED = '.library-search-filters input, .library-search-filters select, .library-search-results > button > small';

async function failures(page: Page) {
  return page.evaluate(({ exempt, raised }) => {
    const result: string[] = [];
    const rgba = (value: string) => { const c = document.createElement('canvas').getContext('2d')!; c.clearRect(0, 0, 1, 1); c.fillStyle = value; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); };
    const over = (front: number[], back: number[]) => front.slice(0, 3).map((v, i) => v * front[3]! + back[i]! * (1 - front[3]!)).concat(1);
    const luma = (rgb: number[]) => rgb.slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i]!, 0);
    let seen = 0;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!el.getClientRects().length || !el.checkVisibility() || el.closest('[aria-hidden=true]') || el.matches(exempt) || el.matches('option,:disabled')) continue;
      const control = el.matches('button, summary, select, input, textarea');
      // A select and a date input show their value without a text node of their own.
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()) || (control && (!!(el as HTMLInputElement).placeholder || el.matches('select, input[type=date]')));
      if (!own) continue;
      seen++;
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
    // A scan that read nothing would pass vacuously.
    if (!seen) result.push('no text scanned');
    return result;
  }, { exempt: EXEMPT, raised: RAISED });
}
async function everyPalette(page: Page, state: string) {
  for (const palette of ['jet', 'paper', 'midnight', 'mocha', 'tokyo', 'nord', 'gruvbox']) {
    await page.evaluate(value => { document.documentElement.dataset.palette = value; }, palette);
    // Colour transitions must settle before measuring, but a looping or paused animation never finishes: bound the wait.
    await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))), new Promise(done => setTimeout(done, 1500))]));
    expect(await failures(page), `${state} / ${palette}`).toEqual([]);
  }
}
const sizes = [[1440, 900], [900, 800], [390, 844], [320, 700]] as const;
const states = ['following', 'idle', 'importing', 'missing-source', 'unsupported', 'failed', 'stopped'] as const;
async function mockHome(page: Page, count: number, discovered = true) {
  const today = new Date().toISOString(), old = new Date(Date.now() - 9 * 864e5).toISOString();
  const recordings = Array.from({ length: count }, (_, i) => ({ id: `r-${i}`, title: `Session ${i}: long project name ${'review '.repeat(i % 5 * 6)}`, harness: i % 2 ? 'codex' : 'claude-code', workspaceRoot: i % 3 ? 'C:/projects/workspace-with-a-very-long-name' : 'C:/projects/研究-project', createdAt: today, updatedAt: today, lastSourceTime: i % 4 ? today : old, observationCount: 2490, live: false, pinned: false, sourceBytes: 100, privacyOutdated: i === 3, health: i < 20 ? { state: states[i % states.length], live: false, backlog: i % 5 === 0, sources: [] } : undefined }));
  const sources = discovered ? [
    { adapterId: 'a', harness: 'codex', path: 'C:/x/new.jsonl', bytes: 5, modifiedAt: today, cwd: 'C:/projects/discovered', title: 'Discovered, not imported yet', companions: [] },
    { adapterId: 'a', harness: 'claude-code', path: 'C:/x/r0.jsonl', bytes: 9999, modifiedAt: today, cwd: 'C:/projects/updated', title: 'Journal grew since import', importedRecordingId: 'r-0', companions: [] },
  ] : [];
  await page.route('**/v1/recordings', route => route.fulfill({ json: { recordings } }));
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources, errors: [] } }));
}
async function home(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(`${server.url}/?experience=modern&motion=0#token=${server.token}`);
}

test('Home with many sessions keeps the floor in every filter, disclosure and list state on every palette', async ({ page }) => {
  test.setTimeout(240_000);
  await mockHome(page, 120);
  for (const [width, height] of sizes) {
    const at = (state: string) => `${width} ${state}`;
    await home(page, width, height); await expect(page.locator('.mh-session').first()).toBeVisible();
    // Row tags (live, importing, journal missing, read failed, older privacy policy), "Journal updated" and the event counts.
    await expect(page.locator('.mh-session .tag.warn').first()).toBeVisible(); await expect(page.locator('.mh-session em').first()).toBeVisible();
    await everyPalette(page, at('list'));
    await expect(page.locator('.mh-load')).toBeVisible();
    if (width > 650) await expect(page.locator('.mh-active')).toBeVisible();
    const about = page.locator('.mh-about'); await about.focus(); await page.keyboard.press('Enter');
    await everyPalette(page, at('About toggled')); await page.keyboard.press('Enter');
    const find = page.getByLabel('Find sessions'); await find.fill('Session 1'); await expect(page.getByRole('button', { name: 'Clear session search' })).toBeVisible();
    await everyPalette(page, at('find box'));
    await find.fill('zzzz-no-match'); await expect(page.locator('.mh-empty')).toBeVisible(); await everyPalette(page, at('no match'));
    await find.fill('');
    const harness = page.getByLabel('Harness'); await harness.selectOption('codex'); await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible(); await everyPalette(page, at('harness filter'));
    await harness.selectOption('all');
    if (width <= 650) {
      // Open the phone workspace menu with the keyboard: a resting pointer would add hover styling.
      const trigger = page.getByLabel('Choose workspace'); await trigger.focus(); await page.keyboard.press('Enter');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true'); await everyPalette(page, at('workspace menu')); await page.keyboard.press('Escape');
    }
    // The shown count and list position are remembered per workspace, so the end of the list is reached last.
    if (width === 320) {
      await page.locator('.mh-session-list').focus(); await page.keyboard.press('End');
      await expect(page.locator('[data-session-index="120"] .mh-session-open')).toBeFocused(); await everyPalette(page, at('end of list'));
    }
  }
});
test('Home first-run, error and footer states keep the floor on every palette', async ({ page }) => {
  await mockHome(page, 0, false);
  for (const [width, height] of sizes) {
    await home(page, width, height); await expect(page.locator('.mh-empty')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Star on GitHub' })).toBeVisible();
    await everyPalette(page, `${width} first-run`);
  }
  // A failed refresh shows the error line with its Retry control above the list.
  await page.unroute('**/v1/recordings'); await page.unroute('**/v1/sources');
  await page.route('**/v1/recordings', route => route.fulfill({ status: 500, json: { error: 'boom' } }));
  await page.route('**/v1/sources', route => route.fulfill({ status: 500, json: { error: 'boom' } }));
  await home(page, 390, 844); await expect(page.getByRole('button', { name: /Retry|Open local workspace/ }).first()).toBeVisible();
  await everyPalette(page, 'load error');
});
test('Home with a resume card keeps the floor on desktop and phone', async ({ page }) => {
  await home(page, 1440, 900); await page.locator('.mh-session-open').first().click(); await expect(page.locator('.workspace-header')).toBeVisible();
  // Reading locations save after a short debounce; the card appears once they have.
  await expect.poll(async () => { await home(page, 1440, 900); await expect(page.locator('.mh-session').first()).toBeVisible(); return page.locator('.mh-resume').count(); }, { timeout: 15_000 }).toBe(1);
  await everyPalette(page, '1440 resume');
  await home(page, 390, 844); await expect(page.locator('.mh-resume')).toBeVisible(); await everyPalette(page, '390 resume');
});
for (const [width, height] of sizes) {
  test(`Search evidence dialog keeps metadata at 11 px, controls at 12 px and the raised text at 4.5:1 at ${width}px`, async ({ page }) => {
    await home(page, width, height); await expect(page.locator('.home')).toBeVisible();
    const open = page.getByRole('button', { name: 'Search evidence', exact: true }); await open.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Search session evidence' }); await expect(dialog).toBeVisible();
    await everyPalette(page, `${width} search (empty)`);
    // Filters are a disclosure; open it with the keyboard so no pointer rests on the dialog.
    await dialog.locator('summary').focus(); await page.keyboard.press('Enter'); await expect(dialog.getByLabel('Exact workspace path')).toBeVisible();
    await everyPalette(page, `${width} search (filters)`);
    await dialog.getByRole('searchbox').fill('sharedneedle');
    await expect(dialog.locator('.library-search-results > button > small').first()).toBeVisible();
    await expect(dialog.locator('.library-search-results > button.md-path').first()).toBeVisible();
    await everyPalette(page, `${width} search (results)`);
    await dialog.getByRole('button', { name: 'Next results' }).focus(); await page.keyboard.press('Enter');
    await expect(dialog.getByRole('button', { name: 'First page' })).toBeEnabled(); await everyPalette(page, `${width} search (next page)`);
    await dialog.getByRole('searchbox').fill('qqqq-nothing-matches'); await expect(dialog.getByText('No indexed evidence matched these filters.')).toBeVisible();
    await everyPalette(page, `${width} search (no results)`);
    await page.route('**/v1/search-library?**', route => route.fulfill({ status: 500, json: { error: 'search is down' } }));
    await dialog.getByRole('searchbox').fill('sharedneedle again'); await expect(dialog.getByRole('alert')).toBeVisible();
    await everyPalette(page, `${width} search (error)`);
  });
}
