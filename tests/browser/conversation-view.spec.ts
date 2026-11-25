import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-conversation-')); app = new App(join(dir, 'store')); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-41: Conversation reads as the person's words and the agent's, each run of tool cards folded to one line that opens in place.
const WORDS = 'The reader keeps the line short enough to follow while the block itself uses the whole reading column of the stage. ';
async function importSession(session: string) {
  const source = join(dir, session + '.jsonl');
  const base = { cwd: dir, sessionId: session };
  const at = (n: number) => `2026-11-13T09:00:${String(n).padStart(2, '0')}Z`;
  const user = (uuid: string, n: number, content: unknown) => ({ ...base, timestamp: at(n), type: 'user', uuid, message: { role: 'user', content } });
  const say = (uuid: string, n: number, text: string) => ({ ...base, timestamp: at(n), type: 'assistant', uuid, message: { id: `m-${uuid}`, role: 'assistant', content: [{ type: 'text', text }] } });
  const call = (id: string, n: number, name: string, input: unknown) => ({ ...base, timestamp: at(n), type: 'assistant', uuid: `a-${id}`, message: { id: `m-${id}`, role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
  const result = (id: string, n: number, content: string, error = false) => ({ ...base, timestamp: at(n), type: 'user', uuid: `r-${id}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, ...(error ? { is_error: true } : {}) }] } });
  writeFileSync(source, [
    user('p1', 0, 'Fix the parser'),
    say('s1', 1, `I will read the parser first.\n\n${WORDS.repeat(10)}`),
    call('r1', 2, 'Read', { file_path: join(dir, 'a.ts') }), result('r1', 2, 'one'),
    call('r2', 3, 'Read', { file_path: join(dir, 'b.ts') }), result('r2', 3, 'two'),
    call('r3', 4, 'Read', { file_path: join(dir, 'c.ts') }), result('r3', 4, 'three'),
    call('c1', 5, 'Bash', { command: 'node build.js' }), result('c1', 6, 'boom: assertion failed', true),
    say('s2', 7, `The test failed, so the first fix was wrong.\n\n${WORDS.repeat(10)}`),
    call('r4', 8, 'Read', { file_path: join(dir, 'd.ts') }), result('r4', 8, 'four'),
    call('c2', 9, 'Bash', { command: 'node build.js' }), result('c2', 9, 'ok'),
    say('s3', 10, `Everything passes now.\n\n${WORDS.repeat(10)}`),
    user('p2', 11, 'Thanks'),
    say('s4', 12, 'You are welcome.'),
  ].map((row) => JSON.stringify(row)).join('\n') + '\n');
  return (await app.ingest.importSource('claude-code', source)).recordingId;
}

const open = async (page: Page, id: string, width = 1440, height = 800) => {
  await page.setViewportSize({ width, height });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
};
const mode = (page: Page, name: 'Work' | 'Conversation') => page.getByRole('group', { name: 'Read the session as' }).getByRole('button', { name });

test('Conversation folds each run to its line, opens it in place and remembers the choice', async ({ page }) => {
  const id = await importSession('conversation');
  await open(page, id);
  const cards = page.locator('.history article[data-op-id]'), lines = page.locator('.history .run-line');

  // Work mode is today's History: every card, no lines.
  await expect(mode(page, 'Work')).toHaveAttribute('aria-pressed', 'true');
  await expect(lines).toHaveCount(0);
  await expect.poll(() => cards.count()).toBe(6);

  // Conversation: the agent's messages with no card between them, one line per run, in the turn ledger's words.
  await mode(page, 'Conversation').click();
  await expect(mode(page, 'Conversation')).toHaveAttribute('aria-pressed', 'true');
  await expect(lines).toHaveCount(2);
  await expect(cards).toHaveCount(0);
  await expect(page.locator('.history .prose')).toHaveCount(4);
  await expect(lines.nth(0)).toContainText('read 3 · 1 command · 1 failed');
  await expect(lines.nth(1)).toContainText('read 1 · 1 command');
  // A failure is never hidden: the run that failed keeps its mark, the clean one has none.
  await expect(lines.nth(0)).toHaveAttribute('data-failed', 'true');
  await expect(lines.nth(0).locator('.run-fail')).toHaveCount(1);
  await expect(lines.nth(1)).not.toHaveAttribute('data-failed', /.*/);
  // The line is counts and outcomes only; it carries no written summary.
  expect(await lines.nth(0).innerText()).toMatch(/^[a-z0-9 ·✓✗+−()]+$/i);

  // Opening a run shows its cards exactly as Work does, and keeps the line where it was; closing puts it back.
  await lines.nth(0).scrollIntoViewIfNeeded();
  const before = (await lines.nth(0).boundingBox())!.y;
  await lines.nth(0).click();
  await expect(lines.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(cards).toHaveCount(4);
  expect(Math.abs((await lines.nth(0).boundingBox())!.y - before)).toBeLessThan(2);
  await lines.nth(0).click();
  await expect(lines.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(cards).toHaveCount(0);
  expect(Math.abs((await lines.nth(0).boundingBox())!.y - before)).toBeLessThan(2);

  // The choice is remembered for this window: a reload opens the way it was left.
  await page.waitForTimeout(1200); // the window's memory is saved to the daemon 750 ms after it changes
  await page.reload();
  await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
  await expect(mode(page, 'Conversation')).toHaveAttribute('aria-pressed', 'true');
  await expect(lines).toHaveCount(2);

  // Back to Work: every card again.
  await mode(page, 'Work').click();
  await expect(lines).toHaveCount(0);
  await expect.poll(() => cards.count()).toBe(6);
});

test('the v key switches, and Next failure opens the run that holds the failure', async ({ page }) => {
  const id = await importSession('conversation-keys');
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [{ id: '@home', entries: [['history/mode', 'conversation']] }] } }) : route.continue());
  await open(page, id);
  // A previous window can leave Conversation in the daemon's shared memory.
  await expect(mode(page, 'Conversation')).toHaveAttribute('aria-pressed', 'true');
  await mode(page, 'Work').click();
  await expect(mode(page, 'Work')).toHaveAttribute('aria-pressed', 'true');
  const history = page.locator('.history');
  await history.focus();
  await expect(history).toBeFocused();
  await page.keyboard.press('v');
  await expect(mode(page, 'Conversation')).toHaveAttribute('aria-pressed', 'true');
  const lines = page.locator('.history .run-line');
  await expect(lines).toHaveCount(2);
  await page.keyboard.press('f');
  await expect(lines.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.history article[data-op-id][aria-label*="node build.js"]').first()).toBeVisible();
  await page.keyboard.press('v');
  await expect(mode(page, 'Work')).toHaveAttribute('aria-pressed', 'true');
});

test('Follow latest and Back to latest keep working with runs folded', async ({ page }) => {
  const id = await importSession('conversation-follow');
  await open(page, id, 1440, 500);
  await mode(page, 'Conversation').click();
  const history = page.locator('.history');
  await expect.poll(async () => history.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await history.hover();
  await page.mouse.wheel(0, -4000);
  const back = page.getByRole('button', { name: /Back to latest/ });
  await expect(back).toBeVisible();
  await back.click();
  await expect.poll(async () => history.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(40);
  await expect(page.locator('.history .prose').last()).toBeInViewport();
});

test('the run in progress updates its line as operations land and keeps it when the next message lands', async ({ page }) => {
  const session = 'conversation-live', source = join(dir, session + '.jsonl');
  const base = { cwd: dir, sessionId: session };
  const at = (n: number) => `2026-11-13T10:00:${String(n).padStart(2, '0')}Z`;
  const row = (r: unknown) => JSON.stringify(r) + '\n';
  const user = (n: number, text: string) => row({ ...base, timestamp: at(n), type: 'user', uuid: `u${n}`, message: { role: 'user', content: text } });
  const say = (n: number, text: string) => row({ ...base, timestamp: at(n), type: 'assistant', uuid: `s${n}`, message: { id: `m${n}`, role: 'assistant', content: [{ type: 'text', text }] } });
  const call = (n: number, file: string) => row({ ...base, timestamp: at(n), type: 'assistant', uuid: `c${n}`, message: { id: `mc${n}`, role: 'assistant', content: [{ type: 'tool_use', id: `t${n}`, name: 'Read', input: { file_path: join(dir, file) } }] } });
  const done = (n: number) => row({ ...base, timestamp: at(n), type: 'user', uuid: `d${n}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `t${n}`, content: 'ok' }] } });
  writeFileSync(source, user(0, 'Look around') + say(1, 'Starting.') + call(2, 'a.ts') + done(2));
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;
  app.ingest.startLive(id);
  await open(page, id);
  await mode(page, 'Conversation').click();
  const lines = page.locator('.history .run-line');
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toContainText('read 1');
  // More operations land: the same line grows its counts; nothing opens by itself.
  appendFileSync(source, call(3, 'b.ts') + done(3) + call(4, 'c.ts') + done(4));
  await app.ingest.sync(id);
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toContainText('read 3');
  await expect(lines.first()).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.history article[data-op-id]')).toHaveCount(0);
  // The agent speaks: the run stays one line with its final counts, and the message arrives beneath it.
  appendFileSync(source, say(5, 'Found it.'));
  await app.ingest.sync(id);
  await expect(page.locator('.history .prose', { hasText: 'Found it.' })).toBeVisible();
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toContainText('read 3');
});

