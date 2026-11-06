import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test,type Locator,type Page} from '@playwright/test';
import type {Observation} from '../../packages/contracts/src/index.ts';
import {PRIVACY_POLICY_VERSION} from '../../packages/privacy/src/index.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

// Synthetic regression guards only. Genuine Claude/Codex acceptance is user-run, in a scratch home.
let dir:string,app:App,server:RunningServer;
const ids=new Map<string,string>();
const mcpName=(n:number)=>`mcp__synthetic__tool_${String(n).padStart(3,'0')}${n===299?'_'+ 'long_name_'.repeat(20):''}`;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-toolbox-window-'));app=new App(join(dir,'store'));
 for(const harness of ['claude-code','codex'] as const){
  const id=`synthetic-window-${harness}`,sourceId=`source-${harness}`,journal=join(dir,`${harness}.jsonl`);writeFileSync(journal,'');
  app.store.upsertRecording({id,adapterId:harness,harness,sourcePath:journal,title:`Synthetic Toolbox ${harness}`,workspaceRoot:dir});
  let sequence=0;const rows:Omit<Observation,'receivedSequence'>[]=[];
  const add=(kind:Observation['kind'],agentId:string,payload:Observation['payload'],operationId?:string)=>rows.push({id:`${id}-${sequence++}`,recordingId:id,source:{adapterId:harness,adapterVersion:'synthetic',sourceId,generation:0,byteOffset:sequence,part:0},observedAt:'2026-11-05T00:00:00Z',workspaceRoot:dir,agentId,operationId,kind,payload,privacyPolicyVersion:PRIVACY_POLICY_VERSION,redactions:[],availability:'complete'});
  add('session.meta','main',{harness});add('message.user','main',{text:'Synthetic Toolbox window regression'});
  add('tools.snapshot','main',{source:'prompt_snapshot',tools:['Read',...Array.from({length:300},(_,n)=>mcpName(n))].map(name=>({name}))});
  for(let n=0;n<3;n++){
   add('tool.call','main',{tool:'Read',input:{file_path:join(dir,`${n}.ts`)}},`read-${n}`);
   add('tool.result','main',{output:`Synthetic source ${n}`,isError:false},`read-${n}`);
  }
  for(let n=0;n<300;n++){
   add('tool.call','main',{tool:mcpName(n),input:{n}},`mcp-${n}`);
   add('tool.result','main',{output:'Synthetic MCP result',isError:false},`mcp-${n}`);
  }
  for(let n=1;n<=3;n++){
   add('session.meta',`worker-${n}`,{harness});
   add('tool.call','main',{tool:'Task',input:{description:`Worker ${n}`}},`spawn-${n}`);
   add('agent.spawn','main',{childAgentId:`worker-${n}`,agentType:`Worker ${n}`,basis:'source-id'},`spawn-${n}`);
   add('tool.result','main',{output:'Synthetic worker ready',isError:false},`spawn-${n}`);
  }
  app.store.appendObservations(id,sourceId,{offset:sequence,generation:0,fingerprint:'synthetic'},rows);ids.set(harness,id);
 }
 server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page})=>{
 await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.continue());
 await page.route('**/controller',r=>r.fulfill({json:{harness:'codex',available:false,output:'',tools:Array.from({length:300},(_,n)=>`runtime_tool_${n}${n===299?'_'+ 'long_name_'.repeat(20):''}`),inventory:'runtime',approvals:[],state:'idle'}}));
});
async function open(page:Page,harness='codex',motion=false){
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
 await page.goto(`${server.url}/?experience=modern&motion=${motion?1:0}#/r/${ids.get(harness)}`);
 if(!await page.locator('.modern-tool-station').isVisible())await page.getByRole('button',{name:'Tools',exact:true}).click();
 await expect(page.locator('.modern-tool-station')).toBeVisible();
}
const windowFor=(page:Page)=>page.getByRole('dialog',{name:/^(Toolbox|MCP tools for synthetic|Agents|Run tools|Recorded tools)$/});
async function safe(page:Page,reader:Locator){
 await expect(reader).toBeVisible();
 const bounds=await reader.boundingBox(),header=await page.locator('.workspace-header').boundingBox(),composer=await page.locator('.prompt-composer').boundingBox();
 const viewport=page.viewportSize()!,top=Math.max(12,(header?.y??0)+(header?.height??0)+12),bottom=(composer?.y??viewport.height)-12;
 expect(bounds!.x).toBeGreaterThanOrEqual(12);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width-12);
 expect(bounds!.y).toBeGreaterThanOrEqual(top);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(bottom);
 expect(Math.abs(bounds!.x+bounds!.width/2-viewport.width/2)).toBeLessThanOrEqual(1);
 expect(Math.abs(bounds!.y+bounds!.height/2-(top+bottom)/2)).toBeLessThanOrEqual(1);
 expect(await reader.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
}
for(const width of [600,1440])for(const harness of ['claude-code','codex'])test(`whole Toolbox and each nested real material stay centred and reversible at ${width}px (${harness})`,async({page})=>{
 await page.setViewportSize({width,height:900});await open(page,harness);
 await expect(page.locator('.md-server>summary').filter({hasText:'Run tools'})).toBeVisible();
 await expect(page.locator('.tool-heading')).toContainText('Available tools · recorded');
 const whole=page.getByRole('button',{name:'Open toolbox',exact:true});await whole.click();
 const reader=windowFor(page);await safe(page,reader);
 await expect(page.locator('.modern-tool-station .instrument').first()).toBeVisible();
 await expect(page.locator('[data-toolbox-part="toolbox"]')).toHaveCount(1);
 await reader.getByRole('button',{name:'Close toolbox',exact:true}).click();await expect(reader).toHaveCount(0);await expect(whole).toBeFocused();
 for(const [trigger,title,selector,count] of [
  ['synthetic','MCP tools for synthetic','button[data-mcp-tool]',300],
  ['Agents','Agents','.station-agents [role=switch]',4],
  ['Run tools','Run tools','.md-runtime-tool',300],
  ['Available tools · recorded','Recorded tools','.tool-row',302],
 ] as const){
  const origin=title==='Recorded tools'?page.locator('.modern-tool-station .tool-heading'):page.locator('.modern-tool-station .md-server>summary').filter({hasText:trigger}).first();await origin.click();
  const view=page.getByRole('dialog',{name:title,exact:true});await safe(page,view);
  if(title==='Agents')await view.locator('.station-subagents>summary').click();
  await expect(view.locator(selector)).toHaveCount(count);
  await expect(page.locator(selector)).toHaveCount(count);
  const scroller=view.locator(title==='Recorded tools'?'.tool-groups':'.md-inventory-list');
  await scroller.evaluate(el=>el.scrollTop=el.scrollHeight);await expect(view.locator(selector).last()).toBeInViewport();
  expect(await scroller.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');await expect(view).toHaveCount(0);await expect(origin).toBeFocused();
 }
 const recorded=page.locator('.tool-heading');await recorded.click();
 const inventory=page.getByRole('dialog',{name:'Recorded tools',exact:true});await inventory.getByRole('searchbox',{name:'Search tools'}).fill('Read');
 await inventory.locator('.tool-row').click();const trail=inventory.locator('.tool-trail');
 await expect(trail.locator('.trail-count')).toHaveText('– of 3');
 await trail.getByRole('button',{name:'First use',exact:true}).click();await expect(trail.locator('.trail-count')).toHaveText('1 of 3');
 await trail.getByRole('button',{name:'Next use',exact:true}).click();await expect(trail.locator('.trail-count')).toHaveText('2 of 3');
 await trail.getByRole('button',{name:'Last use',exact:true}).click();await expect(trail.locator('.trail-count')).toHaveText('3 of 3');
 await trail.getByRole('button',{name:'Previous use',exact:true}).focus();await page.keyboard.press('Enter');await expect(trail.locator('.trail-count')).toHaveText('2 of 3');
 await page.locator('.workspace-header').click({position:{x:4,y:4}});await expect(inventory).toHaveCount(0);
 await recorded.click();await expect(inventory.getByRole('searchbox')).toHaveValue('Read');await expect(inventory.locator('.tool-row')).toHaveAttribute('aria-pressed','true');
 await inventory.getByRole('button',{name:'Clear focus ×',exact:true}).click();await expect(page.locator('.tool-trail')).toHaveCount(0);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Minimize toolbox',exact:true}).click();const minimized=page.getByRole('button',{name:'Expand toolbox',exact:true});await minimized.click();await safe(page,windowFor(page));
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Minimize toolbox',exact:true})).toBeFocused();
});

test('motion starts at the nested origin; interruption reverses the SAME material, resize and session changes cancel',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page,'codex',true);
 // Hold only Toolbox motion, so the assertion samples the first frame even on a busy machine.
 await page.evaluate(()=>{const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const animation=animate.call(this,frames,options);if(this.matches('[data-toolbox-window]'))animation.pause();return animation;};});
 const origin=page.locator('.md-server>summary').filter({hasText:'synthetic'});const start=(await origin.boundingBox())!;await origin.click();
 const reader=windowFor(page);await expect(reader).toBeVisible();
 const first=await reader.evaluate(el=>{const a=el.getAnimations()[0];a.pause();a.currentTime=0;const r=el.getBoundingClientRect();(window as any).__toolboxMaterial=el.querySelector('[data-toolbox-part]');return {x:r.x,y:r.y,width:r.width,height:r.height,easing:a.effect?.getTiming().easing};});
 expect(first.easing).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
 for(const dimension of ['x','y','width','height'] as const)expect(Math.abs(first[dimension]-start[dimension])).toBeLessThanOrEqual(1);
 const partial=await reader.evaluate(el=>{const a=el.getAnimations()[0];a.currentTime=80;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
 await reader.getByRole('button',{name:'Close toolbox',exact:true}).dispatchEvent('click',{detail:1});
 const reversing=(await reader.boundingBox())!;
 for(const dimension of ['x','y','width','height'] as const)expect(Math.abs(reversing[dimension]-partial[dimension])).toBeLessThanOrEqual(1);
 await origin.dispatchEvent('click',{detail:1});
 const reopened=(await reader.boundingBox())!;
 for(const dimension of ['x','y','width','height'] as const)expect(Math.abs(reopened[dimension]-partial[dimension])).toBeLessThanOrEqual(1);
 expect(await reader.evaluate(el=>el.querySelector('[data-toolbox-part]')===(window as any).__toolboxMaterial)).toBe(true);
 await reader.evaluate(el=>el.getAnimations().forEach(a=>a.finish()));await safe(page,reader);
 await page.setViewportSize({width:600,height:900});await safe(page,reader);expect(await reader.evaluate(el=>el.getAnimations().length)).toBe(0);
 await page.goto(`${server.url}/?experience=modern&motion=1#/r/${ids.get('claude-code')}`);await expect(reader).toHaveCount(0);
});
for(const fallback of ['keyboard','reduced','low-resource'] as const)test(`${fallback} opens immediately or with opacity only, and Escape closes before shared menus`,async({page})=>{
 await open(page,'codex',true);
 if(fallback==='reduced')await page.emulateMedia({reducedMotion:'reduce'});
 if(fallback==='low-resource')await page.evaluate(()=>document.documentElement.setAttribute('data-low-resource',''));
 const origin=page.getByRole('button',{name:'Open toolbox',exact:true});
 if(fallback==='keyboard'){await origin.focus();await page.keyboard.press('Enter');}else await origin.click();
 const reader=windowFor(page);await expect(reader).toBeVisible();
 expect(await reader.evaluate(el=>el.getAnimations().some(a=>a.effect instanceof KeyframeEffect&&a.effect.getKeyframes().some(f=>f.transform&&f.transform!=='none')))).toBe(false);
 const close=reader.getByRole('button',{name:'Close toolbox',exact:true});await expect(close).toBeFocused();await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);await expect(origin).toBeFocused();
});


