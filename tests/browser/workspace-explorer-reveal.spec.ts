import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {recordedFileRoots} from '../../apps/daemon/src/file-roots.ts';

let dir:string,id:string,mixedId:string,other:string,mainAlias:string,app:App,server:RunningServer;
const primary=['README.md','src/a.ts','src/deep/b.ts','tests/a.test.ts'];
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-explorer-reveal-'));
  const root=join(dir,'repo'),worker=join(dir,'other','repo');
  for(const path of [...primary,'zz/deep/last.ts',...Array.from({length:180},(_,i)=>`inventory-${String(i).padStart(3,'0')}.ts`)]){
    mkdirSync(join(root,path,'..'),{recursive:true});
    writeFileSync(join(root,path),Array.from({length:400},(_,i)=>`// Source line ${i+1}`).join('\n'));
  }
  mkdirSync(join(worker,'src'),{recursive:true});
  const journal=join(dir,'synthetic.jsonl');
  const rows:Record<string,unknown>[]=[root,worker].flatMap((cwd,i)=>[
    {type:'assistant',uuid:`a${i}`,sessionId:'explorer-reveal',cwd,message:{content:[{type:'tool_use',id:`read${i}`,name:'Read',input:{file_path:join(cwd,'src/a.ts')}}]}},
    {type:'user',uuid:`r${i}`,sessionId:'explorer-reveal',cwd,message:{content:[{type:'tool_result',tool_use_id:`read${i}`,content:'     1\t// Synthetic captured source'}]}},
  ]);
  for(let i=0;i<24;i++)rows.push({type:'assistant',uuid:`history-${i}`,sessionId:'explorer-reveal',cwd:root,message:{content:[{type:'text',text:`Synthetic history ${i+1}. `+'Captured material remains readable in history. '.repeat(30)}]}});
  writeFileSync(journal,rows.map((row,i)=>JSON.stringify({...row,timestamp:new Date(Date.UTC(2026,10,8,0,0,i)).toISOString()})).join('\n')+'\n');
  app=new App(join(dir,'home'));mixedId=(await app.ingest.importSource('claude-code',journal)).recordingId;
  // A mixed-root recording intentionally has no current inventory. Keep its
  // captured-only case separate from single-root inventory and late graph cases.
  const single=join(dir,'single.jsonl');
  writeFileSync(single,rows.filter(row=>row.cwd===root).map((row,i)=>JSON.stringify({...row,sessionId:'explorer-single',timestamp:new Date(Date.UTC(2026,10,8,0,0,i)).toISOString()})).join('\n')+'\n');
  id=(await app.ingest.importSource('claude-code',single)).recordingId;
  const metadata=await recordedFileRoots(app.store,[mixedId]);
  mainAlias=metadata.roots.find(item=>item.root.replaceAll('\\','/')===root.replaceAll('\\','/'))!.prefix+'/src/a.ts';
  other=metadata.roots.find(item=>item.root.replaceAll('\\','/')===worker.replaceAll('\\','/'))!.prefix+'/src/a.ts';
  server=await startServer({app,port:0});
});
test.afterAll(async()=>{
  await server?.close();await app?.close();
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe scratch path');
  rmSync(dir,{recursive:true,force:true});
});
async function open(page:Page,width:number,recording=id){
  await page.setViewportSize({width,height:900});
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  expect((await page.request.post(`${server.url}/v1/recordings/${recording}/workspace/approve`,{data:{remember:false}})).ok()).toBe(true);
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recording}`);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  await expect(page.getByRole('tablist',{name:'Open workspace files'})).toBeVisible();
}
async function showFiles(page:Page){
  if(await page.locator('.folder-explorer').isVisible())return;
  const chooser=page.getByRole('button',{name:'Choose workspace file',exact:true});
  if(await chooser.isVisible())await chooser.click();else await page.getByRole('button',{name:'Show files',exact:true}).click();
  await expect(page.locator('.folder-tree')).toBeVisible();
}
async function navigate(page:Page,path:string){
  // Shared entry route used by peek, history, import context and search.
  await page.evaluate(path=>window.dispatchEvent(new CustomEvent('drishya-open-workspace-file',{detail:path})),path);
  await expect(page.locator(`[data-workspace-tab="${path}"] [role=tab]`)).toHaveAttribute('aria-selected','true');
}
async function selectedVisible(page:Page,path:string){
  await showFiles(page);
  const row=page.locator('.folder-tree [aria-selected=true]');
  await expect(row).toHaveCount(1);await expect(row).toHaveAttribute('data-tree-path',path);
  await expect.poll(()=>row.evaluate(element=>{
    const item=element.getBoundingClientRect(),tree=element.closest('.folder-tree')!.getBoundingClientRect();
    return item.top>=tree.top&&item.bottom<=tree.bottom;
  })).toBe(true);
}

for(const width of [600,1440]){
  test(`active tabs reveal exact files, virtual rows and drafts without moving reading at ${width}px`,async({page})=>{
    await open(page,width);
    for(const path of [...primary,'zz/deep/last.ts']){await navigate(page,path);await selectedVisible(page,path);}
    const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
    await expect(desk.getByRole('tab')).toHaveCount(5);
    await expect(desk.getByRole('region',{name:'Workspace file zz/deep/last.ts',exact:true})).toContainText('Source line 1');
    // Every tab click follows the same active identity as external navigation.
    for(const path of primary){
      if(width===600)await page.getByRole('button',{name:'Choose workspace file',exact:true}).click();
      const tab=desk.locator(`[data-workspace-tab="${path}"] [role=tab]`);await tab.click();
      if(width===1440)await expect(tab).toBeFocused();
      await selectedVisible(page,path);
    }
    if(width===1440){
      const origin=desk.getByRole('button',{name:'Back to agent',exact:true});await origin.focus();
      await navigate(page,'README.md');await selectedVisible(page,'README.md');await expect(origin).toBeFocused();
      await navigate(page,'tests/a.test.ts');await selectedVisible(page,'tests/a.test.ts');await expect(origin).toBeFocused();
    }
    // The active split pane, rather than the last tab in the primary pane, owns selection.
    if(width===600)await page.getByRole('button',{name:'Choose workspace file',exact:true}).click();
    await desk.getByLabel('Workspace layout actions',{exact:true}).click();
    await desk.getByRole('button',{name:'Split view',exact:true}).click();
    if(width===600){
      for(let index=0;index<2;index++){
        await desk.getByLabel('Workspace layout actions',{exact:true}).click();
        const switcher=desk.getByRole('button',{name:/^Pane [12] of 2/});
        const target=(await switcher.textContent())!.includes('Pane 1')?'README.md':'tests/a.test.ts';
        await switcher.click();await selectedVisible(page,target);
        await page.getByRole('button',{name:'Choose workspace file',exact:true}).click();
      }
    }else{
      // Desktop panes are both visible; the switch is deliberately narrow-only.
      for(const path of ['README.md','tests/a.test.ts']){
        const document=desk.getByRole('region',{name:`Workspace file ${path}`,exact:true});
        await document.focus();await selectedVisible(page,path);await expect(document).toBeFocused();
      }
    }
    await desk.getByLabel('Workspace layout actions',{exact:true}).click();
    await desk.getByRole('button',{name:'Reset layout',exact:true}).click();
    // A matching filtered leaf must not consume reveal before the full tree returns.
    await showFiles(page);
    await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('last.ts');
    await navigate(page,'zz/deep/last.ts');await selectedVisible(page,'zz/deep/last.ts');
    await expect(page.getByRole('textbox',{name:'Find repository files',exact:true})).toHaveValue('');
    expect(await page.locator('.folder-tree').evaluate(el=>el.scrollTop)).toBeGreaterThan(1000);
    expect(await page.locator('.folder-tree [role=treeitem]').count()).toBeLessThan(80);
    if(width===600)await page.getByRole('button',{name:'Choose workspace file',exact:true}).click();
    const source=desk.getByRole('region',{name:'Workspace file zz/deep/last.ts',exact:true}).locator('.desk-code');
    await expect(source).toBeVisible();await source.evaluate(el=>{el.scrollTop=300;el.dispatchEvent(new Event('scroll',{bubbles:true}));});
    await page.locator('.history').evaluate(el=>{el.scrollTop=150;el.dispatchEvent(new Event('scroll',{bubbles:true}));});
    const reading=await source.evaluate(el=>el.scrollTop),history=await page.locator('.history').evaluate(el=>el.scrollTop);
    expect(reading).toBeGreaterThan(0);expect(history).toBeGreaterThan(0);
    await showFiles(page);await selectedVisible(page,'zz/deep/last.ts');
    expect(await source.evaluate(el=>el.scrollTop)).toBe(reading);
    expect(await page.locator('.history').evaluate(el=>el.scrollTop)).toBe(history);
    const folder=page.locator('[data-tree-path="zz/deep"]');await folder.click();await expect(folder).toHaveAttribute('aria-expanded','false');
    // Reading writes and reopening Workspace cannot undo a manual collapse.
    await source.evaluate(el=>{el.dispatchEvent(new Event('scroll',{bubbles:true}));});
    await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
    await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();await showFiles(page);
    await expect(page.locator('[data-tree-path="zz/deep"]')).toHaveAttribute('aria-expanded','false');
    if(width===600)await page.getByRole('button',{name:'Choose workspace file',exact:true}).click();
    await desk.locator('[data-workspace-tab="README.md"] [role=tab]').click();await selectedVisible(page,'README.md');
    if(width===600)await page.getByRole('button',{name:'Choose workspace file',exact:true}).click();
    await desk.locator('[data-workspace-tab="zz/deep/last.ts"] [role=tab]').click();await selectedVisible(page,'zz/deep/last.ts');
    expect(await source.evaluate(el=>el.scrollTop)).toBe(reading);
    // A creation draft has a real tree home without pretending it exists on disk.
    if(width===600)await page.getByRole('button',{name:'Choose workspace file',exact:true}).click();
    if(width===600)await desk.getByLabel('Workspace layout actions',{exact:true}).click();
    await desk.getByRole('button',{name:'＋ New file',exact:true}).click();
    await desk.getByRole('textbox',{name:'New workspace file path'}).fill('new/nested/draft.ts');
    await desk.getByRole('button',{name:'Create draft',exact:true}).click();
    const editor=desk.getByLabel('Local draft for new/nested/draft.ts',{exact:true});
    await expect(editor).toBeFocused();
    await desk.getByRole('button',{name:'Compare draft',exact:true}).click();
    await desk.getByRole('button',{name:'Edit draft',exact:true}).click();
    await expect(editor).toBeFocused();
    await selectedVisible(page,'new/nested/draft.ts');
    await expect(page.locator('[data-tree-path="new/nested/draft.ts"]')).toHaveAttribute('aria-description','Local draft; file not created on disk.');
  });

  test(`Touched excludes active untouched files and unsent creation drafts at ${width}px`,async({page})=>{
    let releaseEditor!:()=>void;
    const editorReady=new Promise<void>(resolve=>{releaseEditor=resolve;});
    await page.route(/\/assets\/DraftEditor-[^/]+\.js$/,async route=>{
      await editorReady;
      await route.continue();
    });
    await open(page,width);
    await navigate(page,'README.md');await selectedVisible(page,'README.md');
    const explorer=page.locator('.folder-explorer'),filter=explorer.locator('.tree-evidence-filter');
    const touched=async()=>{
      await showFiles(page);await explorer.getByLabel('File filters',{exact:true}).click();
      await explorer.getByRole('button',{name:'Touched',exact:true}).click();
      await expect(filter).toHaveAttribute('data-touched','true');
    };
    await touched();
    await expect(explorer.locator('[data-tree-path="README.md"]')).toHaveCount(0);
    // A different active tab deliberately returns to All files for its reveal.
    await navigate(page,'src/deep/b.ts');await selectedVisible(page,'src/deep/b.ts');
    await expect(filter).toHaveAttribute('data-touched','false');
    const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
    if(width===600){
      await page.getByRole('button',{name:'Choose workspace file',exact:true}).click();
      await desk.getByLabel('Workspace layout actions',{exact:true}).click();
    }
    await desk.getByRole('button',{name:'＋ New file',exact:true}).click();
    await desk.getByRole('textbox',{name:'New workspace file path'}).fill('new/untouched-draft.ts');
    await desk.getByRole('button',{name:'Create draft',exact:true}).click();
    try {
      await selectedVisible(page,'new/untouched-draft.ts');
      await expect(desk.getByText('Opening editor…')).toBeVisible();
      const trigger=explorer.getByLabel('File filters',{exact:true});
      // Exercise pointer activation even when a native summary does not take focus.
      await trigger.evaluate(element=>element.addEventListener('mousedown',event=>event.preventDefault(),{once:true}));
      await trigger.click();
      await expect(filter).toHaveAttribute('open','');
    } finally {
      releaseEditor();
    }
    const editor=desk.getByLabel('Local draft for new/untouched-draft.ts',{exact:true});
    await expect(editor).toBeVisible();
    await expect(editor).not.toBeFocused();
    await explorer.getByRole('button',{name:'Touched',exact:true}).click();
    await expect(filter).toHaveAttribute('data-touched','true');
    await expect(explorer.locator('[data-tree-path="new/untouched-draft.ts"]')).toHaveCount(0);
    await expect(explorer.locator('[data-tree-path="src/deep/b.ts"]')).toHaveCount(0);
    await expect(explorer.locator('[data-tree-path="src/a.ts"]')).toBeVisible();
    await navigate(page,'src/deep/b.ts');
    await selectedVisible(page,'src/deep/b.ts');await expect(filter).toHaveAttribute('data-touched','false');
    await touched();
    await expect(explorer.locator('[data-tree-path="src/deep/b.ts"]')).toHaveCount(0);
    await expect(explorer.locator('[data-tree-path="new/untouched-draft.ts"]')).toHaveCount(0);
    await navigate(page,'new/untouched-draft.ts');await selectedVisible(page,'new/untouched-draft.ts');
    await expect(filter).toHaveAttribute('data-touched','false');
  });

  for(const collapse of [false,true])test(`late roots ${collapse?'respect collapse':'finish pending reveal'} at ${width}px`,async({page})=>{
    let release!:()=>void;const ready=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/file-roots',async route=>{await ready;await route.continue();});
    await open(page,width,mixedId);await navigate(page,other);await selectedVisible(page,'\u0000unplaced-paths');
    if(collapse)await page.getByRole('treeitem',{name:'Unplaced paths',exact:true}).click();
    release();
    if(collapse){
      await expect(page.getByRole('treeitem',{name:'Other working directories',exact:true})).toHaveAttribute('aria-expanded','false');
      await navigate(page,'src/a.ts');await selectedVisible(page,mainAlias);await navigate(page,other);
    }
    await selectedVisible(page,other);
    await expect(page.locator('[data-tree-path="'+other.split('/')[0]+'"]')).toHaveAttribute('aria-expanded','true');
    const group=page.getByRole('treeitem',{name:'Other working directories',exact:true});await group.click();await expect(group).toHaveAttribute('aria-expanded','false');
    await page.getByRole('button',{name:'Back to agent',exact:true}).click();
    await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();await showFiles(page);
    await expect(page.getByRole('treeitem',{name:'Other working directories',exact:true})).toHaveAttribute('aria-expanded','false');
    await navigate(page,'src/a.ts');await selectedVisible(page,mainAlias);
    await navigate(page,other);await selectedVisible(page,other);
  });

  for(const collapse of [false,true])test(`late inventory ${collapse?'respects collapse':'finishes reveal'} at ${width}px`,async({page})=>{
    let release!:()=>void;const ready=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/graph',async route=>{await ready;await route.continue();});
    await open(page,width);await navigate(page,'zz/deep/last.ts');await selectedVisible(page,'\u0000unplaced-paths');
    if(collapse){const group=page.getByRole('treeitem',{name:'Unplaced paths',exact:true});await group.click();await expect(group).toHaveAttribute('aria-expanded','false');}
    release();
    if(collapse){
      // A preserved manual collapse also preserves scroll; the closed folder is
      // below the virtual window until the user scrolls to that part of the tree.
      await expect(page.locator('[data-tree-path="README.md"]')).toBeVisible();
      await page.locator('.folder-tree').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll',{bubbles:true}));});
      await expect(page.locator('[data-tree-path="zz"]')).toHaveAttribute('aria-expanded','false');
      await navigate(page,'README.md');await selectedVisible(page,'README.md');
      await navigate(page,'zz/deep/last.ts');
    }
    await selectedVisible(page,'zz/deep/last.ts');
  });
}
