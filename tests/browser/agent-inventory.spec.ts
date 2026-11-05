import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import type {Observation} from '../../packages/contracts/src/index.ts';
import {PRIVACY_POLICY_VERSION} from '../../packages/privacy/src/index.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;const ids=new Map<number,string>();
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-agent-inventory-'));app=new App(join(dir,'store'));
 // Synthetic normalized observations exercise UI cardinality without depending on pending native lineage enrichment.
 for(const count of [3,300]){
  const id=`synthetic-agents-${count}`,sourceId=`source-${count}`,journal=join(dir,`${count}.jsonl`);writeFileSync(journal,'');
  app.store.upsertRecording({id,adapterId:'claude-code',harness:'claude-code',sourcePath:journal,title:`Synthetic ${count} agents`,workspaceRoot:dir});
  let sequence=0;const observations:Omit<Observation,'receivedSequence'>[]=[];
  const add=(kind:Observation['kind'],agentId:string,payload:Observation['payload'],operationId?:string)=>observations.push({id:`${id}-${sequence++}`,recordingId:id,source:{adapterId:'claude-code',adapterVersion:'synthetic',sourceId,generation:0,byteOffset:sequence,part:0},observedAt:'2026-10-20T00:00:00Z',workspaceRoot:dir,agentId,operationId,kind,payload,privacyPolicyVersion:PRIVACY_POLICY_VERSION,redactions:[],availability:'complete'});
  add('session.meta','agent:main',{harness:'claude-code'});add('message.user','agent:main',{text:'Inspect this synthetic agent family'});
  for(let index=1;index<count;index++){
   const child=`agent:child-${index}`,call=`spawn-${index}`;
   add('session.meta',child,{harness:'claude-code'});
   add('tool.call','agent:main',{tool:'Task',input:{description:`Worker ${index}`}},call);
   add('agent.spawn','agent:main',{childAgentId:child,agentType:`Worker ${String(index).padStart(3,'0')}${count===300?' with a long readable name':''}`,basis:'source-id'},call);
   add('tool.result','agent:main',{output:'Synthetic agent created',isError:false},call);
  }
  add('message.assistant','agent:main',{text:'Synthetic family is ready to inspect.'});
  app.store.appendObservations(id,sourceId,{offset:sequence,generation:0,fingerprint:'synthetic'},observations);ids.set(count,id);
 }
 server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
for(const count of [3,300])test(`${count} agents keep their family and filter in a bounded disclosure`,async({page})=>{
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/#/r/${ids.get(count)}`);
 const toolbox=page.locator('.modern-toolbox');await expect(toolbox).toBeVisible();
 const summary=toolbox.locator('.md-agents>summary');await expect(summary.locator('..')).not.toHaveAttribute('open');await summary.click();await expect(summary.locator('..')).toHaveAttribute('open','');
 const list=toolbox.getByRole('region',{name:'Agents',exact:true});await expect(list).toBeVisible();await expect(list).toHaveAttribute('data-size',count===3?'fit':'scroll');
 const children=list.locator('.station-subagents>summary');await expect(children).toContainText(String(count-1));await children.click();
 await expect(list.getByRole('switch')).toHaveCount(count);
 const size=await list.evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight}));
 if(count===3)expect(size.scroll).toBeLessThanOrEqual(size.client+1);
 else{
  expect(size.client).toBeLessThanOrEqual(216);expect(size.scroll).toBeGreaterThan(size.client);
  await list.focus();await page.keyboard.press('End');await expect(list.getByRole('switch').last()).toBeInViewport();await expect(summary).toBeInViewport();
 }
 const last=list.getByRole('switch').last();await last.scrollIntoViewIfNeeded();await last.click();await expect(last).toHaveAttribute('aria-checked','true');
 await toolbox.getByRole('button',{name:'Clear focus ×',exact:true}).click();await expect(last).toHaveAttribute('aria-checked','false');
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:844});
  if(!await page.locator('.workbench-station').isVisible())await page.getByRole('button',{name:'Tools',exact:true}).click();
  await list.evaluate(el=>el.scrollTop=el.scrollHeight);await expect(last).toBeInViewport();await expect(summary).toBeInViewport();
  const box=(await list.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.local/ui10-agents-${count}-${width}.png`});
 }
 await page.setViewportSize({width:320,height:568});await list.evaluate(el=>el.scrollTop=el.scrollHeight);
 await expect(last).toBeInViewport();await expect(summary).toBeInViewport();
 expect(await list.evaluate(el=>el.clientHeight)).toBeLessThanOrEqual(Math.ceil(568*.36));
 await summary.click();await expect(list).toBeHidden();
});
