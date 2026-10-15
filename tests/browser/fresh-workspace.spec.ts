import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, root: string, app: App, server: RunningServer;
const ids: Record<string, string> = {};
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-fresh-')); root = join(dir, 'shop');
  cpSync(resolve('fixtures/synthetic/workspace/shop'), root, { recursive: true });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true });
  git('init'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  git('add', '.'); git('commit', '-m', 'synthetic workspace');
  writeFileSync(join(root, 'src/cart/total.ts'), 'export const total = 42;\n');
  app = new App(join(dir, 'store'));
  for (const [adapter, fixture] of [['claude-code', 'claude/checkout-fix.jsonl'], ['codex', 'codex/rollout-checkout-review.jsonl']]) {
    const source = join(dir, `${adapter}.jsonl`);
    writeFileSync(source, readFileSync(resolve(`fixtures/synthetic/${fixture}`), 'utf8').replaceAll('/home/dev/shop', root.replaceAll('\\', '/')));
    ids[adapter!] = (await app.ingest.importSource(adapter!, source)).recordingId;
  }
  server = await startServer({ app, port: 0, token: 'synthetic-independent-design' });
});
test.afterAll(async () => {
  if (server) await server.close(); if (app) await app.close();
  if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory'); rmSync(dir, { recursive: true, force: true }); }
});

