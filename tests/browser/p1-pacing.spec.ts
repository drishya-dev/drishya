import { expandCard, pointAtHistory } from './history-gestures.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
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
  expect(await operation.locator('.op-body').evaluate((el) => el.getAnimations({ subtree: true }).filter(animation => !(animation instanceof CSSTransition && animation.transitionProperty === 'scrollbar-color')).length)).toBe(0);

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
  for(const path of ['src','src/checkout']) {
    const folder=page.locator('.folder-tree').getByTitle(path,{exact:true});
    if(await folder.getAttribute('aria-expanded')!=='true')await folder.click();
  }
  await page.locator('.folder-tree [data-spine-path="src/checkout/guard.ts"]').scrollIntoViewIfNeeded();
  append({ type: 'assistant', message: { id: 'p1-next-read', role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id: 'p1-next-read', name: 'Read', input: { file_path: '/home/dev/shop/src/checkout/guard.ts', offset: 1, limit: 3 } }] } });
  await app.ingest.sync(recordingId);
  await expect(page.locator('article.op-read').last()).toContainText('awaiting excerpt');
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Moves: string[] }).p1Moves)).toContain('Lift');
  await expect.poll(() => page.evaluate(() => (window as unknown as { p1Moves: string[] }).p1Moves)).toContain('Settle');
  await expect.poll(() => page.locator('.origins').evaluate((el) => el.getAnimations({ subtree: true }).filter(animation => !(animation instanceof CSSTransition && animation.transitionProperty === 'scrollbar-color')).length)).toBe(0);
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
    // Captured text mounts before the finite transform settles. Assert the same
    // allocation ceiling once it lands, rather than a subpixel intermediate frame.
    await expect.poll(async () => (await read.boundingBox())!.height).toBeLessThanOrEqual(340);
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
  if (interruption === 'reading') await operation.getByRole('button', { name: /Expand/ }).click();
  else await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => (window as any).retainedSurface.animation.playState)).toBe('idle');
  await expect.poll(() => operation.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11)).toBe(1);
});

