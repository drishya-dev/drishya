import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-codex-questions-')); app = new App(dir); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// CONTENT-3: a Codex question is the same card Claude gets. The call and result shapes below are the ones real Codex journals
// record: `request_user_input_async` with `title` and string options (or none), answered by `{"accepted":true}`.
test('Codex questions show as question cards with their offered options and no invented answer', async ({ page }) => {
  const stamp = (s: number) => new Date(Date.UTC(2026, 9, 22, 9, 0, s)).toISOString();
  const call = (s: number, id: string, questions: object[]) => [
    { timestamp: stamp(s), type: 'response_item', payload: { type: 'function_call', name: 'request_user_input_async', call_id: id, arguments: JSON.stringify({ questions }) } },
    { timestamp: stamp(s + 1), type: 'response_item', payload: { type: 'function_call_output', call_id: id, output: '{"accepted":true}' } },
  ];
  const rows = [
    { timestamp: stamp(0), type: 'session_meta', payload: { id: 'thread-questions', cwd: dir, cli_version: '0.0.0-synthetic', originator: 'Codex Desktop', source: 'exec' } },
    { timestamp: stamp(1), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Plan the change' }] } },
    ...call(2, 'q1', [{ title: 'Which approach should I take?', options: ['Small patch', 'Rewrite the module'] }]),
    ...call(5, 'q2', [{ title: 'Anything I should avoid touching?' }]),
  ];
  const source = join(dir, 'questions.jsonl');
  writeFileSync(source, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  const id = (await app.ingest.importSource('codex', source)).recordingId;

  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const cards = page.locator('.question-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).locator('.question-text')).toHaveText('Which approach should I take?');
  await expect(cards.nth(0).locator('.question-options li')).toHaveText(['Small patch', 'Rewrite the module']);
  await expect(cards.nth(0).locator('[data-chosen]')).toHaveCount(0);
  await expect(cards.nth(0)).toContainText('Codex recorded the question as accepted; the answer is not part of this record');
  await expect(cards.nth(1).locator('.question-text')).toHaveText('Anything I should avoid touching?');
  await expect(cards.nth(1).locator('.question-options li')).toHaveCount(0);
});
