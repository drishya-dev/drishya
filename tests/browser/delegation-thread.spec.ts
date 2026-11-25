import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
import {expandCard} from './history-gestures.ts';

let dir:string,app:App,server:RunningServer,codex:string,claude:string,child:string,long:string;
const parentId='11111111-1111-4111-8111-111111111111',childId='22222222-2222-4222-8222-222222222222',t=(n:number)=>new Date(Date.UTC(2026,9,28,10,0,n)).toISOString();
const write=(path:string,rows:unknown[])=>writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-thread-browser-'));app=new App(join(dir,'store'));
  const path=join(dir,`rollout-2026-10-28T10-00-00-${parentId}.jsonl`);
  const activity=(n:number,kind:string)=>({type:'event_msg',timestamp:t(n),payload:{type:'item_completed',item:{type:'SubAgentActivity',id:n===2?'spawn':`activity-${n}`,agent_thread_id:childId,agent_path:'/root/review',kind,model:'synthetic-model',reasoning_effort:'high'}}});
  write(path,[{type:'session_meta',timestamp:t(0),payload:{id:parentId,cwd:dir}},{type:'response_item',timestamp:t(0),payload:{type:'message',role:'user',content:[{type:'input_text',text:'Delegate the review'}]}},{type:'response_item',timestamp:t(1),payload:{type:'function_call',name:'spawn_agent',call_id:'spawn',arguments:JSON.stringify({task_name:'review',message:'Review the change'})}},activity(2,'spawn'),{type:'response_item',timestamp:t(3),payload:{type:'function_call_output',call_id:'spawn',output:'{"task_name":"review"}'}},activity(4,'interacted'),activity(5,'completed'),{type:'response_item',timestamp:t(6),payload:{type:'agent_message',author:'/root/review',content:[{type:'output_text',text:'A complete child reply.'}]}}]);
  codex=(await app.ingest.importSource('codex',path)).recordingId;
  const childPath=join(dir,`rollout-2026-10-28T10-00-01-${childId}.jsonl`);write(childPath,[{type:'session_meta',timestamp:t(2),payload:{id:childId,cwd:dir,parent_thread_id:parentId,agent_path:'/root/review'}},{type:'response_item',timestamp:t(2),payload:{type:'message',role:'user',content:[{type:'input_text',text:'Child task'}]}}]);child=(await app.ingest.importSource('codex',childPath)).recordingId;
  const main=join(dir,'claude-parent.jsonl'),common={sessionId:'claude-parent',cwd:dir};
  write(main,[{...common,type:'user',uuid:'u',timestamp:t(0),message:{role:'user',content:'Delegate a repository review'}},{...common,type:'assistant',uuid:'a',timestamp:t(1),message:{role:'assistant',content:[{type:'tool_use',id:'agent-call',name:'Agent',input:{subagent_type:'Explore',description:'Review repository',prompt:'Read the implementation and return findings.'}}]}},{...common,type:'user',uuid:'r',timestamp:t(40),message:{role:'user',content:[{type:'tool_result',tool_use_id:'agent-call',content:'Review returned'}]},toolUseResult:{agentId:'worker',content:[{type:'text',text:'Review returned'}]}}]);
  const sub=join(dir,'claude-parent','subagents');mkdirSync(sub,{recursive:true});const rows:unknown[]=[];
  for(let n=0;n<30;n++){rows.push({...common,isSidechain:true,agentId:'worker',type:'assistant',uuid:`a${n}`,timestamp:t(n+2),message:{role:'assistant',model:'synthetic-claude',content:[{type:'tool_use',id:`read${n}`,name:'Read',input:{file_path:join(dir,`file${n}.ts`)}}]}});rows.push({...common,isSidechain:true,agentId:'worker',type:'user',uuid:`r${n}`,timestamp:t(n+2),message:{role:'user',content:[{type:'tool_result',tool_use_id:`read${n}`,content:'1: captured source'}]}});}
  write(join(sub,'agent-worker.jsonl'),rows);claude=(await app.ingest.importSource('claude-code',main)).recordingId;
  const longPath=join(dir,'long-task.jsonl');write(longPath,[{...common,type:'user',uuid:'long-u',timestamp:t(0),message:{role:'user',content:'Review'}},{...common,type:'assistant',uuid:'long-a',timestamp:t(1),message:{role:'assistant',content:[{type:'tool_use',id:'long-agent',name:'Agent',input:{description:'Long task',subagent_type:'Explore',prompt:'Task line\n'.repeat(9000)}}]}}]);long=(await app.ingest.importSource('claude-code',longPath)).recordingId;server=await startServer({app,port:0,token:'synthetic-thread-browser'});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('Codex reads one collapsed lifecycle thread and opens its exact child session',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${codex}`);
  const card=page.locator('article.op-spawn');await expect(card).toHaveCount(1);await expandCard(card);
  const detail=card.locator('.delegation-material'),thread=detail.locator('.delegation-thread');await thread.locator(':scope > summary').click();
  await expect(thread).toContainText('Child completion recorded');await expect(thread).toContainText('Interaction recorded');await expect(thread).toContainText('A complete child reply.');await expect(thread.locator('[data-delegation-step="result"]')).toHaveCount(0);
  await expect(detail.locator('.delegation-facts')).toContainText('synthetic-model');await expect(detail.locator('.delegation-facts')).toContainText('high effort');
  const link=thread.getByRole('link',{name:'Open child session'});await expect(link).toHaveAttribute('href',`#/r/${child}`);await link.click();await expect(page).toHaveURL(new RegExp(child));
});
test('Claude keeps task, all child actions and parent result together at the narrow desktop width',async({page})=>{
  await page.setViewportSize({width:600,height:900});await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${claude}`);
  const history=page.locator('.history');await expect(history).toBeVisible();const follow=page.getByRole('switch',{name:'Automatically follow new work'});if(await follow.getAttribute('aria-checked')==='true')await follow.click();await history.focus();await page.keyboard.press('Shift+C');await history.evaluate(el=>el.scrollTop=0);
  const card=page.locator('article.op-spawn');await expect(card).toHaveCount(1);await expandCard(card);
  const detail=card.locator('.delegation-material'),thread=detail.locator('.delegation-thread');await expect(detail.locator('.delegation-task')).toHaveText('Read the implementation and return findings.');await thread.locator(':scope > summary').click();
  await expect(thread).toContainText('32 steps');await expect(thread.locator('li')).toHaveCount(25);await expect(async()=>{const next=thread.getByRole('button',{name:'Next steps'});if(await next.isEnabled())await next.click();await expect(thread.locator('li')).toHaveCount(7,{timeout:2000});}).toPass({timeout:10000});await expect(thread).toContainText('Result returned to parent');await thread.getByRole('button',{name:'Previous steps'}).click();await expect(thread.locator('li')).toHaveCount(25);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('long native task text remains reachable through exact bounded pages',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${long}`);
 const card=page.locator('article.op-spawn');await expect(card).toHaveCount(1);await expandCard(card);const detail=card.locator('.delegation-material');let text='';
 for(let n=0;n<8;n++){await expect(detail.getByRole('navigation',{name:'Task text pages'})).toBeVisible();text+=await detail.locator('.delegation-task').textContent();const next=detail.getByRole('button',{name:'Next task text'});if(await next.isDisabled())break;await next.press('Enter');await expect(detail.getByRole('navigation',{name:'Task text pages'})).toContainText(`Characters ${(n+1)*16000+1}`);}
 expect(text).toBe('Task line\n'.repeat(9000));
});