test('patch layouts retain captured changes and adapt without overflowing a narrow screen', async ({ page }) => {
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(demo.href);
  const edit = page.locator('article.op-edit').last();
  await expandCard(edit);
  await edit.getByRole('button', { name: 'Side by side' }).press('Enter');
  await expect(edit.locator('.split-change')).toBeVisible();
  await expect(edit.locator('.split-change')).toContainText('still blocks a cart whose total is missing');
  await expect(edit.locator('.split-change')).toContainText('columns aligned by patch order');
  await edit.getByRole('button', { name: 'Changes', exact: true }).click();
  await expect(edit.locator('.unified-change')).toBeVisible();
  await expect(edit.locator('.split-change')).toBeHidden();
  await expect(edit.getByRole('button', { name: 'Adaptive', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(edit.locator('.unified-change')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 900 });
  await edit.getByRole('button', { name: 'Open provenance and file states' }).click();
  const inspector = page.locator('.inspector');
  await expect(inspector.getByRole('button', { name: 'Changes', exact: true })).toHaveCount(1);
  await inspector.getByRole('button', { name: 'Side by side', exact: true }).click();
  await expect(inspector.locator('.split-change')).toBeVisible();
  await expect(inspector.getByRole('button', { name: /^(Before|After|Adaptive)$/ })).toHaveCount(0);
});

test('terminal folding is reversible and keyboard map search targets a real file', async ({ page }) => {
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  // Earlier work may be outside the mounted history window after material sizes change.
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('git diff');
  await page.locator('.search-results button').first().click();
  const shell = page.locator('article.op-shell');
  await expect.poll(() => shell.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
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
  await expect.poll(() => page.locator('.origins').evaluate((el) => el.getAnimations({ subtree: true }).filter(animation => !(animation instanceof CSSTransition && animation.transitionProperty === 'scrollbar-color')).length), { message: 'Finite visible arrivals settle even while Follow is off' }).toBe(0);
});

test('file relationships start at measured renderer nodes and fall back when the map is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // This fixture asserts fixed planar coordinates; orbit and reader enlargement
  // have separate tests and would deliberately move/occlude this reference.
  await page.addInitScript(() => {
    localStorage.setItem('drishya.hoverReading', '0');
    localStorage.setItem('drishya.mapDepth', 'false');
    localStorage.setItem('drishya.mapOrbit', 'false');
  });
  // Synthetic fixture placement exposes one real rendered node in the reading margin.
  // The application does not move or invent a node to make a tether possible.
  await page.route('**/demo/bundle.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    const node = bundle.graph.nodes.find((node: { path: string }) => node.path === 'test/checkout.test.ts');
    // Keep this fixed planar fixture above the settled action row, outside prose.
    // The previous .76/.35 position was covered by the card after its final reflow.
    node.x = .8; node.y = .2;
    await route.fulfill({ response, json: bundle });
  });
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  const edit = page.locator('article.op-edit').last();
  await page.evaluate(()=>document.fonts.ready);
  await expect.poll(async () => { const reads = await page.locator('article.op-read').count(); return reads > 0 && reads === await page.locator('article.op-read .read-preview').count(); }).toBe(true);
  await expect.poll(() => page.locator('.history').evaluate(el => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => page.locator('.history').evaluate(el => [...el.querySelectorAll('article')].flatMap(card => card.getAnimations()).filter(a => a.id.startsWith('surface-') && a.playState === 'running').length)).toBe(0);
  const follow=page.getByRole('switch',{name:'Automatically follow new work',exact:true});
  if(await follow.getAttribute('aria-checked')==='true')await follow.click();
  await expect(page.locator('.map [data-origin-file="test/checkout.test.ts"]')).toHaveAttribute('data-origin-visible', 'true');
  await page.mouse.move(0, 0);
  await edit.locator('.op-head').hover();
  const tether = page.locator('.origin-thread[data-origin-type="Repository node"]');
  await expect(tether).toHaveCount(1);
  // Renderer ownership can change during a redraw. Compare path and origin from
  // the same frame rather than holding one coordinate across protocol calls.
  await expect.poll(()=>page.evaluate(()=>{
    const tether=document.querySelector('.origin-thread[data-origin-type="Repository node"]');
    const renderer=tether?.getAttribute('data-origin-renderer');
    const node=document.querySelector(`${renderer==='overview'?'.repo-lens':'.map'} [data-origin-file="test/checkout.test.ts"]`);
    const coordinates=tether?.getAttribute('d')?.match(/^M([\d.-]+),([\d.-]+)/);
    if(!node||!coordinates)return Infinity;
    const bounds=node.getBoundingClientRect();
    return Math.max(Math.abs(Number(coordinates[1])-bounds.x-bounds.width/2),Math.abs(Number(coordinates[2])-bounds.y-bounds.height/2));
  })).toBeLessThan(1);
  const point = (await page.locator('.map [data-origin-file="test/checkout.test.ts"]').boundingBox())!;
  // Occlusion must switch to another real view of the node, not draw through the reader.
  const testFolder=page.locator('.folder-tree .folder-row[title="test"]');
  if(await testFolder.getAttribute('aria-expanded')!=='true')await testFolder.click();
  await page.locator('.folder-tree [data-spine-path="test/checkout.test.ts"]').scrollIntoViewIfNeeded();
  await page.evaluate((point) => {
    const cover = document.createElement('div'); cover.className = 'inspector'; cover.id = 'synthetic-origin-cover';
    Object.assign(cover.style, { position: 'fixed', animation: 'none', transform: 'none', zIndex: '1000', left: `${point.x - 4}px`, top: `${point.y - 4}px`, width: '16px', height: '16px' });
    document.body.append(cover);
  }, point);
  await page.mouse.move(0, 0); await edit.hover();
  const fileReference = page.locator('.origin-thread[data-origin-type="File tree row"]');
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
  await expect(page.locator('.origin-thread[data-origin-type="File tree row"]')).toHaveCount(1);
});

test('verification marks represent recorded counts and open the captured failing assertion', async ({ page }) => {
  const demo = new URL(server.launchUrl); demo.search = '?demo'; demo.hash = '';
  await page.goto(demo.href);
  await expect(page.locator('article.op-test').last().locator('.verification-tile.passed')).toHaveCount(7);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('npm test');
  await page.locator('.search-results button').first().click();
  const failed = page.locator('article.op-test.st-error');
  await expect(failed.locator('.verification-tile.failed')).toHaveCount(1);
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
  // CONTENT-14: the expanded result is the stored reader, which says whether it holds the complete result, not a "preview".
  await expect(operation.getByRole('region', { name: 'Stored captured result' })).toContainText('Complete stored result');
  await expect(operation.locator('.op-expanded .result-prose')).toContainText('TypeScript handbook');
});

test('a burst follows automatically and deliberate reading can hold and resume the camera', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const steps = page.locator('.reading-status');
  const before = Number((await steps.innerText()).match(/\d+/)?.[0]);
  for (let i = 0; i < 8; i++) {
    append({ type: 'assistant', message: { id: `p1-burst-${i}`, role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: `Burst explanation ${i}: ${'captured detail '.repeat(25)}` }] } });
  }
  await app.ingest.sync(recordingId);
  await expect(steps).toContainText(`${before + 8} recorded steps`);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toHaveCount(0);
  const history = page.locator('.history');
  await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  await pointAtHistory(page);
  await page.mouse.wheel(0, -240);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
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
  await expect(verification.locator('.verification-tile.passed')).toHaveCount(7);
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
  await page.locator('.instrument.k-test').scrollIntoViewIfNeeded();
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
  // The current evidence desk scrolls; a clipped instrument is not a true origin.
  await dock.locator('[data-mcp-tool="get-library-docs"]').scrollIntoViewIfNeeded();
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
  await expect(panel).toContainText('Recorded order · coverage not established');
  const id = 'p1-live-verification';
  append({ type: 'assistant', message: { id, role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: 'npm test -- p1-live-verification' } }] } });
  append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'Tests  1 passed (1)' }] } });
  await app.ingest.sync(recordingId);
  await expect(panel).toContainText('npm test -- p1-live-verification');
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByText('Sequence diagnostics', { exact: true }).click();
  await page.getByRole('button', { name: 'Replay sequence', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('slider', { name: 'Timeline' }).press('End');
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
  test.setTimeout(90_000);
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
    // A late layout can finish following between visibility and activation.
    // Accept that completed state, otherwise activate the real return control.
    const follow = page.getByRole('switch', { name: 'Automatically follow new work' });
    await expect(async () => {
      if (await follow.getAttribute('aria-checked') === 'true') return;
      await page.getByRole('button', { name: /Back to latest/ }).click({ timeout: 1200 });
      await expect(follow).toHaveAttribute('aria-checked', 'true');
    }).toPass({ timeout: 6000 });
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
    await operation.locator('.op-title').click();
    await expect(operation).toBeVisible();
    await expect.poll(() => operation.evaluate(el => el.getAnimations().some(animation => animation.id.startsWith('surface-')))).toBe(false);
    append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'Synthetic recorded completion' }] } });
    append({ type: 'assistant', message: { id: `${id}-prose`, role: 'assistant', content: [{ type: 'text', text: `Captured outcome for ${call.name}.` }] } });
    await app.ingest.sync(recordingId);
    await expect(page.locator('.prose').last()).toContainText(`Captured outcome for ${call.name}`);
    await page.keyboard.press('Escape');
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
    await pointAtHistory(page, history);
    await page.mouse.wheel(0, delta);
    // Wheel delivery precedes native scrolling; measure the settled reader, not the old frame.
    await history.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  await scrollHistory(-100_000);
  // Keep the captured identity: opening material can reflow the virtual window's first read.
  const readId = await history.locator('article.op-read').first().getAttribute('data-op-id');
  expect(readId).toBeTruthy();
  const read = history.locator(`article.op-read[data-op-id="${readId}"]`);
  await read.scrollIntoViewIfNeeded();
  const excerpt = read.getByRole('button', { name: /Read excerpt of/ });
  await excerpt.focus(); await page.keyboard.press('Enter');
  const utilities = read.locator('.source-utilities');
  await expect(utilities).toBeVisible();
  if (await utilities.getAttribute('open') === null) { await utilities.locator('summary').focus(); await page.keyboard.press('Enter'); }
  const pin = read.getByRole('button', { name: 'Pin range', exact: true });
  await expect(pin).toBeVisible({ timeout: 10_000 });
  await pin.focus(); await page.keyboard.press('Enter');
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
    await expect.poll(() => page.locator('.origins').evaluate((el) => el.getAnimations({ subtree: true }).filter(animation => !(animation instanceof CSSTransition && animation.transitionProperty === 'scrollbar-color')).length), { message: 'Finite visible arrivals settle even while Follow is off' }).toBe(0);
    await page.getByRole('button', { name: /Back to latest/ }).click();
    await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight)), { message: `Round ${rounds}: explicit return reaches the latest captured work` }).toBeLessThan(2);
    rounds++;
    await page.waitForTimeout(5000);
  }
  console.log(JSON.stringify({ p1SyntheticReader: { elapsedMs: Date.now() - started, rounds, peakNodes } }));
});


