import {randomUUID} from 'node:crypto';
import {appendFileSync,copyFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {buildSync} from 'esbuild';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

const helper=buildSync({entryPoints:[resolve('apps/ui/src/lib/file-tree-origin.ts')],bundle:true,format:'iife',globalName:'TreeOrigin',write:false}).outputFiles[0]!.text;
test('tree origins use exact current visible rows; clipping, opacity, overlays and rapid scroll fall back',async({page})=>{
 await page.setContent('<style>body{margin:0}.folder-tree{position:absolute;left:20px;top:40px;width:280px;height:100px;overflow:auto}button{display:block;width:100%;height:30px;border:0;flex:none}#cover{position:fixed;inset:0;background:black;z-index:2}</style><main class="viewer"><div class="folder-tree"><button data-spine-path="a/quoted&quot;file.ts">target</button><div style="height:300px"></div><button data-spine-path="b/same.ts">other</button></div></main>');
 await page.addScriptTag({content:helper});
 const result=()=>page.evaluate(()=>{
  const api=(window as unknown as {TreeOrigin:{fileTreeOrigin:(el:Element,path:string)=>HTMLElement|undefined}}).TreeOrigin;
  return !!api.fileTreeOrigin(document.querySelector('.viewer')!,'a/quoted"file.ts');
 });
 expect(await result()).toBe(true);
 expect(await page.evaluate(()=>{const api=(window as any).TreeOrigin;return !!api.fileTreeOrigin(document.querySelector('.viewer'),'quoted"file.ts');})).toBe(false);
 await page.evaluate(()=>{const e=document.createElement('div');e.id='cover';document.body.append(e);});expect(await result()).toBe(false);
 await page.locator('#cover').evaluate(e=>e.remove());
 for(const value of ['hidden','visible']){await page.locator('.folder-tree').evaluate((e,v)=>(e as HTMLElement).style.visibility=v,value);expect(await result()).toBe(value==='visible');}
 await page.locator('.folder-tree').evaluate(e=>(e as HTMLElement).style.opacity='0');expect(await result()).toBe(false);await page.locator('.folder-tree').evaluate(e=>(e as HTMLElement).style.opacity='1');
 for(const top of [20,0,80,0,300,0]){await page.locator('.folder-tree').evaluate((e,n)=>e.scrollTop=n,top);expect(await result()).toBe(top===0);}
 await page.locator('button').first().evaluate(e=>e.remove());expect(await result()).toBe(false);
});

let dir:string,journal:string,app:App,server:RunningServer,id:string;
test.describe('new file material',()=>{
 test.beforeEach(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-tree-lift-'));journal=join(dir,'fixture.jsonl');copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'),journal);app=new App(join(dir,'data'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});app.ingest.startLive(id);});
 test.afterEach(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe cleanup');rmSync(dir,{recursive:true,force:true});});
 for(const {kind,fallback} of [{kind:'Read'},{kind:'Edit'},{kind:'Write'},{kind:'Read',fallback:'hidden'},{kind:'Read',fallback:'occluded'},{kind:'Read',fallback:'clipped'},{kind:'Read',fallback:'closed'}])test(`${kind} ${fallback ? `uses the map fallback when its tree row is ${fallback}` : 'lifts from the tree even when a map origin is available'}`,async({page})=>{
  await page.setViewportSize({width:1440,height:1100});await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern#/r/${id}`);await page.locator('.origins').waitFor({state:'attached'});
  for(const path of ['src','src/checkout']){const folder=page.locator('.folder-tree').getByTitle(path,{exact:true});if(await folder.getAttribute('aria-expanded')!=='true')await folder.click();}
  const row=page.locator('.folder-tree [data-spine-path="src/checkout/guard.ts"]');await row.scrollIntoViewIfNeeded();
  await page.evaluate(()=>{
   const map=document.createElement('div');Object.assign(map.dataset,{originFile:'src/checkout/guard.ts',originVisible:'true',originRenderer:'world'});Object.assign(map.style,{position:'fixed',left:'400px',top:'140px',width:'10px',height:'10px',zIndex:'5'});document.querySelector('.viewer')!.append(map);
   const cues:{label:string;renderer:string;path:string}[]=[];(window as any).treeCues=cues;
   new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node instanceof Element&&node.classList.contains('origin-thread')&&node.getAttribute('data-move')==='Lift')cues.push({label:node.getAttribute('data-origin-type')??'',renderer:node.getAttribute('data-origin-renderer')??'',path:node.getAttribute('d')??''});}).observe(document.querySelector('.origins')!,{childList:true});
  });
  if(fallback==='closed')await page.getByRole('button',{name:'Show files',exact:true}).click();
  if(fallback==='hidden')await row.evaluate(e=>(e as HTMLElement).style.visibility='hidden');
  if(fallback==='clipped')await page.locator('.folder-tree').evaluate(e=>{Object.assign((e as HTMLElement).style,{height:'16px',maxHeight:'16px',overflow:'hidden'});});
  if(fallback==='occluded')await row.evaluate(e=>{const r=e.getBoundingClientRect(),cover=document.createElement('div');Object.assign(cover.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',background:'black',zIndex:'999'});document.body.append(cover);});
  const call=`tree-${kind}-${randomUUID()}`,file_path='/home/dev/shop/src/checkout/guard.ts';
  const input=kind==='Read'?{file_path,offset:1,limit:3}:kind==='Edit'?{file_path,old_string:'old',new_string:'new'}:{file_path,content:'export const tree = true;'};
  appendFileSync(journal,JSON.stringify({cwd:'/home/dev/shop',sessionId:'c0ffee00-0000-4000-8000-000000000001',uuid:randomUUID(),timestamp:'2026-10-28T10:00:00.000Z',type:'assistant',message:{id:call,role:'assistant',model:'synthetic',content:[{type:'tool_use',id:call,name:kind,input}]}})+'\n');await app.ingest.sync(id);
  const label=fallback?'Repository node':'File tree row',renderer=fallback?'world':'tree';
  await expect.poll(()=>page.evaluate(()=>(window as any).treeCues)).toEqual(expect.arrayContaining([expect.objectContaining({label,renderer})]));
  if(!fallback){const cue=await page.evaluate(()=>(window as any).treeCues.find((c:any)=>c.label==='File tree row'));const box=(await row.boundingBox())!;const start=/^M([^,]+),([^ ]+)/.exec(cue.path)!;expect(Math.abs(Number(start[1])-(box.x+box.width/2))).toBeLessThan(1);expect(Math.abs(Number(start[2])-(box.y+box.height/2))).toBeLessThan(1);}
  await expect(page.locator('.origin-material,.origin-file-transfer,.origin-tool-transfer')).toHaveCount(0);
 });
});
