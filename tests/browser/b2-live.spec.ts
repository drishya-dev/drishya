import { pointAtHistory } from './history-gestures.ts';
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
let callNumber = 0;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-b2-browser-'));
  journal = join(dir, 'session.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  app = new App(join(dir, 'data'));
  recordingId = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-browser-test' });
  app.ingest.startLive(recordingId);
});

test.afterAll(async () => {
  if (server) await server.close();
  if (app) await app.close();
  if (dir) {
    const target = resolve(dir);
    if (!target.startsWith(resolve(tmpdir()) + sep)) throw new Error('refusing to remove a directory outside the temp root');
    rmSync(target, { recursive: true, force: true });
  }
});

function appendSyntheticRecords() {
  const rows: string[] = [];
  for (let i = 0; i < 100; i++) {
    const id = `b2-call-${callNumber++}`;
    const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', version: '2.1.0', timestamp: new Date().toISOString() };
    rows.push(JSON.stringify({ ...base, uuid: randomUUID(), type: 'assistant', message: { id: `msg-${id}`, role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: `Synthetic live review step ${i}.` }, { type: 'tool_use', id, name: 'Read', input: { file_path: '/home/dev/shop/src/checkout/guard.ts' } }] } }));
    rows.push(JSON.stringify({ ...base, uuid: randomUUID(), type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: `     1\t// synthetic result ${i}` }] } }));
  }
  appendFileSync(journal, rows.join('\n') + '\n');
  return app.ingest.sync(recordingId);
}

function appendLongRead() {
  const id = `b3-long-${callNumber++}`;
  const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', version: '2.1.0', timestamp: new Date().toISOString() };
  const content = Array.from({ length: 250 }, (_, i) => `  ${String(i + 1).padStart(3)}\t// bounded reader line ${i + 1}`).join('\n');
  appendFileSync(journal, [
    JSON.stringify({ ...base, uuid: randomUUID(), type: 'assistant', message: { id: `msg-${id}`, role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: '/home/dev/shop/src/checkout/guard.ts' } }] } }),
    JSON.stringify({ ...base, uuid: randomUUID(), type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] } }),
  ].join('\n') + '\n');
  return app.ingest.sync(recordingId);
}

type Anchor = { id?: string; offset?: number };

