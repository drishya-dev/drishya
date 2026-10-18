import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-outcomes-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-outcomes' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('wrapped test facts appear inside Shell, stay bounded and keep raw evidence available', async ({ page }) => {
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const op = sample.projection.operations.filter((item: { kind: string }) => item.kind === 'test').at(-1);
  op.kind = 'shell'; op.title = 'Run mixed checks';
  const raw = JSON.stringify([{ i: 0, value: { output: 'Test Files 46 passed (46)\nTests 100000 passed (100000)', exit_code: 0 } }, { i: 1, value: { output: 'Tests: 1 failed, 4 passed, 1 skipped, 6 total', exit_code: 1 } }, { i: 2, value: { output: '', exit_code: 0 } }]);
  op.detail = { kind: 'shell', command: 'captured mixed orchestration', outputPreview: raw, exitCode: 0 };
  op.artifactIds = [];
  await page.route('**/demo/bundle.json', route => route.fulfill({ json: sample }));
  await page.goto(new URL('/?demo&experience=classic', server.launchUrl).href);
  const card = page.locator(`article[data-op-id="${op.id}"]`);
  await expect(card).toHaveClass(/op-shell/);
  await expect(card).toContainText('100,000 passed');
  await expect(card).toContainText('Suite summary: 46 passed (46)');
  await expect(card).toContainText('1 failed');
  await expect(card.locator('.captured-outcomes > section')).toHaveCount(2);
  expect(await card.locator('.verification-tile').count()).toBeLessThan(80);
  await page.screenshot({ path: resolve('.local/wrapped-test-outcomes.png') });
  await card.getByRole('button', { name: /Expand/ }).click();
  await expect(card).toContainText('"exit_code":1');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unverified edits and creations show an explained neutral mark instead of a question mark',async({page})=>{
  const timestamp='2026-10-18T00:00:00Z',patch='*** Begin Patch\n*** Add File: new.ts\n+export const value=1;\n*** Update File: old.ts\n@@\n-old\n+new\n*** End Patch';
  const path=join(dir,'unknown-patch.jsonl'),rows=[{timestamp,type:'session_meta',payload:{id:'unknown-patch',cwd:dir}},{timestamp,type:'response_item',payload:{type:'custom_tool_call',name:'exec',input:`text(await tools.apply_patch(${JSON.stringify(patch)}));`,call_id:'wrapped'}},{timestamp,type:'response_item',payload:{type:'custom_tool_call_output',call_id:'wrapped',output:'{}'}}];
  writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('codex',path)).recordingId;
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const marks=page.locator('.op .state-unknown');await expect(marks).toHaveCount(2);
  for(const mark of await marks.all()){await expect(mark).toHaveText('—');await expect(mark).toHaveAttribute('aria-label','Change unverified');await expect(mark).toHaveAttribute('title',/does not expose/);}
});
