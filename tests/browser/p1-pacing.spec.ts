import { randomUUID } from 'node:crypto';
import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string;
let journal: string;
let app: App;
let server: RunningServer;
let recordingId: string;
const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', version: '2.1.0', timestamp: '2026-10-05T12:00:00.000Z' };
const append = (row: object) => appendFileSync(journal, JSON.stringify({ ...base, uuid: randomUUID(), ...row }) + '\n');

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-p1-pacing-'));
  journal = join(dir, 'session.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  app = new App(join(dir, 'data'));
  recordingId = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-pacing-test' });
  app.ingest.startLive(recordingId);
});

test.afterAll(async () => {
  if (server) await server.close();
  if (app) await app.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('refusing to remove a directory outside temp');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the tool request is visible before its result and remains beside it', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await expect(page.locator('.origins')).toBeAttached();
  await page.evaluate(() => {
    const observed: string[] = [];
    (window as unknown as { p1Moves: string[] }).p1Moves = observed;
    new MutationObserver((changes) => {
      for (const change of changes) for (const node of change.addedNodes) {
        if (node instanceof Element && node.getAttribute('data-move')) observed.push(node.getAttribute('data-move')!);
      }
    }).observe(document.querySelector('.origins')!, { childList: true });
  });
  const id = 'p1-separate-result';
  append({ type: 'assistant', message: { id: `msg-${id}`, role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: 'printf drishya-live-input' } }] } });
  await app.ingest.sync(recordingId);
  const operation = page.locator('article.op-shell').filter({ hasText: 'drishya-live-input' }).last();
  await expect(operation).toBeVisible();
  await expect(operation).toContainText('Waiting for output');
  await expect(operation.locator('.state-running')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Moves: string[] }).p1Moves)).toContain('Emit');

  append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'drishya-live-output' }] } });
  await app.ingest.sync(recordingId);
  await expect(operation).toContainText('drishya-live-output');
  await expect(operation).toContainText('drishya-live-input');
  await expect(operation.locator('.state-running')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Moves: string[] }).p1Moves)).toContain('Resolve');
  append({ type: 'assistant', message: { id: 'p1-captured-explanation', role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: 'The captured command returned its output. Now reading the guard.' }] } });
  await app.ingest.sync(recordingId);
  await expect(page.locator('.prose').last()).toContainText('Now reading the guard');
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Moves: string[] }).p1Moves)).toContain('Surface');
  append({ type: 'assistant', message: { id: 'p1-next-read', role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id: 'p1-next-read', name: 'Read', input: { file_path: '/home/dev/shop/src/checkout/guard.ts', offset: 1, limit: 3 } }] } });
  await app.ingest.sync(recordingId);
  await expect(page.locator('article.op-read').last()).toContainText('captured excerpt');
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Moves: string[] }).p1Moves)).toContain('Lift');
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Moves: string[] }).p1Moves)).toContain('Settle');
  await expect.poll(() => page.locator('.origins').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test('patch layouts retain captured changes and adapt without overflowing a narrow screen', async ({ page }) => {
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(demo.href);
  const edit = page.locator('article.op-edit').last();
  await edit.getByRole('button', { name: /Expand/ }).click();
  await edit.getByRole('button', { name: 'Side by side' }).click();
  await expect(edit.locator('.split-change')).toBeVisible();
  await expect(edit.locator('.split-change')).toContainText('still blocks a cart whose total is missing');
  await expect(edit.locator('.split-change')).toContainText('columns aligned by patch order');
  await edit.getByRole('button', { name: 'Unified', exact: true }).click();
  await expect(edit.locator('.unified-change')).toBeVisible();
  await expect(edit.locator('.split-change')).toBeHidden();
  await edit.getByRole('button', { name: 'Adaptive', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(edit.locator('.unified-change')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('terminal folding is reversible and keyboard map search targets a real file', async ({ page }) => {
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  const shell = page.locator('article.op-shell');
  await shell.getByRole('button', { name: /captured lines between/ }).click();
  await expect(shell).toContainText('missing-total');
  await shell.getByRole('button', { name: 'Fold captured preview' }).click();
  await expect(shell.getByRole('button', { name: /captured lines between/ })).toBeVisible();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a file on the map' }).fill('checkout/guard');
  const match = page.locator('.map-matches').getByRole('button', { name: 'src/checkout/guard.ts', exact: true });
  await match.focus();
  await match.press('Enter');
  await expect(page.locator('.map-tip-path')).toHaveText('src/checkout/guard.ts');
  await page.getByRole('button', { name: 'Open recorded work on this file' }).click();
  await expect(page.locator('.file-panel')).toContainText('guard.ts');
});

test('reduced motion keeps captured history and suppresses relationship animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  await expect(page.locator('article.op-edit').last()).toBeVisible();
  await expect(page.locator('.origins')).toBeHidden();
  expect(await page.locator('.origins').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test('file relationships start at measured renderer nodes and fall back when the map is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Synthetic fixture placement exposes one real rendered node in the reading margin.
  // The application does not move or invent a node to make a tether possible.
  await page.route('**/demo/bundle.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    const node = bundle.graph.nodes.find((node: { path: string }) => node.path === 'test/checkout.test.ts');
    node.x = .95; node.y = .96;
    await route.fulfill({ response, json: bundle });
  });
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  const edit = page.locator('article.op-edit').last();
  await edit.hover();
  const tether = page.locator('.origin-thread[data-origin-type="Repository node"]');
  await expect(tether).toHaveCount(1);
  const point = (await page.locator('.map [data-origin-file="test/checkout.test.ts"]').boundingBox())!;
  const coordinates = (await tether.getAttribute('d'))!.match(/^M([\d.-]+),([\d.-]+)/)!;
  const renderer = await tether.getAttribute('data-origin-renderer');
  const measured = renderer === 'overview' ? (await page.locator('.repo-lens [data-origin-file="test/checkout.test.ts"]').boundingBox())! : point;
  expect(Number(coordinates[1])).toBeCloseTo(measured.x + measured.width / 2, 0);
  expect(Number(coordinates[2])).toBeCloseTo(measured.y + measured.height / 2, 0);
  // Occlusion must switch to another real view of the node, not draw through the reader.
  await page.evaluate((point) => {
    const cover = document.createElement('div'); cover.className = 'inspector'; cover.id = 'synthetic-origin-cover';
    Object.assign(cover.style, { position: 'fixed', animation: 'none', transform: 'none', zIndex: '1000', left: `${point.x - 4}px`, top: `${point.y - 4}px`, width: '16px', height: '16px' });
    document.body.append(cover);
  }, point);
  await page.mouse.move(0, 0); await edit.hover();
  await expect(tether).toHaveAttribute('data-origin-renderer', 'overview');
  const overview = (await page.locator('.repo-lens [data-origin-file="test/checkout.test.ts"]').boundingBox())!;
  const overviewCoordinates = (await tether.getAttribute('d'))!.match(/^M([\d.-]+),([\d.-]+)/)!;
  expect(Number(overviewCoordinates[1])).toBeCloseTo(overview.x + overview.width / 2, 0);
  expect(Number(overviewCoordinates[2])).toBeCloseTo(overview.y + overview.height / 2, 0);
  await page.evaluate(() => document.getElementById('synthetic-origin-cover')!.remove());
  await page.getByRole('button', { name: 'Map on', exact: true }).click();
  await edit.hover();
  await expect(page.locator('.origin-thread[data-origin-type="Repository node"]')).toHaveCount(0);
  await expect(page.locator('.origin-thread[data-origin-type="File reference"]')).toHaveCount(1);
});

test('verification marks represent recorded counts and open the captured failing assertion', async ({ page }) => {
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  await expect(page.locator('article.op-test').last().locator('.verification-group.passed i')).toHaveCount(7);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('npm test');
  await page.locator('.search-results button').first().click();
  const failed = page.locator('article.op-test.st-error');
  await expect(failed.locator('.verification-group.failed i')).toHaveCount(1);
  await failed.getByRole('button', { name: '1 failed · inspect assertions', exact: true }).click();
  await expect(failed.locator('.op-expanded')).toContainText('expected false to be true');
  await expect(failed.locator('.op-expanded .output')).toContainText('FAIL');
});

test('MCP input and captured result can be read in the history passage', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('get-library-docs');
  await page.locator('.search-results button').first().click();
  const operation = page.locator('article.op-mcp').filter({ hasText: 'get-library-docs' });
  await operation.getByRole('button', { name: /Expand/ }).click();
  await expect(operation).toContainText('context7CompatibleLibraryID');
  await expect(operation).toContainText('Captured result preview');
  await expect(operation.locator('.op-expanded .output')).not.toBeEmpty();
});

test('a burst is captured immediately without fast-forwarding the reading camera', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const steps = page.locator('.reading-status');
  const before = Number((await steps.innerText()).match(/\d+/)?.[0]);
  for (let i = 0; i < 8; i++) {
    append({ type: 'assistant', message: { id: `p1-burst-${i}`, role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: `Burst explanation ${i}: ${'captured detail '.repeat(25)}` }] } });
  }
  await app.ingest.sync(recordingId);
  await expect(steps).toContainText(`${before + 8} recorded steps`);
  await expect(page.getByRole('button', { name: /8 new steps · Back to latest/ })).toBeVisible();
  const history = page.locator('.history');
  await expect.poll(() => history.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeGreaterThan(2);
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
});

test('content gets reading width and origin tethers use the visible instrument', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  const edit = page.locator('article.op-edit').last();
  const verification = page.locator('article.op-test').last();
  await expect(edit).toBeVisible();
  const sourceWidth = (await edit.boundingBox())!.width;
  expect(sourceWidth).toBeGreaterThan(420);
  expect(sourceWidth).toBeGreaterThan((await verification.boundingBox())!.width);
  await verification.hover();
  const tether = page.locator('.origin-thread[data-origin-type="Tool instrument"]');
  await expect(tether).toHaveCount(1);
  const instrument = (await page.locator('.instrument.k-test').boundingBox())!;
  const coordinates = (await tether.getAttribute('d'))!.match(/^M([\d.-]+),([\d.-]+)/)!;
  expect(Number(coordinates[1])).toBeCloseTo(instrument.x, 0);
  expect(Number(coordinates[2])).toBeCloseTo(instrument.y + instrument.height / 2, 0);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: '.local/p1-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(edit).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('.origin-thread')).toHaveCount(0);
});

test('the dock keeps observed identities readable at rest and remains accessible on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  const dock = page.getByRole('complementary', { name: 'Tools' });
  await expect(dock).toContainText('Observed in this recording');
  await expect(dock.getByRole('button', { name: 'get-library-docs 1', exact: true })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'search_code 1', exact: true })).toBeVisible();
  expect(await dock.locator('.inst-tools').evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth + 1))).toBe(true);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('get-library-docs');
  await page.locator('.search-results button').first().click();
  await page.locator('.inspector').getByRole('button', { name: 'Close', exact: true }).click();
  const call = page.locator('article.op-mcp').filter({ hasText: 'get-library-docs' });
  await call.hover();
  const tether = page.locator('.origin-thread[data-origin-type="MCP tool"]');
  await expect(tether).toHaveCount(1);
  const tool = (await dock.locator('[data-mcp-tool="get-library-docs"]').boundingBox())!;
  const coordinates = (await tether.getAttribute('d'))!.match(/^M([\d.-]+),([\d.-]+)/)!;
  expect(Number(coordinates[1])).toBeCloseTo(tool.x, 0);
  expect(Number(coordinates[2])).toBeCloseTo(tool.y + tool.height / 2, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button', { name: 'get-library-docs 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close tools', exact: true }).click();
  await expect(dock).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('verification refreshes while reading and hides whole-recording facts during sequence replay', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('guard.ts');
  await page.locator('.search-results button').filter({ hasText: /Edit/ }).first().click();
  const panel = page.getByRole('region', { name: 'Test runs after this change' });
  await expect(panel).toContainText('Full recording');
  const id = 'p1-live-verification';
  append({ type: 'assistant', message: { id, role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: 'npm test -- p1-live-verification' } }] } });
  append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'Tests  1 passed (1)' }] } });
  await app.ingest.sync(recordingId);
  await expect(panel).toContainText('npm test -- p1-live-verification');
  await page.getByRole('button', { name: 'Replay sequence', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('guard.ts');
  await page.locator('.search-results button').filter({ hasText: /Edit/ }).first().click();
  await expect(panel).toContainText('future results are hidden');
  await expect(panel).not.toContainText('npm test -- p1-live-verification');
  await page.getByRole('button', { name: '← History', exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('guard.ts');
  await page.locator('.search-results button').filter({ hasText: /Edit/ }).first().click();
  await expect(panel).toContainText('npm test -- p1-live-verification');
});

test('sustained live reading keeps evidence, anchors and presentation bounded', async ({ page }) => {
  test.skip(process.env.DRISHYA_P1_SOAK !== '1', 'Opt-in ten-minute synthetic reader exercise');
  test.setTimeout(720_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const history = page.locator('.history');
  const steps = page.locator('.reading-status');
  const started = Date.now();
  let rounds = 0;
  let peakNodes = 0;
  while (Date.now() - started < 600_000) {
    await page.mouse.move(800, 350);
    await page.mouse.wheel(0, -120);
    await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
    const anchor = await history.evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const node = [...el.querySelectorAll<HTMLElement>('.passage-slot')].find((node) => node.getBoundingClientRect().bottom > top + 1)!;
      return { id: node.dataset.passageId, offset: node.getBoundingClientRect().top - top };
    });
    const before = Number((await steps.innerText()).match(/\d+/)?.[0]);
    const id = `p1-soak-${rounds}`;
    append({ type: 'assistant', message: { id, role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: `printf synthetic-round-${rounds}` } }] } });
    append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: `synthetic captured output ${rounds}` }] } });
    append({ type: 'assistant', message: { id: `${id}-prose`, role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: `Captured explanation for synthetic round ${rounds}.` }] } });
    await app.ingest.sync(recordingId);
    await expect(steps).toContainText(`${before + 3} recorded steps`);
    await expect.poll(() => history.evaluate((el, anchor) => {
      const node = [...el.querySelectorAll<HTMLElement>('.passage-slot')].find((node) => node.dataset.passageId === anchor.id);
      return node ? Math.abs(node.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset) : Infinity;
    }, anchor), { message: `Round ${rounds}: preserve the captured passage and reading offset` }).toBeLessThan(2);
    const nodes = await page.evaluate(() => document.querySelectorAll('*').length);
    peakNodes = Math.max(peakNodes, nodes);
    expect(nodes).toBeLessThan(2500);
    expect(await page.locator('.origins').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    await page.getByRole('button', { name: /Back to latest/ }).click();
    await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight)), { message: `Round ${rounds}: explicit return reaches the latest captured work` }).toBeLessThan(2);
    rounds++;
    await page.waitForTimeout(5000);
  }
  console.log(JSON.stringify({ p1SyntheticReader: { elapsedMs: Date.now() - started, rounds, peakNodes } }));
});
