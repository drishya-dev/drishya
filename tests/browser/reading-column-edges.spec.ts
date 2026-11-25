// Yash, 13 Nov: the reading column starts after the Files panel (or its chips, when minimised) and ends before the
// Toolbox, with the same gap at both ends, at every zoom (1152 is a 1440 screen at 125 %).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, app: App, server: RunningServer, id: string, readerId: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-reading-column-'));
  app = new App(dir);
  id = (await app.ingest.importSource('claude-code', resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
  // UI-45: a session whose Read row has several cards and ends on a prompt, over a real folder so Files can open a reader.
  const root = join(dir, 'repo'); mkdirSync(root);
  const names = ['main.ts', 'a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
  for (const n of names) writeFileSync(join(root, n), `export const ${n.split('.')[0]} = 1;\n`.repeat(40));
  const common = { cwd: root, sessionId: 'ui45', timestamp: '2026-11-13T10:00:00Z' };
  const rows = [
    { type: 'user', uuid: 'u0', message: { role: 'user', content: 'Read all of these files and tell me what they hold' } },
    { type: 'assistant', uuid: 'reads', message: { role: 'assistant', content: names.map((n, i) => ({ type: 'tool_use', id: `r${i}`, name: 'Read', input: { file_path: join(root, n) } })) } },
    { type: 'user', uuid: 'res', message: { role: 'user', content: names.map((n, i) => ({ type: 'tool_result', tool_use_id: `r${i}`, content: `export const ${n} = 1;\n`.repeat(30) })) } },
    { type: 'assistant', uuid: 'reply', message: { role: 'assistant', content: [{ type: 'text', text: 'Each file holds one constant, repeated.' }] } },
    { type: 'user', uuid: 'u1', message: { role: 'user', content: 'check that this is enough and all of them are really needed please' } },
  ].map(r => JSON.stringify({ ...common, ...r }));
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, rows.join('\n') + '\n');
  readerId = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

const gaps = (page: Page) => page.evaluate(() => {
  const vis = (s: string) => [...document.querySelectorAll<HTMLElement>(s)].filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect());
  const column = document.querySelector<HTMLElement>('.history-inner')!, r = column.getBoundingClientRect(), c = getComputedStyle(column);
  const left = Math.max(...vis('.workspace-leading > *, .folder-explorer').map(x => x.right));
  const right = Math.min(...vis('.modern-toolbox, .complete-prompt-rail, .history-prompt-marks').map(x => x.left));
  return { left: r.left + parseFloat(c.paddingLeft) - left, right: right - (r.right - parseFloat(c.paddingRight)) };
});

for (const width of [1152, 1440, 2000]) {
  test(`the column sits between the side chrome with equal gaps, Files open and minimised, at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.fulfill({ json: { saved: true, revisions: {} } }));
    await page.goto(server.launchUrl);
    await expect(page.locator('.mh-home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern#/r/${id}`);
    await expect(page.locator('.history article.op').first()).toBeVisible();
    await expect.poll(async () => (await gaps(page)).left).toBeGreaterThanOrEqual(23);
    const open = await gaps(page);
    expect(Math.abs(open.left - open.right), `Files open: ${JSON.stringify(open)}`).toBeLessThanOrEqual(2);
    await page.locator('.folder-explorer header button').first().click();
    await expect.poll(async () => { const g = await gaps(page); return Math.abs(g.left - g.right) <= 2 && g.left >= 23; }).toBe(true);
  });
}

