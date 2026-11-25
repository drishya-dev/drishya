import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';
import { createAntigravityAdapter } from '../../packages/adapter-antigravity/src/index.ts';

let root: string, app: App, server: RunningServer, parent: string, spawn: string;
const children: string[] = [];
const row = (step_index: number, type: string, extra: Record<string, unknown> = {}) => ({ step_index, type, source: 'MODEL', status: 'DONE', created_at: '2026-11-14T00:00:00Z', content: '', tool_calls: [], ...extra });
const journal = (id: string, rows: unknown[]) => {
  const path = join(root, 'brain', id, '.system_generated', 'logs', 'transcript.jsonl');
  mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n'); return path;
};

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'drishya-ag-live-browser-test-')); app = new App(join(root, 'store'));
  const index = app.ingest.adapters.findIndex(adapter => adapter.descriptor.id === 'antigravity');
  if (index < 0) throw new Error('Antigravity registration missing');
  app.ingest.adapters.splice(index, 1, createAntigravityAdapter([root]));
  const path = journal('parent', [row(0, 'USER_INPUT', { source: 'USER_EXPLICIT', content: 'Synthetic two-agent review' }), row(1, 'PLANNER_RESPONSE', { tool_calls: [{ name: 'invoke_subagent', args: { Prompt: JSON.stringify('Review synthetic files') } }] }), row(2, 'GENERIC', { content: 'Synthetic children recorded' })]);
  const metadata = join(root, 'brain', 'parent', '.system_generated', 'subagents'); mkdirSync(metadata);
  const db = new DatabaseSync(join(root, 'conversation_summaries.db'));
  db.exec('CREATE TABLE conversation_summaries(conversation_id TEXT,title TEXT,workspace_uris TEXT,parent_conversation_id TEXT,agent_name TEXT)');
  for (const id of ['first', 'second']) {
    db.prepare('INSERT INTO conversation_summaries VALUES(?,?,?,?,?)').run(id, 'Synthetic child', '[]', 'parent', id);
    writeFileSync(join(metadata, `${id}.json`), JSON.stringify({ conversationId: id, spawnStepIndex: 2, subagentDescriptor: { typeName: id } }));
  }
  db.close();
  for (const id of ['first', 'second']) children.push((await app.ingest.importSource('antigravity', journal(id, [row(0, 'PLANNER_RESPONSE', { content: `Synthetic ${id} reply` })]))).recordingId);
  parent = (await app.ingest.importSource('antigravity', path)).recordingId;
  spawn = app.projection(parent).operations.find(op => op.tool === 'invoke_subagent')!.id;
  server = await startServer({ app, port: 0, token: 'synthetic-ag-live-test' });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (root) { if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup'); rmSync(root, { recursive: true, force: true }); }
});

for (const width of [600, 1440]) test(`every exact Antigravity child opens at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources: [], errors: [] } }));
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?motion=0#/r/${parent}`);
  const card = page.locator(`[data-op-id="${spawn}"]`);
  await card.focus(); await page.keyboard.press('Enter');
  const thread = card.locator('details.delegation-thread'); await thread.locator('summary').click();
  const links = thread.getByRole('link', { name: /^Open child session/ });
  await expect(links).toHaveCount(2);
  for (let i = 0; i < children.length; i++) await expect(links.nth(i)).toHaveAttribute('href', `#/r/${children[i]}`);
  await links.nth(1).click(); await page.waitForURL(url => url.hash === `#/r/${children[1]}`);
  await expect(page.locator('.history')).toContainText('Synthetic second reply');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
