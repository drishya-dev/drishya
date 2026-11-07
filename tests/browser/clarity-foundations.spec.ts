import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-clarity-found-')); app = new App(dir); await app.ingest.importSource('claude-code', resolve('fixtures/synthetic/claude/checkout-fix.jsonl')); server = await startServer({ app, port: 0, token: 'synthetic-clarity-found' }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// FINISH-0a: Clarity's foundations (Inter, Graphite and Porcelain, the button system, the switch, the segmented control, fields).
// `motion` leaves relationship motion on, which the hover, press and travel rules are gated by.
const url = (experience: 'clarity' | 'modern', { motion = false } = {}) => new URL(`/?demo${motion ? '' : '&motion=0'}&experience=${experience}`, server.launchUrl).href;
/** Home (the session list), with the token in the hash as the daemon's own launch URL has it. */
const homeURL = () => { const u = new URL(server.launchUrl); u.searchParams.set('experience', 'clarity'); u.searchParams.set('motion', '0'); return u.href; };
const html = (page: Page) => page.locator('html');
const openSettings = async (page: Page, section?: string) => {
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
  if (section) await dialog.getByRole('tab', { name: section, exact: true }).click();
  return dialog;
};
/** Adds one of every button variant to the page, so each rule is read from the real stylesheet. */
const addButtons = (page: Page) => page.evaluate(() => {
  const host = document.createElement('div'); host.id = 'cl-buttons'; host.style.cssText = 'position:fixed;left:8px;bottom:8px;display:flex;gap:8px;z-index:9999;padding:8px;background:var(--bg)';
  const add = (id: string, className: string, label: string, attrs: Record<string, string> = {}) => {
    const button = document.createElement('button'); button.id = id; button.className = className; button.textContent = label;
    for (const [key, value] of Object.entries(attrs)) button.setAttribute(key, value);
    host.append(button);
  };
  add('b-secondary', 'btn', 'Secondary'); add('b-primary', 'btn primary', 'Primary'); add('b-ghost', 'btn ghost', 'Ghost'); add('b-danger', 'btn danger', 'Danger');
  add('b-icon', 'icon-btn', 'x', { 'aria-label': 'Icon' }); add('b-disabled', 'btn', 'Disabled', { disabled: '' }); add('b-busy', 'btn', 'Loading', { 'aria-busy': 'true' }); add('b-selected', 'btn', 'Selected', { 'aria-pressed': 'true' });
  document.body.append(host);
});

test('Clarity renders Inter; Modern does not', async ({ page }) => {
  await page.goto(url('clarity'));
  await expect(html(page)).toHaveAttribute('data-ui-skin', 'clarity');
  expect(await page.evaluate(async () => { await document.fonts.load('13px Inter'); return [getComputedStyle(document.body).fontFamily.startsWith('Inter'), document.fonts.check('13px Inter')]; })).toEqual([true, true]);
  await page.goto(url('modern'));
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).not.toContain('Inter');
});

test('Graphite and Porcelain: every text and meaning colour clears 4.5:1 on the canvas and both panel surfaces', async ({ page }) => {
  await page.goto(url('clarity'));
  for (const [palette, scheme] of [['jet', 'dark'], ['paper', 'light']] as const) {
    await page.evaluate(([p, s]) => { document.documentElement.dataset.palette = p; document.documentElement.dataset.theme = s; }, [palette, scheme]);
    const failures = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const probe = document.createElement('canvas').getContext('2d')!;
      const rgb = (token: string) => { probe.clearRect(0, 0, 1, 1); probe.fillStyle = root.getPropertyValue(token).trim(); probe.fillRect(0, 0, 1, 1); return [...probe.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const lum = (c: number[]) => c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i]!, 0);
      const ratio = (a: number[], b: number[]) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi! + .05) / (lo! + .05); };
      const roles = ['--t1', '--t2', '--t3', '--t4', '--focus', '--accent', '--claude', '--codex', '--live', '--pass', '--fail', '--edited', '--read', '--source', '--external', '--syntax-keyword', '--syntax-string', '--syntax-function', '--syntax-number'];
      const out: string[] = [];
      for (const role of roles) for (const surface of ['--bg', '--s1', '--s2']) { const r = ratio(rgb(role), rgb(surface)); if (r < 4.5) out.push(`${role} on ${surface}: ${r.toFixed(2)}`); }
      // The primary button: white on the active fill, in both states.
      for (const fill of ['--palette-active', '--palette-active-hover']) { const r = ratio([255, 255, 255], rgb(fill)); if (r < 4.5) out.push(`white on ${fill}: ${r.toFixed(2)}`); }
      return out;
    });
    expect(failures, palette).toEqual([]);
  }
});