test('replay clock advances independently while hovering, scrolling above and reading an action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(new URL('/?demo&at=16', server.launchUrl).href);
  await page.getByRole('combobox', { name: 'Speed', exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const history = page.locator('.history');
  await pointAtHistory(page, history);
  await page.mouse.wheel(0, -10000);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  const step = () => page.getByRole('slider', { name: 'Timeline' }).getAttribute('aria-valuenow').then(Number);
  const before = await step();
  const read = page.locator('article.op-read').first();
  await read.locator('.op-head .op-title').hover();
  await expect(read).toHaveAttribute('data-hover-reading', 'focused');
  await expect.poll(step, { timeout: 15000 }).toBeGreaterThan(before);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await read.getByRole('button', { name: /Expand/ }).click();
  await expect(read.locator('.op-expanded')).toBeVisible();
  const readingStep = await step();
  await expect.poll(step, { timeout: 15000 }).toBeGreaterThan(readingStep);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect.poll(() => history.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('following completed arrivals does not bounce the history camera backward', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  append({ type: 'assistant', message: { id: 'camera-intro', role: 'assistant', content: [{ type: 'text', text: Array.from({ length: 35 }, (_, i) => `Synthetic camera context ${i}: previous captured work remains above this arriving tool.`).join('\n\n') }] } });
  await app.ingest.sync(recordingId);
  const history = page.locator('.history');
  await expect.poll(() => history.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
  await page.mouse.move(5, 650);
  await page.evaluate(() => {
    const samples: { top: number; extent: number; layout: number }[] = [];
    (window as any).cameraSamples = samples;
    const end = performance.now() + 3000;
    const sample = () => {
      const el = document.querySelector<HTMLElement>('.history')!;
      samples.push({ top: el.scrollTop, extent: el.scrollHeight, layout: el.querySelector<HTMLElement>('.history-inner')!.offsetHeight });
      if (performance.now() < end) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const id = 'camera-burst-call';
  append({ type: 'assistant', message: { id: 'camera-burst', role: 'assistant', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: 'printf synthetic-camera-burst' } }] } });
  append({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: Array.from({ length: 50 }, (_, i) => `Synthetic output line ${i}`).join('\n') }] } });
  await app.ingest.sync(recordingId);
  await expect(page.locator('article.op-shell').filter({ hasText: 'synthetic-camera-burst' })).toBeVisible();
  await page.waitForTimeout(3200);
  const samples = await page.evaluate(() => (window as any).cameraSamples as { top: number; extent: number; layout: number }[]);
  const reverse = Math.max(0, ...samples.slice(1).map((sample, i) => samples[i]!.top - sample.top));
  expect(reverse, JSON.stringify(samples.filter((_, i) => i % 5 === 0))).toBeLessThan(3);
});
test('sequence replay arrivals keep a steady forward camera', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(new URL('/?demo&at=1', server.launchUrl).href);
  await page.getByRole('combobox', { name: 'Speed', exact: true }).selectOption('4');
  await page.mouse.move(5, 650);
  await page.evaluate(() => {
    const samples: { top: number; extent: number; layout: number; step: string | null }[] = [];
    (window as any).replayCameraSamples = samples;
    const end = performance.now() + 8000;
    const sample = () => {
      const el = document.querySelector<HTMLElement>('.history')!;
      samples.push({ top: el.scrollTop, extent: el.scrollHeight, layout: el.querySelector<HTMLElement>('.history-inner')!.offsetHeight, step: document.querySelector('[aria-label="Timeline"]')?.getAttribute('aria-valuenow') ?? null });
      if (performance.now() < end) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(8200);
  const samples = await page.evaluate(() => (window as any).replayCameraSamples as { top: number; extent: number; layout: number; step: string | null }[]);
  const reverse = Math.max(0, ...samples.slice(1).map((sample, i) => samples[i]!.top - sample.top));
  expect(reverse, JSON.stringify(samples.filter((_, i) => i % 5 === 0))).toBeLessThan(3);
});
test('paged replay retains its history and camera while the next captured page loads', async ({ page }) => {
  await page.route('**/v1/recordings', async route => {
    const response = await route.fetch();
    const body = await response.json();
    for (const recording of body.recordings) recording.sourceBytes = 34 * 1024 * 1024;
    await route.fulfill({ response, json: body });
  });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByText('Sequence diagnostics', { exact: true }).click();
  await page.getByRole('button', { name: 'Replay sequence', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.history')).toBeVisible();
  await page.evaluate(() => { (window as any).originalReplayHistory = document.querySelector('.history'); });
  let release!: () => void;
  let requested = false;
  let gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/history', async route => { requested = true; await gate; await route.continue(); });
  await page.getByRole('button', { name: 'Step forward', exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  try {
    expect(await page.evaluate(() => (window as any).originalReplayHistory.isConnected)).toBe(true);
    await expect(page.locator('.history')).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.locator('.viewer')).toHaveAttribute('aria-busy', 'false');
  expect(await page.evaluate(() => (window as any).originalReplayHistory === document.querySelector('.history'))).toBe(true);
  requested = false;
  gate = new Promise<void>(resolve => { release = resolve; });
  await page.getByRole('button', { name: 'Step back', exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  try {
    expect(await page.evaluate(() => (window as any).originalReplayHistory.isConnected)).toBe(true);
    await expect(page.locator('.viewer')).toHaveAttribute('inert', '');
    await expect(page.locator('.history')).toBeHidden();
    await expect(page.getByRole('status')).toContainText('Loading captured history');
  } finally { release(); }
  await expect(page.locator('.viewer')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.history')).toBeVisible();
});

// Exercise the actual probe: the last passage has a prompt but no operation/prose.
test('benchmark reader update completes for a final prompt-only passage', async () => {
  const source = join(dir, 'prompt-only-rollout.jsonl');
  const rows = [
    { type: 'session_meta', payload: { id: 'prompt-probe', cwd: '/synthetic' } },
    { type: 'event_msg', payload: { type: 'user_message', message: 'Invented opening prompt' } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Invented prior answer' }] } },
    { type: 'event_msg', payload: { type: 'user_message', message: 'Invented final prompt '.repeat(200) } },
  ];
  writeFileSync(source, rows.map((r, i) => JSON.stringify({ timestamp: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(), ...r })).join('\n') + '\n');
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/bench-real-journals.ts', '--worker', '--source', source, '--browser'], { timeout: 45000 });
  const result = JSON.parse(stdout.trim());
  expect(result.verifiedAgainstFullImport).toBe(true);
  expect(result.rescanIdempotent).toBe(true);
  expect(result.gaps).toBe(0);
  expect(result.concurrentCaptured).toBe(0);
  expect(result.ui.appendToReaderUpdateMs).toBeGreaterThan(0);
});
