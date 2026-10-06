import { appendFileSync, copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string;
let app: App;
let server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-product-'));
  const journal = join(dir, 'session.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  const rows: object[] = [];
  for (let n = 0; n < 26; n++) {
    const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', timestamp: '2026-10-06T12:00:00.000Z' };
    rows.push({ ...base, uuid: `distant-call-${n}`, type: 'assistant', message: { id: `distant-msg-${n}`, role: 'assistant', content: [{ type: 'tool_use', id: `distant-${n}`, name: 'Read', input: { file_path: '/home/dev/shop/src/distant.ts', offset: 1, limit: 1 } }] } });
    rows.push({ ...base, uuid: `distant-result-${n}`, type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `distant-${n}`, content: `1\t// captured distant moment ${n}` }] } });
  }
  appendFileSync(journal, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'data'));
  await app.ingest.importSource('claude-code', journal);
  server = await startServer({ app, port: 0, token: 'synthetic-product-test' });
});
test.afterAll(async () => {
  if (server) await server.close();
  if (app) await app.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});
const demoUrl = () => new URL('/?demo', server.launchUrl).href;

test('source preview opens the exact stored range and keeps pending replay evidence hidden', async ({ page }) => {
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const op = sample.projection.operations.find((item: { kind: string }) => item.kind === 'read');
  const artifact = sample.projection.artifacts.find((item: { id: string }) => item.id === op.detail.excerptArtifactId);
  artifact.kind = 'excerpt';
  artifact.range = { start: 81, end: 94 };
  await page.route('**/demo/bundle.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sample) }));
  await page.goto(demoUrl());
  const history = page.locator('.history');
  await expect(history).toBeVisible();
  await expect.poll(() => history.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.mouse.move(1000, 350);
  await page.mouse.wheel(0, -100_000);
  const read = history.locator(`article[data-op-id="${op.id}"]`);
  await read.scrollIntoViewIfNeeded();
  const range = read.getByRole('button', { name: `Read excerpt of ${op.detail.path}` });
  await expect(range).toContainText('Preview · lines 81–92');
  await expect(read.locator('.code .ln-no').first()).toHaveText('81');
  await range.focus();
  await range.press('Enter');
  await expect(read).toHaveClass(/expanded/);
  expect((await read.boundingBox())!.width).toBeGreaterThan(600);
  await expect(read.getByRole('button', { name: /Close .* in history/ })).toBeFocused();
  await expect(read.locator('.snapshot-provenance')).toContainText('Excerpt · lines 81–94');
  await read.getByRole('searchbox', { name: 'Find in loaded source page' }).fill('cart.total');
  await expect(read.locator('.ln-hi .ln-no')).toHaveText('88');
  await read.getByRole('textbox', { name: 'Go to stored source line' }).fill('94');
  await read.getByRole('button', { name: 'Go to line', exact: true }).click();
  await expect(read.locator('[aria-current="location"] .ln-no')).toHaveText('94');
  await read.getByRole('textbox', { name: 'Go to stored source line' }).fill('95');
  await read.getByRole('button', { name: 'Go to line', exact: true }).click();
  await expect(read.locator('.source-go')).toContainText('enter line 81–94');
  await expect(page.getByRole('complementary', { name: 'Operation detail' })).toHaveCount(0);
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/captured-range-reader.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await read.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(read.getByRole('searchbox', { name: 'Find in loaded source page' })).toBeVisible();
  // The result exists in the offline bundle, but has not landed at this replay boundary.
  await page.goto(new URL('/?demo&at=3', server.launchUrl).href);
  await expect(history.locator(`article[data-op-id="${op.id}"]`)).toContainText('awaiting excerpt');
  await expect(page.getByRole('button', { name: `Read excerpt of ${op.detail.path}` })).toHaveCount(0);
});

test('substantial external results retain structured evidence and adapt to narrow reading', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const op = sample.projection.operations.find((op: { detail: { kind: string } }) => op.detail.kind === 'mcp');
  const records = Array.from({ length: 5 }, (_, i) => ({ path: `synthetic/file-${i}.ts`, note: `Recorded result ${i}: ${'preserve this captured evidence '.repeat(12)}`, value: i === 0 ? null : false }));
  op.detail.resultPreview = JSON.stringify(records);
  await page.route('**/demo/bundle.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sample) }));
  await page.goto(demoUrl());
  const external = page.locator(`article[data-op-id="${op.id}"]`);
  const history = page.locator('.history');
  await expect(history).toBeVisible();
  await expect.poll(() => history.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.mouse.move(1000, 350);
  await page.mouse.wheel(0, -100_000);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
  await expect(external).toBeAttached();
  await external.scrollIntoViewIfNeeded();
  await expect(external).toHaveClass(/shape-reading/);
  expect((await external.boundingBox())!.width).toBeGreaterThan(500);
  await expect(external.locator('tbody tr')).toHaveCount(5);
  await expect(external.locator('tbody')).toContainText('synthetic/file-4.ts');
  await expect(external.locator('tbody')).toContainText('null');
  await external.getByText('Original captured preview', { exact: true }).click();
  await expect(external.locator('.result-original pre')).toHaveText(op.detail.resultPreview);
  await external.getByText('Original captured preview', { exact: true }).click();
  await external.locator('.op-body').evaluate((el) => { el.scrollTop = 0; });
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/external-reading-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await external.scrollIntoViewIfNeeded();
  expect((await external.boundingBox())!.width).toBeLessThan(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await external.locator('table').boundingBox())!.width).toBeGreaterThan((await external.boundingBox())!.width);
  await expect(external.locator('tbody')).toContainText('synthetic/file-4.ts');
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/external-reading-mobile.png') });
});

test('repository context follows older reading and exposes only qualified current imports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  sample.graph.temporal = 'current';
  sample.graph.edges = [
    { from: 'src/checkout/guard.ts', to: 'src/cart/types.ts', relation: 'static-import', basis: 'deterministic-rule', specifier: '../cart/types.ts' },
    { from: 'src/checkout/index.ts', to: 'src/checkout/guard.ts', relation: 'static-import', basis: 'deterministic-rule', specifier: './guard.ts' },
  ];
  await page.route('**/demo/bundle.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sample) }));
  await page.goto(demoUrl());
  const context = page.getByRole('region', { name: 'Repository reading context' });
  await expect(context).toContainText('Latest file reference');
  await expect(context.locator('.repo-context-file')).toContainText('checkout.test.ts');
  const history = page.locator('.history');
  await page.mouse.move(800, 350);
  await page.mouse.wheel(0, -100_000);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
  await expect(context).toContainText('No file location captured for this passage.');
  await expect(page.locator('article.op-read').first()).toBeAttached();
  await history.evaluate((el) => {
    const passage = el.querySelector('article.op-read')!.closest('.passage-slot')!;
    el.scrollTop += passage.getBoundingClientRect().top - el.getBoundingClientRect().top + 2;
  });
  await expect(context).toContainText('Reading here');
  await expect(context.locator('.repo-context-file')).toContainText('guard.ts');
  await expect(context.locator('.repo-context-action-label').first()).not.toHaveText('Read');
  await expect(context).toContainText('Current static imports');
  await expect(context).toContainText('Workspace index · not historical execution');
  await expect(context.locator('.repo-relations').first()).toContainText('src/cart/types.ts');
  await expect(context.locator('.repo-relations').last()).toContainText('src/checkout/index.ts');
  await page.getByRole('button', { name: 'Map on', exact: true }).click();
  await expect(context.locator('.repo-context-file')).toContainText('guard.ts');
  await context.locator('.repo-context-file').click();
  await expect(page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Work on src/checkout/guard.ts' }).click();
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/repository-reading-context.png') });
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect(context).toContainText('Latest file reference');
  await expect(context.locator('.repo-context-file')).toContainText('checkout.test.ts');
});

test('synthetic live demo publishes pending requests, resolves in place and keeps capture going while reading', async ({ page }) => {
  await page.goto(new URL('/?demo=live', server.launchUrl).href);
  await expect(page.locator('.workspace-context')).toContainText('Synthetic live demonstration');
  const operation = page.locator('article.op-read').first();
  await expect(operation).toContainText('awaiting excerpt', { timeout: 15_000 });
  const id = await operation.getAttribute('data-op-id');
  await expect(operation).toContainText('Request observed. Result has not arrived.');
  await expect(operation).not.toContainText('export function');
  await expect(operation).toContainText('export function', { timeout: 10_000 });
  expect(await operation.getAttribute('data-op-id')).toBe(id);
  const settings = page.getByRole('button', { name: 'Workspace settings', exact: true });
  await settings.click();
  const context = page.getByRole('region', { name: 'Repository reading context' });
  await expect(context).toContainText('Reading here');
  const contextPath = await context.locator('.repo-context-file').allTextContents();
  const before = Number((await page.locator('.reading-status').innerText()).match(/\d+/)![0]);
  await expect.poll(async () => Number((await page.locator('.reading-status').innerText()).match(/\d+/)![0]), { timeout: 10_000 }).toBeGreaterThan(before);
  await expect(context).toContainText('Reading here');
  expect(await context.locator('.repo-context-file').allTextContents()).toEqual(contextPath);
  await page.getByRole('button', { name: 'Close Workspace settings' }).click();
  await page.getByRole('button', { name: 'Show complete sample' }).click();
  await expect(page.locator('.reading-status')).toContainText('45 recorded steps');
  await expect(page.locator('.workspace-context')).toContainText('Sample complete');
  await expect(page.locator('.transport')).not.toContainText('Pause');
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect(page.locator('article.op-test').last()).toContainText('7 passed');
  await expect(page.getByRole('button', { name: 'Filter by Codex agent' })).toBeVisible();
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/material-live-complete.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.crown-sample')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Watch demo again' }).click();
  await expect(page.locator('.workspace-context')).toContainText('Publishing sample events');
  await expect.poll(async () => Number((await page.locator('.reading-status').innerText()).match(/\d+/)![0])).toBeLessThan(45);
});

test('workspace settings persist, respect the OS, restore focus and work on a narrow screen', async ({ page }) => {
  await page.goto(demoUrl());
  const settings = page.getByRole('button', { name: 'Workspace settings', exact: true });
  await settings.click();
  const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
  await dialog.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await settings.click();
  await dialog.getByRole('button', { name: 'System', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await dialog.getByRole('checkbox', { name: /^Low resource mode/ }).check();
  await expect(dialog.getByRole('checkbox', { name: /^Repository map/ })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /^Relationship motion/ })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Close Workspace settings' }).click();
  await expect(settings).toBeFocused();
  await expect(page.locator('.world')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await settings.click();
  await expect(dialog.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(390);
  await dialog.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(settings).toBeFocused();
});

test('file comparison reads real daemon artifacts and opens the same action in history', async ({ page }) => {
  await page.goto(server.launchUrl);
  await expect(page.getByRole('heading', { name: 'See the work.' })).toBeVisible();
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const file = page.locator('.spine-file[title="src/checkout/guard.ts"]');
  await file.click();
  const dialog = page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' });
  await expect(dialog.getByRole('region', { name: 'File evidence' })).toContainText('if (!cart.total)');
  await dialog.getByRole('button', { name: 'Compare evidence' }).click();
  await expect(dialog.getByLabel('Second evidence')).toBeVisible();
  await expect(dialog.locator('.file-evidence-columns')).toContainText('Captured patch');
  await expect(dialog.locator('.file-evidence-columns')).toContainText('cart.total == null');
  await expect(dialog.getByRole('button', { name: 'Copy derived page', exact: true })).toBeVisible();
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/product-file-comparison.png') });
  const first = dialog.locator('.file-trail-item').first();
  const buttonBounds = (await first.locator('.file-op').boundingBox())!;
  const linkBounds = (await first.locator('[data-file-op]').boundingBox())!;
  expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(linkBounds.y + 1);
  await dialog.getByLabel('Filter actions on this file').fill('not-a-recorded-action');
  await expect(dialog).toContainText('No matching captured actions');
  await expect(dialog.getByLabel('First evidence')).toHaveCount(0);
  await dialog.getByLabel('Filter actions on this file').fill('');
  const action = dialog.locator('[data-file-op]').first();
  const id = await action.getAttribute('data-file-op');
  await action.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Operation detail' })).toBeVisible();
  await expect(page.locator(`[data-op-id="${id}"]`).first()).toBeAttached();
  await page.getByRole('complementary', { name: 'Operation detail' }).getByRole('button', { name: 'Close', exact: true }).click();
  await file.click();
  await dialog.getByRole('button', { name: 'Compare evidence' }).click();
  await dialog.locator('.verify-open').first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Operation detail' })).toContainText('npm test');
});

test('agent ownership shares one history, and replay file choices obey the historical boundary', async ({ page }) => {
  await page.goto(demoUrl());
  await page.getByRole('button', { name: 'Agents', exact: true }).click();
  const overview = page.getByRole('region', { name: 'Agent comparison' });
  await expect(overview).toContainText('counts and files describe the work shown in this view');
  await expect(overview).toContainText('Captured child of Claude Code');
  await overview.getByRole('button').last().click();
  await expect(page.getByRole('button', { name: 'Clear focus' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear focus' }).click();
  await page.getByRole('button', { name: 'Follow', exact: true }).click();
  await expect(overview).toHaveCount(0);
  // Deep link intentionally holds replay at an early step before the guard read completes.
  await page.goto(new URL('/?demo&at=3', server.launchUrl).href);
  await page.locator('.spine-file[title="src/checkout/guard.ts"]').click();
  const dialog = page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' });
  await expect(dialog).toContainText('Visible at this replay step');
  await expect(dialog).not.toContainText('cart.total == null');
  await expect(dialog).not.toContainText('7 passed');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(dialog.getByRole('button', { name: 'Close Work on src/checkout/guard.ts' })).toBeVisible();
});

test('distant file moments compare across bounded trail pages', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await page.locator('.spine-file[title="src/distant.ts"]').click();
  const dialog = page.getByRole('dialog', { name: 'Work on src/distant.ts' });
  await expect(dialog.locator('.file-trail-item')).toHaveCount(24);
  await dialog.getByRole('button', { name: 'Compare evidence' }).click();
  const first = dialog.getByLabel('First evidence');
  const selected = await first.inputValue();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.locator('.file-trail-item')).toHaveCount(2);
  await expect(first).toHaveValue(selected);
  const second = dialog.getByLabel('Second evidence');
  const options = await second.locator('option').evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value));
  await second.selectOption(options[1]!);
  await expect(dialog.locator('.file-evidence-column').first()).toContainText('captured distant moment 0');
  await expect(dialog.locator('.file-evidence-column').last()).toContainText('captured distant moment 25');
});

test('a sanitized export opens as read-only evidence and can return to the local workspace', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  const exportPath = await page.getByRole('link', { name: 'Export', exact: true }).getAttribute('href');
  const replay = new URL('/', server.launchUrl);
  replay.searchParams.set('bundle', new URL(exportPath!, server.launchUrl).href);
  await page.goto(replay.href);
  await expect(page.locator('.workspace-context')).toContainText('Offline evidence');
  await expect(page.getByRole('button', { name: 'Watch live', exact: true })).toHaveCount(0);
  await page.locator('.spine-file[title="src/checkout/guard.ts"]').click();
  const dialog = page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' });
  await expect(dialog).toContainText('if (!cart.total)');
  await dialog.getByRole('button', { name: 'Close Work on src/checkout/guard.ts' }).click();
  await page.getByRole('button', { name: 'Drishya', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sessions on this machine' })).toBeVisible();
});

test('view and appearance changes keep the same captured passage under the reader', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(demoUrl());
  const history = page.locator('.history');
  await expect(page.locator('article.op-test').last()).toBeVisible();
  await page.mouse.move(800, 350);
  await page.mouse.wheel(0, -1000);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
  const anchor = await history.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const node = [...el.querySelectorAll<HTMLElement>('.passage-slot')].find((node) => node.getBoundingClientRect().bottom > top + 1)!;
    return { id: node.dataset.passageId!, offset: node.getBoundingClientRect().top - top };
  });
  const displacement = () => history.evaluate((el, anchor) => {
    const node = [...el.querySelectorAll<HTMLElement>('.passage-slot')].find((node) => node.dataset.passageId === anchor.id);
    return node ? Math.abs(node.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset) : Infinity;
  }, anchor);
  await page.getByRole('button', { name: 'Agents', exact: true }).click();
  await expect.poll(displacement).toBeLessThan(3);
  await page.getByRole('button', { name: 'Repository', exact: true }).first().click();
  await page.getByRole('button', { name: 'Follow', exact: true }).click();
  await expect.poll(displacement).toBeLessThan(3);
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.getByRole('button', { name: 'Close Workspace settings' }).click();
  await expect.poll(displacement).toBeLessThan(3);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') {
    await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
    await page.getByRole('button', { name: 'Charcoal', exact: true }).click();
    await page.getByRole('button', { name: 'Close Workspace settings' }).click();
    await page.screenshot({ path: resolve('.local/product-workspace.png') });
  }
});
