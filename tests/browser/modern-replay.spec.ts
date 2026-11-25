import {mkdtempSync,mkdirSync,writeFileSync,appendFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {test,expect,type Page} from '@playwright/test';import {App} from '../../apps/daemon/src/app.ts';import {startServer,type RunningServer} from './browser-server.ts';
let dir:string,journal:string,id:string,app:App,server:RunningServer;
const base={sessionId:'modern-replay-fixture',timestamp:'2026-10-20T09:00:00Z'};
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-modern-replay-'));mkdirSync(join(dir,'src'));writeFileSync(join(dir,'src','a.ts'),'export const value = 1;\n');journal=join(dir,'session.jsonl');const rows:unknown[]=[];
 for(let n=0;n<20;n++){
  rows.push({...base,type:'user',uuid:`p-${n}`,cwd:dir,message:{role:'user',content:`Replay turn ${n}`}});
  const tools=[['Read',{file_path:'src/a.ts'},'1\texport const value = 1;',false],['Edit',{file_path:'src/a.ts',old_string:'1',new_string:'2'},'File edited',false],['Bash',{command:'npm test'},'Tests: 1 failed, 2 passed, 3 total',true]] as const;
  tools.forEach(([name,input,content,is_error],i)=>{const key=`${n}-${i}`;rows.push({...base,type:'assistant',uuid:`a-${key}`,message:{role:'assistant',content:[{type:'tool_use',id:key,name,input}]}});rows.push({...base,type:'user',uuid:`r-${key}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:key,content,is_error}]}});});
 }
 writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page})=>{
 let first=true;await page.route('**/v1/working-locations',async route=>{if(first&&route.request().method()==='GET'){first=false;await page.request.delete(route.request().url(),{headers:{'content-type':'application/json'}});}await route.continue();});
 await page.route('**/controller',route=>route.fulfill({json:{harness:'claude-code',available:false,output:'',tools:[],inventory:'unknown',approvals:[],state:'idle'}}));
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/#/r/${id}`);await expect(page.locator('.history')).toBeVisible();
});
const bar=(page:Page)=>page.getByRole('contentinfo',{name:'Replay controls'});
const step=(page:Page)=>bar(page).getByRole('slider',{name:'Timeline'}).getAttribute('aria-valuenow').then(Number);
async function start(page:Page){await page.evaluate(()=>localStorage.setItem('drishya-dev-tools','1'));await page.getByLabel('More workspace options',{exact:true}).click();await page.getByRole('button',{name:'Replay this session',exact:true}).click();await expect(bar(page)).toBeVisible();await expect(bar(page).getByRole('button',{name:'Pause',exact:true})).toBeVisible();}

test('Modern replay is explicit and has working play, step, speed, outcome, timeline and exit controls',async({page})=>{
 await expect(bar(page)).toHaveCount(0);await start(page);await bar(page).getByRole('button',{name:'Pause',exact:true}).click();
 const slider=bar(page).getByRole('slider',{name:'Timeline'});await slider.focus();await slider.press('Home');await expect.poll(()=>step(page)).toBe(0);
 await bar(page).getByRole('button',{name:'Step forward',exact:true}).click();await expect.poll(()=>step(page)).toBe(1);
 await bar(page).getByRole('button',{name:'Step back',exact:true}).click();await expect.poll(()=>step(page)).toBe(0);
 await bar(page).getByRole('button',{name:'Next edit',exact:true}).click();await expect.poll(()=>step(page)).toBeGreaterThan(0);const edited=await step(page);
 await bar(page).getByRole('button',{name:'Next failure',exact:true}).click();await expect.poll(()=>step(page)).toBeGreaterThan(edited);
 await bar(page).getByRole('combobox',{name:'Replay speed'}).selectOption('4');await expect(bar(page).getByRole('combobox',{name:'Replay speed'})).toHaveValue('4');
 await slider.focus();await slider.press('End');const end=await slider.getAttribute('aria-valuemax');await expect.poll(()=>step(page)).toBe(Number(end));await expect(bar(page).getByRole('button',{name:'Step forward'})).toBeDisabled();await expect(page.locator('.history')).toContainText('Replay turn 19');
 await bar(page).getByRole('button',{name:'Play',exact:true}).click();await expect.poll(()=>step(page)).toBeLessThan(Number(end));await bar(page).getByRole('button',{name:'Pause',exact:true}).click();
 expect(await bar(page).locator('.modern-replay-scrubber path').getAttribute('d')).toContain('M');
 for(const width of [1440,900,390,320]){await page.setViewportSize({width,height:844});const box=await bar(page).boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);expect(await bar(page).evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:`.local/turn4-${width}.png`});}
 await bar(page).getByRole('button',{name:'Exit replay'}).click();await expect(bar(page)).toHaveCount(0);await expect(page.locator('.reading-status')).toContainText('recorded steps');
});

test('hover and upward history scrolling leave replay running; capture can grow while paused',async({page})=>{
 await start(page);await bar(page).getByRole('button',{name:'Pause',exact:true}).click();const slider=bar(page).getByRole('slider',{name:'Timeline'});await slider.focus();await slider.press('End');for(let n=0;n<5;n++)await slider.press('PageDown');
 await bar(page).getByRole('combobox',{name:'Replay speed'}).selectOption('0.5');
 await bar(page).getByRole('button',{name:'Play',exact:true}).click();const before=await step(page);const card=page.locator('.history .op-head').last();await card.hover();await expect.poll(()=>step(page)).toBeGreaterThan(before);await expect(bar(page).getByRole('button',{name:'Pause',exact:true})).toBeVisible();
 const history=page.locator('.history'),box=(await history.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-500);const scrolled=await step(page);await expect.poll(()=>step(page)).toBeGreaterThan(scrolled);await expect(bar(page).getByRole('button',{name:'Pause',exact:true})).toBeVisible();
 await bar(page).getByRole('button',{name:'Pause',exact:true}).click();const paused=await step(page),total=Number(await slider.getAttribute('aria-valuemax'));
 appendFileSync(journal,[{...base,type:'user',uuid:'new-prompt',cwd:dir,message:{role:'user',content:'New work during replay'}},{...base,type:'assistant',uuid:'new-response',message:{role:'assistant',content:[{type:'text',text:'Appended response'}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');await app.ingest.importSource('claude-code',journal);
 await expect.poll(async()=>Number(await slider.getAttribute('aria-valuemax'))).toBeGreaterThan(total);expect(await step(page)).toBe(paused);
 await bar(page).getByRole('button',{name:'Exit replay'}).click();await expect(bar(page)).toHaveCount(0);await expect(page.locator('.history')).toContainText('New work during replay');
});
