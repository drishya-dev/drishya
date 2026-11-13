// UI-39: Jet Black speaks the website's language. Part 1: its ink is the site's cream family. Part 4: small labels and
// counts use the mono face, and changing the face moves no panel, card or row.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-jet-language-'));
  app = new App(dir);
  id = (await app.ingest.importSource('claude-code', resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

const palette = (page: Page, name: 'jet' | 'midnight' | 'paper') => page.evaluate(value => {
  document.documentElement.dataset.palette = value; document.documentElement.dataset.theme = value === 'paper' ? 'light' : 'dark';
}, name);
// The build shortens #000000 to #000, so every token is read back as six digits.
const tokens = (page: Page) => page.evaluate(() => Object.fromEntries(['--bg', '--s1', '--s2', '--s3', '--t1', '--t2', '--t3', '--t4', '--brand-ink'].map(name => { const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim().toLowerCase(); return [name, /^#[0-9a-f]{3}$/.test(value) ? `#${[...value.slice(1)].map(c => c + c).join('')}` : value]; })));
const luminance = (hex: string) => { const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };
// Red minus blue: above zero is warm, below is cool.
const warmth = (hex: string) => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);

const sectionLabels = ['.home .mh-time-group h3', '.home .mh-workspaces>header'];
const homeLabels = ['.home .mh-ov-totals dt', '.home .mh-results>header>div>span'];
const sessionLabels = ['.modern-toolbox .tool-group-name', '.modern-toolbox .md-tool-list>.instrument small', '.connected-workspace .history .op-kind'];
const face = (page: Page, selector: string) => page.locator(selector).first().evaluate(el => {
  const probe = document.createElement('span'); probe.style.fontFamily = 'var(--mono)'; document.body.append(probe);
  const mono = getComputedStyle(probe).fontFamily; probe.remove();
  const style = getComputedStyle(el);
  return { mono: style.fontFamily === mono, size: style.fontSize, tracking: parseFloat(style.letterSpacing) / parseFloat(style.fontSize), upper: style.textTransform === 'uppercase' };
});
// Every panel, card and row a label sits in. The labels' own text boxes are not in this list: their width is the face.
const blocks = ['.mh-header', '.mh-opening', '.mh-sheet', '.mh-overview', '.mh-ov-activity', '.mh-library', '.mh-filters', '.mh-workspaces', '.mh-workspace', '.mh-results', '.mh-time-group', '.mh-session', '.mh-footer',
  '.modern-identity', '.studio-actions', '.folder-explorer', '.modern-toolbox', '.md-tool-list>.instrument', '.tool-group', '.tool-row', '.history article.op', '.history .op-head', '.history .prose', '.prompt-composer'];
const rects = (page: Page) => page.evaluate(list => list.flatMap(selector => [...document.querySelectorAll(selector)].map((el, at) => { const r = el.getBoundingClientRect(); return `${selector}[${at}] ${r.x.toFixed(1)},${r.y.toFixed(1)} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`; })), blocks);
// The same labels in the sans face they had before, for comparison.
const unface = (page: Page) => page.addStyleTag({ content: `${[...sectionLabels, ...homeLabels, ...sessionLabels, '.home .mh-active>.mh-active-label', '.home .mh-ov-activity small', '.home .mh-ov-recent span', '.modern-toolbox .server-name small', '.modern-settings-nav>span', '.reading-caption>span'].map(s => `:root:root:root:root ${s}`).join(',')} { font-family:var(--sans)!important; }` });

test('Jet Black sets its words in the website\'s cream family at 4.5:1 or better; Midnight and Paper keep their ink', async ({ page }) => {
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-home')).toBeVisible();
  await palette(page, 'jet');
  const jet = await tokens(page);
  for (const [name, value] of Object.entries(jet)) expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
  expect(jet['--t1'], 'the first ink step is the brand cream').toBe(jet['--brand-ink']);
  for (const ink of ['--t1', '--t2', '--t3', '--t4']) {
    expect(warmth(jet[ink]!), `${ink} is warm`).toBeGreaterThan(8);
    for (const surface of ['--bg', '--s1', '--s2', '--s3']) expect(contrast(jet[ink]!, jet[surface]!), `${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5);
  }
  expect(await page.locator('.mh-intro h1, .mh-intro h2').first().evaluate(el => getComputedStyle(el).color)).toBe('rgb(241, 238, 228)');
  await palette(page, 'midnight');
  expect(await tokens(page)).toMatchObject({ '--t1': '#f4f8ff', '--t2': '#cbdcf6', '--t3': '#a0b4d3', '--t4': '#8c9ec0' });
  await palette(page, 'paper');
  expect(await tokens(page)).toMatchObject({ '--t1': '#14202a', '--t2': '#3c4a55', '--t3': '#55636e', '--t4': '#59656f' });
});

for (const width of [1440, 600]) {
  test(`small labels and counts are mono, sentences stay sans, and no panel, card or row moves at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.fulfill({ json: { saved: true, revisions: {} } }));
    await page.goto(server.launchUrl);
    await expect(page.locator('.mh-home')).toBeVisible();
    await page.locator('.mh-scroll').evaluate(node => node.scrollTo(0, node.scrollHeight));
    await expect(page.locator('.mh-session').first()).toBeVisible();
    for (const selector of sectionLabels) {
      if (!await page.locator(selector).first().isVisible()) continue;
      const label = await face(page, selector);
      expect(label.mono, selector).toBe(true); expect(label.upper, selector).toBe(true); expect(label.size, selector).toBe('11px');
      expect(label.tracking, selector).toBeCloseTo(0.05, 2);
    }
    for (const selector of homeLabels) { const label = await face(page, selector); expect(label.mono, selector).toBe(true); expect(parseFloat(label.size), selector).toBeLessThanOrEqual(12); }
    // A session's title and its meta line are a name and a sentence.
    for (const selector of ['.mh-session strong', '.mh-footer span']) expect((await face(page, selector)).mono, selector).toBe(false);
    const home = await rects(page);
    const style = await unface(page);
    expect(await rects(page), 'Home with the labels back in the sans').toEqual(home);
    await style.evaluate(node => (node as HTMLElement).remove());

    await page.goto(`${server.url}/?experience=modern#/r/${id}`);
    await expect(page.locator('.history article.op').first()).toBeVisible();
    if (width > 820) {
      for (const selector of sessionLabels) { const label = await face(page, selector); expect(label.mono, selector).toBe(true); expect(label.size, selector).toBe('11px'); }
      expect((await face(page, '.modern-toolbox .md-tool-list>.instrument>span')).mono, 'a tool kind\'s name').toBe(false);
    } else expect((await face(page, '.connected-workspace .history .op-kind')).mono).toBe(true);
    expect((await face(page, '.history .prose')).mono, 'prose').toBe(false);
    await page.waitForTimeout(600);
    const session = await rects(page);
    await unface(page);
    expect(await rects(page), 'the session with the labels back in the sans').toEqual(session);
  });
}

test('buttons are pills in every palette, and Jet Black\'s main action is the cream pill (UI-39 part 2)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.fulfill({ json: { saved: true, revisions: {} } }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${id}`);
  await expect(page.locator('.history article.op').first()).toBeVisible();
  await page.getByRole('button', { name: 'Changes', exact: true }).click();
  const approve = page.getByRole('button', { name: 'Approve read-only Git', exact: true });
  await expect(approve).toBeVisible();
  for (const name of ['jet', 'midnight', 'paper'] as const) {
    await palette(page, name);
    const radii = await page.locator(':is(.btn,.icon-btn):visible').evaluateAll(list => list.map(el => parseFloat(getComputedStyle(el).borderTopLeftRadius) >= Math.min(el.getBoundingClientRect().height / 2, 999) - 0.5));
    expect(radii.length, name).toBeGreaterThan(3);
    expect(radii.every(Boolean), `${name}: every visible button is a pill`).toBe(true);
  }
  await palette(page, 'jet');
  await page.mouse.move(0, 0); await page.waitForTimeout(400); // past the button's colour transition
  const { bg, ink, cream, ground } = await approve.evaluate(el => {
    const probe = (v: string) => { const s = document.createElement('span'); s.style.color = `var(${v})`; document.body.append(s); const c = getComputedStyle(s).color; s.remove(); return c; };
    return { bg: getComputedStyle(el).backgroundColor, ink: getComputedStyle(el).color, cream: probe('--brand-ink'), ground: probe('--bg') };
  });
  expect(bg, 'the main action is cream').toBe(cream);
  expect(ink, 'its label is the ground').toBe(ground);
  await palette(page, 'midnight'); await page.waitForTimeout(400);
  expect(await approve.evaluate(el => getComputedStyle(el).backgroundColor), 'Midnight keeps its own primary').not.toBe(cream);
});

test('Jet Black\'s canvas sits on the site\'s dot ground; other palettes keep theirs; low resource drops it (UI-39 part 3)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.fulfill({ json: { saved: true, revisions: {} } }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${id}`);
  await expect(page.locator('.history article.op').first()).toBeVisible();
  // The site's dots, still: a cream fill on the canvas's own layer, masked by a 288 px tile of 4 px dots on a staggered 12 px grid.
  const ground = () => page.locator('.connected-workspace').first().evaluate(el => { const b = getComputedStyle(el, '::before'); return { display: b.display, mask: b.maskImage || b.getPropertyValue('-webkit-mask-image'), size: b.maskSize || b.getPropertyValue('-webkit-mask-size'), z: b.zIndex, events: b.pointerEvents, own: getComputedStyle(el).backgroundImage }; });
  await palette(page, 'jet');
  const jet = await ground();
  expect(jet.display).toBe('block');
  expect(jet.mask).toContain('data:image/svg+xml');
  expect(jet.size).toBe('288px 288px');
  expect(jet.z, 'behind everything on the canvas').toBe('-1');
  expect(jet.events).toBe('none');
  expect(jet.own, 'the old grid is gone').toBe('none');
  await palette(page, 'midnight');
  expect((await ground()).display, 'Midnight keeps its own ground').toBe('none');
  await palette(page, 'jet');
  await page.evaluate(() => { document.documentElement.dataset.lowResource = '1'; });
  expect((await ground()).display, 'low resource drops it').toBe('none');
});

test('surfaces nested in a panel keep a fill and lose their outline; a field shows it again on focus; nothing moves (UI-39 part 5)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.fulfill({ json: { saved: true, revisions: {} } }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${id}`);
  await expect(page.locator('.history article.op').first()).toBeVisible();
  const search = page.locator('.folder-explorer .ux-search').first();
  await expect(search).toBeVisible();
  const look = () => search.evaluate(el => { const c = getComputedStyle(el), r = el.getBoundingClientRect(); return { border: c.borderTopColor, width: c.borderTopWidth, fill: c.backgroundColor, box: `${r.x},${r.y},${r.width},${r.height}` }; });
  const rest = await look();
  expect(rest.border, 'no outline at rest').toBe('rgba(0, 0, 0, 0)');
  expect(rest.fill, 'it keeps a fill').not.toBe('rgba(0, 0, 0, 0)');
  await search.locator('input').first().focus();
  const focused = await look();
  expect(focused.border, 'its outline returns with focus').not.toBe('rgba(0, 0, 0, 0)');
  expect(focused.width).toBe(rest.width);
  expect(focused.box, 'the field does not move').toBe(rest.box);
});
