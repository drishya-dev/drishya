import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer,ids:string[];
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-home-hero-'));app=new App(dir);ids=[];for(const [harness,file] of [['claude-code','claude/checkout-fix.jsonl'],['codex','codex/rollout-checkout-review.jsonl']] as const)ids.push((await app.ingest.importSource(harness,resolve('fixtures/synthetic',file))).recordingId);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
async function home(page:Page,count:number,writing=false){
 await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.continue());
 const recordings=Array.from({length:count},(_,i)=>({id:ids[i%2]+'-row-'+i,title:i===0?'Earlier work':'Latest work '+i,harness:i%2?'codex':'claude-code',workspaceRoot:'/synthetic/project-'+i,createdAt:'2026-01-01',updatedAt:'2026-01-01',lastSourceTime:new Date(Date.UTC(2026,0,1,i)).toISOString(),observationCount:10,pinned:false,live:false}));
 const sources=writing?[{path:'C:/synthetic/active.jsonl',harness:'claude-code',adapterId:'claude-code',cwd:recordings[0]!.workspaceRoot,title:recordings[0]!.title,modifiedAt:new Date().toISOString(),bytes:10,companions:[],importedRecordingId:recordings[0]!.id}]:[];
 await page.route('**/v1/recordings',r=>r.fulfill({json:{recordings}}));await page.route('**/v1/sources',r=>r.fulfill({json:{sources,errors:[]}}));await page.goto(server.launchUrl);await expect(page.locator('.mh-home')).toBeVisible();return recordings;
}
for(const width of [600,1440])for(const count of [0,1,80])test(`hero keeps ${count} sessions reachable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const recordings=await home(page,count);
 const hero=page.getByRole('region',{name:'Your agents in view'});await expect(hero).toBeVisible();await expect(hero.locator('p')).toHaveCount(1);await expect(hero.locator('p')).toContainText('reads, runs and changes');
 await expect(page.getByRole('button',{name:'Refresh sessions',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 if(!count){await expect(hero.getByRole('button')).toHaveCount(0);await expect(page.locator('.mh-empty')).toBeVisible();}
 else {const action=hero.getByRole('button');await expect(action).toHaveAttribute('data-session-key',recordings.at(-1)!.id);await expect(action).toBeInViewport();await expect(page.locator('.mh-session').first()).toBeInViewport();}
 await page.getByRole('textbox',{name:'Find sessions',exact:true}).fill('no match');if(count)await expect(hero.getByRole('button')).toHaveAttribute('data-session-key',recordings.at(-1)!.id);
});
for(const width of [600,1440])test(`writing session is the first action at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:700});const recordings=await home(page,8,true);const hero=page.getByRole('region',{name:'Your agents in view'});const action=hero.getByRole('button');await expect(action).toHaveAttribute('data-session-key',recordings[0]!.id);await expect(action).toBeInViewport();await expect(action).toContainText('Writing now');await expect(page.getByRole('region',{name:'Running now'})).toBeInViewport();await expect(page.locator('.mh-session').first()).toBeInViewport();
});
