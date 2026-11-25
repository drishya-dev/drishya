import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

// LINK-1: links in agent prose open in the browser, and hover or keyboard focus shows a card that says what the link is.
let dir: string, root: string, id: string, app: App, server: RunningServer, sha: string, journalPath: string;
const ghCalls: string[][] = [];

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-link-cards-')); root = join(dir, 'repo'); mkdirSync(join(root, 'src'), { recursive: true });
  const git = (args: string[]) => execFileSync('git', ['-c', 'user.email=a@b.test', '-c', 'user.name=Card Tester', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  git(['init', '-q', '-b', 'main']); writeFileSync(join(root, 'src', 'app.ts'), 'export const app = 1;\n'); git(['add', '.']); git(['commit', '-qm', 'Add the app module']);
  writeFileSync(join(root, 'src', 'app.ts'), 'export const app = 1;\nexport const two = 2;\n'); git(['add', '.']); git(['commit', '-qm', 'Grow the app module']);
  git(['branch', 'feature/cards']);
  sha = git(['rev-parse', 'HEAD']).trim().slice(0, 12);
  const base = { timestamp: '2026-11-10T00:00:00Z', sessionId: 'link-cards', cwd: root };
  const prose = `Read [the guide](https://example.com/guide) and https://example.com/plain, then PR https://github.com/o/r/pull/5. I changed \`src/app.ts\` in commit ${sha} on \`feature/cards\`.`;
  const rows = [
    { ...base, type: 'user', uuid: 'u1', message: { role: 'user', content: 'Show me the links' } },
    { ...base, type: 'assistant', uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 'read1', name: 'Read', input: { file_path: join(root, 'src', 'app.ts') } }] } },
    { ...base, type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read1', content: 'export const app = 1;' }] } },
    { ...base, type: 'assistant', uuid: 'a2', message: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: prose }] } },
  ];
  const journal = join(dir, 'session.jsonl'); writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n'); journalPath = journal;
  app = new App(join(dir, 'data')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  const gh = async (args: string[]) => { ghCalls.push(args); return args[0] === '--version' ? 'gh version 2' : JSON.stringify({ state: 'OPEN', title: 'Teach the cards', author: { login: 'octo' }, additions: 12, deletions: 3, changedFiles: 2 }); };
  server = await startServer({ app, port: 0, gh });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (dir && resolve(dir).startsWith(resolve(tmpdir()) + sep)) rmSync(dir, { recursive: true, force: true });
});

async function open(page: Page, width: number, own: { server: RunningServer; id: string } = { server, id }) {
  const { server, id } = own;
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue());
  await page.route('**/v1/recordings/*/live', route => route.fulfill({ json: { live: false } }));
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.locator('.history')).toBeVisible();
  await expect(page.locator('.history a.md-url').first()).toBeVisible();
}
// The page's own origin and session cookie, as the app itself would call the daemon.
const post = (page: Page, path: string, body: unknown) => page.evaluate(async ([p, b]) => (await fetch(p as string, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).ok, [path, body]);
const card = (page: Page) => page.locator('[role=tooltip].link-card');

for (const width of [600, 1440]) test.describe(`link cards at ${width}px`, () => {
  test('addresses open in the browser and show only their domain and address', async ({ page, context }) => {
    const outside: string[] = [];
    context.on('request', request => { if (new URL(request.url()).origin !== new URL(server.url).origin) outside.push(request.url()); });
    await open(page, width);
    const link = page.locator('.history a.md-url', { hasText: 'the guide' });
    await expect(link).toHaveAttribute('href', 'https://example.com/guide');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(page.locator('.history a.md-url', { hasText: 'https://example.com/plain' })).toHaveAttribute('href', 'https://example.com/plain');
    await link.hover();
    await expect(card(page)).toContainText('example.com'); await expect(card(page)).toContainText('https://example.com/guide');
    await page.mouse.move(2, 400); await expect(card(page)).toHaveCount(0);
    expect(outside).toEqual([]);
  });

  test('a file path shows its name, folder and where it is known from', async ({ page }) => {
    await open(page, width);
    const file = page.locator('.history button.md-file-reference', { hasText: 'src/app.ts' }).first();
    await file.hover();
    await expect(card(page)).toContainText('app.ts'); await expect(card(page)).toContainText('src'); await expect(card(page)).toContainText('Captured in this session');
  });

  test('a GitHub link says it is off until opted in, then asks only the signed-in gh; keyboard focus shows the same card', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    ghCalls.length = 0;
    await open(page, width);
    const pr = page.locator('.history a.md-url[href="https://github.com/o/r/pull/5"]');
    await pr.hover();
    await expect(card(page)).toContainText('GitHub details are off');
    expect(requests.some(path => path === '/v1/github/item')).toBe(false); expect(ghCalls).toEqual([]);
    await page.mouse.move(2, 400); await expect(card(page)).toHaveCount(0);
    // Opt in from Settings → Links.
    await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Workspace settings' });
    await settings.getByRole('tab', { name: 'Links', exact: true }).click();
    await settings.getByRole('checkbox', { name: 'GitHub pull request and issue cards' }).click();
    await expect(settings.getByRole('checkbox', { name: 'GitHub pull request and issue cards' })).toBeChecked();
    await page.keyboard.press('Escape'); await expect(settings).toHaveCount(0);
    await pr.focus();
    await expect(card(page)).toContainText('Teach the cards'); await expect(card(page)).toContainText('Open'); await expect(card(page)).toContainText('by octo'); await expect(card(page)).toContainText('+12 −3 · 2 files');
    await page.keyboard.press('Escape'); await expect(card(page)).toHaveCount(0);
    expect(ghCalls.filter(call => call[0] === 'pr')).toHaveLength(1);
    await post(page, '/v1/github/optin', { enabled: false });
  });

  test('a commit and a branch use read-only Git once the session approves it', async ({ page }) => {
    // Its own daemon: Git approval is per session and would carry over from the other width.
    const fresh = new App(join(dir, `data-git-${width}`)), freshId = (await fresh.ingest.importSource('claude-code', journalPath)).recordingId, freshServer = await startServer({ app: fresh, port: 0 });
    try { await openFresh(page, width, { server: freshServer, id: freshId }); await commitAndBranch(page, freshId); } finally { await freshServer.close(); await fresh.close(); }
  });
  async function openFresh(page: Page, w: number, own: { server: RunningServer; id: string }) { await open(page, w, own); }
  async function commitAndBranch(page: Page, id: string) {
    const commit = page.locator('.history .link-card-anchor[data-link-kind=commit]').first();
    await commit.scrollIntoViewIfNeeded(); await commit.hover();
    await expect(card(page)).toContainText('Approve read-only Git inspection');
    await page.mouse.move(2, 400); await expect(card(page)).toHaveCount(0);
    expect(await post(page, `/v1/recordings/${id}/workspace/approve`, { remember: false })).toBe(true);
    expect(await post(page, `/v1/recordings/${id}/git/approve`, {})).toBe(true);
    await commit.focus();
    await expect(card(page)).toContainText('Grow the app module'); await expect(card(page)).toContainText('Card Tester'); await expect(card(page)).toContainText('+1 −0 · 1 file');
    await page.keyboard.press('Escape'); await expect(card(page)).toHaveCount(0);
    const branch = page.locator('.history .link-card-anchor[data-link-kind=branch]').first();
    await branch.focus();
    await expect(card(page)).toContainText('Branch · feature/cards'); await expect(card(page)).toContainText('Grow the app module');
  }
});
