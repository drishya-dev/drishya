import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { EmbedCodes } from '../../apps/daemon/src/embed-auth.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// EMBED refined: the agent (or `drishya embed`) opens one session in its app's side pane. The pane gets the ordinary session
// view for that one session, usable from the 360 px embed minimum up, and the one-use launch code never stays anywhere.
let dir: string, app: App, server: RunningServer, claude: string, codex: string, journal: string;
const codes = new EmbedCodes();
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-embed-view-'));
  app = new App(join(dir, 'store'));
  journal = join(dir, 'embed-live.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  claude = (await app.ingest.importSource('claude-code', journal)).recordingId;
  codex = (await app.ingest.importSource('codex', resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'))).recordingId;
  server = await startServer({ app, port: 0, embedCodes: codes });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); }
});

const launch = (id: string) => `${server.url}/?embed=1&recording=${id}&motion=0#launch=${codes.mint(id)}`;
async function openPane(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(launch(id));
  await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
}
/** Nothing the page can read still holds a launch code once the pane is open. */
async function codeGone(page: Page) {
  expect(page.url()).not.toContain('launch=');
  expect(page.url()).not.toContain('recording=');
  const kept = await page.evaluate(() => [location.href, document.documentElement.outerHTML, JSON.stringify(localStorage), JSON.stringify(sessionStorage), history.length > 0 ? String(history.state) : ''].join('\n'));
  expect(/launch=|[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/.test(kept.replace(/rec_[a-f0-9]+/g, ''))).toBe(false);
}

for (const width of [360, 600, 1440]) {
  test(`a pane opens one session on Conversation, without Home or page scroll, at ${width} px`, async ({ page }) => {
    for (const id of [claude, codex]) {
      await openPane(page, id, width);
      expect(page.url()).toBe(`${server.url}/?embed=1#/r/${id}`);
      await codeGone(page);
      expect(await page.evaluate(() => document.documentElement.dataset.embed)).toBe('1');
      const conversation = page.getByRole('group', { name: 'Read the session as' }).getByRole('button', { name: 'Conversation' });
      if (await conversation.isVisible()) await expect(conversation).toHaveAttribute('aria-pressed', 'true');
      // The brand is not a way to the session library here.
      await expect(page.getByRole('button', { name: 'Drishya' })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      // Back, a stray route or a Home command all land on the same session.
      await page.evaluate(() => { location.hash = '#/'; });
      await expect(page).toHaveURL(`${server.url}/?embed=1#/r/${id}`);
      await expect(page.locator('.home')).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
    }
  });
}

test('a used or replayed link explains itself instead of opening Home', async ({ browser, page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const url = launch(claude);
  await page.goto(url);
  await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
  const fresh = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const other = await fresh.newPage();
  await other.goto(url);
  await expect(other.getByRole('heading', { name: 'This link has been used' })).toBeVisible();
  expect(other.url()).not.toContain('launch=');
  await expect(other.locator('.home')).toHaveCount(0);
  await fresh.close();
});

test('a pane for a session that is not here says so', async ({ page }) => {
  await openPane(page, claude, 600);
  await page.goto(`${server.url}/?embed=1&motion=0#/r/rec_0000000000000000`);
  await expect(page.getByRole('heading', { name: 'This session is not here' })).toBeVisible();
});

test('live work reaches an open pane at 360 px', async ({ page }) => {
  app.ingest.startLive(claude);
  await openPane(page, claude, 360);
  const marker = 'Embedded pane live marker sentence.';
  await expect(page.getByText(marker)).toHaveCount(0);
  appendFileSync(journal, JSON.stringify({ cwd: dir, sessionId: 'embed-live', timestamp: '2026-11-18T09:00:00Z', type: 'assistant', uuid: 'embed-live-1', message: { id: 'm-embed-live-1', role: 'assistant', content: [{ type: 'text', text: marker }] } }) + '\n');
  await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 });
});
