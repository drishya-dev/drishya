import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {HarnessController} from '../../apps/daemon/src/controller.ts';

// UI-28b: typing a long prompt grows only the composer, upward from its fixed bottom edge. Nothing else moves or reflows:
// not the history or its scroll position, the Follow switch, the rails, the Toolbox or the map controls.
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-composer-grows-'));
  const root=join(dir,'repository');mkdirSync(root);
  const session='6d6e0f3e-6f43-4b33-8f46-0f2c9a1d7b11',rows=[{sessionId:session,cwd:root,timestamp:'2026-11-08T12:00:00Z',type:'user',uuid:'u0',message:{role:'user',content:'Synthetic request with a long history'}}];
  for(let i=0;i<40;i++)rows.push({sessionId:session,cwd:root,timestamp:`2026-11-08T12:${String(1+i).padStart(2,'0')}:00Z`,type:'assistant',uuid:`a${i}`,message:{role:'assistant',content:[{type:'text',text:`Synthetic reply ${i}. `.repeat(12)}]}} as never);
  const journal=join(dir,'session.jsonl');writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
  const transport=join(dir,'transport.mjs');
  writeFileSync(transport,`import{createInterface}from'node:readline';const send=v=>process.stdout.write(JSON.stringify(v)+'\\n');createInterface({input:process.stdin}).on('line',line=>{const v=JSON.parse(line);if(v.type==='control_request')send({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{models:[],commands:[]}}});});`);
  app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;
  server=await startServer({app,port:0,controllerFactory:(a,w)=>new HarnessController(a,w,{resolveExecutable:()=>process.execPath,launch:((_bin:string,_args:string[],opts:any)=>spawn(process.execPath,[transport],opts)) as typeof spawn})});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe cleanup');rmSync(dir,{recursive:true,force:true});}});

// Everything on screen that is not the composer, as rounded rectangles; plus the history's scroll position.
const SURFACES=['.history','.history-inner','.follow-pill','.catalog-toggle','.history-transport','.modern-tool-station','.folder-explorer','.history-prompt-marks','.map-tools','.modern-session-header','.toolbox-rail'];
async function snapshot(page:Page){
  return page.evaluate(selectors=>{
    const rects:Record<string,string[]>={};
    for(const selector of selectors)rects[selector]=[...document.querySelectorAll<HTMLElement>(selector)].filter(node=>node.getClientRects().length&&!node.closest('.prompt-composer')).map(node=>{const r=node.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(v=>v.toFixed(1)).join(',');});
    const history=document.querySelector<HTMLElement>('.history');
    return {rects,scrollTop:history?.scrollTop??-1,scrollHeight:history?.scrollHeight??-1};
  },SURFACES);
}

for(const width of [600,1440]) test(`only the composer grows while a long prompt is typed at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const composer=page.getByRole('region',{name:'Harness prompt'});
  await expect(composer.locator('.composer-minimize')).toBeVisible();
  if(await composer.locator('.composer-minimize').getAttribute('aria-expanded')==='false')await composer.locator('.composer-minimize').click();
  const enable=composer.getByRole('button',{name:'Enable this workspace',exact:true});
  if(await enable.isVisible()){await enable.click();await expect(composer.locator('.composer-setup')).toHaveCount(0);}
  await expect(page.locator('.history')).toBeVisible();
  const textbox=composer.getByRole('textbox');
  await textbox.fill('One line');
  await page.waitForTimeout(400);
  const box=async()=>(await composer.boundingBox())!;
  const rest=await box(),before=await snapshot(page);
  expect(Object.values(before.rects).flat().length,'surfaces were measured').toBeGreaterThan(3);
  let previous=rest.height,reachedMax=false;
  for(const lines of [2,3,5,8,13,21,34]){
    await textbox.fill(Array.from({length:lines},(_,index)=>`Line ${index+1} of a prompt that keeps growing`).join('\n'));
    await page.waitForTimeout(250);
    const now=await box(),after=await snapshot(page);
    // The box grows upward from a fixed bottom edge; once it stops growing the text scrolls inside it.
    expect(Math.abs((now.y+now.height)-(rest.y+rest.height)),`${lines} lines: the bottom edge stays`).toBeLessThanOrEqual(1);
    expect(now.height,`${lines} lines: the box never shrinks`).toBeGreaterThanOrEqual(previous-1);
    if(now.height<=previous+1&&lines>5)reachedMax=true;
    previous=now.height;
    expect(after.rects,`${lines} lines: nothing else moves or resizes`).toEqual(before.rects);
    expect(after.scrollTop,`${lines} lines: the history stays where it was`).toBe(before.scrollTop);
    expect(after.scrollHeight,`${lines} lines: the history is not reflowed`).toBe(before.scrollHeight);
  }
  expect(reachedMax,'the box reached its maximum height and stopped growing').toBe(true);
  expect(await textbox.evaluate(node=>node.scrollHeight>node.clientHeight),'past the maximum the text scrolls inside the box').toBe(true);
});

// UI-28c keeps the stage still. At 600px MOTION-4b moves the bottom controls clear of the open composer.
const narrowBottomControls = ['.catalog-toggle', '.history-prompt-marks', '.history-transport'];
for(const [width,height] of [[600,900],[1440,900],[2560,1440]] as const) test(`collapsing and opening the composer moves nothing else at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const composer=page.getByRole('region',{name:'Harness prompt'});
  const minimize=composer.locator('.composer-minimize');await expect(minimize).toBeVisible();
  const setOpen=async(open:boolean)=>{if((await minimize.getAttribute('aria-expanded'))!==String(open))await minimize.click();await expect(minimize).toHaveAttribute('aria-expanded',String(open));await page.waitForTimeout(350);};
  await setOpen(false);await expect(page.locator('.history')).toBeVisible();
  const before=await snapshot(page);
  expect(Object.values(before.rects).flat().length,'surfaces were measured').toBeGreaterThan(3);
  const sizes=new Set<string>();
  for(const open of [true,false,true,false,true,false]){
    await setOpen(open);sizes.add(String(Math.round((await composer.boundingBox())!.height)));
    const after=await snapshot(page);
    const fixed = (rects: Record<string, string[]>) => Object.fromEntries(Object.entries(rects)
      .filter(([selector]) => !(open && width === 600 && narrowBottomControls.includes(selector))));
    expect(fixed(after.rects),`${open?'open':'collapsed'}: fixed surfaces stay`).toEqual(fixed(before.rects));
    if (open && width === 600) {
      const tools = page.locator('.catalog-toggle');
      await expect(tools).toBeInViewport();
      await tools.click({ trial: true });
      await composer.getByRole('button', { name: 'Attach', exact: true }).click({ trial: true });
      expect((await tools.boundingBox())!.y).toBeLessThan(Number(before.rects['.catalog-toggle']![0]!.split(',')[1]));
    }
    expect(after.scrollTop,`${open?'open':'collapsed'}: the history does not jump`).toBe(before.scrollTop);
    expect(after.scrollHeight,`${open?'open':'collapsed'}: the history is not reflowed`).toBe(before.scrollHeight);
  }
  expect(sizes.size,'the composer itself did change size between its states').toBeGreaterThan(1);
});