test('live history keeps the reader anchored across bursts, sizes, reconnect and map-off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const history = page.locator('.history');
  const latest = page.getByRole('button', { name: /Back to latest/ });
  const steps = page.locator('.reading-status');
  await expect(steps).toContainText('24 recorded steps');
  await expect(page.locator('.viewer')).toHaveClass(/still/);

  const source = page.locator('article.op-read').last();
  await expect(source).toBeVisible();
  const sourceId = await source.getAttribute('data-op-id');
  await page.locator(`article[data-op-id="${sourceId}"] .code .ln-tx`).filter({ hasText: /\S/ }).first().click({ clickCount: 3 });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().trim().length ?? 0)).toBeGreaterThan(0);
  await expect(page.getByRole('complementary', { name: 'Operation detail' })).toHaveCount(0);
  await expect(latest).toHaveCount(0); // Selection keeps Follow on; only scrolling upward holds it.
  await pointAtHistory(page, history);
  await page.mouse.wheel(0, -300);
  await expect(latest).toBeVisible();
  await latest.click();
  await expect(latest).toHaveCount(0);

  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Repository map/ }).uncheck();
  await page.getByRole('button', { name: 'Close Workspace settings' }).click();
  await expect(page.locator('.map')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore repository map', exact: true })).toBeVisible();

  // The narrowest supported desktop window is 600 px (AGENTS.md, 26 October).
  for (const width of [1440, 900, 600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await pointAtHistory(page, history);
    await page.mouse.wheel(0, -900);
    await expect(latest).toBeVisible();
    // Wheel dispatch can return before the browser applies the scroll. Measure a stationary
    // reader anchor, rather than comparing two positions during the same user gesture.
    await history.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const anchor: Anchor = await history.evaluate((el) => {
      const viewport = el.getBoundingClientRect();
      const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => item.getBoundingClientRect().bottom > viewport.top + 1);
      return { id: node?.dataset.passageId, offset: node ? Math.round(node.getBoundingClientRect().top - viewport.top) : undefined };
    });
    expect(anchor.id).toBeTruthy();
    const before = Number((await steps.innerText()).match(/\d+/)?.[0]);
    await appendSyntheticRecords(); // 200 source records become 300 observations/steps.
    await expect(steps).toContainText(`${before + 300} recorded steps`);
    await expect(latest).toHaveAccessibleName(/300 new steps/);
    await expect.poll(() => history.evaluate((el) => {
      const viewport = el.getBoundingClientRect();
      const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => item.getBoundingClientRect().bottom > viewport.top + 1);
      return { id: node?.dataset.passageId, offset: node ? Math.round(node.getBoundingClientRect().top - viewport.top) : undefined };
    })).toMatchObject({ id: anchor.id, offset: anchor.offset });

    // Reaching the bottom by scrolling is not consent to resume following.
    await pointAtHistory(page, history);
    await page.mouse.wheel(0, 100_000);
    await expect(latest).toBeVisible();
    await latest.click();
    await expect(latest).toHaveCount(0);
    await expect.poll(() => history.evaluate((el) => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('textbox',{name:/Find (?:repository|session) files/}).fill('src/checkout/guard.ts');
  await page.locator('.spine-file[title="src/checkout/guard.ts"]').click();
  await page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' }).locator('[data-file-op]').first().click();
  await expect(page.getByRole('complementary', { name: 'Operation detail' }).getByRole('region', { name: 'Content of src/checkout/guard.ts' })).toContainText("if (!cart.total)");

  await page.reload(); // a new browser connection must reload the same committed history.
  await expect(steps).toContainText('924 recorded steps');
  await expect(page.locator('.map')).toHaveCount(0);
  await expect(page.locator('.viewer')).toHaveClass(/still/);
  expect(app.store.getRecording(recordingId)?.observationCount).toBe(926);
  expect((await app.ingest.sync(recordingId)).added).toBe(0);
});

test('long history mounts only nearby work while selected evidence and live updates survive', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const history = page.locator('.history');
  const steps = page.locator('.reading-status');
  const before = Number((await steps.innerText()).match(/\d+/)?.[0]);
  // Initial allocation is asynchronous; start the long-history journey at its
  // measured live edge before asking a single wheel gesture to reach the start.
  await expect.poll(() => history.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
  await pointAtHistory(page, history);
  await page.mouse.wheel(0, -100_000);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
  await expect.poll(() => history.evaluate((el) => el.scrollTop)).toBe(0);
  const anchor = await history.locator('[data-passage-id]').first().getAttribute('data-passage-id');
  expect(anchor).toBeTruthy();

  for (let i = 0; i < 8; i++) await appendSyntheticRecords();
  await expect(steps).toContainText(`${before + 2_400} recorded steps`);
  await expect.poll(() => history.locator('[data-passage-id]').count()).toBeLessThan(80);
  expect(await history.locator('[data-passage-id]').first().getAttribute('data-passage-id')).toBe(anchor);
  expect(await history.evaluate((el) => el.scrollTop)).toBe(0);

  const selected = history.locator('article[data-op-id]').first();
  const selectedId = await selected.getAttribute('data-op-id');
  await selected.press('Enter'); // The captured-file title opens a separate reader.
  await history.locator(`article[data-op-id="${selectedId}"]`).focus();
  // Target the history's reading gutter: the centre can be a nested source or
  // terminal scroller, whose wheel consumption is deliberately independent.
  const gutter = await history.evaluate((el) => {
    const bounds = el.getBoundingClientRect();
    return { x: bounds.left + parseFloat(getComputedStyle(el).paddingLeft) + 8, y: bounds.top + bounds.height / 2 };
  });
  await page.mouse.move(gutter.x, gutter.y);
  // Wheel through the measured end, rather than assuming ten events exhaust a
  // virtual document whose last passages are still resolving their heights.
  // Detached reading must not auto-follow those late measurements.
  await expect.poll(async () => {
    await page.mouse.wheel(0, 100_000);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    return history.evaluate((el) => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop));
  }, { message: 'Deliberate wheel navigation reaches the measured history end' }).toBeLessThan(2);
  await expect.poll(() => history.locator('[data-passage-id]').count()).toBeLessThan(80);
  await expect(history.locator(`article[data-op-id="${selectedId}"]`)).toHaveCount(1);
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-op-id'))).toBe(selectedId);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
});

