import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
const ids:Record<string,string>={};
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAEElEQVR4nGP4z8DA8B9IAAAc+gT8Xdw8fQAAAABJRU5ErkJggg==';
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-path-recovery-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});
 for(const name of ['consent','missing','corrupt','late']){
  const root=join(dir,name);mkdirSync(root);writeFileSync(join(root,'mockup.png'),Buffer.from(PNG,'base64'));
  const base={timestamp:'2026-10-26T00:00:00Z',cwd:root,sessionId:name},source=join(dir,name+'.jsonl');
  writeFileSync(source,[{...base,type:'user',uuid:'p',message:{role:'user',content:'Compare the image'}},{...base,type:'assistant',uuid:'a',message:{id:'m',role:'assistant',content:[{type:'tool_use',id:'read',name:'Read',input:{file_path:join(root,'mockup.png')}}]}},{...base,type:'user',uuid:'r',message:{role:'user',content:[{type:'tool_result',tool_use_id:'read',content:'Image path only, bytes not retained.'}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');ids[name]=(await app.ingest.importSource('claude-code',source)).recordingId;
 }
});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe test path');rmSync(dir,{recursive:true,force:true});});
async function approve(page:import('@playwright/test').Page,id:string){const result=await page.request.post(`${server.url}/v1/recordings/${id}/workspace/approve`,{headers:{authorization:`Bearer ${server.token}`,'content-type':'application/json'},data:{}});expect(result.ok()).toBe(true);}
async function open(page:import('@playwright/test').Page,id:string){await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);return page.locator('article.op .path-image').first();}

test('a refused current image can be retried after consent without reloading or changing the recorded path',async({page})=>{
 const path=await open(page,ids.consent!);await path.getByRole('button',{name:'Open current file',exact:true}).click();await expect(path).toContainText('Allow workspace reading');await expect(path.locator('figure')).toHaveCount(0);
 await approve(page,ids.consent!);await path.getByRole('button',{name:'Retry current file',exact:true}).click();await expect(path.locator('figcaption')).toContainText('It may differ from what the agent saw');await expect.poll(()=>path.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(2);await expect(path).toContainText('image bytes not recorded');
});

for(const kind of ['missing','corrupt'])test(`a current image ${kind} after the successful probe explains failure and retries only on click`,async({page})=>{
 let requests=0,available=false;await page.route('**/workspace/image?*',async route=>{requests++;if(route.request().resourceType()==='image'&&!available)await route.fulfill({status:kind==='missing'?404:200,contentType:'image/png',body:'invalid image bytes'});else await route.continue();});
 const path=await open(page,ids[kind]!);await approve(page,ids[kind]!);await path.getByRole('button',{name:'Open current file',exact:true}).click();await expect(path.getByRole('status')).toContainText('could not be loaded');await expect(path.locator('figure')).toHaveCount(0);const before=requests;await page.waitForTimeout(150);expect(requests).toBe(before);
 available=true;await path.getByRole('button',{name:'Retry current file',exact:true}).click();await expect.poll(()=>path.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(2);await expect(path.getByRole('status')).toHaveCount(0);await expect(path.locator('figcaption')).toContainText('Current file');await expect(path).toContainText('image bytes not recorded');
 await page.setViewportSize({width:390,height:844});expect(await path.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:resolve(`.local/path-image-${kind}-phone.png`)});
});

test('a delayed current-image refusal cannot replace a newer recording image',async({page})=>{
 const previous=await open(page,ids.late!);await approve(page,ids.late!);
 let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(resolve=>{entered=resolve;});
 await page.route(`**/recordings/${ids.late}/workspace/image?*`,async route=>{await new Promise<void>(resolve=>{release=resolve;entered();});try{await route.fulfill({status:403,contentType:'text/plain',body:'approve workspace reading'});}catch{/* A navigation may already have cancelled the old request. */}});
 await previous.getByRole('button',{name:'Open current file',exact:true}).click();await waiting;await expect(previous).toContainText('Opening the current file');
 await page.evaluate(id=>{location.hash=`#/r/${id}`;},ids.consent!);
 const nextOperation=app.projection(ids.consent!).operations.find(op=>op.detail.kind==='read')!;
 const current=page.locator(`article[data-op-id="${nextOperation.id}"] .path-image`);await expect(current).toBeVisible();await approve(page,ids.consent!);await current.getByRole('button',{name:'Open current file',exact:true}).click();await expect.poll(()=>current.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(2);
 release();await expect(current.locator('figcaption')).toContainText('It may differ from what the agent saw');await expect(current.getByRole('status')).toHaveCount(0);await expect(current.getByRole('button',{name:'Retry current file',exact:true})).toHaveCount(0);
});
