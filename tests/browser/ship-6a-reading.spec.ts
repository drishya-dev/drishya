import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { openGitDestination } from './git-navigation.ts';

let dir: string, root: string, id: string, app: App, server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ship-6a-')); root = join(dir, 'repo'); mkdirSync(root);
  execFileSync('git', ['init'], { cwd: root, windowsHide: true });
  writeFileSync(join(root, 'README.md'), 'Current file for reader navigation.\n');
  const base = { timestamp: '2026-10-26T00:00:00Z', sessionId: 'ship-6a', cwd: root };
  const journal = join(dir, 'session.jsonl');
  const rows = Array.from({ length: 24 }, (_, n) => [
    { ...base, type: 'user', uuid: `u${n}`, message: { role: 'user', content: `Inspect README.md, request ${n}` } },
    { ...base, type: 'assistant', uuid: `a${n}`, message: { id: `m${n}`, role: 'assistant', content: [{ type: 'tool_use', id: `read${n}`, name: 'Read', input: { file_path: join(root, 'README.md') } }] } },
    { ...base, type: 'user', uuid: `r${n}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `read${n}`, content: 'Recorded file.' }] } },
  ]).flat();
  writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'data')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

for (const width of [600, 1440]) test(`reader ownership and history clearance at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue());
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const workspace = page.getByRole('button', { name: 'Open developer workspace', exact: true });
  const desk = page.getByRole('region', { name: 'Developer workspace', exact: true });
  await workspace.click();
  const approve = desk.getByRole('button', { name: 'Approve workspace reading', exact: true });
  await expect(approve.or(desk.getByRole('tablist'))).toBeVisible();
  if (await approve.isVisible()) await approve.click();
  await expect(desk.getByRole('tablist')).toBeVisible();
  await desk.getByRole('button', { name: 'Back to agent', exact: true }).click();
  const history = page.locator('.history');
  await expect(history).toBeVisible();
  const boundary = await page.locator('.viewer').evaluate(el => {
    const viewer = el.getBoundingClientRect(), history = el.querySelector('.history')!.getBoundingClientRect();
    const controls = [...el.querySelectorAll('.workspace-header,.workspace-leading,.workspace-secondary')].map(node => node.getBoundingClientRect());
    return { history: history.top, controlBottom: Math.max(viewer.top, ...controls.filter(r => r.width && r.height).map(r => r.bottom)) };
  });
  expect(boundary.history).toBeGreaterThanOrEqual(boundary.controlBottom);
  await history.evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true })); });
  const latest = page.getByRole('button', { name: /Back to latest/ });
  await expect(latest).toBeVisible();
  await openGitDestination(page, 'Git review');
  const git = page.getByRole('dialog', { name: 'Git review', exact: true });
  await expect(git).toBeVisible(); await expect(latest).toBeHidden();
  const files = page.getByRole('button', { name: 'Show files', exact: true });
  if (await files.getAttribute('aria-pressed') !== 'true') await files.click();
  await page.locator('[data-spine-path="README.md"]').click();
  const peek = page.locator('.file-peek-reader');
  await expect(peek).toBeVisible(); await expect(git).toHaveCount(0);
  const returnToGit = peek.getByRole('button', { name: 'Return to Git review' });
  await expect(returnToGit).toBeVisible();
  expect(await returnToGit.evaluate(button => { const r = button.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button') === button; })).toBe(true);
  await returnToGit.click();
  await expect(git).toBeVisible(); await expect(peek).toHaveCount(0);
  await git.getByRole('button', { name: 'Return to file' }).click();
  await expect(peek).toBeVisible(); await expect(git).toHaveCount(0);
  await peek.getByRole('button', { name: 'Close README.md' }).click();
  await expect(git).toBeVisible();
  await git.getByRole('button', { name: 'Close Git review' }).click();
  await workspace.click(); await expect(desk).toBeVisible(); await expect(latest).toBeHidden();
});