test('the frame belongs to its viewer; closing restores the same material and removal cancels it',async({page})=>{
 await open(page);
 const origin=page.locator('.md-server>summary').filter({hasText:'synthetic'});
 await page.locator('[data-toolbox-part="tools/mcp/synthetic"]').evaluate(el=>{(window as any).__originalToolboxMaterial=el;});
 await origin.click();const reader=windowFor(page);
 expect(await reader.evaluate(el=>el.matches(':popover-open')&&!!el.closest('.connected-workspace'))).toBe(true);
 await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);
 const restored=page.locator('[data-toolbox-part="tools/mcp/synthetic"]');
 expect(await restored.evaluate(el=>el===(window as any).__originalToolboxMaterial&&el.parentElement?.classList.contains('toolbox-part-home'))).toBe(true);
 await origin.click();await expect(reader).toBeVisible();await origin.evaluate(el=>el.remove());await expect(reader).toHaveCount(0);
});

test('composer layout changes re-centre the reader and an inert evidence owner dismisses it',async({page})=>{
 await page.setViewportSize({width:600,height:900});await open(page);
 await page.getByRole('button',{name:'Open toolbox',exact:true}).click();const reader=windowFor(page);await safe(page,reader);
 await page.locator('.prompt-composer').evaluate(el=>{el.style.height=`${el.offsetHeight+80}px`;});await safe(page,reader);
 await reader.evaluate(el=>{el.closest<HTMLElement>('.connected-workspace')!.inert=true;});await expect(reader).toHaveCount(0);
});