test('B3 expands captured content in place, pages it, and bounds file navigation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { copiedSource: string }).copiedSource = text; } } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(server.launchUrl);
  await page.getByRole('combobox', { name: 'Harness' }).selectOption('codex');
  await expect(page.getByRole('button', { name: /Free orders reach checkout/ })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Harness' }).selectOption('claude-code');
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const history = page.locator('.history');
  const steps = page.locator('.reading-status');
  const before = Number((await steps.innerText()).match(/\d+/)?.[0]);
  await appendLongRead();
  await expect(steps).toContainText(`${before + 2} recorded steps`);

  // Pin the read by its operation id: `.last()` is re-resolved on every step, and in a long
  // virtualized history the last mounted read can change while the expanded one re-measures.
  const readId = await history.locator('article.op-read').last().getAttribute('data-op-id');
  expect(readId).toBeTruthy();
  const read = history.locator(`article.op-read[data-op-id="${readId}"]`);
  const content = read.getByRole('region', { name: 'Content of src/checkout/guard.ts' });
  const range = read.getByRole('button', { name: 'Read excerpt of src/checkout/guard.ts' });
  await expect(range).toContainText('Preview · lines 1–200');
  await range.click();
  await expect(read).toHaveClass(/expanded/);
  await expect(read.getByRole('button', { name: /Close .* in history/ })).toBeFocused();
  await expect(content).toContainText('bounded reader line 200');
  await expect(read.locator('.snapshot-provenance')).toContainText('Captured');
  await expect(read.locator('.snapshot-provenance')).toContainText('Excerpt · lines 1–250');
  const find = read.getByRole('searchbox', { name: 'Find in loaded source page' });
  await find.fill('line 250');
  await expect(read.locator('.source-find')).toContainText('0 matching lines in this page');
  await expect(content.locator('.ln-hi')).toHaveCount(0);
  // Page only once the first page has fully settled and the control is live.
  const next = read.getByRole('button', { name: 'Next lines' });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(read.getByRole('button', { name: 'Previous lines' })).toBeEnabled(); // the page index moved
  await expect(content).toContainText('bounded reader line 201');
  await expect(content).not.toContainText('bounded reader line 1');
  await expect(content.locator('.ln-no').first()).toHaveText('201');
  await expect(read.locator('.source-find')).toContainText('1 matching line in this page');
  await expect(content.locator('.ln-hi .ln-no')).toHaveText('250');
  await find.fill('LINE 249');
  await expect(content.locator('.ln-hi .ln-no')).toHaveText('249');
  await find.press('Enter');
  await read.locator('.source-utilities > summary').click();
  const rangeActions = read.getByRole('group', { name: 'Loaded source range actions' });
  await rangeActions.getByRole('textbox', { name: 'Source range start' }).fill('201');
  await rangeActions.getByRole('textbox', { name: 'Source range end' }).fill('203');
  await rangeActions.getByRole('button', { name: 'Copy range', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { copiedSource: string }).copiedSource)).toBe('// bounded reader line 201\n// bounded reader line 202\n// bounded reader line 203');
  await rangeActions.getByRole('button', { name: 'Pin range', exact: true }).click();
  const pinned = page.getByRole('complementary', { name: 'Pinned source reference' });
  await expect(pinned).toContainText('Pinned source · 201–203');
  await find.focus();
  const sourceScroll = await read.locator('.op-expanded').evaluate((el) => el.scrollTop);
  const readSteps = Number((await steps.innerText()).match(/\d+/)?.[0]);
  await appendLongRead();
  await expect(steps).toContainText(`${readSteps + 2} recorded steps`);
  await expect(find).toBeFocused();
  await expect(find).toHaveValue('LINE 249');
  await expect(content.locator('.ln-no').first()).toHaveText('201');
  expect(await read.locator('.op-expanded').evaluate((el) => el.scrollTop)).toBe(sourceScroll);
  await expect(pinned).toContainText('Pinned source · 201–203');
  await find.fill('');
  await expect(content.locator('.ln-hi')).toHaveCount(0);
  await find.fill('bounded reader line 24');
  await find.press('Enter');
  await expect(content.locator('[aria-current="location"] .ln-no')).toHaveText('240');
  await find.press('Enter');
  await expect(content.locator('[aria-current="location"] .ln-no')).toHaveText('241');
  await find.press('Shift+Enter');
  await expect(content.locator('[aria-current="location"] .ln-no')).toHaveText('240');
  await read.getByRole('button', { name: 'Previous match' }).click();
  await expect(content.locator('[aria-current="location"] .ln-no')).toHaveText('249');
  const go = read.getByRole('textbox', { name: 'Go to stored source line' });
  await go.fill('251');
  await go.press('Enter');
  await expect(read.locator('.source-go')).toContainText('enter line 1–250');
  await expect(content.locator('.ln-no').first()).toHaveText('201');
  await go.fill('18');
  await go.press('Enter');
  await expect(content.locator('[aria-current="location"] .ln-no')).toHaveText('18');
  await expect(content.locator('.ln-no').first()).toHaveText('18');
  await expect(go).toBeFocused();
  await read.getByRole('button', { name: 'Previous lines' }).click();
  await expect(content.locator('.ln-no').first()).toHaveText('1');
  await page.keyboard.press('Escape');
  await expect(read).not.toHaveClass(/expanded/);
  await pinned.getByRole('button', { name: /Pinned source/ }).click();
  await expect(pinned.getByRole('button', { name: 'Minimize reference' })).toBeFocused();
  await expect(pinned.getByRole('region', { name: 'Content of src/checkout/guard.ts' })).toHaveText('201// bounded reader line 201202// bounded reader line 202203// bounded reader line 203');
  await expect(page.getByRole('switch', { name: 'Automatically follow new work' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('switch', { name: 'Automatically follow new work' }).click();
  await pinned.getByRole('region', { name: 'Content of src/checkout/guard.ts' }).click();
  const heldAt = await history.evaluate((el) => el.scrollTop);
  const pinnedSteps = Number((await steps.innerText()).match(/\d+/)?.[0]);
  await appendLongRead();
  await expect(steps).toContainText(`${pinnedSteps + 2} recorded steps`);
  expect(await history.evaluate((el) => el.scrollTop)).toBe(heldAt);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pinned.getByRole('button', { name: /Pinned source/ })).toBeFocused();
  await expect(pinned.locator('.reference-content')).toHaveCount(0);

  await page.getByRole('textbox',{name:/Find (?:repository|session) files/}).fill('src/checkout/guard.ts');
  await page.locator('.spine-file[title="src/checkout/guard.ts"]').click();
  const panel = page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' });
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.locator('[data-file-op]').count()).toBeLessThan(40);
  await panel.getByRole('textbox', { name: 'Filter actions on this file' }).fill('b3-long');
  await expect(panel.locator('[data-file-op]')).toHaveCount(0);
  await panel.getByRole('textbox', { name: 'Filter actions on this file' }).fill('Read');
  await expect.poll(() => panel.locator('[data-file-op]').count()).toBeGreaterThan(0);
  await panel.locator('[data-file-op]').first().click();
  await expect(page.getByRole('complementary', { name: 'Operation detail' })).toBeVisible();
  await page.getByTitle('All recordings').click();
  await expect(pinned).toHaveCount(0);
});

test('B3 navigation keeps the combined synthetic story while filtering tools', async ({ page }) => {
  // This regression exercises the retained Legacy crown/dock composition;
  // Classic's right-hand agent families have separate browser coverage.
  const launch = new URL(server.launchUrl); launch.search = '?experience=legacy';
  await page.goto(launch.href);
  await page.getByRole('button', { name: 'Open demo' }).click();
  await expect(page.locator('.viewer')).toBeVisible();
  await expect(page.locator('.agents .agent')).toHaveCount(3);
  const steps = await page.locator('.reading-status').innerText();
  const read = page.locator('.dock .instrument.k-read');
  await read.click();
  await expect(read).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.passage.filtered-out').first()).toBeVisible();
  expect(await page.locator('.reading-status').innerText()).toBe(steps);
  await page.getByRole('button', { name: /Show everything/ }).click();
  await expect(read).toHaveAttribute('aria-pressed', 'false');
});