test('independent frontend authenticates without loading Classic and survives reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server.url}/?experience=fresh#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await expect(page.getByText('Free orders reach checkout', { exact: true }).first()).toBeVisible();
  await expect(page).not.toHaveURL(/token=/);
  expect(await page.evaluate(() => document.querySelectorAll('.workspace-header, .product-shell').length)).toBe(0);
  expect(await page.evaluate(() => [...document.styleSheets].some(sheet => {
    try { return [...sheet.cssRules].some(rule => rule.cssText.includes('.workspace-header')); } catch { return false; }
  }))).toBe(false);
  await page.reload(); await expect(page.locator('.fresh-app')).toBeVisible();
  await expect(page.getByText('Free orders reach checkout', { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

for (const adapter of ['claude-code', 'codex']) test(`fresh ${adapter}: actual imported history opens through a direct link`, async ({ page }) => {
  await page.goto(`${server.url}/?experience=fresh#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await page.goto(`${server.url}/?experience=fresh#/r/${ids[adapter]}`);
  await expect(page.getByRole('region', { name: 'Captured work', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Captured work', exact: true })).toContainText(/checkout|discount|total/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('fresh native submission requires consent and a new idle acknowledgement for each turn', async ({ page }) => {
  const native = { available: true, state: 'idle', harness: 'codex', tools: [], inventory: 'unknown', approvals: [], output: '' };
  let submissions = 0;
  await page.route('**/controller', route => route.fulfill({ json: native }));
  await page.route('**/controller/prompt', async route => {
    const body = route.request().postDataJSON();
    expect(body.exclusive).toBe(true); expect(body.prompt).toBe('Inspect the checkout condition');
    submissions++; await route.fulfill({ json: { ...native, state: 'completed', runId: 'synthetic-turn' } });
  });
  await page.goto(`${server.url}/?experience=fresh#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await page.goto(`${server.url}/?experience=fresh#/r/${ids.codex}`);
  await page.getByRole('textbox', { name: 'Prompt to native agent' }).fill('Inspect the checkout condition');
  const send = page.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeDisabled();
  await page.getByRole('button', { name: 'Connection & permissions' }).click();
  const grant = page.getByRole('button', { name: 'Allow workspace access', exact: true });
  if (await grant.isVisible()) await grant.click();
  const idle = page.getByRole('checkbox', { name: 'This session is idle in its other clients' });
  await idle.check(); await expect(send).toBeEnabled(); await send.click();
  await expect(idle).not.toBeChecked(); expect(submissions).toBe(1);
  await page.getByRole('textbox', { name: 'Prompt to native agent' }).fill('Inspect the checkout condition');
  await expect(send).toBeDisabled(); await idle.check(); await send.click();
  await expect(idle).not.toBeChecked(); expect(submissions).toBe(2);
  await page.getByRole('heading', { level: 1 }).click();
  await expect(idle).toHaveCount(0);
  const details = page.getByRole('button', { name: 'Connection & permissions' });
  await details.click();
  await page.keyboard.press('Escape');
  await expect(details).toBeFocused();
  await expect(idle).toHaveCount(0);
});

test('fresh captured material is readable and local action questions survive reopening', async ({ page }) => {
  await page.goto(`${server.url}/?experience=fresh#token=${server.token}`);
  await expect(page.getByText('Free orders reach checkout', { exact: true }).first()).toBeVisible();
  await page.goto(`${server.url}/?experience=fresh#/r/${ids['claude-code']}`);
  await page.locator('.fr-action-read').first().click();
  const inspector = page.locator('.fr-inspector');
  await expect(inspector.locator('.fr-code-material').first()).toContainText(/export|function|const/);
  const draft = inspector.getByRole('textbox', { name: 'Ask a question about this action' });
  await draft.fill('Why was the total condition selected?');
  await inspector.getByRole('button', { name: 'Save question' }).click();
  await expect(inspector.getByText('Why was the total condition selected?', { exact: true })).toBeVisible();
  await inspector.getByRole('button', { name: 'Mark resolved' }).click();
  await expect(inspector.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
  await inspector.getByRole('button', { name: 'Close inspector' }).click();
  await page.locator('.fr-action-read').first().click();
  await expect(inspector.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
});

test('fresh current Git handoff refuses a patch that changed after review', async ({ page }) => {
  await page.goto(`${server.url}/?experience=fresh#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await page.goto(`${server.url}/?experience=fresh#/r/${ids.codex}`);
  await page.getByRole('button', { name: 'Git review', exact: true }).click();
  const allowRoot = page.getByRole('button', { name: 'Allow this workspace', exact: true });
  const allowGit = page.getByRole('button', { name: 'Allow read-only Git', exact: true });
  const refresh = page.getByRole('button', { name: 'Refresh snapshot', exact: true });
  await expect(allowRoot.or(allowGit).or(refresh)).toBeVisible();
  // Saved consent may resolve between the visibility check and Playwright's click.
  if (await allowRoot.isVisible()) await allowRoot.or(allowGit).or(refresh).click();
  await expect(allowGit.or(refresh)).toBeVisible();
  if (await allowGit.isVisible()) await allowGit.or(refresh).click();
  await expect(page.getByRole('region', { name: 'Current Git patch' })).toContainText('total = 42');
  await page.getByRole('checkbox', { name: 'Reviewed displayed patch' }).check();
  await page.getByRole('textbox', { name: 'Local Git review note' }).fill('Checked total');
  await page.getByRole('button', { name: 'Preview handoff', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Git handoff preview' })).toHaveValue(/Checked total/);
  writeFileSync(join(root, 'src/cart/total.ts'), 'export const total = 43;\n');
  await page.getByRole('button', { name: 'Save checked handoff' }).click();
  await expect(page.getByRole('alert')).toContainText('Repository changed');
  await expect(page.getByRole('region', { name: 'Current Git patch' })).toContainText('total = 43');
  await expect(page.getByRole('textbox', { name: 'Git handoff preview' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Reviewed displayed patch' })).not.toBeChecked();
});

test('fresh backward replay removes completed output and scopes file activity to the replay point', async ({ page }) => {
  const id = ids['claude-code']!;
  const full = app.projection(id);
  const operation = full.operations.find(op => op.kind === 'read' && op.detail.kind === 'read' && op.detail.excerptArtifactId)!;
  const step = operation.startSequence + 1;
  const before = await app.history.page(id, { step, selectedOperationId: operation.id });
  const pending = before.projection.operations.find(op => op.id === operation.id)!;
  expect(pending.detail.kind === 'read' && pending.detail.excerptArtifactId).toBeFalsy();
  await page.goto(`${server.url}/?experience=fresh#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await page.goto(`${server.url}/?experience=fresh#/r/${id}`);
  const card = page.locator('.fr-action-read').filter({ has: page.getByTitle(operation.title, { exact: true }) }).first();
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.fr-action-material pre')).toBeVisible();
  await card.click();
  await page.getByText('Sequence replay', { exact: true }).click();
  const historyRequests: Record<string, unknown>[] = [];
  page.on('request', request => { if (request.url().endsWith('/history') && request.method() === 'POST') historyRequests.push(request.postDataJSON()); });
  const range = page.getByRole('slider', { name: 'Replay position' });
  await range.focus(); await range.press('Home');
  for (let n = 0; n < step; n++) await range.press('ArrowRight');
  await expect(range).toHaveValue(String(step));
  // A pending read's derived title has no completed range yet.
  const pendingCard = page.locator('.fr-action-read').filter({ has: page.getByTitle(pending.title, { exact: true }) }).first();
  await expect(pendingCard).toBeVisible();
  await expect(pendingCard.locator('.fr-action-material pre')).toHaveCount(0);
  expect(historyRequests.at(-1)?.step).toBe(step);
  expect(historyRequests.at(-1)?.observationId).toBeUndefined();
  const path = operation.paths[0]!.path;
  const file = page.locator('.fr-file-tree button').filter({ has: page.getByText(path.split('/').at(-1)!, { exact: true }) }).first();
  const response = page.waitForResponse(r => r.url().includes('/file-operations?') && r.url().includes(`step=${step}`));
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find repository file' }).fill(path);
  await file.click();
  expect((await (await response).json()).operations.every((op: { startSequence: number }) => op.startSequence < step)).toBe(true);
});

test('fresh reading has useful height and stays within desktop, phone and landscape bounds', async ({ page }) => {
  await page.goto(`${server.url}/?experience=fresh#token=${server.token}`);
  await expect(page.getByText('Free orders reach checkout', { exact: true }).first()).toBeVisible();
  await page.goto(`${server.url}/?experience=fresh#/r/${ids.codex}`);
  const content = page.getByRole('region', { name: 'Captured work', exact: true });
  for (const [width, height] of [[1440,900], [1280,720], [390,844], [844,390]]) {
    await page.setViewportSize({ width, height }); await expect(content).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = (await content.boundingBox())!;
    expect(bounds.height).toBeGreaterThan(height < 500 ? 70 : height * .32);
    const prompt = (await page.getByRole('textbox', { name: 'Prompt to native agent' }).boundingBox())!;
    expect(prompt.y + prompt.height).toBeLessThanOrEqual(height);
    expect(prompt.width).toBeLessThanOrEqual(width);
  }
});

test('UI versions switch between Modern and Legacy while keeping the actual session', async ({ page }) => {
  await page.goto(`${server.url}/?experience=fresh#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await page.goto(`${server.url}/?experience=fresh#/r/${ids.codex}`);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await page.getByRole('button', { name: /^Legacy/ }).click();
  await expect(page).toHaveURL(new RegExp(`experience=classic.*${ids.codex}`));
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await page.getByRole('button', { name: /^Modern/ }).click();
  await expect(page.getByRole('region', { name: 'Captured work', exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`experience=modern.*${ids.codex}`));
  await page.goto(`${server.url}/#/r/${ids.codex}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
});

test('Modern keeps work in place when Files opens and reaches nested paths by search', async ({ page }) => {
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.md-library')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids.codex}`);
  const work = page.getByRole('region', { name: 'Captured work', exact: true });
  await expect(work).toBeVisible();
  const before = (await work.boundingBox())!;
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  const after = (await work.boundingBox())!;
  expect(after.x).toBe(before.x); expect(after.width).toBe(before.width);
  await page.getByRole('textbox', { name: 'Find repository file' }).fill('src/cart/total.ts');
  await page.getByRole('button', { name: 'TS total.ts', exact: true }).click();
  await expect(page.locator('.fr-inspector h2')).toHaveText('total.ts');
  await expect(page.locator('.fr-provenance-current')).toContainText('Current workspace');
});

test('Modern long prose keeps headings, paragraphs and lists in readable vertical flow', async ({ page }) => {
  await page.route('**/history', async route => {
    const response = await route.fetch(); const body = await response.json();
    for (const prose of body.projection.prose) prose.text = '# Review the change\n\nA complete paragraph about the captured source and its checks.\n\n- Read the actual input\n- Inspect the recorded result\n\nAnother paragraph remains below the list, with **emphasis** and `source.ts`.';
    await route.fulfill({ response, json: body });
  });
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.md-library')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids.codex}`);
  const prose = page.locator('.md-prose-content').first();
  await expect(prose.getByRole('heading')).toHaveText('Review the change');
  const bounds = await prose.evaluate(element => [...element.children].map(child => ({ width: child.getBoundingClientRect().width, y: child.getBoundingClientRect().y })));
  expect(bounds.length).toBe(4);
  expect(bounds.every(b => b.width > 150)).toBe(true);
  expect(bounds.every((b, i) => i === 0 || b.y > bounds[i - 1]!.y)).toBe(true);
});

test('Modern map explores actual files with keyboard controls and maintains readable bounds', async ({ page }) => {
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.md-library')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids.codex}`);
  await page.getByRole('button', { name: 'Repository', exact: true }).click();
  const map = page.locator('.md-map');
  await expect(map.locator('.md-map-point').first()).toBeVisible();
  await map.getByRole('button', { name: 'Zoom in', exact: true }).press('Enter');
  await expect(map.locator('.md-map-controls')).toContainText('140%');
  await map.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(map.locator('.md-map-controls')).toContainText('100%');
  await page.getByRole('textbox', { name: 'Find on repository map' }).fill('total.ts');
  await map.getByRole('button', { name: 'src/cart/total.ts', exact: true }).click();
  await expect(page.locator('.fr-inspector h2')).toHaveText('total.ts');
  await page.getByRole('button', { name: 'Close inspector' }).click();
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await expect(map.getByRole('button', { name: 'Fit', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('Modern header reading enlarges one material, preserves history and returns from its current geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.md-library')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids['claude-code']}`);
  const stream = page.getByRole('region', { name: 'Captured work', exact: true });
  await expect(page.locator('.md-action-slot').first()).toBeVisible();
  await stream.press('Control+Home');
  const card = page.locator('.fr-action').first();
  const header = card.locator('.fr-action-type');
  await expect(card.locator('.fr-action-material')).toContainText('import type { Cart }');
  await expect.poll(() => card.evaluate(e => e.getAnimations().length)).toBe(0);
  const before = await card.boundingBox();
  const count = await page.locator('.fr-action').count();
  const history = await stream.evaluate(e => ({ height: e.scrollHeight, top: e.scrollTop }));
  await header.hover();
  await expect(card).toHaveAttribute('data-reading', 'open');
  await expect.poll(async () => (await card.boundingBox())!.width).toBeGreaterThan(before!.width + 30);
  await expect.poll(() => card.evaluate(e => e.getAnimations().length)).toBe(0);
  expect(await page.locator('.fr-action').count()).toBe(count);
  expect(await stream.evaluate(e => e.scrollHeight)).toBe(history.height);
  const opened = await card.boundingBox();
  const slotBefore = await card.locator('..').boundingBox();
  await stream.evaluate(e => e.scrollTop += 35);
  const moved = await card.boundingBox();
  expect(Math.abs(moved!.y - opened!.y + 35)).toBeLessThan(2);
  expect((await card.locator('..').boundingBox())!.height).toBe(slotBefore!.height);
  await page.keyboard.press('Escape');
  await expect(card).not.toHaveAttribute('data-reading');
  expect(Math.abs((await card.boundingBox())!.width - before!.width)).toBeLessThan(2);
  await header.hover();
  await expect(card).toHaveAttribute('data-reading', 'open');
  await page.mouse.move(5, 5);
  await expect(card).not.toHaveAttribute('data-reading');
  expect(Math.abs((await card.boundingBox())!.height - before!.height)).toBeLessThan(3);
});

test('Modern keeps every projected patch line and uses local fonts and distinct syntax', async ({ page }) => {
  await page.route('**/history', async route => {
    const response = await route.fetch(), body = await response.json();
    for (const op of body.projection.operations) if (op.detail.kind === 'edit') {
      op.detail.hunks = [{ oldStart: 1, oldLines: 0, newStart: 1, newLines: 50,
        lines: Array.from({ length: 50 }, (_, i) => `+const captured_${i} = make(${i}, "literal ${i}");`) }];
    }
    await route.fulfill({ response, json: body });
  });
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.md-library')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids['claude-code']}`);
  const patch = page.locator('.md-patch-preview').first();
  await expect(patch).toContainText('captured_49');
  expect(await patch.locator('code').count()).toBe(50);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator('.md-app').evaluate(e => getComputedStyle(e).fontFamily)).toContain('ModernSans');
  const colors = await patch.evaluate(e => ['keyword', 'number', 'string'].map(k => getComputedStyle(e.querySelector(`.fr-syntax-${k}`)!).color));
  expect(new Set(colors).size).toBe(3);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('region', { name: 'Captured work', exact: true }).press('Control+Home');
  const first = page.locator('.fr-action').first();
  await first.locator('.fr-action-type').hover();
  await expect(first).toHaveAttribute('data-reading', 'open');
  expect(await first.evaluate(e => e.getAnimations().length)).toBe(0);
});

test('Modern MCP uses the same header reader and local wheel without blocking history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/history', async route => {
    const response = await route.fetch(), body = await response.json();
    const op = body.projection.operations[0];
    op.kind = 'mcp'; op.tool = 'lookup'; op.title = 'Lookup captured records';
    op.detail = { kind: 'mcp', server: 'synthetic-server', tool: 'lookup', input: { query: 'records' }, resultPreview: Array.from({ length: 90 }, (_, i) => `Captured row ${i}`).join('\n') };
    await route.fulfill({ response, json: body });
  });
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.md-library')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids['claude-code']}`);
  const stream = page.getByRole('region', { name: 'Captured work', exact: true });
  await stream.press('Control+Home');
  const card = page.locator('.fr-action-mcp').first();
  await card.locator('.fr-action-type').hover();
  await expect(card).toHaveAttribute('data-reading', 'open');
  await expect.poll(() => card.evaluate(e => e.getAnimations().length)).toBe(0);
  const body = card.locator('.md-material-body');
  await body.hover();
  const scrollBefore = await stream.evaluate(e => e.scrollTop);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => body.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
  expect(await stream.evaluate(e => e.scrollTop)).toBe(scrollBefore);
  await expect(card).toHaveAttribute('data-reading', 'open');
  await body.evaluate(e => e.scrollTop = e.scrollHeight);
  await page.mouse.wheel(0, 30);
  await expect.poll(() => stream.evaluate(e => e.scrollTop)).toBeGreaterThan(scrollBefore);
  await expect(card).toHaveAttribute('data-reading', 'open');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card).not.toHaveAttribute('data-reading');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Modern keeps text drafts per session across navigation, but never across a reload', async ({ page }) => {
  await page.route('**/v1/recordings', async route => {
    const response = await route.fetch(), body = await response.json();
    for (const recording of body.recordings) recording.workspaceRoot = root;
    await route.fulfill({ response, json: body });
  });
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  const sessions = page.locator('.md-session-card');
  await expect(sessions).toHaveCount(2);
  const title = await sessions.first().locator('h3').innerText();
  await sessions.first().click();
  const prompt = page.getByRole('textbox', { name: 'Prompt to native agent' });
  await prompt.fill('My unsent, private review question');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  await expect(prompt).toHaveValue('My unsent, private review question');
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await sessions.filter({ hasNotText: title }).click();
  await expect(prompt).toHaveValue('');
  await prompt.fill('Different session draft');
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await sessions.filter({ hasText: title }).click();
  await expect(prompt).toHaveValue('My unsent, private review question');
  await page.reload();
  await expect(prompt).toHaveValue('');
});


test('Modern map failure leaves workspace and native connection usable', async ({ page }) => {
  await page.route('**/graph', route => route.fulfill({ status: 503, json: { error: 'Map temporarily unavailable' } }));
  await page.route('**/controller', route => route.fulfill({ json: { available: true, state: 'idle', harness: 'codex', tools: [], inventory: 'unknown', approvals: [], output: '' } }));
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids['codex']}`);
  await expect(page.getByRole('region', { name: 'Captured work', exact: true })).toContainText(/checkout|total/);
  await expect(page.locator('.fr-composer-top')).toContainText('Continue with Codex');
  await expect(page.getByRole('alert')).toContainText('Repository map');
});

test('Modern tool focus sends the operation kind and combines agent focus', async ({ page }) => {
  const filters: unknown[] = [];
  await page.route('**/history', async route => { filters.push(route.request().postDataJSON().filter); await route.continue(); });
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids['codex']}`);
  const tool = page.locator('.md-tool-list button').first();
  await expect(tool).toBeVisible();
  const kind = await tool.getAttribute('data-fr-kind');
  await tool.click();
  await expect.poll(() => filters.at(-1)).toEqual({ kind });
  await expect(tool).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.md-agents summary').click();
  await page.locator('.md-agent').first().click();
  await expect.poll(() => filters.at(-1)).toMatchObject({ kind, agentId: expect.any(String) });
  await tool.click();
  await expect.poll(() => filters.at(-1)).toEqual({ agentId: expect.any(String) });
});

test('Modern search clears stale matches and pending status on an empty query', async ({ page }) => {
  await page.route('**/search?*', async route => {
    if (new URL(route.request().url()).searchParams.get('q') === 'first') await route.fulfill({ json: { hits: [{ id: 'first', snippet: 'First query evidence' }] } });
    else { await new Promise(resolve => setTimeout(resolve, 500)); await route.fulfill({ json: { hits: [{ id: 'late', snippet: 'Late query evidence' }] } }); }
  });
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids['codex']}`);
  await page.getByRole('button', { name: /Find evidence/ }).click();
  const query = page.getByRole('textbox', { name: 'Search captured evidence', exact: true });
  await query.fill('first'); await expect(page.getByText('First query evidence')).toBeVisible();
  await query.fill('second'); await expect(page.getByText('First query evidence')).toHaveCount(0);
  await expect(page.getByText('Searching captured evidence…')).toBeVisible();
  await query.fill('');
  await expect(page.getByText('Search commands, tool output, code excerpts, and exposed prose.')).toBeVisible();
  await expect(page.getByText('Late query evidence')).toHaveCount(0);
});


test('Modern presentation switches persist and govern actual materials', async ({ page }) => {
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.fresh-app')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${ids['codex']}`);
  await page.locator('.md-settings-button').click();
  for (const name of ['Material motion', 'Enlarge on header hover', 'Repository backdrop']) await page.getByRole('switch', { name: new RegExp(name) }).uncheck();
  await page.getByRole('switch', { name: /Compact spacing/ }).check();
  await page.locator('.md-work-button').click();
  await expect(page.locator('.fr-action').first()).toBeVisible();
  await expect(page.locator('.md-app')).toHaveAttribute('data-motion', 'off');
  await expect(page.locator('.md-app')).toHaveAttribute('data-density', 'compact');
  await expect(page.locator('.md-topology')).toHaveCount(0);
  await page.locator('.fr-action-type').first().hover();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-reading=open]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.md-app')).toHaveAttribute('data-hover-reading', 'off');
  await page.locator('.md-settings-button').click();
  await expect(page.getByRole('switch', { name: /Material motion/ })).not.toBeChecked();
});


test('Modern browser Back restores session views and invalid routes stay safe', async ({ page }) => {
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.md-session-card').first()).toBeVisible();
  await page.locator('.md-session-card').first().click();
  await expect(page.getByRole('region', { name: 'Captured work', exact: true })).toBeVisible();
  const workspaceUrl = page.url();
  await page.locator('.md-settings-button').click(); await expect(page).toHaveURL(/\/settings$/);
  await page.goBack(); await expect(page).toHaveURL(workspaceUrl);
  await expect(page.getByRole('region', { name: 'Captured work', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Git review', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/); await page.reload();
  await expect(page.locator('.fr-git-view')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/%ZZ`);
  await expect(page.getByRole('heading', { name: 'The work, in view.' })).toBeVisible();
});

test('Modern discovery opens above long libraries and searches every local source', async ({ page }) => {
  await page.route('**/sources', route => route.fulfill({ json: { sources: Array.from({ length: 85 }, (_, i) => ({ adapterId: 'codex', harness: 'codex', path: `/local/source-${i}`, title: `Local task ${i}`, cwd: '/project' })), errors: [] } }));
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.md-session-card').first()).toBeVisible();
  await page.getByRole('button', { name: /Connect session/ }).click();
  const discovery = page.getByRole('dialog', { name: 'Connect a session' });
  await expect(discovery).toBeVisible();
  await expect(discovery.locator('.md-source-row')).toHaveCount(40);
  await discovery.getByRole('textbox', { name: 'Find local session' }).fill('Local task 84');
  await expect(discovery.locator('.md-source-row')).toHaveCount(1);
  await expect(discovery).toContainText('Local task 84');
  await page.keyboard.press('Escape'); await expect(discovery).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Connect session/ })).toBeFocused();
  await page.keyboard.press('/'); await expect(page.getByRole('textbox', { name: 'Filter sessions' })).toBeFocused();
});
