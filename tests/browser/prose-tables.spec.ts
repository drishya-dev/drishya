import{mkdtempSync,writeFileSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve,sep}from'node:path';
import{test,expect}from'@playwright/test';import{App}from'../../apps/daemon/src/app.ts';import{startServer,type RunningServer}from'../../apps/daemon/src/server.ts';
let app:App,server:RunningServer,dir:string,id:string;
const table='| Code | Local | Web | Escaped |\n| --- | --- | --- | --- |\n| `node -v` | [file](sample.ts) | [site](https://example.com) | a\\|b |';
const wide='| A | B | C | D | E | F |\n| --- | --- | --- | --- | --- | --- |\n| '+Array(6).fill('wide_'+'x'.repeat(100)).join(' | ')+' |';
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-tables-'));app=new App(join(dir,'home'));const journal=join(dir,'session.jsonl');writeFileSync(journal,[{type:'session_meta',payload:{id:'0199c0de-0000-7000-8000-000000000111',cwd:dir}},{type:'response_item',payload:{type:'custom_tool_call',call_id:'sample-file',name:'apply_patch',input:'*** Begin Patch\n*** Add File: sample.ts\n+export const sample = 1;\n*** End Patch'}},{type:'response_item',payload:{type:'custom_tool_call_output',call_id:'sample-file',output:'Success. Updated the following files:\nA sample.ts'}},{type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:table+'\n\n'+wide}]}}].map(x=>JSON.stringify(x)).join('\n')+'\n');id=(await app.ingest.importSource('codex',journal)).recordingId;server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(resolve(dir).startsWith(resolve(tmpdir())+sep))rmSync(dir,{recursive:true,force:true});});
for(const width of[600,1440])test(`prose tables, links and original copy at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?motion=0#/r/${id}`);
 const tables=page.locator('.prose .md-prose-table');await expect(tables).toHaveCount(2);
 await expect(tables.first().locator('td code').first()).toHaveText('node -v');await expect(tables.first().getByRole('button',{name:'Open work on sample.ts'})).toBeVisible();
 await expect(tables.first().getByRole('link',{name:'site'})).toHaveAttribute('href','https://example.com');await expect(tables.first().locator('td').last()).toHaveText('a|b');
 for(const palette of['jet','paper','midnight','mocha','tokyo','nord','gruvbox']){
  await page.evaluate(p=>document.documentElement.dataset.palette=p,palette);
  const scroller=tables.last().locator('.md-table-scroll');expect(await scroller.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{(window as any).copiedTable=value;}}}));
 await tables.first().getByRole('button',{name:'Original',exact:true}).click();await expect(tables.first().locator('table')).toHaveCount(0);
 await tables.first().getByRole('button',{name:'Copy',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copiedTable)).toBe(table);
 await tables.first().getByRole('button',{name:'Original',exact:true}).click();await expect(tables.first().locator('table')).toHaveCount(1);
});
