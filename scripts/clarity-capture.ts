// CLARITY-1 pixel guard capture. Adapted from Harsh's UI-26 capture (PR #350, scripts/ui-26-capture.ts): the same readiness waits and
// surface preparation, with an `experience` parameter (modern | clarity), a developer-switch Settings so the nav matches across
// builds, and two more surfaces: the composer with its attach menu open, and a card's context menu.
import type { Browser, Locator, Page } from '@playwright/test';

// Fixed before any baseline is recorded. Changing these invalidates the frozen contract.
export const contract = {
  version: 1, widths: [600, 1440], height: 900, palettes: ['jet', 'paper'],
  surfaces: ['home', 'history', 'expanded', 'files', 'workspace', 'changes', 'git', 'toolbox', 'settings', 'composer', 'menu', 'draft'],
  expectedShots: 0, threshold: 0.1, maxDiffPixelRatio: 0.0005,
  metric: 'normalized maximum RGBA channel distance; ratio of pixels exceeding threshold',
  frozenTime: '2026-11-05T00:00:00.000Z', masks: [],
  preferences: { motion: false, mapOrbit: false, hoverReading: false, reducedMotion: 'reduce' },
} as const;
export type GuardCase = { id: 'demo' | 'claude' | 'codex'; recording?: string; file?: string; operation?: string };
type Server = { url: string; launchUrl: string };
function requireCase(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function visible(locator: Locator) { await locator.waitFor({ state: 'visible' }); }
async function press(locator: Locator) { await visible(locator); await locator.press('Enter'); }
async function populated(locator: Locator) {
  await visible(locator);
  requireCase(await locator.evaluate(el => !!el.textContent?.trim()), 'Required material is empty');
}

async function settled(page: Page, pending: Set<unknown>) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    if ([...document.fonts].some(font => font.status === 'error')) throw new Error('Required font failed');
    await Promise.all([...document.images].filter(image => image.getClientRects().length).map(image => image.decode()));
  });
  // Readiness, not networkidle: the daemon intentionally keeps an SSE connection open.
  const end = Date.now() + 30_000;
  while (pending.size) { requireCase(Date.now() < end, 'API material did not finish loading: ' + [...pending].slice(0, 3).map(r => new URL((r as { url(): string }).url()).pathname.replace(/rec_[0-9a-f]+/g, 'rec')).join('; ')); await page.waitForTimeout(50); }
  requireCase(await page.locator('[aria-busy="true"]:visible').count() === 0, 'Surface remains busy');
  requireCase(await page.getByText('This view could not be displayed', { exact: true }).count() === 0, 'Surface error boundary is visible');
  // Finite CSS/WAAPI animations (menu and dialog arrivals) must be finished, not just started, before a shot.
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime as number)).map(a => a.finished.catch(() => undefined)));
  });
  await page.evaluate(async () => {
    // Supported motion preferences stop map/replay activity. The screenshot API
    // finishes finite CSS transitions; this check waits for the real DOM allocation.
    let previous = '', stable = 0;
    for (let frame = 0; frame < 180; frame++) {
      await new Promise<void>(done => requestAnimationFrame(() => done()));
      const now = [...document.querySelectorAll('.history,.op.expanded,.developer-workspace,.current-file-reader,dialog[open],.modern-tool-station,.mh-home')]
        .map(el => { const b = el.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(n => n.toFixed(2)).join(',') + ':' + (el.textContent?.length ?? 0); }).join(';');
      if (now === previous) stable++; else stable = 0;
      if (stable >= 30) return;
      previous = now;
    }
    throw new Error('Surface geometry never settled');
  });
}
async function showFiles(page: Page) {
  const show = page.getByRole('button', { name: 'Show files', exact: true }).first();
  await visible(show);
  if (await show.getAttribute('aria-pressed') === 'false') await press(show);
  await visible(page.getByRole('textbox', { name: 'Find repository files', exact: true }));
}
async function chooseCurrentFile(page: Page, file: string) {
  const input = page.getByRole('textbox', { name: 'Find repository files', exact: true });
  await visible(input); await input.fill(file);
  await press(page.locator('[data-spine-path]').filter({ hasText: file }).first());
}
async function approveWorkspace(page: Page) {
  await press(page.getByRole('button', { name: 'Open developer workspace', exact: true }));
  const desk = page.getByRole('region', { name: 'Developer workspace', exact: true }); await visible(desk);
  const approve = desk.getByRole('button', { name: 'Approve workspace reading', exact: true });
  // Wait for either the ordinary read-only consent or the already-granted tabs.
  await approve.or(desk.getByRole('tablist')).waitFor({ state: 'visible' });
  if (await approve.isVisible()) await press(approve);
  await visible(desk.getByRole('tablist'));
  return desk;
}
async function prepare(page: Page, c: GuardCase, surface: string): Promise<'material' | 'unavailable'> {
  if (surface === 'home') {
    await populated(page.locator('.mh-home'));
    await populated(page.locator('.mh-session').first());
    // A watched session shows "live", then "live · idle" a few seconds later; wait for the settled badge so the shot does not depend on that clock.
    await page.waitForFunction(() => { const t = document.querySelector('.mh-home')?.textContent ?? ''; return !/live/.test(t) || /live\s*·\s*idle/.test(t); }, undefined, { timeout: 20_000 }).catch(() => undefined);
    return 'material';
  }
  if (surface === 'history') {
    await populated(page.locator('article.op').first());
    return 'material';
  }
  if (surface === 'menu') {
    // The first card head fully inside the viewport, clicked where it is: no scrolling, so every build opens the same menu in the same place.
    const heads = page.locator('article.op .op-head'); let target: { x: number; y: number } | undefined;
    for (let i = 0, n = await heads.count(); i < n && !target; i++) {
      const box = await heads.nth(i).boundingBox();
      if (!box || box.x < 0 || box.y < 0 || box.x + box.width > page.viewportSize()!.width || box.y + box.height > page.viewportSize()!.height) continue;
      // The point must really land on the head, not on the header or composer drawn over it.
      const hit = await heads.nth(i).evaluate((el, p) => { const top = document.elementFromPoint(p.x, p.y); return !!top && el.contains(top); }, { x: box.x + 12, y: box.y + 12 });
      if (hit) target = { x: box.x + 12, y: box.y + 12 };
    }
    requireCase(target, 'No card head is in view for the context menu');
    await page.mouse.click(target.x, target.y, { button: 'right' });
    await populated(page.getByRole('menu'));
    return 'material';
  }
  if (surface === 'composer') {
    const composer = page.getByRole('region', { name: 'Harness prompt', exact: true });
    // Native sessions show a collapsed "Ask your agent…" prompt; the offline demo has no composer at all.
    const ask = page.getByText('Ask your agent', { exact: false }).first();
    if (!await composer.count() && !await ask.count()) return 'unavailable';
    await visible(composer);
    // Open: the expanded prompt with its attach controls and, where the harness offers it, the native-settings menu.
    const attach = composer.getByRole('button', { name: 'Attach text or image files', exact: true });
    if (!await attach.isVisible()) { await ask.click(); await visible(attach); }
    const enable = composer.getByRole('button', { name: 'Enable this workspace', exact: true });
    if (await enable.count()) await press(enable);
    const policy = composer.locator('.permission-policy > summary');
    if (await policy.count()) await press(policy);
    return 'material';
  }
  if (surface === 'expanded') {
    // The first Expand control that is really on screen (the list is windowed and follows live), clicked where it is, retried once.
    const controls = c.operation ? page.locator(`[data-expand-op=${JSON.stringify(c.operation)}]`) : page.locator('[data-expand-op]');
    for (let attempt = 0; attempt < 2 && !await page.locator('article.op.expanded .op-expanded').count(); attempt++) {
      let spot: { x: number; y: number } | undefined;
      for (let i = 0, n = await controls.count(); i < n && !spot; i++) {
        const box = await controls.nth(i).boundingBox();
        if (box && box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize()!.width && box.y + box.height <= page.viewportSize()!.height) {
          const hit = await controls.nth(i).evaluate((el, p) => { const top = document.elementFromPoint(p.x, p.y); return !!top && el.contains(top); }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
          if (hit) spot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        }
      }
      if (spot) await page.mouse.click(spot.x, spot.y);
      await page.locator('article.op.expanded .op-expanded').first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => undefined);
    }
    await populated(page.locator('article.op.expanded .op-expanded').first());
    return 'material';
  }
  if (surface === 'settings') {
    await press(page.getByRole('button', { name: 'Workspace settings', exact: true }));
    await populated(page.getByRole('dialog', { name: 'Workspace settings', exact: true }));
    await populated(page.locator('.theme-option').first());
    return 'material';
  }
  if (surface === 'changes') {
    await press(page.locator('button.review-open'));
    await populated(page.getByRole('dialog', { name: 'Changes', exact: true }));
    if (c.id === 'demo') await populated(page.locator('.review-file').first());
    return 'material';
  }
  if (surface === 'toolbox') {
    // At 600 px the toolbox is not part of the layout: the shot records the plain history instead.
    if (page.viewportSize()!.width < 700 && !await page.getByRole('complementary', { name: 'Tools and agents', exact: true }).isVisible()) return 'unavailable';
    await populated(page.getByRole('complementary', { name: 'Tools and agents', exact: true }));
    const minimized = page.getByRole('button', { name: 'Expand toolbox', exact: true });
    if (await minimized.isVisible()) await press(minimized);
    const mcp = page.locator('.md-server').filter({ has: page.locator('[data-mcp-server]') }).first();
    // Real sessions may record no MCP server or no sub-agent: show the toolbox as that session has it.
    if (c.id === 'demo' || await mcp.count()) {
      await visible(mcp);
      if (!await mcp.evaluate(el => (el as HTMLDetailsElement).open)) await press(mcp.locator(':scope > summary'));
      await populated(mcp.locator('[data-mcp-tool]').first());
    }
    if (c.id === 'demo' || await page.locator('.md-agents').count()) {
      await visible(page.locator('.md-agents'));
      if (!await page.locator('.md-agents').evaluate(el => (el as HTMLDetailsElement).open)) await press(page.locator('.md-agents > summary'));
    }
    return 'material';
  }
  // The local-draft editor is CodeMirror, whose styles are injected unlayered: the one place the legacy layer could lose a fight it used to win.
  if (surface === 'draft' && c.id === 'demo') return 'unavailable';
  if (c.id === 'demo' && (surface === 'workspace' || surface === 'git')) {
    const button = page.getByRole('button', { name: surface === 'workspace' ? 'Open developer workspace' : 'Git', exact: true });
    await visible(button);
    requireCase(await button.isDisabled(), 'Offline capability must remain truthfully disabled');
    requireCase(!!await button.getAttribute('title'), 'Offline capability explanation is absent');
    await button.hover();
    return 'unavailable';
  }
  if (surface === 'files' && c.id === 'demo') {
    await showFiles(page);
    // Offline files must open captured material rather than fabricated current bytes.
    const file = page.locator('[data-spine-path]').first(); await press(file);
    await populated(page.locator('dialog.file-workspace').first());
    return 'material';
  }
  requireCase(c.file, 'Native Files/Workspace/Git cases require a populated current file');
  const desk = await approveWorkspace(page);
  if (surface === 'files') {
    await press(desk.getByRole('button', { name: 'Back to agent', exact: true }));
    await showFiles(page); await chooseCurrentFile(page, c.file);
    const reader = page.locator('.current-file-reader'); await visible(reader);
    await populated(reader.locator('.current-file-code,.desk-markdown').first());
  } else if (surface === 'workspace') {
    const trigger = desk.getByRole('button', { name: 'Choose workspace file', exact: true });
    if (await trigger.isVisible() && await trigger.getAttribute('aria-expanded') === 'false') await press(trigger);
    await chooseCurrentFile(page, c.file);
    await populated(desk.locator('.whole-source,.desk-markdown').first());
  } else if (surface === 'draft') {
    const trigger = desk.getByRole('button', { name: 'Choose workspace file', exact: true });
    if (await trigger.isVisible() && await trigger.getAttribute('aria-expanded') === 'false') await press(trigger);
    await chooseCurrentFile(page, c.file);
    await populated(desk.locator('.whole-source,.desk-markdown').first());
    await press(desk.locator('.desk-edit-toggle'));
    await populated(desk.locator('.cm-content'));
    // CodeMirror's caret blinks on its own clock; a screenshot must not depend on the phase.
    await page.addStyleTag({ content: '.cm-cursorLayer { visibility: hidden !important; animation: none !important; }' });
  } else if (surface === 'git') {
    await press(desk.getByRole('button', { name: 'Back to agent', exact: true }));
    await press(page.getByRole('button', { name: 'Git', exact: true }));
    await press(page.getByRole('button', { name: 'Git review', exact: true }));
    const review = page.getByRole('dialog', { name: 'Git review', exact: true }); await visible(review);
    const approve = review.getByRole('button', { name: 'Approve read-only Git', exact: true });
    await approve.or(review.getByRole('button', { name: 'Refresh changes', exact: true })).waitFor({ state: 'visible' });
    if (await approve.isVisible()) await press(approve);
    // A clean or untracked-only repository has no patch to show; its review still has to render.
    await populated(review);
    await review.locator('.unified-change').first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => undefined);
  } else throw new Error('Unknown required surface');
  return 'material';
}
export async function captureSurfaces(browser: Browser, server: Server, cases: GuardCase[], experience: 'modern' | 'clarity',
  save: (name: string, bytes: Buffer, kind: string) => Promise<void>, only?: { palettes?: readonly string[]; widths?: readonly number[]; surfaces?: readonly string[] }) {
  for (const c of cases) for (const palette of only?.palettes ?? contract.palettes) for (const width of only?.widths ?? contract.widths) for (const surface of only?.surfaces ?? contract.surfaces) {
    const name = `${c.id}-${palette}-${width}-${surface}`;
    const context = await browser.newContext({ viewport: { width, height: contract.height }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(10_000);
    const pending = new Set<unknown>(); const errors: string[] = [];
    page.on('request', r => { if (r.url().includes('/v1/') && !['/v1/changes', '/v1/working-locations'].includes(new URL(r.url()).pathname)) pending.add(r); });
    page.on('requestfinished', r => pending.delete(r)); page.on('requestfailed', r => { pending.delete(r); errors.push('request failed ' + new URL(r.url()).pathname.replace(/rec_[0-9a-f]+/g, 'rec')); });
    page.on('pageerror', e => errors.push('page error ' + e.message.slice(0, 80)));
    // The fix-chain lookup answers 404 for a step that is not part of a failing chain: the app expects it.
    page.on('response', r => { if (r.status() >= 400 && !(r.status() === 404 && r.url().includes('/fix-chain/'))) errors.push('HTTP ' + r.status() + ' ' + new URL(r.url()).pathname.replace(/rec_[0-9a-f]+/g, 'rec')); });
    try {
      await page.clock.setFixedTime(new Date(contract.frozenTime));
      await context.addInitScript(() => {
        localStorage.setItem('drishya.motion', '0'); localStorage.setItem('drishya.mapOrbit', 'false'); localStorage.setItem('drishya.hoverReading', '0');
        localStorage.setItem('drishya-dev-ui-versions', '1');
      });
      const launch = new URL(server.launchUrl); launch.searchParams.set('experience', experience);
      await page.goto(launch.href); await visible(page.locator('.mh-home'));
      await settled(page, pending);
      if (surface !== 'home') {
        const query = c.id === 'demo' ? `?demo&experience=${experience}&motion=0` : `?experience=${experience}&motion=0`;
        await page.goto(`${server.url}/${query}${c.recording ? '#/r/' + encodeURIComponent(c.recording) : ''}`);
        // A recording whose workspace tabs were kept by an earlier capture reopens in the Workspace: always start from the agent view.
        const desk = page.getByRole('region', { name: 'Developer workspace', exact: true });
        for (const end = Date.now() + 30_000; !(await desk.isVisible()) && !(await page.locator('.history').isVisible()); await page.waitForTimeout(50)) requireCase(Date.now() < end, 'Neither the history nor the Workspace appeared');
        if (await desk.isVisible()) await press(desk.getByRole('button', { name: 'Back to agent', exact: true }));
        await visible(page.locator('.history'));
        // Likewise a Git review or file dialog kept from the previous capture: every shot starts with nothing open.
        for (let i = 0; i < 3 && await page.getByRole('dialog').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
      }
      await page.evaluate(value => { document.documentElement.dataset.palette = value; }, palette);
      const kind = await prepare(page, c, surface);
      await page.mouse.move(0, 0);
      await settled(page, pending);
      requireCase(errors.length === 0, 'Page or material request failed: ' + errors.slice(0, 3).join('; '));
      const bytes = await page.screenshot({ animations: 'disabled', caret: 'hide', type: 'png' });
      await save(name, bytes, kind);
    } catch (error) {
      await page.screenshot({ path: `.local/clarity-guard/failure-${name}.png` }).catch(() => undefined);
      await page.locator('[aria-label="Harness prompt"]').first().evaluate(el => [...el.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') ?? b.textContent ?? '').slice(0, 50) + ' ' + b.getBoundingClientRect().width).join(' | ')).then(text => import('node:fs').then(fs => fs.writeFileSync(`.local/clarity-guard/failure-${name}.txt`, text))).catch(() => undefined);
      throw error;
    } finally { await context.close(); }
  }
}


