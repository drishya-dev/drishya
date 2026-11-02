import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-path-img-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

const PNG='iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAEElEQVR4nGP4z8DA8B9IAAAc+gT8Xdw8fQAAAABJRU5ErkJggg==';

test('an image known only by its path says so and opens today\'s file only after workspace approval',async({page})=>{
 const root=join(dir,'repo');mkdirSync(join(root,'docs'),{recursive:true});writeFileSync(join(root,'docs','mockup.png'),Buffer.from(PNG,'base64'));
 const base={timestamp:'2026-10-21T00:00:00Z',cwd:root,sessionId:'66666666-6666-4666-8666-666666666666'},source=join(dir,'session.jsonl');
 const rows=[
  {...base,type:'user',uuid:'p',message:{role:'user',content:'Compare with the mockup'}},
  {...base,type:'assistant',uuid:'a1',message:{id:'m1',role:'assistant',content:[{type:'tool_use',id:'read1',name:'Read',input:{file_path:join(root,'docs','mockup.png')}}]}},
  {...base,type:'user',uuid:'r1',message:{role:'user',content:[{type:'tool_result',tool_use_id:'read1',content:'ok'}]}},
 ];
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator('article.op').filter({hasText:'mockup.png'}).first();
 await expect(card.locator('.path-image-line').first()).toContainText('image bytes not recorded');
 await card.getByRole('button',{name:'Open current file'}).click();
 await expect(card.locator('.path-image')).toContainText('Allow workspace reading');
 await expect(card.locator('.path-image-current')).toHaveCount(0);
 const approve=await page.request.post(`${server.url}/v1/recordings/${id}/workspace/approve`,{headers:{authorization:`Bearer ${server.token}`,'content-type':'application/json'},data:{}});
 expect(approve.ok()).toBe(true);
 await page.reload();
 const again=page.locator('article.op').filter({hasText:'mockup.png'}).first();
 await again.getByRole('button',{name:'Open current file'}).click();
 const current=again.locator('.path-image-current');
 await expect(current).toContainText('It may differ from what the agent saw');
 await expect.poll(()=>current.locator('img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(2);
 if(process.env.IMG_SHOT)await again.screenshot({path:resolve('.local/path-image.png')});
});