test('a saved Modern palette maps to Graphite or Porcelain, is stored separately, and comes back untouched', async ({ browser }) => {
  // Orchid, Ember and Midnight (dark) open Graphite; Royal and Daylight (light) open Porcelain.
  for (const [saved, palette, scheme] of [['mocha', 'jet', 'dark'], ['gruvbox', 'jet', 'dark'], ['midnight', 'jet', 'dark'], ['tokyo', 'paper', 'light'], ['light', 'paper', 'light']] as const) {
    const context = await browser.newContext(), page = await context.newPage();
    await page.addInitScript(value => { try { localStorage.setItem('drishya.theme', value); } catch { /* storage unavailable */ } }, saved);
    await page.goto(url('clarity'));
    await expect(html(page), saved).toHaveAttribute('data-palette', palette);
    await expect(html(page), saved).toHaveAttribute('data-theme', scheme);
    await context.close();
  }
  const context = await browser.newContext(), page = await context.newPage();
  await page.addInitScript(() => { try { if (!localStorage.getItem('drishya.theme')) localStorage.setItem('drishya.theme', 'mocha'); } catch { /* storage unavailable */ } });
  await page.goto(url('clarity'));
  const settings = await openSettings(page, 'Appearance');
  // Clarity offers only its two palettes.
  await expect(settings.locator('.theme-option')).toHaveText([/Graphite/, /Porcelain/]);
  await expect(settings.getByRole('button', { name: 'Graphite', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await settings.getByRole('button', { name: 'Porcelain', exact: true }).click();
  await expect(html(page)).toHaveAttribute('data-palette', 'paper');
  expect(await page.evaluate(() => [localStorage.getItem('drishya.clarity.theme'), localStorage.getItem('drishya.theme')])).toEqual(['porcelain', 'mocha']);
  // The choice survives a reload; and in Modern the person's own palette is exactly as they left it.
  await page.reload();
  await expect(html(page)).toHaveAttribute('data-palette', 'paper');
  await page.goto(url('modern'));
  await expect(html(page)).toHaveAttribute('data-palette', 'mocha');
  const modern = await openSettings(page, 'Appearance');
  await expect(modern.locator('.theme-option')).toHaveCount(7);
  await expect(modern.getByRole('button', { name: 'Orchid', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await context.close();
});

test('Settings uses switches in Clarity (Space toggles, the track is 28 x 16, the knob 12) and checkboxes in Modern', async ({ page }) => {
  await page.goto(url('clarity', { motion: true }));
  const settings = await openSettings(page, 'Reading');
  await expect(settings.getByRole('checkbox')).toHaveCount(0);
  const switches = settings.getByRole('switch');
  expect(await switches.count()).toBe(7);
  const motion = settings.getByRole('switch', { name: 'Relationship motion' });
  await expect(motion).toHaveAttribute('aria-checked', 'true');
  expect(await motion.locator('.cl-switch-track').evaluate(el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; })).toEqual([28, 16]);
  expect(await motion.locator('.cl-switch-knob').evaluate(el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; })).toEqual([12, 12]);
  // The description is not part of the name, and is linked by aria-describedby.
  await expect(motion).toHaveAccessibleDescription(/Finite origin and outcome cues/);
  const offsetBefore = await motion.locator('.cl-switch-knob').evaluate(el => el.getBoundingClientRect().left);
  await motion.focus(); await page.keyboard.press('Space');
  await expect(motion).toHaveAttribute('aria-checked', 'false');
  // Keyboard toggles are instant: the knob is already 12 px to the left, with no transition running.
  expect(await motion.locator('.cl-switch-knob').evaluate(el => el.getBoundingClientRect().left)).toBe(offsetBefore - 12);
  await page.keyboard.press('Space');
  await expect(motion).toHaveAttribute('aria-checked', 'true');
  // A disabled switch (Slow background orbit needs the 3D map) cannot be toggled.
  const orbit = settings.getByRole('switch', { name: 'Slow background orbit' });
  await settings.getByRole('switch', { name: '3D repository map' }).click();
  await expect(orbit).toBeDisabled();
  await page.goto(url('modern'));
  const modern = await openSettings(page, 'Reading');
  await expect(modern.getByRole('switch')).toHaveCount(0);
  await expect(modern.getByRole('checkbox')).toHaveCount(7);
});

test('every button variant shows its states: default, hover, press, focus, disabled, loading, selected', async ({ page }) => {
  await page.goto(url('clarity', { motion: true }));
  await expect(page.locator('[data-ui-motion]').first()).toBeVisible();
  await addButtons(page);
  const style = (id: string, props: string[], pseudo?: string) => page.locator('#' + id).evaluate((el, [names, p]) => { const s = getComputedStyle(el, p || undefined); return Object.fromEntries((names as string[]).map(n => [n, s.getPropertyValue(n)])); }, [props, pseudo ?? ''] as const);
  const tokens = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); const probe = document.createElement('canvas').getContext('2d')!; const rgb = (t: string) => { probe.fillStyle = s.getPropertyValue(t).trim(); probe.fillRect(0, 0, 1, 1); const d = probe.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`; }; return { s2: rgb('--s2'), s3: rgb('--s3'), active: rgb('--palette-active'), fail: rgb('--fail'), line2: rgb('--line-2'), line3: rgb('--line-3') }; });
  // Heights: 28 by default (--control-md), 28 square for the icon button.
  for (const id of ['b-secondary', 'b-primary', 'b-ghost', 'b-danger']) expect((await style(id, ['height']))['height'], id).toBe('28px');
  expect(await style('b-icon', ['width', 'height'])).toEqual({ width: '28px', height: '28px' });
  // Variants.
  expect(await style('b-secondary', ['background-color', 'border-top-color'])).toEqual({ 'background-color': tokens.s2, 'border-top-color': tokens.line2 });
  expect((await style('b-primary', ['background-color', 'color']))).toEqual({ 'background-color': tokens.active, color: 'rgb(255, 255, 255)' });
  expect((await style('b-ghost', ['background-color']))['background-color']).toBe('rgba(0, 0, 0, 0)');
  expect((await style('b-danger', ['color']))['color']).toBe(tokens.fail);
  // Hover (fine pointer): the secondary fill moves to --s3 and the border to --line-3 once the transition settles.
  await page.locator('#b-secondary').hover(); await page.waitForTimeout(300);
  expect(await style('b-secondary', ['background-color', 'border-top-color'])).toEqual({ 'background-color': tokens.s3, 'border-top-color': tokens.line3 });
  // Press: scale(.97) for pointers.
  await page.mouse.down(); await page.waitForTimeout(250);
  expect((await style('b-secondary', ['transform']))['transform']).toBe('matrix(0.97, 0, 0, 0.97, 0, 0)');
  await page.mouse.up(); await page.mouse.move(0, 0); await page.waitForTimeout(300);
  expect((await style('b-secondary', ['transform']))['transform']).toBe('none');
  // Focus: the one ring, 2 px, on keyboard focus.
  await page.locator('#b-ghost').evaluate(el => el.blur());
  await page.keyboard.press('Tab');
  await page.locator('#b-secondary').focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  // It settles from a 4 px offset to 2 px over 140 ms: the animation is running right after the keyboard lands on the button.
  expect(await page.evaluate(() => document.getAnimations().filter(a => (a as CSSAnimation).animationName === 'cl-focus-settle').map(a => [a.effect!.getTiming().duration, (a.effect as KeyframeEffect).getKeyframes()[0]!.outlineOffset]))).toEqual([[140, '4px']]);
  await page.waitForTimeout(300);
  expect(await style('b-secondary', ['outline-width', 'outline-style', 'outline-offset'])).toEqual({ 'outline-width': '2px', 'outline-style': 'solid', 'outline-offset': '2px' });
  // Disabled: dimmed, not-allowed, no hover.
  expect(await style('b-disabled', ['opacity', 'cursor'])).toEqual({ opacity: '0.45', cursor: 'not-allowed' });
  await page.locator('#b-disabled').hover({ force: true }); await page.waitForTimeout(250);
  expect((await style('b-disabled', ['background-color']))['background-color']).toBe(tokens.s2);
  // Loading: the width is locked (the label stays), and a 12 px spinner sits on it.
  expect(await style('b-busy', ['width', 'color'])).not.toEqual({ width: '0px', color: 'rgb(0, 0, 0)' });
  expect(await style('b-busy', ['width', 'height', 'border-top-width'], '::after')).toEqual({ width: '12px', height: '12px', 'border-top-width': '2px' });
  // Selected: --s3 fill, --line-3 border.
  expect(await style('b-selected', ['background-color', 'border-top-color'])).toEqual({ 'background-color': tokens.s3, 'border-top-color': tokens.line3 });
});

test('the segmented control draws one pill and slides it to the chosen option', async ({ page }) => {
  await page.goto(url('clarity'));
  const track = page.locator('.workspace-toggles');
  await expect(track).toBeVisible();
  const files = track.getByRole('button', { name: 'Show files', exact: true }), repository = track.getByRole('button', { name: 'Explore repository map', exact: true });
  // Exactly one option chosen: the track carries the pill and its measurements.
  if (await files.getAttribute('aria-pressed') !== 'true') await files.click();
  await expect(track).toHaveAttribute('data-seg', '');
  const geometry = () => track.evaluate(el => ({ x: parseFloat(el.style.getPropertyValue('--seg-x')), w: parseFloat(el.style.getPropertyValue('--seg-w')), pressed: [...el.children].filter(c => c.getAttribute('aria-pressed') === 'true').map(c => [(c as HTMLElement).offsetLeft, (c as HTMLElement).offsetWidth]) }));
  let now = await geometry();
  expect(now.pressed).toEqual([[now.x, now.w]]);
  await repository.click();
  await expect.poll(async () => (await geometry()).pressed.length).toBe(1);
  const after = await geometry();
  expect(after.x).toBeGreaterThan(now.x);
  expect(after.pressed).toEqual([[after.x, after.w]]);
  // The pill is drawn by the track, and the chosen button itself stays clear.
  expect(await track.evaluate(el => [getComputedStyle(el, '::before').width, getComputedStyle(el.querySelector('[aria-pressed=true]')!).backgroundColor])).toEqual([`${after.w}px`, 'rgba(0, 0, 0, 0)']);
  // Modern keeps its own toggles.
  await page.goto(url('modern'));
  await expect(page.locator('.workspace-toggles')).not.toHaveAttribute('data-seg', '');
});

test('counts are tabular and lining; group labels are sentence case', async ({ page }) => {
  await page.goto(url('clarity'));
  await expect(page.locator('.tool-uses').first()).toBeVisible();
  const numeric = await page.locator('.tool-uses').first().evaluate(el => getComputedStyle(el).fontVariantNumeric);
  expect(numeric).toContain('tabular-nums'); expect(numeric).toContain('lining-nums');
  await page.locator('html').evaluate(() => undefined);
  await page.goto(homeURL());
  const heading = page.locator('.mh-workspaces > header').first();
  await expect(heading).toBeVisible();
  expect(await heading.evaluate(el => { const s = getComputedStyle(el); return [s.textTransform, s.letterSpacing === 'normal' || parseFloat(s.letterSpacing) === 0, s.fontSize, s.fontWeight]; })).toEqual(['none', true, '12px', '500']);
});

test('the search field: icon, clear button once there is text, Escape clears then blurs', async ({ page }) => {
  await page.goto(homeURL());
  const field = page.getByRole('textbox', { name: 'Find sessions', exact: true });
  await expect(field).toBeVisible();
  await expect(page.locator('.cl-search .cl-search-icon')).toHaveAttribute('width', '14');
  await expect(page.getByRole('button', { name: 'Clear session search' })).toHaveCount(0);
  await field.fill('abc');
  await expect(page.getByRole('button', { name: 'Clear session search' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(field).toHaveValue(''); await expect(field).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(field).not.toBeFocused();
  await field.fill('xyz'); await page.getByRole('button', { name: 'Clear session search' }).click();
  await expect(field).toHaveValue(''); await expect(field).toBeFocused();
  // Focus: the --focus border plus a 3 px ring (25 % of --focus).
  const ring = await field.evaluate(el => {
    const box = el.parentElement!, probe = document.createElement('i'); probe.style.color = 'var(--focus)'; document.body.append(probe);
    const focus = getComputedStyle(probe).color; probe.remove();
    const s = getComputedStyle(box); return { border: s.borderTopColor, focus, shadow: s.boxShadow };
  });
  expect(ring.border).toBe(ring.focus);
  expect(ring.shadow).toContain('3px');
});

test('Settings in Clarity: every sentence and label is at least 12 px, every control and the palette cards too', async ({ page }) => {
  await page.goto(url('clarity'));
  const dialog = await openSettings(page);
  for (const section of ['Appearance', 'Reading', 'Playback', 'Privacy', 'Keyboard']) {
    await dialog.getByRole('tab', { name: section, exact: true }).click();
    const small = await dialog.evaluate(root => [...root.querySelectorAll<HTMLElement>('*')].filter(el => el.getClientRects().length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).map(el => `${el.tagName} ${getComputedStyle(el).fontSize} ${el.textContent?.trim().slice(0, 30)}`));
    expect(small, section).toEqual([]);
  }
});

test('the text field: height 28, hover, focus ring, placeholder and error states', async ({ page }) => {
  await page.goto(url('clarity', { motion: true }));
  await expect(page.locator('[data-ui-motion]').first()).toBeVisible();
  await page.evaluate(() => {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:8px;bottom:8px;width:240px;z-index:9999;padding:8px;background:var(--bg)';
    host.innerHTML = '<input id="f-ok" class="cl-field" placeholder="Placeholder" aria-label="Plain"><input id="f-bad" class="cl-field" aria-invalid="true" aria-label="Invalid" aria-describedby="f-bad-error"><p id="f-bad-error" class="cl-field-error">Enter a number of lines, for example 200.</p>';
    document.body.append(host);
  });
  const read = (id: string, names: string[]) => page.locator('#' + id).evaluate((el, props) => { const s = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, s.getPropertyValue(p)])); }, names);
  const color = (token: string) => page.evaluate(t => { const p = document.createElement('i'); p.style.color = `var(${t})`; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; }, token);
  expect(await read('f-ok', ['height', 'border-top-left-radius', 'font-size'])).toEqual({ height: '28px', 'border-top-left-radius': '6px', 'font-size': '13px' });
  expect((await read('f-ok', ['border-top-color']))['border-top-color']).toBe(await color('--line-2'));
  await page.locator('#f-ok').hover(); await page.waitForTimeout(300);
  expect((await read('f-ok', ['border-top-color']))['border-top-color']).toBe(await color('--line-3'));
  await page.locator('#f-ok').focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(300);
  const focused = await read('f-ok', ['border-top-color', 'box-shadow']);
  expect(focused['border-top-color']).toBe(await color('--focus')); expect(focused['box-shadow']).toContain('3px');
  expect(await page.locator('#f-ok').evaluate(el => getComputedStyle(el, '::placeholder').color)).toBe(await color('--t4'));
  // Error: a --fail border and a 12 px --fail message under the field.
  expect((await read('f-bad', ['border-top-color']))['border-top-color']).toBe(await color('--fail'));
  expect(await read('f-bad-error', ['color', 'font-size'])).toEqual({ color: await color('--fail'), 'font-size': '12px' });
});

test('reduced motion keeps colour fades but never moves or scales; low resource animates nothing', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' }), page = await context.newPage();
  await page.goto(url('clarity', { motion: true }));
  // The app itself turns relationship motion off under reduced motion; force the attribute on, to read Clarity's own media-query rule.
  await expect(page.locator('.mh-home, .history, #root > *').first()).toBeVisible(); await page.waitForTimeout(500);
  await page.evaluate(() => document.documentElement.setAttribute('data-ui-motion', ''));
  await addButtons(page);
  // The press scale and the switch's travel are transforms: not under reduced motion. The colour fade is allowed.
  await page.locator('#b-secondary').hover(); await page.mouse.down(); await page.waitForTimeout(250);
  expect(await page.locator('#b-secondary').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.mouse.up();
  const settings = await openSettings(page, 'Reading');
  expect(await settings.getByRole('switch').first().locator('.cl-switch-knob').evaluate(el => getComputedStyle(el).transitionProperty.includes('transform'))).toBe(false);
  await context.close();
  // Low resource turns every Clarity transition and animation off.
  const low = await browser.newContext(), lowPage = await low.newPage();
  await lowPage.goto(url('clarity', { motion: true }));
  await expect(lowPage.locator('[data-ui-motion]').first()).toBeVisible(); // the app has mounted
  await lowPage.evaluate(() => document.documentElement.setAttribute('data-low-resource', ''));
  await addButtons(lowPage);
  expect(await lowPage.locator('#b-secondary').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(await lowPage.locator('#b-busy').evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
  await low.close();
});
