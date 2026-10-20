import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
test.use({actionTimeout:10000});
let app:App,server:RunningServer,dir:string,id:string;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-turn2-'));mkdirSync(join(dir,'src'));writeFileSync(join(dir,'src','a.ts'),'export const current = 1;');
  const journal=join(dir,'session.jsonl'),base={sessionId:'keyboard-reading',cwd:dir,timestamp:'2026-10-20T09:00:00Z'},rows:unknown[]=[];
  for(let turn=0;turn<45;turn++){
    rows.push({...base,type:'user',uuid:`prompt-${turn}`,message:{role:'user',content:`Keyboard turn ${turn}`}});
    const operations=[['Read',{file_path:join(dir,'src','a.ts')},'1\texport const captured = 1;',false],['Edit',{file_path:join(dir,'src','a.ts'),old_string:'1',new_string:'2'},'File edited',false],['Bash',{command:`node task${turn}`},'finished',false],['Bash',{command:`npm test -- keyboard${turn}`},'Tests: 1 failed, 2 passed, 3 total',true]] as const;
    operations.forEach(([name,input,content,is_error],n)=>{const key=`op-${turn}-${n}`;rows.push({...base,type:'assistant',uuid:`a-${key}`,message:{role:'assistant',content:[{type:'tool_use',id:key,name,input}]}});rows.push({...base,type:'user',uuid:`r-${key}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:key,content,is_error}]}});});
  }
  writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir&&resolve(dir).startsWith(resolve(tmpdir())+sep))rmSync(dir,{recursive:true,force:true});});
async function open(page:Page,running:RunningServer,recording:string){
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
  await page.setViewportSize({width:1440,height:960});await page.goto(running.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${running.url}/?experience=modern&motion=0#/r/${recording}`);await expect(page.locator('.history article[data-op-id]').first()).toBeVisible();await page.locator('.history').focus();
}
const focused=(page:Page)=>page.locator('.history article[data-reading-focus]');
async function press(page:Page,key:string,operation:string){await page.keyboard.press(key);await expect(focused(page)).toHaveAttribute('data-op-id',operation);await expect(focused(page)).toBeFocused();}
test('whole-session keyboard reading, copy, peek, folding and guide respect input ownership',async({page,context})=>{
  await open(page,server,id);const p=app.projection(id),ops=[...p.operations].sort((a,b)=>a.startSequence-b.startSequence),first=ops[0]!,last=ops.at(-1)!;
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:server.url});
  const follow=page.getByRole('switch',{name:'Automatically follow new work',exact:true});await expect(follow).toHaveAttribute('aria-checked','true');
  await press(page,'g',first.id);await expect(follow).toHaveAttribute('aria-checked','false');
  await press(page,'j',ops[1]!.id);await press(page,'k',first.id);
  await press(page,'n',ops[1]!.id);await press(page,'n',ops[5]!.id);await press(page,'p',ops[1]!.id);
  await press(page,'f',ops[3]!.id);
  await page.keyboard.press('t');await expect(page.locator('.history').getByText('Keyboard turn 1',{exact:true})).toBeInViewport();await page.keyboard.press('T');await expect(page.locator('.history').getByText('Keyboard turn 0',{exact:true})).toBeInViewport();
  await press(page,'g',first.id);await page.keyboard.press('e');await expect(focused(page)).toHaveClass(/expanded/);await page.keyboard.press('e');await expect(focused(page)).not.toHaveClass(/expanded/);
  await press(page,'j',ops[1]!.id);await press(page,'j',ops[2]!.id);await page.keyboard.press('y');await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe('node task0');
  await press(page,'G',last.id);await page.keyboard.press('k');await page.keyboard.press('k');await expect(focused(page)).toHaveAttribute('data-op-id',ops.at(-3)!.id);
  const find=page.getByRole('textbox',{name:'Find repository files'});await find.fill('');await find.pressSequentially('jng?');await expect(find).toHaveValue('jng?');await expect(page.getByRole('dialog',{name:'Reading shortcuts',exact:true})).toHaveCount(0);
  await page.locator('.history').focus();await press(page,'g',first.id);const before=await focused(page).evaluate(el=>el.getBoundingClientRect().top);
  await page.keyboard.press('c');await expect.poll(()=>page.locator('.passage-slot[data-folded="header"]').count()).toBeGreaterThan(0);expect(Math.abs(await focused(page).evaluate(el=>el.getBoundingClientRect().top)-before)).toBeLessThanOrEqual(2);
  await page.keyboard.press('C');await expect(page.locator('.passage-slot[data-folded="header"]')).toHaveCount(0);
  await page.keyboard.press('?');const guide=page.getByRole('dialog',{name:'Reading shortcuts',exact:true});await expect(guide).toBeVisible();await expect(guide).toContainText('Next / previous operation');await page.keyboard.press('Escape');await expect(guide).toHaveCount(0);
  await page.getByRole('button',{name:'Workspace settings',exact:true}).click();await page.getByRole('tab',{name:'Keyboard',exact:true}).click();await page.getByRole('button',{name:'Reading shortcuts',exact:true}).click();await expect(guide).toBeVisible();await page.keyboard.press('Escape');
  await page.locator('.history').focus();await press(page,'g',first.id);await page.keyboard.press('o');await expect(page.getByRole('dialog',{name:'src/a.ts',exact:true})).toBeVisible();await expect(focused(page)).toHaveAttribute('data-op-id',first.id);
  await page.screenshot({path:resolve('.local/turn2-peek.png')});
});
test('Home guide fits a narrow screen and CodeMirror retains typing shortcuts',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.getByRole('button',{name:'Workspace settings',exact:true}).click();await page.getByRole('tab',{name:'Keyboard',exact:true}).click();await page.getByRole('button',{name:'Reading shortcuts',exact:true}).click();
  const guide=page.getByRole('dialog',{name:'Reading shortcuts',exact:true});await expect(guide).toBeVisible();await page.setViewportSize({width:320,height:780});expect(await guide.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);await page.keyboard.press('Escape');await expect(page.locator('.home')).toBeVisible();
  await open(page,server,id);await press(page,'g',app.projection(id).operations[0]!.id);await page.keyboard.press('o');const reader=page.getByRole('dialog',{name:'src/a.ts',exact:true});await reader.getByRole('button',{name:'Approve current-file reading',exact:true}).click();await reader.getByRole('button',{name:'Open in Workspace',exact:true}).click();
  const workspace=page.locator('.developer-workspace');await workspace.getByRole('button',{name:'Edit file',exact:true}).click();const editor=workspace.locator('.cm-content');await expect(editor).toBeFocused();await editor.pressSequentially('j?nc');await expect(editor).toContainText('j?nc');await expect(guide).toHaveCount(0);
  await workspace.getByRole('button',{name:'Back to agent',exact:true}).click();await page.getByRole('button',{name:'Workspace settings',exact:true}).click();await page.getByRole('tab',{name:'Reading',exact:true}).click();await page.getByRole('checkbox',{name:/^Relationship motion/}).check();await page.getByRole('button',{name:'Close Workspace settings',exact:true}).click();await expect(page.getByRole('dialog',{name:'Workspace settings',exact:true})).toHaveCount(0);await page.locator('.history').focus();await page.keyboard.press('?');await expect(guide).toBeVisible();expect(await guide.evaluate(el=>el.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
});
test('the guide leaves an explicit replay clock running',async({page})=>{
  await open(page,server,id);await page.getByRole('button',{name:'Workspace settings',exact:true}).click();await page.getByRole('tab',{name:'Playback',exact:true}).click();await page.getByText('Sequence diagnostics',{exact:true}).click();await page.getByRole('button',{name:'Replay sequence',exact:true}).click();await expect(page.getByRole('dialog',{name:'Workspace settings',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await page.locator('.history').focus();await page.keyboard.press('?');const guide=page.getByRole('dialog',{name:'Reading shortcuts',exact:true});await expect(guide).toBeVisible();
  const step=()=>page.getByRole('slider',{name:'Timeline',exact:true}).getAttribute('aria-valuenow').then(Number),before=await step();await expect.poll(step).toBeGreaterThan(before);await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(guide).toHaveCount(0);await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
});
const actualStore=process.env.DRISHYA_REVIEW_STORE,actualIds=(process.env.DRISHYA_REVIEW_IDS??'').split(',').filter(Boolean);
test('real Codex and Claude sessions navigate paged edges without inspector or scroll overflow',async({page})=>{
  test.skip(!actualStore||!actualIds.length,'Requires explicit local redacted data');const actual=new App(actualStore!),running=await startServer({app:actual,port:0}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{for(const recording of actualIds){await open(page,running,recording);const ops=[...actual.projection(recording).operations].sort((a,b)=>a.startSequence-b.startSequence);if(!ops.length)continue;
    await press(page,'g',ops[0]!.id);await press(page,'j',ops[1]!.id);await press(page,'G',ops.at(-1)!.id);await press(page,'k',ops.at(-2)!.id);
    await expect(page.locator('.inspector')).toHaveCount(0);await expect(focused(page)).toBeInViewport();expect(await page.locator('.history').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press('?');await expect(page.getByRole('dialog',{name:'Reading shortcuts',exact:true})).toBeVisible();await page.screenshot({path:resolve(`.local/turn2-${recording}.png`)});await page.keyboard.press('Escape');
  }expect(errors).toEqual([]);}finally{await running.close();await actual.close();}
});
