import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// Synthetic only: one read, fifty-two search matches and thirty edits; search-only pages are not timeline steps.
let dir: string, root: string, id: string, app: App, server: RunningServer;
const EDITS = 30;
const file = () => join(root, 'src', 'total.ts');
const stamp = (n: number) => `2026-10-25T10:${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}Z`;
const line = (n: number) => `export const total = ${n}; // v${n}`;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-file-pages-')); root = join(dir, 'repo'); mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(file(), line(EDITS) + '\n');
  const base = (n: number) => ({ cwd: root, sessionId: '77777777-7777-4777-8777-777777777777', timestamp: stamp(n) });
  const rows: unknown[] = [
    { ...base(0), type: 'user', uuid: 'u0', message: { role: 'user', content: 'Raise the total thirty times' } },
    { ...base(1), type: 'assistant', uuid: 'a-read', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: file() } }] } },
    { ...base(1), type: 'user', uuid: 'r-read', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read-1', content: `1\t${line(0)}` }] } },
  ];
  for (let n = 0; n < 52; n++) rows.push(
    { ...base(1), type: 'assistant', uuid: `a-search-${n}`, message: { role: 'assistant', content: [{ type: 'tool_use', id: `search-${n}`, name: 'Grep', input: { path: root, pattern: 'total' } }] } },
    { ...base(1), type: 'user', uuid: `r-search-${n}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `search-${n}`, content: `${file()}:1:export const total = 0;` }] } },
  );
  for (let n = 1; n <= EDITS; n++) {
    rows.push(
      { ...base(n + 1), type: 'assistant', uuid: `a-edit-${n}`, message: { role: 'assistant', content: [{ type: 'tool_use', id: `edit-${n}`, name: 'Edit', input: { file_path: file(), old_string: line(n - 1), new_string: line(n) } }] } },
      { ...base(n + 1), type: 'user', uuid: `r-edit-${n}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `edit-${n}`, content: 'The file has been updated.' }] } },
    );
  }
  const journal = join(dir, 'session.jsonl'); writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-file-pages' });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

