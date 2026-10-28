import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {createServer,type ViteDevServer} from '../../apps/ui/node_modules/vite/dist/node/index.js';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

let dir:string,app:App,server:RunningServer,vite:ViteDevServer,url:string;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-ledger-study-'));app=new App(join(dir,'store'));
  const path=join(dir,'synthetic-ledger.jsonl'),rows:unknown[]=[],common={sessionId:'synthetic-ledger',cwd:dir};
  const push=(n:number,value:object)=>rows.push({...common,timestamp:new Date(Date.UTC(2026,9,28,12,0,n)).toISOString(),...value});
  push(0,{type:'user',uuid:'prompt',message:{role:'user',content:'Check three modules and report what happened.'}});
  for(let n=0;n<9;n++){
    push(n*3+1,{type:'assistant',uuid:`call-${n}`,message:{role:'assistant',content:[{type:'tool_use',id:`call-${n}`,name:'Bash',input:{command:`node check-${n}.js`}}]}});
    push(n*3+2,{type:'user',uuid:`result-${n}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:`call-${n}`,is_error:n===1,content:n===1?'Error: synthetic assertion failed':`Exact captured output ${n}\nSecond captured line\nThird captured line`}]}});
    if(n%3===2)push(n*3+3,{type:'assistant',uuid:`prose-${n}`,message:{role:'assistant',content:[{type:'text',text:`Captured explanation after group ${Math.floor(n/3)+1}.`}]}});
  }
  writeFileSync(path,rows.map(value=>JSON.stringify(value)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',path)).recordingId;
  const origins:string[]=[];server=await startServer({app,port:0,token:'synthetic-ledger-study',devOrigins:origins});
  vite=await createServer({root:resolve('apps/ui'),server:{host:'127.0.0.1',port:0,proxy:{'/v1':{target:server.url,changeOrigin:true}}}});await vite.listen();
  const address=vite.httpServer!.address();if(!address||typeof address==='string')throw new Error('No study server');
  const origin=`http://127.0.0.1:${address.port}`;origins.push(origin);
  url=`${origin}/prototypes/read-ledger/?recording=${id}#token=synthetic-ledger-study`;
});
test.afterAll(async()=>{await vite?.close();await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe scratch path');rmSync(dir,{recursive:true,force:true});}});

for(const width of [1440,600])test(`three isolated directions keep captured material and errors reachable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  const frame=page.frameLocator('#stage'),cards=frame.locator('article.read3-eligible');await expect(frame.locator('.history')).toBeVisible({timeout:15000});await expect(cards.first()).toBeVisible({timeout:30000});
  const card=cards.first(),id=await card.getAttribute('data-op-id');await card.evaluate(el=>(window as any).__read3Original=el);
  const retained=frame.locator(`article[data-op-id="${id}"]`);
  await expect(retained).toHaveCSS('height','48px');
  expect(await retained.evaluate(el=>{const head=el.querySelector('.op-head')!.getBoundingClientRect(),title=el.querySelector('.op-title')!.getBoundingClientRect();return title.width>40&&title.top>=head.top&&title.bottom<=head.bottom;})).toBe(true);
  await retained.focus();await retained.press('e');await expect(retained).toHaveClass(/read3-pinned/);
  await expect(retained.locator('.op-body')).toBeVisible();await retained.press('Escape');await expect(retained).not.toHaveClass(/read3-pinned/);
  for(const [n,name] of ['Ledger','Passage strips','Passage outline'].entries()){
    await page.getByRole('button',{name,exact:true}).click();await expect(frame.locator('html')).toHaveAttribute('data-read3',String(n));
    expect(await retained.evaluate(el=>el===(window as any).__read3Original)).toBe(true);
    await expect(frame.locator('article.st-error.read3-eligible')).toHaveCount(0);
    await expect(frame.locator('article.ph-present.read3-eligible')).toHaveCount(0);
    expect(await frame.locator('html').evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true);
  }
  const group=frame.locator('.read3-group-toggle').first();
  // Navigate with the user's wheel intent. scrollIntoView alone is not a seek
  // in the production reader and can be corrected by its retained reading anchor.
  for(let attempt=0;attempt<12;attempt++){
    const box=await group.boundingBox();if(box&&box.y>150&&box.y+box.height<720)break;
    const bounds=await frame.locator('.history').boundingBox();if(!bounds)throw new Error('Missing history viewport');
    await page.mouse.move(bounds.x+bounds.width-3,450);
    await page.mouse.wheel(0,Math.max(-500,Math.min(500,(box?.y??900)-400)));
    await expect.poll(async()=>{const next=await group.boundingBox();return next?.y!==box?.y;},{timeout:2000}).toBe(true);
  }
  await group.click();await expect(group).toHaveAttribute('aria-expanded','true');await expect(group.locator('..').locator('.ops-row')).toBeVisible();await group.click();await expect(group).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:'Ledger',exact:true}).click();await page.keyboard.press('2');await expect(page.getByRole('button',{name:'Passage strips',exact:true})).toHaveAttribute('aria-current','true');
  await expect(page).toHaveURL(/v=2/);await page.reload();await expect(page.getByRole('button',{name:'Passage strips',exact:true})).toHaveAttribute('aria-current','true');
  await expect(frame.locator('.history')).toBeVisible();expect(errors).toEqual([]);
});

test('hover opens the same material; rapid switching and search typing do not duplicate it or change the variant',async({page})=>{
  await page.goto(url);const frame=page.frameLocator('#stage'),card=frame.locator('article.read3-eligible').first();await expect(card).toBeVisible({timeout:30000});
  await card.locator('.op-head').hover();await expect(card).toHaveClass(/read3-open/);await expect(card.locator('.op-body')).toBeVisible();
  await page.getByRole('button',{name:'Ledger',exact:true}).hover();await expect(card).not.toHaveClass(/read3-open/);
  for(const name of ['Passage strips','Passage outline','Ledger'])await page.getByRole('button',{name,exact:true}).click();
  await frame.getByRole('button',{name:'Search',exact:true}).click();const input=frame.getByRole('textbox',{name:'Search prose, commands, paths'});await input.fill('123');await input.press('ArrowLeft');
  await expect(page.getByRole('button',{name:'Ledger',exact:true})).toHaveAttribute('aria-current','true');await input.press('Escape');
  await expect(frame.locator('article.read3-eligible')).toHaveCount(await frame.locator('article.ph-settled.st-ok').count());
});

test('prototype navigation and preferences cannot overwrite durable working state',async({page})=>{
  const before=app.store.db.prepare("SELECT value FROM meta WHERE key='ui-working-locations-v1'").get();
  const writes:string[]=[];page.on('request',request=>{if(request.method()!=='GET'&&new URL(request.url()).pathname==='/v1/working-locations')writes.push(request.method());});
  await page.goto(url);const frame=page.frameLocator('#stage'),card=frame.locator('article.read3-eligible').first();await expect(card).toBeVisible({timeout:30000});
  await card.focus();await card.press('e');await page.getByRole('button',{name:'Passage outline',exact:true}).click();
  await frame.locator('html').evaluate(()=>localStorage.setItem('read3-isolation-proof','temporary'));
  expect(await page.evaluate(()=>localStorage.getItem('read3-isolation-proof'))).toBeNull();
  await expect.poll(()=>frame.locator('html').evaluate(async()=>{const path='/src/state.ts';const {useApp}=await import(path);return useApp.getState().recoveryState;})).toBe('saved');
  expect(writes).toEqual([]);expect(app.store.db.prepare("SELECT value FROM meta WHERE key='ui-working-locations-v1'").get()).toEqual(before);
});
