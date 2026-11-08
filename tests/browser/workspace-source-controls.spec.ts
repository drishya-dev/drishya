import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';import {App} from '../../apps/daemon/src/app.ts';import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,id:string,app:App,server:RunningServer;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-source-controls-'));writeFileSync(join(dir,'reading.ts'),Array.from({length:400},(_,i)=>`export const captured${i+1} = ${i+1};`).join('\n'));
 const journal=join(dir,'session.jsonl');writeFileSync(journal,[{type:'session_meta',payload:{id:'source-controls',cwd:dir}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Inspect the reading file'}]}},{type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'Fixture response'}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
 app=new App(join(dir,'data'));id=(await app.ingest.importSource('codex',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page})=>{let first=true;await page.route('**/v1/working-locations',async route=>{if(first&&route.request().method()==='GET'){first=false;await page.request.delete(route.request().url(),{headers:{'content-type':'application/json'}});}await route.continue();});});

test('Modern source keeps reading controls compact and Copy reachable by keyboard',async({page})=>{
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern#/r/${id}`);
 await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();const desk=page.getByRole('region',{name:'Developer workspace',exact:true});await desk.getByRole('button',{name:'Approve workspace reading'}).click();
 await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('reading.ts');await page.locator('[data-spine-path]').filter({has:page.getByText('reading.ts',{exact:true})}).click();
 const reader=desk.getByRole('region',{name:'Workspace file reading.ts',exact:true});await expect(reader.locator('.desk-code')).toBeVisible();
 const find=reader.getByRole('searchbox',{name:'Find in reading.ts'});await find.fill('captured300');await find.press('Enter');await expect(reader.locator('.source-find [role=status]')).toHaveText('1/1');await expect(reader.locator('.source-find [role=status]')).toHaveAttribute('aria-label',/1 matching line/);
 const line=reader.getByRole('textbox',{name:'Go to line in reading.ts'});await line.fill('300');await line.press('Enter');await expect(reader.locator('.desk-code')).toContainText('captured300');await reader.getByRole('button',{name:'Wrap',exact:true}).click();await expect(reader.getByRole('button',{name:'Wrap',exact:true})).toHaveAttribute('aria-pressed','true');
 const actions=reader.getByLabel('File actions for reading.ts',{exact:true});await actions.focus();await actions.press('Enter');const copy=reader.getByRole('button',{name:'Copy file',exact:true});await expect(copy).toBeVisible();await copy.focus();await page.keyboard.press('Escape');await expect(actions).toBeFocused();await expect(copy).toBeHidden();
 for(const width of [1440,900,390,320]){await page.setViewportSize({width,height:900});const files=desk.getByRole('button',{name:'Choose workspace file',exact:true});if(await files.isVisible()){await files.click();if(await page.locator('.folder-explorer').isVisible())await files.click();}
  const toolbar=reader.locator('.desk-source-tools'),box=(await toolbar.boundingBox())!;expect(box.height).toBeLessThan(width<=600?90:60);expect(await toolbar.getByRole('button',{name:'Copy file',exact:true}).count()).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  for(const input of await toolbar.locator('input,button').all()){const r=(await input.boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(box.x);expect(r.x+r.width).toBeLessThanOrEqual(box.x+box.width+1);expect(await input.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12);}
  await page.mouse.move(0,0);await page.screenshot({path:`.local/ui5-source-controls-${width}.png`});
 }
 // Narrow headers keep Files, Actions and Back; creation remains in the same keyboard menu.
 const layout=desk.getByLabel('Workspace layout actions',{exact:true});await layout.focus();await layout.press('Enter');
 await desk.getByRole('button',{name:'＋ New file',exact:true}).click();
 await expect(desk.getByRole('textbox',{name:'New workspace file path'})).toBeVisible();await desk.getByRole('button',{name:'Cancel',exact:true}).click();
 await layout.focus();await layout.press('Enter');await desk.getByRole('button',{name:'Split view',exact:true}).click();
 await expect(desk.locator('.desk-panes')).toHaveClass(/split/);
 await layout.focus();await layout.press('Enter');await desk.getByRole('button',{name:'Reset layout',exact:true}).click();await expect(desk.locator('.desk-panes')).not.toHaveClass(/split/);
 await reader.getByRole('button',{name:'Edit file',exact:true}).click();await expect(reader.getByRole('button',{name:'Compare draft',exact:true})).toBeVisible();
 await reader.getByRole('button',{name:'Compare draft',exact:true}).click();await expect(reader.getByRole('button',{name:'Edit draft',exact:true})).toBeVisible();
 await reader.getByRole('button',{name:'Read source',exact:true}).click();await expect(reader.locator('.desk-code')).toBeVisible();await reader.getByRole('textbox',{name:'Go to line in reading.ts'}).fill('300');await reader.getByRole('textbox',{name:'Go to line in reading.ts'}).press('Enter');await expect(reader.locator('.desk-code')).toContainText('captured300');
 await desk.getByRole('button',{name:'Back to agent',exact:true}).click();await expect(desk).toHaveCount(0);
});

// SHIP-1 retires Legacy-only visible-Copy chrome; Modern's keyboard/source controls are tested above.