async function openWork(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue());
  await page.goto(`${server.url}/?experience=modern&motion=0#token=${server.token}`);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.locator('.viewer')).toBeVisible();
  if (!await page.locator('.folder-explorer').isVisible()) await page.getByRole('button', { name: 'Show files', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find repository files', exact: true }).fill('src/total.ts');
  await page.locator('[data-spine-path="src/total.ts"]').first().click();
  const disk = page.getByRole('dialog', { name: 'src/total.ts', exact: true });
  if (await disk.isVisible()) await disk.getByRole('button', { name: 'Agent work on this file' }).click();
  const work = page.getByRole('dialog', { name: 'Work on src/total.ts', exact: true });
  await expect(work).toBeVisible();
  return work;
}

test('Previous and Next change keep chronological ordinals across newest-first and search-only pages', async ({ page }) => {
  const work = await openWork(page);
  const steps = work.getByRole('group', { name: /Step through reads and edits/ });
  const previous = steps.getByRole('button', { name: 'Previous change', exact: true }), next = steps.getByRole('button', { name: 'Next change', exact: true });
  const label = steps.getByRole('status');
  await expect(label).toHaveText('31 of 31');
  await expect(next).toBeDisabled();
  await expect(work).toContainText(line(30));
  await previous.focus();
  // Step back from the newest edit down through page 1 (edits 30..7).
  for (let n = 30; n >= 8; n--) await previous.click();
  await expect(label).toHaveText('8 of 31');
  await expect(work).toContainText(line(7));
  // Keep the selected row scrolled into view as Previous steps down the list.
  const inView = await work.locator('.file-op[aria-pressed="true"]').evaluate(el => {
    const r = el.getBoundingClientRect(), p = el.closest('.file-trail')!.getBoundingClientRect();
    return r.top >= p.top - 1 && r.bottom <= p.bottom + 1;
  });
  expect(inView).toBe(true);
  // Crossing from page 1 to page 2 (edits 6..1 and searches) lands cleanly on step 7.
  await previous.click();
  await expect(label).toHaveText('7 of 31');
  await expect(work).toContainText(line(6));
  await expect(work.locator('.file-op[aria-pressed="true"]')).toHaveCount(1);
  // Stepping forward crosses back up onto page 1.
  await next.click();
  await expect(label).toHaveText('8 of 31');
  await expect(work).toContainText(line(7));
  // Stepping all the way down crosses the 52 search-only entries to the opening read.
  // One step at a time, each waiting for its ordinal: `while (isEnabled) click` raced the last step, which disabled the button
  // after isEnabled had answered, and the next click then waited out the test (90 s, locally under load, 18 Nov).
  for (let n = 8; n > 1; n--) { await previous.click(); await expect(label).toHaveText(`${n - 1} of 31`); }
  await expect(work).toContainText(line(0));
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(next).toBeFocused();
});

test('the page label keeps the type floor and explains the page crossing', async ({ page }) => {
  const work = await openWork(page);
  const steps = work.getByRole('group', { name: /Step through reads and edits/ });
  const size = await steps.getByRole('status').evaluate(el => getComputedStyle(el).fontSize);
  expect(size).toBe('11px');
  await expect(steps.getByRole('status')).toHaveAttribute('title', /whole session/);
});


test('retained off-page selection keeps its ordinal and steps relative to itself, not the action page', async ({ page }) => {
  const work = await openWork(page);
  const steps = work.getByRole('group', { name: /Step through reads and edits/ });
  const previous = steps.getByRole('button', { name: 'Previous change', exact: true });
  const next = steps.getByRole('button', { name: 'Next change', exact: true });
  await expect(steps.getByRole('status')).toHaveText('31 of 31');
  await work.locator('.file-pagination').getByRole('button', { name: 'Next', exact: true }).click();
  await expect(steps.getByRole('status')).toHaveText('31 of 31');
  await previous.click();
  await expect(steps.getByRole('status')).toHaveText('30 of 31');
  await expect(work).toContainText(line(29));
  await work.getByRole('textbox', { name: 'Filter actions on this file' }).fill('Edit');
  await expect(steps.getByRole('status')).toHaveText('30 of 30 · filtered');
  await expect(next).toBeDisabled();
});

test('daemon timeline metadata stays bounded and respects replay visibility, filter and exact path', async ({ page }) => {
  await openWork(page);
  const projection = app.projection(id);
  const first = projection.operations.find(op => op.detail.kind === 'read')!;
  const base = `${server.url}/v1/recordings/${id}/file-operations`;
  const request = async (extra: Record<string, string>) => (await page.request.get(`${base}?${new URLSearchParams({ path: 'src/total.ts', count: '2', selected: first.id, ...extra })}`)).json();
  const full = await request({});
  expect(full.operations).toHaveLength(2);
  expect(full.operations[0].id).not.toBe(first.id);
  expect(full.timeline.total).toBe(31);
  expect(full.timeline.selected.position).toBe(1);
  expect(full.timeline.selected.next.start).toBeGreaterThan(24);
  const hidden = await request({ step: '0' });
  expect(hidden.timeline.total).toBe(0);
  expect(hidden.timeline.selected).toBeUndefined();
  const filtered = await request({ q: 'Edit' });
  expect(filtered.timeline.total).toBe(30);
  expect(filtered.timeline.selected).toBeUndefined();
  expect((await request({ path: 'not-captured.ts' })).timeline.total).toBe(0);
});


test('off-page evidence waits for its own ordinal before a rapid previous click', async ({ page }) => {
  const work = await openWork(page);
  const steps = work.getByRole('group', { name: /Step through reads and edits/ });
  const previous = steps.getByRole('button', { name: 'Previous change', exact: true });
  await expect(steps.getByRole('status')).toHaveText('31 of 31');
  const latestKey = await work.getByRole('combobox', { name: 'First step', exact: true }).inputValue();
  const pageNext = work.locator('.file-pagination').getByRole('button', { name: 'Next', exact: true });
  for (let n = 0; n < 3; n++) { await pageNext.click(); await expect(work.locator('.file-pagination span')).toContainText(`${25 + 24*n}`); }
  await work.getByRole('button', { name: 'Compare evidence', exact: true }).click();
  const select = work.getByRole('combobox', { name: 'First step', exact: true });
  const other = await select.locator('option').evaluateAll((options, current) => options.map(op => (op as HTMLOptionElement).value).find(value => value !== current && value.endsWith('/read')), latestKey);
  const readSelection = page.waitForResponse(response => response.url().includes('/file-operations?') && new URL(response.url()).searchParams.get('selected') === other!.replace(/\/read$/, ''));
  await select.selectOption(other!);
  await readSelection;
  await page.route('**/file-operations?**', async route => { if (new URL(route.request().url()).searchParams.get('selected') === latestKey.replace(/\/(patch|before|after)$/, '')) await new Promise(resolve => setTimeout(resolve, 350)); await route.continue(); });
  await select.selectOption(latestKey);
  await work.getByRole('button', { name: 'Single evidence', exact: true }).click();
  await expect(previous).toBeDisabled();
  await expect(steps.getByRole('status')).toHaveText('31 of 31');
  await expect(previous).toBeEnabled();
  await previous.click();
  await expect(steps.getByRole('status')).toHaveText('30 of 31');
});
