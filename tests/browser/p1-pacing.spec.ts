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
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await expect(page.locator('.origins')).toBeAttached();
  await page.evaluate(() => {
    const observed: string[] = [];
    (window as unknown as { p1Moves: string[] }).p1Moves = observed;
    (window as unknown as { p1Materials: { move: string; width: number; height: number }[] }).p1Materials = [];
    new MutationObserver((changes) => {
      for (const change of changes) for (const node of change.addedNodes) {
        if (node instanceof Element && node.getAttribute('data-move')) observed.push(node.getAttribute('data-move')!);
        if (node instanceof Element && node.classList.contains('origin-thread')) (window as unknown as { p1Materials: { move: string; width: number; height: number }[] }).p1Materials.push({ move: node.getAttribute('data-move')!, width: document.querySelector('article.op-shell:last-of-type')?.getBoundingClientRect().width ?? 0, height: document.querySelector('article.op-shell:last-of-type')?.getBoundingClientRect().height ?? 0 });
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
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Materials: { move: string; width: number; height: number }[] }).p1Materials.some((material) => material.move === 'Emit' && material.width > 0 && material.height > 0))).toBe(true);
  expect(await operation.locator('.op-body').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);

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
  await page.locator('.folder-tree [data-spine-path="src/checkout/guard.ts"]').scrollIntoViewIfNeeded();
  append({ type: 'assistant', message: { id: 'p1-next-read', role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id: 'p1-next-read', name: 'Read', input: { file_path: '/home/dev/shop/src/checkout/guard.ts', offset: 1, limit: 3 } }] } });
  await app.ingest.sync(recordingId);
  await expect(page.locator('article.op-read').last()).toContainText('awaiting excerpt');
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Moves: string[] }).p1Moves)).toContain('Lift');
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Moves: string[] }).p1Moves)).toContain('Settle');
  await expect.poll(() => page.locator('.origins').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test('a single delayed read result keeps its request readable in a bounded material', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const id = 'p1-late-source-growth';
  append({ type: 'assistant', message: { id: `${id}-intro`, role: 'assistant', content: [{ type: 'text', text: 'Reading a captured source excerpt next.' }] } });
  append({ type: 'assistant', message: { id, role: 'assistant', content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: '/home/dev/shop/src/smooth-read.ts', offset: 1, limit: 80 } }] } });
  await app.ingest.sync(recordingId);
  const read = page.locator('article.op-read').filter({ hasText: 'smooth-read.ts' });
  await expect(read).toContainText('awaiting excerpt');
  const latest = page.getByRole('button', { name: /Back to latest/ });
  if (await latest.isVisible()) await latest.click();
  const history = page.locator('.history');
  await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  let release!: () => void;
  let requested = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/artifacts/**', async (route) => { requested = true; await gate; await route.continue(); });
  try {
    append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: Array.from({ length: 80 }, (_, n) => `const captured_line_${n} = ${n};`).join('\n') }] } });
    await app.ingest.sync(recordingId);
    await expect.poll(() => requested).toBe(true);
    const before = await history.evaluate((el) => el.scrollTop);
    await page.evaluate(() => {
      (window as unknown as { loadedSourceUnfold: boolean }).loadedSourceUnfold = false;
      new MutationObserver((changes) => {
        for (const change of changes) for (const node of change.addedNodes) {
          if (node instanceof Element && node.classList.contains('origin-shell') && node.getAttribute('data-move') === 'Lift') (window as unknown as { loadedSourceUnfold: boolean }).loadedSourceUnfold = true;
        }
      }).observe(document.querySelector('.origins')!, { childList: true });
    });
    release();
    await expect(read).toContainText('captured_line_0');
    // Compact material may fit without a camera hold. It must never hide the request
    // or jump farther than the newly allocated reading surface.
    expect(Math.abs(await history.evaluate(el => el.scrollTop) - before)).toBeLessThanOrEqual(245);
    const header = await read.locator('.op-head').boundingBox();
    const viewport = await history.boundingBox();
    expect(header!.y).toBeGreaterThanOrEqual(viewport!.y);
    expect(header!.y).toBeLessThan(viewport!.y + viewport!.height);
    expect((await read.boundingBox())!.height).toBeLessThanOrEqual(280);
    await expect.poll(() => page.evaluate(() => (window as unknown as { loadedSourceUnfold: boolean }).loadedSourceUnfold)).toBe(true);
    if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/late-source-reading.png') });
  } finally { release(); await page.unroute('**/artifacts/**'); }
});

test('actions share stable reading widths, wrap when full and restart after agent prose', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  append({ type: 'assistant', message: { id: 'row-intro', role: 'assistant', content: [{ type: 'text', text: 'Starting the synthetic row allocation check.' }] } });
  const call = (n: number) => ({ type: 'tool_use', id: `row-call-${n}`, name: 'Bash', input: { command: `printf row-allocation-${n}` } });
  append({ type: 'assistant', message: { id: 'row-first', role: 'assistant', content: [call(0)] } });
  await app.ingest.sync(recordingId);
  const first = page.locator('article.op-shell').filter({ hasText: 'row-allocation-0' });
  await expect(first).toBeAttached();
  await first.scrollIntoViewIfNeeded();
  const width = (await first.boundingBox())!.width;
  append({ type: 'assistant', message: { id: 'row-more', role: 'assistant', content: [call(1), call(2), call(3), call(4)] } });
  await app.ingest.sync(recordingId);
  const last = page.locator('article.op-shell').filter({ hasText: 'row-allocation-4' });
  await expect(last).toBeAttached();
  const boxes = await Promise.all([0, 1, 2, 3, 4].map((n) => page.locator('article.op-shell').filter({ hasText: `row-allocation-${n}` }).boundingBox()));
  expect(Math.abs(boxes[0]!.width - width)).toBeLessThan(1);
  expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(1);
  expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThan(1);
  expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x);
  expect(boxes[4]!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height);
  const passageId = await last.locator('xpath=ancestor::*[contains(@class,"passage-slot")]').getAttribute('data-passage-id');
  append({ type: 'assistant', message: { id: 'row-prose', role: 'assistant', content: [{ type: 'text', text: 'Captured reasoning punctuates this action row.' }] } });
  append({ type: 'assistant', message: { id: 'row-after-prose', role: 'assistant', content: [call(5)] } });
  await app.ingest.sync(recordingId);
  const next = page.locator('article.op-shell').filter({ hasText: 'row-allocation-5' });
  await expect(next).toBeAttached();
  expect(await next.locator('xpath=ancestor::*[contains(@class,"passage-slot")]').getAttribute('data-passage-id')).not.toBe(passageId);
  await expect(last.locator('xpath=ancestor::*[contains(@class,"passage-slot")]')).toContainText('Captured reasoning punctuates this action row.');
});

for (const interruption of ['reading', 'reduced motion'] as const) test('one real material arrival survives hover and cancels for ' + interruption, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await expect(page.locator('.origins')).toBeAttached();
  await expect.poll(() => page.locator('.history').evaluate(el => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.evaluate(() => {
    new MutationObserver(() => {
      const card = [...document.querySelectorAll<HTMLElement>('article.op-mcp')].filter(el => el.textContent?.includes('single-arrival-proof')).at(-1);
      const animation = card?.getAnimations().find(a => a.id === 'surface-Emit');
      if (!card || !animation || (window as any).retainedSurface) return;
      animation.pause(); animation.currentTime = Number(animation.effect?.getTiming().duration) * .4;
      (window as any).retainedSurface = { card, animation };
    }).observe(document.querySelector('.origins')!, { childList: true });
  });
  const id = 'single-arrival-proof-' + interruption.replaceAll(' ', '-');
  append({ type: 'assistant', message: { id, role: 'assistant', content: [{ type: 'tool_use', id, name: 'mcp__context7__get-library-docs', input: { topic: id } }] } });
  await app.ingest.sync(recordingId);
  await expect.poll(() => page.evaluate(() => !!(window as any).retainedSurface)).toBe(true);
  const operation = page.locator('article.op-mcp').filter({ hasText: id });
  await expect(page.locator('.origin-material, .origin-tool-transfer, .origin-file-transfer')).toHaveCount(0);
  await operation.dispatchEvent('mouseover');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await page.evaluate(() => (window as any).retainedSurface.animation.playState)).toBe('paused');
  if (interruption === 'reading') await page.evaluate(() => document.querySelector('.viewer')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  else await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => (window as any).retainedSurface.animation.playState)).toBe('idle');
  expect(await operation.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11)).toBe(1);
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
  // Earlier work may be outside the mounted history window after material sizes change.
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('git diff');
  await page.locator('.search-results button').first().click();
  const shell = page.locator('article.op-shell');
  await shell.getByRole('button', { name: /captured lines between/ }).click();
  await expect(shell).toContainText('missing-total');
  await shell.getByRole('button', { name: 'Fold captured preview' }).click();
  await expect(shell.getByRole('button', { name: /captured lines between/ })).toBeVisible();
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a file on the map' }).fill('checkout/guard');
  const match = page.locator('.map-matches').getByRole('button', { name: 'src/checkout/guard.ts', exact: true });
  await match.focus();
  await match.press('Enter');
  await expect(page.locator('.map-tip-path')).toHaveText('src/checkout/guard.ts');
  await page.getByRole('button', { name: 'Open recorded work on this file' }).click();
  await expect(page.locator('.file-workspace')).toContainText('guard.ts');
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
    node.x = .86; node.y = .35;
    await route.fulfill({ response, json: bundle });
  });
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  const edit = page.locator('article.op-edit').last();
  await expect.poll(async () => { const reads = await page.locator('article.op-read').count(); return reads > 0 && reads === await page.locator('article.op-read .read-preview').count(); }).toBe(true);
  await expect.poll(() => page.locator('.history').evaluate(el => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => page.locator('.history').evaluate(el => [...el.querySelectorAll('article')].flatMap(card => card.getAnimations()).filter(a => a.id.startsWith('surface-') && a.playState === 'running').length)).toBe(0);
  await expect(page.locator('.map [data-origin-file="test/checkout.test.ts"]')).toHaveAttribute('data-origin-visible', 'true');
  await page.mouse.move(0, 0);
  await edit.locator('.op-head').hover();
  const tether = page.locator('.origin-thread[data-origin-type="Repository node"]');
  await expect(tether).toHaveCount(1);
  const point = (await page.locator('.map [data-origin-file="test/checkout.test.ts"]').boundingBox())!;
  const coordinates = (await tether.getAttribute('d'))!.match(/^M([\d.-]+),([\d.-]+)/)!;
  const renderer = await tether.getAttribute('data-origin-renderer');
  const measured = renderer === 'overview' ? (await page.locator('.repo-lens [data-origin-file="test/checkout.test.ts"]').boundingBox())! : point;
  expect(Number(coordinates[1])).toBeCloseTo(measured.x + measured.width / 2, 0);
  expect(Number(coordinates[2])).toBeCloseTo(measured.y + measured.height / 2, 0);
  // Occlusion must switch to another real view of the node, not draw through the reader.
  await page.locator('.folder-tree [data-spine-path="test/checkout.test.ts"]').scrollIntoViewIfNeeded();
  await page.evaluate((point) => {
    const cover = document.createElement('div'); cover.className = 'inspector'; cover.id = 'synthetic-origin-cover';
    Object.assign(cover.style, { position: 'fixed', animation: 'none', transform: 'none', zIndex: '1000', left: `${point.x - 4}px`, top: `${point.y - 4}px`, width: '16px', height: '16px' });
    document.body.append(cover);
  }, point);
  await page.mouse.move(0, 0); await edit.hover();
  const fileReference = page.locator('.origin-thread[data-origin-type="File reference"]');
  await expect(fileReference).toHaveCount(1);
  const folder = (await page.locator('.folder-tree [data-spine-path="test/checkout.test.ts"]').boundingBox())!;
  const folderCoordinates = (await fileReference.getAttribute('d'))!.match(/^M([\d.-]+),([\d.-]+)/)!;
  expect(Number(folderCoordinates[1])).toBeCloseTo(folder.x + folder.width / 2, 0);
  expect(Number(folderCoordinates[2])).toBeCloseTo(folder.y + folder.height / 2, 0);
  await page.evaluate(() => document.getElementById('synthetic-origin-cover')!.remove());
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Repository map/ }).uncheck();
  await page.getByRole('button', { name: 'Close Workspace settings' }).click();
  // Map-off may return to the captured-path tree; make the reference visible again.
  await page.locator('.folder-tree [data-spine-path="test/checkout.test.ts"]').scrollIntoViewIfNeeded();
  await edit.locator('.op-head').hover();
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
  // End a reading gesture outside history; an explicit return must still work.
  const bounds = (await history.boundingBox())!;
  await page.mouse.move(bounds.x + 20, bounds.y + bounds.height - 20);
  await page.mouse.down();
  await page.mouse.move(10, 10);
  await page.mouse.up();
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
});

test('content gets reading width and origin tethers use the visible instrument', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  const edit = page.locator('article.op-edit').last();
  const verification = page.locator('article.op-test').last();
  await expect(verification.locator('.verification-group.passed i')).toHaveCount(7);
  await expect.poll(async () => { const reads = await page.locator('article.op-read').count(); return reads > 0 && reads === await page.locator('article.op-read .read-preview').count(); }).toBe(true);
  await expect.poll(() => page.locator('.history').evaluate(el => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => page.locator('.history').evaluate(el => [...el.querySelectorAll('article')].flatMap(card => card.getAnimations()).filter(a => a.id.startsWith('surface-') && a.playState === 'running').length)).toBe(0);
  await expect(edit).toBeVisible();
  const sourceWidth = (await edit.boundingBox())!.width;
  expect(sourceWidth).toBeGreaterThanOrEqual(280);
  expect(sourceWidth).toBeLessThanOrEqual(420);
  expect(sourceWidth).toBeGreaterThan((await verification.boundingBox())!.width);
  await page.mouse.move(0, 0);
  await verification.locator('.op-head').hover();
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
  await expect(dock).toHaveAttribute('title', /Tools observed in this recording/);
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
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
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

test('every observed action kind can arrive as a real surface without removing its evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await expect(page.locator('.origins')).toBeAttached();
  await page.evaluate(() => {
    const observed: string[] = [];
    (window as unknown as { actionSurfaces: string[] }).actionSurfaces = observed;
    new MutationObserver(() => {
      for (const card of document.querySelectorAll<HTMLElement>('article.op')) {
        if (card.getAnimations().some(animation => animation.id.startsWith('surface-'))) observed.push(card.dataset.opId!);
      }
    }).observe(document.querySelector('.origins')!, { childList: true });
  });
  const calls = [
    { name: 'Read', input: { file_path: '/home/dev/shop/src/arrival-read.ts', limit: 3 }, kind: 'read' },
    { name: 'Write', input: { file_path: '/home/dev/shop/src/arrival-write.ts', content: 'export const value = 1;' }, kind: 'write' },
    { name: 'Edit', input: { file_path: '/home/dev/shop/src/arrival-edit.ts', old_string: '1', new_string: '2' }, kind: 'edit' },
    { name: 'Grep', input: { pattern: 'arrival', path: '/home/dev/shop/src' }, kind: 'search' },
    { name: 'Bash', input: { command: 'printf synthetic-arrival' }, kind: 'shell' },
    { name: 'Bash', input: { command: 'npm test' }, kind: 'test' },
    { name: 'WebSearch', input: { query: 'synthetic arrival documentation' }, kind: 'web' },
    { name: 'Task', input: { subagent_type: 'Explore', description: 'Synthetic arrival review', prompt: 'Read the fixture only' }, kind: 'spawn' },
    { name: 'TodoWrite', input: { todos: [{ content: 'Review captured evidence', status: 'in_progress' }] }, kind: 'plan' },
    { name: 'SyntheticUnknownTool', input: { captured: 'synthetic action' }, kind: 'other' },
    { name: 'mcp__arrival__inspect', input: { fixture: 'synthetic' }, kind: 'mcp' },
  ];
  for (const [index, call] of calls.entries()) {
    const latest = page.getByRole('button', { name: /Back to latest/ });
    if (await latest.isVisible()) await latest.click();
    const id = `all-kind-arrival-${index}`;
    append({ type: 'assistant', message: { id, role: 'assistant', content: [{ type: 'tool_use', id, name: call.name, input: call.input }] } });
    await app.ingest.sync(recordingId);
    // Pin the captured identity: Write becomes an Edit material on completion,
    // and an older same-kind card can already be visible before this SSE arrives.
    const operation = page.locator(`article[data-op-id="${recordingId}.${id}"]`);
    await expect(operation).toBeVisible();
    await expect(operation).toHaveClass(new RegExp(`op-${call.kind}\\b`));
    const operationId = await operation.getAttribute('data-op-id');
    await expect.poll(() => page.evaluate(() => (window as unknown as { actionSurfaces: string[] }).actionSurfaces), { message: `${call.name}: the actual DOM surface owns a finite arrival` }).toContain(operationId);
    await operation.dispatchEvent('pointerdown');
    await operation.dispatchEvent('pointerup');
    await expect(operation).toBeVisible();
    expect(await operation.evaluate(el => el.getAnimations().some(animation => animation.id.startsWith('surface-')))).toBe(false);
    append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'Synthetic recorded completion' }] } });
    append({ type: 'assistant', message: { id: `${id}-prose`, role: 'assistant', content: [{ type: 'text', text: `Captured outcome for ${call.name}.` }] } });
    await app.ingest.sync(recordingId);
    await expect(page.locator('.prose').last()).toContainText(`Captured outcome for ${call.name}`);
  }
});

test('sustained live reading keeps evidence, anchors and presentation bounded', async ({ page }) => {
  test.skip(process.env.DRISHYA_P1_SOAK !== '1', 'Opt-in ten-minute synthetic reader exercise');
  test.setTimeout(720_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const history = page.locator('.history');
  const steps = page.locator('.reading-status');
  // Session opening is asynchronous. Do not spend the first wheel gesture on the
  // home/loading screen or before initial following has positioned the history.
  await expect(history).toBeVisible();
  await expect.poll(() => history.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  const scrollHistory = async (delta: number) => {
    const r = (await history.boundingBox())!;
    await page.mouse.move(r.x + r.width - 2, r.y + 100);
    await page.mouse.wheel(0, delta);
  };
  await scrollHistory(-100_000);
  const read = history.locator('article.op-read').first();
  await read.scrollIntoViewIfNeeded();
  await read.getByRole('button', { name: /Read excerpt of/ }).click();
  await read.locator('.source-utilities > summary').click();
  await read.getByRole('button', { name: 'Pin range', exact: true }).click();
  const pinned = page.getByRole('complementary', { name: 'Pinned source reference' });
  await expect(pinned).toBeVisible();
  const pinnedLabel = (await pinned.textContent())!;
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  const started = Date.now();
  let rounds = 0;
  let peakNodes = 0;
  while (Date.now() - started < 600_000) {
    await scrollHistory(-120);
    await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
    const folders = page.getByRole('complementary', { name: 'Session folders' });
    const folderPaths = await folders.locator('[data-spine-path]').allTextContents();
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
    await expect(pinned).toHaveText(pinnedLabel);
    expect(await folders.locator('[data-spine-path]').allTextContents()).toEqual(folderPaths);
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
