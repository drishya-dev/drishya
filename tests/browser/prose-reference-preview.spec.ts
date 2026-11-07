import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}from'node:fs';import{join,resolve,sep}from'node:path';import{tmpdir}from'node:os';
import{test,expect}from'@playwright/test';import{App}from'../../apps/daemon/src/app.ts';import{startServer,type RunningServer}from'../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer,id:string;
test.beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-prose-reference-'));const root=join(dir,'repo'),outside=join(dir,'external');mkdirSync(root);mkdirSync(join(root,'docs'));mkdirSync(outside);writeFileSync(join(root,'docs','guide.md'),'CURRENT FILE CONTENT\n');writeFileSync(join(root,'docs','current-only.md'),'CURRENT_ONLY_VALUE\n');writeFileSync(join(root,'docs','preview.png'),readFileSync(resolve('apps/ui/public/brand/drishya-192.png')));
 const base={sessionId:'28d20aa0-7ba2-45fc-a6d4-f5d99d9557f9',cwd:root,timestamp:'2026-11-07T12:00:00Z'},rows:any[]=[{...base,type:'user',uuid:'u',message:{role:'user',content:'Reference these files'}}];
 for(const [i,path]of[join(root,'docs','guide.md'),join(outside,'report.txt'),join(root,'one','same.ts'),join(root,'two','same.ts'),join(root,'docs','preview.png')].entries()){
  rows.push({...base,type:'assistant',uuid:`a${i}`,message:{role:'assistant',content:[{type:'tool_use',id:`read${i}`,name:'Read',input:{file_path:path}}]}});
  rows.push({...base,type:'user',uuid:`r${i}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:`read${i}`,content:`1→CAPTURED FILE CONTENT ${i}\n2→A second captured line`} ]}});
 }
 const path=join(outside,'report.txt').replace(/\\/g,'/');
 rows.push({...base,type:'assistant',uuid:'reply',message:{role:'assistant',content:[{type:'text',text:`Read guide.md, \`docs/guide.md:1\`, [the guide](docs/guide.md#L1), \`${path}\`, and [external file](${path}). Open folder \`docs\`. [image](docs/preview.png), current-only.md. Unmatched unknown.md and ambiguous same.ts stay text.\n\n\`cat docs/guide.md\` is a command.\n\n\`\`\`sh\ncat docs/guide.md\n\`\`\``}]}});
 const journal=join(dir,'source.jsonl');writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');app=new App(join(dir,'home'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterEach(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe cleanup');rmSync(dir,{recursive:true,force:true});}});
for(const width of[600,1440])test(`prose file references show captured contents in preview at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.continue());
 const disk:string[]=[];page.on('request',r=>{if(/\/workspace\/(file|document|approve)/.test(r.url()))disk.push(r.url());});
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const prose=page.locator('.prose').filter({hasText:'Unmatched unknown.md'});await expect(prose.locator('button.md-path')).toHaveCount(7);await expect(prose.locator('button.md-path svg.file-format')).toHaveCount(7);
 for(const index of[0,1,2,3,4]){
  const link=prose.locator('button.md-path').nth(index);await link.focus();await link.press('Enter');const dialog=page.locator('dialog[open]');await expect(dialog).toBeVisible();await expect(dialog).toContainText(`CAPTURED FILE CONTENT ${index<3?0:1}`);await expect(page.locator('.developer-workspace')).toHaveCount(0);await dialog.getByRole('button',{name:/^Close Work on /}).click();await expect(dialog).toHaveCount(0);
 }
 await expect(prose.locator('button').filter({hasText:'unknown.md'})).toHaveCount(0);await expect(prose.locator('button').filter({hasText:'same.ts'})).toHaveCount(0);await expect(prose.locator('button').filter({hasText:'cat docs/guide.md'})).toHaveCount(0);
 await prose.getByRole('button',{name:'Show folder docs',exact:true}).click();const files=page.getByRole('complementary',{name:'Repository files'});await expect(files).toBeVisible();await expect(files.getByRole('treeitem',{name:'docs',exact:true})).toHaveAttribute('aria-selected','true');await expect(files.getByRole('treeitem',{name:'guide.md',exact:true})).toBeVisible();expect(disk).toEqual([]);
 await expect(prose.getByRole('button',{name:'Open work on docs/current-only.md',exact:true})).toHaveCount(0);
 await files.getByRole('button',{name:/Enable workspace reading/}).click();
 await prose.getByRole('button',{name:'Open work on docs/current-only.md',exact:true}).click();const current=page.getByRole('dialog',{name:'docs/current-only.md',exact:true});await expect(current).toContainText('CURRENT_ONLY_VALUE');await current.getByRole('button',{name:'Close docs/current-only.md',exact:true}).click();
 await prose.getByRole('button',{name:'Open work on docs/preview.png',exact:true}).click();const image=page.getByRole('dialog',{name:'docs/preview.png',exact:true});await image.getByRole('button',{name:'Open current file',exact:true}).click();await expect(image.locator('.path-image-current img')).toBeVisible();await image.getByRole('button',{name:'Open current image reader',exact:true}).click();const full=page.getByRole('dialog',{name:'Current image reader',exact:true});await expect(full).toBeVisible();await page.keyboard.press('Escape');await expect(full).toHaveCount(0);await expect(image).toBeVisible();await page.keyboard.press('Escape');await expect(image).toHaveCount(0);await expect(page.locator('.developer-workspace')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