// UI-42 (Yash, 13 Nov): the passages use the whole width between the panels. The column's 1280 px cap is gone, rows of
// cards wrap across all of it, prose keeps its 75ch measure on the left edge, and no card sits under a side panel.
for (const width of [1440, 2000, 2560]) {
  test(`passages span the width between the panels; prose keeps its measure; no card under a side panel at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.fulfill({ json: { saved: true, revisions: {} } }));
    await page.goto(server.launchUrl);
    await expect(page.locator('.mh-home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.locator('.history article.op').first()).toBeVisible();
    await expect.poll(async () => (await gaps(page)).left).toBeGreaterThanOrEqual(23);
    const m = await page.evaluate(() => {
      const vis = (s: string) => [...document.querySelectorAll<HTMLElement>(s)].filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect());
      const column = document.querySelector<HTMLElement>('.history-inner')!, r = column.getBoundingClientRect(), c = getComputedStyle(column);
      const side = vis('.workspace-leading > *, .folder-explorer, .modern-toolbox, .complete-prompt-rail, .history-prompt-marks');
      const content = { left: r.left + parseFloat(c.paddingLeft), right: r.right - parseFloat(c.paddingRight) };
      const prose = vis('.history .prose p');
      // The indent is measured on prose that sits directly in a reading column with the standard 6 px inset: a paragraph of a list item, or of a prose block that carries its own larger inset, is a different case.
      const topLevel = [...document.querySelectorAll<HTMLElement>('.history .prose > p')].filter(p => getComputedStyle(p.parentElement!).paddingLeft === '6px' && p.getBoundingClientRect().width > 0).map(p => p.getBoundingClientRect());
      return {
        maxWidth: c.maxWidth, width: content.right - content.left,
        space: Math.min(...vis('.modern-toolbox, .complete-prompt-rail, .history-prompt-marks').map(x => x.left)) - Math.max(...vis('.workspace-leading > *, .folder-explorer').map(x => x.right)) - 48,
        under: vis('.history article.op').filter(o => side.some(k => o.right > k.left + 1 && o.left < k.right - 1 && o.bottom > k.top + 1 && o.top < k.bottom - 1)).length,
        proseMax: Math.max(0, ...prose.map(p => p.width)), proseLeft: topLevel[0] ? topLevel[0].left - content.left : 0,
      };
    });
    expect(m.maxWidth, 'the 1280 px cap is lifted once the column is placed').toBe('none');
    expect(Math.abs(m.width - m.space), `the column fills the space between the panels: ${JSON.stringify(m)}`).toBeLessThanOrEqual(2);
    expect(m.under, 'no card under a side panel').toBe(0);
    expect(m.proseMax, 'prose keeps its reading measure').toBeLessThanOrEqual(75 * 11);
    expect(m.proseLeft, `prose starts at the column edge (its own 6 px indent), not centred: ${JSON.stringify(m)}`).toBeLessThanOrEqual(8);
    if (width >= 2000) expect(m.width, 'wide windows use more than the old cap').toBeGreaterThan(1280);
  });
}

// UI-45 (Yash, 13 Nov: "some glitch here after zooming out and the file explorer where some box gets cutoff"): the file
// reader docks over History's right side and History gives up that width. The column must end before the reader, so no
// card, prose line or prompt bubble sits under it, at every window width and browser zoom (a zoom of z is a viewport of
// width / z CSS px at a device ratio of z), with Files open or minimised, and it must come back when the reader closes.
const sideSurfaces = '.file-peek-reader[open], .modern-toolbox, .folder-explorer, .workspace-leading > *, .complete-prompt-rail, .history-prompt-marks';
const underSurface = (page: Page) => page.evaluate((surfaces) => {
  const vis = (s: string) => [...document.querySelectorAll<HTMLElement>(s)].filter(e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0);
  const panels = vis(surfaces).map(e => ({ name: e.className.toString().split(' ')[0] || e.tagName, r: e.getBoundingClientRect() }));
  const content = vis('.history article.op, .history .prose, .history .turn-capsule').map(e => ({ name: e.className.toString().split(' ').slice(0, 2).join('.'), r: e.getBoundingClientRect() }));
  const hits: string[] = [];
  for (const c of content) {
    // Only what is inside the window can be seen; History scrolls, so a row above or below the screen is not under anything.
    if (c.r.bottom < 0 || c.r.top > innerHeight) continue;
    for (const s of panels) if (c.r.right > s.r.left + 1 && c.r.left < s.r.right - 1 && c.r.bottom > s.r.top + 1 && c.r.top < s.r.bottom - 1) hits.push(`${c.name} ${Math.round(c.r.left)}-${Math.round(c.r.right)} under ${s.name} ${Math.round(s.r.left)}-${Math.round(s.r.right)}`);
  }
  return { hits: [...new Set(hits)], cards: content.filter(c => c.name.startsWith('op')).length, bubbles: content.filter(c => c.name.startsWith('turn-capsule')).length };
}, sideSurfaces);

const zooms: Array<[string, number, number]> = [['1152 CSS px', 1152, 1], ['1440 CSS px', 1440, 1], ['2000 CSS px', 2000, 1], ['125 % of a 1440 screen', 1152, 1.25], ['80 % of a 1440 screen', 1800, 0.8], ['67 % of a 1440 screen', 2149, 0.67]];
for (const [label, width, ratio] of zooms) {
  test.describe(`file reader at ${label}`, () => {
    test.use({ deviceScaleFactor: ratio });
    for (const filesOpen of [true, false]) {
      test(`no card, prose or prompt sits under the reader, Files ${filesOpen ? 'open' : 'minimised'}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.route('**/controller', route => route.fulfill({ json: { harness: 'claude-code', available: false, state: 'idle', output: '', tools: [], approvals: [] } }));
        await page.goto(server.launchUrl);
        await expect(page.locator('.home, .mh-home').first()).toBeVisible();
        await page.goto(`${server.url}/?experience=modern&motion=0#/r/${readerId}`);
        await expect(page.locator('.history article.op').first()).toBeVisible();
        const grant = page.getByRole('button', { name: /^Enable workspace reading/ });
        await expect(grant.or(page.locator('.folder-explorer[data-reading-access=current]'))).toBeVisible();
        if (await grant.isVisible()) await grant.click();
        await page.locator('[data-spine-path="main.ts"]').click();
        await expect(page.locator('.file-peek-reader[open]')).toBeVisible();
        if (!filesOpen) {
          await page.locator('.folder-explorer header button').first().click();
          await expect(page.locator('.folder-explorer')).toHaveCount(0);
        }
        await expect.poll(async () => (await underSurface(page)).hits, { message: 'nothing in History under a side panel while the reader is open' }).toEqual([]);
        const open = await underSurface(page);
        expect(open.cards, 'the row of cards is on screen to be checked').toBeGreaterThan(1);
        await expect.poll(async () => page.evaluate(() => {
          const col = document.querySelector('.history-inner')!.getBoundingClientRect(), hist = document.querySelector('.history')!.getBoundingClientRect();
          return col.right <= hist.right + 0.5;
        }), { message: 'the column ends where History does, beside the reader' }).toBe(true);

        // Closing the reader gives the width back: the column spans to the Toolbox again with the equal gaps of #461.
        await page.keyboard.press('Escape');
        await expect(page.locator('.file-peek-reader[open]')).toHaveCount(0);
        if (filesOpen) await expect.poll(async () => { const g = await gaps(page); return g.left >= 23 && Math.abs(g.left - g.right) <= 2; }, { message: 'equal gaps after the reader closes' }).toBe(true);
        expect((await underSurface(page)).hits, 'nothing under a panel after the reader closes').toEqual([]);
      });
    }
  });
}