test('the prompt rail, search and replay keep working with runs folded', async ({ page }) => {
  const id = await importSession('conversation-rail');
  await open(page, id);
  await mode(page, 'Conversation').click();
  const lines = page.locator('.history .run-line');
  await expect(lines).toHaveCount(2);

  // The prompt rail lands on the prompt it names.
  const rail = page.getByRole('navigation', { name: 'Prompt positions in history' });
  await expect(rail.getByRole('button')).toHaveCount(2);
  await rail.getByRole('button').first().click();
  await expect(page.locator('.history .turn', { hasText: 'Fix the parser' })).toBeInViewport();

  // A search hit inside a folded run opens that run and shows the action.
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.locator('.search input').fill('node build.js');
  await page.locator('.search-results button').first().click();
  await expect(page.locator('.history article[data-op-id]').first()).toBeVisible();
  expect(await page.locator('.history .run-line[aria-expanded=true]').count()).toBeGreaterThan(0);

  // Replay shows the same lines and exits back to history.
  await page.evaluate(() => localStorage.setItem('drishya-dev-tools', '1'));
  await page.getByLabel('More workspace options', { exact: true }).click();
  await page.getByRole('button', { name: 'Replay this session' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  // Replay starts at the prompt; a few steps in, the first run has landed and shows as its line.
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Step forward', exact: true }).click();
  await expect(page.locator('.viewer')).toBeVisible();
  await expect(page.locator('.history .run-line').first()).toBeVisible();
  await expect(page.locator('.history article[data-op-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Exit replay', exact: true }).click();
  await expect(page.locator('.history .run-line').first()).toBeVisible();
  await expect(mode(page, 'Conversation')).toHaveAttribute('aria-pressed', 'true');
});

test('opening a run is one short transition of its real rows, interruptible, and none under reduced motion', async ({ page }) => {
  const id = await importSession('conversation-motion');
  const animations = () => page.evaluate(() => document.getAnimations().filter((a) => a.id === 'turn-fold').length);
  for (const reduced of [false, true]) {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=${reduced ? 0 : 1}#/r/${id}`);
    await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
    await mode(page, 'Conversation').click();
    const line = page.locator('.history .run-line').first();
    await page.locator('.history').hover();
    await page.mouse.wheel(0, -300);
    await line.scrollIntoViewIfNeeded();
    await line.click();
    if (reduced) { expect(await animations()).toBe(0); await expect(page.locator('.history article[data-op-id]')).toHaveCount(4); continue; }
    // Interrupting it (a second click) finishes the first at once and starts the closing one; nothing waits.
    expect(await animations()).toBeGreaterThan(0);
    await line.click();
    await expect.poll(animations).toBe(0);
    await expect(page.locator('.history article[data-op-id]')).toHaveCount(0);
  }
});
