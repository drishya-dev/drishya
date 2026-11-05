import type { Browser, Locator, Page } from '@playwright/test';

// Fixed before any baseline is recorded. Changing these invalidates the frozen contract.
export const contract = {
  version: 1, widths: [600, 1440], height: 900, palettes: ['jet', 'paper'],
  surfaces: ['home', 'history', 'files', 'workspace', 'changes', 'git', 'toolbox', 'settings'],
  expectedShots: 96, threshold: 0.1, maxDiffPixelRatio: 0.0005,
  metric: 'normalized maximum RGBA channel distance; ratio of pixels exceeding threshold',
  frozenTime: '2026-11-05T00:00:00.000Z', masks: [],
  negativeTarget: 'demo-jet-1440-history',
  negativeStyle: 'article.op.expanded { outline: 24px solid #ff00ff !important; outline-offset: -24px !important; }',
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
  const end = Date.now() + 10_000;
  while (pending.size) { requireCase(Date.now() < end, 'API material did not finish loading'); await page.waitForTimeout(50); }
  requireCase(await page.locator('[aria-busy="true"]:visible').count() === 0, 'Surface remains busy');
  requireCase(await page.getByText('This view could not be displayed', { exact: true }).count() === 0, 'Surface error boundary is visible');
  await page.evaluate(async () => {
    // Supported motion preferences stop map/replay activity. The screenshot API
    // finishes finite CSS transitions; this check waits for the real DOM allocation.
    let previous = '', stable = 0;
    for (let frame = 0; frame < 180; frame++) {
      await new Promise<void>(done => requestAnimationFrame(() => done()));
      const now = [...document.querySelectorAll('.history,.op.expanded,.developer-workspace,.current-file-reader,dialog[open],.modern-tool-station,.mh-home')]
        .map(el => { const b = el.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(n => n.toFixed(2)).join(','); }).join(';');
      if (now === previous) stable++; else stable = 0;
      if (stable >= 3) return;
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
  await press(page.locator(`[data-spine-path=${JSON.stringify(file)}]`).first());
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
    return 'material';
  }
  if (surface === 'history') {
    const expand = c.operation ? page.locator(`[data-expand-op=${JSON.stringify(c.operation)}]`) : page.locator('[data-expand-op]').first();
    await press(expand);
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
    await press(page.getByRole('button', { name: 'Changes', exact: true }));
    await populated(page.getByRole('dialog', { name: 'Changes', exact: true }));
    await populated(page.locator('.review-file').first());
    return 'material';
  }
  if (surface === 'toolbox') {
    await populated(page.getByRole('complementary', { name: 'Tools and agents', exact: true }));
    const minimized = page.getByRole('button', { name: 'Expand toolbox', exact: true });
    if (await minimized.isVisible()) await press(minimized);
    const mcp = page.locator('.md-server').filter({ has: page.locator('[data-mcp-server]') }).first();
    await visible(mcp);
    if (!await mcp.evaluate(el => (el as HTMLDetailsElement).open)) await press(mcp.locator(':scope > summary'));
    await populated(mcp.locator('[data-mcp-tool]').first());
    await visible(page.locator('.md-agents'));
    if (!await page.locator('.md-agents').evaluate(el => (el as HTMLDetailsElement).open)) await press(page.locator('.md-agents > summary'));
    return 'material';
  }
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
    await populated(page.locator('dialog.file-workspace .code').first());
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
  } else if (surface === 'git') {
    await press(desk.getByRole('button', { name: 'Back to agent', exact: true }));
    await press(page.getByRole('button', { name: 'Git', exact: true }));
    await press(page.getByRole('button', { name: 'Git review', exact: true }));
    const review = page.getByRole('dialog', { name: 'Git review', exact: true }); await visible(review);
    const approve = review.getByRole('button', { name: 'Approve read-only Git', exact: true });
    await approve.or(review.getByRole('button', { name: 'Refresh changes', exact: true })).waitFor({ state: 'visible' });
    if (await approve.isVisible()) await press(approve);
    await populated(review.locator('.unified-change').first());
  } else throw new Error('Unknown required surface');
  return 'material';
}
export async function captureSurfaces(browser: Browser, server: Server, cases: GuardCase[], negative: boolean,
  save: (name: string, bytes: Buffer, kind: string) => Promise<void>) {
  for (const c of cases) for (const palette of contract.palettes) for (const width of contract.widths) for (const surface of contract.surfaces) {
    const name = `${c.id}-${palette}-${width}-${surface}`;
    if (negative && name !== contract.negativeTarget) continue;
    const context = await browser.newContext({ viewport: { width, height: contract.height }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(10_000);
    const pending = new Set<unknown>(); const errors: string[] = [];
    page.on('request', r => { if (r.url().includes('/v1/') && new URL(r.url()).pathname !== '/v1/changes') pending.add(r); });
    page.on('requestfinished', r => pending.delete(r)); page.on('requestfailed', r => { pending.delete(r); errors.push('request failed'); });
    page.on('pageerror', () => errors.push('page error'));
    page.on('response', r => { if (r.status() >= 400) errors.push('HTTP failure'); });
    try {
      await page.clock.setFixedTime(new Date(contract.frozenTime));
      await context.addInitScript(() => {
        localStorage.setItem('drishya.motion', '0'); localStorage.setItem('drishya.mapOrbit', 'false'); localStorage.setItem('drishya.hoverReading', '0');
      });
      await page.goto(server.launchUrl); await visible(page.locator('.mh-home'));
      await settled(page, pending);
      if (surface !== 'home') {
        const query = c.id === 'demo' ? '?demo&experience=modern&motion=0' : '?experience=modern&motion=0';
        await page.goto(`${server.url}/${query}${c.recording ? '#/r/' + encodeURIComponent(c.recording) : ''}`);
        await visible(page.locator('.history'));
      }
      await page.evaluate(value => { document.documentElement.dataset.palette = value; }, palette);
      const kind = await prepare(page, c, surface);
      await page.mouse.move(0, 0);
      await settled(page, pending);
      requireCase(errors.length === 0, 'Page or material request failed');
      if (negative) await page.addStyleTag({ content: contract.negativeStyle });
      const bytes = await page.screenshot({ animations: 'disabled', caret: 'hide', type: 'png' });
      await save(name, bytes, kind);
    } finally { await context.close(); }
  }
}