// UI-45, narrow windows (Yash, 13 Nov: prose "cut at the edge" of Files in a half-width window). Up to 820 px Files is a
// drawer over History. Where a readable column (360 px) still fits beside it, the column moves over and reflows; where it
// does not, History behind the drawer is dimmed to a ghost so no half-cut words show. 1920 px at 125 % and 150 % are
// 768 and 640 CSS px.
const narrowCases: Array<[string, number, number, 'docked' | 'covered']> = [['600 px', 600, 1, 'covered'], ['640 px (150 %)', 640, 1.5, 'covered'], ['700 px', 700, 1, 'covered'], ['768 px (125 %)', 768, 1.25, 'docked'], ['820 px', 820, 1, 'docked']];
for (const [label, width, ratio, expected] of narrowCases) {
  test.describe(`Files drawer at ${label}`, () => {
    test.use({ deviceScaleFactor: ratio });
    test(`the column is ${expected === 'docked' ? 'beside the drawer' : 'dimmed behind the drawer'}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.route('**/controller', route => route.fulfill({ json: { harness: 'claude-code', available: false, state: 'idle', output: '', tools: [], approvals: [] } }));
      await page.goto(server.launchUrl);
      await expect(page.locator('.home, .mh-home').first()).toBeVisible();
      await page.goto(`${server.url}/?experience=modern&motion=0#/r/${readerId}`);
      await expect(page.locator('.history article.op').first()).toBeVisible();
      if (await page.locator('.file-peek-reader[open]').count()) await page.keyboard.press('Escape');
      await page.locator('[data-workspace-files-trigger]').click();
      await expect(page.locator('.folder-explorer')).toBeVisible();
      await expect(page.locator('.connected-workspace')).toHaveAttribute('data-side-fit', expected);
      const m = await page.evaluate(() => {
        const drawer = document.querySelector('.folder-explorer')!.getBoundingClientRect();
        const column = document.querySelector('.history-inner')!.getBoundingClientRect(), pad = parseFloat(getComputedStyle(document.querySelector('.history-inner')!).paddingLeft);
        const prose = [...document.querySelectorAll<HTMLElement>('.history .prose p')].map(p => p.getBoundingClientRect()).filter(r => r.width > 0);
        return { opacity: parseFloat(getComputedStyle(document.querySelector('.history')!).opacity), drawerRight: drawer.right, columnLeft: column.left + pad, columnWidth: column.width - 2 * pad, proseLeft: Math.min(...prose.map(r => r.left)) };
      });
      if (expected === 'docked') {
        expect(m.opacity, 'History stays at full strength').toBe(1);
        expect(m.proseLeft, `prose starts after the drawer: ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(m.drawerRight + 20);
        expect(m.columnWidth, 'a readable column is left').toBeGreaterThanOrEqual(360);
      } else {
        expect(m.opacity, `History is a ghost behind the drawer, so no half-cut words read: ${JSON.stringify(m)}`).toBeLessThanOrEqual(0.15);
      }
      // Minimising the drawer gives the column back at full strength.
      await page.locator('.folder-explorer header button').first().click();
      await expect(page.locator('.folder-explorer')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.history')!).opacity))).toBe(1);
      await expect(page.locator('.connected-workspace')).not.toHaveAttribute('data-side-fit', /.+/);
    });
  });
}

// UI-45, placement is immediate: toggling a panel moves the column in the same frame the panel's size is final, never on
// the next scroll. Frames are sampled from the click on, without scrolling.
const probeSource = `() => {
  const vis = (s) => [...document.querySelectorAll(s)].filter(e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0);
  const panels = vis('.file-peek-reader[open], .modern-toolbox, .folder-explorer, .workspace-leading > *, .complete-prompt-rail, .history-prompt-marks').map(e => e.getBoundingClientRect());
  const content = vis('.history article.op, .history .prose, .history .turn-capsule').map(e => e.getBoundingClientRect());
  let hits = 0;
  for (const c of content) { if (c.bottom < 0 || c.top > innerHeight) continue; for (const s of panels) if (c.right > s.left + 1 && c.left < s.right - 1 && c.bottom > s.top + 1 && c.top < s.bottom - 1) hits++; }
  const col = document.querySelector('.history-inner').getBoundingClientRect(), pad = parseFloat(getComputedStyle(document.querySelector('.history-inner')).paddingLeft);
  return { hits, signature: panels.map(r => Math.round(r.left) + ':' + Math.round(r.right)).join('|') + '/' + Math.round(col.left) + ':' + Math.round(col.right) };
}`;
const sampleFrames = async (page: Page, act: () => Promise<unknown>, frames = 48) => {
  await page.evaluate((source) => { (window as unknown as { __probe: () => unknown }).__probe = new Function(`return (${source})`)(); }, probeSource);
  const pending = page.evaluate((count) => new Promise<Array<{ hits: number; signature: string }>>((resolve) => {
    const out: Array<{ hits: number; signature: string }> = [];
    const step = () => { out.push((window as unknown as { __probe: () => { hits: number; signature: string } }).__probe()); if (out.length < count) requestAnimationFrame(step); else resolve(out); };
    requestAnimationFrame(step);
  }), frames);
  await act();
  return pending;
};
/**
 * Frames from the first one whose panel and column rectangles never change again, plus three: the cards re-flow in the
 * passage layout's own resize pass, one to three frames (about 50 ms) after the column moved, so nothing may sit under a
 * panel from the fourth frame on. It never waits for a scroll.
 */
const afterSettled = (samples: Array<{ hits: number; signature: string }>) => {
  let settled = samples.length - 1;
  while (settled > 0 && samples[settled - 1]!.signature === samples[settled]!.signature) settled--;
  return { settled, late: samples.slice(settled + 4), all: samples };
};

test('toggling Files and the file reader places the column at once, without a scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/controller', route => route.fulfill({ json: { harness: 'claude-code', available: false, state: 'idle', output: '', tools: [], approvals: [] } }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.home, .mh-home').first()).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${readerId}`);
  await expect(page.locator('.history article.op').first()).toBeVisible();
  const grant = page.getByRole('button', { name: /^Enable workspace reading/ });
  await expect(grant.or(page.locator('.folder-explorer[data-reading-access=current]'))).toBeVisible();
  if (await grant.isVisible()) await grant.click();
  await expect.poll(async () => (await gaps(page)).left).toBeGreaterThanOrEqual(23);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['Files minimised', () => page.locator('.folder-explorer header button').first().click()],
    ['Files opened again', () => page.locator('[data-workspace-files-trigger]').click()],
    ['file reader opened', () => page.locator('[data-spine-path="main.ts"]').click()],
    ['file reader closed', () => page.keyboard.press('Escape')],
  ];
  for (const [name, act] of steps) {
    const { settled, late, all } = afterSettled(await sampleFrames(page, act));
    expect(settled, `${name}: the layout settles within the sampled frames`).toBeLessThan(all.length - 3);
    expect(late.filter(frame => frame.hits > 0).length, `${name}: nothing under a panel once the layout is final (settled at frame ${settled} of ${all.length}; frames with a hit: ${all.map((frame, i) => frame.hits ? i : -1).filter(i => i >= 0).join(",")})`).toBe(0);
    await expect.poll(async () => (await underSurface(page)).hits, { message: `${name}: still clear a moment later` }).toEqual([]);
  }
  await expect.poll(async () => { const g = await gaps(page); return g.left >= 23 && Math.abs(g.left - g.right) <= 2; }, { message: 'equal gaps again with the reader closed' }).toBe(true);
});

// Up to 820 px the file reader is a bottom sheet over History, by design: it is opaque, so nothing of History shows
// half-cut through it, and it stays inside the window with the Files drawer closed behind it.
test('the narrow file reader is an opaque sheet inside the window', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.route('**/controller', route => route.fulfill({ json: { harness: 'claude-code', available: false, state: 'idle', output: '', tools: [], approvals: [] } }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.home, .mh-home').first()).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${readerId}`);
  await expect(page.locator('.history article.op').first()).toBeVisible();
  if (!await page.locator('.file-peek-reader[open]').count()) {
    await page.locator('[data-workspace-files-trigger]').click();
    const grant = page.getByRole('button', { name: /^Enable workspace reading/ });
    await expect(grant.or(page.locator('.folder-explorer[data-reading-access=current]'))).toBeVisible();
    if (await grant.isVisible()) await grant.click();
    await page.locator('[data-spine-path="main.ts"]').click();
  }
  const sheet = page.locator('.file-peek-reader[open]');
  await expect(sheet).toBeVisible();
  const m = await sheet.evaluate(el => { const b = el.getBoundingClientRect(), c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number); return { left: b.left, right: b.right, alpha: c.length > 3 ? c[3]! : 1, width: innerWidth }; });
  expect(m.alpha, 'the sheet is opaque').toBe(1);
  expect(m.left).toBeGreaterThanOrEqual(0);
  expect(m.right).toBeLessThanOrEqual(m.width);
});
