import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

let dir:string,app:App,server:RunningServer,id:string;
const text='Full captured paragraph. '.repeat(4000)+'\n\nFINAL_CAPTURED_PARAGRAPH';
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-full-prose-'));
 const file=join(dir,'synthetic.jsonl');
 writeFileSync(file,[{type:'session_meta',payload:{id:'full-prose',cwd:dir}},
  {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Explain the result.'}]}},
  {type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text}]}}
 ].map(x=>JSON.stringify(x)).join('\n'));
 app=new App(join(dir,'store'));id=(await app.ingest.importSource('codex',file)).recordingId;
 server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir)rmSync(dir,{recursive:true,force:true});});
for(const width of [600,1440])test(`full prose is mounted without a second reader at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto(server.launchUrl);await page.locator('.home').waitFor();
 await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const prose=page.locator('.prose-assistant');
 await expect(prose).toContainText('FINAL_CAPTURED_PARAGRAPH');
 await expect(prose.locator('.material-more')).toHaveCount(0);
 expect((await prose.innerText()).replace(/\s+/g,' ').trim()).toBe(text.replace(/\s+/g,' ').trim());
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

