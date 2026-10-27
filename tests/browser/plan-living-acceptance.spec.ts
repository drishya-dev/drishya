import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { PLAN_ITEMS, PLAN_REVISIONS, planItems, planPrompt, planRows } from '../fixtures/plan-living.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-living-plan-browser-'));
  app = new App(join(dir, 'store'));
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});
const serialize = (rows: readonly object[]) => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
async function open(page: Page, id: string, at?: number) {
  await page.goto(`${server.url}/?experience=modern&motion=0${at === undefined ? '' : `&at=${at}`}#/r/${id}`);
  await expect(page.getByRole('region', { name: 'Captured work' })).toBeVisible();
}

for (const width of [600, 1440]) test(`thirteen captured revisions keep one live checklist and every earlier list readable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const session = `living-${width}`, source = join(dir, session + '.jsonl');
  writeFileSync(source, serialize([planPrompt(dir, session), ...planRows(dir, session, 0)]));
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible(); await open(page, id);
  const pinned = page.locator('.turn .plan-pinned');
  await expect(pinned).toHaveCount(1); await expect(pinned).toContainText('Plan · 0 of 12 done');
  await pinned.evaluate(el => el.setAttribute('data-acceptance-stable', 'yes'));
  for (let revision = 1; revision < PLAN_REVISIONS; revision++) {
    // Only this synthetic scratch journal is appended. Native journals are never written.
    appendFileSync(source, serialize(planRows(dir, session, revision)));
    await app.ingest.sync(id);
    await expect(pinned).toContainText(`Plan · ${revision} of 12 done · revision ${revision + 1}`);
    await expect(pinned).toHaveAttribute('data-acceptance-stable', 'yes');
    await expect(pinned.locator('li')).toHaveCount(8);
    if (revision < PLAN_ITEMS) await expect(pinned.locator('li.plan-in_progress')).toContainText(planItems(revision)[revision]!.content);
    await expect(page.locator('article.op-plan .plan-list')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Plan checklist' })).toHaveCount(1);
  }
  const showAll = pinned.getByRole('button', { name: 'Show all 12', exact: true });
  await showAll.focus(); await showAll.press('Enter');
  await expect(pinned.locator('li')).toHaveCount(12);
  await expect(pinned.locator('li.plan-completed')).toHaveCount(12);
  await expect(pinned.locator('.plan-text').first()).toHaveCSS('text-decoration-line', 'line-through');
  await expect(pinned.getByRole('button', { name: 'Show fewer', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await pinned.getByRole('button', { name: 'Show fewer', exact: true }).press('Enter');
  await expect(pinned.locator('li')).toHaveCount(8);

  const cards = page.locator('article.op-plan');
  await expect(cards).toHaveCount(PLAN_REVISIONS);
  const expand = cards.last().locator('button.op-expand');
  await expand.focus(); await expand.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  const full = cards.last().locator('.plan-material');
  await expect(full).toBeVisible();
  for (let revision = PLAN_REVISIONS; revision >= 1; revision--) {
    await expect(full).toContainText(`Revision ${revision} · ${revision - 1} of 12 done`);
    await expect(full.locator('li')).toHaveCount(12);
    await expect(full.locator('li.plan-completed')).toHaveCount(revision - 1);
    if (revision > 1) await full.getByRole('button', { name: 'Earlier revision', exact: true }).press('Enter');
  }
  await expect(full.getByRole('button', { name: 'Earlier revision', exact: true })).toBeDisabled();
  for (let revision = 2; revision <= PLAN_REVISIONS; revision++) {
    await full.getByRole('button', { name: 'Later revision', exact: true }).press('Enter');
    await expect(full).toContainText(`Revision ${revision} · ${revision - 1} of 12 done`);
  }
  await expect(full.getByRole('button', { name: 'Later revision', exact: true })).toBeDisabled();
  await expand.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  const follow = page.getByRole('switch', { name: 'Automatically follow new work', exact: true });
  if (await follow.getAttribute('aria-checked') === 'true') await follow.click();
  await pinned.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await expect(pinned).toBeInViewport();
  await page.screenshot({ path: resolve(`.local/content4/fixture-live-${width}.png`), animations: 'disabled' });
  expect(await pinned.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);

  // Seek backward after all future snapshots are already stored. No final list may leak back.
  const projection = app.projection(id);
  for (const revision of [0, 6, 12, 1]) {
    const op = projection.operations[revision]!;
    const step = projection.timeline.findIndex(item => item.type === 'op-start' && item.operationId === op.id) + 1;
    await open(page, id, step);
    await expect(pinned).toHaveCount(1);
    await expect(pinned).toContainText(`Plan · ${revision} of 12 done`);
    await expect(pinned).toHaveAttribute('title', `The agent's newest captured todo list, revision ${revision + 1} of ${revision + 1}`);
    await expect(page.locator('article.op-plan .plan-list')).toHaveCount(0);
  }
  await open(page, id, 0); await expect(pinned).toHaveCount(0);
  await open(page, id); await expect(pinned).toContainText('Plan · 12 of 12 done · revision 13');
});

test('unknown and empty captured states use a neutral mark, retain literal accessible status and claim no transition', async ({ page }) => {
  const session = 'living-unknown', source = join(dir, session + '.jsonl');
  const rows: object[] = [planPrompt(dir, session)];
  for (let revision = 0; revision < 2; revision++) {
    const pair = planRows(dir, session, revision);
    const input = pair[0]!.message.content[0]!.input;
    if (!input) throw new Error('Missing synthetic TodoWrite input');
    input.todos = [
      { content: 'Unfamiliar state', status: revision ? 'pending' : 'waiting-for-review', activeForm: 'Checking' },
      { content: 'Still unfamiliar', status: 'waiting-for-review', activeForm: 'Checking' },
      { content: 'Missing state', status: '', activeForm: 'Checking' },
    ];
    rows.push(...pair);
  }
  writeFileSync(source, serialize(rows));
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;
  await page.setViewportSize({ width: 1024, height: 960 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible(); await open(page, id);
  const pinned = page.locator('.turn .plan-pinned');
  await expect(pinned).toContainText('0 of 3 done');
  const unfamiliar = pinned.locator('li').filter({ hasText: 'Still unfamiliar' });
  const missing = pinned.locator('li').filter({ hasText: 'Missing state' });
  await expect(unfamiliar.locator('.plan-mark')).toHaveText('·');
  await expect(unfamiliar.locator('.sr-only')).toHaveText('(waiting-for-review)');
  await expect(missing.locator('.plan-mark')).toHaveText('·');
  await expect(missing).not.toHaveClass(/plan-pending/);
  const last = page.locator('article.op-plan').last();
  await expect(last.locator('.plan-delta')).toHaveCount(0);
  const expand = last.locator('button.op-expand'); await expand.focus(); await expand.press('Enter');
  await expect(last.locator('.plan-material .plan-change')).toHaveCount(0);
});
