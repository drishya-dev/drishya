import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-markdown-reading-'));const path=join(dir,'reading.jsonl');
  const text='3. Inspect source\n   - Read the implementation\n   - Inspect its callers\n     7. Check the contract\n     8. Check captured evidence\n8. Verify the result\n- Independent note\n\nA separate paragraph.';
  writeFileSync(path,[{type:'session_meta',payload:{id:'reading',cwd:dir}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Review the captured plan'}]}},{type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
  app=new App(join(dir,'store'));id=(await app.ingest.importSource('codex',path)).recordingId;server=await startServer({app,port:0,token:'synthetic-markdown-reading'});
});
test.afterAll(async()=>{if(server)await server.close();if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});

test('captured instructions retain their hierarchy, ordinals and readable narrow layout',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const prose=page.locator('.prose').filter({hasText:'Inspect source'});
  await expect(prose.locator(':scope > ol')).toHaveAttribute('start','3');
  await expect(prose.locator(':scope > ol > li')).toHaveCount(2);
  await expect(prose.locator(':scope > ol > li').last()).toHaveAttribute('value','8');
  await expect(prose.locator('ul ol')).toHaveAttribute('start','7');
  await expect(prose.locator(':scope > ul')).toContainText('Independent note');
  for(const width of [1440,900,390]){
    await page.setViewportSize({width,height:900});
    expect(await prose.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    await expect(prose.getByText('A separate paragraph.')).toBeVisible();
  }
});
