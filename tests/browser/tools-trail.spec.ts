import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

// TOOLS-1: every available tool is listed, and a chosen tool can be walked through its uses. Synthetic sessions only here;
// real sessions are checked with check:real (tools-available) and recorded in docs/review/tools-1-available-tools.md.
let dir:string,app:App,server:RunningServer,id:string,plainId:string;
const base={sessionId:'tools-story'};
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-tools-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});
 let clock=0;const time=()=>new Date(Date.UTC(2026,9,30,10,0,clock++)).toISOString();
 const calls:{id:string;name:string;input:Record<string,unknown>;text:string}[]=[
  {id:'r1',name:'Read',input:{file_path:join(dir,'a.ts')},text:'const a = 1;'},
  {id:'b1',name:'Bash',input:{command:'echo one'},text:'one'},
  {id:'r2',name:'Read',input:{file_path:join(dir,'b.ts')},text:'const b = 2;'},
  {id:'r3',name:'Read',input:{file_path:join(dir,'c.ts')},text:'const c = 3;'},
  {id:'b2',name:'Bash',input:{command:'echo two'},text:'two'},
 ];
 const names=['Read','Bash','Edit','Grep','Glob','WebSearch','mcp__github__search_code','mcp__github__create_issue'];
 const make=(session:string,withList:boolean)=>{
  const rows:unknown[]=[{...base,sessionId:session,cwd:dir,type:'user',uuid:'p',timestamp:time(),message:{role:'user',content:'Read the three files'}}];
  if(withList)rows.push({...base,sessionId:session,cwd:dir,type:'attachment',uuid:'snap',timestamp:time(),attachment:{type:'prompt_snapshot',systemPrompt:'not kept',tools:names.map(name=>({name}))}});
  for(const c of calls){
   rows.push({...base,sessionId:session,cwd:dir,type:'assistant',uuid:`a-${c.id}`,timestamp:time(),message:{id:`m-${c.id}`,role:'assistant',content:[{type:'tool_use',id:c.id,name:c.name,input:c.input}]}});
   rows.push({...base,sessionId:session,cwd:dir,type:'user',uuid:`r-${c.id}`,timestamp:time(),message:{role:'user',content:[{type:'tool_result',tool_use_id:c.id,content:c.text}]}});
  }
  const path=join(dir,`${session}.jsonl`);writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');return path;
 };
 id=(await app.ingest.importSource('claude-code',make('tools-story',true))).recordingId;
 plainId=(await app.ingest.importSource('claude-code',make('tools-plain',false))).recordingId;
});
test.beforeEach(async({page})=>{await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
async function open(page:Page,recording:string){await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recording}`);}

for(const width of [600,1440])test(`every available tool is listed by default and a chosen tool can be walked through its uses at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await open(page,id);await page.waitForTimeout(1200);// At half width the toolbox opens from the Tools button; at full width it is shown.
 if(width<900)await page.getByRole('button',{name:'Tools',exact:true}).click();
 const list=page.locator('.tool-list');
 await expect(list).toBeVisible();
 await expect(list.locator('.tool-heading')).toContainText('Available tools');
 await expect(list.locator('.tool-heading')).toContainText('8 · 2 used');
 // Listed tools that were never used are there too, with no count, quietly.
 for(const name of ['Edit','Grep','Glob','WebSearch','search_code','create_issue'])await expect(list.locator('.tool-row',{hasText:name}).first()).toBeVisible();
 await expect(list.locator('.tool-row',{hasText:'Edit'}).locator('.tool-uses')).toHaveText('—');
 await expect(list.locator('.tool-row',{hasText:'Read'}).locator('.tool-uses')).toHaveText('3');
 await expect(list.locator('.tool-row',{hasText:'Bash'}).locator('.tool-uses')).toHaveText('2');
 await expect(list.locator('.tool-group-name').nth(1)).toContainText('github');
 // An unused tool says so and does not dim anything.
 await list.locator('.tool-row',{hasText:'Grep'}).click();
 await expect(list.locator('.tool-unused')).toHaveText('Not used in this session');
 await expect(page.locator('.tool-trail')).toHaveCount(0);
 // A used tool opens its trail: first use, then forward and back, with the count and the reader following.
 await list.locator('.tool-row',{hasText:'Read'}).first().click();
 const trail=page.locator('.tool-trail');
 await expect(trail).toBeVisible();
 await expect(trail.locator('.trail-count')).toHaveText('– of 3');
 await expect(trail.getByRole('button',{name:'Previous use'})).toBeDisabled();
 await trail.getByRole('button',{name:'Next use'}).click();
 await expect(trail.locator('.trail-count')).toHaveText('1 of 3');
 await expect(page.locator('article[data-reading-focus]')).toContainText('a.ts');
 await trail.getByRole('button',{name:'Next use'}).click();
 await expect(trail.locator('.trail-count')).toHaveText('2 of 3');
 await expect(page.locator('article[data-reading-focus]')).toContainText('b.ts');
 await trail.getByRole('button',{name:'Last use'}).click();
 await expect(trail.locator('.trail-count')).toHaveText('3 of 3');
 await expect(page.locator('article[data-reading-focus]')).toContainText('c.ts');
 await expect(trail.getByRole('button',{name:'Next use'})).toBeDisabled();
 await trail.getByRole('button',{name:'Previous use'}).click();
 await expect(trail.locator('.trail-count')).toHaveText('2 of 3');
 await expect(page.locator('article[data-reading-focus]')).toContainText('b.ts');
 if(process.env.TOOLS_SHOT)await page.screenshot({path:resolve(`.local/tools-trail-${width}.png`)});
 await trail.getByRole('button',{name:'First use'}).click();
 await expect(trail.locator('.trail-count')).toHaveText('1 of 3');
 // Selecting another tool replaces the trail; clearing shows everything again.
 await list.locator('.tool-row',{hasText:'Bash'}).click();
 await expect(trail.locator('.trail-label')).toHaveText('Bash');
 await page.locator('.md-clear-filter').click();
 await expect(trail).toHaveCount(0);
 if(process.env.TOOLS_SHOT)await page.screenshot({path:resolve(`.local/tools-${width}.png`)});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test('a session with no recorded list says so and still lists what was used',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await open(page,plainId);
 const list=page.locator('.tool-list');
 await expect(list.locator('.tool-heading')).toContainText('Tools used');
 await expect(list.locator('.tool-note').first()).toContainText('did not record which tools were available');
 await expect(list.locator('.tool-row')).toHaveCount(2);
});

test('replay never lists a tool the replay position has not reached',async()=>{
 const full=await app.history.tools(id);
 expect(full.tools.filter(t=>t.listed)).toHaveLength(8);
 const early=await app.history.tools(id,0);
 expect(early.tools.filter(t=>t.listed)).toHaveLength(0);
 const trail=await app.history.toolTrail(id,{tool:'Read'},{id:undefined},2);
 expect(trail.total).toBeLessThan(3);
});
