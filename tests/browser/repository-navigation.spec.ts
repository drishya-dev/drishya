import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-repository-navigation-'));
  const root = join(dir, 'repo'); mkdirSync(root);
  for (let i = 0; i < 600; i++) writeFileSync(join(root, `file-${String(i).padStart(3,'0')}.ts`), `export const value${i} = ${i};\n`);
  writeFileSync(join(root, 'index.ts'), 'import { value0 } from "./file-000";\n');
  const journal = join(dir, 'recording.jsonl'), timestamp = '2026-10-18T00:00:00Z';
  writeFileSync(journal, [
    { timestamp, type:'session_meta', payload:{ id:'navigation', cwd:root } },
    { timestamp, type:'response_item', payload:{ type:'function_call', name:'exec_command', call_id:'read', arguments:JSON.stringify({cmd:'cat index.ts',workdir:root}) } },
    { timestamp, type:'response_item', payload:{ type:'function_call_output', call_id:'read', output:'import { value0 } from "./file-000";' } },
  ].map(row => JSON.stringify(row)).join('\n')+'\n');
  app = new App(join(dir,'store')); id = (await app.ingest.importSource('codex',journal)).recordingId;
  server = await startServer({app,port:0,token:'synthetic-repository-navigation'});
});
test.afterAll(async () => { if(server)await server.close();if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});} });

test('whole repository approval keeps Files bounded and every row reachable in both directions', async ({page}) => {
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const explorer = page.getByRole('complementary',{name:'Repository files'}), tree = explorer.getByRole('tree');
  await expect(explorer).toBeVisible();
  await explorer.getByRole('button',{name:'Enable workspace reading'}).click();
  const rootItem=tree.getByRole('treeitem').first();await expect(rootItem).toBeVisible();
  // A recorded root can start collapsed; approval does not imply expansion.
  if(await rootItem.getAttribute('aria-expanded')==='false'){await rootItem.focus();await page.keyboard.press('ArrowRight');await expect(rootItem).toHaveAttribute('aria-expanded','true');}
  await expect.poll(()=>tree.evaluate(el=>el.scrollHeight)).toBeGreaterThan(19000);
  const box = await explorer.boundingBox(); expect(box!.y+box!.height).toBeLessThanOrEqual(720);
  await tree.evaluate(el=>el.scrollTop=el.scrollHeight);
  await expect(tree.getByRole('treeitem',{name:/index.ts/})).toBeVisible();
  await tree.getByRole('treeitem').last().focus(); await page.keyboard.press('Home');
  await expect(tree.getByRole('treeitem',{name:/file-000.ts/})).toBeFocused();
  await tree.getByRole('treeitem').first().focus(); await page.keyboard.press('End');
  await explorer.getByRole('textbox').fill('file-000');
  await expect(tree.getByRole('treeitem')).toHaveCount(1);
  await explorer.getByRole('button',{name:'Clear file search'}).click();
  await expect(tree.getByRole('treeitem',{name:/file-000.ts/})).toBeVisible();
  expect(await tree.getByRole('treeitem').count()).toBeLessThan(60);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
  await page.screenshot({path:resolve('.local/repository-files-desktop.png')});
});

test('a repository scan in map view fits the new layout and exposes real import direction',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await page.getByRole('button',{name:'Explore repository map',exact:true}).click();
  const grant=page.getByRole('button',{name:'Map the whole repository'});
  if(await grant.isVisible())await grant.click();
  await page.getByRole('switch',{name:/Import paths/}).click();
  await page.getByRole('textbox',{name:'Find a file on the map'}).fill('index.ts');
  await page.locator('.map-matches').getByRole('button',{name:'index.ts',exact:true}).click();
  await expect(page.locator('[data-import-from="index.ts"][data-import-to="file-000.ts"]')).toHaveCount(1);
  await expect(page.locator('.map-legend')).toContainText('Importer → dependency');
  await expect(page.locator('.map-file-label').filter({hasText:'index.ts'}).first()).toBeVisible();

  await page.screenshot({path:resolve('.local/repository-directions-desktop.png')});
  await page.getByRole('button',{name:'Show files',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Repository files'})).toBeVisible();
  await expect(page.getByRole('tree',{name:'Workspace files'})).toBeVisible();
});
