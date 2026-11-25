import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, id: string, artifact: string, app: App, server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-find-')); const root = join(dir, 'repo'); mkdirSync(root);
  const content = Array.from({ length: 23_000 }, (_, n) => n === 22_345 ? 'export const distantNeedle = true;' : `export const line${n} = ${n};`).join('\n');
  const journal = join(dir, 'synthetic.jsonl');
  const sessionId = '77777777-7777-4777-8777-777777777777';
  writeFileSync(journal, [
    { type: 'user', uuid: 'u', sessionId, cwd: root, message: { role: 'user', content: 'Inspect synthetic source' } },
    { type: 'assistant', uuid: 'a', sessionId, cwd: root, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'read', name: 'Read', input: { file_path: join(root, 'source.ts'), limit: 23_000 } }] } },
    { type: 'user', uuid: 'r', sessionId, cwd: root, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read', content }] } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  artifact = app.projection(id).artifacts.find(item => item.kind === 'excerpt')!.id;
  server = await startServer({ app, port: 0, token: 'synthetic-find' });
});
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('stored find reaches a distant actual source line without mounting the whole artifact', async ({ page, request }) => {
  const auth = { headers: { Authorization: `Bearer ${server.token}` } };
  const invalid = await request.get(`${server.url}/v1/recordings/${id}/artifacts/${artifact}?find=&start=0`, auth);
  expect(invalid.status()).toBe(400);
  await page.goto(`${server.url}/#token=${server.token}`); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/#/r/${id}`);
  await page.locator('article.op-read').getByRole('button', { name: /Expand/ }).click();
  const reader = page.locator('article.op-read .source-reading');
  await reader.getByRole('searchbox', { name: 'Find in loaded source page' }).fill('distantNeedle');
  await expect(reader.getByRole('status',{name:'0 matching lines in this page',exact:true})).toHaveText('0/0');
  await reader.getByRole('button', { name: 'Find next stored match' }).click();
  await expect(reader).toContainText('Stored match · source line 22346');
  await expect(reader.locator('[data-source-line="22346"]')).toContainText('distantNeedle');
  expect(await reader.locator('.code .ln').count()).toBeLessThanOrEqual(200);
});