test('hiding a page settles in-flight motion without leaving a transition or losing the material',async({page})=>{
 await open(page,'codex',true);await page.getByRole('button',{name:'Open toolbox',exact:true}).click();const reader=windowFor(page);await expect(reader).toBeVisible();
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete (document as any).hidden;
 });
 await expect(reader).toHaveAttribute('data-phase','open');expect(await reader.evaluate(el=>el.getAnimations().length)).toBe(0);
 await expect(page.locator('[data-toolbox-part="toolbox"]')).toHaveCount(1);await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);
});

for(const width of [600,1440])test(`raised connected-turn controls reserve layout space through composer scale at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await open(page);
 const origin=page.locator('.md-server>summary').filter({hasText:'synthetic'});await origin.click();const reader=windowFor(page);
 // Synthetic geometry guard for the real absolute native details and queue-receipt layout contracts.
 const layoutTop=await page.locator('.prompt-composer').evaluate(composer=>{
  const turn=document.createElement('div');turn.className='native-turn-details';turn.style.height='140px';turn.textContent='Synthetic native control';composer.append(turn);
  const queue=document.createElement('div');queue.className='queued-input-receipts';queue.style.cssText='position:absolute;bottom:calc(100% + 160px);height:32px';queue.textContent='Synthetic waiting receipt';composer.append(queue);
  const node=composer as HTMLElement;return innerHeight-node.offsetHeight-(parseFloat(getComputedStyle(node).bottom)||0);
 });
 await expect.poll(async()=>{const box=(await reader.boundingBox())!;return box.y+box.height;}).toBeLessThanOrEqual(layoutTop-192-12);
 const resting=await reader.boundingBox();
 await page.locator('.prompt-composer').evaluate(el=>{(window as any).__composerScale=el.animate([{transform:'translateX(-50%) scale(.5)'},{transform:'translateX(-50%) scale(1)'}],{duration:1000,fill:'both'});(window as any).__composerScale.pause();(window as any).__composerScale.currentTime=0;});
 await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
 expect(await reader.boundingBox()).toEqual(resting);
 await page.evaluate(()=>(window as any).__composerScale.cancel());await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);
});
