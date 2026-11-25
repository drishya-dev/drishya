import { pointAtHistory } from './history-gestures.ts';
import { appendFileSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';
import {openSessionReview} from './session-review.ts';

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

test('completed evidence links keep full history and the chosen live-demo design', async ({ page }) => {
  await page.goto(`${demoUrl()}&experience=modern`);
  await openSessionReview(page);
  await page.getByRole('region', { name: 'Failures', exact: true }).getByRole('button').first().click();
  const detail = page.getByRole('region', { name: 'Operation detail' });
  await detail.locator('.step-links>summary').click();
  await detail.locator('.link-row').filter({ hasText: 'Read test/checkout.test.ts' }).click();
  await expect(detail).toContainText('canCheckout');
  await expect(detail).not.toContainText('Result has not arrived');
  await expect(page.locator('.modern-session-header').getByRole('button', { name: 'Changes', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.goto(new URL('/?demo=live', server.launchUrl).href);
  await expect(page.locator('html')).toHaveAttribute('data-experience', 'classic');
  await expect(page.locator('html')).toHaveAttribute('data-ui-version','modern');
  await expect(page).toHaveURL(/demo=live/);
});
test('map file labels are keyboard reading targets beneath header clearance', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${demoUrl()}&experience=modern`);
  await page.getByRole('button', { name: 'Explore repository map' }).click();
  const candidate = page.locator('button.map-file-label').first();
  await expect(candidate).toBeVisible();
  const path = await candidate.textContent();
  const file = page.getByRole('button', { name: path!, exact: true });
  await file.focus();
  const yaw = await page.locator('.map').getAttribute('data-map-yaw');
  await page.evaluate(async () => { for (let frame = 0; frame < 20; frame++) await new Promise(requestAnimationFrame); });
  await expect(page.locator('.map')).toHaveAttribute('data-map-yaw', yaw!);
  const header = (await page.locator('.workspace-header').boundingBox())!;
  expect((await file.boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height);
  await file.press('Enter');
  await expect(page.getByRole('dialog', { name: `Work on ${path}` })).toBeVisible();
});

for (const experience of ['modern']) {
  test(`${experience}: long changes remain scrollable and hover expands both dimensions`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
    const op = [...sample.projection.operations].reverse().find((item: { detail: { kind: string } }) => item.detail.kind === 'edit');
    op.detail.hunks = [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 76, lines: [' const unchanged = true;', ...Array.from({ length: 75 }, (_, n) => `+export const capturedChange${n + 1} = ${n + 1};`)] }];
    await page.route('**/demo/bundle.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sample) }));
    await page.goto(`${demoUrl()}&experience=${experience}`);
    const card = page.locator(`article[data-op-id="${op.id}"]`);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.ln-more')).toHaveCount(0);
    await expect(card.locator('.change-preview')).toContainText('capturedChange75');
    await expect.poll(() => card.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
    const before = (await card.boundingBox())!;
    await card.locator('.op-title').hover();
    await expect(card).toHaveAttribute('data-hover-reading', 'focused');
    await expect.poll(() => card.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
    const after = (await card.boundingBox())!;
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.height).toBeGreaterThan(before.height + 20);
    const body = card.locator('.op-body');
    expect(await body.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
    await body.evaluate(el => el.scrollTop = el.scrollHeight);
    await expect(card.locator('.ln-tx').last()).toBeInViewport();
  });
}

test('recording search separates work from indexed file navigation', async ({ page }) => {
  await page.goto(demoUrl());
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Search this recording' });
  await search.getByRole('textbox').fill('guard');
  await expect(search.locator('.search-results button').first()).toBeVisible();
  await search.getByRole('button', { name: 'Indexed files', exact: true }).click();
  await expect(search.locator('.search-scope-note')).toContainText('names only');
  await expect(search.locator('.search-results')).toContainText('src/checkout/guard.ts');
  await search.locator('.search-results button').first().click();
  await expect(page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' })).toBeVisible();
  await page.goto(new URL('/?demo&at=1', server.launchUrl).href);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill('missing-total');
  await expect(page.locator('.search-scope-note')).toContainText('this replay step');
  await expect(page.locator('.search-results')).toContainText('No matches at this replay step');
});

test('failed shell preview surfaces buried errors and preserves the full preview', async ({ page }) => {
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const shell = sample.projection.operations.find((op: { detail: { kind: string } }) => op.detail.kind === 'shell');
  shell.status = 'error'; shell.detail.exitCode = 1;
  shell.detail.outputPreview = [...Array.from({ length: 30 }, (_, n) => `build step ${n}`), 'TypeError: cannot read cart.total', '  at checkout.ts:42', ...Array(12).fill('cleanup')].join('\n');
  for (const entry of sample.projection.timeline) if (entry.type === 'op-end' && entry.operationId === shell.id) entry.status = 'error';
  await page.route('**/demo/bundle.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sample) }));
  await page.goto(demoUrl());
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill(shell.title);
  await page.locator('.search-results button').first().click();
  await page.keyboard.press('Escape');
  const action = page.locator(`article[data-op-id="${shell.id}"]`);
  await expect(action).toContainText('Error · output lines');
  await expect(action).toContainText('TypeError: cannot read cart.total');
  await expect(action).not.toContainText('build step 0');
  await action.getByRole('button', { name: 'Show the rest', exact: true }).click();
  await expect(action).toContainText('build step 0');
});

test('first-visit evidence review opens exact file work without a reading mark and hides future review in replay', async ({ page }) => {
  await page.goto(demoUrl());
  await openSessionReview(page);
  const review = page.getByRole('dialog', { name: 'Session review', exact: true });
  await expect(review.getByRole('region', { name: 'Files with changes' })).toBeVisible();
  await expect(review.getByRole('region', { name: 'Failures', exact: true })).toContainText('Test');
  await expect(review).toContainText('Whole session');
  await page.screenshot({ path: resolve('.local/evidence-review-desktop.png') });
  await review.getByRole('button', { name: 'Open src/checkout/guard.ts', exact: true }).click();
  const file = page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' });
  await expect(file).toBeVisible();
  await expect(file.getByRole('region',{name:'File history',exact:true})).toBeVisible();
  await expect(file).toContainText('Test runs after this change');
  await expect(file.locator('.file-evidence-material')).toContainText('== null');
  await page.screenshot({ path: resolve('.local/evidence-change-reader.png') });
  await file.getByRole('button', { name: 'Close Work on src/checkout/guard.ts' }).click();
  await expect(file).toHaveCount(0);
  await page.setViewportSize({ width: 600, height: 1000 });
  await openSessionReview(page);
  await expect(review).toBeVisible();
  const bounds = await review.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(600);
  await page.screenshot({ path: resolve('.local/evidence-review-narrow.png') });
  await review.getByRole('button', { name: 'Close Session review' }).click();
  await page.goto(new URL('/?demo&at=1', server.launchUrl).href);
  await expect(page.locator('.modern-session-header').getByRole('button', { name: 'Changes', exact: true })).toBeDisabled();
});

test('returning from an authenticated demo retains local workspace access', async ({ page }) => {
  const url = new URL(demoUrl());
  url.hash = new URL(server.launchUrl).hash;
  await page.goto(url.href);
  await expect(page.locator('.brand')).toBeVisible();
  await page.locator('.brand').click();
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.getByText('Open Drishya from its launch link')).toHaveCount(0);
});

test('wrapped Codex file creations and edits render as source changes instead of shell-only work', async ({ page }) => {
  const patch = '*** Begin Patch\n*** Add File: created.ts\n+export const created = true;\n*** Update File: edited.ts\n@@\n-old\n+replacement\n*** End Patch';
  const journal = join(dir, 'wrapped-capture.jsonl');
  writeFileSync(journal, [
    { type: 'session_meta', payload: { id: 'wrapped-capture', cwd: '/repo' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Create and edit the source' }] } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Applying the source changes.' }] } },
    { type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', call_id: 'wrapped', input: `text(await tools.apply_patch(${JSON.stringify(patch)}));` } },
    { type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'wrapped', output: '{}' } },
  ].map(r => JSON.stringify(r)).join('\n') + '\n');
  const { recordingId } = await app.ingest.importSource('codex', journal);
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(new URL(`/#/r/${recordingId}`, server.launchUrl).href);
  await expect(page.locator('article.op-write')).toContainText('created.ts');
  await expect(page.locator('article.op-edit')).toContainText('edited.ts');
  await expect(page.locator('article.op-edit')).toContainText('replacement');
  await expect(page.locator('.prose')).toContainText('Applying the source changes.');
});

test('long paths and MCP fields stay inside shared card headers and reading bounds', async ({ page }) => {
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const long = 'C:/Users/synthetic/.claude/projects/' + 'long-project-segment-'.repeat(12) + '/memory/project_state.md';
  for (const op of sample.projection.operations) op.title = `${op.kind} ${long}`;
  const edits = sample.projection.operations.filter((op: any) => op.kind === 'edit');
  edits[0].kind = 'write';
  const reads = sample.projection.operations.filter((op: any) => op.kind === 'read');
  reads[1].kind = 'web'; reads[1].detail = { kind: 'web', url: long, resultPreview: long };
  reads[2].kind = 'other'; reads[2].detail = { kind: 'other', input: { long }, resultPreview: long };
  reads[3].kind = 'plan'; reads[3].detail = { kind: 'plan', items: [{ text: long, status: 'pending' }] };
  for (const op of sample.projection.operations.filter((op: any) => op.kind === 'mcp')) {
    op.origin.server = 'long-server-name-'.repeat(10);
    op.detail.input = { [long]: long };
    op.detail.resultPreview = JSON.stringify([{ [long]: long, result: long }]);
  }
  let fixture = sample;
  await page.route('**/demo/bundle.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const kinds = ['read', 'write', 'edit', 'shell', 'test', 'search', 'mcp', 'web', 'other', 'spawn', 'plan'];
  for (const kind of kinds) {
    const op = sample.projection.operations.find((item: any) => item.kind === kind);
    const passage = sample.projection.passages.find((item: any) => item.operationIds.includes(op.id));
    fixture = { ...sample, projection: { ...sample.projection, passages: [{ ...passage, operationIds: [op.id], proseIds: [] }] } };
    await page.goto(demoUrl());
    const card = page.locator(`article[data-op-id="${op.id}"]`);
    await page.mouse.move(5, 500);
    await expect(card).toBeAttached();
    await card.scrollIntoViewIfNeeded({ timeout: 5000 });
    await expect(card).toBeVisible();
    const check = async () => {
      const bounds = await card.evaluate(el => {
        const head = el.querySelector<HTMLElement>('.op-head')!;
        const title = head.querySelector<HTMLElement>('.op-title')!;
        const body = el.querySelector<HTMLElement>('.op-body, .op-expanded')!;
        const h = head.getBoundingClientRect(), t = title.getBoundingClientRect(), b = body.getBoundingClientRect();
        return { top: t.top - h.top, bottom: h.bottom - t.bottom, lines: title.offsetHeight / parseFloat(getComputedStyle(title).lineHeight), bodyTop: b.top - h.bottom, overflow: body.scrollWidth - body.clientWidth };
      });
      expect(bounds.top, kind).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom, kind).toBeGreaterThanOrEqual(0);
      expect(bounds.lines, kind).toBeLessThan(1.1);
      expect(bounds.bodyTop, kind).toBeGreaterThanOrEqual(-1);
      expect(bounds.overflow, kind).toBeLessThanOrEqual(1);
    };
    await check();
    await card.locator('.op-head .op-title').hover();
    await expect(card).toHaveAttribute('data-hover-reading', 'focused');
    await expect.poll(() => card.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
    await check();
    await page.keyboard.press('Escape');
    const expand = card.locator('.op-expand');
    if (await expand.count()) {
      await expand.click(); await expect(card).toHaveClass(/expanded/); await check();
      await expand.click();
    }
  }
});

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
  const scrollBox = (await history.boundingBox())!;
  await pointAtHistory(page);
  await page.mouse.wheel(0, -100_000);
  const read = history.locator(`article[data-op-id="${op.id}"]`);
  await read.scrollIntoViewIfNeeded();
  const range = read.getByRole('button', { name: `Read excerpt of ${op.detail.path}` });
  await expect(range).toContainText('Preview · lines 81–94');
  await expect(read.locator('.code .ln-no').last()).toHaveText('94');
  await expect(read.locator('.ln-more')).toHaveCount(0);
  await expect(read.locator('.code .ln-no').first()).toHaveText('81');
  await range.focus();
  await range.press('Enter');
  await expect(read).toHaveClass(/expanded/);
  await expect.poll(async () => (await read.boundingBox())!.width).toBeGreaterThan(600);
  await expect(read.getByRole('button', { name: /Close .* in history/ })).toBeFocused();
  await expect(read.locator('.snapshot-provenance')).toContainText('Excerpt · lines 81–94');
  await expect(read.getByRole('textbox', { name: 'Go to stored source line' })).toBeHidden();
  await read.getByLabel('Stored source options',{exact:true}).focus();
  await read.getByLabel('Stored source options',{exact:true}).press('Enter');
  await read.getByRole('searchbox', { name: 'Find in loaded source page' }).fill('cart.total');
  await expect(read.locator('.ln-hi .ln-no')).toHaveText('88');
  if(!(await read.locator('details.desk-options:has(> summary[aria-label="Stored source options"])').evaluate(el=>(el as HTMLDetailsElement).open)))await read.getByLabel('Stored source options',{exact:true}).click();
  await read.getByRole('textbox', { name: 'Go to stored source line' }).fill('94');
  await read.getByRole('button', { name: 'Go to line', exact: true }).click();
  await expect(read.locator('[aria-current="location"] .ln-no')).toHaveText('94');
  await read.getByRole('textbox', { name: 'Go to stored source line' }).fill('95');
  await read.getByRole('button', { name: 'Go to line', exact: true }).click();
  await expect(read.locator('.source-go')).toContainText('enter line 81–94');
  const ranges = read.getByRole('group', { name: 'Loaded source range actions' });
  await ranges.getByRole('textbox', { name: 'Source range start' }).fill('80');
  await ranges.getByRole('textbox', { name: 'Source range end' }).fill('83');
  await ranges.getByRole('button', { name: 'Pin range', exact: true }).click();
  await expect(ranges).toContainText('choose lines 81–94 in order');
  await expect(page.getByRole('complementary', { name: 'Pinned source reference' })).toHaveCount(0);
  await ranges.getByRole('textbox', { name: 'Source range start' }).fill('87');
  await ranges.getByRole('textbox', { name: 'Source range end' }).fill('89');
  await ranges.getByRole('button', { name: 'Pin range', exact: true }).click();
  const pinned = page.getByRole('complementary', { name: 'Pinned source reference' });
  await expect(pinned).toContainText('Pinned source · 87–89');
  await ranges.getByRole('textbox', { name: 'Source range start' }).fill('90');
  await ranges.getByRole('textbox', { name: 'Source range end' }).fill('91');
  await ranges.getByRole('button', { name: 'Pin range', exact: true }).click();
  await expect(pinned).toHaveCount(1);
  await expect(pinned).toContainText('Pinned source · 90–91');
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/captured-range-reader.png') });
  await page.setViewportSize({ width: 600, height: 1000 });
  await read.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(read.getByRole('searchbox', { name: 'Find in loaded source page' })).toBeVisible();
  await pinned.getByRole('button', { name: /Pinned source/ }).click();
  await expect(pinned).toContainText('Temporary historical range · not current workspace');
  await expect(pinned.locator('.ln-no')).toHaveText(['90', '91']);
  const headingBounds = (await pinned.locator('.reference-heading').boundingBox())!;
  const provenanceBounds = (await pinned.locator('.reader-tools').first().boundingBox())!;
  expect(headingBounds.y + headingBounds.height).toBeLessThanOrEqual(provenanceBounds.y);
  expect((await pinned.boundingBox())!.width).toBeLessThanOrEqual(576);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await pinned.getByRole('button', { name: 'Minimize reference' }).press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(()=>localStorage.setItem('drishya-dev-tools','1'));await page.getByLabel('More workspace options',{exact:true}).click();
  await page.getByRole('button',{name:'Replay this session',exact:true}).click();
  await expect(pinned).toHaveCount(0);
  // The result exists in the offline bundle, but has not landed at this replay boundary.
  await page.goto(new URL('/?demo&at=3', server.launchUrl).href);
  await expect(history.locator(`article[data-op-id="${op.id}"]`)).toContainText('awaiting excerpt');
  await expect(page.getByRole('button', { name: `Read excerpt of ${op.detail.path}` })).toHaveCount(0);
});

test('native source navigation can leave the History start boundary', async ({ page }) => {
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const op = sample.projection.operations.find((item: { kind: string }) => item.kind === 'read');
  const artifact = sample.projection.artifacts.find((item: { id: string }) => item.id === op.detail.excerptArtifactId);
  artifact.range = { start: 81, end: 82 };
  artifact.provenance = { kind: 'derived', rule: 'synthetic-reference-test', observationIds: artifact.provenance.observationIds };
  sample.artifactText[artifact.id] = `${'x'.repeat(40_000)}\n// short derived reference`;
  await page.route('**/demo/bundle.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sample) }));
  await page.goto(new URL('/?demo&at=end', server.launchUrl).href);
  const history = page.locator('.history');
  await expect(history).toBeVisible();
  await expect.poll(() => history.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await pointAtHistory(page);
  await page.mouse.wheel(0, -100_000);
  const read = page.locator(`article[data-op-id="${op.id}"]`);
  await read.scrollIntoViewIfNeeded();
  await read.getByRole('button', { name: `Read excerpt of ${op.detail.path}` }).click();
  const summary = read.getByLabel('Stored source options',{exact:true});
  await expect(read.locator('.artifact-reader [data-source-line="82"]')).toBeAttached();
  // Native focus and locator navigation scroll the real History container. That
  // movement must supersede its previous start boundary before a pointer click.
  const targeted = await summary.evaluate(el => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    return el.closest('.history')!.scrollTop;
  });
  expect(targeted).toBeGreaterThan(0);
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  await expect.poll(() => history.evaluate(el => el.scrollTop)).toBe(targeted);
  await summary.click();
  await expect(read.locator('details.desk-options:has(> summary[aria-label="Stored source options"])')).toHaveJSProperty('open', true);
});

test('source references reject oversized text, preserve derived provenance and clear on replay seek', async ({ page }) => {
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const op = sample.projection.operations.find((item: { kind: string }) => item.kind === 'read');
  const artifact = sample.projection.artifacts.find((item: { id: string }) => item.id === op.detail.excerptArtifactId);
  artifact.range = { start: 81, end: 82 };
  artifact.provenance = { kind: 'derived', rule: 'synthetic-reference-test', observationIds: artifact.provenance.observationIds };
  sample.artifactText[artifact.id] = `${'x'.repeat(40_000)}\n// short derived reference`;
  await page.route('**/demo/bundle.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sample) }));
  await page.goto(new URL('/?demo&at=end', server.launchUrl).href);
  const history = page.locator('.history');
  await expect(history).toBeVisible();
  await expect.poll(() => history.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const scrollBox = (await history.boundingBox())!;
  await pointAtHistory(page);
  await page.mouse.wheel(0, -100_000);
  const read = page.locator(`article[data-op-id="${op.id}"]`);
  await read.scrollIntoViewIfNeeded();
  await read.getByRole('button', { name: `Read excerpt of ${op.detail.path}` }).click();
  await read.getByLabel('Stored source options',{exact:true}).click();
  const ranges = read.getByRole('group', { name: 'Loaded source range actions' });
  await ranges.getByRole('button', { name: 'Pin range', exact: true }).click();
  await expect(ranges).toContainText('Reference limit · choose a smaller range');
  const pinned = page.getByRole('complementary', { name: 'Pinned source reference' });
  await expect(pinned).toHaveCount(0);
  await ranges.getByRole('textbox', { name: 'Source range start' }).fill('82');
  await ranges.getByRole('button', { name: 'Pin range', exact: true }).click();
  await pinned.getByRole('button', { name: /Pinned source/ }).click();
  await expect(pinned).toContainText('Derived · synthetic-reference-test');
  await expect(pinned.locator('.ln-no')).toHaveText('82');
  await page.getByRole('button', { name: 'Step back', exact: true }).click();
  await expect(pinned).toHaveCount(0);
});

test('substantial external results retain structured evidence and adapt to narrow reading', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const op = sample.projection.operations.find((op: { detail: { kind: string } }) => op.detail.kind === 'mcp');
  const records = Array.from({ length: 5 }, (_, i) => ({ path: `synthetic/file-${i}.ts`, note: `Recorded result ${i}: ${'preserve this evidence '.repeat(12)}`, value: i === 0 ? null : false }));
  op.detail.resultPreview = JSON.stringify(records);
  await page.route('**/demo/bundle.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sample) }));
  await page.goto(demoUrl());
  const external = page.locator(`article[data-op-id="${op.id}"]`);
  const history = page.locator('.history');
  await expect(history).toBeVisible();
  await expect.poll(() => history.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const scrollBox = (await history.boundingBox())!;
  await pointAtHistory(page);
  await page.mouse.wheel(0, -100_000);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
  await expect(external).toBeAttached();
  await external.scrollIntoViewIfNeeded();
  await expect(external).toHaveClass(/shape-reading/);
  expect((await external.boundingBox())!.width).toBeGreaterThanOrEqual(350);
  expect((await external.boundingBox())!.width).toBeLessThanOrEqual(600);
  await expect(external.locator('tbody tr')).toHaveCount(5);
  await expect(external.locator('tbody')).toContainText('synthetic/file-4.ts');
  await expect(external.locator('tbody')).toContainText('null');
  await external.locator('.with-original').getByRole('button', { name: 'Original', exact: true }).press('Enter');
  await expect(external.locator('.with-original .original-text')).toHaveText(op.detail.resultPreview);
  await external.locator('.with-original').getByRole('button', { name: 'Original', exact: true }).press('Enter');
  await external.locator('.op-body').evaluate((el) => { el.scrollTop = 0; });
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/external-reading-desktop.png') });
  await page.setViewportSize({ width: 600, height: 1000 });
  await external.scrollIntoViewIfNeeded();
  const narrowBox = (await external.boundingBox())!;
  expect(narrowBox.width).toBeGreaterThan(450);
  expect(narrowBox.width).toBeLessThan(600);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await external.locator('table').boundingBox())!.width).toBeLessThan((await external.boundingBox())!.width);
  expect(await external.locator('.op-body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await expect(external.locator('tbody')).toContainText('synthetic/file-4.ts');
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/external-reading-mobile.png') });
});

test('the explorer keeps current file navigation without redundant relationship and map panels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(demoUrl());
  const explorer = page.getByRole('complementary', { name: 'Repository files' });
  await expect(explorer).toBeVisible();
  await expect(explorer).not.toContainText('Current workspace index');
  await expect(explorer).not.toContainText('File relationships');
  await expect(explorer.locator('.folder-map-link')).toHaveCount(0);
  await explorer.getByRole('textbox', { name: 'Find repository files' }).fill('guard.ts');
  await explorer.getByRole('treeitem').filter({ hasText: 'guard.ts' }).click();
  await expect(page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Work on src/checkout/guard.ts' }).click();
  await page.getByRole('button', { name: 'Explore repository map' }).click();
  await expect(page.locator('.map.exploring')).toBeVisible();
  await expect(explorer).toHaveCSS('opacity', '0');
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
  await page.getByRole('switch', { name: 'Automatically follow new work' }).click();
  await settings.click();
  const beforeScroll = await page.locator('.history').evaluate(el => el.scrollTop);
  const before = Number((await page.locator('.reading-status').innerText()).match(/\d+/)![0]);
  await expect.poll(async () => Number((await page.locator('.reading-status').innerText()).match(/\d+/)![0]), { timeout: 10_000 }).toBeGreaterThan(before);
  expect(await page.locator('.history').evaluate(el => el.scrollTop)).toBeCloseTo(beforeScroll, 0);
  await page.getByRole('button', { name: 'Close Workspace settings' }).click();
  await page.getByRole('button', { name: 'Show complete sample' }).click();
  await expect(page.locator('.reading-status')).toContainText('45 recorded steps');
  await expect(page.locator('.workspace-context')).toContainText('Sample complete');
  await expect(page.locator('.transport')).not.toContainText('Pause');
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect(page.locator('article.op-test').last()).toContainText('7 passed');
  await page.locator('.md-agents > summary').click();
  await expect(page.getByRole('switch', { name: 'Filter by gpt-5-codex agent' })).toBeVisible();
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/material-live-complete.png') });
  await page.setViewportSize({ width: 600, height: 1000 });
  await expect(page.getByRole('button',{name:'Watch demo again',exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(600);
  await page.getByRole('button', { name: 'Watch demo again' }).click();
  await expect(page.locator('.workspace-context')).toContainText('Publishing sample events');
  await expect.poll(async () => Number((await page.locator('.reading-status').innerText()).match(/\d+/)![0])).toBeLessThan(45);
});

test('explicit themes persist independently of the OS, restore focus and work on a narrow screen', async ({ page }) => {
  await page.goto(demoUrl());
  const settings = page.getByRole('button', { name: 'Workspace settings', exact: true });
  await page.getByRole('switch', { name: 'Automatically follow new work' }).click();
  await settings.click();
  const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
  await dialog.getByRole('button', { name: 'Daylight', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await settings.click();
  await expect(dialog.getByRole('button', { name: 'System', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Jet Black', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await dialog.getByRole('tab',{name:'Reading',exact:true}).click();
  await dialog.getByRole('checkbox', { name: /^Low resource mode/ }).check();
  await expect(dialog.getByRole('checkbox', { name: /^Repository map/ })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /^Relationship motion/ })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Close Workspace settings' }).click();
  await expect(settings).toBeFocused();
  await expect(page.locator('.world')).toHaveCount(0);
  await page.setViewportSize({ width: 600, height: 1000 });
  await settings.click();
  await dialog.getByRole('tab',{name:'Appearance',exact:true}).click();
  await expect(dialog.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(600);
  await dialog.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(settings).toBeFocused();
});

test('file comparison reads real daemon artifacts and opens the same action in history', async ({ page }) => {
  await page.goto(server.launchUrl);
  await expect(page.getByRole('heading', { name: 'Your sessions.' })).toBeVisible();
  await page.locator('.mh-session-open').filter({hasText:'Free orders reach checkout'}).click();
  await page.getByRole('textbox',{name:/Find (?:repository|session) files/}).fill('src/checkout/guard.ts');
  const file = page.locator('.spine-file[title="src/checkout/guard.ts"]');
  await file.click();
  const dialog = page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' });
  await expect(dialog.getByRole('region', { name: 'File history' })).toContainText('if (!cart.total)');
  await dialog.getByRole('button', { name: 'Compare evidence' }).click();
  await expect(dialog.getByLabel('Second step')).toBeVisible();
  await expect(dialog.locator('.file-evidence-columns')).toContainText('Patch');
  await expect(dialog.locator('.file-evidence-columns')).toContainText('cart.total == null');
  const afterKey = await dialog.getByLabel('Second step').locator('option').evaluateAll(opts => opts.map(o => (o as HTMLOptionElement).value).find(v => v.endsWith('/after')));
  if (afterKey) await dialog.getByLabel('Second step').selectOption(afterKey);
  await dialog.locator('.file-evidence-column').last().getByLabel('Stored source options',{exact:true}).click();
  await expect(dialog.getByRole('button', { name: 'Copy derived page', exact: true })).toBeVisible();
  await dialog.locator('.file-evidence-column').last().getByLabel('Stored source options',{exact:true}).click();
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/product-file-comparison.png') });
  await dialog.getByLabel('File actions',{exact:true}).click();
  await dialog.getByRole('button', { name: 'Show actions', exact: true }).click();
  const first = dialog.locator('.file-trail-item').first();
  // Modern exposes the history action over the row on hover, rather than below it.
  const historyAction=first.locator('[data-file-op]');
  await first.hover();
  await expect(historyAction).toBeVisible();
  expect(await historyAction.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  await dialog.getByLabel('Filter actions on this file').fill('not-a-recorded-action');
  await expect(dialog).toContainText('No matching actions');
  await expect(dialog.getByLabel('First step')).toHaveCount(0);
  await dialog.getByLabel('Filter actions on this file').fill('');
  const action = dialog.locator('[data-file-op]').first();
  const id = await action.getAttribute('data-file-op');
  await action.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Operation detail' })).toBeVisible();
  await expect(page.locator(`[data-op-id="${id}"]`).first()).toBeAttached();
  await page.keyboard.press('Escape');
  await file.click();
  await dialog.getByRole('button', { name: 'Compare evidence' }).click();
  await dialog.locator('.verify-open').first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Operation detail' })).toContainText('npm test');
});

test('replay file choices obey the historical boundary', async ({ page }) => {
  // Deep link intentionally holds replay at an early step before the guard read completes.
  await page.goto(new URL('/?demo&at=3', server.launchUrl).href);
  await page.getByRole('textbox',{name:/Find (?:repository|session) files/}).fill('src/checkout/guard.ts');
  await page.locator('.spine-file[title="src/checkout/guard.ts"]').click();
  const dialog = page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' });
  await expect(dialog).toContainText('Up to this replay step');
  await expect(dialog).not.toContainText('cart.total == null');
  await expect(dialog).not.toContainText('7 passed');
  await page.setViewportSize({ width: 600, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(600);
  await expect(dialog.getByRole('button', { name: 'Close Work on src/checkout/guard.ts' })).toBeVisible();
});

test('distant file moments compare across bounded trail pages', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Free orders reach checkout'}).click();
  await page.getByRole('textbox',{name:/Find (?:repository|session) files/}).fill('src/distant.ts');
  await page.locator('.spine-file[title="src/distant.ts"]').click();
  const dialog = page.getByRole('dialog', { name: 'Work on src/distant.ts' });
  await expect(dialog.locator('.file-trail-item')).toHaveCount(24);
  const single = dialog.getByLabel('First step');
  const initial = await single.inputValue();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.locator('.file-trail-item')).toHaveCount(2);
  await expect(single).toHaveValue(initial);
  await expect(dialog.locator('.file-evidence-column').first()).toContainText('captured distant moment 25');
  await dialog.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(dialog.locator('.file-trail-item')).toHaveCount(24);
  await dialog.getByRole('button', { name: 'Compare evidence' }).click();
  const first = dialog.getByLabel('First step');
  const selected = await first.inputValue();
  await dialog.getByLabel('File actions',{exact:true}).click();
  await dialog.getByRole('button', { name: 'Show actions', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.locator('.file-trail-item')).toHaveCount(2);
  await expect(first).toHaveValue(selected);
  const second = dialog.getByLabel('Second step');
  const options = await second.locator('option').evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value));
  await second.selectOption(options[1]!);
  await expect(dialog.locator('.file-evidence-column').first()).toContainText('captured distant moment 25');
  await expect(dialog.locator('.file-evidence-column').last()).toContainText('captured distant moment 0');
});

test('a sanitized export opens as read-only evidence and can return to the local workspace', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Free orders reach checkout'}).click();
  await page.locator('.workspace-menu > summary').click();
  const exportPath = await page.getByRole('link', { name: 'Export recording', exact: true }).getAttribute('href');
  const replay = new URL('/', server.launchUrl);
  replay.searchParams.set('bundle', new URL(exportPath!, server.launchUrl).href);
  await page.goto(replay.href);
  await expect(page.locator('.workspace-context')).toContainText('Offline session');
  await expect(page.getByRole('button', { name: 'Watch live', exact: true })).toHaveCount(0);
  await page.getByRole('textbox',{name:/Find (?:repository|session) files/}).fill('src/checkout/guard.ts');
  await page.locator('.spine-file[title="src/checkout/guard.ts"]').click();
  const dialog = page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' });
  await expect(dialog).toContainText('if (!cart.total)');
  await dialog.getByRole('button', { name: 'Close Work on src/checkout/guard.ts' }).click();
  await page.getByRole('button', { name: 'Drishya', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your sessions.' })).toBeVisible();
});

test('view and appearance changes keep the same passage under the reader', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(demoUrl());
  const history = page.locator('.history');
  await expect(page.locator('article.op-test').last()).toBeVisible();
  await expect.poll(async () => { const reads = await page.locator('article.op-read').count(); return reads > 0 && reads === await page.locator('article.op-read .read-preview').count(); }).toBe(true);
  await expect.poll(() => history.evaluate(el => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(2);
  await expect.poll(() => history.evaluate(el => [...el.querySelectorAll('article')].flatMap(card => card.getAnimations()).filter(a => a.id.startsWith('surface-') && a.playState === 'running').length)).toBe(0);
  const scrollBox = (await history.boundingBox())!;
  await pointAtHistory(page);
  await page.mouse.wheel(0, -1000);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
  // Wheel scrolling can expose a hover reader and late material measurements.
  // Capture the baseline after the actual visible allocations settle, not two frames later.
  let previous = '', settled = 0;
  await expect.poll(async () => {
    const position = await history.evaluate(el => {
      const top = el.getBoundingClientRect().top, bottom = el.getBoundingClientRect().bottom;
      return JSON.stringify([el.scrollTop, ...[...el.querySelectorAll<HTMLElement>('.passage-slot')].flatMap(node => {
        const r = node.getBoundingClientRect();
        return r.bottom > top && r.top < bottom ? [[node.dataset.passageId, r.top, r.bottom]] : [];
      })]);
    });
    settled = position === previous ? settled + 1 : 0; previous = position;
    return settled;
  }, { intervals: [100] }).toBeGreaterThanOrEqual(3);
  const anchor = await history.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const node = [...el.querySelectorAll<HTMLElement>('.passage-slot')].find((node) => node.getBoundingClientRect().bottom > top + 1)!;
    return { id: node.dataset.passageId!, offset: node.getBoundingClientRect().top - top };
  });
  const displacement = () => history.evaluate((el, anchor) => {
    const node = [...el.querySelectorAll<HTMLElement>('.passage-slot')].find((node) => node.dataset.passageId === anchor.id);
    return node ? Math.abs(node.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset) : Infinity;
  }, anchor);
  await page.locator('.md-agents > summary').click();
  await page.locator('.station-subagents > summary').click();
  await page.getByRole('switch', { name: 'Filter by Explore agent', exact: true }).click();
  await expect.poll(displacement).toBeLessThan(3);
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  await page.getByRole('button', { name: 'Back to work', exact: true }).click();
  for(const selector of ['.md-agents','.station-subagents']){const group=page.locator(selector).first();if(await group.getAttribute('open')===null)await group.locator(':scope > summary').click();}
  await page.getByRole('switch', { name: 'Filter by Explore agent', exact: true }).click();
  await expect.poll(displacement).toBeLessThan(3);
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('button', { name: 'Daylight', exact: true }).click();
  await page.getByRole('button', { name: 'Close Workspace settings' }).click();
  await expect.poll(displacement).toBeLessThan(3);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') {
    await page.screenshot({ path: resolve('.local/product-workspace-light.png') });
    await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
    await page.getByRole('button', { name: 'Jet Black', exact: true }).click();
    await page.getByRole('button', { name: 'Close Workspace settings' }).click();
    await page.screenshot({ path: resolve('.local/product-workspace.png') });
  }
});


test('history activity timeline opens recorded failures and edits; named palettes switch', async ({ page }) => {
  await page.goto(`${demoUrl()}&experience=modern`);
  await page.getByLabel('More workspace options').click();
  await page.locator('.prompt-menu > summary').click();
  const timeline = page.getByRole('group', { name: 'Activity' });
  await expect(timeline).toContainText('2 edits · 1 failed · 2 passed');
  await timeline.getByRole('button', { name: 'Next failure' }).click();
  const failing = page.locator('article.op.selected');
  await expect(failing).toHaveClass(/st-error/);
  await expect(failing).toHaveAttribute('aria-label', /npm test/);
  await expect(failing).toBeInViewport({ ratio: 0.01 });
  await timeline.getByRole('button', { name: 'Next edit' }).click();
  await expect(page.locator('article.op.selected')).toHaveAttribute('aria-label', /Edit src\/checkout\/guard\.ts/);
  await timeline.getByRole('button', { name: 'Previous failure' }).click();
  await expect(page.locator('article.op.selected')).toHaveClass(/st-error/);
  // Ticks are a pointer shortcut and never enter the accessibility tree.
  await expect(timeline.locator('.activity-strip')).toHaveAttribute('aria-hidden', 'true');

  // Jet uses a static dot field, removed by the explicit low-resource preference.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'jet');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)');
  expect(await page.locator('.viewer').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('radial-gradient');
  expect(await page.evaluate(() => getComputedStyle(document.body, '::after').content)).toBe('none');
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
  await dialog.getByRole('button', { name: 'Midnight', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'midnight');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(3, 6, 13)');
  await dialog.getByRole('button', { name: 'Daylight', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'paper');
  await dialog.getByRole('button', { name: 'Jet Black', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'jet');
  await dialog.getByRole('tab',{name:'Reading',exact:true}).click();
  await dialog.getByRole('checkbox', { name: /^Low resource mode/ }).check();
  expect(await page.evaluate(() => getComputedStyle(document.body, '::after').content)).toBe('none');
});


test('prompt chapters review work without movie controls and resize detail by keyboard', async ({ page }) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto(demoUrl());
  await page.getByLabel('More workspace options').click();
  await page.locator('.prompt-menu > summary').click();
  const navigation = page.getByRole('navigation', {name:'Prompts'});
  await expect(navigation.locator('.prompt-chapters button').first()).toBeVisible();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toHaveCount(0);
  await navigation.locator('.prompt-chapters button').first().click();
  await expect(page.locator('.turn').first()).toBeInViewport({ratio:.1});
  await expect(navigation.getByRole('button',{name:'Follow from prompt'})).toBeVisible();
  await expect(page.locator('.workspace-context')).not.toContainText('Sequence replay');
  await page.getByLabel('More workspace options').click();
  const read = page.locator('article.op-read').first();
  await read.locator('.op-head .op-kind').first().click();
  const inspector = page.getByRole('region',{name:'Operation detail'});
  await expect(inspector).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('More workspace options').click();
  await page.locator('.prompt-menu > summary').click();
  await navigation.locator('.prompt-chapters button').first().click();
  await navigation.getByRole('button',{name:'Follow from prompt'}).click();
  await expect(page.getByRole('button',{name:'Full history',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toHaveCount(0);
  await page.locator('.history').dispatchEvent('wheel', { deltaY: -200 });
  await page.getByRole('button', {name:/Back to latest/}).click();
  await expect(page.getByRole('button',{name:'Full history',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Full history',exact:true}).click();
  await expect(page.getByRole('button',{name:'Full history',exact:true})).toHaveCount(0);
  if(process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({path:resolve('.local/prompt-workspace.png')});
});


test('a write with an after-state and no patch opens its actual source instead of an empty change', async ({ page }) => {
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const write = sample.projection.operations.find((o: {detail:{kind:string};artifactIds:string[]}) => o.detail.kind === 'edit' && o.artifactIds.some(id => id.endsWith('_after')));
  write.kind = 'write'; write.title = 'Write ' + write.detail.path; write.detail.hunks = [];
  await page.route('**/demo/bundle.json', route => route.fulfill({contentType:'application/json',body:JSON.stringify(sample)}));
  await page.goto(demoUrl());
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByPlaceholder('Search prose, commands, paths…').fill(write.title);
  await page.locator('.search-results button').first().click();
  const inspector = page.getByRole('region',{name:'Operation detail'});
  await expect(inspector).toContainText('cart.total == null');
  await page.keyboard.press('Escape');
  const action = page.locator(`article[data-op-id="${write.id}"]`);
  await expect(action).toContainText('cart.total == null');
  await action.getByRole('button',{name:/Expand/}).click();
  await expect(action.locator('.artifact-reader')).toContainText('cart.total == null');
  await expect(action).not.toContainText('No change recorded');
});


test('paged prompt rail spans the full session and loads an older chapter on selection', async ({ page }) => {
  const journal = join(dir, 'prompt-rail.jsonl');
  const timestamp = '2026-10-09T00:00:00Z';
  const rows = [JSON.stringify({ timestamp, type: 'session_meta', payload: { id: 'rail-session', cwd: '/home/dev/shop' } })];
  for (let i = 0; i < 70; i++) {
    rows.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `Rail prompt ${i}` }] } }));
    rows.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: `Rail response ${i}` }] } }));
  }
  writeFileSync(journal, rows.join('\n') + '\n');
  const { recordingId } = await app.ingest.importSource('codex', journal);
  // Exercise paged navigation without fabricating ten thousand prompt bodies.
  await page.route('**/v1/recordings', async route => {
    const response = await route.fetch();
    const data = await response.json();
    for (const recording of data.recordings) if (recording.id === recordingId) recording.observationCount = 10001;
    await route.fulfill({ response, json: data });
  });
  await page.addInitScript(() => localStorage.setItem('drishya.lowResource', '1'));
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(new URL(`/#/r/${recordingId}`, server.launchUrl).href);
  const rail = page.getByRole('navigation', { name: 'Prompt positions in history' });
  await rail.hover();
  await rail.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(rail.getByRole('button').last()).toHaveAttribute('aria-label', 'Go to prompt: Rail prompt 69');
  await rail.evaluate(node => { node.scrollTop = 35 * 16; });
  await expect(rail.getByRole('button', { name: 'Go to prompt: Rail prompt 35', exact: true })).toBeVisible();
  await rail.evaluate(node => { node.scrollTop = 0; });
  await expect(rail.getByRole('button').first()).toHaveAttribute('aria-label', 'Go to prompt: Rail prompt 0');
  await rail.getByRole('button').first().click();
  await expect(page.locator('.turn').first()).toContainText('Rail prompt 0');
  await expect(page.locator('.turn').first()).toBeInViewport();
  await expect(rail.getByRole('button').first()).toHaveAttribute('aria-current', 'location');
  await rail.getByRole('button').first().hover();
  await expect(page.locator('.prompt-rail-preview time')).toHaveAttribute('datetime','2026-10-09T00:00:00Z');
  await expect.poll(async () => rail.locator('.prompt-rail-tick').evaluateAll(nodes => nodes.slice(0, 3).map(node => Math.round(node.getBoundingClientRect().width)))).toEqual([8, 8, 8]);
});

test('prompt marks jump to prompt starts without starting a native turn', async ({ page }) => {
  await page.goto(demoUrl());
  const rail = page.getByRole('navigation', { name: 'Prompt positions in history' });
  await rail.getByRole('button').first().click();
  await expect(rail.getByRole('button').first()).toHaveAttribute('aria-current', 'location');
  await rail.getByRole('button').first().hover();
  await expect(page.locator('.prompt-rail-preview').first()).toBeVisible();
  await expect(page.locator('.prompt-rail-preview').first()).toContainText('Prompt 1');
  await expect(rail.getByRole('button').first()).toHaveAttribute('data-proximity', 'current');
  await expect(rail.getByRole('button').nth(1)).toHaveAttribute('data-proximity', 'near');
  // Assert visible lengths, including the finite scale easing, rather than layout widths.
  await expect.poll(async () => rail.locator('.prompt-rail-tick').evaluateAll(nodes => nodes.slice(0, 2).map(node => Math.round(node.getBoundingClientRect().width)))).toEqual([8, 8]);
  await expect(page.locator('.turn').first()).toBeInViewport({ ratio: .5 });
  await expect(page.getByRole('button', { name: /Back to latest/ })).toHaveText('↓');
  await expect(page.locator('.history-transport .prompt-menu')).toHaveCount(0);
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect(page.getByRole('button', { name: /Back to latest/ })).toHaveCount(0);
  await expect(rail.getByRole('button').last()).toHaveAttribute('aria-current', 'location');
});


test('hover reading lifts the same material, keeps its slot and switches without losing follow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(demoUrl());
  const history = page.locator('.history');
  await expect(page.locator('article.op-test').last()).toBeVisible();
  const viewport = (await history.boundingBox())!;
  await page.mouse.move(viewport.x + viewport.width - 2, 180);
  await page.mouse.wheel(0, -10000);
  await expect.poll(() => history.evaluate(el => el.scrollTop)).toBe(0);
  await page.mouse.move(1400, 850);
  await expect.poll(() => history.evaluate(el => [...el.querySelectorAll('article')].flatMap(card => card.getAnimations()).filter(a => a.playState === 'running').length)).toBe(0);
  const first = page.locator('article.op-read').first();
  const second = page.locator('article.op-search').first();
  const id = await first.getAttribute('data-op-id');
  const firstRect = (await first.boundingBox())!;
  const before = await second.boundingBox();
  const scroll = await history.evaluate(el => el.scrollTop);
  await first.locator('.op-body').hover();
  await page.waitForTimeout(500);
  await expect(first).not.toHaveAttribute('data-hover-reading', 'focused');
  await first.evaluate(el => {
    const samples: { width: number; height: number; scale: number; time: number }[] = []; (window as any).hoverGeometry = samples;
    const end = performance.now() + 1500;
    const sample = () => { const r = el.getBoundingClientRect(); samples.push({ width: r.width, height: r.height, scale: new DOMMatrixReadOnly(getComputedStyle(el).transform).m11, time: performance.now() }); if (performance.now() < end) requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
  });
  await page.mouse.move(firstRect.x + 20, firstRect.y + 20);
  await expect(first).toHaveAttribute('data-hover-reading', 'focused');
  await expect(page.locator(`article[data-op-id="${id}"]`)).toHaveCount(1);
  await expect(page.locator('.hover-reading-slot')).toHaveCount(1);
  expect(await history.evaluate(el => el.scrollTop)).toBe(scroll);
  expect(Math.abs((await second.boundingBox())!.y - before!.y)).toBeLessThan(2);
  await expect.poll(() => first.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  const geometry = await page.evaluate(() => (window as any).hoverGeometry as { width: number; height: number; scale: number; time: number }[]);
  expect(geometry.some(sample => sample.scale < .98)).toBe(true);
  // Missed JS sampling frames under load are not a discontinuity in compositor motion.
  expect(Math.max(...geometry.slice(1).map((sample, i) => Math.abs(sample.width - geometry[i]!.width) * Math.min(1, 16.7 / Math.max(1, sample.time - geometry[i]!.time))))).toBeLessThan(65);
  const focusRect = (await first.boundingBox())!;
  expect(await first.locator('.op-body').evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  expect(focusRect.x).toBeGreaterThanOrEqual(viewport.x + 15);
  expect(focusRect.x + focusRect.width).toBeLessThanOrEqual(viewport.x + viewport.width - 15);
  expect(focusRect.y).toBeGreaterThanOrEqual(70);
  expect(focusRect.y + focusRect.height).toBeLessThanOrEqual(884);
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/hover-reading.png') });
  await page.mouse.move(1400, 850);
  await expect(page.locator('.hover-reading-slot')).toHaveCount(0);
  await second.locator('.op-head .op-title').hover();
  await expect(second).toHaveAttribute('data-hover-reading', 'focused');
  await expect.poll(() => page.locator('.hover-reading-slot').count()).toBe(1);
  await page.mouse.move(firstRect.x + 20, firstRect.y + 20);
  await expect(first).toHaveAttribute('data-hover-reading', 'focused');
  await expect.poll(() => first.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  await first.locator('.ln-tx').filter({ hasText: /\S/ }).first().click({ clickCount: 3 });
  await expect.poll(() => page.evaluate(() => getSelection()?.toString().length ?? 0)).toBeGreaterThan(0);
  await page.mouse.move(1400, 850);
  await page.waitForTimeout(350); // Leaving must not remove selected text during copy.
  await expect(first).toHaveAttribute('data-hover-reading', 'focused');
  await page.keyboard.press('Escape');
  await page.evaluate(() => getSelection()?.removeAllRanges());
  await expect(page.locator('.hover-reading-slot')).toHaveCount(0);
  await expect(page.locator('.op[data-hover-reading]')).toHaveCount(0);
  expect(await history.evaluate(el => el.scrollTop)).toBe(scroll);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(firstRect.x + 20, firstRect.y + 20);
  await expect(first).toHaveAttribute('data-hover-reading', 'focused');
  expect(await first.evaluate(el => el.getAnimations().filter(a => a.id.startsWith('reading-focus-')).length)).toBe(0);
  await page.mouse.move(1400, 850);
  await expect(page.locator('.hover-reading-slot')).toHaveCount(0);
  await first.locator('.op-head .op-title').hover();
  await expect(first).toHaveAttribute('data-hover-reading', 'focused');
  await first.locator('.op-head').hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => history.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(first).toHaveAttribute('data-hover-reading', 'focused');
  await page.keyboard.press('Escape');
  await expect(page.locator('.hover-reading-slot')).toHaveCount(0);
});


test('full-height world sits beneath progressive edge chrome and prompt typography matches prose', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(demoUrl());
  await expect(page.locator('article.op-test').last()).toBeVisible();
  await page.getByRole('navigation', { name: 'Prompt positions in history' }).getByRole('button').first().click();
  await expect(page.locator('.turn-text').first()).toBeVisible();
  const sizes = await page.evaluate(() => ({ prompt: getComputedStyle(document.querySelector('.turn-text')!).fontSize, response: getComputedStyle(document.querySelector('.prose:not(.prose-reasoning)')!).fontSize, blur: getComputedStyle(document.querySelector('.workspace-header')!).backdropFilter, main: document.querySelector('.main')!.getBoundingClientRect().toJSON() }));
  expect(sizes.prompt).toBe('15px'); expect(sizes.response).toBe(sizes.prompt);
  expect(sizes.blur).toBe('none'); expect(sizes.main.y).toBe(0); expect(sizes.main.height).toBe(900);
  const headerBottom = await page.locator('.workspace-header').evaluate(el => el.getBoundingClientRect().bottom);
  await expect.poll(() => page.locator('.turn-text').first().evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerBottom + 8);
  const time = page.locator('.captured-time').first();
  await time.focus();
  await expect.poll(() => time.locator('.captured-clock').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
});

test('spatial camera orbits both axes and resumes after manual navigation; reduced motion stops automatic orbit', async ({ page }) => {
  await page.goto(demoUrl());
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Workspace settings' });
  await settings.getByRole('tab',{name:'Reading',exact:true}).click();
  await settings.getByRole('checkbox', { name: /^3D repository map/ }).check();
  await settings.getByRole('checkbox', { name: /^Slow background orbit/ }).check();
  await settings.getByRole('combobox', { name: 'Exposed reasoning detail' }).selectOption('collapsed');
  await settings.getByRole('button', { name: 'Close Workspace settings' }).click();
  await page.mouse.move(10, 800);
  const map = page.locator('.map');
  await expect(map).toHaveAttribute('data-map-depth', 'spatial-3d');
  await expect(map.locator('[data-spatial-renderer="webgl"]')).toBeVisible();
  await expect(map.locator('.map-file-label')).toHaveCount(0);
  const first = await map.getAttribute('data-map-yaw');
  await expect.poll(() => map.getAttribute('data-map-yaw')).not.toBe(first);
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  await expect(map).toHaveClass(/exploring/);
  // Labels move with camera/palette/layout. Drag actual canvas, not a hard-coded
  // point that can now land on a file label and correctly decline camera input.
  const drag = await map.evaluate(el => {
    const r = el.getBoundingClientRect();
    for (let y = Math.max(200, r.top + 80); y < r.bottom - 180; y += 70) {
      for (let x = Math.max(300, r.left + 80); x < r.right - 160; x += 90) {
        if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y };
      }
    }
    throw new Error('No exposed canvas for camera drag');
  });
  await page.mouse.move(drag.x, drag.y); await page.mouse.down();
  await page.mouse.move(drag.x + 110, drag.y + 55, { steps: 12 }); await page.mouse.up();
  const stopped = await map.getAttribute('data-map-yaw');
  expect(stopped).not.toBe(first);
  expect(Number(await map.getAttribute('data-map-pitch'))).toBeGreaterThan(.4);
  await page.waitForTimeout(300);
  expect(await map.getAttribute('data-map-yaw')).toBe(stopped);
  await expect.poll(() => map.getAttribute('data-map-yaw'), { timeout: 15_000 }).not.toBe(stopped);
  if (process.env.DRISHYA_REVIEW_SHOTS) await page.screenshot({ path: '.local/spatial-map-review.png' });
  await page.getByRole('button', { name: 'Back to work', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await map.getAttribute('data-map-yaw');
  await page.waitForTimeout(300);
  expect(await map.getAttribute('data-map-yaw')).toBe(reduced);
  expect(await page.evaluate(() => localStorage.getItem('drishya.reasoningDetail'))).toBe('collapsed');
});


// Retired Studio-only working-set and split-navigation compositions are not shipped.
// Modern navigation and file reading remain covered above and in repository-navigation.

test('local preview reopens actual imported evidence and never falls back to the synthetic sample', async ({ page }) => {
  const recording = app.store.listRecordings()[0]!;
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(new URL(`/?experience=modern#/r/${recording.id}`, server.launchUrl).href);
  await expect(page.locator('.history')).toBeVisible();
  await page.evaluate(()=>localStorage.setItem('drishya-dev-tools','1'));await page.getByLabel('More workspace options').click();
  await page.getByRole('button', { name: 'Use this session as local preview' }).click();
  await expect(page.getByRole('button', { name: 'Local preview selected ✓' })).toBeVisible();
  await page.getByRole('link', { name: 'Open local preview' }).click();
  await expect(page).toHaveURL(/demo=local/);
  await expect(page.locator('.history')).toBeVisible();
  await expect(page.locator('.crown-sample')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('drishya-local-preview-v1'))).toBe(recording.id);
  await page.evaluate(() => localStorage.setItem('drishya-local-preview-v1', 'missing-recording'));
  await page.reload();
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Your sessions.'})).toBeVisible();
  await expect(page.locator('.history')).toHaveCount(0);
});
